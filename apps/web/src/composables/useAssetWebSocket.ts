/**
 * 资产 WebSocket 组合式函数
 * 管理资产生成的 WebSocket 连接和消息处理
 */
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useWebSocketStore } from "@/stores/websocket";

// 资产生成进度数据
export interface AssetGenerationProgressData {
  taskId: string;
  assetType: "character" | "scene" | "prop";
  assetId: string;
  type: "character_views" | "scene_panorama" | "scene_variant" | "prop_views";
  status: "started" | "progress" | "view_completed" | "completed" | "failed";
  progress?: {
    total: number;
    completed: number;
    failed: number;
    percentage: number;
  };
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

// 回调函数类型
export type AssetProgressCallback = (data: AssetGenerationProgressData) => void;

export function useAssetWebSocket() {
  const wsStore = useWebSocketStore();

  // 状态
  const isConnected = computed(() => wsStore.isConnected);
  const connectionStatus = computed(() => wsStore.connectionStatusText);

  // 回调存储
  const assetCallbacks = ref<Map<string, AssetProgressCallback>>(new Map());

  /**
   * 处理资产生成进度消息
   */
  const handleAssetProgress = (data: AssetGenerationProgressData) => {
    const callback = assetCallbacks.value.get(data.taskId);
    if (callback) {
      callback(data);
    }
  };

  /**
   * 设置 WebSocket 事件监听
   */
  const setupEventListeners = () => {
    const socket = wsStore.socket;
    if (!socket) return;

    // 资产生成进度事件
    socket.on(
      "asset:generation-progress",
      (data: AssetGenerationProgressData) => {
        console.log("[WebSocket] 资产生成进度:", data);
        handleAssetProgress(data);
      },
    );
  };

  /**
   * 连接到 WebSocket
   */
  const connect = async () => {
    if (!isConnected.value) {
      await wsStore.connect();
      setupEventListeners();
    }
  };

  /**
   * 断开 WebSocket 连接
   */
  const disconnect = () => {
    assetCallbacks.value.clear();
    // 注意：这里不主动断开全局 WebSocket，只清理回调
  };

  /**
   * 订阅资产生成任务
   */
  const subscribeAssetTask = (
    taskId: string,
    callback: AssetProgressCallback,
  ) => {
    assetCallbacks.value.set(taskId, callback);

    // 发送订阅消息到服务器
    const socket = wsStore.socket;
    if (socket?.connected) {
      socket.emit("subscribe_asset_task", { taskId });
    }

    // 返回取消订阅函数
    return () => {
      assetCallbacks.value.delete(taskId);
      const socket = wsStore.socket;
      if (socket?.connected) {
        socket.emit("unsubscribe_asset_task", { taskId });
      }
    };
  };

  /**
   * 发送确认消息
   */
  const sendAck = (taskId: string) => {
    const socket = wsStore.socket;
    if (socket?.connected) {
      socket.emit("asset:ack", {
        type: "ack",
        taskId,
        timestamp: Date.now(),
      });
    }
  };

  /**
   * 重连后重新订阅所有任务
   */
  const resubscribeAll = () => {
    const socket = wsStore.socket;
    if (!socket?.connected) return;

    // 重新订阅资产生成任务
    assetCallbacks.value.forEach((_, taskId) => {
      socket.emit("subscribe_asset_task", { taskId });
    });
  };

  // 监听重连事件
  const setupReconnectListener = () => {
    const socket = wsStore.socket;
    if (!socket) return;

    socket.on("connect", () => {
      console.log("[WebSocket] 连接成功，重新订阅资产任务");
      resubscribeAll();
    });
  };

  onMounted(() => {
    connect();
    setupReconnectListener();
  });

  onUnmounted(() => {
    disconnect();
  });

  return {
    // 状态
    isConnected,
    connectionStatus,

    // 方法
    connect,
    disconnect,
    subscribeAssetTask,
    sendAck,
  };
}
