import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { RedisService } from "../../common/redis/redis.service";
import Redis from "ioredis";
import {
  WebSocketMessage,
  WebSocketMessageType,
  WebSocketErrorCode,
  MESSAGE_CONFIG,
  REDIS_KEY_PREFIX,
  AuthenticatedSocket,
  ExportProgressMessage,
  ExportStatusMessage,
  ExportBatchProgressMessage,
  GenerationProgressMessage,
  GenerationCompleteMessage,
  GenerationFailedMessage,
  QuotaWarningMessage,
  SystemNotificationMessage,
  ScriptGenerateProgressMessage,
  ScriptGenerateDoneMessage,
  ScriptParseProgressMessage,
  ScriptEditProgressMessage,
  AssetImageProgressMessage,
  AssetVideoProgressMessage,
  StoryboardGenerateProgressMessage,
  StoryboardParseProgressMessage,
} from "./websocket.types";

/**
 * 待确认消息（用于重试机制）
 */
interface PendingMessage {
  messageId: string;
  userId: string;
  message: WebSocketMessage;
  retries: number;
  lastSentAt: number;
}

/**
 * WebSocket 服务
 * 处理消息存储、广播、重试等核心功能
 *
 * 使用 Redis Pub/Sub 解决 Worker 进程无法直接发送 WebSocket 消息的问题：
 * - Worker 进程发布消息到 Redis channel
 * - 主进程订阅 channel 并转发给 WebSocket 客户端
 */
@Injectable()
export class WebSocketService implements OnModuleInit {
  private readonly logger = new Logger(WebSocketService.name);

  // 待确认消息映射：messageId -> PendingMessage
  private pendingMessages = new Map<string, PendingMessage>();

  // 用户连接映射：userId -> Set<socketId>
  private userConnections = new Map<string, Set<string>>();

  // Socket 引用映射：socketId -> Socket
  private socketMap = new Map<string, AuthenticatedSocket>();

  // 任务订阅映射：taskId -> Set<userId>
  private taskSubscriptions = new Map<string, Set<string>>();

  // Redis Pub/Sub 专用客户端（订阅需要单独的连接）
  private subscriberClient: Redis | null = null;

  // Redis Pub/Sub 初始化状态标志（订阅成功后设为 true）
  private pubSubInitialized = false;

  // Redis Pub/Sub 客户端已创建标志（创建客户端后设为 true）
  private subscriberClientCreated = false;

  // Redis Pub/Sub channel 名称
  private readonly WS_BROADCAST_CHANNEL = "ws:broadcast";

  constructor(private redisService: RedisService) {}

  /**
   * 模块初始化时创建 Redis Pub/Sub 客户端（但不订阅）
   * 实际订阅延迟到第一次用户连接时，确保只有主进程才订阅
   */
  async onModuleInit() {
    await this.createSubscriberClient();
  }

  /**
   * 创建 Redis Pub/Sub 客户端（不订阅）
   * 主进程和 Worker 进程都会创建客户端，但只有主进程会在有用户连接时订阅
   */
  private async createSubscriberClient() {
    try {
      const redis = this.redisService.getClient();
      this.subscriberClient = new Redis({
        host: redis.options.host,
        port: redis.options.port,
        password: redis.options.password,
      });

      // 注册消息处理器（订阅成功后才会收到消息）
      this.subscriberClient.on("message", (channel, message) => {
        if (channel === this.WS_BROADCAST_CHANNEL) {
          this.handleBroadcastMessage(message);
        }
      });

      this.subscriberClientCreated = true;
      this.logger.log(
        `[WebSocket] Redis Pub/Sub 客户端已创建，等待用户连接后订阅 channel`,
      );
    } catch (error) {
      this.logger.error("[WebSocket] Redis Pub/Sub 客户端创建失败");
      this.logger.debug("详细错误信息:", error);
    }
  }

