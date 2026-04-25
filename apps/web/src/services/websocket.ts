/**
 * WebSocket 客户端服务
 * 基于 Socket.io 实现实时通信
 */
import { io, Socket } from "socket.io-client";
import { ref, computed } from "vue";
import { useAuthStore } from "@/stores/auth";

// WebSocket 连接状态
export type WebSocketStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

// WebSocket 配置选项
interface WebSocketOptions {
  autoConnect?: boolean; // 是否自动连接
  reconnection?: boolean; // 是否自动重连
  reconnectionAttempts?: number; // 最大重连次数（默认 5 次）
  reconnectionDelay?: number; // 初始重连延迟（毫秒）
  reconnectionDelayMax?: number; // 最大重连延迟（毫秒）
}

// 消息处理器类型
type MessageHandler<T = unknown> = (data: T) => void;

// 消息监听器映射
const messageListeners = new Map<string, Set<MessageHandler>>();

// 连接状态（响应式）
const connectionStatus = ref<WebSocketStatus>("disconnected");
const connectionError = ref<string | null>(null);
const lastMessageTime = ref<number>(0);
const reconnectAttempt = ref<number>(0);

// Socket 实例
let socket: Socket | null = null;
let heartbeatInterval: number | null = null;
let tokenRefreshTimeout: number | null = null;

// 默认配置
const defaultOptions: WebSocketOptions = {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5, // 最大重连次数，避免无限重试
  reconnectionDelay: 1000,
  reconnectionDelayMax: 30000,
};

/**
 * 刷新 HTTP Token
 * 当 WebSocket 因 Token 过期断开时调用
 */
async function refreshHttpToken(): Promise<boolean> {
  try {
    const authStore = useAuthStore();
    await authStore.refreshAccessToken();
    return true;
  } catch (error) {
    console.error("[WebSocket] 刷新 Token 失败:", error);
    return false;
  }
}

/**
 * 计算指数退避延迟
 * 用于重连时计算延迟时间
 */
function getReconnectDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
): number {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  // 添加随机抖动，避免所有客户端同时重连
  return delay + Math.random() * 1000;
}

// 导出延迟计算函数供外部使用
export { getReconnectDelay };

/**
 * 设置 Token 刷新定时器
 * 在 Token 过期前 5 分钟主动刷新
 */
function scheduleTokenRefresh(expiresAt: number) {
  if (tokenRefreshTimeout) {
    clearTimeout(tokenRefreshTimeout);
  }

  const now = Date.now();
  const refreshBeforeExpiry = 5 * 60 * 1000; // 5 分钟
  const delay = expiresAt - now - refreshBeforeExpiry;

  if (delay > 0) {
    tokenRefreshTimeout = window.setTimeout(async () => {
      console.log("[WebSocket] Token 即将过期，主动刷新");
      const success = await refreshHttpToken();
      if (success && socket) {
        socket.emit("token_refreshed", { timestamp: Date.now() });
      }
    }, delay);
  }
}

/**
 * 启动心跳检测
 */
function startHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  // 每 30 秒发送一次 ping
  heartbeatInterval = window.setInterval(() => {
    if (socket?.connected) {
      socket.emit("ping", { client_time: Date.now() });
    }
  }, 30000);
}

/**
 * 停止心跳检测
 */
function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

/**
 * 清理 Token 刷新定时器
 */
function clearTokenRefresh() {
  if (tokenRefreshTimeout) {
    clearTimeout(tokenRefreshTimeout);
    tokenRefreshTimeout = null;
  }
}

/**
 * 初始化 Socket 事件监听
 */
