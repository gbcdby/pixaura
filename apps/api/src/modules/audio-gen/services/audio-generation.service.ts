/**
 * 音频生成服务
 * 核心业务逻辑：任务创建、生成流程、结果管理
 */
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import {
  AudioGenTaskStatus,
  AudioGenTaskType,
  AudioGenerationTaskEntity,
  AudioGenerationOutputEntity,
} from "../entities";
import {
  AudioGenerationTaskRepository,
  AudioGenerationOutputRepository,
} from "../repositories";
import { AudioGenerationCostService } from "./audio-generation-cost.service";
import { AudioGenerationQueueService } from "./audio-generation-queue.service";
import { AudioStorageService } from "./audio-storage.service";
import {
  CreateTTSTaskDto,
  CreateLipSyncTaskDto,
  CreateBGMTaskDto,
  CreateAmbienceTaskDto,
  CreateMixingTaskDto,
  AudioGenTaskDetailDto,
  AudioGenOutputDto,
  AudioGenProgress,
  CancelAudioGenTaskResponseDto,
} from "@pixaura/shared-types";

@Injectable()
export class AudioGenerationService {
  private readonly logger = new Logger(AudioGenerationService.name);

  constructor(
    private taskRepo: AudioGenerationTaskRepository,
    private outputRepo: AudioGenerationOutputRepository,
    private costService: AudioGenerationCostService,
    private queueService: AudioGenerationQueueService,
    private storageService: AudioStorageService,
  ) {}

  /**
   * 创建 TTS 任务
   */
  async createTTSTask(
    userId: string,
    dto: CreateTTSTaskDto,
  ): Promise<{
    taskId: string;
    status: AudioGenTaskStatus;
    estimatedCost: number;
    estimatedTime?: number;
  }> {
    // 验证文本长度
    if (dto.config.text.length > 500) {
      throw new BadRequestException("文本长度不能超过500字符");
    }

    // 计算成本
    const cost = this.costService.calculateEstimatedCost("tts", 1);

    // 检查额度
    const hasQuota = await this.costService.reserveQuota(
      userId,
      dto.projectId,
      cost.estimatedCost,
    );
    if (!hasQuota) {
      throw new BadRequestException("额度不足");
    }

    // 检查并发任务数
    const activeTasks = await this.taskRepo.findActiveTasks(dto.projectId);
    if (activeTasks.length >= 3) {
      throw new BadRequestException(
        "音频生成任务并发数已达上限(3个)，请等待其他任务完成",
      );
    }

    // 创建任务
    const task = this.taskRepo.create({
      projectId: dto.projectId,
      createdBy: userId,
      type: "tts" as AudioGenTaskType,
      config: {
        ttsConfig: {
          text: dto.config.text,
          speakerId: dto.config.speakerId,
          emotion: dto.config.emotion,
          speed: dto.config.speed ?? 1.0,
          targetDuration: dto.config.targetDuration,
        },
      },
      progress: {
        percentage: 0,
        currentStep: "pending",
      },
      cost,
      status: "pending" as AudioGenTaskStatus,
    });

    await this.taskRepo.save(task);

    // 加入队列
    await this.queueService.addTask(task.id, dto.notifyWs);

    this.logger.log(`TTS任务已创建: ${task.id}`);

    return {
      taskId: task.id,
      status: task.status,
      estimatedCost: cost.estimatedCost,
      estimatedTime: 5, // 预估5秒
    };
  }

  /**
   * 创建对口型任务
   */
  async createLipSyncTask(
    userId: string,
    dto: CreateLipSyncTaskDto,
  ): Promise<{
    taskId: string;
    status: AudioGenTaskStatus;
    estimatedCost: number;
    estimatedTime?: number;
  }> {
    // 计算成本
    const cost = this.costService.calculateEstimatedCost("lip_sync", 1);

    // 检查额度
    const hasQuota = await this.costService.reserveQuota(
      userId,
      dto.projectId,
      cost.estimatedCost,
    );
    if (!hasQuota) {
      throw new BadRequestException("额度不足");
    }

    // 检查并发任务数
    const activeTasks = await this.taskRepo.findActiveTasks(dto.projectId);
    if (activeTasks.length >= 3) {
      throw new BadRequestException(
        "音频生成任务并发数已达上限(3个)，请等待其他任务完成",
      );
    }

    // 创建任务
    const task = this.taskRepo.create({
      projectId: dto.projectId,
      createdBy: userId,
      type: "lip_sync" as AudioGenTaskType,
      config: {
        lipSyncConfig: {
          videoUrl: dto.config.videoUrl,
          audioUrl: dto.config.audioUrl,
          characterId: dto.config.characterId,
          referenceMode: dto.config.referenceMode || "single_reference",
        },
      },
      progress: {
        percentage: 0,
        currentStep: "pending",
      },
      cost,
      status: "pending" as AudioGenTaskStatus,
    });

    await this.taskRepo.save(task);

    // 加入队列
    await this.queueService.addTask(task.id, dto.notifyWs);

    this.logger.log(`对口型任务已创建: ${task.id}`);

    return {
      taskId: task.id,
      status: task.status,
      estimatedCost: cost.estimatedCost,
      estimatedTime: 30, // 预估30秒
    };
  }