  /**
   * 检查并启动 Redis Pub/Sub 订阅（延迟订阅策略）
   * 只有当有用户连接时才订阅，确保 Worker 进程不会订阅
   */
  private async checkAndStartPubSubSubscription() {
    this.logger.log(
      `[WebSocket] checkAndStartPubSubSubscription: pubSubInitialized=${this.pubSubInitialized}, subscriberClientCreated=${this.subscriberClientCreated}, userConnections.size=${this.userConnections.size}`,
    );

    // 已经订阅则跳过
    if (this.pubSubInitialized) {
      this.logger.log(`[WebSocket] Redis Pub/Sub 已订阅，跳过`);
      return;
    }

    // 客户端未创建或订阅客户端无效则跳过
    if (!this.subscriberClientCreated || !this.subscriberClient) {
      this.logger.warn(`[WebSocket] Redis Pub/Sub 客户端未创建，跳过订阅`);
      return;
    }

    // 检查是否有用户连接（有连接说明是主进程）
    const hasConnections = this.userConnections.size > 0;
    if (!hasConnections) {
      this.logger.warn(
        `[WebSocket] 无用户连接，跳过 Redis Pub/Sub 订阅（可能是 Worker 进程）`,
      );
      return;
    }

    try {
      await this.subscriberClient.subscribe(this.WS_BROADCAST_CHANNEL);
      this.pubSubInitialized = true;
      this.logger.log(
        `[WebSocket] Redis Pub/Sub 订阅成功，channel: ${this.WS_BROADCAST_CHANNEL}`,
      );
    } catch (error) {
      this.logger.error("[WebSocket] Redis Pub/Sub 订阅失败");
      this.logger.debug("详细错误信息:", error);
    }
  }

  /**
   * 处理来自 Redis Pub/Sub 的广播消息
   */
  private handleBroadcastMessage(message: string) {
    try {
      const payload = JSON.parse(message) as {
        userId: string;
        event: string;
        data: unknown;
      };

      const { userId, event, data } = payload;
      this.logger.log(
        `[WebSocket] Redis Pub/Sub 收到消息: userId=${userId}, event=${event}`,
      );

      // 从内存中发送给用户
      const sent = this.sendEventToUserDirect(userId, event, data);
      this.logger.log(
        `[WebSocket] Redis Pub/Sub 消息转发结果: userId=${userId}, event=${event}, sent=${sent}`,
      );
    } catch (error) {
      this.logger.error("[WebSocket] 处理广播消息失败");
      this.logger.debug("详细错误信息:", error);
    }
  }

  /**
   * 直接发送事件给用户（不检查连接，由调用方保证用户存在）
   */
  private sendEventToUserDirect<T = unknown>(
    userId: string,
    event: string,
    data: T,
  ): boolean {
    const connections = this.userConnections.get(userId);
    const totalUsers = this.userConnections.size;
    const allUserIds = Array.from(this.userConnections.keys());

    this.logger.log(
      `[WebSocket] sendEventToUserDirect: userId=${userId}, event=${event}, connections=${connections?.size || 0}, totalUsers=${totalUsers}, allUserIds=${JSON.stringify(allUserIds.slice(0, 3))}...`,
    );

    if (!connections || connections.size === 0) {
      this.logger.warn(
        `[WebSocket] 用户 ${userId} 无活跃连接，当前总用户数: ${totalUsers}`,
      );
      return false;
    }

    let sentCount = 0;
    for (const socketId of connections) {
      const socket = this.socketMap.get(socketId);
      if (socket && socket.connected) {
        socket.emit(event, data);
        sentCount++;
        this.logger.log(
          `[WebSocket] 消息已发送: socketId=${socketId}, event=${event}`,
        );
      }
    }

    return sentCount > 0;
  }

  /**
   * 注册用户连接
   * @param userId 用户ID
   * @param socket Socket 连接
   */
  registerConnection(userId: string, socket: AuthenticatedSocket): void {
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(socket.id);
    this.socketMap.set(socket.id, socket);

    // 日志：连接注册成功
    this.logger.log(
      `[WebSocket] ${userId} connect success, socket: ${socket.id}, total users: ${this.userConnections.size}`,
    );

    // 延迟订阅策略：第一次用户连接时触发 Redis Pub/Sub 订阅
    // 这确保只有主进程（有用户连接）才会订阅，Worker 进程不会订阅
    this.checkAndStartPubSubSubscription().catch((err) => {
      this.logger.warn("[WebSocket] Redis Pub/Sub 订阅触发失败");
      this.logger.debug("详细错误信息:", err);
    });
  }

