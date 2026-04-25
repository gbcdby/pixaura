/**
 * 图片生成服务
 * 核心业务逻辑：任务创建、生成流程、结果管理
 */
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import {
  ImageGenTaskStatus,
  ImageGenTaskType,
  ImageGenerationTaskEntity,
  ImageGenerationResultEntity,
  BatchItem,
} from "../entities";
import { ImageGenerationTaskRepository } from "../repositories";
import { ImageGenerationResultRepository } from "../repositories";
import { ImageGenerationCostService } from "./image-generation-cost.service";
import { ImageStorageService } from "./image-storage.service";
import {
  CreateTextToImageTaskDto,
  CreateImageToImageTaskDto,
  CreateBatchImageGenDto,
  CreateImageGenerationTaskDto,
  RegenerateImageDto,
  ImageGenTaskDetailDto,
  ImageGenResultDto,
  ImageGenProgress,
} from "@pixaura/shared-types";
import { ImageGenGateway } from "../gateways/image-gen.gateway";
import { ModelService } from "../../model-config/services/model.service";

@Injectable()
export class ImageGenerationService {
  private readonly logger = new Logger(ImageGenerationService.name);

  constructor(
    private taskRepo: ImageGenerationTaskRepository,
    private resultRepo: ImageGenerationResultRepository,
    private costService: ImageGenerationCostService,
    private storageService: ImageStorageService,
    @InjectQueue("ai-image") private imageQueue: Queue,
    private imageGenGateway: ImageGenGateway,
    private readonly modelService: ModelService,
  ) {}

  /**
   * 创建统一图像生成任务
   * 当 dto.config.referenceImageUrl 存在时使用图生图逻辑，否则使用文生图逻辑
   */
  async createImageGenerationTask(
    userId: string,
    dto: CreateImageGenerationTaskDto,
  ): Promise<{
    taskId: string;
    status: ImageGenTaskStatus;
    estimatedCost: number;
    estimatedTime: number;
  }> {
    const hasReferenceImage = !!dto.config.referenceImageUrl;
    const taskType = hasReferenceImage ? "image_to_image" : "text_to_image";

    // 计算成本
    const cost = this.costService.calculateEstimatedCost(taskType, 1);

    // 检查额度
    const hasQuota = await this.costService.reserveQuota(
      userId,
      dto.projectId,
      cost.estimatedCost,
    );
    if (!hasQuota) {
      throw new BadRequestException("额度不足");
    }

    // 检查队列深度
    const queueLength = await this.imageQueue.getWaitingCount();
    if (queueLength >= 1000) {
      throw new BadRequestException("生成队列已满，请稍后重试");
    }

    // 从模型配置中读取图片参数
    const model = await this.modelService.findById(dto.config.modelId);
    const modelDefaultParams =
      (model?.defaultParams as Record<string, unknown> | undefined) ?? {};
    const quality = modelDefaultParams.quality as string | undefined;
    const imageSize = modelDefaultParams.image_size as string | undefined;

    // 构建任务配置
    const config: Record<string, unknown> = {
      modelId: dto.config.modelId,
    };

    if (hasReferenceImage) {
      // 图生图配置
      config.imageConfig = {
        referenceImageUrl: dto.config.referenceImageUrl,
        prompt: dto.config.prompt,
        negativePrompt: dto.config.negativePrompt,
        strength: dto.config.strength,
        width: dto.config.width,
        height: dto.config.height,
        style: dto.config.style,
        ...(quality ? { quality } : {}),
        ...(imageSize ? { imageSize } : {}),
      };
    } else {
      // 文生图配置
      config.textConfig = {
        prompt: dto.config.prompt,
        negativePrompt: dto.config.negativePrompt,
        width: dto.config.width,
        height: dto.config.height,
        style: dto.config.style,
        parameters: dto.config.parameters,
        ...(quality ? { quality } : {}),
        ...(imageSize ? { imageSize } : {}),
      };
    }

    // 创建任务
    const task = this.taskRepo.create({
      projectId: dto.projectId,
      createdBy: userId,
      type: taskType,
      sceneType: dto.sceneType,
      config,
      progress: {
        total: 1,
        completed: 0,
        failed: 0,
        currentStep: "pending",
        percentage: 0,
      },
      cost,
      status: "pending",
    });

    await this.taskRepo.save(task);

    // 构建生成参数快照
    const generationParams: Record<string, unknown> = {
      prompt: dto.config.prompt,
      negativePrompt: dto.config.negativePrompt,
      modelId: dto.config.modelId,
      width: dto.config.width,
      height: dto.config.height,
      ...(quality ? { quality } : {}),
    };

    if (hasReferenceImage) {
      generationParams.referenceImageUrl = dto.config.referenceImageUrl;
      generationParams.strength = dto.config.strength;
    }

    // 创建结果记录
    const result = await this.resultRepo.save({
      taskId: task.id,
      index: 0,
      type: "additional",
      generationParams,
      status: "pending",
    });

    // 构建队列任务数据
    const queueJobData: Record<string, unknown> = {
      taskId: task.id,
      projectId: dto.projectId,
      userId,
      type: taskType,
      sceneType: dto.sceneType,
      config,
      resultIds: [result.id],
    };

    // 加入 BullMQ 队列
    await this.imageQueue.add("generate-image", queueJobData, {
      jobId: task.id,
      priority: 50,
    });

    // 更新状态为 queued
    await this.taskRepo.updateStatus(task.id, "queued");
    task.status = "queued";

    // 发送 WebSocket 通知
    if (dto.notifyWs) {
      this.emitProgressUpdate(task);
    }

    return {
      taskId: task.id,
      status: task.status,
      estimatedCost: cost.estimatedCost,
      estimatedTime: 30, // 预估 30 秒
    };
  }

