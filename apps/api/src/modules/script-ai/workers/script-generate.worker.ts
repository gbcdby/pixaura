import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { randomUUID } from "crypto";
import { AITask, AITaskStatus } from "../../script/entities/ai-task.entity";
import { Script, ScriptStatus } from "../../script/entities/script.entity";
import { OpenAICompatibleProvider } from "../../ai/providers/openai-compatible.provider";
import { WebSocketService } from "../../websocket/websocket.service";
import { OssService } from "../../../common/oss/oss.service";
import { UrlTransformService } from "../../../common/services/url-transform.service";
import { RedlockService } from "../../../common/services/redlock.service";
import {
  SCRIPT_GENERATE_SYSTEM_PROMPT,
  buildScriptGenerateUserPrompt,
  STORYBOARD_GENERATE_SYSTEM_PROMPT,
  buildStoryboardGenerateUserPrompt,
} from "../../../prompts";
import { calculateAICost } from "../../../common/utils/ai-cost.util";
import { TaskType, ErrorCode } from "../../ai/config/ai.config";
import { FileCategory, WsEventNames } from "@pixaura/shared-types";
import { CharacterImage } from "../../character/entities/character-image.entity";
import { SceneImage } from "../../scene/entities/scene-image.entity";
import { PropImage } from "../../prop/entities/prop-image.entity";
import { TextGenQuotaService } from "../../billing/services/text-gen-quota.service";

/**
 * 剧本生成 Worker
 * 处理从创意想法生成完整剧本的 AI 任务
 */
@Processor("script-ai-generate", {
  concurrency: 3,
  limiter: {
    max: 10, // 最多10个任务
    duration: 60000, // 在1分钟内
  },
  lockDuration: 300000, // 任务锁定5分钟，防止被其他worker抢占
  stalledInterval: 60000, // 每分钟检查一次stalled任务
  maxStalledCount: 3, // 最多允许3次stalled后重试
})
export class ScriptGenerateWorker extends WorkerHost {
  private readonly logger = new Logger(ScriptGenerateWorker.name);

  constructor(
    @InjectRepository(AITask)
    private readonly aiTaskRepository: Repository<AITask>,
    @InjectRepository(Script)
    private readonly scriptRepository: Repository<Script>,
    @InjectRepository(CharacterImage)
    private readonly characterImageRepository: Repository<CharacterImage>,
    @InjectRepository(SceneImage)
    private readonly sceneImageRepository: Repository<SceneImage>,
    @InjectRepository(PropImage)
    private readonly propImageRepository: Repository<PropImage>,
    private readonly aiProvider: OpenAICompatibleProvider,
    private readonly webSocketService: WebSocketService,
    private readonly ossService: OssService,
    private readonly urlTransformService: UrlTransformService,
    private readonly redlockService: RedlockService,
    private readonly textGenQuotaService: TextGenQuotaService,
  ) {
    super();
  }

