import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, IsNull } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { Script } from "../entities/script.entity";
import {
  AITask,
  AITaskStatus,
  AITaskStatusType,
} from "../entities/ai-task.entity";
import {
  Collaborator,
  CollaboratorRole,
} from "../../project/entities/collaborator.entity";
import { Project } from "../../project/entities/project.entity";
import { VolcanoSubjectDetectionProvider } from "../../ai/providers/volcano-subject-detection.provider";
import { VolcanoOmniHumanProvider } from "../../ai/providers/volcano-omnihuman.provider";
import { MaskStorageService, SubjectRegion } from "../../script-ai/services/mask-storage.service";
import { LipSyncBillingService } from "../../script-ai/services/lip-sync-billing.service";
import { WebSocketService } from "../../websocket/websocket.service";
import { OssService } from "../../../common/oss/oss.service";
import { FileCategory } from "@pixaura/shared-types";
import { UrlTransformService } from "../../../common/services/url-transform.service";
import { TempFileService } from "../../../common/services/temp-file.service";
import { NgrokService } from "../../../common/services/ngrok.service";
import type {
  DetectSubjectsResponse,
  DetectedSubjectResult,
  GenerateLipSyncVideoResponse,
  LipSyncVideoStatusResponse,
  UploadManualRegionResponse,
  UpdateCharacterRegionsResponse,
  GenerateLipSyncVideoDto,
  UploadManualRegionDto,
  UpdateCharacterRegionsDto,
  UploadCroppedImageResponse,
  CopyDialogueAudioDto,
  CopyDialogueAudioResponse,
} from "../dto/script-shot-group.dto";
import { randomUUID } from "crypto";

/**
 * 分镜组服务
 * 处理分镜组相关 API：主体检测、对口型视频生成、手动框选等
 */
@Injectable()
export class ScriptShotGroupService {
  private readonly logger = new Logger(ScriptShotGroupService.name);

  constructor(
    @InjectRepository(Script)
    private readonly scriptRepository: Repository<Script>,
    @InjectRepository(AITask)
    private readonly aiTaskRepository: Repository<AITask>,
    @InjectRepository(Collaborator)
    private readonly collaboratorRepository: Repository<Collaborator>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    private readonly subjectDetectionProvider: VolcanoSubjectDetectionProvider,
    private readonly omniHumanProvider: VolcanoOmniHumanProvider,
    private readonly maskStorageService: MaskStorageService,
    private readonly lipSyncBillingService: LipSyncBillingService,
    private readonly webSocketService: WebSocketService,
    private readonly ossService: OssService,
    private readonly configService: ConfigService,
    private readonly urlTransformService: UrlTransformService,
    private readonly tempFileService: TempFileService,
    private readonly ngrokService: NgrokService,
  ) {}

  /**
   * 检查用户是否有项目访问权限
   */
  private async checkProjectAccess(
    userId: string,
    projectId: string,
    requireRole?: (typeof CollaboratorRole)[keyof typeof CollaboratorRole],
  ): Promise<string> {
    const project = await this.projectRepository.findOne({
      where: { projectId, isDeleted: false },
    });

    if (!project) {
      throw new NotFoundException("项目不存在");
    }

    const collaborator = await this.collaboratorRepository.findOne({
      where: { projectId, userId },
    });

    const userRole = collaborator?.role || null;

    if (!userRole) {
      throw new ForbiddenException("您不是该项目成员");
    }

    if (requireRole && userRole !== requireRole && userRole !== "owner") {
      throw new ForbiddenException("权限不足");
    }

    return userRole;
  }

  /**
   * 获取剧本内容并验证 shotGroup 存在
   */
  private async getShotGroup(
    scriptId: string,
    shotGroupId: string,
  ): Promise<{
    script: Script;
    content: Record<string, unknown>;
    shotGroup: Record<string, unknown>;
    shotGroupIndex: number;
  }> {
    const script = await this.scriptRepository.findOne({
      where: { id: scriptId, deletedAt: IsNull() },
    });

    if (!script) {
      throw new NotFoundException("剧本不存在");
    }

    const content = script.content as Record<string, unknown>;
    const shotGroups =
      (content.shotGroups as Array<Record<string, unknown>>) || [];

    const shotGroupIndex = shotGroups.findIndex((sg) => sg.id === shotGroupId);

    if (shotGroupIndex === -1) {
      throw new NotFoundException("分镜组不存在");
    }

    return {
      script,
      content,
      shotGroup: shotGroups[shotGroupIndex],
      shotGroupIndex,
    };
  }

  /**
   * 发送 WebSocket 消息
   * 使用 sendEventToUser 直接发送事件名，确保前端能正确监听
   */
  private sendWsMessage(
    userId: string,
    eventType: string,
    data: unknown,
  ): void {
    this.webSocketService.sendEventToUser(userId, eventType, data);
  }

