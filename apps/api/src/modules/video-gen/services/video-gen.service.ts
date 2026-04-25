import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource, In, IsNull } from "typeorm";
import {
  VideoGenerationTask,
  VideoGenTaskStatus,
} from "../entities/video-generation-task.entity";
import { VideoGenerationOutput } from "../entities/video-generation-output.entity";
import {
  CreateVideoGenTaskDto,
  CreateBatchVideoGenDto,
  RetryVideoGenTaskDto,
  VideoGenTaskDetailDto,
  CreateVideoGenTaskResponseDto,
  CreateBatchVideoGenResponseDto,
  CancelVideoGenTaskResponseDto,
  RetryVideoGenTaskResponseDto,
  BatchTaskItemDto,
  VideoMode,
  ReferenceMode,
  VideoResolution,
  AspectRatio,
} from "../dto";
import {
  VideoGenQuotaService,
  InsufficientQuotaError,
} from "./video-gen-quota.service";

/**
 * 预估成本配置（每分辨率每分钟积分）
 */
const COST_CONFIG: Record<VideoResolution, number> = {
  "480p": 50,
  "720p": 100,
  "1080p": 200,
};

/**
 * 预估时间配置（每分辨率秒数）
 */
const TIME_CONFIG: Record<VideoResolution, number> = {
  "480p": 60,
  "720p": 120,
  "1080p": 180,
};

@Injectable()
export class VideoGenService {
  constructor(
    @InjectRepository(VideoGenerationTask)
    private taskRepository: Repository<VideoGenerationTask>,
    @InjectRepository(VideoGenerationOutput)
    private outputRepository: Repository<VideoGenerationOutput>,
    private dataSource: DataSource,
    private videoGenQuotaService: VideoGenQuotaService,
  ) {}

  /**
   * 提交视频生成任务
   */
  async createTask(
    userId: string,
    dto: CreateVideoGenTaskDto,
  ): Promise<CreateVideoGenTaskResponseDto> {
    // 检查是否已有进行中的任务
    const existingTask = await this.taskRepository.findOne({
      where: {
        shotId: dto.shotId,
        status: In([
          VideoGenTaskStatus.PENDING,
          VideoGenTaskStatus.QUEUED,
          VideoGenTaskStatus.GENERATING,
        ]),
        deletedAt: IsNull(),
      },
    });

    if (existingTask) {
      throw new BadRequestException("该分镜已有进行中的生成任务");
    }

    // 计算预估成本和时间
    const resolution = dto.config.outputConfig.resolution;
    const estimatedCost = this.calculateEstimatedCost(resolution, 5); // 默认5秒
    const estimatedTime = TIME_CONFIG[resolution];

    // 先创建任务记录（用于关联额度记录）
    const task = this.taskRepository.create({
      projectId: dto.projectId,
      shotId: dto.shotId,
      createdBy: userId,
      type: "single",
      config: {
        referenceMode: dto.config.referenceMode,
        videoMode: dto.config.videoMode,
        modelId: dto.config.modelId,
        shotData: dto.config.shotData,
        outputConfig: dto.config.outputConfig,
      },
      progress: {
        currentStep: "",
        percentage: 0,
        steps: this.getDefaultSteps(dto.config.videoMode),
      },
      cost: {
        estimatedCost,
        actualCost: 0,
        currency: "CNY",
      },
      status: VideoGenTaskStatus.PENDING,
    });

    const savedTask = await this.taskRepository.save(task);

    // 预扣减额度
    let quotaRecord;
    try {
      quotaRecord = await this.videoGenQuotaService.preDeduct(
        userId,
        savedTask.id,
        {
          outputConfig: { resolution },
          videoMode: dto.config.videoMode,
          modelId: dto.config.modelId,
        },
        5, // 默认5秒
      );
    } catch (error) {
      // 额度不足时删除已创建的任务
      await this.taskRepository.remove(savedTask);

      if (error instanceof InsufficientQuotaError) {
        throw error;
      }
      throw new BadRequestException("额度检查失败，请稍后重试");
    }

    return {
      taskId: savedTask.id,
      status: savedTask.status,
      estimatedCost,
      estimatedTime,
      steps: this.getStepPreviews(dto.config.videoMode),
      quotaInfo: {
        deducted: quotaRecord.estimatedAmount,
        deductedFrom: quotaRecord.deductedFrom,
        remainingBalance: 0, // TODO: 从 quotaRecord 或 billing 服务获取
      },
    };
  }

