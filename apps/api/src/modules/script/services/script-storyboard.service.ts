import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
  UnprocessableEntityException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import {
  Repository,
  IsNull,
  In,
  OptimisticLockVersionMismatchError,
} from "typeorm";
import { Script, ScriptStatus } from "../entities/script.entity";
import { AITask, AITaskStatus, AITaskType } from "../entities/ai-task.entity";
import {
  Collaborator,
  CollaboratorRole,
} from "../../project/entities/collaborator.entity";
import { Project } from "../../project/entities/project.entity";
import { Character } from "../../character/entities/character.entity";
import {
  CharacterImage,
  CharacterImageType,
} from "../../character/entities/character-image.entity";
import { Scene } from "../../scene/entities/scene.entity";
import {
  SceneImage,
  SceneImageType,
} from "../../scene/entities/scene-image.entity";
import { Prop } from "../../prop/entities/prop.entity";
import {
  PropImage,
  PropImageType,
} from "../../prop/entities/prop-image.entity";
import {
  CreateStoryboardRefDto,
  UpdateStoryboardRefDto,
  ReorderStoryboardsDto,
  ContinueStoryboardsDto,
  GenerateStoryboardVideoDto,
  GenerateStoryboardDialogueDto,
  GenerateAllStoryboardsDto,
  StoryboardRefResponse,
  StoryboardListResponse,
  ContinueStoryboardsResponse,
  GenerateStoryboardVideoResponse,
  GenerateStoryboardDialogueResponse,
  GenerateAllStoryboardsResponse,
  DialogueDto,
  StoryboardImageInfo,
} from "../dto/script-storyboard.dto";
import { StoryboardMode } from "@pixaura/shared-types";
import { randomUUID } from "crypto";
import {
  buildStoryboardVideoPrompt,
  // 导入分镜对话生成提示词
  DIALOGUE_GENERATE_SYSTEM_PROMPT,
  buildDialogueGeneratePrompt,
} from "../../../prompts";
import { OpenAICompatibleProvider } from "../../ai/providers/openai-compatible.provider";
import { WebSocketService } from "../../websocket/websocket.service";
import { TaskType } from "../../ai/config/ai.config";
import { RedlockService } from "../../../common/services/redlock.service";
import { UrlTransformService } from "../../../common/services/url-transform.service";
import { NgrokService } from "../../../common/services/ngrok.service";
import { ConfigService } from "@nestjs/config";

/**
 * 剧本分镜服务
 * 处理剧本中分镜的CRUD和管理
 */
@Injectable()
export class ScriptStoryboardService {
  private readonly logger = new Logger(ScriptStoryboardService.name);

  constructor(
    @InjectRepository(Script)
    private readonly scriptRepository: Repository<Script>,
    @InjectRepository(AITask)
    private readonly aiTaskRepository: Repository<AITask>,
    @InjectRepository(Collaborator)
    private readonly collaboratorRepository: Repository<Collaborator>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Character)
    private readonly characterRepository: Repository<Character>,
    @InjectRepository(CharacterImage)
    private readonly characterImageRepository: Repository<CharacterImage>,
    @InjectRepository(Scene)
    private readonly sceneRepository: Repository<Scene>,
    @InjectRepository(SceneImage)
    private readonly sceneImageRepository: Repository<SceneImage>,
    @InjectRepository(Prop)
    private readonly propRepository: Repository<Prop>,
    @InjectRepository(PropImage)
    private readonly propImageRepository: Repository<PropImage>,
    @InjectQueue("script-ai-generate")
    private readonly scriptAIGenerateQueue: Queue,
    private readonly aiProvider: OpenAICompatibleProvider,
    private readonly webSocketService: WebSocketService,
    private readonly redlockService: RedlockService,
    private readonly urlTransformService: UrlTransformService,
    private readonly ngrokService: NgrokService,
    private readonly configService: ConfigService,
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

    if (
      requireRole === CollaboratorRole.OWNER &&
      userRole !== CollaboratorRole.OWNER
    ) {
      throw new ForbiddenException("需要所有者权限");
    }

    if (
      requireRole === CollaboratorRole.EDITOR &&
      userRole !== CollaboratorRole.OWNER &&
      userRole !== CollaboratorRole.EDITOR
    ) {
      throw new ForbiddenException("需要编辑权限");
    }

