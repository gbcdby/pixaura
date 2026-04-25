/**
 * WebSocket Store
 * 基于 Socket.io-client 的 WebSocket 连接管理
 *
 * 重构版本：
 * - 新增 registerHandler 统一事件分发机制
 * - 新增 subscribeScriptTask 带持久化的脚本任务订阅
 * - 新增离线消息同步（requestSync/sync_response）
 * - 统一监听所有 WsEventNames 定义的事件
 */
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { io, Socket } from "socket.io-client";
import { useAuthStore } from "./auth";
import { WsEventNames } from "@pixaura/shared-types";

// WebSocket 连接状态
export type WebSocketConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "disconnecting"
  | "error";

// ==================== 类型定义 ====================

// 消息处理器类型
export type MessageHandler = (data: unknown) => void;

// 进度回调函数类型
type ProgressCallback = (data: GenerationProgressData) => void;
type CompleteCallback = (data: GenerationCompleteData) => void;
type FailedCallback = (data: GenerationFailedData) => void;

// 生成进度数据
export interface GenerationProgressData {
  taskId: string;
  projectId: string;
  taskType: "image_gen" | "video_gen";
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  currentStep: string;
  message?: string;
  metadata?: Record<string, string>;
  timestamp: string;
}

// 生成完成数据
export interface GenerationCompleteData {
  taskId: string;
  projectId: string;
  taskType: "image_gen" | "video_gen";
  resultUrl: string;
  metadata?: Record<string, string>;
  timestamp: string;
}

// 生成失败数据
export interface GenerationFailedData {
  taskId: string;
  projectId: string;
  taskType: "image_gen" | "video_gen";
  errorCode: number;
  errorMessage: string;
  retryable?: boolean;
  timestamp: string;
}

// 任务回调接口
interface TaskCallbacks {
  onProgress?: ProgressCallback;
  onComplete?: CompleteCallback;
  onFailed?: FailedCallback;
}

// 任务订阅内部存储结构
interface TaskSubscriptionInternal {
  taskId: string;
  unsubscribers: (() => void)[];
}

// 脚本任务订阅结构（带持久化）
interface ScriptTaskSubscription {
  taskId: string;
  scriptId: string;
  type: "generate" | "parse" | "edit";
}

// 离线消息 ID 存储键
const MESSAGE_ID_STORAGE_KEY = "ws_last_message_id";