  /**
   * 批量提交视频生成任务
   */
  async createBatchTasks(
    userId: string,
    dto: CreateBatchVideoGenDto,
  ): Promise<CreateBatchVideoGenResponseDto> {
    if (dto.shots.length > 10) {
      throw new BadRequestException("单次批量生成最多支持10个分镜");
    }

    // 创建批量任务批次
    const { VideoGenerationBatch } =
      await import("../entities/video-generation-batch.entity");
    const batchRepo = this.dataSource.getRepository(VideoGenerationBatch);

    const batch = await batchRepo.save({
      projectId: dto.projectId,
      createdBy: userId,
      config: {
        totalCount: dto.shots.length,
        commonConfig: dto.commonConfig,
      },
      stats: {
        total: dto.shots.length,
        completed: 0,
        failed: 0,
        pending: dto.shots.length,
      },
      status: "pending",
    });

    const tasks: BatchTaskItemDto[] = [];
    let totalCost = 0;
    let maxEstimatedTime = 0;

    // 先为每个分镜创建任务（用于关联额度记录）
    const taskConfigs: Array<{
      taskId: string;
      config: {
        outputConfig: { resolution: VideoResolution };
        videoMode: VideoMode;
        modelId?: string;
      };
      duration: number;
    }> = [];

    for (const shot of dto.shots) {
      // 合并通用配置
      const config = {
        ...shot.config,
        modelId: shot.config.modelId || dto.commonConfig?.modelId,
        outputConfig: {
          ...dto.commonConfig?.outputConfig,
          ...shot.config.outputConfig,
        },
      };

      // 检查是否已有进行中的任务
      const existingTask = await this.taskRepository.findOne({
        where: {
          shotId: shot.shotId,
          status: In([
            VideoGenTaskStatus.PENDING,
            VideoGenTaskStatus.QUEUED,
            VideoGenTaskStatus.GENERATING,
          ]),
          deletedAt: IsNull(),
        },
      });

      if (existingTask) {
        tasks.push({
          shotId: shot.shotId,
          taskId: existingTask.id,
          status: existingTask.status,
        });
        continue;
      }

      const resolution = config.outputConfig.resolution;
      const estimatedCost = this.calculateEstimatedCost(resolution, 5);
      const estimatedTime = TIME_CONFIG[resolution];

      totalCost += estimatedCost;
      maxEstimatedTime = Math.max(maxEstimatedTime, estimatedTime);

      const task = this.taskRepository.create({
        projectId: dto.projectId,
        shotId: shot.shotId,
        createdBy: userId,
        type: "batch",
        config: {
          referenceMode: config.referenceMode,
          videoMode: config.videoMode,
          modelId: config.modelId,
          shotData: config.shotData,
          outputConfig: config.outputConfig,
        },
        progress: {
          currentStep: "",
          percentage: 0,
          steps: this.getDefaultSteps(config.videoMode),
        },
        cost: {
          estimatedCost,
          actualCost: 0,
          currency: "CNY",
        },
        status: VideoGenTaskStatus.PENDING,
      });

      const savedTask = await this.taskRepository.save(task);
      tasks.push({
        shotId: shot.shotId,
        taskId: savedTask.id,
        status: savedTask.status,
      });

      taskConfigs.push({
        taskId: savedTask.id,
        config: {
          outputConfig: { resolution },
          videoMode: config.videoMode,
          modelId: config.modelId,
        },
        duration: 5,
      });
    }

    // 批量预扣减额度
    let quotaResult;
    try {
      quotaResult = await this.videoGenQuotaService.preDeductBatch(
        userId,
        taskConfigs,
        batch.id,
      );
    } catch (error) {
      // 额度不足时删除已创建的任务
      for (const taskConfig of taskConfigs) {
        const task = await this.taskRepository.findOne({
          where: { id: taskConfig.taskId },
        });
        if (task) {
          await this.taskRepository.remove(task);
        }
      }

      if (error instanceof InsufficientQuotaError) {
        throw error;
      }
      throw new BadRequestException("额度检查失败，请稍后重试");
    }

    return {
      batchId: batch.id,
      tasks,
      totalCost,
      estimatedTime: maxEstimatedTime,
      quotaInfo: {
        totalDeducted: quotaResult.totalEstimated,
        deductedFrom: quotaResult.records[0]?.deductedFrom || "balance",
        remainingBalance: 0, // TODO: 从 billing 服务获取
      },
    };
  }