  /**
   * @deprecated 使用 createImageGenerationTask 替代
   * 创建文生图任务
   */
  async createTextToImageTask(
    userId: string,
    dto: CreateTextToImageTaskDto,
  ): Promise<{
    taskId: string;
    status: ImageGenTaskStatus;
    estimatedCost: number;
    estimatedTime: number;
  }> {
    return this.createImageGenerationTask(userId, dto);
  }

  /**
   * @deprecated 使用 createImageGenerationTask 替代
   * 创建图生图任务
   */
  async createImageToImageTask(
    userId: string,
    dto: CreateImageToImageTaskDto,
  ): Promise<{
    taskId: string;
    status: ImageGenTaskStatus;
    estimatedCost: number;
    estimatedTime: number;
  }> {
    return this.createImageGenerationTask(userId, dto);
  }

  /**
   * 创建批量生成任务
   */
  async createBatchTask(
    userId: string,
    dto: CreateBatchImageGenDto,
  ): Promise<{
    taskId: string;
    status: ImageGenTaskStatus;
    batchCount: number;
    estimatedCost: number;
    estimatedTime: number;
  }> {
    const batchCount = dto.config.items.length;

    // 计算成本
    const cost = this.costService.calculateEstimatedCost(
      "batch_generation",
      batchCount,
    );

    // 检查额度
    const hasQuota = await this.costService.reserveQuota(
      userId,
      dto.projectId,
      cost.estimatedCost,
    );
    if (!hasQuota) {
      throw new BadRequestException("额度不足");
    }

    // 从模型配置中读取图片参数
    const model = await this.modelService.findById(dto.config.modelId || "default");
    const modelDefaultParams =
      (model?.defaultParams as Record<string, unknown> | undefined) ?? {};
    const batchQuality = modelDefaultParams.quality as string | undefined;
    const batchImageSize = modelDefaultParams.image_size as string | undefined;

    // 创建任务
    const task = this.taskRepo.create({
      projectId: dto.projectId,
      createdBy: userId,
      type: "batch_generation",
      sceneType: dto.sceneType,
      config: {
        modelId: dto.config.modelId || "default",
        batchConfig: {
          basePrompt: dto.config.basePrompt,
          negativePrompt: dto.config.negativePrompt,
          width: dto.config.width,
          height: dto.config.height,
          style: dto.config.style,
          shareSeed: dto.config.shareSeed,
          baseSeed: dto.config.baseSeed,
          items: dto.config.items,
          ...(batchQuality ? { quality: batchQuality } : {}),
          ...(batchImageSize ? { imageSize: batchImageSize } : {}),
        },
      },
      progress: {
        total: batchCount,
        completed: 0,
        failed: 0,
        currentStep: "pending",
        percentage: 0,
      },
      cost,
      status: "pending",
    });

    await this.taskRepo.save(task);

    // 创建结果记录
    const resultIds: string[] = [];
    for (const item of dto.config.items) {
      const result = await this.resultRepo.save({
        taskId: task.id,
        index: item.index,
        type: item.type,
        generationParams: {
          prompt: `${dto.config.basePrompt}, ${item.promptSuffix}`,
          negativePrompt: dto.config.negativePrompt,
          modelId: dto.config.modelId || "default",
          width: dto.config.width,
          height: dto.config.height,
        },
        status: "pending",
      });
      resultIds.push(result.id);
    }

    // 加入 BullMQ 队列
    await this.imageQueue.add(
      "generate-image",
      {
        taskId: task.id,
        projectId: dto.projectId,
        userId,
        type: "batch_generation",
        sceneType: dto.sceneType,
        config: {
          modelId: dto.config.modelId || "default",
          batchConfig: {
            basePrompt: dto.config.basePrompt,
            negativePrompt: dto.config.negativePrompt,
            width: dto.config.width,
            height: dto.config.height,
            style: dto.config.style,
            shareSeed: dto.config.shareSeed,
            baseSeed: dto.config.baseSeed,
            items: dto.config.items,
            ...(batchQuality ? { quality: batchQuality } : {}),
            ...(batchImageSize ? { imageSize: batchImageSize } : {}),
          },
        },
        resultIds,
      },
      {
        jobId: task.id,
        priority: 50,
      },
    );

    await this.taskRepo.updateStatus(task.id, "queued");
    task.status = "queued";

    // 发送 WebSocket 通知
    if (dto.notifyWs) {
      this.emitProgressUpdate(task);
    }

    return {
      taskId: task.id,
      status: task.status,
      batchCount,
      estimatedCost: cost.estimatedCost,
      estimatedTime: batchCount * 30,
    };
  }