  /**
   * 注销用户连接
   * @param userId 用户ID
   * @param socketId Socket ID
   */
  unregisterConnection(userId: string, socketId: string): void {
    const connections = this.userConnections.get(userId);
    if (connections) {
      connections.delete(socketId);
      if (connections.size === 0) {
        this.userConnections.delete(userId);
      }
    }
    this.socketMap.delete(socketId);

    this.logger.log(`[WebSocket] ${userId} disconnect, socket: ${socketId}`);
  }

  /**
   * 获取用户的所有连接
   * @param userId 用户ID
   * @returns Socket ID 集合
   */
  getUserConnections(userId: string): Set<string> {
    return this.userConnections.get(userId) || new Set();
  }

  /**
   * 获取 Socket 实例
   * @param socketId Socket ID
   * @returns Socket 实例或 undefined
   */
  getSocket(socketId: string): AuthenticatedSocket | undefined {
    return this.socketMap.get(socketId);
  }

  /**
   * 检查用户是否有连接
   * @param userId 用户ID
   * @returns 是否有连接
   */
  hasConnections(userId: string): boolean {
    const connections = this.userConnections.get(userId);
    return !!connections && connections.size > 0;
  }

  /**
   * 获取用户的连接数
   * @param userId 用户ID
   * @returns 连接数
   */
  getConnectionCount(userId: string): number {
    const connections = this.userConnections.get(userId);
    return connections ? connections.size : 0;
  }

  /**
   * 获取最早的连接
   * @param userId 用户ID
   * @returns 最早的 Socket ID 或 null
   */
  getOldestConnection(userId: string): string | null {
    const connections = this.userConnections.get(userId);
    if (!connections || connections.size === 0) return null;
    return Array.from(connections)[0];
  }

  /**
   * 存储消息到 Redis
   * @param userId 用户ID
   * @param message 消息对象
   */
  async storeMessage(userId: string, message: WebSocketMessage): Promise<void> {
    try {
      const key = `${REDIS_KEY_PREFIX.messages}:${userId}`;
      const messageJson = JSON.stringify(message);

      // 检查消息大小
      if (messageJson.length > MESSAGE_CONFIG.maxSize) {
        this.logger.warn(
          `[WebSocket] 消息过大，用户: ${userId}, 大小: ${messageJson.length}`,
        );
        return;
      }

      const redis = this.redisService.getClient();

      // 使用 pipeline 执行多个操作
      const pipeline = redis.pipeline();
      pipeline.lpush(key, messageJson);
      pipeline.ltrim(key, 0, MESSAGE_CONFIG.maxPerUser - 1);
      pipeline.expire(key, MESSAGE_CONFIG.ttl);

      await pipeline.exec();

      this.logger.debug(
        `[WebSocket] 消息已存储，用户: ${userId}, messageId: ${message.messageId}`,
      );
    } catch (error) {
      this.logger.error("[WebSocket] 存储消息失败");
      this.logger.debug("详细错误信息:", error);
    }
  }

  /**
   * 获取用户的历史消息
   * @param userId 用户ID
   * @param lastMessageId 最后接收的消息ID（用于增量同步）
   * @returns 消息列表
   */
  async getMessages(
    userId: string,
    lastMessageId?: string,
  ): Promise<WebSocketMessage[]> {
    try {
      const key = `${REDIS_KEY_PREFIX.messages}:${userId}`;
      const redis = this.redisService.getClient();

      // 获取所有消息
      const messages = await redis.lrange(key, 0, -1);

      if (!messages || messages.length === 0) {
        return [];
      }

      const parsedMessages: WebSocketMessage[] = messages
        .map((msg) => {
          try {
            return JSON.parse(msg) as WebSocketMessage;
          } catch {
            return null;
          }
        })
        .filter((msg): msg is WebSocketMessage => msg !== null);

      // 如果提供了 lastMessageId，只返回之后的消息
      if (lastMessageId) {
        const index = parsedMessages.findIndex(
          (msg) => msg.messageId === lastMessageId,
        );
        if (index !== -1) {
          return parsedMessages.slice(0, index);
        }
      }

      return parsedMessages;
    } catch (error) {
      this.logger.error("[WebSocket] 获取消息失败");
      this.logger.debug("详细错误信息:", error);
      return [];
    }
  }

