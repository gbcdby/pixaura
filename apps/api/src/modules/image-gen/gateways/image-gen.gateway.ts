/**
 * ImageGen Gateway
 * 处理图片生成模块的 WebSocket 实时进度推送
 */
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Injectable, Logger, UseFilters } from "@nestjs/common";
import { Socket } from "socket.io";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { WebSocketService } from "../../websocket/websocket.service";
import {
  AuthenticatedSocket,
  GenerationProgressMessage,
  GenerationCompleteMessage,
  GenerationFailedMessage,
  WebSocketErrorCode,
} from "../../websocket/websocket.types";
import {
  ImageGenerationTaskEntity,
  ImageGenerationResultEntity,
} from "../entities";

/**
 * 任务进度推送数据
 */
interface ProgressPushData {
  taskId: string;
  projectId: string;
  status: string;
  progress?: {
    percentage: number;
    currentStep: string;
    completed: number;
    total: number;
    failed: number;
  };
  currentStep?: string;
  message?: string;
  // 资产生成专用字段
  assetType?: "character" | "scene" | "prop";
  assetId?: string;
  type?: "character_views" | "scene_panorama" | "scene_variant" | "prop_views";
  currentView?: {
    type: string;
    status: "generating" | "completed" | "failed";
    progress?: number;
  };
  completedView?: {
    type: string;
    imageUrl: string;
    thumbnailUrl: string;
    seed: number;
  };
  error?: {
    code: string;
    message: string;
    viewType?: string;
  };
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
}

@Injectable()
@WebSocketGateway({
  namespace: "/ws",
  cors: { origin: "*", credentials: true },
})
export class ImageGenGateway {
  private readonly logger = new Logger(ImageGenGateway.name);

  // 推送频率控制：记录上次推送时间
  private lastPushTime: Map<string, number> = new Map();
  // 最小推送间隔（毫秒）
  private readonly minPushInterval = 500;

  constructor(
    private websocketService: WebSocketService,
    @InjectRepository(ImageGenerationTaskEntity)
    private taskRepository: Repository<ImageGenerationTaskEntity>,
    @InjectRepository(ImageGenerationResultEntity)
    private resultRepository: Repository<ImageGenerationResultEntity>,
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
        module: "image-gen",
      });

      this.logger.debug(`用户 ${userId} 订阅图片生成任务: ${taskId}`);

      // 延迟 200ms 后再推送当前任务状态，给前端足够时间完成 handler 注册
      // 避免竞态条件：后端推送进度时前端 handler 还未就绪
      await new Promise((resolve) => setTimeout(resolve, 200));
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

    // 判断是否为资产生成任务
    if (data.assetType) {
      await this.pushAssetProgress(userId, taskId, data);
      return;
    }

    // 映射状态
    const mappedStatus = this.mapStatus(data.status);

    const progressMessage: GenerationProgressMessage = {
      taskId: data.taskId,
      projectId: data.projectId,
      taskType: "image_gen",
      status: mappedStatus,
      progress: data.progress?.percentage || 0,
      currentStep: data.currentStep || data.progress?.currentStep || "处理中",
      message:
        data.message ||
        `${data.progress?.completed || 0}/${data.progress?.total || 1}`,
    };

    await this.websocketService.sendGenerationProgress(userId, progressMessage);

    this.logger.debug(
      `推送图片生成进度: taskId=${taskId}, progress=${data.progress?.percentage || 0}%`,
    );
  }

  /**
   * 推送资产生成进度
   */
  private async pushAssetProgress(
    userId: string,
    taskId: string,
    data: ProgressPushData,
  ): Promise<void> {
    const eventName = "asset:image-progress";

    const eventData = {
      taskId: data.taskId,
      assetType: data.assetType,
      assetId: data.assetId,
      type: data.type,
      status: data.status,
      progress: data.progress
        ? {
            total: data.progress.total,
            completed: data.progress.completed,
            failed: data.progress.failed,
            percentage: data.progress.percentage,
          }
        : undefined,
      currentView: data.currentView,
      completedView: data.completedView,
      error: data.error,
      timestamp: Date.now(),
    };

    // 发送给用户
    await this.websocketService.sendEventToUser(userId, eventName, eventData);

    this.logger.debug(
      `推送资产生成进度: taskId=${taskId}, assetType=${data.assetType}, status=${data.status}`,
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
    // 获取任务结果
    const results = await this.resultRepository.find({
      where: { taskId },
      order: { index: "ASC" },
    });

    const resultUrl = results.length > 0 ? results[0].image?.url : undefined;

    const completeMessage: GenerationCompleteMessage = {
      taskId: data.taskId,
      projectId: data.projectId,
      taskType: "image_gen",
      resultUrl: resultUrl || data.resultUrl || "",
      metadata: {
        totalResults: String(results.length),
        successCount: String(
          results.filter((r) => r.status === "success").length,
        ),
        ...data.metadata,
      },
    };

    await this.websocketService.sendGenerationComplete(userId, completeMessage);

    this.logger.log(`推送图片生成完成: taskId=${taskId}`);
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
      taskType: "image_gen",
      errorCode: data.errorCode,
      errorMessage: data.errorMessage,
      retryable: data.retryable ?? false,
    };

    await this.websocketService.sendGenerationFailed(userId, failedMessage);

    this.logger.log(
      `推送图片生成失败: taskId=${taskId}, error=${data.errorMessage}`,
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
      };
    },
  ): Promise<void> {
    // 频率控制检查
    if (!this.shouldPush(batchId)) {
      return;
    }

    const progressMessage: GenerationProgressMessage = {
      taskId: batchId,
      projectId: data.projectId,
      taskType: "image_gen",
      status: "processing",
      progress: data.summary.percentage,
      currentStep: data.currentTask
        ? `处理任务 ${data.currentTask.taskId}`
        : "批量生成中",
      message: `已完成 ${data.summary.completed}/${data.summary.total}, 失败 ${data.summary.failed}`,
    };

    await this.websocketService.sendGenerationProgress(userId, progressMessage);

    this.logger.debug(
      `推送批量图片生成进度: batchId=${batchId}, progress=${data.summary.percentage}%`,
    );
  }

  /**
   * 验证用户是否有权限访问任务
   */
  private async validateTaskAccess(
    userId: string,
    taskId: string,
  ): Promise<boolean> {
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
    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ["results"],
    });

    if (!task) return;

    const completed =
      task.results?.filter((r) => r.status === "success").length || 0;
    const failed =
      task.results?.filter((r) => r.status === "failed").length || 0;

    // 根据任务状态推送相应消息
    if (task.status === "completed" || task.status === "partial_failed") {
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
      });
    } else {
      // 进行中状态
      await this.pushProgress(userId, taskId, {
        taskId,
        projectId: task.projectId,
        status: task.status === "generating" ? "processing" : "pending",
        progress: {
          percentage: task.progress?.percentage || 0,
          currentStep: task.progress?.currentStep || "等待中",
          completed,
          total: task.progress?.total || 1,
          failed,
        },
      });
    }
  }

  /**
   * 映射状态为 GenerationProgressMessage 支持的状态
   */
  private mapStatus(
    status: string,
  ): "pending" | "processing" | "completed" | "failed" {
    const statusMap: Record<
      string,
      "pending" | "processing" | "completed" | "failed"
    > = {
      pending: "pending",
      processing: "processing",
      completed: "completed",
      failed: "failed",
      started: "processing",
      progress: "processing",
      view_completed: "processing",
      partial_failed: "completed",
      cancelled: "failed",
    };
    return statusMap[status] || "processing";
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
