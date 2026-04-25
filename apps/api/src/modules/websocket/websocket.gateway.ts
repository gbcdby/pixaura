import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Interval } from "@nestjs/schedule";
import { WebSocketService } from "./websocket.service";
import { WebSocketAuthMiddleware } from "./websocket-auth.middleware";
import {
  AuthenticatedSocket,
  WebSocketMessageType,
  WebSocketErrorCode,
  CONNECTION_CONFIG,
  PingMessage,
  SyncRequest,
  AckMessage,
  ConnectionEstablishedMessage,
  TokenRefreshRequiredMessage,
  SubscribeScriptTaskMessage,
  UnsubscribeScriptTaskMessage,
} from "./websocket.types";

/**
 * WebSocket Gateway
 * 处理客户端连接、消息路由和心跳检测
 */
@WebSocketGateway({
  namespace: "/ws",
  path: "/ws",
  cors: {
    origin: "*",
    credentials: true,
  },
  pingInterval: CONNECTION_CONFIG.heartbeatInterval,
  pingTimeout: CONNECTION_CONFIG.heartbeatTimeout,
})
export class WebSocketGatewayImpl
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(WebSocketGatewayImpl.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private websocketService: WebSocketService,
    private authMiddleware: WebSocketAuthMiddleware,
    private configService: ConfigService,
  ) {}

  /**
   * Gateway 初始化
   */
  afterInit(server: Server) {
    this.logger.log("WebSocket Gateway 已初始化");
  }

  /**
   * 客户端连接处理
   */
  async handleConnection(client: Socket) {
    try {
      // 认证客户端
      const authResult = await this.authMiddleware.validateClient(client);

      if (!authResult.success) {
        this.logger.warn(
          `[WebSocket] 客户端 ${client.id} 认证失败: ${authResult.errorMessage}`,
        );
        client.emit("error", {
          code: authResult.errorCode || WebSocketErrorCode.TOKEN_EXPIRED,
          message: authResult.errorMessage,
        });
        client.disconnect(true);
        return;
      }

      const userId = authResult.userId!;
      const tokenExpiresAt = authResult.tokenExpiresAt;

      // 检查连接数限制
      const connectionCount = this.websocketService.getConnectionCount(userId);
      if (connectionCount >= CONNECTION_CONFIG.maxConnectionsPerUser) {
        // 断开最早的连接
        const oldestSocketId =
          this.websocketService.getOldestConnection(userId);
        if (oldestSocketId) {
          const oldestSocket = this.websocketService.getSocket(oldestSocketId);
          if (oldestSocket) {
            oldestSocket.emit("error", {
              code: WebSocketErrorCode.CONNECTION_LIMIT_EXCEEDED,
              message: "连接数超限，新连接已建立",
            });
            oldestSocket.disconnect(true);
          }
        }
        this.logger.log(`[WebSocket] 用户 ${userId} 连接数超限，断开最早连接`);
      }

      // 设置客户端数据
      const authClient = client as AuthenticatedSocket;
      authClient.data = {
        userId,
        tokenExpiresAt,
        connectedAt: Date.now(),
      };

      // 注册连接
      this.websocketService.registerConnection(userId, authClient);

      // 发送连接建立消息
      const connectionMsg: ConnectionEstablishedMessage = {
        userId,
        tokenExpiresAt: tokenExpiresAt || Date.now() + 2 * 60 * 60 * 1000, // 默认2小时
        serverTime: Date.now(),
      };

      client.emit(WebSocketMessageType.CONNECTION_ESTABLISHED, {
        code: WebSocketErrorCode.SUCCESS,
        message: "连接成功",
        data: connectionMsg,
        timestamp: Date.now(),
        messageId: this.generateMessageId(),
      });

      this.logger.log(
        `[WebSocket] ${userId} connect success, socket: ${client.id}`,
      );

      // 如果 Token 即将过期，发送刷新通知
      if (
        tokenExpiresAt &&
        this.authMiddleware.shouldRefreshToken(tokenExpiresAt)
      ) {
        this.sendTokenRefreshRequired(client, tokenExpiresAt);
      }
    } catch (error) {
      this.logger.error("[WebSocket] 连接处理错误");
      this.logger.debug("详细错误信息:", error);
      client.emit("error", {
        code: WebSocketErrorCode.INTERNAL_ERROR,
        message: "连接处理失败",
      });
      client.disconnect(true);
    }
  }

  /**
   * 客户端断开连接处理
   */
  handleDisconnect(client: Socket) {
    const authClient = client as AuthenticatedSocket;
    const userId = authClient.data?.userId;

    if (userId) {
      this.websocketService.unregisterConnection(userId, client.id);
      this.logger.log(`[WebSocket] ${userId} disconnect, socket: ${client.id}`);
    } else {
      this.logger.log(`[WebSocket] 匿名客户端断开连接: ${client.id}`);
    }
  }

  /**
   * 心跳检测 - Ping
   */
  @SubscribeMessage(WebSocketMessageType.PING)
  async handlePing(
    @MessageBody() data: PingMessage,
    @ConnectedSocket() client: Socket,
  ) {
    const authClient = client as AuthenticatedSocket;
    const userId = authClient.data?.userId;

    if (!userId) {
      client.emit("error", {
        code: WebSocketErrorCode.TOKEN_EXPIRED,
        message: "未认证",
      });
      return;
    }

    // 检查 Token 是否过期
    const tokenExpiresAt = authClient.data.tokenExpiresAt;
    if (tokenExpiresAt && this.authMiddleware.isTokenExpired(tokenExpiresAt)) {
      client.emit("error", {
        code: WebSocketErrorCode.TOKEN_EXPIRED,
        message: "Token 已过期",
      });
      client.disconnect(true);
      return;
    }

    // 返回 Pong
    client.emit(WebSocketMessageType.PONG, {
      code: WebSocketErrorCode.SUCCESS,
      message: "success",
      data: {
        clientTime: data.clientTime,
        serverTime: Date.now(),
      },
      timestamp: Date.now(),
      messageId: this.generateMessageId(),
    });

    // 如果 Token 即将过期，发送刷新通知
    if (
      tokenExpiresAt &&
      this.authMiddleware.shouldRefreshToken(tokenExpiresAt)
    ) {
      this.sendTokenRefreshRequired(client, tokenExpiresAt);
    }
  }

  /**
   * 同步请求 - 重连后获取错过的消息
   */
  @SubscribeMessage(WebSocketMessageType.SYNC_REQUEST)
  async handleSyncRequest(
    @MessageBody() data: SyncRequest,
    @ConnectedSocket() client: Socket,
  ) {
    const authClient = client as AuthenticatedSocket;
    const userId = authClient.data?.userId;

    if (!userId) {
      client.emit("error", {
        code: WebSocketErrorCode.TOKEN_EXPIRED,
        message: "未认证",
      });
      return;
    }

    try {
      // 获取错过的消息
      const messages = await this.websocketService.getMessages(
        userId,
        data.lastMessageId,
      );

      client.emit(WebSocketMessageType.SYNC_RESPONSE, {
        code: WebSocketErrorCode.SUCCESS,
        message: "success",
        data: {
          messages,
          hasMore: messages.length >= 100, // 如果达到限制，提示可能有更多消息
        },
        timestamp: Date.now(),
        messageId: this.generateMessageId(),
      });

      this.logger.log(
        `[WebSocket] ${userId} 同步消息，返回 ${messages.length} 条`,
      );
    } catch (error) {
      this.logger.error("[WebSocket] 同步消息失败");
      this.logger.debug("详细错误信息:", error);
      client.emit("error", {
        code: WebSocketErrorCode.INTERNAL_ERROR,
        message: "同步消息失败",
      });
    }
  }

  /**
   * ACK 确认
   */
  @SubscribeMessage(WebSocketMessageType.ACK)
  handleAck(
    @MessageBody() data: AckMessage,
    @ConnectedSocket() client: Socket,
  ) {
    const authClient = client as AuthenticatedSocket;
    const userId = authClient.data?.userId;

    if (!userId) {
      return;
    }

    this.websocketService.handleAck(userId, data.messageId);
  }

  /**
   * Token 刷新通知
   */
  @SubscribeMessage("token_refreshed")
  async handleTokenRefreshed(@ConnectedSocket() client: Socket) {
    const authClient = client as AuthenticatedSocket;
    const userId = authClient.data?.userId;

    if (!userId) {
      return;
    }

    // 重新验证 Token 获取新的过期时间
    const authResult = await this.authMiddleware.validateClient(client);

    if (authResult.success && authResult.tokenExpiresAt) {
      authClient.data.tokenExpiresAt = authResult.tokenExpiresAt;
      this.logger.log(`[WebSocket] ${userId} Token 已刷新`);
    }
  }

  /**
   * 发送 Token 刷新通知
   */
  private sendTokenRefreshRequired(client: Socket, expiresAt: number) {
    const data: TokenRefreshRequiredMessage = {
      expiresAt,
    };

    client.emit(WebSocketMessageType.TOKEN_REFRESH_REQUIRED, {
      code: WebSocketErrorCode.TOKEN_NEAR_EXPIRY,
      message: "Token 即将过期",
      data,
      timestamp: Date.now(),
      messageId: this.generateMessageId(),
    });

    this.logger.debug(
      `[WebSocket] 发送 Token 刷新通知，过期时间: ${expiresAt}`,
    );
  }

  /**
   * 定时重试未确认消息
   */
  @Interval(5000) // 每 5 秒执行一次
  async retryPendingMessages() {
    await this.websocketService.retryPendingMessages();
  }

  /**
   * 生成消息ID
   */
  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return this.websocketService.getStats();
  }

  /**
   * 订阅剧本任务
   */
  @SubscribeMessage("subscribe_script_task")
  async handleSubscribeScriptTask(
    @MessageBody() data: SubscribeScriptTaskMessage,
    @ConnectedSocket() client: Socket,
  ) {
    const authClient = client as AuthenticatedSocket;
    const userId = authClient.data?.userId;

    if (!userId) {
      client.emit("error", {
        code: WebSocketErrorCode.TOKEN_EXPIRED,
        message: "未认证",
      });
      return;
    }

    if (!data.taskId) {
      client.emit("error", {
        code: WebSocketErrorCode.INVALID_MESSAGE_FORMAT,
        message: "缺少 taskId 参数",
      });
      return;
    }

    // 订阅任务
    await this.websocketService.subscribeToTask(userId, data.taskId);

    // 发送确认
    client.emit("subscribe_script_task_ack", {
      code: WebSocketErrorCode.SUCCESS,
      message: "success",
      data: {
        taskId: data.taskId,
        type: data.type,
        subscribed: true,
      },
      timestamp: Date.now(),
      messageId: this.generateMessageId(),
    });

    this.logger.log(`[WebSocket] ${userId} 订阅剧本任务: ${data.taskId}`);
  }

  /**
   * 取消订阅剧本任务
   */
  @SubscribeMessage("unsubscribe_script_task")
  async handleUnsubscribeScriptTask(
    @MessageBody() data: UnsubscribeScriptTaskMessage,
    @ConnectedSocket() client: Socket,
  ) {
    const authClient = client as AuthenticatedSocket;
    const userId = authClient.data?.userId;

    if (!userId) {
      client.emit("error", {
        code: WebSocketErrorCode.TOKEN_EXPIRED,
        message: "未认证",
      });
      return;
    }

    if (!data.taskId) {
      client.emit("error", {
        code: WebSocketErrorCode.INVALID_MESSAGE_FORMAT,
        message: "缺少 taskId 参数",
      });
      return;
    }

    // 取消订阅
    await this.websocketService.unsubscribeFromTask(userId, data.taskId);

    // 发送确认
    client.emit("unsubscribe_script_task_ack", {
      code: WebSocketErrorCode.SUCCESS,
      message: "success",
      data: {
        taskId: data.taskId,
        unsubscribed: true,
      },
      timestamp: Date.now(),
      messageId: this.generateMessageId(),
    });

    this.logger.log(`[WebSocket] ${userId} 取消订阅剧本任务: ${data.taskId}`);
  }
}