  /**
   * 下载外部图片并转存到 OSS，返回 OSS URL
   * 若 OSS 未配置或上传失败，降级返回原 URL
   */
  /**
   * 将外部图片 URL 转存到 OSS
   * 返回 OSS key（不带 /static/ 前缀），用于存储到 mainImageKey 等字段
   */
  private async saveImageToOss(
    externalUrl: string,
    projectId?: string,
    scriptId?: string,
  ): Promise<string> {
    if (!this.ossService.isConfigured()) {
      this.logger.warn("OSS 未配置，图片直接使用外部 URL");
      // 返回完整 URL，本地模式下 mainImageKey 存储完整 URL
      return externalUrl;
    }
    try {
      const response = await fetch(externalUrl);
      if (!response.ok) {
        this.logger.error("下载图片失败");
        this.logger.debug(`详细错误信息: status=${response.status}`);
        throw new Error("下载图片失败，请稍后重试");
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      // 从 Content-Type 推断扩展名，默认 jpg
      const contentType = response.headers.get("content-type") || "";
      const ext = contentType.includes("png")
        ? "png"
        : contentType.includes("webp")
          ? "webp"
          : "jpg";
      const key = this.ossService.generateKey(
        FileCategory.IMAGE,
        `ai-generated.${ext}`,
        undefined,
        projectId,
        scriptId,
      );
      const uploaded = await this.ossService.uploadFile(key, buffer, {
        mime: contentType || "image/jpeg",
      });
      if (!uploaded) throw new Error("OSS 上传返回空结果");
      this.logger.log(`图片已转存 OSS: ${key}`);
      // Bug 修复：返回 key（不带 /static/ 前缀），mainImageKey 应存储纯 key
      return uploaded.key;
    } catch (error) {
      this.logger.warn(
        `图片转存 OSS 失败，使用原始 URL: ${(error as Error).message}`,
      );
      return externalUrl;
    }
  }

  /**
   * 处理剧本生成任务
   */
  async process(job: Job): Promise<void> {
    const { taskId, type, requestData, modelId, providerId } = job.data;

    // 只处理生成任务
    if (type !== TaskType.GENERATE) {
      this.logger.debug(`跳过非生成任务: ${taskId}, 类型: ${type}`);
      return;
    }

    // 判断是否为图片生成任务
    if (requestData.assetType === "image") {
      return this.processImageGenerationTask(job);
    }

    // 判断是否为视频生成任务
    if (requestData.assetType === "video") {
      return this.processVideoGenerationTask(job);
    }

    // 判断是否为一键分镜生成任务
    if (requestData.assetType === "storyboard-all") {
      return this.processStoryboardAllGenerationTask(job);
    }

    return this.processScriptGenerationTask(job);
  }

  /**
   * 处理剧本生成任务（原有逻辑）
   */
  private async processScriptGenerationTask(job: Job): Promise<void> {
    const { taskId, requestData, modelId, providerId } = job.data;

    this.logger.log(`开始处理剧本生成任务: ${taskId}`);

    // 获取任务和剧本信息（使用关系查询一次性获取）
    const aiTask = await this.aiTaskRepository.findOne({
      where: { id: taskId },
      relations: ["script"],
    });

    if (!aiTask) {
      throw new Error(`AI 任务不存在: ${taskId}`);
    }

    const script = aiTask.script;

    if (!script) {
      throw new Error(`剧本不存在: ${aiTask.scriptId}`);
    }

    try {
      // 1. 更新任务状态为处理中
      await this.updateTaskStatus(taskId, AITaskStatus.PROCESSING);

      // 推送开始生成进度
      await this.broadcastProgress({
        taskId,
        scriptId: script.id,
        status: "started",
        progress: 0,
      });

      // 2. 构建提示词
      const systemPrompt = SCRIPT_GENERATE_SYSTEM_PROMPT;
      const userPrompt = buildScriptGenerateUserPrompt({
        idea: requestData.idea || requestData.description,
        genre: requestData.genre,
        tone: requestData.tone,
        targetDuration: requestData.targetDuration,
        characterCount: requestData.characterCount,
      });

      // 2.5 额度预扣减
      const fullPrompt = `${systemPrompt}\n${userPrompt}`;
      try {
        await this.textGenQuotaService.preDeduct(
          script.createdBy,
          taskId,
          fullPrompt,
          modelId || "qwen2.5-72b",
          "generate",
        );
      } catch (quotaError) {
        this.logger.error(`额度预扣减失败: taskId=${taskId}`, quotaError instanceof Error ? quotaError.message : undefined);
        await this.updateTaskStatus(taskId, AITaskStatus.FAILED, {
          error: (quotaError as Error).message || "额度不足",
          errorCode: ErrorCode.GENERATION_FAILED,
        });
        await this.broadcastProgress({
          taskId,
          scriptId: script.id,
          status: "failed",
          error: {
            code: ErrorCode.GENERATION_FAILED,
            message: "额度不足，无法生成",
            recoverable: false,
          },
        });
        throw quotaError;
      }

      // 3. 调用 AI 生成
      this.logger.log(
        `调用 AI 生成剧本: ${taskId}, 模型: ${modelId || "default"}, 供应商: ${providerId || "default"}`,
      );
      const result = await this.aiProvider.generateText(
        {
          prompt: userPrompt,
          systemPrompt,
          temperature: 0.7,
          maxTokens: 8000,
        },
        modelId || "qwen2.5-72b",
        providerId,
      );

      // 4. 解析生成的剧本文本
      const generatedText = result.text.trim();

      // 5. 提取标题（从《》中）
      const titleMatch = generatedText.match(/《([^》]+)》/);
      const title = titleMatch ? titleMatch[1] : "未命名剧本";

      // 6. 计算字数统计
      const wordCount = generatedText.length;
      const totalScenes = (
        generatedText.match(/第[一二三四五六七八九十\d]+场/g) || []
      ).length;
      const totalParagraphs = (generatedText.match(/\n/g) || []).length;

      // 7. 更新剧本内容 - 第一步只保存人类可读的剧本描述，不保存结构化数据
      script.title = title;
      script.description = generatedText; // 保存完整剧本文本作为描述
      script.content = {}; // 结构化数据为空，等待用户点击"一键解析"
      script.metadata = {
        ...script.metadata,
        genre: requestData.genre,
        tone: requestData.tone,
        targetDuration: requestData.targetDuration,
        aiGenerated: true,
        aiModel: modelId,
        source: "ai",
        wordCount,
        totalScenes,
        totalParagraphs,
        needsParsing: true, // 标记需要解析
      };
      script.status = ScriptStatus.EDITING;

      await this.scriptRepository.save(script);

      // 8. 更新任务状态为完成
      await this.updateTaskStatus(taskId, AITaskStatus.COMPLETED, {
        result: {
          title: script.title,
          description: generatedText,
          wordCount,
          totalScenes,
          totalParagraphs,
        },
        tokensUsed: result.usage.totalTokens,
        cost: calculateAICost(result.usage.totalTokens),
      });

      // 确认额度扣减（按实际 token 结算）
      try {
        await this.textGenQuotaService.confirmDeduct(taskId, result.usage.totalTokens);
      } catch (confirmError) {
        this.logger.warn(`确认额度扣减失败: taskId=${taskId}`, confirmError instanceof Error ? confirmError.message : undefined);
      }

      // 推送完成进度
      await this.broadcastProgress({
        taskId,
        scriptId: script.id,
        status: "completed",
        progress: 100,
        result: {
          title: script.title,
          description: generatedText,
        },
      });

      // 额外推送 script:generate-done 事件，确保前端能正确接收完成消息
      await this.webSocketService.broadcastTaskProgress(taskId, {
        type: WsEventNames.SCRIPT_GENERATE_DONE,
        taskId,
        scriptId: script.id,
        result: {
          title: script.title,
          description: generatedText,
        },
        timestamp: new Date().toISOString(),
      });

      this.logger.log(
        `剧本生成任务完成: ${taskId}, 剧本: ${script.id}, 字数: ${wordCount}`,
      );
    } catch (error) {
      const errorMessage = (error as Error).message || "未知错误";
      this.logger.error(`剧本生成任务失败: ${taskId}`);
      this.logger.debug(`详细错误信息: ${errorMessage}`);

      // 返还额度（任务失败时全额返还）
      try {
        await this.textGenQuotaService.refund(taskId, `剧本生成失败: ${errorMessage}`);
      } catch (refundError) {
        this.logger.warn(`返还额度失败: taskId=${taskId}`, refundError instanceof Error ? refundError.message : undefined);
      }

      // 更新任务状态为失败（脱敏处理）
      await this.updateTaskStatus(taskId, AITaskStatus.FAILED, {
        error: "剧本生成失败，请稍后重试",
        errorCode: ErrorCode.GENERATION_FAILED,
      });

      // 推送失败进度（脱敏处理，不暴露原始错误信息）
      await this.broadcastProgress({
        taskId,
        scriptId: script.id,
        status: "failed",
        error: {
          code: ErrorCode.GENERATION_FAILED,
          message: "剧本生成失败，请稍后重试",
          recoverable: true,
        },
      });

      // 更新剧本状态为编辑中（允许重试）
      script.status = ScriptStatus.EDITING;
      script.title = "生成失败，请重试";
      await this.scriptRepository.save(script);

      throw error;
    }
  }

/**
   * 将 StoryboardRef 转换为 ShotGroup（新结构）
   * @param storyboard 旧的分镜引用数据
   * @returns 转换后的 ShotGroup 对象
   */
  private convertStoryboardToShotGroup(
    storyboard: Record<string, unknown>,
  ): Record<string, unknown> {
    const now = new Date().toISOString();
    const id = (storyboard.id as string) || randomUUID();

    // 获取 videoMode
    const videoMode = this.mapVideoMode(storyboard.videoMode as string | undefined);

    // 转换 dialogues
    const dialogues = (storyboard.dialogues as Array<Record<string, unknown>>) || [];
    // 确保 dialogues 都有 id
    const dialoguesWithIds = dialogues.map((d, index) => ({
      ...d,
      id: (d.id as string) || `${id}_dialogue_${index}`,
    }));

    // 根据 videoMode 创建 shots 或 video
    let shots: Array<Record<string, unknown>> = [];
    let video: Record<string, unknown> | undefined;

    if (videoMode === "lip_sync") {
      // lip_sync 模式：每个对话对应一个 shot
      shots = dialoguesWithIds.map((d) => ({
        id: randomUUID(),
        dialogueId: d.id as string,
        status: "pending",
      }));
    } else {
      // video_only / audio_reference 模式：视频属于 shotGroup
      video = {
        status: "pending",
      };
      shots = []; // 清空 shots
    }

    return {
      id,
      sequenceNumber: (storyboard.sequenceNumber as number) || 1,
      title: storyboard.title,
      description: (storyboard.description as string) || "",
      videoMode,
      video,
      shots,
      mainImageId: storyboard.mainImageId as string | undefined,
      // Bug 修复：从 images 数组的 url 中提取纯 key
      // url 格式可能是 "/static/images/xxx.jpg" 或 "images/xxx.jpg" 或完整 URL
      mainImageKey: (() => {
        const mainImg = (storyboard.images as Array<Record<string, unknown>>)?.find(
          (img) => img.type === "main",
        );
        const url = mainImg?.url as string | undefined;
        if (!url) return undefined;
        // 如果是完整 URL（http 开头），直接返回（本地模式）
        if (url.startsWith("http")) return url;
        // 如果是 /static/ 格式，提取纯 key
        if (url.startsWith("/static/")) return url.slice(8);
        // 否则已经是纯 key，直接返回
        return url;
      })(),
      mainImageVersion: 0,
      detectionStatus: "pending",
      characterRegions: {},
      characterIds: (storyboard.characterIds as string[]) || [],
      sceneId: storyboard.sceneId as string | undefined,
      propIds: (storyboard.propIds as string[]) || [],
      dialogues: dialoguesWithIds,
      referenceMode: (storyboard.referenceMode as string) || "multi_reference",
      imageModelId: storyboard.imageModelId as string | undefined,
      videoModelId: storyboard.videoModelId as string | undefined,
      lipSyncModelId: storyboard.lipSyncModelId as string | undefined,
      createdAt: (storyboard.createdAt as string) || now,
      updatedAt: now,
    };
  }

  /**
   * 映射视频模式字符串到新的枚举值
   */
  private mapVideoMode(mode: string | undefined): string {
    const modeMap: Record<string, string> = {
      audio_reference: "audio_reference",
      lip_sync: "lip_sync",
      video_only: "video_only",
    };
    return modeMap[mode || ""] || "video_only";
  }

  /**
   * 处理图片生成任务（角色/场景/道具图片）
   */
  private async processImageGenerationTask(job: Job): Promise<void> {
    const { taskId, requestData } = job.data;
    const {
      assetId,
      scriptId,
      prompt,
      modelId,
      negativePrompt,
      aspectRatio,
      referenceImages,
      typedReferenceImages,
      quality,
    } = requestData;

    this.logger.log(`开始处理图片生成任务: ${taskId}, assetId=${assetId}`);

    // 获取任务和剧本信息
    const aiTask = await this.aiTaskRepository.findOne({
      where: { id: taskId },
      relations: ["script"],
    });

    if (!aiTask) {
      throw new Error(`AI 任务不存在: ${taskId}`);
    }

    const script = aiTask.script;

    if (!script) {
      throw new Error(`剧本不存在: ${aiTask.scriptId}`);
    }

    try {
      // 1. 更新任务状态为处理中
      await this.updateTaskStatus(taskId, AITaskStatus.PROCESSING);

      // 推送开始生成进度
      await this.broadcastImageProgress({
        taskId,
        scriptId,
        refId: assetId,
        status: "processing",
        progress: 10,
      });

      // 2. 转换参考图 URL（确保外部 AI API 可访问）
      let transformedRefImages: string[] | undefined;
      let transformedTypedRefImages:
        | Array<{
            url: string;
            type: "character" | "scene" | "prop" | "reference";
            name?: string;
          }>
        | undefined;

      if (typedReferenceImages?.length) {
        // 带类型的参考图：逐个转换 URL
        transformedTypedRefImages = await Promise.all(
          typedReferenceImages.map(
            async (ref: {
              url: string;
              type: "character" | "scene" | "prop" | "reference";
              name?: string;
            }) => ({
              ...ref,
              url: await this.urlTransformService.getAccessibleUrl(ref.url),
            }),
          ),
        );
        this.logger.log(
          `参考图 URL 转换完成: ${taskId}, 原始数量=${typedReferenceImages.length}`,
        );
      } else if (referenceImages?.length) {
        // 简单参考图列表：批量转换
        transformedRefImages =
          await this.urlTransformService.getAccessibleUrls(referenceImages);
        this.logger.log(
          `参考图 URL 转换完成: ${taskId}, 原始数量=${referenceImages.length}`,
        );
      }

      // 3. 调用 AI 生成图片（使用 requestData 中的比例，默认 1:1）
      this.logger.log(
        `调用 AI 生成图片: ${taskId}, prompt="${prompt?.substring(0, 50)}...", aspectRatio=${aspectRatio || "1:1"}, quality=${quality || "default"}`,
      );
      const result = await this.aiProvider.generateImage(
        {
          prompt,
          negativePrompt,
          aspectRatio,
          quality,
          // 优先使用带类型的参考图（支持多模态参考图生成的图像模型）
          typedReferenceImages: transformedTypedRefImages?.length
            ? transformedTypedRefImages
            : transformedRefImages?.length
              ? transformedRefImages.map((url) => ({
                  url,
                  type: "reference" as const,
                }))
              : undefined,
        },
        modelId || "wanx2.1-t2i-turbo",
        undefined,
      );

      // 推送生成中进度
      await this.broadcastImageProgress({
        taskId,
        scriptId,
        refId: assetId,
        status: "processing",
        progress: 80,
      });

      // 3. 将生成的图片转存到 OSS，避免直接引用第三方 URL
      const imageId = randomUUID();
      // Bug 修复：saveImageToOss 返回纯 key（不带 /static/ 前缀）
      const imageKey = await this.saveImageToOss(result.imageUrl, script.projectId, script.id);
      // 构建完整 URL 用于 images 数组和响应
      const imageUrl = imageKey.startsWith("http")
        ? imageKey  // 本地模式（OSS 未配置）返回完整 URL
        : `/static/${imageKey}`;  // OSS 模式构建相对路径 URL
      const thumbnailUrl = imageUrl;

      // 构建新图片对象（在锁外准备数据）
      const newImage = {
        id: imageId,
        url: imageUrl,  // images 数组存储完整 URL
        thumbnailUrl,
        type: "main",
        createdAt: new Date().toISOString(),
      };

      // 4. 使用分布式锁更新剧本内容，将图片添加到对应资产（角色/场景/道具）
      const lockKey = `script:content:${scriptId}`;
      this.logger.log(
        `[图片生成] 尝试获取锁: taskId=${taskId}, assetId=${assetId}, lockKey=${lockKey}`,
      );
      await this.redlockService.withLock(lockKey, 10000, async () => {
        this.logger.log(
          `[图片生成] 锁获取成功，开始更新: taskId=${taskId}, assetId=${assetId}`,
        );
        // 重新获取剧本最新状态（避免脏读）
        const freshScript = await this.scriptRepository.findOne({
          where: { id: scriptId },
        });
        if (!freshScript) {
          throw new Error(`剧本不存在: ${scriptId}`);
        }
        this.logger.log(
          `[图片生成] 重新获取剧本成功: taskId=${taskId}, assetId=${assetId}`,
        );

        const content = freshScript.content as Record<string, unknown>;
        const storyboards =
          (content.storyboards as Array<Record<string, unknown>>) || [];
        this.logger.log(
          `[图片生成] 当前剧本中分镜数量: ${storyboards.length}, taskId=${taskId}, assetId=${assetId}`,
        );

        // 依次在 characters/scenes/props 中查找 assetId 并更新
        const assetArrayKeys: Array<"characters" | "scenes" | "props"> = [
          "characters",
          "scenes",
          "props",
        ];
        let assetUpdated = false;
        for (const key of assetArrayKeys) {
          const arr = (content[key] as Array<Record<string, unknown>>) || [];
          const idx = arr.findIndex((item) => item.id === assetId);
          if (idx !== -1) {
            // 保留已有参考图，只替换主图（type=main/angle）
            const existingImgs =
              (arr[idx].images as Array<Record<string, unknown>>) || [];
            const keepRefImgs = existingImgs.filter(
              (img) => (img as { type?: string }).type === "reference",
            );
            // 删除旧主图的 OSS 文件（重新生成时清理）
            const oldMainImgs = existingImgs.filter(
              (img) => (img as { type?: string }).type !== "reference",
            );
            for (const old of oldMainImgs) {
              const oldUrl = (old as { url?: string }).url;
              if (oldUrl) {
                try {
                  const parsedUrl = new URL(oldUrl as string);
                  const ossKey = parsedUrl.pathname.startsWith("/")
                    ? parsedUrl.pathname.slice(1)
                    : parsedUrl.pathname;
                  if (ossKey) await this.ossService.deleteFile(ossKey);
                } catch (e) {
                  this.logger.warn(
                    `删除旧主图 OSS 文件失败: ${(e as Error).message}`,
                  );
                }
              }
            }
            arr[idx].images = [...keepRefImgs, newImage];
            arr[idx].assetStatus = "imported";
            arr[idx].mainImageId = imageId;
            content[key] = arr;
            freshScript.content = content;
            // 使用 update 方法只更新 content 字段，避免 save 序列化整个对象时覆盖并发写入的数据
            await this.scriptRepository.update(
              { id: scriptId },

              { content: content as any },
            );
            this.logger.log(
              `[图片生成] 资产图片更新成功：taskId=${taskId}, assetId=${assetId}`,
            );

            // 同时保存到资源库图片表
            const assetRef = arr[idx];
            const generationInfo = {
              generationId: taskId,
              prompt: prompt || "",
              negativePrompt: negativePrompt,
              modelId: modelId || "unknown",
              quality: quality || undefined,
              createdAt: new Date().toISOString(),
            };

            try {
              if (key === "characters") {
                const characterId = assetRef.characterId as string | undefined;
                if (characterId) {
                  // 先将旧的主图设为非当前版本
                  await this.characterImageRepository.update(
                    { characterId, type: "front_view", isCurrent: true },
                    { isCurrent: false },
                  );
                  await this.characterImageRepository.save(
                    this.characterImageRepository.create({
                      characterId,
                      type: "front_view" as const,  // 主图类型，确保角色库能正确显示
                      url: imageUrl,
                      thumbnailUrl,
                      generationInfo,
                      version: 1,
                      isCurrent: true,
                    }),
                  );
                  this.logger.log(
                    `[图片生成] 已保存到角色资源库: characterId=${characterId}, type=front_view`,
                  );
                }
              } else if (key === "scenes") {
                const sceneId = assetRef.sceneId as string | undefined;
                if (sceneId) {
                  // 先将旧的全景图设为非当前版本
                  await this.sceneImageRepository.update(
                    { sceneId, type: "panorama", isCurrent: true },
                    { isCurrent: false },
                  );
                  await this.sceneImageRepository.save(
                    this.sceneImageRepository.create({
                      sceneId,
                      type: "panorama" as const,  // 全景图类型，确保场景库能正确显示
                      url: imageUrl,
                      thumbnailUrl,
                      generationInfo,
                      version: 1,
                      isCurrent: true,
                    }),
                  );
                  this.logger.log(
                    `[图片生成] 已保存到场景资源库: sceneId=${sceneId}, type=panorama`,
                  );
                }
              } else if (key === "props") {
                const propId = assetRef.propId as string | undefined;
                if (propId) {
                  // 先将旧的主图设为非当前版本
                  await this.propImageRepository.update(
                    { propId, type: "front_view", isCurrent: true },
                    { isCurrent: false },
                  );
                  await this.propImageRepository.save(
                    this.propImageRepository.create({
                      propId,
                      type: "front_view" as const,  // 主图类型，确保道具库能正确显示
                      url: imageUrl,
                      thumbnailUrl,
                      generationInfo,
                      version: 1,
                      isCurrent: true,
                    }),
                  );
                  this.logger.log(
                    `[图片生成] 已保存到道具资源库: propId=${propId}, type=front_view`,
                  );
                }
              }
            } catch (libError) {
              // 资源库保存失败不影响主流程
              this.logger.warn(
                `[图片生成] 保存到资源库失败: ${(libError as Error).message}`,
              );
            }

            assetUpdated = true;
            break;
          }
        }

        // 若在角色/场景/道具中未找到，再尝试在 shotGroups 中查找（分镜图片生成）
        if (!assetUpdated) {
          const shotGroups =
            (content.shotGroups as Array<Record<string, unknown>>) || [];
          this.logger.log(
            `[图片生成] 在 shotGroups 中查找: assetId=${assetId}, shotGroups 总数=${shotGroups.length}`,
          );
          const sgIdx = shotGroups.findIndex((sg) => sg.id === assetId);
          this.logger.log(
            `[图片生成] shotGroup 查找结果: assetId=${assetId}, sgIdx=${sgIdx}`,
          );
          if (sgIdx !== -1) {
            const existingMainImageId = shotGroups[sgIdx].mainImageId as
              | string
              | undefined;

            // 更新 mainImageKey 和 mainImageId
            // Bug 修复：mainImageKey 应存储纯 key（不带 /static/ 前缀）
            shotGroups[sgIdx].mainImageKey = imageKey;
            shotGroups[sgIdx].mainImageId = imageId;
            // 重置检测状态（新图需要重新检测主体）
            shotGroups[sgIdx].detectionStatus = "pending";
            shotGroups[sgIdx].detectedSubjects = [];
            shotGroups[sgIdx].characterRegions = {};
            shotGroups[sgIdx].updatedAt = new Date().toISOString();

            content.shotGroups = shotGroups;

            freshScript.content = content;
            this.logger.log(
              `[图片生成] 保存 shotGroup 图片前: assetId=${assetId}, sgIdx=${sgIdx}, mainImageId=${imageId}`,
            );

            await this.scriptRepository.update(
              { id: scriptId },
              { content: content as any },
            );
            this.logger.log(
              `[图片生成] 保存 shotGroup 图片成功: assetId=${assetId}, imageId=${imageId}`,
            );
            assetUpdated = true;

            // 如果存在旧的主图，尝试删除
            if (existingMainImageId && existingMainImageId !== imageId) {
              this.logger.log(
                `[图片生成] 检测到旧主图: ${existingMainImageId}，新版本已生成: ${imageId}`,
              );
            }
          } else {
            // 向后兼容：在 storyboards 中查找
            const storyboards =
              (content.storyboards as Array<Record<string, unknown>>) || [];
            const sbIdx = storyboards.findIndex((sb) => sb.id === assetId);
            if (sbIdx !== -1) {
              this.logger.log(
                `[图片生成] 在 storyboards 中找到 assetId=${assetId}（向后兼容模式）`,
              );
              // 同样更新 shotGroups
              const shotGroups =
                (content.shotGroups as Array<Record<string, unknown>>) || [];
              const existingSg = shotGroups.find((sg) => sg.id === assetId);
              if (existingSg) {
                // Bug 修复：mainImageKey 应存储纯 key（不带 /static/ 前缀）
                existingSg.mainImageKey = imageKey;
                existingSg.mainImageId = imageId;
                existingSg.detectionStatus = "pending";
                existingSg.updatedAt = new Date().toISOString();
                content.shotGroups = shotGroups;
                await this.scriptRepository.update(
                  { id: scriptId },
                  { content: content as any },
                );
              }
              assetUpdated = true;
            } else {
              this.logger.warn(
                `[图片生成] 在 shotGroups/storyboards 中均未找到 assetId: ${assetId}`,
              );
            }
          }
        }

        if (!assetUpdated) {
          this.logger.warn(
            `图片生成任务找不到 assetId=${assetId}，跳过剧本更新`,
          );
        }
      });

      // 5. 更新任务状态为完成
      await this.updateTaskStatus(taskId, AITaskStatus.COMPLETED, {
        result: {
          imageId,
          url: imageUrl,
          thumbnailUrl,
        },
      });

      // 推送完成进度
      await this.broadcastImageProgress({
        taskId,
        scriptId,
        refId: assetId,
        status: "completed",
        progress: 100,
        result: {
          imageId,
          url: imageUrl,
          thumbnailUrl,
        },
      });

      this.logger.log(`图片生成任务完成: ${taskId}, imageId=${imageId}`);
    } catch (error) {
      const errorMessage = (error as Error).message || "未知错误";
      this.logger.error(`图片生成任务失败: ${taskId}`);
      this.logger.debug(`详细错误信息: ${errorMessage}`);

      // 更新任务状态为失败（脱敏处理）
      await this.updateTaskStatus(taskId, AITaskStatus.FAILED, {
        error: "图片生成失败，请稍后重试",
      });

      // 推送失败进度（脱敏处理，不暴露原始错误信息）
      await this.broadcastImageProgress({
        taskId,
        scriptId,
        refId: assetId,
        status: "failed",
        error: {
          code: "IMAGE_GENERATION_FAILED",
          message: "图片生成失败，请稍后重试",
          recoverable: true,
        },
      });

      throw error;
    }
  }

  /**
   * 处理分镜视频生成任务
   */
  private async processVideoGenerationTask(job: Job): Promise<void> {
    const { taskId, requestData } = job.data;
    const {
      storyboardId,
      scriptId,
      prompt,
      modelId,
      imageUrl,
      imageUrls,
      audioUrls,
      referenceMode,
      duration,
      aspectRatio,
    } = requestData as {
      storyboardId: string;
      scriptId: string;
      prompt: string;
      modelId?: string;
      imageUrl?: string;
      imageUrls?: string[];
      audioUrls?: string[];
      referenceMode?: string;
      duration?: number;
      aspectRatio?: string;
    };

    // 判断参考模式（默认多参考生视频）
    const isSingleReference = referenceMode === "single_reference";

    this.logger.log(
      `开始处理视频生成任务: ${taskId}, storyboardId=${storyboardId}, referenceMode=${referenceMode || "multi_reference"}`,
    );

    // 获取任务和剧本信息
    const aiTask = await this.aiTaskRepository.findOne({
      where: { id: taskId },
      relations: ["script"],
    });

    if (!aiTask) {
      throw new Error(`AI 任务不存在: ${taskId}`);
    }

    const script = aiTask.script;

    if (!script) {
      throw new Error(`剧本不存在: ${aiTask.scriptId}`);
    }

    try {
      // 1. 更新任务状态为处理中
      await this.updateTaskStatus(taskId, AITaskStatus.PROCESSING);

      // 推送开始生成进度
      await this.broadcastVideoProgress({
        taskId,
        scriptId,
        storyboardId,
        status: "processing",
        progress: 10,
      });

      // 2. 转换图片 URL（确保外部 AI API 可访问）
      let transformedImageUrl: string | undefined;
      let transformedImageUrls: string[] | undefined;

      if (imageUrls?.length) {
        transformedImageUrls =
          await this.urlTransformService.getAccessibleUrls(imageUrls);
        this.logger.log(
          `多图参考模式 URL 转换完成: ${taskId}, 原始数量=${imageUrls.length}`,
        );
      } else if (imageUrl) {
        transformedImageUrl =
          await this.urlTransformService.getAccessibleUrl(imageUrl);
        this.logger.log(`单图参考模式 URL 转换完成: ${taskId}`);
      }

      // 3. 调用 AI 生成视频
      // 分辨率参数始终传递给外部模型服务
      // audioUrls 已在 script-storyboard.service.ts 中转换，不需要再次处理
      this.logger.log(
        `调用 AI 生成视频: ${taskId}, prompt="${prompt?.substring(0, 50)}...", mode=${isSingleReference ? "single" : "multi"}, images=${transformedImageUrls?.length ?? (transformedImageUrl ? 1 : 0)}, audios=${audioUrls?.length ?? 0}, aspectRatio=${aspectRatio || "默认"}`,
      );
      const result = await this.aiProvider.generateVideo(
        {
          prompt,
          imageUrl: transformedImageUrl,
          imageUrls: transformedImageUrls,
          audioUrls,
          duration,
          aspectRatio, // 始终传递分辨率参数
          referenceMode: referenceMode as
            | "single_reference"
            | "multi_reference"
            | undefined,
        },
        modelId || "wan2.6",
        undefined,
        // 进度回调：每次轮询时推送进度给前端
        async (progress: number) => {
          await this.broadcastVideoProgress({
            taskId,
            scriptId,
            storyboardId,
            status: "processing",
            progress,
          });
        },
      );

      // 3. 将生成的视频转存到 OSS（若 OSS 已配置）
      let videoUrl = result.videoUrl;
      if (this.ossService.isConfigured()) {
        try {
          const response = await fetch(videoUrl);
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer) as Buffer;
            const contentType =
              response.headers.get("content-type") || "video/mp4";

            // 直接保存原始视频，不再转码
            // 前端已改用视频切换模式，无需统一编码格式

            const ext = contentType.includes("webm") ? "webm" : "mp4";
            const key = this.ossService.generateKey(
              FileCategory.VIDEO,
              `ai-generated.${ext}`,
              "sb_",
              script.projectId,
              script.id,
            );
            const uploaded = await this.ossService.uploadFile(key, buffer, {
              mime: contentType,
            });
            if (uploaded) {
              videoUrl = uploaded.url;
              this.logger.log(`视频已转存 OSS: ${key}`);
            }
          }
        } catch (e) {
          this.logger.warn(
            `视频转存 OSS 失败，使用原始 URL: ${(e as Error).message}`,
          );
        }
      }

      // 4. 使用分布式锁更新剧本内容，将视频 URL 写入 shotGroup.video（新结构）
      const lockKey = `script:content:${scriptId}`;
      await this.redlockService.withLock(lockKey, 10000, async () => {
        // 重新获取剧本最新状态（避免脏读）
        const freshScript = await this.scriptRepository.findOne({
          where: { id: scriptId },
        });
        if (!freshScript) {
          throw new Error(`剧本不存在: ${scriptId}`);
        }

        const content = freshScript.content as Record<string, unknown>;
        const shotGroups =
          (content.shotGroups as Array<Record<string, unknown>>) || [];
        const sgIdx = shotGroups.findIndex((item) => item.id === storyboardId);

        if (sgIdx !== -1) {
          // 获取 videoMode
          const videoMode = (shotGroups[sgIdx].videoMode as string) || "video_only";

          // video_only / audio_reference：写入 shotGroup.video
          // lip_sync：不在此处理（对口型视频在 script-shot-group.service.ts）
          shotGroups[sgIdx].video = {
            status: "completed",
            url: videoUrl,
            taskId,
          };

          // 向后兼容：也更新 storyboards
          const storyboards =
            (content.storyboards as Array<Record<string, unknown>>) || [];
          const sbIdx = storyboards.findIndex((item) => item.id === storyboardId);
          if (sbIdx !== -1) {
            storyboards[sbIdx].videoGeneration = {
              prompt,
              status: "completed",
              videoUrl,
              taskId,
            };
            storyboards[sbIdx].videoUrl = videoUrl;
            content.storyboards = storyboards;
          }

          content.shotGroups = shotGroups;
          freshScript.content = content;
          await this.scriptRepository.save(freshScript);
        } else {
          this.logger.warn(
            `视频生成任务找不到 storyboardId=${storyboardId}，跳过剧本更新`,
          );
        }
      });

      // 5. 更新任务状态为完成
      await this.updateTaskStatus(taskId, AITaskStatus.COMPLETED, {
        result: { videoUrl },
      });

      // 推送完成进度
      await this.broadcastVideoProgress({
        taskId,
        scriptId,
        storyboardId,
        status: "completed",
        progress: 100,
        result: { videoUrl },
      });

      this.logger.log(
        `视频生成任务完成: ${taskId}, storyboardId=${storyboardId}`,
      );
    } catch (error) {
      this.logger.error(
        `视频生成任务失败: ${taskId}, 错误: ${(error as Error).message}`,
      );

      // 更新失败状态到分镜
      try {
        const lockKey = `script:content:${scriptId}`;
        await this.redlockService.withLock(lockKey, 10000, async () => {
          // 重新获取剧本最新状态（避免脏读）
          const freshScript = await this.scriptRepository.findOne({
            where: { id: scriptId },
          });
          if (!freshScript) {
            this.logger.warn(`更新失败状态时剧本不存在: ${scriptId}`);
            return;
          }

          const content = freshScript.content as Record<string, unknown>;

          // 更新 shotGroups
          const shotGroups =
            (content.shotGroups as Array<Record<string, unknown>>) || [];
          const sgIdx = shotGroups.findIndex(
            (item) => item.id === storyboardId,
          );
          if (sgIdx !== -1) {
            // video_only / audio_reference：更新 shotGroup.video
            shotGroups[sgIdx].video = {
              status: "failed",
              taskId,
            };
            content.shotGroups = shotGroups;
          }

          // 向后兼容：也更新 storyboards
          const storyboards =
            (content.storyboards as Array<Record<string, unknown>>) || [];
          const sbIdx = storyboards.findIndex(
            (item) => item.id === storyboardId,
          );
          if (sbIdx !== -1) {
            storyboards[sbIdx].videoGeneration = {
              prompt,
              status: "failed",
              taskId,
            };
            content.storyboards = storyboards;
          }

          freshScript.content = content;

          await this.scriptRepository.update(
            { id: scriptId },
            { content: content as any },
          );
        });
      } catch (updateErr) {
        this.logger.warn(`更新分镜视频失败状态出错`);
        this.logger.debug(`详细错误信息: ${(updateErr as Error).message}`);
      }

      // 更新任务状态为失败（脱敏处理）
      await this.updateTaskStatus(taskId, AITaskStatus.FAILED, {
        error: "视频生成失败，请稍后重试",
      });

      // 推送失败进度（脱敏处理，不暴露原始错误信息）
      await this.broadcastVideoProgress({
        taskId,
        scriptId,
        storyboardId,
        status: "failed",
        error: {
          code: "VIDEO_GENERATION_FAILED",
          message: "视频生成失败，请稍后重试",
          recoverable: true,
        },
      });

      throw error;
    }
  }

  /**
   * 处理一键分镜批量生成任务
   * 遍历剧本所有场景，逐一调用 AI 生成分镜，推送进度，最终保存到 script.content
   */
  private async processStoryboardAllGenerationTask(job: Job): Promise<void> {
    const { taskId, requestData } = job.data;
    const { scriptId, modelId } = requestData as {
      scriptId: string;
      modelId?: string;
    };

    this.logger.log(
      `开始处理一键分镜生成任务: ${taskId}, scriptId=${scriptId}`,
    );

    // 获取任务和剧本信息
    const aiTask = await this.aiTaskRepository.findOne({
      where: { id: taskId },
      relations: ["script"],
    });

    if (!aiTask) {
      throw new Error(`AI 任务不存在: ${taskId}`);
    }

    const script = aiTask.script;

    if (!script) {
      throw new Error(`剧本不存在: ${aiTask.scriptId}`);
    }

    try {
      // 1. 更新任务状态为处理中
      await this.updateTaskStatus(taskId, AITaskStatus.PROCESSING);

      const content = script.content as Record<string, unknown>;

      // 2. 提取剧本基本信息
      const characters =
        (content.characters as Array<Record<string, unknown>>) || [];
      const scenes = (content.scenes as Array<Record<string, unknown>>) || [];
      const dialogues =
        (content.dialogues as Array<Record<string, unknown>>) || [];

      // 场景为空时直接完成
      if (scenes.length === 0) {
        await this.updateTaskStatus(taskId, AITaskStatus.COMPLETED, {
          result: { storyboardCount: 0 },
        });
        await this.webSocketService.broadcastTaskProgress(taskId, {
          type: "storyboard:generate-done",
          taskId,
          scriptId,
          storyboards: [],
          progress: 100,
          timestamp: new Date().toISOString(),
        });
        this.logger.log(`分镜批量生成完成（无场景）: taskId=${taskId}`);
        return;
      }

      // 额度预扣减（估算所有场景的 prompt 总量）
      const totalScenes = scenes.length;
      const estimatedPrompt = `生成分镜: ${totalScenes} 个场景`;
      try {
        await this.textGenQuotaService.preDeduct(
          script.createdBy,
          taskId,
          estimatedPrompt,
          modelId || "qwen2.5-72b",
          "storyboard-all",
        );
      } catch (quotaError) {
        this.logger.error(`额度预扣减失败: taskId=${taskId}`, quotaError instanceof Error ? quotaError.message : undefined);
        await this.updateTaskStatus(taskId, AITaskStatus.FAILED, {
          error: (quotaError as Error).message || "额度不足",
          errorCode: ErrorCode.GENERATION_FAILED,
        });
        throw quotaError;
      }

      // 构建角色名→ID 的映射
      const charNameToId = new Map(
        characters.map((c) => [c.name as string, c.id as string]),
      );

      const allStoryboards: Record<string, unknown>[] = [];
      let totalTokensUsed = 0;

      // 3. 逐场景生成分镜
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];

        // 检查任务是否被取消
        const current = await this.aiTaskRepository.findOne({
          where: { id: taskId },
        });
        if (current?.status === AITaskStatus.CANCELLED) {
          this.logger.log(`分镜生成任务被取消: taskId=${taskId}`);
          break;
        }

        // 该场景的对话（按 sceneIndex 匹配）
        const sceneDialogues = dialogues.filter(
          (d) => (d.sceneIndex as number) === i,
        );

        // 构建角色列表
        const charObjects = characters.map((c) => ({
          name: c.name as string,
          description: (c.description as string) || undefined,
        }));

        const dialogueObjects = sceneDialogues.map((d) => ({
          characterName: ((d.characterName || d.character) as string) || "",
          text: d.text as string,
        }));

        // 推送进度
        const progress = Math.round((i / scenes.length) * 80);
        await this.webSocketService.broadcastTaskProgress(taskId, {
          type: "storyboard:generate-progress",
          taskId,
          scriptId,
          status: "processing",
          progress,
          currentScene: (scene.name as string) || `场景${i + 1}`,
          generatedCount: allStoryboards.length,
          timestamp: new Date().toISOString(),
        });

        // 记录本场景在总数组中的起始位置（用于 fallback 只给第一个分镜分配对白）
        const sceneStartIndex = allStoryboards.length;

        try {
          // 每个场景的分镜数量：对话多则多生成几个
          const shotCount = Math.max(
            2,
            Math.min(4, Math.ceil((sceneDialogues.length + 1) / 1.5)),
          );

          const systemPrompt = STORYBOARD_GENERATE_SYSTEM_PROMPT;
          const userPrompt = buildStoryboardGenerateUserPrompt({
            sceneName: (scene.name as string) || `场景${i + 1}`,
            sceneDescription: (scene.description as string) || undefined,
            location: (scene.location as string) || undefined,
            characters: charObjects,
            dialogues: dialogueObjects,
            shotCount,
          });

          const result = await this.aiProvider.generateText(
            {
              prompt: userPrompt,
              systemPrompt,
              temperature: 0.7,
              maxTokens: 2000,
            },
            modelId || "qwen2.5-72b",
            undefined,
          );

          // 累加实际 token 消耗
          totalTokensUsed += result.usage.totalTokens;

          // 解析 AI 返回的 JSON（容错处理）
          let parsed: { storyboards: Array<Record<string, unknown>> } = {
            storyboards: [],
          };
          try {
            const jsonStr = result.text
              .replace(/```json\n?/g, "")
              .replace(/```\n?/g, "")
              .trim();
            parsed = JSON.parse(jsonStr) as {
              storyboards: Array<Record<string, unknown>>;
            };
          } catch (parseErr) {
            this.logger.warn(
              `场景 ${i} 分镜 JSON 解析失败，跳过: ${(parseErr as Error).message}`,
            );
          }

          for (const sb of parsed.storyboards || []) {
            // 映射角色名→ID
            const shotChars = (sb.characters as string[]) || [];
            const characterIds = shotChars
              .map((n) => charNameToId.get(n))
              .filter(Boolean) as string[];

            // 分镜关联的场景 ID
            const sceneId = scene.id as string;

            // 处理对白
            const sbDialogues =
              (sb.dialogues as Array<Record<string, unknown>>) || [];
            const mappedDialogues = sbDialogues.map((d) => {
              const charName =
                ((d.characterName || d.character) as string) || "";
              return {
                id: randomUUID(),
                characterId: charNameToId.get(charName),
                characterName: charName,
                text: (d.text as string) || "",
                emotion: d.emotion as string | undefined,
                isVoiceover: (d.isVoiceover as boolean) || false,
              };
            });

            // 若 AI 未返回对白，仅在本场景第一个分镜中填充原始对白（避免所有分镜重复）
            const isFirstInScene = allStoryboards.length === sceneStartIndex;
            const finalDialogues =
              mappedDialogues.length > 0
                ? mappedDialogues
                : isFirstInScene
                  ? sceneDialogues.slice(0, 3).map((d) => ({
                      id: randomUUID(),
                      characterId: charNameToId.get(
                        ((d.characterName || d.character) as string) || "",
                      ),
                      characterName:
                        ((d.characterName || d.character) as string) || "",
                      text: (d.text as string) || "",
                      emotion: d.emotion as string | undefined,
                      isVoiceover: false,
                    }))
                  : [];

            allStoryboards.push({
              id: randomUUID(),
              sequenceNumber: allStoryboards.length + 1,
              title:
                (sb.title as string) ||
                `${scene.name || `场景${i + 1}`} - ${allStoryboards.length + 1}`,
              description: (sb.description as string) || "",
              characterIds,
              sceneId,
              propIds: [],
              dialogues: finalDialogues,
              voiceover: sb.voiceover as string | undefined,
              shotType: (sb.shotType as string) || "medium",
              cameraAngle: sb.cameraAngle as string | undefined,
              cameraMovement: sb.cameraMovement as string | undefined,
              duration: (sb.duration as number) || 3,
              referenceImages: [],
              mode: "standard",
              videoMode:
                finalDialogues.length > 0 ? "audio_reference" : "video_only",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        } catch (e) {
          this.logger.warn(
            `场景 ${i} 分镜生成失败，跳过: ${(e as Error).message}`,
          );
        }
      }

      // 4. 使用分布式锁保存分镜到 script.content（合并模式：保留已有分镜的图片等数据）
      const lockKey = `script:content:${scriptId}`;
      await this.redlockService.withLock(lockKey, 15000, async () => {
        // 重新获取剧本最新状态（避免脏读）
        const freshScript = await this.scriptRepository.findOne({
          where: { id: scriptId },
        });
        if (!freshScript) {
          throw new Error(`剧本不存在: ${scriptId}`);
        }

        const content = freshScript.content as Record<string, unknown>;
        const existingShotGroups =
          (content.shotGroups as Array<Record<string, unknown>>) || [];

        // 创建现有分镜组的映射，用于保留已有数据（如图片）
        // 使用 sceneId + sequenceNumber 作为匹配键
        const existingShotGroupMap = new Map<
          string,
          Record<string, unknown>
        >();
        for (const sg of existingShotGroups) {
          const sceneId = sg.sceneId as string;
          const seqNum = sg.sequenceNumber as number;
          if (sceneId && seqNum) {
            const key = `${sceneId}:${seqNum}`;
            existingShotGroupMap.set(key, sg);
          }
        }

        // 将新生成的 storyboards 转换为 shotGroups 格式
        const newShotGroups: Record<string, unknown>[] = [];
        for (const newSb of allStoryboards) {
          const convertedSg = this.convertStoryboardToShotGroup(newSb);
          newShotGroups.push(convertedSg);
        }

        // 合并新分镜组和现有分镜组数据
        const mergedShotGroups = newShotGroups.map((newSg) => {
          const sceneId = newSg.sceneId as string;
          const seqNum = newSg.sequenceNumber as number;
          const key = sceneId && seqNum ? `${sceneId}:${seqNum}` : null;
          const existingSg = key ? existingShotGroupMap.get(key) : undefined;

          if (existingSg) {
            // 保留已有分镜的图片等生成数据
            // 复用已有分镜的ID，确保前端引用不丢失
            return {
              ...newSg,
              id: existingSg.id || newSg.id,
              mainImageId: existingSg.mainImageId || newSg.mainImageId,
              mainImageKey: existingSg.mainImageKey || newSg.mainImageKey,
              mainImageVersion: existingSg.mainImageVersion || newSg.mainImageVersion,
              detectionStatus: existingSg.detectionStatus || newSg.detectionStatus,
              detectedSubjects: existingSg.detectedSubjects || newSg.detectedSubjects,
              characterRegions: existingSg.characterRegions || newSg.characterRegions,
              // 保留 shots 中的视频数据
              shots: this.mergeShots(
                (newSg.shots as Array<Record<string, unknown>>) || [],
                (existingSg.shots as Array<Record<string, unknown>>) || [],
              ),
              // 更新时间戳
              updatedAt: new Date().toISOString(),
            };
          }
          return newSg;
        });

        // 保存到 shotGroups
        content.shotGroups = mergedShotGroups;

        // 向后兼容：也保存到 storyboards
        const existingStoryboards =
          (content.storyboards as Array<Record<string, unknown>>) || [];
        const storyboardMap = new Map<string, Record<string, unknown>>();
        for (const sb of existingStoryboards) {
          const sceneId = sb.sceneId as string;
          const seqNum = sb.sequenceNumber as number;
          if (sceneId && seqNum) {
            const key = `${sceneId}:${seqNum}`;
            storyboardMap.set(key, sb);
          }
        }

        const mergedStoryboards = allStoryboards.map((newSb) => {
          const sceneId = newSb.sceneId as string;
          const seqNum = newSb.sequenceNumber as number;
          const key = sceneId && seqNum ? `${sceneId}:${seqNum}` : null;
          const existingSb = key ? storyboardMap.get(key) : undefined;

          if (existingSb) {
            return {
              ...newSb,
              id: existingSb.id || newSb.id,
              images: existingSb.images || newSb.images,
              mainImageId: existingSb.mainImageId || newSb.mainImageId,
              videoUrl: existingSb.videoUrl || newSb.videoUrl,
              videoGeneration:
                existingSb.videoGeneration || newSb.videoGeneration,
              referenceImages:
                existingSb.referenceImages || newSb.referenceImages,
              mode: existingSb.mode || newSb.mode,
              videoMode: existingSb.videoMode || newSb.videoMode,
              updatedAt: new Date().toISOString(),
            };
          }
          return newSb;
        });
        content.storyboards = mergedStoryboards;

        freshScript.content = content;
        await this.scriptRepository.save(freshScript);

        this.logger.log(
          `分镜批量生成保存完成: taskId=${taskId}, 新生成=${newShotGroups.length}, 合并后=${mergedShotGroups.length}, shotGroups 数量=${mergedShotGroups.length}`,
        );
      });

      // 5. 更新任务完成
      await this.updateTaskStatus(taskId, AITaskStatus.COMPLETED, {
        result: { storyboardCount: allStoryboards.length },
      });

      // 6. 推送完成事件
      await this.webSocketService.broadcastTaskProgress(taskId, {
        type: "storyboard:generate-done",
        taskId,
        scriptId,
        storyboards: allStoryboards,
        progress: 100,
        timestamp: new Date().toISOString(),
      });

      // 确认额度扣减
      try {
        await this.textGenQuotaService.confirmDeduct(taskId, totalTokensUsed);
      } catch (confirmError) {
        this.logger.warn(`确认额度扣减失败: taskId=${taskId}`, confirmError instanceof Error ? confirmError.message : undefined);
      }

      this.logger.log(
        `分镜批量生成完成: taskId=${taskId}, count=${allStoryboards.length}`,
      );
    } catch (error) {
      const errorMessage = (error as Error).message || "未知错误";
      this.logger.error(`一键分镜生成任务失败: ${taskId}`);
      this.logger.debug(`详细错误信息: ${errorMessage}`);

      // 返还额度（任务失败时全额返还）
      try {
        await this.textGenQuotaService.refund(taskId, `分镜生成失败: ${errorMessage}`);
      } catch (refundError) {
        this.logger.warn(`返还额度失败: taskId=${taskId}`, refundError instanceof Error ? refundError.message : undefined);
      }

      // 更新任务状态为失败（脱敏处理）
      await this.updateTaskStatus(taskId, AITaskStatus.FAILED, {
        error: "分镜生成失败，请稍后重试",
      });

      // 推送失败事件（脱敏处理，不暴露原始错误信息）
      try {
        await this.webSocketService.broadcastTaskProgress(taskId, {
          type: "storyboard:generate-failed",
          taskId,
          scriptId,
          status: "failed",
          error: {
            code: "STORYBOARD_GENERATION_FAILED",
            message: "分镜生成失败，请稍后重试",
            recoverable: true,
          },
          timestamp: new Date().toISOString(),
        });
      } catch (wsErr) {
        this.logger.warn(
          `推送分镜生成失败事件出错: ${(wsErr as Error).message}`,
        );
      }

      throw error;
    }
  }

  /**
   * 广播视频生成进度
   */
  private async broadcastVideoProgress({
    taskId,
    scriptId,
    storyboardId,
    status,
    progress,
    result,
    error,
  }: {
    taskId: string;
    scriptId: string;
    storyboardId: string;
    status: "pending" | "processing" | "completed" | "failed";
    progress?: number;
    result?: { videoUrl: string };
    error?: { code: string; message: string; recoverable: boolean };
  }): Promise<void> {
    try {
      await this.webSocketService.broadcastTaskProgress(taskId, {
        type: "asset:video-progress",
        taskId,
        scriptId,
        storyboardId,
        status,
        progress,
        result,
        error,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      this.logger.warn(`广播视频进度失败: ${(err as Error).message}`);
    }
  }

  /**
   * 广播图片生成进度
   */
  private async broadcastImageProgress({
    taskId,
    scriptId,
    refId,
    status,
    progress,
    result,
    error,
  }: {
    taskId: string;
    scriptId: string;
    refId: string;
    status: "pending" | "processing" | "completed" | "failed";
    progress?: number;
    result?: { imageId: string; url: string; thumbnailUrl: string };
    error?: { code: string; message: string; recoverable: boolean };
  }): Promise<void> {
    this.logger.log(
      `[broadcastImageProgress] 开始广播: taskId=${taskId}, status=${status}, refId=${refId}`,
    );
    try {
      await this.webSocketService.broadcastTaskProgress(taskId, {
        type: "asset:image-progress",
        taskId,
        scriptId,
        refId,
        status,
        progress,
        result,
        error,
        timestamp: new Date().toISOString(),
      });
      this.logger.log(
        `[broadcastImageProgress] 广播成功: taskId=${taskId}, status=${status}`,
      );
    } catch (err) {
      this.logger.warn(`广播图片进度失败: ${(err as Error).message}`);
    }
  }

  /**
   * 合并 shots，保留已有数据（简化版 Shot）
   */
  private mergeShots(
    newShots: Array<Record<string, unknown>>,
    existingShots: Array<Record<string, unknown>>,
  ): Array<Record<string, unknown>> {
    if (existingShots.length === 0) {
      return newShots;
    }

    // 使用 dialogueId 作为匹配键
    const existingShotMap = new Map<string, Record<string, unknown>>();
    for (const shot of existingShots) {
      const dialogueId = shot.dialogueId as string;
      if (dialogueId) {
        existingShotMap.set(dialogueId, shot);
      }
    }

    return newShots.map((newShot) => {
      const dialogueId = newShot.dialogueId as string;
      const existingShot = dialogueId
        ? existingShotMap.get(dialogueId)
        : undefined;

      if (existingShot) {
        return {
          ...newShot,
          videoUrl: existingShot.videoUrl || newShot.videoUrl,
          status: existingShot.status || newShot.status,
          taskId: existingShot.taskId || newShot.taskId,
        };
      }
      return newShot;
    });
  }

  /**
   * 更新任务状态
   */
  private async updateTaskStatus(
    taskId: string,
    status: AITaskStatusType,
    additionalData?: Record<string, unknown>,
  ): Promise<void> {
    const updateData: Partial<AITask> = {
      status,
    };

    if (status === AITaskStatus.PROCESSING) {
      updateData.startedAt = new Date();
    }

    if (status === AITaskStatus.COMPLETED || status === AITaskStatus.FAILED) {
      updateData.completedAt = new Date();
    }

    if (additionalData) {
      if (additionalData.result) {
        updateData.result = additionalData.result as Record<string, unknown>;
      }
      if (additionalData.tokensUsed) {
        updateData.progress = 100;
      }
      if (additionalData.error) {
        updateData.error = additionalData.error as string;
      }
    }

    // 使用 query builder 避免类型问题
    const updateFields: Record<string, unknown> = {};
    if (updateData.status !== undefined)
      updateFields.status = updateData.status;
    if (updateData.startedAt !== undefined)
      updateFields.startedAt = updateData.startedAt;
    if (updateData.completedAt !== undefined)
      updateFields.completedAt = updateData.completedAt;
    if (updateData.result !== undefined)
      updateFields.result = updateData.result;
    if (updateData.progress !== undefined)
      updateFields.progress = updateData.progress;
    if (updateData.error !== undefined) updateFields.error = updateData.error;

    await this.aiTaskRepository
      .createQueryBuilder()
      .update()
      .set(updateFields)
      .where("id = :taskId", { taskId })
      .execute();
  }

  /**
   * 队列失败处理
   */
  @OnWorkerEvent("failed")
  async onFailed(job: Job, error: Error): Promise<void> {
    this.logger.error(`剧本生成任务 ${job.id} 失败`);
    this.logger.debug("详细错误信息:", error);

    const { taskId } = job.data;

    // 更新任务状态
    await this.aiTaskRepository.update(
      { id: taskId },
      {
        status: AITaskStatus.FAILED,
        completedAt: new Date(),
        error: "处理失败",
      },
    );
  }

  /**
   * 广播任务进度
   */
  private async broadcastProgress({
    taskId,
    scriptId,
    status,
    progress,
    result,
    error,
  }: {
    taskId: string;
    scriptId: string;
    status: "started" | "streaming" | "completed" | "failed";
    progress?: number;
    result?: { title?: string; description?: string };
    error?: { code: string; message: string; recoverable: boolean };
  }): Promise<void> {
    try {
      await this.webSocketService.broadcastTaskProgress(taskId, {
        type: "script:generate-progress",
        taskId,
        scriptId,
        taskType: "generate",
        status,
        progress,
        result,
        error,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      this.logger.warn(`广播进度失败: ${(err as Error).message}`);
    }
  }
}

// 导入类型
type AITaskStatusType = (typeof AITaskStatus)[keyof typeof AITaskStatus];