  /**
   * 发送消息给指定用户
   * @param userId 用户ID
   * @param message 消息对象
   * @returns 是否发送成功
   */
  async sendToUser(
    userId: string,
    message: WebSocketMessage,
  ): Promise<boolean> {
    try {
      const connections = this.userConnections.get(userId);
      if (!connections || connections.size === 0) {
        // 用户不在当前进程（worker 进程中用户连接在主进程）
        // 通过 Redis Pub/Sub 转发给主进程
        this.logger.debug(
          `[WebSocket] 用户 ${userId} 无活跃连接，通过 Redis 转发`,
        );
        await this.publishBroadcastToRedis(userId, "message", message);
        return true;
      }

      // 存储消息
      await this.storeMessage(userId, message);

      // 发送到所有连接
      let sentCount = 0;
      for (const socketId of connections) {
        const socket = this.socketMap.get(socketId);
        if (socket && socket.connected) {
          socket.emit("message", message);
          sentCount++;
        }
      }

      // 添加到待确认队列（需要 ACK 的消息）
      this.addPendingMessage(userId, message);

      const dataType = (message.data as { type?: string })?.type || "unknown";
      this.logger.debug(
        `[WebSocket] ${userId} send message: ${dataType}, sent to ${sentCount} connections`,
      );

      return sentCount > 0;
    } catch (error) {
      this.logger.error("[WebSocket] 发送消息失败");
      this.logger.debug("详细错误信息:", error);
      return false;
    }
  }

  /**
   * 发送自定义事件给指定用户
   * @param userId 用户ID
   * @param event 事件名称
   * @param data 事件数据
   * @returns 是否发送成功
   */
  async sendEventToUser<T = unknown>(
    userId: string,
    event: string,
    data: T,
  ): Promise<boolean> {
    try {
      const connections = this.userConnections.get(userId);
      if (!connections || connections.size === 0) {
        this.logger.debug(`[WebSocket] 用户 ${userId} 无活跃连接`);
        return false;
      }

      // 发送到所有连接
      let sentCount = 0;
      for (const socketId of connections) {
        const socket = this.socketMap.get(socketId);
        if (socket && socket.connected) {
          socket.emit(event, data);
          sentCount++;
        }
      }

      this.logger.log(
        `[WebSocket] ${userId} send event: ${event}, sent to ${sentCount} connections`,
      );

      return sentCount > 0;
    } catch (error) {
      this.logger.error("[WebSocket] 发送事件失败");
      this.logger.debug("详细错误信息:", error);
      return false;
    }
  }

  /**
   * 广播消息给多个用户
   * @param userIds 用户ID列表
   * @param message 消息对象
   */
  async broadcastToUsers(
    userIds: string[],
    message: WebSocketMessage,
  ): Promise<void> {
    for (const userId of userIds) {
      await this.sendToUser(userId, message);
    }
  }

  /**
   * 广播消息给所有连接用户
   * @param message 消息对象
   */
  async broadcastToAll(message: WebSocketMessage): Promise<void> {
    const allUserIds = Array.from(this.userConnections.keys());
    await this.broadcastToUsers(allUserIds, message);
  }

  /**
   * 处理 ACK 确认
   * @param userId 用户ID
   * @param messageId 消息ID
   */
  handleAck(userId: string, messageId: string): void {
    const pending = this.pendingMessages.get(messageId);
    if (pending && pending.userId === userId) {
      this.pendingMessages.delete(messageId);
      this.logger.debug(
        `[WebSocket] 消息已确认，用户: ${userId}, messageId: ${messageId}`,
      );
    }
  }

  /**
   * 添加待确认消息
   * @param userId 用户ID
   * @param message 消息对象
   */
  private addPendingMessage(userId: string, message: WebSocketMessage): void {
    // 只对需要确认的消息类型添加重试
    const needsAck = [
      WebSocketMessageType.GENERATION_PROGRESS,
      WebSocketMessageType.GENERATION_COMPLETE,
      WebSocketMessageType.GENERATION_FAILED,
      WebSocketMessageType.EXPORT_PROGRESS,
      WebSocketMessageType.EXPORT_COMPLETE,
      WebSocketMessageType.EXPORT_FAILED,
      WebSocketMessageType.QUOTA_WARNING,
    ];

    const data = message.data as { type?: string };
    const messageType = data?.type;
    if (
      !messageType ||
      !needsAck.includes(messageType as WebSocketMessageType)
    ) {
      return;
    }

    this.pendingMessages.set(message.messageId, {
      messageId: message.messageId,
      userId,
      message,
      retries: 0,
      lastSentAt: Date.now(),
    });
  }