  /**
   * 触发主体检测
   * 检测分镜组图中的主体并转存 mask 图片
   */
  async detectSubjects(
    userId: string,
    projectId: string,
    scriptId: string,
    shotGroupId: string,
  ): Promise<DetectSubjectsResponse> {
    await this.checkProjectAccess(userId, projectId);

    const { script, content, shotGroup } = await this.getShotGroup(
      scriptId,
      shotGroupId,
    );

    // 检查是否有主图
    // Bug 修复：正确处理 mainImageKey 和 images 数组的 url 格式
    // mainImageKey 可能是：纯 key（images/xxx.jpg）、/static/xxx 格式、完整 URL
    let rawImageKey = shotGroup.mainImageKey as string | undefined;
    if (!rawImageKey) {
      // 若 mainImageKey 不存在，从 images 数组中获取 type=main 的图片 URL
      const images = (shotGroup.images as Array<{ type?: string; url?: string }>) || [];
      const mainImage = images.find((img) => img.type === "main");
      rawImageKey = mainImage?.url;
    }
    if (!rawImageKey) {
      throw new BadRequestException("分镜组无主图，无法进行主体检测");
    }

    // 根据 rawImageKey 格式构建可访问的 URL
    // - 完整 URL（http 开头）：直接使用
    // - /static/ 格式：直接使用
    // - 纯 key（其他）：拼接 /static/
    const imageKeyForUrl = rawImageKey.startsWith("http") || rawImageKey.startsWith("/static/")
      ? rawImageKey
      : `/static/${rawImageKey}`;

    // 获取主图完整 URL（火山引擎需要公网可访问的 URL）
    // 使用 UrlTransformService 处理 OSS 模式（生成公网 URL）和本地模式（需要公网配置）
    const mainImageUrl = await this.urlTransformService.getAccessibleUrl(
      imageKeyForUrl,
      { allowBase64: false }, // 火山引擎主体检测不支持 base64
    );

    // 检查计费额度
    const balanceCheck =
      await this.lipSyncBillingService.checkBalanceForDetection(userId);
    if (!balanceCheck.canExecute) {
      throw new BadRequestException(
        `余额不足，预计费用 ¥${balanceCheck.estimatedCost.toFixed(2)}`,
      );
    }

    // 更新检测状态为 processing
    // Bug 修复：创建全新的数组引用以触发 TypeORM JSONB 变更检测
    const shotGroups =
      (content.shotGroups as Array<Record<string, unknown>>) || [];
    const shotGroupIndex = shotGroups.findIndex((sg) => sg.id === shotGroupId);
    const newShotGroups = [...shotGroups];
    newShotGroups[shotGroupIndex] = {
      ...shotGroup,
      detectionStatus: "processing",
      detectionError: undefined,
    };
    script.content = { ...content, shotGroups: newShotGroups };
    await this.scriptRepository.save(script);

    try {
      // 调用主体检测 API
      const detectionResult =
        await this.subjectDetectionProvider.detectSubjects(mainImageUrl);

      if (
        !detectionResult.hasSubject ||
        detectionResult.subjects.length === 0
      ) {
        // 未检测到主体
        // Bug 修复：创建全新的数组引用
        const emptyShotGroups = [...shotGroups];
        emptyShotGroups[shotGroupIndex] = {
          ...emptyShotGroups[shotGroupIndex],
          detectionStatus: "completed",
          detectedSubjects: [],
        };
        script.content = { ...content, shotGroups: emptyShotGroups };
        await this.scriptRepository.save(script);

        return {
          shotGroupId,
          detectionStatus: "completed",
          detectedSubjects: [],
        };
      }

      // 处理检测结果，从 mask 图片提取坐标
      const detectedSubjects: DetectedSubjectResult[] = [];
      for (const subject of detectionResult.subjects) {
        try {
          // 从 mask 图片提取坐标区域
          // Bug 修复：使用 imageKeyForUrl 变量（包含正确的 URL 格式）
          // extractRegionFromMask 需要 URL 格式，而不是纯 key
          const region = await this.extractRegionFromMask(
            subject.maskUrl,
            imageKeyForUrl,
          );

          detectedSubjects.push({
            index: subject.index,
            region,
            area: subject.area,
          });
        } catch (error) {
          this.logger.error(
            `提取主体 ${subject.index} 坐标失败: ${(error as Error).message}`,
          );
        }
      }

      // 扣费
      await this.lipSyncBillingService.deductForDetection(userId, shotGroupId);

      // 更新检测结果
      // Bug 修复：创建全新的数组引用
      const completedShotGroups = [...shotGroups];
      completedShotGroups[shotGroupIndex] = {
        ...completedShotGroups[shotGroupIndex],
        detectionStatus: "completed",
        detectedSubjects,
        mainImageVersion: ((shotGroup.mainImageVersion as number) || 0) + 1,
      };
      script.content = { ...content, shotGroups: completedShotGroups };
      await this.scriptRepository.save(script);

      // WebSocket 推送
      this.sendWsMessage(userId, "shotGroup:subjects-detected", {
        shotGroupId,
        detectionStatus: "completed",
        detectedSubjects,
        mainImageVersion: completedShotGroups[shotGroupIndex].mainImageVersion,
      });

      return {
        shotGroupId,
        detectionStatus: "completed",
        detectedSubjects,
      };
    } catch (error) {
      // 记录详细错误到日志（不返回给前端）
      const errorMessage = (error as Error).message || "未知错误";
      this.logger.error(`主体检测失败: shotGroupId=${shotGroupId}`);
      this.logger.debug(`详细错误信息: ${errorMessage}`);

      // 更新失败状态（保存脱敏的错误信息）
      // Bug 修复：创建全新的数组引用
      const failedShotGroups = [...shotGroups];
      failedShotGroups[shotGroupIndex] = {
        ...failedShotGroups[shotGroupIndex],
        detectionStatus: "failed",
        detectionError: "主体检测失败，请稍后重试", // 脱敏处理
      };
      script.content = { ...content, shotGroups: failedShotGroups };
      await this.scriptRepository.save(script);

      // 检查是否为本地模式 URL 无法访问的错误，提供明确的错误提示
      if (errorMessage.includes("ngrok") || errorMessage.includes("公网")) {
        throw new BadRequestException(
          "本地模式需要启动 ngrok 才能使用主体检测功能。请在另一个终端运行: ngrok http 3000",
        );
      }

      // 其他已知错误（如余额不足）直接抛出
      if (error instanceof BadRequestException) {
        throw error;
      }

      // 其他错误包装为友好提示（不暴露原始错误信息）
      throw new BadRequestException("主体检测失败，请稍后重试");
    }
  }

