/**
 * 图片生成 Worker 服务
 * 处理 BullMQ 队列中的图片生成任务
 */
import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import {
  ImageGenerationTaskEntity,
  ImageGenerationResultEntity,
  ImageGenTaskStatus,
} from "../entities";
import { ImageStorageService } from "./image-storage.service";
import { ImageGenerationCostService } from "./image-generation-cost.service";
import { OpenAICompatibleProvider } from "../../ai/providers/openai-compatible.provider";
import { ImageGenGateway } from "../gateways/image-gen.gateway";
// 资产实体（用于图片生成完成后自动回链）
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

interface ImageGenJobData {
  taskId: string;
  projectId: string;
  userId: string;
  type: "text_to_image" | "image_to_image" | "batch_generation";
  sceneType: string;
  config: {
    modelId: string;
    providerId?: string;
    textConfig?: {
      prompt: string;
      negativePrompt?: string;
      width: number;
      height: number;
      quality?: string;
      imageSize?: string;
      style?: string;
      parameters?: Record<string, unknown>;
    };
    imageConfig?: {
      referenceImageUrl: string;
      prompt: string;
      negativePrompt?: string;
      strength: number;
      width?: number;
      height?: number;
      quality?: string;
      imageSize?: string;
      parameters?: Record<string, unknown>;
    };
    batchConfig?: {
      basePrompt: string;
      negativePrompt?: string;
      width: number;
      height: number;
      style?: string;
      shareSeed: boolean;
      baseSeed?: number;
      quality?: string;
      imageSize?: string;
      items: Array<{
        index: number;
        type: string;
        promptSuffix: string;
      }>;
    };
  };
  resultIds: string[];
}

/**
 * 图片生成 Worker
 * 使用 BullMQ 处理队列任务
 */
@Injectable()
@Processor("ai-image", { concurrency: 3 })
export class ImageGenerationWorkerService extends WorkerHost {
  private readonly logger = new Logger(ImageGenerationWorkerService.name);

  constructor(
    @InjectRepository(ImageGenerationTaskEntity)
    private readonly taskRepository: Repository<ImageGenerationTaskEntity>,
    @InjectRepository(ImageGenerationResultEntity)
    private readonly resultRepository: Repository<ImageGenerationResultEntity>,
    // 资产仓储（用于图片生成完成后自动回链）
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
    private readonly storageService: ImageStorageService,
    private readonly costService: ImageGenerationCostService,
    private readonly aiProvider: OpenAICompatibleProvider,
    private readonly imageGenGateway: ImageGenGateway,
  ) {
    super();
  }

  /**
   * 处理图片生成任务
   */
  async process(job: Job<ImageGenJobData>): Promise<void> {
    const { taskId, userId, projectId, type, config, resultIds } = job.data;

    this.logger.log(`开始处理图片生成任务: ${taskId}, 类型: ${type}`);

    try {
      // 1. 推送任务开始状态
      // 延迟 300ms 推送第一条消息，给前端足够时间建立 WebSocket 订阅
      // 避免竞态条件：worker 推送进度时前端 handler 还未注册
      await new Promise((resolve) => setTimeout(resolve, 300));
      await this.pushProgress(userId, taskId, projectId, "processing", {
        percentage: 0,
        currentStep: "queued",
        completed: 0,
        total:
          type === "batch_generation" ? config.batchConfig!.items.length : 1,
        failed: 0,
      });

      // 2. 更新任务状态为生成中
      await this.updateTaskStatus(taskId, "generating");

      // 3. 推送生成中状态（5%）
      // 等待 600ms 确保超过频率控制间隔（500ms）
      await new Promise((resolve) => setTimeout(resolve, 600));
      await this.pushProgress(userId, taskId, projectId, "processing", {
        percentage: 10,
        currentStep: "generating",
        completed: 0,
        total:
          type === "batch_generation" ? config.batchConfig!.items.length : 1,
        failed: 0,
      });

      // 推送 30% 进度
      await new Promise((resolve) => setTimeout(resolve, 600));
      await this.pushProgress(userId, taskId, projectId, "processing", {
        percentage: 30,
        currentStep: "processing",
        completed: 0,
        total:
          type === "batch_generation" ? config.batchConfig!.items.length : 1,
        failed: 0,
      });

      // 推送 60% 进度
      await new Promise((resolve) => setTimeout(resolve, 600));
      await this.pushProgress(userId, taskId, projectId, "processing", {
        percentage: 60,
        currentStep: "processing",
        completed: 0,
        total:
          type === "batch_generation" ? config.batchConfig!.items.length : 1,
        failed: 0,
      });

      // 推送 80% 进度
      await new Promise((resolve) => setTimeout(resolve, 600));
      await this.pushProgress(userId, taskId, projectId, "processing", {
        percentage: 80,
        currentStep: "finalizing",
        completed: 0,
        total:
          type === "batch_generation" ? config.batchConfig!.items.length : 1,
        failed: 0,
      });

      // 4. 根据任务类型执行生成
      if (type === "text_to_image") {
        await this.generateTextToImage(job.data);
      } else if (type === "image_to_image") {
        await this.generateImageToImage(job.data);
      } else if (type === "batch_generation") {
        await this.generateBatchWithProgress(job.data);
      }

      // 5. 更新任务状态为完成
      await this.finalizeTask(taskId, "completed");

      // 6. 将生成的图片回链到资产（角色/场景/道具）
      await this.linkGeneratedImagesToAsset(taskId, userId);

      // 7. 推送任务完成
      await this.imageGenGateway.pushComplete(userId, taskId, {
        taskId,
        projectId,
      });

      this.logger.log(`图片生成任务完成: ${taskId}`);
    } catch (error) {
      const errorMessage = (error as Error).message || "未知错误";
      this.logger.error(`图片生成任务失败: ${taskId}`);
      this.logger.debug(`详细错误信息: ${errorMessage}`);
      await this.handleTaskError(taskId, error as Error);

      // 推送任务失败（脱敏处理）
      await this.imageGenGateway.pushFailed(userId, taskId, {
        taskId,
        projectId,
        errorCode: 4001,
        errorMessage: "图片生成失败，请稍后重试",
        retryable: true,
      });

      throw error;
    }
  }