  /**
   * 获取任务详情
   */
  async getTaskDetail(
    taskId: string,
    userId: string,
  ): Promise<ImageGenTaskDetailDto> {
    const task = await this.taskRepo.findByIdWithResults(taskId);

    if (!task) {
      throw new NotFoundException("任务不存在");
    }

    // 检查权限
    if (task.createdBy !== userId) {
      throw new ForbiddenException("无权访问此任务");
    }

    return this.mapToTaskDetailDto(task);
  }

  /**
   * 取消任务
   */
  async cancelTask(
    taskId: string,
    userId: string,
  ): Promise<{ taskId: string; status: string; refundAmount: number }> {
    const task = await this.taskRepo.findByIdWithResults(taskId);

    if (!task) {
      throw new NotFoundException("任务不存在");
    }

    if (task.createdBy !== userId) {
      throw new ForbiddenException("无权操作此任务");
    }

    if (!task.canCancel()) {
      throw new BadRequestException("任务状态不允许取消");
    }

    // 计算返还额度
    const completedCount =
      task.results?.filter((r) => r.status === "success").length || 0;
    const singleImageCost = this.costService.getSingleImageCost();
    const actualCost = completedCount * singleImageCost;
    const refundAmount = Math.max(0, task.cost.estimatedCost - actualCost);

    // 从队列中移除（如果是 queued 状态）
    if (task.status === "queued") {
      const job = await this.imageQueue.getJob(taskId);
      if (job) {
        await job.remove();
      }
    }

    // 更新状态
    await this.taskRepo.updateStatus(taskId, "cancelled");

    // 返还额度
    if (refundAmount > 0) {
      await this.costService.refundQuota(userId, task.projectId, refundAmount);
    }

    // 发送 WebSocket 通知
    this.logger.debug(`任务已取消: ${taskId}`);

    return {
      taskId,
      status: "cancelled",
      refundAmount,
    };
  }