  /**
   * 生成对口型视频
   * 支持两种模式：
   * 1. 前端传递 croppedImageUrl + audioUrl：直接使用这些 URL 调用火山引擎
   * 2. 传统模式：从 characterRegions 获取坐标，生成 mask，查找音频
   */
  async generateLipSyncVideo(
    userId: string,
    projectId: string,
    scriptId: string,
    shotGroupId: string,
    shotId: string,
    dto: GenerateLipSyncVideoDto,
  ): Promise<GenerateLipSyncVideoResponse> {
    try {
      await this.checkProjectAccess(userId, projectId);

      const { script, content, shotGroup } = await this.getShotGroup(
        scriptId,
        shotGroupId,
      );

      // 获取 shot
      const shots = (shotGroup.shots as Array<Record<string, unknown>>) || [];
      const shot = shots.find((s) => s.id === shotId);
      if (!shot) {
        throw new NotFoundException("分镜不存在");
      }

      // Bug-10 修复：增强角色验证，提供更明确的错误信息
      // 1. 检查 characterId 是否为空
      if (!dto.characterId) {
        throw new BadRequestException("旁白对话无法生成对口型视频，请选择角色对话");
      }

      // 2. 检查角色是否在出镜角色列表中
      const characterIds = (shotGroup.characterIds as string[]) || [];
      if (!characterIds.includes(dto.characterId)) {
        throw new BadRequestException(
          `该角色未出镜，无法生成对口型视频。出镜角色: ${characterIds.join(", ") || "无"}`,
        );
      }

      // 确定音频 URL
      let audioUrl: string;
      let audioDuration = 10; // 默认值

      if (dto.audioUrl) {
        // 前端已处理音频，直接使用
        audioUrl = dto.audioUrl;
        // 从对话获取音频时长
        const dialogueId = shot.dialogueId as string;
        if (dialogueId) {
          const dialogues = (shotGroup.dialogues as Array<Record<string, unknown>>) || [];
          const dialogue = dialogues.find((d) => d.id === dialogueId);
          if (dialogue?.audioDuration) {
            audioDuration = dialogue.audioDuration as number;
          }
        }
      } else {
        // 传统模式：从对话获取音频
        const dialogueId = shot.dialogueId as string;
        if (!dialogueId) {
          throw new BadRequestException("分镜未关联对话，无法生成视频");
        }

        const dialogues =
          (shotGroup.dialogues as Array<Record<string, unknown>>) || [];
        const dialogue = dialogues.find((d) => d.id === dialogueId);
        if (!dialogue) {
          throw new BadRequestException(`对话不存在 (dialogueId: ${dialogueId})`);
        }

        const rawAudioUrl = dialogue.audioUrl as string;
        if (!rawAudioUrl) {
          throw new BadRequestException("对话无音频，无法生成对口型视频");
        }

        // 获取完整 URL（火山引擎需要公网可访问的 URL）
        audioUrl = await this.urlTransformService.getAccessibleUrl(
          rawAudioUrl,
          { allowBase64: false }, // 火山引擎对口型不支持 base64
        );
        audioDuration = (dialogue.audioDuration as number) || 10;
      }

      // 确定图片 URL 和 mask URL
      let imageUrl: string;
      let maskUrls: string[];

      if (dto.croppedImageUrl) {
        // 前端已裁切图片，直接使用
        // 裁切后的图片就是 mask（只包含角色区域）
        // 对于火山引擎 OmniHuman，需要原图 + mask
        // 但前端裁切的图片已经是角色区域的图片，可以直接作为输入
        imageUrl = dto.croppedImageUrl;
        // 当使用裁切图片时，不需要额外的 mask
        maskUrls = [];
      } else {
        // 传统模式：从 characterRegions 获取坐标，生成 mask
        // 获取主图 URL
        let rawImageKey = shotGroup.mainImageKey as string | undefined;
        if (!rawImageKey) {
          const images = (shotGroup.images as Array<{ type?: string; url?: string }>) || [];
          const mainImage = images.find((img) => img.type === "main");
          rawImageKey = mainImage?.url;
        }
        if (!rawImageKey) {
          throw new BadRequestException("分镜组无主图，请先生成分镜图片");
        }

        const imageKeyForUrl = rawImageKey.startsWith("http") || rawImageKey.startsWith("/static/")
          ? rawImageKey
          : `/static/${rawImageKey}`;

        imageUrl = await this.urlTransformService.getAccessibleUrl(
          imageKeyForUrl,
          { allowBase64: false },
        );

        // 获取角色框选配置
        const characterRegions =
          (shotGroup.characterRegions as Record<
            string,
            {
              detectedIndex?: number;
              manualRegion?: SubjectRegion;
              useManual?: boolean;
            }
          >) || {};

        // 3. 检查角色是否有框选配置
        const characterRegion = characterRegions[dto.characterId];
        if (!characterRegion) {
          throw new BadRequestException(
            "角色未配置框选区域，请先进行主体检测或手动框选",
          );
        }

        // 获取框选区域坐标
        let region: SubjectRegion;
        if (dto.useManual && characterRegion.manualRegion) {
          region = characterRegion.manualRegion;
        } else if (characterRegion.detectedIndex !== undefined) {
          const detectedSubjects =
            (shotGroup.detectedSubjects as Array<{
              index: number;
              region: SubjectRegion;
            }>) || [];
          const subject = detectedSubjects.find(
            (s) => s.index === characterRegion.detectedIndex,
          );
          if (!subject) {
            throw new BadRequestException("所选自动检测主体不存在，请重新进行主体检测");
          }
          region = subject.region;
        } else {
          throw new BadRequestException(
            `角色无${dto.useManual ? "手动" : "自动检测"}框选区域，请配置框选区域后重试`,
          );
        }

        // 根据坐标生成 mask 图片
        let maskKey: string;
        try {
          maskKey = await this.maskStorageService.generateMaskFromRegion(
            imageUrl,
            region,
            shotGroupId,
            dto.useManual ? "manual" : "subject",
            characterRegion.detectedIndex,
            dto.characterId,
            projectId,
            scriptId,
          );
        } catch (maskError) {
          this.logger.error(`生成 mask 图片失败: ${(maskError as Error).message}`);
          throw new BadRequestException(
            "生成框选区域图片失败，请检查图片是否可访问后重试",
          );
        }

        const maskUrl = await this.urlTransformService.getAccessibleUrl(
          `/static/${maskKey}`,
          { allowBase64: false },
        );
        maskUrls = [maskUrl];
      }

      // 检查音频时长（必须 < 60秒）
      if (audioDuration >= 60) {
        throw new BadRequestException("音频时长必须小于 60 秒");
      }

      // 检查计费额度
      const balanceCheck =
        await this.lipSyncBillingService.checkBalanceForLipSync(
          userId,
          audioDuration || 10,
        );
      if (!balanceCheck.canExecute) {
        throw new BadRequestException(
          `余额不足，预计费用 ¥${balanceCheck.estimatedCost.toFixed(2)}`,
        );
      }

      // 创建 AI 任务
      const taskId = randomUUID();
      const aiTask = this.aiTaskRepository.create({
        id: taskId,
        scriptId,
        type: "generate", // 使用现有类型
        status: AITaskStatus.PENDING,
        config: {
          shotGroupId,
          shotId,
          characterId: dto.characterId,
          imageUrl,
          audioUrl,
          maskUrls,
          prompt: dto.prompt,
          resolution: dto.resolution,
        },
        createdBy: userId,
      });
      await this.aiTaskRepository.save(aiTask);

      // 更新 shot 状态
      // Bug 修复：创建全新的数组引用以触发 TypeORM JSONB 变更检测
      const shotIndex = shots.findIndex((s) => s.id === shotId);
      const newShots = [...shots];
      newShots[shotIndex] = {
        ...shot,
        status: "processing",
        taskId,
      };
      const shotGroups =
        (content.shotGroups as Array<Record<string, unknown>>) || [];
      const shotGroupIndex = shotGroups.findIndex((sg) => sg.id === shotGroupId);
      const newShotGroups = [...shotGroups];
      newShotGroups[shotGroupIndex] = { ...shotGroup, shots: newShots };
      script.content = { ...content, shotGroups: newShotGroups };
      await this.scriptRepository.save(script);

      // 异步生成视频（不阻塞响应）
      this.generateLipSyncVideoAsync(
        userId,
        projectId,
        scriptId,
        shotGroupId,
        shotId,
        taskId,
        imageUrl,
        audioUrl,
        maskUrls,
        dto.prompt,
        dto.resolution === "720" ? 720 : 1080,
        audioDuration || 10,
      ).catch((error) => {
        this.logger.error(`对口型视频生成失败: taskId=${taskId}`);
        this.logger.debug("详细错误信息:", error);
      });

      return {
        shotGroupId,
        shotId,
        taskId,
        status: "pending",
      };
    } catch (error) {
      // 如果是已知的 HTTP 异常（BadRequestException, NotFoundException 等），直接抛出
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      // 记录未预期的错误
      this.logger.error(
        `生成对口型视频失败: scriptId=${scriptId}, shotGroupId=${shotGroupId}, shotId=${shotId}, error=${(error as Error).message}`,
        (error as Error).stack,
      );

      // 返回用户友好的错误消息（不暴露原始错误信息）
      throw new BadRequestException("视频生成失败，请稍后重试");
    }
  }