  /**
   * 文生图生成
   */
  private async generateTextToImage(data: ImageGenJobData): Promise<void> {
    const { taskId, projectId, config, resultIds } = data;
    const textConfig = config.textConfig!;

    this.logger.debug(
      `文生图生成: prompt=${textConfig.prompt.substring(0, 50)}...`,
    );

    // 从 parameters 中提取参考图列表
    const referenceImages = textConfig.parameters?.referenceImages as string[] | undefined;
    if (referenceImages && referenceImages.length > 0) {
      this.logger.debug(`文生图携带参考图: count=${referenceImages.length}`);
    }

    // 调用 Provider 生成图片
    const result = await this.aiProvider.generateImage(
      {
        prompt: textConfig.prompt,
        negativePrompt: textConfig.negativePrompt,
        width: textConfig.width,
        height: textConfig.height,
        quality: textConfig.quality,
        aspectRatio: textConfig.imageSize,
        style: textConfig.style,
        referenceImages,
      },
      config.modelId,
      config.providerId,
    );

    // 下载图片并上传到 OSS
    const imageBuffer = await this.downloadImage(result.imageUrl);
    const uploadedImage = await this.storageService.uploadImage(imageBuffer, {
      projectId,
      taskId,
      index: 0,
      format: "png",
    });

    // 更新结果记录
    await this.updateResultSuccess(resultIds[0], uploadedImage);
  }

  /**
   * 图生图生成
   */
  private async generateImageToImage(data: ImageGenJobData): Promise<void> {
    const { taskId, projectId, config, resultIds } = data;
    const imageConfig = config.imageConfig!;

    this.logger.debug(`图生图生成: reference=${imageConfig.referenceImageUrl}`);

    // 从 parameters 中提取额外参考图列表（除 referenceImageUrl 外）
    const extraReferenceImages = imageConfig.parameters?.referenceImages as string[] | undefined;
    const referenceImages: string[] = [imageConfig.referenceImageUrl];
    if (extraReferenceImages && extraReferenceImages.length > 0) {
      extraReferenceImages.forEach((url) => {
        if (url !== imageConfig.referenceImageUrl) {
          referenceImages.push(url);
        }
      });
      this.logger.debug(`图生图携带参考图: count=${referenceImages.length}`);
    }

    // 调用 Provider 生成图片
    const result = await this.aiProvider.generateImage(
      {
        prompt: imageConfig.prompt,
        negativePrompt: imageConfig.negativePrompt,
        width: imageConfig.width || 1024,
        height: imageConfig.height || 1024,
        quality: imageConfig.quality,
        aspectRatio: imageConfig.imageSize,
        referenceImages,
      },
      config.modelId,
      config.providerId,
    );

    // 下载图片并上传到 OSS
    const imageBuffer = await this.downloadImage(result.imageUrl);
    const uploadedImage = await this.storageService.uploadImage(imageBuffer, {
      projectId,
      taskId,
      index: 0,
      format: "png",
    });

    // 更新结果记录
    await this.updateResultSuccess(resultIds[0], uploadedImage);
  }