  /**
   * 重试待确认消息
   * 应由 Gateway 定时调用
   */
  async retryPendingMessages(): Promise<void> {
    const now = Date.now();
    const retryInterval = 5000; // 5秒
    const maxRetries = 3;

    for (const [messageId, pending] of this.pendingMessages.entries()) {
      // 检查是否需要重试
      if (now - pending.lastSentAt < retryInterval) {
        continue;
      }

      // 检查是否超过最大重试次数
      if (pending.retries >= maxRetries) {
        this.logger.warn(
          `[WebSocket] 消息重试次数超限，放弃发送，messageId: ${messageId}`,
        );
        this.pendingMessages.delete(messageId);
        continue;
      }

      // 重试发送
      const connections = this.userConnections.get(pending.userId);
      if (connections && connections.size > 0) {
        for (const socketId of connections) {
          const socket = this.socketMap.get(socketId);
          if (socket && socket.connected) {
            socket.emit("message", pending.message);
          }
        }

        pending.retries++;
        pending.lastSentAt = now;

        this.logger.debug(
          `[WebSocket] 消息重试，messageId: ${messageId}, 第 ${pending.retries} 次`,
        );
      }
    }
  }

  /**
   * 发送导出进度消息
   * @param userId 用户ID
   * @param data 进度数据
   */
  async sendExportProgress(
    userId: string,
    data: Omit<ExportProgressMessage, "type" | "timestamp">,
  ): Promise<void> {
    const message: WebSocketMessage<ExportProgressMessage> = {
      code: WebSocketErrorCode.SUCCESS,
      message: "success",
      data: {
        type: WebSocketMessageType.EXPORT_PROGRESS,
        ...data,
        timestamp: new Date().toISOString(),
      } as ExportProgressMessage,
      timestamp: Date.now(),
      messageId: this.generateMessageId(),
    };

    await this.sendToUser(userId, message);
  }

  /**
   * 发送导出完成消息
   * @param userId 用户ID
   * @param data 完成数据
   */
  async sendExportComplete(
    userId: string,
    data: Omit<ExportStatusMessage, "type" | "timestamp" | "status">,
  ): Promise<void> {
    const message: WebSocketMessage<ExportStatusMessage> = {
      code: WebSocketErrorCode.SUCCESS,
      message: "success",
      data: {
        type: WebSocketMessageType.EXPORT_COMPLETE,
        status: "completed",
        ...data,
        timestamp: new Date().toISOString(),
      } as ExportStatusMessage,
      timestamp: Date.now(),
      messageId: this.generateMessageId(),
    };

    await this.sendToUser(userId, message);
  }

  /**
   * 发送导出失败消息
   * @param userId 用户ID
   * @param data 失败数据
   */
  async sendExportFailed(
    userId: string,
    data: Omit<ExportStatusMessage, "type" | "timestamp" | "status">,
  ): Promise<void> {
    const message: WebSocketMessage<ExportStatusMessage> = {
      code: WebSocketErrorCode.SUCCESS,
      message: "success",
      data: {
        type: WebSocketMessageType.EXPORT_FAILED,
        status: "failed",
        ...data,
        timestamp: new Date().toISOString(),
      } as ExportStatusMessage,
      timestamp: Date.now(),
      messageId: this.generateMessageId(),
    };

    await this.sendToUser(userId, message);
  }

  /**
   * 发送批量导出进度消息
   * @param userId 用户ID
   * @param data 进度数据
   */
  async sendExportBatchProgress(
    userId: string,
    data: Omit<ExportBatchProgressMessage, "type" | "timestamp">,
  ): Promise<void> {
    const message: WebSocketMessage<ExportBatchProgressMessage> = {
      code: WebSocketErrorCode.SUCCESS,
      message: "success",
      data: {
        type: WebSocketMessageType.EXPORT_BATCH_PROGRESS,
        ...data,
        timestamp: new Date().toISOString(),
      } as ExportBatchProgressMessage,
      timestamp: Date.now(),
      messageId: this.generateMessageId(),
    };

    await this.sendToUser(userId, message);
  }