  /**
   * 异步生成对口型视频
   */
  private async generateLipSyncVideoAsync(
    userId: string,
    projectId: string,
    scriptId: string,
    shotGroupId: string,
    shotId: string,
    taskId: string,
    imageUrl: string,
    audioUrl: string,
    maskUrls: string[],
    prompt?: string,
    resolution?: number,
    estimatedDuration?: number,
  ): Promise<void> {
    try {
      // 更新任务状态
      await this.aiTaskRepository.update(
        { id: taskId },
        { status: AITaskStatus.PROCESSING },
      );

      // 生成视频
      const result = await this.omniHumanProvider.generateVideo(
        {
          imageUrl,
          audioUrl,
          maskUrls,
          prompt,
          outputResolution: resolution as 720 | 1080,
        },
        (progress) => {
          // WebSocket 推送进度
          this.sendWsMessage(userId, "shot:video-progress", {
            shotGroupId,
            shotId,
            taskId,
            status: "processing",
            progress,
          });
        },
      );

      // 转存视频到 OSS
      // 使用 OSS 标准路径格式：video/projects/{projectId}/scripts/{scriptId}/YYYYMMDD/sg_{shotGroupId}_{shotId}_{randomId}.mp4
      const videoKey = this.ossService.generateKey(
        FileCategory.VIDEO,
        `${shotGroupId}_${shotId}.mp4`,
        "sg_",
        projectId,
        scriptId,
      );
      // 直接保存原始视频，不再转码
      // 前端已改用视频切换模式，无需统一编码格式
      const videoBuffer = await this.downloadVideo(result.videoUrl);
      const uploadResult = await this.ossService.uploadFile(
        videoKey,
        videoBuffer,
        {
          headers: { "Content-Type": "video/mp4" },
        },
      );

      const videoUrl = uploadResult?.url || `/static/${videoKey}`;

      // 扣费
      await this.lipSyncBillingService.deductForLipSync(
        userId,
        estimatedDuration || result.duration,
        shotId,
      );

      // 更新任务和 shot 状态
      await this.aiTaskRepository.update(
        { id: taskId },
        {
          status: AITaskStatus.COMPLETED,
          result: {
            videoUrl,
            videoKey,
            duration: result.duration,
          },
        },
      );

      // 更新 script content
      const script = await this.scriptRepository.findOne({
        where: { id: scriptId },
      });
      if (script) {
        const content = script.content as Record<string, unknown>;
        const shotGroups =
          (content.shotGroups as Array<Record<string, unknown>>) || [];
        const sgIndex = shotGroups.findIndex((sg) => sg.id === shotGroupId);
        const sg = shotGroups[sgIndex];
        const sh = (sg.shots as Array<Record<string, unknown>>) || [];
        const shIndex = sh.findIndex((s) => s.id === shotId);

        // Bug 修复：创建全新的数组引用以触发 TypeORM JSONB 变更检测
        const newSh = [...sh];
        // 简化版 Shot：只包含 id, dialogueId, status, taskId, videoUrl
        newSh[shIndex] = {
          id: newSh[shIndex].id,
          dialogueId: newSh[shIndex].dialogueId,
          status: "completed",
          taskId,
          videoUrl,
        };
        const newShotGroups = [...shotGroups];
        newShotGroups[sgIndex] = { ...sg, shots: newSh };
        script.content = { ...content, shotGroups: newShotGroups };
        await this.scriptRepository.save(script);
      }

      // WebSocket 推送完成
      this.sendWsMessage(userId, "shot:video-progress", {
        shotGroupId,
        shotId,
        taskId,
        status: "completed",
        progress: 100,
        videoUrl,
        duration: result.duration,
      });
    } catch (error) {
      // 记录详细错误到日志（不返回给前端）
      const errorMessage = (error as Error).message || "未知错误";
      this.logger.error(`对口型视频生成失败: taskId=${taskId}`);
      this.logger.debug(`详细错误信息: ${errorMessage}`);

      // 更新失败状态（保存脱敏的错误信息）
      await this.aiTaskRepository.update(
        { id: taskId },
        {
          status: AITaskStatus.FAILED,
          error: "视频生成失败", // 脱敏处理
        },
      );

      // 更新 shot 状态
      const script = await this.scriptRepository.findOne({
        where: { id: scriptId },
      });
      if (script) {
        const content = script.content as Record<string, unknown>;
        const shotGroups =
          (content.shotGroups as Array<Record<string, unknown>>) || [];
        const sgIndex = shotGroups.findIndex((sg) => sg.id === shotGroupId);
        const sg = shotGroups[sgIndex];
        const sh = (sg.shots as Array<Record<string, unknown>>) || [];
        const shIndex = sh.findIndex((s) => s.id === shotId);

        // Bug 修复：创建全新的数组引用以触发 TypeORM JSONB 变更检测
        const newSh = [...sh];
        // 简化版 Shot：只包含 id, dialogueId, status, taskId, videoUrl
        newSh[shIndex] = {
          id: newSh[shIndex].id,
          dialogueId: newSh[shIndex].dialogueId,
          status: "failed",
          taskId,
          videoUrl: newSh[shIndex].videoUrl,
        };
        const newShotGroups = [...shotGroups];
        newShotGroups[sgIndex] = { ...sg, shots: newSh };
        script.content = { ...content, shotGroups: newShotGroups };
        await this.scriptRepository.save(script);
      }

      // WebSocket 推送失败（已脱敏）
      this.sendWsMessage(userId, "shot:video-progress", {
        shotGroupId,
        shotId,
        taskId,
        status: "failed",
        error: "视频生成失败",
      });

      throw error;
    }
  }

