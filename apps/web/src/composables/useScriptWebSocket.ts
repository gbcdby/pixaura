/**
 * 剧本 WebSocket 组合式函数（重构版）
 * 不再管理连接，只提供便捷的事件订阅方法
 *
 * WebSocket 已由 App.vue 全局连接管理，这里只提供便捷封装
 */
import { onUnmounted } from "vue";
import { useWebSocketStore } from "@/stores/websocket";
import {
  WsEventNames,
  ScriptGenerateProgressWsData,
} from "@pixaura/shared-types";

export function useScriptWebSocket() {
  const wsStore = useWebSocketStore();

  // 存储取消注册函数
  const unregisterFunctions: (() => void)[] = [];

  /**
   * 订阅剧本生成任务（便捷方法）
   * @param taskId 任务 ID
   * @param callback 进度回调函数
   * @returns 取消订阅函数
   */
  function subscribeGenerateTask(
    taskId: string,
    callback: (data: ScriptGenerateProgressWsData) => void,
  ): () => void {
    // 注册处理器（只处理匹配 taskId 的消息）
    const unregister = wsStore.registerHandler(
      WsEventNames.SCRIPT_GENERATE_PROGRESS,
      (data: unknown) => {
        const progressData = data as ScriptGenerateProgressWsData;
        if (progressData.taskId === taskId) {
          callback(progressData);
        }
      },
    );

    // 存储取消函数以便统一清理
    unregisterFunctions.push(unregister);

    // 发送订阅请求
    wsStore.socket?.emit("subscribe_script_task", {
      taskId,
      type: "generate",
    });

    console.log(`[useScriptWebSocket] 订阅生成任务: ${taskId}`);

    // 返回取消函数
    const cancelSubscription = () => {
      unregister();
      // 从数组中移除
      const index = unregisterFunctions.indexOf(unregister);
      if (index > -1) {
        unregisterFunctions.splice(index, 1);
      }
      wsStore.socket?.emit("unsubscribe_script_task", { taskId });
      console.log(`[useScriptWebSocket] 取消订阅生成任务: ${taskId}`);
    };

    return cancelSubscription;
  }

  /**
   * 清理所有监听器
   */
  function cleanup() {
    unregisterFunctions.forEach((fn) => fn());
    unregisterFunctions.length = 0;
    console.log("[useScriptWebSocket] 清理所有监听器");
  }

  // 组件卸载时自动清理
  onUnmounted(() => {
    cleanup();
  });

  return {
    // WebSocket 状态（从全局 store 获取）
    isConnected: wsStore.isConnected,

    // 方法
    subscribeGenerateTask,
    cleanup,
  };
}