  /**
   * 创建 BGM 任务
   */
  async createBGMTask(
    userId: string,
    dto: CreateBGMTaskDto,
  ): Promise<{
    taskId: string;
    status: AudioGenTaskStatus;
    estimatedCost: number;
    estimatedTime?: number;
  }> {
    // 计算成本（BGM按时长计费）
    const cost = this.costService.calculateEstimatedCost(
      "bgm",
      dto.config.duration,
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

    // 检查并发任务数
    const activeTasks = await this.taskRepo.findActiveTasks(dto.projectId);
    if (activeTasks.length >= 3) {
      throw new BadRequestException(
        "音频生成任务并发数已达上限(3个)，请等待其他任务完成",
      );
    }

    // 创建任务
    const task = this.taskRepo.create({
      projectId: dto.projectId,
      createdBy: userId,
      type: "bgm" as AudioGenTaskType,
      config: {
        bgmConfig: {
          emotionCurve: dto.config.emotionCurve,
          duration: dto.config.duration,
          style: dto.config.style,
          tempo: dto.config.tempo,
          needBeatPoints: dto.config.needBeatPoints ?? false,
          modelId: dto.config.modelId,
        },
      },
      progress: {
        percentage: 0,
        currentStep: "pending",
      },
      cost,
      status: "pending" as AudioGenTaskStatus,
    });

    await this.taskRepo.save(task);

    // 加入队列
    await this.queueService.addTask(task.id, dto.notifyWs);

    this.logger.log(`BGM任务已创建: ${task.id}`);

    return {
      taskId: task.id,
      status: task.status,
      estimatedCost: cost.estimatedCost,
      estimatedTime: 10, // 预估10秒
    };
  }

  /**
   * 创建环境音任务
   */
  async createAmbienceTask(
    userId: string,
    dto: CreateAmbienceTaskDto,
  ): Promise<{
    taskId: string;
    status: AudioGenTaskStatus;
    estimatedCost: number;
    estimatedTime?: number;
  }> {
    // 计算成本
    const cost = this.costService.calculateEstimatedCost(
      "ambience",
      dto.config.duration,
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

    // 检查并发任务数
    const activeTasks = await this.taskRepo.findActiveTasks(dto.projectId);
    if (activeTasks.length >= 3) {
      throw new BadRequestException(
        "音频生成任务并发数已达上限(3个)，请等待其他任务完成",
      );
    }

    // 创建任务
    const task = this.taskRepo.create({
      projectId: dto.projectId,
      createdBy: userId,
      type: "ambience" as AudioGenTaskType,
      config: {
        ambienceConfig: {
          sceneTags: dto.config.sceneTags,
          duration: dto.config.duration,
          actions: dto.config.actions,
          reverbPreset: dto.config.reverbPreset,
        },
      },
      progress: {
        percentage: 0,
        currentStep: "pending",
      },
      cost,
      status: "pending" as AudioGenTaskStatus,
    });

    await this.taskRepo.save(task);

    // 加入队列
    await this.queueService.addTask(task.id, dto.notifyWs);

    this.logger.log(`环境音任务已创建: ${task.id}`);

    return {
      taskId: task.id,
      status: task.status,
      estimatedCost: cost.estimatedCost,
      estimatedTime: 10, // 预估10秒
    };
  }

  /**
   * 创建混音任务
   */
  async createMixingTask(
    userId: string,
    dto: CreateMixingTaskDto,
  ): Promise<{
    taskId: string;
    status: AudioGenTaskStatus;
    estimatedCost: number;
    estimatedTime?: number;
  }> {
    // 验证轨道数
    if (dto.config.tracks.length > 8) {
      throw new BadRequestException("混音轨道数不能超过8轨");
    }

    // 计算成本
    const cost = this.costService.calculateEstimatedCost(
      "mixing",
      dto.config.tracks.length,
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

    // 检查并发任务数
    const activeTasks = await this.taskRepo.findActiveTasks(dto.projectId);
    if (activeTasks.length >= 3) {
      throw new BadRequestException(
        "音频生成任务并发数已达上限(3个)，请等待其他任务完成",
      );
    }

    // 创建任务
    const task = this.taskRepo.create({
      projectId: dto.projectId,
      createdBy: userId,
      type: "mixing" as AudioGenTaskType,
      config: {
        mixingConfig: {
          tracks: dto.config.tracks,
          normalize: dto.config.normalize,
          targetLufs: dto.config.targetLufs ?? -14,
        },
      },
      progress: {
        percentage: 0,
        currentStep: "pending",
      },
      cost,
      status: "pending" as AudioGenTaskStatus,
    });

    await this.taskRepo.save(task);

    // 加入队列
    await this.queueService.addTask(task.id, dto.notifyWs);

    this.logger.log(`混音任务已创建: ${task.id}`);

    return {
      taskId: task.id,
      status: task.status,
      estimatedCost: cost.estimatedCost,
      estimatedTime: 10, // 预估10秒
    };
  }

  /**
   * 获取任务详情
   */
  async getTaskDetail(
    taskId: string,
    userId: string,
  ): Promise<AudioGenTaskDetailDto> {
    const task = await this.taskRepo.findByIdWithOutputs(taskId);

    if (!task) {
      throw new NotFoundException("任务不存在");
    }

    // 检查权限
    if (task.createdBy !== userId) {
      throw new ForbiddenException("无权访问该任务");
    }

    return this.mapToTaskDetailDto(task);
  }

  /**
   * 获取任务列表
   */
  async getTaskList(
    userId: string,
    projectId: string,
    options: {
      type?: string;
      status?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ tasks: AudioGenTaskDetailDto[]; total: number }> {
    const [tasks, total] = await this.taskRepo.findByProjectId(projectId, {
      type: options.type,
      status: options.status as AudioGenTaskStatus,
      limit: options.limit,
      offset: options.offset,
    });

    // 过滤用户的任务
    const userTasks = tasks.filter((t) => t.createdBy === userId);

    return {
      tasks: userTasks.map((t) => this.mapToTaskDetailDto(t)),
      total,
    };
  }

  /**
   * 取消任务
   */
  async cancelTask(
    taskId: string,
    userId: string,
  ): Promise<CancelAudioGenTaskResponseDto> {
    const task = await this.taskRepo.findOne({ where: { id: taskId } });

    if (!task) {
      throw new NotFoundException("任务不存在");
    }

    if (task.createdBy !== userId) {
      throw new ForbiddenException("无权操作该任务");
    }

    if (!task.canCancel()) {
      throw new BadRequestException("任务状态不允许取消");
    }

    // 更新状态
    await this.taskRepo.updateStatus(taskId, "cancelled");

    // 退还额度
    const refundAmount = await this.costService.refundQuota(
      userId,
      task.projectId,
      task.cost.estimatedCost,
    );

    this.logger.log(`任务已取消: ${taskId}, 退还额度: ${refundAmount}`);

    return {
      taskId,
      status: "cancelled",
      refundAmount,
    };
  }

  /**
   * 删除任务
   */
  async deleteTask(taskId: string, userId: string): Promise<void> {
    const task = await this.taskRepo.findOne({ where: { id: taskId } });

    if (!task) {
      throw new NotFoundException("任务不存在");
    }

    if (task.createdBy !== userId) {
      throw new ForbiddenException("无权操作该任务");
    }

    // 软删除
    await this.taskRepo.softDelete(taskId);

    this.logger.log(`任务已删除: ${taskId}`);
  }

  /**
   * 转换为 DTO
   */
  private mapToTaskDetailDto(
    task: AudioGenerationTaskEntity,
  ): AudioGenTaskDetailDto {
    return {
      id: task.id,
      generationTaskId: task.generationTaskId || undefined,
      projectId: task.projectId,
      type: task.type,
      status: task.status,
      config: task.config,
      progress: task.progress,
      cost: task.cost,
      outputs: task.outputs?.map((o) => this.mapToOutputDto(o)),
      error: task.error || undefined,
      createdAt: task.createdAt.toISOString(),
      startedAt: task.startedAt?.toISOString(),
      completedAt: task.completedAt?.toISOString(),
    };
  }

  /**
   * 转换为输出 DTO
   */
  private mapToOutputDto(
    output: AudioGenerationOutputEntity,
  ): AudioGenOutputDto {
    return {
      id: output.id,
      type: output.type,
      file: output.file,
      metadata: output.metadata || undefined,
      moderation: output.moderation || undefined,
      createdAt: output.createdAt.toISOString(),
    };
  }
}