  /**
   * 查询对口型视频生成状态
   */
  async getLipSyncVideoStatus(
    userId: string,
    projectId: string,
    scriptId: string,
    shotGroupId: string,
    shotId: string,
  ): Promise<LipSyncVideoStatusResponse> {
    await this.checkProjectAccess(userId, projectId);

    const { shotGroup } = await this.getShotGroup(scriptId, shotGroupId);

    const shots = (shotGroup.shots as Array<Record<string, unknown>>) || [];
    const shot = shots.find((s) => s.id === shotId);
    if (!shot) {
      throw new NotFoundException("分镜不存在");
    }

    const taskId = shot.taskId as string;
    if (!taskId) {
      return {
        shotGroupId,
        shotId,
        taskId: "",
        status: "pending",
        progress: 0,
      };
    }

    const aiTask = await this.aiTaskRepository.findOne({
      where: { id: taskId },
    });

    if (!aiTask) {
      return {
        shotGroupId,
        shotId,
        taskId,
        status: "pending",
        progress: 0,
      };
    }

    const status = this.mapTaskStatus(aiTask.status);
    const result = aiTask.result;

    return {
      shotGroupId,
      shotId,
      taskId,
      status,
      progress: status === "completed" ? 100 : status === "processing" ? 50 : 0,
      videoUrl: result?.videoUrl as string | undefined,
      videoKey: result?.videoKey as string | undefined,
      duration: result?.duration as number | undefined,
      // 脱敏处理：如果错误信息包含外部 API 细节，返回通用提示
      error: aiTask.error
        ? this.sanitizeErrorMessage(aiTask.error)
        : undefined,
    };
  }