    return userRole;
  }

  /**
   * 检查剧本是否存在且可编辑
   */
  private async checkScriptEditable(
    scriptId: string,
    userId: string,
  ): Promise<Script> {
    const script = await this.scriptRepository.findOne({
      where: { id: scriptId, deletedAt: IsNull() },
    });

    if (!script) {
      throw new NotFoundException("剧本不存在");
    }

    await this.checkProjectAccess(
      userId,
      script.projectId,
      CollaboratorRole.EDITOR,
    );

    if (script.status === ScriptStatus.CONFIRMED) {
      throw new ConflictException("剧本已确认，无法编辑");
    }

    if (script.status === ScriptStatus.AI_GENERATING) {
      throw new ConflictException("剧本正在生成中，请稍后再试");
    }

    return script;
  }

  /**
   * 更新剧本的生成状态（已废弃，generationState 已移除）
   * @deprecated 前端通过 WebSocket 实时获取状态，无需持久化
   */
  private updateGenerationState(
    _script: Script,
    _step: string,
    _state: Record<string, unknown>,
  ): void {
    // 空操作 - generationState 已移除
  }

  // ==================== 分镜CRUD ====================

  /**
   * 获取分镜列表
   */
  async getStoryboards(
    userId: string,
    projectId: string,
    scriptId: string,
  ): Promise<StoryboardListResponse> {
    await this.checkProjectAccess(userId, projectId);

    const script = await this.scriptRepository.findOne({
      where: { id: scriptId, projectId, deletedAt: IsNull() },
    });

    if (!script) {
      throw new NotFoundException("剧本不存在");
    }

    const content = script.content as Record<string, unknown>;
    // 使用 shotGroups 替代 storyboards
    const shotGroups =
      (content.shotGroups as Array<Record<string, unknown>>) || [];

    // 按序号排序
    const sortedShotGroups = shotGroups.sort(
      (a, b) => (a.sequenceNumber as number) - (b.sequenceNumber as number),
    );

    return {
      items: sortedShotGroups.map((sg) => this.mapToStoryboardResponse(sg)),
      total: shotGroups.length,
    };
  }

  /**
   * 创建分镜
   * 使用分布式锁防止并发操作
   */
  async createStoryboard(
    userId: string,
    projectId: string,
    scriptId: string,
    dto: CreateStoryboardRefDto,
  ): Promise<StoryboardRefResponse> {
    const lockKey = `script:content:${scriptId}`;

    return this.redlockService.withLock(lockKey, 10000, async () => {
      const script = await this.checkScriptEditable(scriptId, userId);

      if (script.projectId !== projectId) {
        throw new NotFoundException("剧本不存在");
      }

      const content = script.content as Record<string, unknown>;
      // 使用 shotGroups 替代 storyboards
      const shotGroups =
        (content.shotGroups as Array<Record<string, unknown>>) || [];

      // 检查序号是否已存在
      const existingIndex = shotGroups.findIndex(
        (sg) => sg.sequenceNumber === dto.sequenceNumber,
      );

      if (existingIndex !== -1) {
        // 如果序号已存在，后续分镜组序号+1
        for (const sg of shotGroups) {
          if ((sg.sequenceNumber as number) >= dto.sequenceNumber) {
            sg.sequenceNumber = (sg.sequenceNumber as number) + 1;
          }
        }
      }

      // 创建新分镜组
      const newShotGroup: Record<string, unknown> = {
        id: randomUUID(),
        sequenceNumber: dto.sequenceNumber,
        title: dto.title,
        description: dto.description,
        characterIds: dto.characterIds || [],
        sceneId: dto.sceneId,
        propIds: dto.propIds || [],
        dialogues: dto.dialogues || [],
        shots: [], // 初始化空 shots 数组
        characterRegions: {}, // 初始化空角色框选配置
        referenceMode: "multi_reference",
        // 分镜独立模型选择
        imageModelId: dto.imageModelId,
        videoModelId: dto.videoModelId,
        lipSyncModelId: dto.lipSyncModelId,
        detectionStatus: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      shotGroups.push(newShotGroup);

      // 重新排序
      shotGroups.sort(
        (a, b) => (a.sequenceNumber as number) - (b.sequenceNumber as number),
      );

      content.shotGroups = shotGroups;
      script.content = content;

      // 更新分镜生成状态
      this.updateGenerationState(script, "storyboards", {
        status: "completed",
        totalCount: shotGroups.length,
      });

      try {
        await this.scriptRepository.save(script);
      } catch (error) {
        if (error instanceof OptimisticLockVersionMismatchError) {
          throw new ConflictException("分镜创建冲突，请刷新后重试");
        }
        throw error;
      }

      return this.mapToStoryboardResponse(newShotGroup);
    });
  }

  /**
   * 更新分镜
   * 使用分布式锁防止并发覆盖
   */
  async updateStoryboard(
    userId: string,
    projectId: string,
    scriptId: string,
    storyboardId: string,
    dto: UpdateStoryboardRefDto,
  ): Promise<StoryboardRefResponse> {
    const lockKey = `script:content:${scriptId}`;

    return this.redlockService.withLock(lockKey, 10000, async () => {
      const script = await this.checkScriptEditable(scriptId, userId);

      if (script.projectId !== projectId) {
        throw new NotFoundException("剧本不存在");
      }

      const content = script.content as Record<string, unknown>;
      // 使用 shotGroups 替代 storyboards
      const shotGroups =
        (content.shotGroups as Array<Record<string, unknown>>) || [];

      // 查找分镜组
      const shotGroupIndex = shotGroups.findIndex(
        (sg) => sg.id === storyboardId,
      );
      if (shotGroupIndex === -1) {
        throw new NotFoundException("分镜不存在");
      }

      const shotGroup = shotGroups[shotGroupIndex];

      // 更新字段
      if (dto.title !== undefined) shotGroup.title = dto.title;
      if (dto.description !== undefined)
        shotGroup.description = dto.description;
      if (dto.characterIds !== undefined)
        shotGroup.characterIds = dto.characterIds;
      if (dto.sceneId !== undefined) shotGroup.sceneId = dto.sceneId;
      if (dto.propIds !== undefined) shotGroup.propIds = dto.propIds;
      if (dto.dialogues !== undefined) {
        shotGroup.dialogues = dto.dialogues;

        // Bug-2 修复：同步更新 shots 数组，确保每个 dialogue 都有对应的 shot
        // 仅在 lip_sync 模式下创建 shots（简化版）
        const videoMode = (shotGroup.videoMode as string) || "video_only";
        const existingShots = (shotGroup.shots as Array<Record<string, unknown>>) || [];
        const newDialogues = dto.dialogues;

        if (videoMode === "lip_sync") {
          // lip_sync 模式：为每个对话创建/保留 shot
          const newShots: Array<Record<string, unknown>> = [];

          for (const dialogue of newDialogues) {
            // 尝试找到对应的现有 shot
            const existingShot = existingShots.find(
              (s) => s.dialogueId === dialogue.id,
            );

            if (existingShot) {
              // 保留现有 shot 的状态
              newShots.push(existingShot);
            } else {
              // 为新的 dialogue 创建 shot（简化版）
              newShots.push({
                id: randomUUID(),
                dialogueId: dialogue.id,
                status: "pending",
              });
            }
          }

          shotGroup.shots = newShots;
        } else {
          // video_only / audio_reference 模式：shots 为空，视频在 shotGroup.video
          shotGroup.shots = [];
        }
      }
      // 注意：voiceover、shotType、cameraAngle、cameraMovement、duration 在 ShotGroup 中已移至 shots
      // 这里保持兼容性，但主要数据存储在 shots 中
      if (dto.mode !== undefined) shotGroup.mode = dto.mode;
      // 分镜独立模型选择
      if (dto.imageModelId !== undefined)
        shotGroup.imageModelId = dto.imageModelId;
      if (dto.videoModelId !== undefined)
        shotGroup.videoModelId = dto.videoModelId;
      if (dto.lipSyncModelId !== undefined)
        shotGroup.lipSyncModelId = dto.lipSyncModelId;

      shotGroup.updatedAt = new Date().toISOString();

      content.shotGroups = shotGroups;
      script.content = content;

      try {
        await this.scriptRepository.save(script);
      } catch (error) {
        if (error instanceof OptimisticLockVersionMismatchError) {
          throw new ConflictException("分镜已被其他操作修改，请刷新后重试");
        }
        throw error;
      }

      return this.mapToStoryboardResponse(shotGroup);
    });
  }

  /**
   * 删除分镜
   * 使用分布式锁防止并发操作
   */
  async deleteStoryboard(
    userId: string,
    projectId: string,
    scriptId: string,
    storyboardId: string,
  ): Promise<{ success: boolean }> {
    const lockKey = `script:content:${scriptId}`;

    return this.redlockService.withLock(lockKey, 10000, async () => {
      const script = await this.checkScriptEditable(scriptId, userId);

      if (script.projectId !== projectId) {
        throw new NotFoundException("剧本不存在");
      }

      const content = script.content as Record<string, unknown>;
      // 使用 shotGroups 替代 storyboards
      const shotGroups =
        (content.shotGroups as Array<Record<string, unknown>>) || [];

      // 查找分镜组
      const shotGroupIndex = shotGroups.findIndex(
        (sg) => sg.id === storyboardId,
      );
      if (shotGroupIndex === -1) {
        throw new NotFoundException("分镜不存在");
      }

      const deletedSequenceNumber = shotGroups[shotGroupIndex]
        .sequenceNumber as number;

      // 删除分镜组
      shotGroups.splice(shotGroupIndex, 1);

      // 后续分镜组序号-1
      for (const sg of shotGroups) {
        if ((sg.sequenceNumber as number) > deletedSequenceNumber) {
          sg.sequenceNumber = (sg.sequenceNumber as number) - 1;
        }
      }

      content.shotGroups = shotGroups;
      script.content = content;

      // 更新分镜生成状态
      this.updateGenerationState(script, "storyboards", {
        totalCount: shotGroups.length,
      });

      try {
        await this.scriptRepository.save(script);
      } catch (error) {
        if (error instanceof OptimisticLockVersionMismatchError) {
          throw new ConflictException("分镜删除冲突，请刷新后重试");
        }
        throw error;
      }

      return { success: true };
    });
  }

  /**
   * 重新排序分镜
   * 使用分布式锁防止并发操作
   */
  async reorderStoryboards(
    userId: string,
    projectId: string,
    scriptId: string,
    dto: ReorderStoryboardsDto,
  ): Promise<{ success: boolean }> {
    const lockKey = `script:content:${scriptId}`;

    return this.redlockService.withLock(lockKey, 10000, async () => {
      const script = await this.checkScriptEditable(scriptId, userId);

      if (script.projectId !== projectId) {
        throw new NotFoundException("剧本不存在");
      }

      const content = script.content as Record<string, unknown>;
      // 使用 shotGroups 替代 storyboards
      const shotGroups =
        (content.shotGroups as Array<Record<string, unknown>>) || [];

      // 验证所有ID是否有效
      const shotGroupIds = shotGroups.map((sg) => sg.id as string);
      const allIdsValid = dto.orderedIds.every((id) =>
        shotGroupIds.includes(id),
      );

      if (!allIdsValid) {
        throw new BadRequestException("部分分镜ID无效");
      }

      if (dto.orderedIds.length !== shotGroups.length) {
        throw new BadRequestException("分镜ID列表数量不匹配");
      }

      // 按新顺序更新序号
      for (let i = 0; i < dto.orderedIds.length; i++) {
        const sg = shotGroups.find((s) => s.id === dto.orderedIds[i]);
        if (sg) {
          sg.sequenceNumber = i + 1;
          sg.updatedAt = new Date().toISOString();
        }
      }

      // 重新排序
      shotGroups.sort(
        (a, b) => (a.sequenceNumber as number) - (b.sequenceNumber as number),
      );

      content.shotGroups = shotGroups;
      script.content = content;

      try {
        await this.scriptRepository.save(script);
      } catch (error) {
        if (error instanceof OptimisticLockVersionMismatchError) {
          throw new ConflictException("分镜排序冲突，请刷新后重试");
        }
        throw error;
      }

      return { success: true };
    });
  }

  /**
   * 续写分镜
   */
  async continueStoryboards(
    userId: string,
    projectId: string,
    scriptId: string,
    dto: ContinueStoryboardsDto,
  ): Promise<ContinueStoryboardsResponse> {
    const script = await this.checkScriptEditable(scriptId, userId);

    if (script.projectId !== projectId) {
      throw new NotFoundException("剧本不存在");
    }

    const content = script.content as Record<string, unknown>;
    // 使用 shotGroups 替代 storyboards
    const shotGroups =
      (content.shotGroups as Array<Record<string, unknown>>) || [];

    // 验证afterStoryboardId是否存在
    const afterShotGroup = shotGroups.find(
      (sg) => sg.id === dto.afterStoryboardId,
    );
    if (!afterShotGroup) {
      throw new NotFoundException("参考分镜不存在");
    }

    // 检查是否有进行中的任务
    const existingTask = await this.aiTaskRepository.findOne({
      where: {
        scriptId,
        type: AITaskType.CONTINUE,
        status: AITaskStatus.PROCESSING,
      },
    });

    if (existingTask) {
      throw new ConflictException("已有进行中的续写任务");
    }

    // 更新生成状态
    this.updateGenerationState(script, "storyboards", {
      status: "processing",
      modelId: dto.modelId,
    });
    await this.scriptRepository.save(script);

    // 创建AI续写任务
    const task = this.aiTaskRepository.create({
      scriptId,
      type: AITaskType.CONTINUE,
      status: AITaskStatus.PENDING,
      config: {
        afterStoryboardId: dto.afterStoryboardId,
        afterSequenceNumber: afterShotGroup.sequenceNumber,
        count: dto.count,
        modelId: dto.modelId,
        scriptDescription: script.description,
        existingShotGroups: shotGroups.length,
      },
      createdBy: userId,
    });

    const savedTask = await this.aiTaskRepository.save(task);

    // 更新当前任务ID
    this.updateGenerationState(script, "storyboards", {
      currentTaskId: savedTask.id,
    });
    await this.scriptRepository.save(script);

    return {
      taskId: savedTask.id,
      status: "pending",
      estimatedTime: 45,
      count: dto.count,
    };
  }

  // ==================== 分镜 AI 生成 ====================

  /**
   * 生成分镜视频（异步队列任务）
   * 将任务放入 script-ai-generate 队列，由 worker 调用 wan2.6 模型生成
   */
  async generateStoryboardVideo(
    userId: string,
    projectId: string,
    scriptId: string,
    dto: GenerateStoryboardVideoDto,
  ): Promise<GenerateStoryboardVideoResponse> {
    const script = await this.checkScriptEditable(scriptId, userId);

    if (script.projectId !== projectId) {
      throw new NotFoundException("剧本不存在");
    }

    const content = script.content as Record<string, unknown>;
    // 使用 shotGroups 替代 storyboards
    const shotGroups =
      (content.shotGroups as Array<Record<string, unknown>>) || [];
    const shotGroup = shotGroups.find((sg) => sg.id === dto.storyboardId);

    if (!shotGroup) {
      throw new UnprocessableEntityException("分镜不存在");
    }

    const description = (shotGroup.description as string | undefined)?.trim();
    if (!description) {
      throw new UnprocessableEntityException("分镜描述为空，无法生成提示词");
    }

    // 判断参考模式（默认多参考生视频）
    const referenceMode =
      (shotGroup.referenceMode as string | undefined) || "multi_reference";
    const isSingleReference = referenceMode === "single_reference";

    // 分镜图生视频模式下，必须已生成分镜主图
    let mainImageUrl: string | undefined;
    if (isSingleReference) {
      let rawKey = shotGroup.mainImageKey as string | undefined;
      // Bug #1 修复：若 mainImageKey 不存在，从 images 数组中获取 type=main 的图片 URL
      if (!rawKey) {
        const images = (shotGroup.images as Array<{ type?: string; url?: string }>) || [];
        const mainImage = images.find((img) => img.type === "main");
        rawKey = mainImage?.url;
      }
      if (!rawKey) {
        throw new UnprocessableEntityException({
          code: 1360,
          message: "分镜图生视频模式下，请先生成分镜图再生成视频",
        });
      }
      // Bug 修复：正确处理 mainImageKey 格式
      // - 完整 URL（http 开头）：直接使用
      // - /static/ 格式：直接使用
      // - 纯 key（其他）：拼接 /static/
      mainImageUrl = rawKey.startsWith("http") || rawKey.startsWith("/static/")
        ? rawKey
        : `/static/${rawKey}`;
    }

    // 从 shotGroup 获取出镜资产的数据库 ID
    // 注意：shotGroup.characterIds/sceneId/propIds 已经是数据库资产 ID，不需要转换
    const dbCharacterIds = (shotGroup.characterIds as string[]) || [];
    const dbSceneId = shotGroup.sceneId as string | undefined;
    const dbPropIds = (shotGroup.propIds as string[]) || [];

    this.logger.log(
      `视频生成资产ID: 角色=${dbCharacterIds.length}个, 场景=${dbSceneId ?? "无"}, 道具=${dbPropIds.length}个`,
    );

    // 从数据库查询资产及其图片（多参考模式才需要）
    let allCharacters: Array<{
      id: string;
      name: string;
      mainImageId?: string;
      images: Array<{ id: string; url: string; type: string }>;
    }> = [];
    let allScenes: Array<{
      id: string;
      name: string;
      mainImageId?: string;
      images: Array<{ id: string; url: string; type: string }>;
    }> = [];
    let allProps: Array<{
      id: string;
      name: string;
      mainImageId?: string;
      images: Array<{ id: string; url: string; type: string }>;
    }> = [];

    if (!isSingleReference) {
      // 多参考模式：从数据库查询资产及其图片
      if (dbCharacterIds.length > 0) {
        const characters = await this.characterRepository.find({
          where: { id: In(dbCharacterIds) },
          select: ["id", "name"],
        });
        const images = await this.characterImageRepository.find({
          where: { characterId: In(dbCharacterIds), isCurrent: true },
          select: ["id", "characterId", "url", "type"],
        });
        // 组装数据（不依赖 mainImageId，由 buildStoryboardVideoPrompt 的 getMainImageUrl 函数处理）
        allCharacters = characters.map((char) => ({
          id: char.id,
          name: char.name,
          images: images
            .filter((img) => img.characterId === char.id)
            .map((img) => ({
              id: img.id,
              url: img.url,
              type: img.type,
            })),
        }));
      }

      if (dbSceneId) {
        const scene = await this.sceneRepository.findOne({
          where: { id: dbSceneId },
          select: ["id", "name"],
        });
        if (scene) {
          const images = await this.sceneImageRepository.find({
            where: { sceneId: dbSceneId, isCurrent: true },
            select: ["id", "url", "type"],
          });
          allScenes = [
            {
              id: scene.id,
              name: scene.name,
              images: images.map((img) => ({
                id: img.id,
                url: img.url,
                type: img.type,
              })),
            },
          ];
        }
      }

      if (dbPropIds.length > 0) {
        const props = await this.propRepository.find({
          where: { id: In(dbPropIds) },
          select: ["id", "name"],
        });
        const images = await this.propImageRepository.find({
          where: { propId: In(dbPropIds), isCurrent: true },
          select: ["id", "propId", "url", "type"],
        });
        allProps = props.map((prop) => ({
          id: prop.id,
          name: prop.name,
          images: images
            .filter((img) => img.propId === prop.id)
            .map((img) => ({
              id: img.id,
              url: img.url,
              type: img.type,
            })),
        }));
      }

      this.logger.log(
        `视频生成数据库资产查询: 角色=${allCharacters.length}个(共${allCharacters.reduce((sum, c) => sum + c.images.length, 0)}张图), 场景=${allScenes.length}个, 道具=${allProps.length}个`,
      );
    }

    // ── 音频参考模式处理 ─────────────────────────────────────────────────────
    const videoMode = shotGroup.videoMode as string | undefined;
    const isAudioRefMode = videoMode === "audio_reference";
    let accessibleAudioUrls: string[] = [];

    if (isAudioRefMode) {
      const dialogues = (shotGroup.dialogues as Array<Record<string, unknown>>) || [];
      // 收集所有音频（包括旁白）
      const allDialogues = dialogues;

      this.logger.log(
        `音频参考模式：收集 ${allDialogues.length} 个音频（含旁白）`,
      );

      // 收集并转换音频 URL
      for (const dialogue of allDialogues) {
        const audioUrl = dialogue.audioUrl as string;
        if (audioUrl) {
          // OSS 模式：使用签名 URL；本地模式：使用 ngrok
          try {
            const accessibleUrl = await this.urlTransformService.getAccessibleUrl(
              audioUrl,
              { allowBase64: false }, // 音频不支持 base64
            );
            accessibleAudioUrls.push(accessibleUrl);
          } catch (error) {
            this.logger.warn(`音频 URL 转换失败: ${audioUrl}, error: ${error}`);
            // 本地模式下检查 ngrok 是否可用
            const storageType = this.configService.get<string>("storage.type");
            if (storageType === "local") {
              const ngrokUrl = await this.ngrokService.getPublicUrl();
              if (!ngrokUrl) {
                throw new BadRequestException(
                  "本地模式需要启动 ngrok 才能使用音频参考功能。\n" +
                  "请在另一个终端运行: ngrok http 3000",
                );
              }
              // 使用 ngrok URL 重新构建音频 URL
              const audioKey = audioUrl.replace("/static/", "");
              accessibleAudioUrls.push(`${ngrokUrl}/static/${audioKey}`);
            }
          }
        }
      }

      this.logger.log(
        `音频参考模式：成功转换 ${accessibleAudioUrls.length} 个音频 URL`,
      );
    }

    // 使用结构化提示词构建器组装 prompt 和 imageUrls
    // 后端从数据库自动构建 imageUrls，不使用前端传入的
    // 注意：需要将剧本内引用 ID 转换为数据库资产 ID，以便与查询的数据匹配
    const built = buildStoryboardVideoPrompt(
      {
        ...shotGroup,
        // 将剧本内引用 ID 转换为数据库资产 ID
        characterIds: dbCharacterIds,
        sceneId: dbSceneId,
        propIds: dbPropIds,
        mainImageUrl,
        referenceMode,
      } as unknown as Parameters<typeof buildStoryboardVideoPrompt>[0],
      allCharacters as unknown as Parameters<
        typeof buildStoryboardVideoPrompt
      >[1],
      allScenes as unknown as Parameters<typeof buildStoryboardVideoPrompt>[2],
      allProps as unknown as Parameters<typeof buildStoryboardVideoPrompt>[3],
      { isAudioRefMode, accessibleAudioUrls },
    );
    const prompt = built.prompt;

    // 多图参考模式（multi_reference）：使用构建器从资产主图中生成
    const imageUrls = built.imageUrls.length > 0 ? built.imageUrls : undefined;
    // 音频参考模式：音频 URL 数组
    const audioUrls = built.audioUrls;

    // 从 shotGroup 获取时长（秒），优先使用顶层 duration，再 fallback 到 shots[0].duration
    // ShotGroup.duration 是前端时长选择器设置的值，shots[0].duration 是兼容旧数据
    const shotGroupDuration = shotGroup.duration as number | undefined;
    const shots = (shotGroup.shots as Array<Record<string, unknown>>) || [];
    const shotDuration = shots[0]?.duration as number | undefined;
    const duration = shotGroupDuration ?? shotDuration ?? 3;
    this.logger.log(
      `视频生成时长: shotGroup.duration=${shotGroupDuration ?? "无"}, shots[0].duration=${shotDuration ?? "无"}, 最终=${duration}`,
    );
    const settings = content.settings as Record<string, unknown> | undefined;
    const aspectRatio = (settings?.resolution as string | undefined) || "9:16";

    // 创建 AI 任务记录
    const task = this.aiTaskRepository.create({
      scriptId,
      type: AITaskType.GENERATE,
      status: AITaskStatus.PENDING,
      config: {
        assetType: "video",
        storyboardId: dto.storyboardId,
        scriptId,
        modelId: dto.modelId || "wan2.6",
        prompt,
        imageUrls,
        audioUrls,
        duration,
        aspectRatio,
      },
      createdBy: userId,
    });

    const savedTask = await this.aiTaskRepository.save(task);

    // 预先存储订阅关系，确保 Worker 推送消息时前端已订阅
    await this.webSocketService.subscribeToTask(userId, savedTask.id);

    // 将任务加入队列
    await this.scriptAIGenerateQueue.add(
      savedTask.id,
      {
        taskId: savedTask.id,
        type: TaskType.GENERATE,
        requestData: {
          assetType: "video",
          storyboardId: dto.storyboardId,
          scriptId,
          modelId: dto.modelId || "wan2.6",
          prompt,
          imageUrls,
          audioUrls,
          referenceMode, // 传递参考模式，Worker 根据模式决定是否传递 aspectRatio
          duration,
          aspectRatio,
        },
        modelId: dto.modelId || "wan2.6",
      },
      {
        jobId: savedTask.id,
        priority: 20,
      },
    );

    // 更新分镜组的 video 状态为 pending（新结构）
    const sgIdx = shotGroups.findIndex((sg) => sg.id === dto.storyboardId);
    if (sgIdx !== -1) {
      // video_only / audio_reference：更新 shotGroup.video
      shotGroups[sgIdx].video = {
        status: "pending",
        taskId: savedTask.id,
      };
      content.shotGroups = shotGroups;
      script.content = content;
      await this.scriptRepository.save(script);
    }

    // 发送 WebSocket 通知
    await this.webSocketService.broadcastTaskProgress(savedTask.id, {
      type: "asset:video-progress",
      taskId: savedTask.id,
      scriptId,
      storyboardId: dto.storyboardId,
      status: "pending",
      progress: 0,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(
      `分镜视频生成任务已创建: taskId=${savedTask.id}, storyboardId=${dto.storyboardId}`,
    );

    return {
      taskId: savedTask.id,
      storyboardId: dto.storyboardId,
      status: "pending",
      estimatedTime: 120,
    };
  }

  /**
   * AI 生成分镜对话台词（同步，直接调用文本生成模型）
   * 根据分镜描述，用 AI 生成 1-3 句人物对话
   * 使用分布式锁防止并发写入
   */
  async generateStoryboardDialogue(
    userId: string,
    projectId: string,
    scriptId: string,
    dto: GenerateStoryboardDialogueDto,
  ): Promise<GenerateStoryboardDialogueResponse> {
    const script = await this.checkScriptEditable(scriptId, userId);

    if (script.projectId !== projectId) {
      throw new NotFoundException("剧本不存在");
    }

    const content = script.content as Record<string, unknown>;
    // 使用 shotGroups 替代 storyboards
    const shotGroups =
      (content.shotGroups as Array<Record<string, unknown>>) || [];
    const shotGroup = shotGroups.find((sg) => sg.id === dto.storyboardId);

    if (!shotGroup) {
      throw new UnprocessableEntityException("分镜不存在");
    }

    const description = (shotGroup.description as string | undefined)?.trim();
    if (!description) {
      throw new UnprocessableEntityException("分镜描述为空，无法生成对话");
    }

    // 构建提示词：让模型根据分镜描述生成对话
    const characters =
      (content.characters as Array<Record<string, unknown>>) || [];
    const characterIds = (shotGroup.characterIds as string[]) || [];
    const involvedChars = characters.filter((c) =>
      characterIds.includes(c.id as string),
    );
    const charNames =
      involvedChars.map((c) => c.name as string).join("、") || "角色";

    // 使用集中管理的提示词函数构建用户提示词
    const prompt = buildDialogueGeneratePrompt(description, charNames);

    this.logger.log(
      `生成分镜对话: storyboardId=${dto.storyboardId}, modelId=${dto.modelId || "qwen2.5-72b"}`,
    );

    const result = await this.aiProvider.generateText(
      {
        prompt,
        systemPrompt: DIALOGUE_GENERATE_SYSTEM_PROMPT,
        temperature: 0.8,
        maxTokens: 300,
      },
      dto.modelId || "qwen2.5-72b",
      undefined,
    );

    // 解析生成的对话文本，提取 【角色名】台词 格式
    const lines = result.text
      .trim()
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const dialogues: DialogueDto[] = lines.map((line) => {
      const match = line.match(/^[【\[](.*?)[】\]]\s*(.+)$/);
      if (match) {
        const charName = match[1].trim();
        const text = match[2].trim();
        // 尝试从已有角色列表中找到对应 ID
        const char = involvedChars.find((c) => (c.name as string) === charName);
        return {
          id: randomUUID(),
          characterId: char ? (char.id as string) : undefined,
          characterName: charName,
          text,
          emotion: undefined,
          isVoiceover: false,
        };
      }
      // 无法解析格式时，统一归为旁白
      return {
        id: randomUUID(),
        characterName: charNames.split("、")[0] || "角色",
        text: line,
        emotion: undefined,
        isVoiceover: false,
      };
    });

    // 使用分布式锁保存生成的对话
    const lockKey = `script:content:${scriptId}`;
    return this.redlockService.withLock(lockKey, 10000, async () => {
      // 重新获取最新数据
      const freshScript = await this.scriptRepository.findOne({
        where: { id: scriptId },
      });
      if (!freshScript) {
        throw new NotFoundException("剧本不存在");
      }

      const freshContent = freshScript.content as Record<string, unknown>;
      // 使用 shotGroups 替代 storyboards
      const freshShotGroups =
        (freshContent.shotGroups as Array<Record<string, unknown>>) || [];

      // 将生成的对话写入分镜组
      const sgIdx = freshShotGroups.findIndex(
        (sg) => sg.id === dto.storyboardId,
      );
      if (sgIdx !== -1) {
        freshShotGroups[sgIdx].dialogues = dialogues;
        freshShotGroups[sgIdx].updatedAt = new Date().toISOString();
        freshContent.shotGroups = freshShotGroups;
        freshScript.content = freshContent;

        try {
          await this.scriptRepository.save(freshScript);
        } catch (error) {
          if (error instanceof OptimisticLockVersionMismatchError) {
            throw new ConflictException("对话保存冲突，请刷新后重试");
          }
          throw error;
        }
      }

      return {
        storyboardId: dto.storyboardId,
        dialogues,
      };
    });
  }

  /**
   * 一键 AI 生成所有分镜（异步队列任务）
   * 遍历剧本所有场景，逐一调用 AI 生成分镜，通过 WebSocket 推送进度
   */
  async generateAllStoryboards(
    userId: string,
    projectId: string,
    scriptId: string,
    dto: GenerateAllStoryboardsDto,
  ): Promise<GenerateAllStoryboardsResponse> {
    const script = await this.checkScriptEditable(scriptId, userId);

    if (script.projectId !== projectId) {
      throw new NotFoundException("剧本不存在");
    }

    // 创建 AI 任务记录
    const task = this.aiTaskRepository.create({
      scriptId,
      type: AITaskType.GENERATE,
      status: AITaskStatus.PENDING,
      config: {
        assetType: "storyboard-all",
        scriptId,
        modelId: dto.modelId,
      },
      createdBy: userId,
    });

    const savedTask = await this.aiTaskRepository.save(task);

    // 预先存储订阅关系，确保 Worker 推送消息时前端已订阅
    await this.webSocketService.subscribeToTask(userId, savedTask.id);

    // 将任务加入队列（优先级 10）
    await this.scriptAIGenerateQueue.add(
      savedTask.id,
      {
        taskId: savedTask.id,
        type: TaskType.GENERATE,
        requestData: {
          assetType: "storyboard-all",
          scriptId,
          modelId: dto.modelId,
        },
      },
      {
        jobId: savedTask.id,
        priority: 10,
      },
    );

    // 更新分镜生成状态为处理中
    this.updateGenerationState(script, "storyboards", {
      status: "processing",
      currentTaskId: savedTask.id,
      modelId: dto.modelId,
    });
    await this.scriptRepository.save(script);

    // 推送初始 pending 状态
    await this.webSocketService.broadcastTaskProgress(savedTask.id, {
      type: "storyboard:generate-progress",
      taskId: savedTask.id,
      scriptId,
      status: "pending",
      progress: 0,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(
      `一键分镜生成任务已创建: taskId=${savedTask.id}, scriptId=${scriptId}`,
    );

    return {
      taskId: savedTask.id,
      status: "pending",
      estimatedTime: 180,
    };
  }

  // ==================== 辅助方法 ====================

  /**
   * 映射分镜组到响应格式
   */
  private mapToStoryboardResponse(
    shotGroup: Record<string, unknown>,
  ): StoryboardRefResponse {
    // 获取 shots 列表，用于兼容响应格式
    const shots = (shotGroup.shots as Array<Record<string, unknown>>) || [];
    const firstShot = shots[0] || {};

    // 构建 images 数组（从 mainImageId 和 mainImageKey）
    const referenceImages: Array<{
      id: string;
      url: string;
      thumbnailUrl?: string;
      type: "main" | "angle" | "reference";
      createdAt: string;
    }> = [];
    if (shotGroup.mainImageId && shotGroup.mainImageKey) {
      // Bug 修复：mainImageKey 是纯 key，需要构建完整 URL
      const rawKey = shotGroup.mainImageKey as string;
      const imageUrl = rawKey.startsWith("http") || rawKey.startsWith("/static/")
        ? rawKey
        : `/static/${rawKey}`;
      referenceImages.push({
        id: shotGroup.mainImageId as string,
        url: imageUrl,
        type: "main",
        createdAt: (shotGroup.createdAt as string) || new Date().toISOString(),
      });
    }

    return {
      id: shotGroup.id as string,
      sequenceNumber: shotGroup.sequenceNumber as number,
      title: shotGroup.title as string | undefined,
      description: shotGroup.description as string,
      characterIds: (shotGroup.characterIds as string[]) || [],
      sceneId: shotGroup.sceneId as string | undefined,
      propIds: (shotGroup.propIds as string[]) || [],
      dialogues: (shotGroup.dialogues as DialogueDto[]) || [],
      // 从第一个 shot 获取视频相关信息，保持兼容性
      voiceover: undefined, // ShotGroup 中不再有此字段
      shotType: undefined,
      cameraAngle: undefined,
      cameraMovement: undefined,
      duration: (firstShot.duration as number) || 3,
      referenceImages: referenceImages as StoryboardImageInfo[],
      videoGeneration: firstShot.videoUrl
        ? {
            prompt: "",
            status: (firstShot.status as
              | "pending"
              | "processing"
              | "completed"
              | "failed") || "pending",
            videoUrl: firstShot.videoUrl as string | undefined,
            taskId: firstShot.taskId as string | undefined,
          }
        : undefined,
      mode: (shotGroup.mode as StoryboardMode) || "standard",
      // 分镜独立模型选择
      imageModelId: shotGroup.imageModelId as string | undefined,
      videoModelId: shotGroup.videoModelId as string | undefined,
      lipSyncModelId: shotGroup.lipSyncModelId as string | undefined,
      createdAt: shotGroup.createdAt as string,
      updatedAt: shotGroup.updatedAt as string,
    };
  }
}