function setupSocketListeners(options: WebSocketOptions) {
  if (!socket) return;

  // 连接成功
  socket.on("connect", () => {
    console.log("[WebSocket] 连接成功");
    connectionStatus.value = "connected";
    connectionError.value = null;
    reconnectAttempt.value = 0;
    lastMessageTime.value = Date.now();
    startHeartbeat();
  });

  // 连接断开
  socket.on("disconnect", (reason) => {
    console.log("[WebSocket] 连接断开:", reason);
    connectionStatus.value = "disconnected";
    stopHeartbeat();
    clearTokenRefresh();

    // 如果是因为 Token 过期断开，需要刷新 Token 后重连
    if (reason === "io server disconnect") {
      // 服务端主动断开，检查是否需要刷新 Token
      const errorCode = (socket as any).io?.engine?.transport?.pollResponse
        ?.status;
      if (errorCode === 401) {
        handleTokenExpiredReconnect(options);
      }
    }
  });

  // 连接错误
  socket.on("connect_error", (error) => {
    console.error("[WebSocket] 连接错误:", error.message);
    connectionStatus.value = "error";
    connectionError.value = error.message;
  });

  // 重连中
  socket.on("reconnecting", (attempt) => {
    console.log(`[WebSocket] 第 ${attempt} 次重连...`);
    connectionStatus.value = "reconnecting";
    reconnectAttempt.value = attempt;
  });

  // 重连成功
  socket.on("reconnect", (attempt) => {
    console.log(`[WebSocket] 第 ${attempt} 次重连成功`);
    connectionStatus.value = "connected";
    reconnectAttempt.value = 0;
    // 重连后请求同步错过的消息
    requestSync();
  });

  // 重连失败
  socket.on("reconnect_failed", () => {
    console.error("[WebSocket] 重连失败");
    connectionStatus.value = "error";
    connectionError.value = "重连失败，请刷新页面重试";
  });

  // 连接建立成功通知
  socket.on("connection_established", (data) => {
    console.log("[WebSocket] 连接已建立:", data);
    if (data.token_expires_at) {
      scheduleTokenRefresh(data.token_expires_at);
    }
    // 通知所有监听器
    emitToListeners("connection_established", data);
  });

  // Token 刷新提醒
  socket.on("token_refresh_required", async (data) => {
    console.log("[WebSocket] Token 即将过期:", data);
    const success = await refreshHttpToken();
    if (success && socket) {
      socket.emit("token_refreshed", { timestamp: Date.now() });
    }
  });

  // 心跳响应
  socket.on("pong", (data) => {
    lastMessageTime.value = Date.now();
    const latency = Date.now() - data.client_time;
    console.debug("[WebSocket] 心跳延迟:", latency, "ms");
  });

  // 同步响应
  socket.on("sync_response", (data) => {
    console.log("[WebSocket] 同步响应:", data);
    if (data.messages && Array.isArray(data.messages)) {
      data.messages.forEach((msg: { type: string; data: unknown }) => {
        emitToListeners(msg.type, msg.data);
      });
    }
    if (data.partial_sync) {
      console.warn("[WebSocket] 部分消息可能已丢失");
    }
  });

  // 生成任务进度
  socket.on("generation_progress", (data) => {
    lastMessageTime.value = Date.now();
    emitToListeners("generation_progress", data);
    // 发送 ACK
    sendAck(data.message_id);
  });

  // 生成任务完成
  socket.on("generation_complete", (data) => {
    lastMessageTime.value = Date.now();
    emitToListeners("generation_complete", data);
    sendAck(data.message_id);
  });

  // 生成任务失败
  socket.on("generation_failed", (data) => {
    lastMessageTime.value = Date.now();
    emitToListeners("generation_failed", data);
    sendAck(data.message_id);
  });

  // 导出任务进度
  socket.on("export_progress", (data) => {
    lastMessageTime.value = Date.now();
    emitToListeners("export_progress", data);
    sendAck(data.message_id);
  });

  // 导出任务完成
  socket.on("export_complete", (data) => {
    lastMessageTime.value = Date.now();
    emitToListeners("export_complete", data);
    sendAck(data.message_id);
  });

  // 导出任务失败
  socket.on("export_failed", (data) => {
    lastMessageTime.value = Date.now();
    emitToListeners("export_failed", data);
    sendAck(data.message_id);
  });

  // 额度告警
  socket.on("quota_warning", (data) => {
    lastMessageTime.value = Date.now();
    emitToListeners("quota_warning", data);
  });

  // 系统通知
  socket.on("system_notification", (data) => {
    lastMessageTime.value = Date.now();
    emitToListeners("system_notification", data);
  });

  // 错误消息
  socket.on("error", (data) => {
    console.error("[WebSocket] 错误:", data);
    emitToListeners("error", data);
  });
}

/**
 * 处理 Token 过期重连
 */