  /**
   * 获取任务详情
   */
  async findById(
    taskId: string,
    userId?: string,
  ): Promise<VideoGenTaskDetailDto> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId, deletedAt: IsNull() },
      relations: ["outputs"],
    });

    if (!task) {
      throw new NotFoundException("任务不存在");
    }

    if (userId && task.createdBy !== userId) {
      throw new ForbiddenException("无权访问此任务");
    }

    // 获取额度扣减信息
    const quotaInfo = await this.videoGenQuotaService.getQuotaInfo(taskId);

    return this.mapToDetailDto(task, quotaInfo);
  }

  /**
   * 取消任务
   */
  async cancelTask(
    taskId: string,
    userId: string,
  ): Promise<CancelVideoGenTaskResponseDto> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId, deletedAt: IsNull() },
    });

    if (!task) {
      throw new NotFoundException("任务不存在");
    }

    if (task.createdBy !== userId) {
      throw new ForbiddenException("无权操作此任务");
    }

    // 只能取消 pending 或 queued 状态的任务
    const cancellableStatuses: string[] = [
      VideoGenTaskStatus.PENDING,
      VideoGenTaskStatus.QUEUED,
    ];
    if (!cancellableStatuses.includes(task.status)) {
      if (task.status === VideoGenTaskStatus.GENERATING) {
        // generating 状态尝试取消，但不保证成功
        await this.taskRepository.update(taskId, {
          status: VideoGenTaskStatus.CANCELLED,
        });
        return {
          taskId,
          status: "cancelling",
          refundAmount: task.cost.estimatedCost,
          refundStatus: "pending",
        };
      }
      throw new BadRequestException("当前状态的任务无法取消");
    }

    // 更新任务状态
    await this.taskRepository.update(taskId, {
      status: VideoGenTaskStatus.CANCELLED,
    });

    // 返还额度
    let refundAmount = 0;
    let refundStatus: "pending" | "completed" | "failed" = "pending";
    try {
      await this.videoGenQuotaService.refund(taskId, "用户取消任务");
      refundAmount = task.cost.estimatedCost;
      refundStatus = "completed";
    } catch (error) {
      refundStatus = "failed";
      // 记录错误但不影响取消操作
      console.error(`返还额度失败: taskId=${taskId}`, error);
    }

    return {
      taskId,
      status: VideoGenTaskStatus.CANCELLED,
      refundAmount,
      refundStatus,
    };
  }

  /**
   * 重试任务
   */
  async retryTask(
    taskId: string,
    userId: string,
    dto?: RetryVideoGenTaskDto,
  ): Promise<RetryVideoGenTaskResponseDto> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId, deletedAt: IsNull() },
    });

    if (!task) {
      throw new NotFoundException("任务不存在");
    }

    if (task.createdBy !== userId) {
      throw new ForbiddenException("无权操作此任务");
    }

    if (
      task.status !== VideoGenTaskStatus.FAILED &&
      task.status !== VideoGenTaskStatus.CANCELLED
    ) {
      throw new BadRequestException("只有失败或已取消的任务可以重试");
    }

    // 更新配置（如果有覆盖）
    if (dto?.overrideConfig) {
      if (dto.overrideConfig.modelId) {
        task.config.modelId = dto.overrideConfig.modelId;
      }
      if (dto.overrideConfig.outputConfig?.resolution) {
        task.config.outputConfig.resolution =
          dto.overrideConfig.outputConfig.resolution;
      }
    }

    // 重置任务状态
    task.status = VideoGenTaskStatus.PENDING;
    task.error = null;
    task.progress = {
      currentStep: "",
      percentage: 0,
      steps: this.getDefaultSteps(task.config.videoMode),
    };

    await this.taskRepository.save(task);

    return {
      taskId,
      status: VideoGenTaskStatus.PENDING,
      message: "任务已重新提交",
    };
  }

  /**
   * 获取项目的进行中的任务
   */
  async findActiveTasksByProject(
    projectId: string,
  ): Promise<VideoGenTaskDetailDto[]> {
    const tasks = await this.taskRepository.find({
      where: {
        projectId,
        status: In([
          VideoGenTaskStatus.PENDING,
          VideoGenTaskStatus.QUEUED,
          VideoGenTaskStatus.GENERATING,
        ]),
        deletedAt: IsNull(),
      },
      relations: ["outputs"],
      order: { createdAt: "DESC" },
    });

    return tasks.map((task) => this.mapToDetailDto(task));
  }

  /**
   * 计算预估成本
   */
  private calculateEstimatedCost(
    resolution: VideoResolution,
    duration: number,
  ): number {
    return COST_CONFIG[resolution] * duration;
  }

  /**
   * 获取默认步骤
   */
  private getDefaultSteps(videoMode: VideoMode) {
    const baseSteps = [
      {
        name: "prepare",
        label: "准备数据",
        status: "pending" as const,
        progress: 0,
      },
      {
        name: "video",
        label: "生成视频",
        status: "pending" as const,
        progress: 0,
      },
    ];

    if (videoMode === VideoMode.AUDIO_REFERENCE) {
      return [
        baseSteps[0],
        {
          name: "tts",
          label: "生成音频",
          status: "pending" as const,
          progress: 0,
        },
        baseSteps[1],
        {
          name: "sync",
          label: "音画同步",
          status: "pending" as const,
          progress: 0,
        },
      ];
    }

    if (videoMode === VideoMode.LIP_SYNC) {
      return [
        baseSteps[0],
        {
          name: "video_silent",
          label: "生成无声视频",
          status: "pending" as const,
          progress: 0,
        },
        {
          name: "tts",
          label: "生成音频",
          status: "pending" as const,
          progress: 0,
        },
        {
          name: "lip_sync",
          label: "对口型处理",
          status: "pending" as const,
          progress: 0,
        },
      ];
    }

    // VIDEO_ONLY
    return baseSteps;
  }

  /**
   * 获取步骤预览
   */
  private getStepPreviews(
    videoMode: VideoMode,
  ): Array<{ name: string; label: string }> {
    return this.getDefaultSteps(videoMode).map((step) => ({
      name: step.name,
      label: step.label,
    }));
  }

  /**
   * 映射为详情 DTO
   */
  private mapToDetailDto(
    task: VideoGenerationTask,
    quotaInfo?: {
      estimatedAmount: number;
      actualAmount: number;
      status: string;
      deductedFrom: string | null; // 管理员豁免时为 null
      refundAmount?: number;
    } | null,
  ): VideoGenTaskDetailDto {
    return {
      id: task.id,
      projectId: task.projectId,
      shotId: task.shotId,
      status: task.status,
      config: task.config,
      progress: task.progress,
      outputs: task.outputs?.map((output) => ({
        id: output.id,
        type: output.type,
        file: output.file,
      })),
      cost: {
        ...task.cost,
        deductedQuota: quotaInfo?.estimatedAmount || 0,
        deductedFrom: quotaInfo?.deductedFrom as
          | "subscription"
          | "balance"
          | null,
        refundAmount: quotaInfo?.refundAmount,
      },
      quotaRecordId: task.quotaRecordId || undefined,
      createdAt: task.createdAt.toISOString(),
      startedAt: task.startedAt?.toISOString(),
      completedAt: task.completedAt?.toISOString(),
      error: task.error || undefined,
    };
  }
}