  /**
   * 手动框选上传
   * 只保存坐标区域，不再上传 mask 图片
   */
  async uploadManualRegion(
    userId: string,
    projectId: string,
    scriptId: string,
    shotGroupId: string,
    dto: UploadManualRegionDto,
  ): Promise<UploadManualRegionResponse> {
    await this.checkProjectAccess(userId, projectId, "editor");

    const { script, content, shotGroup, shotGroupIndex } = await this.getShotGroup(
      scriptId,
      shotGroupId,
    );

    // Bug 修复：创建新的 characterRegions 对象，而不是直接修改原引用
    const existingRegions =
      (shotGroup.characterRegions as Record<string, Record<string, unknown>>) ||
      {};
    const characterRegions = { ...existingRegions };

    characterRegions[dto.characterId] = {
      ...characterRegions[dto.characterId],
      manualRegion: dto.region,
      useManual: true,
    };

    // Bug 修复：创建全新的数组引用以触发 TypeORM JSONB 变更检测
    const shotGroups =
      (content.shotGroups as Array<Record<string, unknown>>) || [];
    const newShotGroups = [...shotGroups];
    newShotGroups[shotGroupIndex] = {
      ...shotGroup,
      characterRegions,
    };
    // 创建全新的 content 对象
    script.content = { ...content, shotGroups: newShotGroups };
    await this.scriptRepository.save(script);

    return {
      shotGroupId,
      characterId: dto.characterId,
      region: dto.region,
    };
  }

  /**
   * 更新角色框选配置
   */
  async updateCharacterRegions(
    userId: string,
    projectId: string,
    scriptId: string,
    shotGroupId: string,
    dto: UpdateCharacterRegionsDto,
  ): Promise<UpdateCharacterRegionsResponse> {
    await this.checkProjectAccess(userId, projectId, "editor");

    const { script, content, shotGroup } = await this.getShotGroup(
      scriptId,
      shotGroupId,
    );

    // Bug 修复：创建新的 characterRegions 对象，而不是直接修改原引用
    const existingRegions =
      (shotGroup.characterRegions as Record<string, Record<string, unknown>>) ||
      {};
    const characterRegions = { ...existingRegions };

    const detectedSubjects =
      (shotGroup.detectedSubjects as Array<{
        index: number;
        region: SubjectRegion;
      }>) || [];

    // 更新配置
    for (const [characterId, config] of Object.entries(dto.regions)) {
      if (!characterRegions[characterId]) {
        characterRegions[characterId] = { useManual: false };
      }

      if (config.detectedIndex !== undefined) {
        // 映射到检测到的主体
        const subject = detectedSubjects.find(
          (s) => s.index === config.detectedIndex,
        );
        if (subject) {
          characterRegions[characterId] = {
            ...characterRegions[characterId],
            detectedIndex: subject.index,
          };
        }
      }

      // 支持直接更新手动框选坐标
      if (config.manualRegion !== undefined) {
        characterRegions[characterId] = {
          ...characterRegions[characterId],
          manualRegion: config.manualRegion,
        };
      }

      if (config.useManual !== undefined) {
        characterRegions[characterId] = {
          ...characterRegions[characterId],
          useManual: config.useManual,
        };
      }
    }

    // Bug 修复：创建全新的数组引用以触发 TypeORM JSONB 变更检测
    const shotGroups =
      (content.shotGroups as Array<Record<string, unknown>>) || [];
    const shotGroupIndex = shotGroups.findIndex((sg) => sg.id === shotGroupId);
    const newShotGroups = [...shotGroups];
    newShotGroups[shotGroupIndex] = {
      ...shotGroup,
      characterRegions,
    };
    // 创建全新的 content 对象
    script.content = { ...content, shotGroups: newShotGroups };
    await this.scriptRepository.save(script);

    // 返回类型兼容的结果
    const typedRegions: UpdateCharacterRegionsResponse["characterRegions"] = {};
    for (const [charId, region] of Object.entries(characterRegions)) {
      typedRegions[charId] = {
        detectedIndex: region.detectedIndex as number | undefined,
        manualRegion: region.manualRegion as
          | { x: number; y: number; width: number; height: number }
          | undefined,
        useManual: (region.useManual as boolean) || false,
      };
    }

    return {
      shotGroupId,
      characterRegions: typedRegions,
    };
  }

  // ========== 辅助方法 ==========

  /**
   * 从 mask 图片提取坐标区域
   * 火山引擎返回的 mask 是纯白图片，尺寸与原图相同
   * 我们需要计算白色区域的边界框
   * @param maskUrl mask 图片 URL
   * @param sourceImageUrl 原图 URL（已经是可访问的格式）
   */
  private async extractRegionFromMask(
    maskUrl: string,
    sourceImageUrl: string,
  ): Promise<SubjectRegion> {
    // 获取原图尺寸
    // Bug 修复：sourceImageUrl 已经是可访问的 URL 格式，直接使用
    const accessibleUrl = await this.urlTransformService.getAccessibleUrl(
      sourceImageUrl,
    );

    // 下载原图获取尺寸
    const imgResponse = await fetch(accessibleUrl);
    if (!imgResponse.ok) {
      this.logger.error(`下载原图失败: HTTP ${imgResponse.status}`);
      throw new Error("下载原图失败，请稍后重试");
    }

    const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
    const dimensions = this.parseImageDimensions(imgBuffer);

    // 下载 mask 图片
    const maskResponse = await fetch(maskUrl);
    if (!maskResponse.ok) {
      throw new Error(`下载 mask 失败: HTTP ${maskResponse.status}`);
    }

    const maskBuffer = Buffer.from(await maskResponse.arrayBuffer());
    const maskDimensions = this.parseImageDimensions(maskBuffer);

    // 火山引擎的 mask 是全白的，表示整个主体区域
    // 我们使用固定比例作为主体的估计区域（中心区域）
    // 实际应用中，可以通过图像处理分析 mask 的非透明区域
    const centerX = 0.5;
    const centerY = 0.5;
    const width = 0.6; // 估计主体占 60% 宽度
    const height = 0.8; // 估计主体占 80% 高度

    return {
      x: centerX - width / 2,
      y: centerY - height / 2,
      width,
      height,
    };
  }