  /**
   * 重新生成单张图片
   */
  async regenerateImage(
    resultId: string,
    userId: string,
    dto: RegenerateImageDto,
  ): Promise<{ newResultId: string; status: ImageGenTaskStatus }> {
    const result = await this.resultRepo.findByIdWithTask(resultId);

    if (!result) {
      throw new NotFoundException("结果不存在");
    }

    if (result.task.createdBy !== userId) {
      throw new ForbiddenException("无权操作此结果");
    }

    if (result.status !== "failed") {
      throw new BadRequestException("只能重新生成失败的结果");
    }

    // 更新结果状态为 pending
    result.status = "pending";
    result.error = null;

    // 应用覆盖配置
    if (dto.overrideConfig) {
      if (dto.overrideConfig.prompt) {
        result.generationParams.prompt = dto.overrideConfig.prompt;
      }
      if (dto.overrideConfig.negativePrompt !== undefined) {
        result.generationParams.negativePrompt =
          dto.overrideConfig.negativePrompt;
      }
      if (dto.overrideConfig.seed !== undefined) {
        result.generationParams.seed = dto.overrideConfig.seed;
      }
    }

    await this.resultRepo.save(result);

    // 更新任务状态为 queued
    await this.taskRepo.updateStatus(result.taskId, "queued");

    // 重新加入 BullMQ 队列
    await this.imageQueue.add(
      "generate-image",
      {
        taskId: result.taskId,
        projectId: result.task.projectId,
        userId: result.task.createdBy,
        type: result.task.type,
        sceneType: result.task.sceneType,
        config: result.task.config,
        resultIds: [result.id],
      },
      {
        jobId: `${result.taskId}_retry_${result.index}`,
        priority: 50,
      },
    );

    return {
      newResultId: result.id,
      status: "queued",
    };
  }

  /**
   * 获取任务列表
   */
  async getTaskList(
    projectId: string,
    userId: string,
    options: {
      page?: number;
      limit?: number;
      status?: ImageGenTaskStatus;
    } = {},
  ): Promise<{ tasks: ImageGenTaskDetailDto[]; total: number }> {
    const { page = 1, limit = 20, status } = options;

    const [tasks, total] = await this.taskRepo.findByProjectId(projectId, {
      status,
      limit,
      offset: (page - 1) * limit,
    });

    return {
      tasks: tasks.map((t) => this.mapToTaskDetailDto(t)),
      total,
    };
  }

  /**
   * 映射为 DTO
   */
  private mapToTaskDetailDto(
    task: ImageGenerationTaskEntity,
  ): ImageGenTaskDetailDto {
    return {
      id: task.id,
      projectId: task.projectId,
      generationTaskId: task.generationTaskId || undefined,
      type: task.type,
      sceneType: task.sceneType,
      status: task.status,
      config: task.config as never,
      progress: task.progress as ImageGenProgress,
      cost: task.cost,
      results: task.results?.map((r) => this.mapToResultDto(r)),
      error: task.error || undefined,
      createdAt: task.createdAt.toISOString(),
      startedAt: task.startedAt?.toISOString(),
      completedAt: task.completedAt?.toISOString(),
    };
  }

  /**
   * 映射结果为 DTO
   */
  private mapToResultDto(
    result: ImageGenerationResultEntity,
  ): ImageGenResultDto {
    return {
      id: result.id,
      index: result.index,
      type: result.type,
      image: result.image,
      generationParams: result.generationParams,
      status: result.status,
      error: result.error || undefined,
      moderation: result.moderation || undefined,
      createdAt: result.createdAt.toISOString(),
      completedAt: result.completedAt?.toISOString(),
    };
  }

  /**
   * 发送进度更新事件
   */
  private emitProgressUpdate(task: ImageGenerationTaskEntity): void {
    this.logger.debug(`任务进度更新: ${task.id}, status=${task.status}`);

    // 推送初始状态到前端，让前端立即感知任务已创建
    // 实际处理进度由 Worker 处理过程中持续推送
    this.imageGenGateway
      .pushProgress(task.createdBy, task.id, {
        taskId: task.id,
        projectId: task.projectId,
        status:
          task.status === "queued" || task.status === "pending"
            ? "pending"
            : "processing",
        progress: {
          percentage: task.progress?.percentage || 0,
          currentStep: task.progress?.currentStep || "pending",
          completed: task.progress?.completed || 0,
          total: task.progress?.total || 1,
          failed: task.progress?.failed || 0,
        },
      })
      .catch((err) => {
        this.logger.warn(
          `推送初始进度失败: ${task.id}, ${err instanceof Error ? err.message : String(err)}`,
        );
      });
  }
}
