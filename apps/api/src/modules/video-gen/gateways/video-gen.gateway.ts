/**
 * VideoGen Gateway
 * 处理视频生成模块的 WebSocket 实时进度推送
 */
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { WebSocketService } from "../../websocket/websocket.service";
import {
  AuthenticatedSocket,
  GenerationProgressMessage,
  GenerationCompleteMessage,
  GenerationFailedMessage,
  WebSocketErrorCode,
} from "../../websocket/websocket.types";
import {
  VideoGenerationTask,
  VideoGenerationOutput,
  VideoGenerationBatch,
} from "../entities";

/**
 * 任务进度推送数据
 */
interface ProgressPushData {
  taskId: string;
  projectId: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: {
    percentage: number;
    currentStep: string;
    completed: number;
    total: number;
    failed: number;
  };
  currentStep?: string;
  message?: string;
  stepDetails?: Array<{
    name: string;
    label: string;
    status: string;
    progress: number;
  }>;
}

/**
 * 任务完成推送数据
 */
interface CompletePushData {
  taskId: string;
  projectId: string;
  resultUrl?: string;
  metadata?: Record<string, string>;
}

/**
 * 任务失败推送数据
 */
interface FailedPushData {
  taskId: string;
  projectId: string;
  errorCode: number;
  errorMessage: string;
  retryable?: boolean;
  failedStep?: string;
}

@Injectable()
@WebSocketGateway({
  namespace: "/ws",
  cors: { origin: "*", credentials: true },
})
export class VideoGenGateway {
  private readonly logger = new Logger(VideoGenGateway.name);

  // 推送频率控制：记录上次推送时间
  private lastPushTime: Map<string, number> = new Map();
  // 最小推送间隔（毫秒）
  private readonly minPushInterval = 500;

  constructor(
    private websocketService: WebSocketService,
    @InjectRepository(VideoGenerationTask)
    private taskRepository: Repository<VideoGenerationTask>,
    @InjectRepository(VideoGenerationOutput)
    private outputRepository: Repository<VideoGenerationOutput>,
    @InjectRepository(VideoGenerationBatch)
    private batchRepository: Repository<VideoGenerationBatch>,
  ) {}

