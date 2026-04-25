import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  VideoGenerationTask,
  VideoGenTaskStatus,
  VideoMode,
} from "../entities/video-generation-task.entity";
import { VideoGenerationOutput } from "../entities/video-generation-output.entity";
import { VideoGenGateway } from "../gateways/video-gen.gateway";
import { VideoGenQuotaService } from "./video-gen-quota.service";

/**
 * 视频生成处理器
 * 处理视频生成任务的实际执行逻辑
 */
@Injectable()
export class VideoGenProcessor {
  private readonly logger = new Logger(VideoGenProcessor.name);

  constructor(
    @InjectRepository(VideoGenerationTask)
    private taskRepository: Repository<VideoGenerationTask>,
    @InjectRepository(VideoGenerationOutput)
    private outputRepository: Repository<VideoGenerationOutput>,
    private videoGenGateway: VideoGenGateway,
    private videoGenQuotaService: VideoGenQuotaService,
  ) {}

  /**
   * 处理任务
   */
  async processTask(taskId: string): Promise<void> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId },
    });

    if (!task) {
      this.logger.error(`Task ${taskId} not found`);
      return;
    }

    if (task.status !== VideoGenTaskStatus.QUEUED) {
      this.logger.warn(
        `Task ${taskId} is not in queued status: ${task.status}`,
      );
      return;
    }

    const userId = task.createdBy;
    const projectId = task.projectId;

    try {
      // 推送任务开始
      await this.pushStepUpdate(
        userId,
        taskId,
        projectId,
        "prepare",
        "processing",
        0,
      );

      // 更新任务状态为生成中
      await this.updateTaskStatus(taskId, VideoGenTaskStatus.GENERATING);
      await this.updateStepStatus(taskId, "prepare", "processing");

      // 根据视频模式选择处理流程
      switch (task.config.videoMode) {
        case VideoMode.AUDIO_REFERENCE:
          await this.processAudioDriven(task, userId);
          break;
        case VideoMode.LIP_SYNC:
          await this.processVideoFirst(task, userId);
          break;
        case VideoMode.VIDEO_ONLY:
          await this.processVideoOnly(task, userId);
          break;
        default:
          throw new Error(`Unknown video mode: ${task.config.videoMode}`);
      }

      // 更新任务完成
      await this.completeTask(taskId);

      // 确认额度扣减（使用实际视频时长，这里默认5秒）
      try {
        await this.videoGenQuotaService.confirmDeduct(taskId, 5);
      } catch (quotaError) {
        this.logger.error(
          `确认额度扣减失败: taskId=${taskId}`,
          quotaError instanceof Error ? quotaError.stack : undefined,
        );
      }

      // 推送任务完成
      await this.videoGenGateway.pushComplete(userId, taskId, {
        taskId,
        projectId,
      });

      this.logger.log(`视频生成任务完成: ${taskId}`);
    } catch (error) {
      this.logger.error(`Failed to process task ${taskId}:`, error);
      await this.failTask(taskId, error);

      // 返还额度
      try {
        await this.videoGenQuotaService.refund(taskId, "任务执行失败");
      } catch (quotaError) {
        this.logger.error(
          `返还额度失败: taskId=${taskId}`,
          quotaError instanceof Error ? quotaError.stack : undefined,
        );
      }

      // 推送任务失败
      const currentStep = task.progress?.currentStep || "unknown";
      await this.videoGenGateway.pushFailed(userId, taskId, {
        taskId,
        projectId,
        errorCode: 4001,
        errorMessage: "处理失败",
        retryable: true,
        failedStep: currentStep,
      });
    }
  }

  /**
   * 处理音频直驱模式
   */
  private async processAudioDriven(
    task: VideoGenerationTask,
    userId: string,
  ): Promise<void> {
    const taskId = task.id;
    const projectId = task.projectId;

    // 1. 准备数据
    await this.updateStepStatus(taskId, "prepare", "completed");
    await this.pushStepUpdate(
      userId,
      taskId,
      projectId,
      "prepare",
      "completed",
      25,
    );

    await this.updateStepStatus(taskId, "tts", "processing");
    await this.pushStepUpdate(
      userId,
      taskId,
      projectId,
      "tts",
      "processing",
      25,
    );

    // 2. 生成 TTS 音频
    // TODO: 调用 audio-gen 服务生成音频
    await this.simulateProcessing(taskId, "tts", 2000);
    await this.updateStepStatus(taskId, "tts", "completed");
    await this.pushStepUpdate(
      userId,
      taskId,
      projectId,
      "tts",
      "completed",
      50,
    );

    // 3. 生成视频
    await this.updateStepStatus(taskId, "video", "processing");
    await this.pushStepUpdate(
      userId,
      taskId,
      projectId,
      "video",
      "processing",
      50,
    );

    // TODO: 调用视频生成模型
    await this.simulateProcessing(taskId, "video", 5000);
    await this.updateStepStatus(taskId, "video", "completed");
    await this.pushStepUpdate(
      userId,
      taskId,
      projectId,
      "video",
      "completed",
      75,
    );

    // 4. 音画同步
    await this.updateStepStatus(taskId, "sync", "processing");
    await this.pushStepUpdate(
      userId,
      taskId,
      projectId,
      "sync",
      "processing",
      75,
    );

    // TODO: 调用音频混合服务
    await this.simulateProcessing(taskId, "sync", 1000);
    await this.updateStepStatus(taskId, "sync", "completed");
    await this.pushStepUpdate(
      userId,
      taskId,
      projectId,
      "sync",
      "completed",
      100,
    );

    // 创建输出记录
    await this.createOutput(taskId, "video", {
      url: `https://example.com/video/${taskId}.mp4`,
      format: "mp4",
      duration: 5,
      size: 1024000,
    });

    await this.createOutput(taskId, "audio", {
      url: `https://example.com/audio/${taskId}.wav`,
      format: "wav",
      duration: 5,
      size: 102400,
    });
  }

  /**
   * 处理先视频后配音模式
   */
  private async processVideoFirst(
    task: VideoGenerationTask,
    userId: string,
  ): Promise<void> {
    const taskId = task.id;
    const projectId = task.projectId;

    // 1. 准备数据
    await this.updateStepStatus(taskId, "prepare", "completed");
    await this.pushStepUpdate(
      userId,
      taskId,
      projectId,
      "prepare",
      "completed",
      20,
    );

    // 2. 生成无声视频
    await this.updateStepStatus(taskId, "video_silent", "processing");
    await this.pushStepUpdate(
      userId,
      taskId,
      projectId,
      "video_silent",
      "processing",
      20,
    );

    // TODO: 调用视频生成模型（无声）
    await this.simulateProcessing(taskId, "video_silent", 5000);
    await this.updateStepStatus(taskId, "video_silent", "completed");
    await this.pushStepUpdate(
      userId,
      taskId,
      projectId,
      "video_silent",
      "completed",
      50,
    );

    // 3. 生成 TTS 音频
    await this.updateStepStatus(taskId, "tts", "processing");
    await this.pushStepUpdate(
      userId,
      taskId,
      projectId,
      "tts",
      "processing",
      50,
    );

    // TODO: 调用 audio-gen 服务生成音频
    await this.simulateProcessing(taskId, "tts", 2000);
    await this.updateStepStatus(taskId, "tts", "completed");
    await this.pushStepUpdate(
      userId,
      taskId,
      projectId,
      "tts",
      "completed",
      70,
    );

    // 4. 对口型处理
    await this.updateStepStatus(taskId, "lip_sync", "processing");
    await this.pushStepUpdate(
      userId,
      taskId,
      projectId,
      "lip_sync",
      "processing",
      70,
    );

    // TODO: 调用 audio-gen lip_sync 服务
    await this.simulateProcessing(taskId, "lip_sync", 3000);
    await this.updateStepStatus(taskId, "lip_sync", "completed");
    await this.pushStepUpdate(
      userId,
      taskId,
      projectId,
      "lip_sync",
      "completed",
      100,
    );

    // 创建输出记录
    await this.createOutput(taskId, "video", {
      url: `https://example.com/video/${taskId}.mp4`,
      format: "mp4",
      duration: 5,
      size: 1024000,
    });

    await this.createOutput(taskId, "audio", {
      url: `https://example.com/audio/${taskId}.wav`,
      format: "wav",
      duration: 5,
      size: 102400,
    });
  }

  /**
   * 处理纯视频模式
   */
  private async processVideoOnly(
    task: VideoGenerationTask,
    userId: string,
  ): Promise<void> {
    const taskId = task.id;
    const projectId = task.projectId;

    // 1. 准备数据
    await this.updateStepStatus(taskId, "prepare", "completed");
    await this.pushStepUpdate(
      userId,
      taskId,
      projectId,
      "prepare",
      "completed",
      50,
    );

    // 2. 生成视频
    await this.updateStepStatus(taskId, "video", "processing");
    await this.pushStepUpdate(
      userId,
      taskId,
      projectId,
      "video",
      "processing",
      50,
    );

    // TODO: 调用视频生成模型
    await this.simulateProcessing(taskId, "video", 5000);
    await this.updateStepStatus(taskId, "video", "completed");
    await this.pushStepUpdate(
      userId,
      taskId,
      projectId,
      "video",
      "completed",
      100,
    );

    // 创建输出记录
    await this.createOutput(taskId, "video", {
      url: `https://example.com/video/${taskId}.mp4`,
      format: "mp4",
      duration: 5,
      size: 1024000,
    });
  }

  /**
   * 更新任务状态
   */
  private async updateTaskStatus(
    taskId: string,
    status: VideoGenTaskStatus,
  ): Promise<void> {
    const updateData: Record<string, unknown> = { status };

    if (status === VideoGenTaskStatus.GENERATING) {
      updateData.startedAt = new Date();
    }

    await this.taskRepository.update(taskId, updateData);
  }

  /**
   * 更新步骤状态
   */
  private async updateStepStatus(
    taskId: string,
    stepName: string,
    stepStatus: "pending" | "processing" | "completed" | "failed",
  ): Promise<void> {
    const task = await this.taskRepository.findOne({ where: { id: taskId } });
    if (!task) return;

    const steps = task.progress.steps || [];
    const stepIndex = steps.findIndex((s) => s.name === stepName);

    if (stepIndex >= 0) {
      steps[stepIndex].status = stepStatus;
      if (stepStatus === "completed") {
        steps[stepIndex].progress = 100;
      }
    }

    // 计算总体进度
    const completedSteps = steps.filter((s) => s.status === "completed").length;
    const percentage = Math.round((completedSteps / steps.length) * 100);

    await this.taskRepository.update(taskId, {
      progress: {
        ...task.progress,
        currentStep: stepName,
        percentage,
        steps,
      },
    });
  }

  /**
   * 完成任务
   */
  private async completeTask(taskId: string): Promise<void> {
    await this.taskRepository.update(taskId, {
      status: VideoGenTaskStatus.COMPLETED,
      completedAt: new Date(),
    });
  }

  /**
   * 失败任务
   */
  private async failTask(taskId: string, error: unknown): Promise<void> {
    await this.taskRepository.update(taskId, {
      status: VideoGenTaskStatus.FAILED,
      error: {
        code: 4001,
        message: "处理失败",
      },
    });
  }

  /**
   * 创建输出记录
   */
  private async createOutput(
    taskId: string,
    type: "video" | "audio" | "preview",
    file: {
      url: string;
      thumbnailUrl?: string;
      format: string;
      resolution?: string;
      duration: number;
      size: number;
    },
  ): Promise<void> {
    const task = await this.taskRepository.findOne({ where: { id: taskId } });
    if (!task) return;

    const output = this.outputRepository.create({
      taskId,
      type,
      file,
      generationParams: {
        modelId: task.config.modelId || "default",
        referenceMode: task.config.referenceMode,
        videoMode: task.config.videoMode,
        resolution: task.config.outputConfig.resolution,
      },
    });

    await this.outputRepository.save(output);
  }

  /**
   * 模拟处理（用于测试）
   */
  private async simulateProcessing(
    taskId: string,
    stepName: string,
    duration: number,
  ): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, duration));
  }

  /**
   * 推送步骤更新
   */
  private async pushStepUpdate(
    userId: string,
    taskId: string,
    projectId: string,
    stepName: string,
    stepStatus: "pending" | "processing" | "completed" | "failed",
    overallProgress: number,
  ): Promise<void> {
    // 步骤名称映射
    const stepLabelMap: Record<string, string> = {
      prepare: "准备数据",
      tts: "生成音频",
      video: "生成视频",
      sync: "音画同步",
      video_silent: "生成无声视频",
      lip_sync: "对口型处理",
    };

    await this.videoGenGateway.pushStepUpdate(userId, taskId, {
      projectId,
      stepName,
      stepLabel: stepLabelMap[stepName] || stepName,
      stepStatus,
      progress:
        stepStatus === "completed" ? 100 : stepStatus === "processing" ? 50 : 0,
      overallProgress,
    });
  }
}