  /**
   * 批量生成（带进度推送）
   */
  private async generateBatchWithProgress(
    data: ImageGenJobData,
  ): Promise<void> {
    const { taskId, userId, projectId, config, resultIds } = data;
    const batchConfig = config.batchConfig!;
    const total = batchConfig.items.length;

    this.logger.debug(`批量生成: ${total} 张图片`);

    let completedCount = 0;
    let failedCount = 0;

    // 串行生成图片（便于控制进度推送）
    for (let i = 0; i < batchConfig.items.length; i++) {
      const item = batchConfig.items[i];
      const prompt = `${batchConfig.basePrompt}, ${item.promptSuffix}`;

      try {
        // 推送单张开始
        await this.pushProgress(userId, taskId, projectId, "processing", {
          percentage: Math.round((i / total) * 100),
          currentStep: `generating_${i + 1}_of_${total}`,
          completed: completedCount,
          total,
          failed: failedCount,
        });

        // 调用 Provider 生成图片
        const result = await this.aiProvider.generateImage(
          {
            prompt,
            negativePrompt: batchConfig.negativePrompt,
            width: batchConfig.width,
            height: batchConfig.height,
            quality: batchConfig.quality,
            aspectRatio: batchConfig.imageSize,
          },
          config.modelId,
          config.providerId,
        );

        // 下载图片并上传到 OSS
        const imageBuffer = await this.downloadImage(result.imageUrl);
        const uploadedImage = await this.storageService.uploadImage(
          imageBuffer,
          {
            projectId,
            taskId,
            index: item.index,
            format: "png",
          },
        );

        // 更新结果记录
        await this.updateResultSuccess(resultIds[i], uploadedImage);
        completedCount++;

        // 推送单张完成
        await this.pushProgress(userId, taskId, projectId, "processing", {
          percentage: Math.round(((i + 1) / total) * 100),
          currentStep: `completed_${i + 1}_of_${total}`,
          completed: completedCount,
          total,
          failed: failedCount,
        });

        this.logger.debug(`批量生成进度: ${i + 1}/${total}`);
      } catch (error) {
        this.logger.error(`批量生成单张失败: index=${item.index}`, error);
        await this.updateResultFailure(resultIds[i], "生成失败");
        failedCount++;

        // 推送单张失败
        await this.pushProgress(userId, taskId, projectId, "processing", {
          percentage: Math.round(((i + 1) / total) * 100),
          currentStep: `failed_${i + 1}_of_${total}`,
          completed: completedCount + failedCount,
          total,
          failed: failedCount,
        });
      }

      // 更新任务进度到数据库
      await this.updateTaskProgress(taskId, failedCount > 0);
    }

    // 检查是否有部分失败
    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ["results"],
    });

    if (task && task.results) {
      const finalFailedCount = task.results.filter(
        (r) => r.status === "failed",
      ).length;
      const finalSuccessCount = task.results.filter(
        (r) => r.status === "success",
      ).length;

      if (finalFailedCount > 0 && finalSuccessCount > 0) {
        // 部分失败
        await this.finalizeTask(taskId, "partial_failed");
      } else if (finalFailedCount > 0 && finalSuccessCount === 0) {
        // 全部失败
        await this.finalizeTask(taskId, "failed");
      }
    }
  }

  /**
   * 推送进度消息
   */
  private async pushProgress(
    userId: string,
    taskId: string,
    projectId: string,
    status: "pending" | "processing" | "completed" | "failed",
    progress: {
      percentage: number;
      currentStep: string;
      completed: number;
      total: number;
      failed: number;
    },
  ): Promise<void> {
    await this.imageGenGateway.pushProgress(userId, taskId, {
      taskId,
      projectId,
      status,
      progress,
      currentStep: progress.currentStep,
      message: `${progress.completed}/${progress.total} (${progress.percentage}%)`,
    });
  }

  /**
   * 下载图片
   */
  private async downloadImage(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `下载图片失败: ${response.status} ${response.statusText}`,
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * 更新任务状态
   */
  private async updateTaskStatus(
    taskId: string,
    status: ImageGenTaskStatus,
  ): Promise<void> {
    const updateData: Record<string, unknown> = { status };

    if (status === "generating") {
      updateData.startedAt = new Date();
    }

    await this.taskRepository.update(taskId, updateData);
  }

  /**
   * 更新任务进度
   */
  private async updateTaskProgress(
    taskId: string,
    isFailure: boolean = false,
  ): Promise<void> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ["results"],
    });

    if (!task) return;

    const completed =
      task.results?.filter((r) => r.status === "success").length || 0;
    const failed =
      task.results?.filter((r) => r.status === "failed").length || 0;
    const total = task.progress.total;

    task.progress = {
      ...task.progress,
      completed,
      failed,
      percentage: Math.round(((completed + failed) / total) * 100),
    };

    await this.taskRepository.save(task);
  }

  /**
   * 更新结果为成功
   */
  private async updateResultSuccess(
    resultId: string,
    imageInfo: {
      url: string;
      thumbnailUrl: string;
      width: number;
      height: number;
      format: string;
      size: number;
    },
  ): Promise<void> {
    await this.resultRepository.update(resultId, {
      status: "success",
      image: imageInfo,
      completedAt: new Date(),
    });
  }

  /**
   * 更新结果为失败
   */
  private async updateResultFailure(
    resultId: string,
    errorMessage: string,
  ): Promise<void> {
    await this.resultRepository.update(resultId, {
      status: "failed",
      error: { code: 4001, message: errorMessage || "处理失败" },
      completedAt: new Date(),
    });
  }

  /**
   * 完成任务
   */
  private async finalizeTask(
    taskId: string,
    status: ImageGenTaskStatus,
  ): Promise<void> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ["results"],
    });

    if (!task) return;

    // 计算实际成本
    const successCount =
      task.results?.filter((r) => r.status === "success").length || 0;
    const singleImageCost = this.costService.getSingleImageCost();
    const actualCost = successCount * singleImageCost;

    // 更新任务
    await this.taskRepository.update(taskId, {
      status,
      completedAt: new Date(),
      cost: {
        ...task.cost,
        actualCost,
      },
    });

    // 返还多余额度
    if (actualCost < task.cost.estimatedCost) {
      const refundAmount = task.cost.estimatedCost - actualCost;
      await this.costService.refundQuota(
        task.createdBy,
        task.projectId,
        refundAmount,
      );
    }
  }

  /**
   * 处理任务错误
   */
  private async handleTaskError(taskId: string, error: Error): Promise<void> {
    await this.taskRepository.update(taskId, {
      status: "failed",
      error: {
        code: 4001,
        message: "处理失败",
      },
      completedAt: new Date(),
    });

    // 返还全部额度
    const task = await this.taskRepository.findOne({ where: { id: taskId } });
    if (task) {
      await this.costService.refundQuota(
        task.createdBy,
        task.projectId,
        task.cost.estimatedCost,
      );
    }
  }

  /**
   * 图片生成完成后，将图片回链到资产（角色/场景/道具）
   * 读取任务 config.parameters 中的 assetType/assetId/imageType
   */
  private async linkGeneratedImagesToAsset(
    taskId: string,
    userId: string,
  ): Promise<void> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ["results"],
    });
    if (!task) return;

    // 从任务配置中提取资产上下文
    // parameters 可能存储在三个位置：顶层 config.parameters、textConfig.parameters 或 imageConfig.parameters
    const rawConfig = task.config as unknown as Record<string, unknown>;
    const params = (rawConfig?.parameters ??
      (rawConfig?.textConfig as Record<string, unknown>)?.parameters ??
      (rawConfig?.imageConfig as Record<string, unknown>)?.parameters) as
      | Record<string, string>
      | undefined;
    if (!params?.assetType || !params?.assetId) return;

    const { assetType, assetId, imageType } = params;

    // 获取所有成功的生成结果
    const successResults =
      task.results?.filter((r) => r.status === "success") || [];
    if (successResults.length === 0) return;

    this.logger.log(
      `开始回链图片到资产: assetType=${assetType}, assetId=${assetId}, count=${successResults.length}`,
    );

    try {
      if (assetType === "character") {
        await this.linkImagesToCharacter(assetId, successResults, imageType);
      } else if (assetType === "scene") {
        await this.linkImagesToScene(assetId, successResults, imageType);
      } else if (assetType === "prop") {
        await this.linkImagesToProp(assetId, successResults, imageType);
      }
    } catch (error) {
      this.logger.error(
        `回链图片到资产失败: assetType=${assetType}, assetId=${assetId}`,
        error,
      );
      // 不抛出异常，避免影响主流程
    }
  }

  /**
   * 将图片回链到角色
   */
  private async linkImagesToCharacter(
    characterId: string,
    results: ImageGenerationResultEntity[],
    defaultImageType?: string,
  ): Promise<void> {
    // 确保角色存在
    const character = await this.characterRepository.findOne({
      where: { id: characterId },
    });
    if (!character) {
      this.logger.warn(`角色不存在，跳过回链: ${characterId}`);
      return;
    }

    for (const result of results) {
      const r = result as unknown as { type?: string; image?: Record<string, unknown> };
      if (!r.image?.url) continue;

      // 确定图片类型：优先使用 result.type（batch 任务中的类型），其次使用 defaultImageType
      const type =
        r.type !== "additional"
          ? (r.type as string)
          : (defaultImageType || "front_view");

      // 将之前的当前版本设为 false
      await this.characterImageRepository.update(
        { characterId, type, isCurrent: true } as Record<string, unknown>,
        { isCurrent: false },
      );

      // 创建新的图片记录
      await this.characterImageRepository.insert({
        characterId,
        type,
        url: r.image.url as string,
        thumbnailUrl: (r.image.thumbnailUrl as string) || null,
        generationInfo: {
          prompt: (r.image.generationParams as Record<string, unknown>)
            ?.prompt,
          modelId: "ai-image",
          generatedAt: new Date().toISOString(),
        },
        version: 1,
        isCurrent: true,
      } as any);
    }

    // 如果角色是 draft 状态，自动设为 active
    if (character.status === "draft") {
      await this.characterRepository.update(characterId, {
        status: "active",
      });
    }

    this.logger.log(`已回链 ${results.length} 张图片到角色: ${characterId}`);
  }

  /**
   * 将图片回链到场景
   */
  private async linkImagesToScene(
    sceneId: string,
    results: ImageGenerationResultEntity[],
    defaultImageType?: string,
  ): Promise<void> {
    const scene = await this.sceneRepository.findOne({
      where: { id: sceneId },
    });
    if (!scene) {
      this.logger.warn(`场景不存在，跳过回链: ${sceneId}`);
      return;
    }

    for (const result of results) {
      const r = result as unknown as { type?: string; image?: Record<string, unknown> };
      if (!r.image?.url) continue;

      const type =
        r.type !== "additional"
          ? (r.type as string)
          : (defaultImageType || "panorama");

      const where: Record<string, unknown> = {
        sceneId,
        type,
        isCurrent: true,
      };
      await this.sceneImageRepository.update(where, { isCurrent: false });

      await this.sceneImageRepository.insert({
        sceneId,
        type,
        variantType: null,
        variantValue: null,
        url: r.image.url as string,
        thumbnailUrl: (r.image.thumbnailUrl as string) || null,
        generationInfo: {
          prompt: (r.image.generationParams as Record<string, unknown>)
            ?.prompt,
          modelId: "ai-image",
          generatedAt: new Date().toISOString(),
        },
        version: 1,
        isCurrent: true,
      } as any);
    }

    if (scene.status === "draft") {
      await this.sceneRepository.update(sceneId, { status: "active" });
    }

    this.logger.log(`已回链 ${results.length} 张图片到场景: ${sceneId}`);
  }

  /**
   * 将图片回链到道具
   */
  private async linkImagesToProp(
    propId: string,
    results: ImageGenerationResultEntity[],
    defaultImageType?: string,
  ): Promise<void> {
    const prop = await this.propRepository.findOne({
      where: { id: propId },
    });
    if (!prop) {
      this.logger.warn(`道具不存在，跳过回链: ${propId}`);
      return;
    }

    for (const result of results) {
      const r = result as unknown as { type?: string; image?: Record<string, unknown> };
      if (!r.image?.url) continue;

      const type =
        r.type !== "additional"
          ? (r.type as string)
          : (defaultImageType || "front_view");

      await this.propImageRepository.update(
        { propId, type, isCurrent: true } as Record<string, unknown>,
        { isCurrent: false },
      );

      await this.propImageRepository.insert({
        propId,
        type,
        url: r.image.url as string,
        thumbnailUrl: (r.image.thumbnailUrl as string) || null,
        generationInfo: {
          prompt: (r.image.generationParams as Record<string, unknown>)
            ?.prompt,
          modelId: "ai-image",
          generatedAt: new Date().toISOString(),
        },
        version: 1,
        isCurrent: true,
      } as any);
    }

    if (prop.status === "draft") {
      await this.propRepository.update(propId, { status: "active" });
    }

    this.logger.log(`已回链 ${results.length} 张图片到道具: ${propId}`);
  }
}