async function handleTokenExpiredReconnect(options: WebSocketOptions) {
  console.log("[WebSocket] Token 过期，尝试刷新后重连");
  connectionStatus.value = "reconnecting";

  const success = await refreshHttpToken();
  if (success) {
    // Token 刷新成功，重新连接
    await connect(options);
  } else {
    // Token 刷新失败，需要重新登录
    connectionStatus.value = "error";
    connectionError.value = "登录已过期，请重新登录";
    // 可以在这里触发全局登录过期事件
  }
}

/**
 * 向所有监听器发送消息
 */
function emitToListeners<T>(type: string, data: T) {
  const handlers = messageListeners.get(type);
  if (handlers) {
    handlers.forEach((handler) => {
      try {
        handler(data);
      } catch (error) {
        console.error(`[WebSocket] 消息处理器错误 (${type}):`, error);
      }
    });
  }
}

/**
 * 发送 ACK 确认
 */
function sendAck(messageId: string) {
  if (socket?.connected) {
    socket.emit("ack", { message_id: messageId });
  }
}

/**
 * 请求同步错过的消息
 */
function requestSync() {
  if (socket?.connected) {
    // TODO: 从本地存储获取最后收到的消息 ID
    const lastMessageId = localStorage.getItem("ws_last_message_id") || "";
    socket.emit("sync_request", { last_message_id: lastMessageId });
  }
}

/**
 * 从 Cookie 中获取 accessToken
 */
function getAccessTokenFromCookie(): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; accessToken=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
  return null;
}

/**
 * 连接 WebSocket
 */
async function connect(options: WebSocketOptions = {}): Promise<void> {
  const opts = { ...defaultOptions, ...options };

  // 如果已连接，先断开
  if (socket?.connected) {
    disconnect();
  }

  try {
    connectionStatus.value = "connecting";

    // 获取认证 Token
    const token = getAccessTokenFromCookie();
    if (!token) {
      console.error("[WebSocket] 未找到 accessToken，无法建立连接");
      connectionStatus.value = "error";
      connectionError.value = "未登录，无法建立 WebSocket 连接";
      return;
    }

    // 创建 Socket.io 连接
    // 注意：后端 Gateway 配置了 namespace: "/ws" 和 path: "/ws"，需要显式指定
    // 通过 auth.token 传递认证信息
    socket = io("/ws", {
      path: "/ws", // 后端 Gateway 配置了 path: "/ws"
      transports: ["websocket"],
      reconnection: opts.reconnection,
      reconnectionAttempts: opts.reconnectionAttempts,
      reconnectionDelay: opts.reconnectionDelay,
      reconnectionDelayMax: opts.reconnectionDelayMax,
      randomizationFactor: 0.5,
      auth: {
        token: `Bearer ${token}`,
      },
    });

    setupSocketListeners(opts);
  } catch (error) {
    console.error("[WebSocket] 连接失败:", error);
    connectionStatus.value = "error";
    connectionError.value = error instanceof Error ? error.message : "连接失败";
    throw error;
  }
}

/**
 * 断开 WebSocket 连接
 */
function disconnect(): void {
  stopHeartbeat();
  clearTokenRefresh();

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  connectionStatus.value = "disconnected";
}

/**
 * 订阅消息
 */
function subscribe<T>(type: string, handler: MessageHandler<T>): () => void {
  if (!messageListeners.has(type)) {
    messageListeners.set(type, new Set());
  }

  const handlers = messageListeners.get(type)!;
  const wrappedHandler = handler as MessageHandler;
  handlers.add(wrappedHandler);

  // 返回取消订阅函数
  return () => {
    handlers.delete(wrappedHandler);
    if (handlers.size === 0) {
      messageListeners.delete(type);
    }
  };
}

/**
 * 发送消息
 */
function emit<T>(event: string, data?: T): void {
  if (!socket?.connected) {
    console.warn("[WebSocket] 未连接，无法发送消息");
    return;
  }

  socket.emit(event, data);
}

/**
 * 检查是否已连接
 */
function isConnected(): boolean {
  return socket?.connected ?? false;
}

// 导出 WebSocket 服务
export const websocketService = {
  // 状态
  status: computed(() => connectionStatus.value),
  error: computed(() => connectionError.value),
  lastMessageTime: computed(() => lastMessageTime.value),
  reconnectAttempt: computed(() => reconnectAttempt.value),

  // 方法
  connect,
  disconnect,
  subscribe,
  emit,
  isConnected,
};

// 默认导出
export default websocketService;