  /**
   * 处理客户端订阅任务
   */
  @SubscribeMessage("subscribe_task")
  async handleSubscribeTask(
    @MessageBody() data: { taskId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const userId = client.data.userId;
    const { taskId } = data;

    try {
      // 验证用户是否有权限访问该任务
      const hasAccess = await this.validateTaskAccess(userId, taskId);
      if (!hasAccess) {
        client.emit("error", {
          code: WebSocketErrorCode.TASK_ACCESS_DENIED,
          message: "无权访问该任务",
        });
        return;
      }

      // 将用户加入任务房间
      client.join(`task:${taskId}`);

      // 发送订阅成功响应
      client.emit("subscribed", {
        taskId,
        success: true,
        module: "video-gen",
      });

      this.logger.debug(`用户 ${userId} 订阅视频生成任务: ${taskId}`);

      // 立即推送当前任务状态
      await this.pushCurrentTaskStatus(userId, taskId);
    } catch (error) {
      this.logger.error("订阅任务失败");
      this.logger.debug("详细错误信息:", error);
      client.emit("error", {
        code: WebSocketErrorCode.INTERNAL_ERROR,
        message: "订阅任务失败",
      });
    }
  }

  /**
   * 处理客户端取消订阅任务
   */
  @SubscribeMessage("unsubscribe_task")
  async handleUnsubscribeTask(
    @MessageBody() data: { taskId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const { taskId } = data;

    // 离开任务房间
    client.leave(`task:${taskId}`);

    client.emit("unsubscribed", {
      taskId,
      success: true,
    });

    this.logger.debug(`用户 ${client.data.userId} 取消订阅任务: ${taskId}`);
  }

  /**
   * 推送任务进度
   */
  async pushProgress(
    userId: string,
    taskId: string,
    data: ProgressPushData,
  ): Promise<void> {
    // 频率控制检查
    if (!this.shouldPush(taskId)) {
      return;
    }

    const progressMessage: GenerationProgressMessage = {
      taskId: data.taskId,
      projectId: data.projectId,
      taskType: "video_gen",
      status: data.status,
      progress: data.progress.percentage,
      currentStep: data.currentStep || data.progress.currentStep,
      message:
        data.message ||
        `${data.progress.currentStep} (${data.progress.percentage}%)`,
    };

    await this.websocketService.sendGenerationProgress(userId, progressMessage);

    this.logger.debug(
      `推送视频生成进度: taskId=${taskId}, step=${data.progress.currentStep}, progress=${data.progress.percentage}%`,
    );
  }

  /**
   * 推送任务完成
   */
  async pushComplete(
    userId: string,
    taskId: string,
    data: CompletePushData,
  ): Promise<void> {
    // 获取任务输出
    const outputs = await this.outputRepository.find({
      where: { taskId },
    });

    const videoOutput = outputs.find((o) => o.type === "video");
    const resultUrl = videoOutput?.file?.url || data.resultUrl || "";

    const completeMessage: GenerationCompleteMessage = {
      taskId: data.taskId,
      projectId: data.projectId,
      taskType: "video_gen",
      resultUrl,
      metadata: {
        totalOutputs: String(outputs.length),
        videoDuration: String(videoOutput?.file?.duration || 0),
        ...data.metadata,
      },
    };

    await this.websocketService.sendGenerationComplete(userId, completeMessage);

    this.logger.log(`推送视频生成完成: taskId=${taskId}`);
  }

  /**
   * 推送任务失败
   */
  async pushFailed(
    userId: string,
    taskId: string,
    data: FailedPushData,
  ): Promise<void> {
    const failedMessage: GenerationFailedMessage = {
      taskId: data.taskId,
      projectId: data.projectId,
      taskType: "video_gen",
      errorCode: data.errorCode,
      errorMessage: data.errorMessage,
      retryable: data.retryable ?? true,
    };

    await this.websocketService.sendGenerationFailed(userId, failedMessage);

    this.logger.log(
      `推送视频生成失败: taskId=${taskId}, step=${data.failedStep}, error=${data.errorMessage}`,
    );
  }

  /**
   * 推送批量任务进度
   */
  async pushBatchProgress(
    userId: string,
    batchId: string,
    data: {
      projectId: string;
      summary: {
        total: number;
        completed: number;
        failed: number;
        processing: number;
        pending: number;
        percentage: number;
      };
      currentTask?: {
        taskId: string;
        status: string;
        progress: number;
        currentStep?: string;
      };
    },
  ): Promise<void> {
    // 频率控制检查
    if (!this.shouldPush(batchId)) {
      return;
    }

    const currentStepText = data.currentTask
      ? `${data.currentTask.currentStep || "处理中"} (${data.currentTask.taskId.slice(0, 8)})`
      : "批量视频生成中";

    const progressMessage: GenerationProgressMessage = {
      taskId: batchId,
      projectId: data.projectId,
      taskType: "video_gen",
      status: "processing",
      progress: data.summary.percentage,
      currentStep: currentStepText,
      message: `已完成 ${data.summary.completed}/${data.summary.total}, 失败 ${data.summary.failed}, 进行中 ${data.summary.processing}`,
    };

    await this.websocketService.sendGenerationProgress(userId, progressMessage);

    this.logger.debug(
      `推送批量视频生成进度: batchId=${batchId}, progress=${data.summary.percentage}%`,
    );
  }

  /**
   * 推送批量任务完成
   */
  async pushBatchComplete(
    userId: string,
    batchId: string,
    data: {
      projectId: string;
      stats: {
        total: number;
        completed: number;
        failed: number;
      };
    },
  ): Promise<void> {
    const completeMessage: GenerationCompleteMessage = {
      taskId: batchId,
      projectId: data.projectId,
      taskType: "video_gen",
      resultUrl: "",
      metadata: {
        batchId,
        totalTasks: String(data.stats.total),
        successCount: String(data.stats.completed),
        failedCount: String(data.stats.failed),
        isBatch: "true",
      },
    };

    await this.websocketService.sendGenerationComplete(userId, completeMessage);

    this.logger.log(
      `推送批量视频生成完成: batchId=${batchId}, completed=${data.stats.completed}, failed=${data.stats.failed}`,
    );
  }

  /**
   * 推送步骤状态更新
   */
  async pushStepUpdate(
    userId: string,
    taskId: string,
    data: {
      projectId: string;
      stepName: string;
      stepLabel: string;
      stepStatus: "pending" | "processing" | "completed" | "failed";
      progress: number;
      overallProgress: number;
    },
  ): Promise<void> {
    // 步骤更新立即推送，不受频率限制
    const progressMessage: GenerationProgressMessage = {
      taskId,
      projectId: data.projectId,
      taskType: "video_gen",
      status: data.stepStatus === "failed" ? "failed" : "processing",
      progress: data.overallProgress,
      currentStep: data.stepLabel,
      message: `${data.stepLabel} ${data.stepStatus === "completed" ? "完成" : data.stepStatus === "processing" ? "进行中" : "等待中"}`,
    };

    await this.websocketService.sendGenerationProgress(userId, progressMessage);

    this.logger.debug(
      `推送视频生成步骤更新: taskId=${taskId}, step=${data.stepName}, status=${data.stepStatus}`,
    );
  }

  /**
   * 验证用户是否有权限访问任务
   */
  private async validateTaskAccess(
    userId: string,
    taskId: string,
  ): Promise<boolean> {
    // 先检查是否是批量任务ID
    const batch = await this.batchRepository.findOne({
      where: { id: taskId },
      select: ["createdBy"],
    });

    if (batch) {
      return batch.createdBy === userId;
    }

    // 检查是否是单个任务
    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      select: ["createdBy"],
    });

    return task?.createdBy === userId;
  }