  /**
   * 解析图片尺寸
   * 支持 PNG 和 JPEG
   */
  private parseImageDimensions(buffer: Buffer): { width: number; height: number } {
    // 检查 PNG
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height };
    }

    // 检查 JPEG
    if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
      let offset = 2;
      while (offset < buffer.length) {
        while (offset < buffer.length && buffer[offset] === 0xFF) {
          offset++;
        }

        if (offset >= buffer.length) break;

        const marker = buffer[offset];
        offset++;

        if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
          const height = buffer.readUInt16BE(offset + 3);
          const width = buffer.readUInt16BE(offset + 5);
          return { width, height };
        }

        if (marker !== 0xD9 && marker !== 0xD8) {
          if (offset + 1 < buffer.length) {
            const length = buffer.readUInt16BE(offset);
            offset += length;
          }
        }
      }
    }

    // 默认尺寸
    return { width: 1920, height: 1080 };
  }

  /**
   * 下载视频到 Buffer
   */
  private async downloadVideo(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      this.logger.error("下载视频失败");
      this.logger.debug(`详细错误信息: status=${response.status}`);
      throw new Error("下载视频失败，请稍后重试");
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * 映射任务状态
   */
  private mapTaskStatus(
    status: AITaskStatusType,
  ): "pending" | "processing" | "completed" | "failed" {
    switch (status) {
      case AITaskStatus.PENDING:
        return "pending";
      case AITaskStatus.PROCESSING:
        return "processing";
      case AITaskStatus.COMPLETED:
        return "completed";
      case AITaskStatus.FAILED:
        return "failed";
      default:
        return "pending";
    }
  }

  /**
   * 脱敏错误信息
   * 如果错误信息包含外部 API 细节（如余额、额度、API 密钥等），返回通用提示
   */
  private sanitizeErrorMessage(error: string): string {
    // 已知的脱敏错误信息直接返回
    const safeErrors = [
      "视频生成失败",
      "主体检测失败",
      "下载视频失败，请稍后重试",
      "视频生成任务提交失败",
      "视频生成完成但获取结果失败",
    ];
    if (safeErrors.includes(error)) {
      return error;
    }

    // 包含敏感关键词的错误信息，返回通用提示
    const sensitivePatterns = [
      /balance/i,
      /余额/i,
      /quota/i,
      /额度/i,
      /insufficient/i,
      /不足/i,
      /credit/i,
      /api.?key/i,
      /secret/i,
      /token/i,
      /火山引擎/i,
      /volcengine/i,
      /omnihuman/i,
      /cv/i,
      /access.?key/i,
      /credential/i,
    ];

    for (const pattern of sensitivePatterns) {
      if (pattern.test(error)) {
        return "视频生成失败，请稍后重试";
      }
    }

    // 其他未知错误也返回通用提示（避免泄露任何潜在敏感信息）
    return "视频生成失败，请稍后重试";
  }

  // ========== 临时文件接口 ==========

  /**
   * 上传裁切后的图片
   * 用于对口型视频生成，前端裁切框选区域后上传
   */
  async uploadCroppedImage(
    userId: string,
    projectId: string,
    scriptId: string,
    shotGroupId: string,
    characterId: string,
    imageBuffer: Buffer,
  ): Promise<UploadCroppedImageResponse> {
    await this.checkProjectAccess(userId, projectId);

    // 验证 shotGroup 存在
    await this.getShotGroup(scriptId, shotGroupId);

    // 保存裁切图片到临时目录
    const key = await this.tempFileService.saveCroppedImage(
      imageBuffer,
      shotGroupId,
      characterId,
    );

    // 获取公网 URL
    const ngrokUrl = await this.ngrokService.getPublicUrl();
    if (!ngrokUrl) {
      throw new BadRequestException(
        "本地模式下需要启动 ngrok 才能使用对口型视频生成功能。\n" +
          "请在另一个终端运行: ngrok http 3000",
      );
    }

    const url = this.tempFileService.getTempFileUrl(key, ngrokUrl);

    return {
      shotGroupId,
      characterId,
      key,
      url,
    };
  }

  /**
   * 复制对话音频到临时目录
   * 用于对口型视频生成，确保火山引擎可访问
   */
  async copyDialogueAudioToTemp(
    userId: string,
    projectId: string,
    scriptId: string,
    shotGroupId: string,
    dto: CopyDialogueAudioDto,
  ): Promise<CopyDialogueAudioResponse> {
    await this.checkProjectAccess(userId, projectId);

    const { shotGroup } = await this.getShotGroup(scriptId, shotGroupId);

    // 查找对话
    const dialogues =
      (shotGroup.dialogues as Array<Record<string, unknown>>) || [];
    const dialogue = dialogues.find((d) => d.id === dto.dialogueId);
    if (!dialogue) {
      throw new NotFoundException(`对话不存在 (dialogueId: ${dto.dialogueId})`);
    }

    // 获取音频 key
    const audioUrl = dialogue.audioUrl as string;
    if (!audioUrl) {
      throw new BadRequestException("对话无音频，无法复制");
    }

    // 提取音频 key（可能是完整 URL 或相对路径）
    let audioKey: string;
    if (audioUrl.startsWith("http")) {
      // 从 URL 提取 key
      const match = audioUrl.match(/\/static\/(.+)$/);
      if (match) {
        audioKey = match[1];
      } else {
        throw new BadRequestException("音频 URL 格式不正确");
      }
    } else if (audioUrl.startsWith("/static/")) {
      audioKey = audioUrl.replace("/static/", "");
    } else {
      audioKey = audioUrl; // 已经是 key
    }

    // 复制到临时目录
    const key = await this.tempFileService.copyAudioToTemp(
      audioKey,
      dto.dialogueId,
    );

    // 获取公网 URL
    const ngrokUrl = await this.ngrokService.getPublicUrl();
    if (!ngrokUrl) {
      throw new BadRequestException(
        "本地模式下需要启动 ngrok 才能使用对口型视频生成功能。\n" +
          "请在另一个终端运行: ngrok http 3000",
      );
    }

    const url = this.tempFileService.getTempFileUrl(key, ngrokUrl);

    return {
      shotGroupId,
      dialogueId: dto.dialogueId,
      key,
      url,
    };
  }

  // ========== 分镜组图片上传/删除 ==========

  /**
   * 上传分镜组图片
   * 将图片保存到 OSS，并更新 script.content.shotGroups[].images 数组
   */
  async uploadShotGroupImage(
    userId: string,
    projectId: string,
    scriptId: string,
    shotGroupId: string,
    fileBuffer: Buffer,
    filename: string,
    mimeType: string,
    imageType?: string,
  ): Promise<{ id: string; url: string; thumbnailUrl?: string; type: string; createdAt: string }> {
    await this.checkProjectAccess(userId, projectId, "editor");

    const { script, content, shotGroup, shotGroupIndex } = await this.getShotGroup(
      scriptId,
      shotGroupId,
    );

    // 上传文件到 OSS
    const key = this.ossService.generateKey(
      FileCategory.IMAGE,
      filename || "upload.jpg",
      undefined,
      projectId,
    );
    const uploaded = await this.ossService.uploadFile(key, fileBuffer, {
      mime: mimeType || "image/jpeg",
    });

    if (!uploaded) {
      throw new BadRequestException("文件上传失败，请稍后重试");
    }

    const imageId = randomUUID();
    const now = new Date().toISOString();
    const resolvedType = ["main", "reference", "video_reference"].includes(imageType || "")
      ? imageType!
      : "reference";

    const newImage: {
      id: string;
      url: string;
      type: string;
      createdAt: string;
    } = {
      id: imageId,
      url: uploaded.url,
      type: resolvedType,
      createdAt: now,
    };

    // 更新 shotGroups 的 images 数组
    const shotGroups =
      (content.shotGroups as Array<Record<string, unknown>>) || [];
    const newShotGroups = [...shotGroups];
    const existingImages =
      (shotGroup.images as Array<Record<string, unknown>>) || [];

    // 如果是 main 类型，先移除已有的 main 图片（只保留一个主图）
    let filteredImages = existingImages;
    if (resolvedType === "main") {
      filteredImages = existingImages.filter(
        (img) => (img.type as string) !== "main",
      );
    }

    newShotGroups[shotGroupIndex] = {
      ...shotGroup,
      images: [...filteredImages, newImage],
      // main 类型同时更新 mainImageId 和 mainImageKey
      ...(resolvedType === "main"
        ? { mainImageId: imageId, mainImageKey: uploaded.url }
        : {}),
    };
    script.content = { ...content, shotGroups: newShotGroups };
    await this.scriptRepository.save(script);

    return {
      id: imageId,
      url: uploaded.url,
      type: resolvedType,
      createdAt: now,
    };
  }

  /**
   * 删除分镜组图片
   * 从 script.content.shotGroups[].images 数组中移除指定图片
   */
  async deleteShotGroupImage(
    userId: string,
    projectId: string,
    scriptId: string,
    shotGroupId: string,
    imageId: string,
  ): Promise<{ shotGroupId: string; imageId: string; deleted: boolean }> {
    await this.checkProjectAccess(userId, projectId, "editor");

    const { script, content, shotGroup, shotGroupIndex } = await this.getShotGroup(
      scriptId,
      shotGroupId,
    );

    const existingImages =
      (shotGroup.images as Array<{ id: string; type?: string; url?: string }>) || [];
    const imageToDelete = existingImages.find((img) => img.id === imageId);

    if (!imageToDelete) {
      throw new NotFoundException("图片不存在");
    }

    // 从 images 数组中移除
    const newImages = existingImages.filter((img) => img.id !== imageId);

    // 更新 shotGroup
    const shotGroups =
      (content.shotGroups as Array<Record<string, unknown>>) || [];
    const newShotGroups = [...shotGroups];
    const updates: Record<string, unknown> = {
      ...shotGroup,
      images: newImages,
    };

    // 如果删除的是 main 图片，同步清除 mainImageId 和 mainImageKey
    if (imageToDelete.type === "main") {
      updates.mainImageId = undefined;
      updates.mainImageKey = undefined;
    }

    newShotGroups[shotGroupIndex] = updates;
    script.content = { ...content, shotGroups: newShotGroups };
    await this.scriptRepository.save(script);

    return {
      shotGroupId,
      imageId,
      deleted: true,
    };
  }
}