export const useWebSocketStore = defineStore("websocket", () => {
  // ==================== State ====================
  const socket = ref<Socket | null>(null);
  const status = ref<WebSocketConnectionStatus>("disconnected");
  const error = ref<string | null>(null);
  const reconnectCount = ref(0);
  const lastPingTime = ref<number>(0);

  // ==================== 新增：统一事件分发机制 ====================

  // 事件处理器映射（唯一存储）
  const eventHandlers = new Map<string, Set<MessageHandler>>();

  // 全局通知处理器（由 App.vue 设置）
  let notificationHandler: ((event: string, data: unknown) => void) | null =
    null;

  // 任务订阅存储（通用任务）
  const taskSubscriptions = new Map<string, TaskSubscriptionInternal>();

  // 脚本任务订阅存储（用于重连时自动重新订阅）
  const scriptTaskSubscriptions = ref<Map<string, ScriptTaskSubscription>>(
    new Map(),
  );

  // 最后收到的消息 ID（用于离线消息同步）
  const lastMessageId = ref<string>("");

  // 重连配置
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000; // 1秒
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  // ==================== Getters ====================
  const isConnected = computed(() => status.value === "connected");
  const isConnecting = computed(() => status.value === "connecting");
  const isReconnecting = computed(() => reconnectCount.value > 0);
  const hasError = computed(() => status.value === "error");
  const connectionStatusText = computed(() => {
    switch (status.value) {
      case "connected":
        return "已连接";
      case "connecting":
        return "连接中...";
      case "disconnecting":
        return "断开中...";
      case "error":
        return "连接错误";
      default:
        return "未连接";
    }
  });

  // ==================== 新增：事件分发核心方法 ====================

  /**
   * 注册事件处理器（唯一底层 API）
   * @param event 事件名称
   * @param handler 处理函数
   * @returns 取消注册函数
   */
  function registerHandler(event: string, handler: MessageHandler): () => void {
    if (!eventHandlers.has(event)) {
      eventHandlers.set(event, new Set());
    }
    eventHandlers.get(event)!.add(handler);

    console.log(`[WebSocket] 注册事件处理器: ${event}`);

    return () => {
      eventHandlers.get(event)?.delete(handler);
      console.log(`[WebSocket] 取消事件处理器: ${event}`);
    };
  }

  /**
   * 设置全局通知处理器（由 App.vue 调用）
   * 当消息没有页面处理器时，调用此处理器显示通知
   */
  function setNotificationHandler(
    handler: (event: string, data: unknown) => void,
  ): void {
    notificationHandler = handler;
    console.log("[WebSocket] 设置全局通知处理器");
  }

  /**
   * 分发消息到处理器或全局通知
   * @returns true 表示已由页面处理器处理，false 表示已调用全局通知
   */
  function dispatchMessage(event: string, data: unknown): boolean {
    // 更新最后消息 ID（用于离线消息同步）
    const messageId = (data as any)?.messageId;
    if (messageId) {
      lastMessageId.value = messageId;
      localStorage.setItem(MESSAGE_ID_STORAGE_KEY, messageId);
    }

    // 1. 尝试调用已注册的处理器
    const handlers = eventHandlers.get(event);
    if (handlers && handlers.size > 0) {
      handlers.forEach((h) => {
        try {
          h(data);
        } catch (err) {
          console.error(`[WebSocket] 处理器错误 (${event}):`, err);
        }
      });
      console.log(
        `[WebSocket] 消息已分发到 ${handlers.size} 个处理器: ${event}`,
      );
      return true; // 已处理
    }

    // 2. 没有处理器，调用全局通知
    if (notificationHandler) {
      notificationHandler(event, data);
      console.log(`[WebSocket] 消息已转发到全局通知: ${event}`);
    } else {
      console.warn(`[WebSocket] 消息无处理器且无全局通知: ${event}`, data);
    }
    return false; // 已通知或未处理
  }

  // ==================== Actions ====================

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
   * 建立 WebSocket 连接
   */
  async function connect(): Promise<void> {
    if (status.value === "connected" || status.value === "connecting") {
      // 如果正在连接，等待连接完成
      if (status.value === "connecting") {
        console.log("[WebSocket] 正在连接中，等待连接完成...");
        await new Promise<void>((resolve) => {
          const checkInterval = setInterval(() => {
            if (status.value === "connected") {
              clearInterval(checkInterval);
              resolve();
            } else if (
              status.value === "error" ||
              status.value === "disconnected"
            ) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);
          // 最多等待 5 秒
          setTimeout(() => {
            clearInterval(checkInterval);
            resolve();
          }, 5000);
        });
      }
      return;
    }

    try {
      status.value = "connecting";
      error.value = null;

      // 获取认证 Token
      const token = getAccessTokenFromCookie();
      if (!token) {
        console.error("[WebSocket] 未找到 accessToken，无法建立连接");
        status.value = "error";
        error.value = "未登录，无法建立 WebSocket 连接";
        return;
      }

      // 创建 Socket.io 连接
      // 注意：后端 Gateway 配置了 namespace: "/ws" 和 path: "/ws"，需要显式指定
      // 通过 auth.token 传递认证信息
      socket.value = io("/ws", {
        path: "/ws", // 后端 Gateway 配置了 path: "/ws"
        transports: ["websocket"],
        reconnection: false, // 我们手动管理重连
        auth: {
          token: `Bearer ${token}`,
        },
      });

      // 设置事件监听
      setupSocketListeners();

      // 等待连接完成
      await new Promise<void>((resolve) => {
        const socketVal = socket.value;
        if (!socketVal) {
          resolve();
          return;
        }

        // 如果已经连接
        if (socketVal.connected) {
          status.value = "connected";
          resolve();
          return;
        }

        // 等待连接事件
        const onConnect = () => {
          cleanup();
          resolve();
        };
        const onError = () => {
          cleanup();
          resolve();
        };
        const cleanup = () => {
          socketVal?.off("connect", onConnect);
          socketVal?.off("connect_error", onError);
        };

        socketVal.on("connect", onConnect);
        socketVal.on("connect_error", onError);

        // 最多等待 5 秒
        setTimeout(() => {
          cleanup();
          resolve();
        }, 5000);
      });

      console.log("[WebSocket] connect() 完成, status:", status.value);
    } catch (err) {
      status.value = "error";
      error.value = err instanceof Error ? err.message : "连接失败";
      console.error("[WebSocket] 连接失败:", err);
      throw err;
    }
  }

  /**
   * 断开 WebSocket 连接
   */
  function disconnect(): void {
    if (status.value === "disconnecting" || status.value === "disconnected") {
      return;
    }

    status.value = "disconnecting";

    // 清除重连定时器
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    // 清除心跳定时器
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }

    // 断开连接
    if (socket.value) {
      socket.value.disconnect();
      socket.value = null;
    }

    // 清空任务订阅（通用任务）
    taskSubscriptions.clear();

    // 清空脚本任务订阅（可选，根据需求决定）
    // scriptTaskSubscriptions.value.clear();

    // Bug 修复：不清空事件处理器，保持业务层注册的处理器
    // 这样在 WebSocket 重连后可以继续接收事件
    // 如果清空了 eventHandlers，而 wsListenersInitialized 未重置，会导致重连后事件无法被处理
    // eventHandlers.clear();

    status.value = "disconnected";
    reconnectCount.value = 0;
    console.log("[WebSocket] 已断开连接");
  }

  /**
   * 手动重连
   */
  async function reconnect(): Promise<void> {
    console.log("[WebSocket] 手动重连");
    disconnect();
    reconnectCount.value = 0;
    await connect();
  }

  // ==================== 新增：脚本任务订阅管理 ====================

  /**
   * 订阅脚本任务（带持久化，重连自动恢复）
   * @param taskId 任务 ID
   * @param scriptId 剧本 ID
   * @param type 任务类型：generate | parse | edit
   * @returns 取消订阅函数
   */
  function subscribeScriptTask(
    taskId: string,
    scriptId: string,
    type: "generate" | "parse" | "edit" = "generate",
  ): () => void {
    // 存储订阅信息
    scriptTaskSubscriptions.value.set(taskId, { taskId, scriptId, type });

    // 发送订阅请求
    if (socket.value?.connected) {
      socket.value.emit("subscribe_script_task", { taskId, type });
      console.log(`[WebSocket] 订阅脚本任务: ${taskId}, type: ${type}`);
    }

    // 返回取消订阅函数
    return () => {
      scriptTaskSubscriptions.value.delete(taskId);
      if (socket.value?.connected) {
        socket.value.emit("unsubscribe_script_task", { taskId });
        console.log(`[WebSocket] 取消订阅脚本任务: ${taskId}`);
      }
    };
  }

  /**
   * 重新订阅所有脚本任务（重连后调用）
   */
  function resubscribeAllScriptTasks(): void {
    if (!socket.value?.connected) return;

    scriptTaskSubscriptions.value.forEach((sub) => {
      socket.value!.emit("subscribe_script_task", {
        taskId: sub.taskId,
        type: sub.type,
      });
      console.log(`[WebSocket] 重连后重新订阅脚本任务: ${sub.taskId}`);
    });
  }

  // ==================== 重构：subscribe 使用 registerHandler ====================

  /**
   * 订阅任务进度（便捷封装）
   * 内部使用 registerHandler，按 taskId 过滤
   * 用于通用生成任务（image_gen/video_gen）
   */
  function subscribe(taskId: string, callbacks: TaskCallbacks): void {
    // 已存在则先取消
    if (taskSubscriptions.has(taskId)) {
      unsubscribe(taskId);
    }

    const unsubscribers: (() => void)[] = [];

    // 进度事件（通用 generation_progress，兼容旧版）
    unsubscribers.push(
      registerHandler(WsEventNames.GENERATION_PROGRESS, (data: unknown) => {
        const progressData = data as GenerationProgressData;
        if (progressData.taskId === taskId) {
          callbacks.onProgress?.(progressData);
        }
      }),
    );

    // 资产图片生成进度事件（后端使用 asset:image-progress 发送所有状态）
    unsubscribers.push(
      registerHandler(
        WsEventNames.ASSET_IMAGE_PROGRESS,
        (data: unknown) => {
          const assetData = data as {
            taskId: string;
            status: string;
            progress?: number;
            resultUrl?: string;
            error?: string;
            [key: string]: unknown;
          };
          if (assetData.taskId !== taskId) return;

          if (assetData.status === "processing") {
            callbacks.onProgress?.({
              taskId: assetData.taskId,
              projectId: (assetData.projectId as string) || "",
              taskType: "image_gen",
              status: "processing",
              progress: assetData.progress ?? 0,
              currentStep: "生成中",
              message: "",
              timestamp: (assetData.timestamp as string) || "",
            });
          } else if (assetData.status === "completed") {
            callbacks.onComplete?.({
              taskId: assetData.taskId,
              projectId: (assetData.projectId as string) || "",
              taskType: "image_gen",
              resultUrl: assetData.resultUrl || "",
              timestamp: (assetData.timestamp as string) || "",
            });
            unsubscribe(taskId);
          } else if (assetData.status === "failed") {
            callbacks.onFailed?.({
              taskId: assetData.taskId,
              projectId: (assetData.projectId as string) || "",
              taskType: "image_gen",
              errorCode: 500,
              errorMessage: assetData.error || "生成失败",
              retryable: true,
              timestamp: (assetData.timestamp as string) || "",
            });
            unsubscribe(taskId);
          }
        },
      ),
    );

    // 完成事件
    unsubscribers.push(
      registerHandler(WsEventNames.GENERATION_COMPLETE, (data: unknown) => {
        const completeData = data as GenerationCompleteData;
        if (completeData.taskId === taskId) {
          callbacks.onComplete?.(completeData);
          // 完成后自动取消订阅
          unsubscribe(taskId);
        }
      }),
    );

    // 失败事件
    unsubscribers.push(
      registerHandler(WsEventNames.GENERATION_FAILED, (data: unknown) => {
        const failedData = data as GenerationFailedData;
        if (failedData.taskId === taskId) {
          callbacks.onFailed?.(failedData);
          // 失败后自动取消订阅
          unsubscribe(taskId);
        }
      }),
    );

    taskSubscriptions.set(taskId, { taskId, unsubscribers });

    // 发送订阅请求到后端
    if (socket.value?.connected) {
      socket.value.emit("subscribe_task", { taskId });
      console.log(`[WebSocket] 订阅任务: ${taskId}`);
    }
  }

  /**
   * 取消订阅任务
   */
  function unsubscribe(taskId: string): void {
    const subscription = taskSubscriptions.get(taskId);
    if (subscription) {
      subscription.unsubscribers.forEach((fn) => fn());
      taskSubscriptions.delete(taskId);
    }

    // 发送取消订阅到后端
    if (socket.value?.connected) {
      socket.value.emit("unsubscribe_task", { taskId });
      console.log(`[WebSocket] 取消订阅任务: ${taskId}`);
    }
  }

  // ==================== 新增：离线消息同步 ====================

  /**
   * 连接成功后请求同步离线消息
   */
  function requestSync(): void {
    if (!socket.value?.connected) return;

    const storedLastId = localStorage.getItem(MESSAGE_ID_STORAGE_KEY) || "";
    console.log("[WebSocket] 请求离线消息同步，lastMessageId:", storedLastId);

    socket.value.emit("sync_request", { last_message_id: storedLastId });
  }

  /**
   * 设置 Socket 事件监听
   * 统一监听所有 WsEventNames 定义的事件
   */
  function setupSocketListeners(): void {
    if (!socket.value) return;

    // 添加全局消息监听器用于调试
    socket.value.onAny((eventName, ...args) => {
      console.log(`[WebSocket] 收到事件: ${eventName}`, args);
    });

    // 连接成功
    socket.value.on("connect", () => {
      console.log("[WebSocket] 连接成功");
      status.value = "connected";
      error.value = null;
      reconnectCount.value = 0;
      lastPingTime.value = Date.now();

      // 启动心跳
      startHeartbeat();

      // 重新订阅所有任务
      resubscribeAll();
      resubscribeAllScriptTasks();

      // 请求离线消息同步
      requestSync();
    });

    // 连接断开
    socket.value.on("disconnect", (reason) => {
      console.log("[WebSocket] 连接断开:", reason);
      status.value = "disconnected";

      // 清除心跳
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }

      // 如果不是手动断开，尝试重连
      if (reason !== "io client disconnect") {
        scheduleReconnect();
      }
    });

    // 连接错误
    socket.value.on("connect_error", (err) => {
      console.error("[WebSocket] 连接错误:", err.message);
      status.value = "error";
      error.value = err.message;
      scheduleReconnect();
    });

    // ==================== 新增：统一监听所有业务事件 ====================

    // 定义需要监听的所有事件
    const eventsToListen = [
      // 通用生成任务
      WsEventNames.GENERATION_PROGRESS,
      WsEventNames.GENERATION_COMPLETE,
      WsEventNames.GENERATION_FAILED,

      // 剧本相关
      WsEventNames.SCRIPT_GENERATE_PROGRESS,
      WsEventNames.SCRIPT_GENERATE_DONE,
      WsEventNames.SCRIPT_GENERATE_FAILED,
      WsEventNames.SCRIPT_PARSE_PROGRESS,
      WsEventNames.SCRIPT_EDIT_PROGRESS,

      // 资产相关
      WsEventNames.ASSET_IMAGE_PROGRESS,
      WsEventNames.ASSET_VIDEO_PROGRESS,
      WsEventNames.ASSET_CHARACTER_UPDATE,
      WsEventNames.ASSET_SCENE_UPDATE,
      WsEventNames.ASSET_PROP_UPDATE,
      WsEventNames.ASSET_STORYBOARD_UPDATE,
      WsEventNames.ASSET_CHARACTER_DELETE,
      WsEventNames.ASSET_SCENE_DELETE,
      WsEventNames.ASSET_PROP_DELETE,
      WsEventNames.ASSET_STORYBOARD_DELETE,

      // 分镜相关
      // 注意：直接使用字符串常量，避免 shared-types 构建问题导致 undefined
      "storyboard:generate-progress",
      "storyboard:generate-done",
      "storyboard:generate-failed",
      "storyboard:parse-progress",

      // 分镜组相关（重构后新增）
      WsEventNames.SHOTGROUP_SUBJECTS_DETECTED,
      WsEventNames.SHOT_VIDEO_PROGRESS,

      // 导出相关
      WsEventNames.EXPORT_PROGRESS,
      WsEventNames.EXPORT_COMPLETE,
      WsEventNames.EXPORT_FAILED,
      WsEventNames.EXPORT_BATCH_PROGRESS,

      // 系统通知
      WsEventNames.QUOTA_WARNING,
      WsEventNames.SYSTEM_NOTIFICATION,
    ];

    // 统一监听所有事件，通过 dispatchMessage 分发
    eventsToListen.forEach((event) => {
      socket.value!.on(event, (data: unknown) => {
        console.log(`[WebSocket] 收到事件 ${event}:`, data);
        dispatchMessage(event, data);
      });
    });

    // ==================== 系统事件监听 ====================

    // 订阅成功响应
    socket.value.on(
      "subscribed",
      (data: { taskId: string; success: boolean; error?: string }) => {
        if (data.success) {
          console.log(`[WebSocket] 订阅成功: ${data.taskId}`);
        } else {
          console.error(`[WebSocket] 订阅失败: ${data.taskId}, ${data.error}`);
        }
      },
    );

    // 取消订阅响应
    socket.value.on(
      "unsubscribed",
      (data: { taskId: string; success: boolean }) => {
        console.log(`[WebSocket] 取消订阅成功: ${data.taskId}`);
      },
    );

    // 心跳响应
    socket.value.on("pong", (_data: { server_time: number }) => {
      lastPingTime.value = Date.now();
    });

    // 通用 message 事件处理器（后端通过 sendToUser 发送的任务消息）
    socket.value.on("message", (data: unknown) => {
      const msg = data as {
        code?: number;
        message?: string;
        data?: {
          taskId?: string;
          projectId?: string;
          taskType?: string;
          status?: string;
          progress?: number;
          resultUrl?: string;
          metadata?: Record<string, string>;
        };
        timestamp?: string;
        messageId?: string;
        event?: string; // 某些消息可能包含 event 字段
      };

      // 尝试提取 taskId
      const taskId = msg.data?.taskId;
      if (!taskId) {
        return; // 不是任务消息，跳过
      }

      const subscription = taskSubscriptions.get(taskId);
      if (!subscription) {
        return; // 没有订阅该任务
      }

      const innerData = msg.data!;
      const status = innerData.status || "";

      // 后端完成消息可能没有 status 字段，但有 resultUrl
      if (status === "processing") {
        // 进度更新
        const progressData: GenerationProgressData = {
          taskId,
          projectId: innerData.projectId || "",
          taskType: "image_gen",
          status: "processing",
          progress: innerData.progress ?? 0,
          currentStep: "生成中",
          message: "",
          timestamp: msg.timestamp || "",
        };
        // 通过 GENERATION_PROGRESS 事件分发（触发 subscribe 注册的 onProgress 回调）
        const handlers = eventHandlers.get(WsEventNames.GENERATION_PROGRESS);
        handlers?.forEach((h) => h(progressData));
      } else if (status === "completed" || innerData.resultUrl) {
        // 任务完成（兼容有 status 和无 status 只有 resultUrl 的情况）
        const completeData: GenerationCompleteData = {
          taskId,
          projectId: innerData.projectId || "",
          taskType: "image_gen",
          resultUrl: innerData.resultUrl || "",
          metadata: innerData.metadata,
          timestamp: msg.timestamp || "",
        };
        const handlers = eventHandlers.get(WsEventNames.GENERATION_COMPLETE);
        handlers?.forEach((h) => h(completeData));
      } else if (status === "failed") {
        // 任务失败
        const failedData: GenerationFailedData = {
          taskId,
          projectId: innerData.projectId || "",
          taskType: "image_gen",
          errorCode: 500,
          errorMessage: msg.message || "生成失败",
          retryable: true,
          timestamp: msg.timestamp || "",
        };
        const handlers = eventHandlers.get(WsEventNames.GENERATION_FAILED);
        handlers?.forEach((h) => h(failedData));
      }
    });

    // 错误消息
    socket.value.on("error", (data: { code: number; message: string }) => {
      console.error("[WebSocket] 错误:", data);
      handleError(data.code, data.message);
    });

    // Token 刷新提醒
    socket.value.on("token_refresh_required", async () => {
      console.log("[WebSocket] Token 即将过期，刷新中...");
      try {
        const authStore = useAuthStore();
        await authStore.refreshAccessToken();
        // 刷新成功后重新连接
        await reconnect();
      } catch (err) {
        console.error("[WebSocket] Token 刷新失败:", err);
      }
    });

    // ==================== 新增：离线消息同步响应 ====================

    socket.value.on(
      "sync_response",
      (data: {
        messages?: Array<{ event: string; data: unknown; messageId: string }>;
        hasMore?: boolean;
      }) => {
        const messages = data?.messages || [];
        console.log(`[WebSocket] 同步响应: ${messages.length} 条离线消息`);

        // 按顺序处理错过的消息
        messages.forEach((msg) => {
          // 更新 lastMessageId
          lastMessageId.value = msg.messageId;
          localStorage.setItem(MESSAGE_ID_STORAGE_KEY, msg.messageId);

          // 分发消息
          dispatchMessage(msg.event, msg.data);
        });

        if (data?.hasMore) {
          console.warn("[WebSocket] 还有更多离线消息，建议再次请求");
          // 可选：再次请求同步
          requestSync();
        }
      },
    );
  }

  /**
   * 启动心跳检测
   */
  function startHeartbeat(): void {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
    }

    // 每 30 秒发送一次 ping
    heartbeatTimer = setInterval(() => {
      if (socket.value?.connected) {
        socket.value.emit("ping", { client_time: Date.now() });
      }
    }, 30000);
  }

  /**
   * 安排重连（指数退避）
   */
  function scheduleReconnect(): void {
    if (reconnectCount.value >= maxReconnectAttempts) {
      console.error("[WebSocket] 重连次数已达上限");
      status.value = "error";
      error.value = "连接失败，请手动重试";
      return;
    }

    reconnectCount.value++;

    // 指数退避：1s, 2s, 4s, 8s, 16s
    const delay = Math.min(
      baseReconnectDelay * Math.pow(2, reconnectCount.value - 1),
      30000, // 最大 30 秒
    );

    console.log(
      `[WebSocket] ${delay}ms 后第 ${reconnectCount.value} 次重连...`,
    );

    reconnectTimer = setTimeout(() => {
      connect().catch(() => {
        // 连接失败会继续触发 scheduleReconnect
      });
    }, delay);
  }

  /**
   * 重新订阅所有任务（重连后）
   */
  function resubscribeAll(): void {
    if (!socket.value?.connected) return;

    taskSubscriptions.forEach((subscription) => {
      socket.value!.emit("subscribe_task", { taskId: subscription.taskId });
      console.log(`[WebSocket] 重新订阅任务: ${subscription.taskId}`);
    });
  }

  /**
   * 处理错误
   */
  function handleError(code: number, message: string): void {
    switch (code) {
      case 4001: // TOKEN_EXPIRED
        // Token 过期，刷新后重连
        reconnect();
        break;
      case 4002: // CONNECTION_LIMIT_EXCEEDED
        error.value = "连接数超限，请关闭其他页面后重试";
        break;
      case 4202: // TASK_ACCESS_DENIED
        // 无权访问任务，不做特殊处理
        break;
      default:
        error.value = message;
    }
  }

  return {
    // State
    status,
    error,
    reconnectCount,
    socket: computed(() => socket.value),
    lastMessageId,

    // Getters
    isConnected,
    isConnecting,
    isReconnecting,
    hasError,
    connectionStatusText,

    // 核心方法
    connect,
    disconnect,
    reconnect,

    // 事件处理（新增）
    registerHandler,
    setNotificationHandler,
    dispatchMessage,

    // 任务订阅（重构）
    subscribe,
    unsubscribe,

    // 脚本任务订阅（新增）
    subscribeScriptTask,
    resubscribeAllScriptTasks,

    // 离线消息同步（新增）
    requestSync,
  };
});