  /**
   * 发送生成任务进度
   * @param userId 用户ID
   * @param data 进度数据
   */
  async sendGenerationProgress(
    userId: string,
    data: Omit<GenerationProgressMessage, "type">,
  ): Promise<void> {
    const message: WebSocketMessage<GenerationProgressMessage> = {
      code: WebSocketErrorCode.SUCCESS,
      message: "success",
      data: {
        ...data,
      },
      timestamp: Date.now(),
      messageId: this.generateMessageId(),
    };

    await this.sendToUser(userId, message);
  }

  /**
   * 发送生成完成消息
   * @param userId 用户ID
   * @param data 完成数据
   */
  async sendGenerationComplete(
    userId: string,
    data: Omit<GenerationCompleteMessage, "type">,
  ): Promise<void> {
    const message: WebSocketMessage<GenerationCompleteMessage> = {
      code: WebSocketErrorCode.SUCCESS,
      message: "success",
      data: {
        ...data,
      },
      timestamp: Date.now(),
      messageId: this.generateMessageId(),
    };

    await this.sendToUser(userId, message);
  }

  /**
   * 发送生成失败消息
   * @param userId 用户ID
   * @param data 失败数据
   */
  async sendGenerationFailed(
    userId: string,
    data: Omit<GenerationFailedMessage, "type">,
  ): Promise<void> {
    const message: WebSocketMessage<GenerationFailedMessage> = {
      code: WebSocketErrorCode.SUCCESS,
      message: "success",
      data: {
        ...data,
      },
      timestamp: Date.now(),
      messageId: this.generateMessageId(),
    };

    await this.sendToUser(userId, message);
  }

  /**
   * 发送额度告警
   * @param userId 用户ID
   * @param data 告警数据
   */
  async sendQuotaWarning(
    userId: string,
    data: QuotaWarningMessage,
  ): Promise<void> {
    const message: WebSocketMessage<QuotaWarningMessage> = {
      code: WebSocketErrorCode.SUCCESS,
      message: "success",
      data,
      timestamp: Date.now(),
      messageId: this.generateMessageId(),
    };

    await this.sendToUser(userId, message);
  }

  /**
   * 发送系统通知
   * @param userId 用户ID
   * @param data 通知数据
   */
  async sendSystemNotification(
    userId: string,
    data: SystemNotificationMessage,
  ): Promise<void> {
    const message: WebSocketMessage<SystemNotificationMessage> = {
      code: WebSocketErrorCode.SUCCESS,
      message: "success",
      data,
      timestamp: Date.now(),
      messageId: this.generateMessageId(),
    };

    await this.sendToUser(userId, message);
  }

  /**
   * 生成消息ID
   * @returns 唯一消息ID
   */
  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取任务订阅的Redis key
   */
  private getTaskSubscribersKey(taskId: string): string {
    return `${REDIS_KEY_PREFIX.task_subscribers}:${taskId}`;
  }

  /**
   * 订阅任务
   * @param userId 用户ID
   * @param taskId 任务ID
   */
  async subscribeToTask(userId: string, taskId: string): Promise<void> {
    // 同时更新内存和Redis，确保主进程和Worker都能访问
    if (!this.taskSubscriptions.has(taskId)) {
      this.taskSubscriptions.set(taskId, new Set());
    }
    this.taskSubscriptions.get(taskId)!.add(userId);

    // 存储到Redis，使用Set结构
    const key = this.getTaskSubscribersKey(taskId);
    const redis = this.redisService.getClient();
    await redis.sadd(key, userId);
    await redis.expire(key, 3600); // 1小时过期

    this.logger.log(`[WebSocket] 用户 ${userId} 订阅任务 ${taskId}`);
  }