  /**
   * 推送当前任务状态
   */
  private async pushCurrentTaskStatus(
    userId: string,
    taskId: string,
  ): Promise<void> {
    // 先检查是否是批量任务
    const batch = await this.batchRepository.findOne({
      where: { id: taskId },
    });

    if (batch) {
      const total = batch.stats?.total || 0;
      const completed = batch.stats?.completed || 0;
      const failed = batch.stats?.failed || 0;
      const pending = batch.stats?.pending || 0;
      const processing = total - completed - failed - pending;

      await this.pushBatchProgress(userId, taskId, {
        projectId: batch.projectId,
        summary: {
          total,
          completed,
          failed,
          processing: processing > 0 ? processing : 0,
          pending,
          percentage: total
            ? Math.round(((completed + failed) / total) * 100)
            : 0,
        },
      });
      return;
    }

    // 单个任务
    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ["outputs"],
    });

    if (!task) return;

    const steps = task.progress?.steps || [];
    const completedSteps = steps.filter((s) => s.status === "completed").length;
    const totalSteps = steps.length || 1;

    // 根据任务状态推送相应消息
    if (task.status === "completed") {
      await this.pushComplete(userId, taskId, {
        taskId,
        projectId: task.projectId,
      });
    } else if (task.status === "failed") {
      await this.pushFailed(userId, taskId, {
        taskId,
        projectId: task.projectId,
        errorCode: task.error?.code || 4001,
        errorMessage: task.error?.message || "任务失败",
        failedStep: task.error?.step,
      });
    } else {
      // 进行中状态
      const currentStep =
        steps.find((s) => s.status === "processing") || steps[0];

      await this.pushProgress(userId, taskId, {
        taskId,
        projectId: task.projectId,
        status: task.status === "generating" ? "processing" : "pending",
        progress: {
          percentage: task.progress?.percentage || 0,
          currentStep: currentStep?.label || "等待中",
          completed: completedSteps,
          total: totalSteps,
          failed: 0,
        },
        stepDetails: steps,
      });
    }
  }

  /**
   * 检查是否应该推送（频率控制）
   */
  private shouldPush(taskId: string): boolean {
    const now = Date.now();
    const lastPush = this.lastPushTime.get(taskId) || 0;

    if (now - lastPush < this.minPushInterval) {
      return false;
    }

    this.lastPushTime.set(taskId, now);
    return true;
  }
}