  /**
   * 取消订阅任务
   * @param userId 用户ID
   * @param taskId 任务ID
   */
  async unsubscribeFromTask(userId: string, taskId: string): Promise<void> {
    // 更新内存
    const subscribers = this.taskSubscriptions.get(taskId);
    if (subscribers) {
      subscribers.delete(userId);
      if (subscribers.size === 0) {
        this.taskSubscriptions.delete(taskId);
      }
    }

    // 更新Redis
    const key = this.getTaskSubscribersKey(taskId);
    const redis = this.redisService.getClient();
    await redis.srem(key, userId);

    this.logger.log(`[WebSocket] 用户 ${userId} 取消订阅任务 ${taskId}`);
  }

  /**
   * 获取任务订阅者列表（从Redis）
   * @param taskId 任务ID
   */
  async getTaskSubscribersFromRedis(taskId: string): Promise<string[]> {
    const key = this.getTaskSubscribersKey(taskId);
    const redis = this.redisService.getClient();
    const subscribers = await redis.smembers(key);
    return subscribers;
  }

  /**
   * 广播任务进度给所有订阅者
   * @param taskId 任务ID
   * @param data 进度数据
   */
  async broadcastTaskProgress(
    taskId: string,
    data:
      | ScriptGenerateProgressMessage
      | ScriptGenerateDoneMessage
      | ScriptParseProgressMessage
      | ScriptEditProgressMessage
      | AssetImageProgressMessage
      | AssetVideoProgressMessage
      | StoryboardGenerateProgressMessage
      | StoryboardParseProgressMessage,
  ): Promise<void> {
    // 先从内存获取订阅者
    const memorySubscribers = this.taskSubscriptions.get(taskId);
    let subscribers = memorySubscribers ? Array.from(memorySubscribers) : [];

    // 如果内存中没有，从Redis获取（Worker进程使用）
    if (subscribers.length === 0) {
      subscribers = await this.getTaskSubscribersFromRedis(taskId);
    }

    if (!subscribers || subscribers.length === 0) {
      this.logger.warn(`[WebSocket] 任务 ${taskId} 无订阅者`);
      return;
    }

    // 根据消息类型确定事件名称
    const eventName = data.type; // "script:generate-progress" 或 "script:edit-progress"

    this.logger.log(
      `[WebSocket] 广播任务进度: ${taskId}, 事件: ${eventName}, 订阅者: ${subscribers.length}人`,
    );

    for (const userId of subscribers) {
      this.logger.log(
        `[WebSocket] 正在发送给用户 ${userId}, event=${eventName}`,
      );
      const sent = await this.sendEventToUser(userId, eventName, data);
      this.logger.log(`[WebSocket] 发送结果: userId=${userId}, sent=${sent}`);
      if (!sent) {
        // 发送失败（可能是 Worker 进程，用户连接在主进程）
        // 发布到 Redis Pub/Sub，让主进程转发
        await this.publishBroadcastToRedis(userId, eventName, data);
        this.logger.log(
          `[WebSocket] 已发布到 Redis Pub/Sub: userId=${userId}, event=${eventName}`,
        );
      }
    }

    this.logger.log(
      `[WebSocket] 任务 ${taskId} 进度已广播给 ${subscribers.length} 个订阅者`,
    );
  }

  /**
   * 发布广播消息到 Redis Pub/Sub
   * 用于 Worker 进程向主进程发送消息
   */
  private async publishBroadcastToRedis(
    userId: string,
    event: string,
    data: unknown,
  ): Promise<void> {
    try {
      const redis = this.redisService.getClient();
      const message = JSON.stringify({ userId, event, data });
      await redis.publish(this.WS_BROADCAST_CHANNEL, message);
    } catch (error) {
      this.logger.error("[WebSocket] 发布到 Redis Pub/Sub 失败");
      this.logger.debug("详细错误信息:", error);
    }
  }

  /**
   * 获取任务订阅者数量
   * @param taskId 任务ID
   */
  getTaskSubscriberCount(taskId: string): number {
    const subscribers = this.taskSubscriptions.get(taskId);
    return subscribers ? subscribers.size : 0;
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalConnections: number;
    uniqueUsers: number;
    pendingMessages: number;
    taskSubscriptions: number;
  } {
    let totalConnections = 0;
    for (const connections of this.userConnections.values()) {
      totalConnections += connections.size;
    }

    return {
      totalConnections,
      uniqueUsers: this.userConnections.size,
      pendingMessages: this.pendingMessages.size,
      taskSubscriptions: this.taskSubscriptions.size,
    };
  }
}
