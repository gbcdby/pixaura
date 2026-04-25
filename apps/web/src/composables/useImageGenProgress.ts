/**
 * 图片生成进度 Composable
 * 自动订阅图片生成任务进度，返回 reactive 进度对象
 */
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import {
  useWebSocketStore,
  type GenerationProgressData,
  type GenerationCompleteData,
  type GenerationFailedData,
} from "@/stores/websocket";
import { useImageGenerationStore } from "@/stores/imageGeneration";

// 图片生成进度状态
export interface ImageGenProgressState {
  taskId: string;
  status: "pending" | "processing" | "completed" | "failed" | "unknown";
  percentage: number;
  currentStep: string;
  completed: number;
  total: number;
  failed: number;
  message?: string;
  resultUrl?: string;
  errorMessage?: string;
  retryable?: boolean;
}

/**
 * 使用图片生成进度
 * @param taskId 任务ID
 * @param options 配置选项
 */
export function useImageGenProgress(
  taskId: string,
  options: {
    autoSubscribe?: boolean;
    onComplete?: (data: GenerationCompleteData) => void;
    onFailed?: (data: GenerationFailedData) => void;
  } = {},
) {
  const { autoSubscribe = true, onComplete, onFailed } = options;

  const wsStore = useWebSocketStore();
  const imageGenStore = useImageGenerationStore();

  // 进度状态
  const progress = ref<ImageGenProgressState>({
    taskId,
    status: "unknown",
    percentage: 0,
    currentStep: "等待中",
    completed: 0,
    total: 0,
    failed: 0,
  });

  const isComplete = computed(() => progress.value.status === "completed");
  const isFailed = computed(() => progress.value.status === "failed");
  const isProcessing = computed(
    () =>
      progress.value.status === "processing" ||
      progress.value.status === "pending",
  );

  // 状态文本
  const statusText = computed(() => {
    const stepMap: Record<string, string> = {
      pending: "等待中",
      queued: "排队中",
      preparing: "准备中",
      generating: "生成中",
      uploading: "上传中",
      completed: "已完成",
      failed: "失败",
      cancelled: "已取消",
    };
    return (
      stepMap[progress.value.currentStep] ||
      progress.value.currentStep ||
      "等待中"
    );
  });

  // 是否显示进度条
  const showProgress = computed(() => {
    return ["pending", "processing"].includes(progress.value.status);
  });

  // 处理进度更新
  const handleProgress = (data: GenerationProgressData) => {
    if (data.taskId !== taskId) return;

    progress.value = {
      ...progress.value,
      status: data.status,
      percentage: data.progress,
      currentStep: data.currentStep,
      message: data.message,
    };

    // 更新 store 中的任务状态
    if (data.status === "processing" || data.status === "pending") {
      imageGenStore.handleProgressUpdate({
        taskId: data.taskId,
        status: data.status === "processing" ? "generating" : data.status,
        progress: {
          percentage: data.progress,
          currentStep: data.currentStep,
          completed: progress.value.completed,
          total: progress.value.total,
          failed: progress.value.failed,
        },
      });
    }
  };

  // 处理完成
  const handleComplete = (data: GenerationCompleteData) => {
    if (data.taskId !== taskId) return;

    progress.value = {
      ...progress.value,
      status: "completed",
      percentage: 100,
      currentStep: "completed",
      resultUrl: data.resultUrl,
    };

    // 更新 store
    imageGenStore.handleTaskCompleted({
      taskId: data.taskId,
      status: "completed",
      summary: {
        success: Number(data.metadata?.successCount || 1),
        failed: Number(data.metadata?.failedCount || 0),
      },
    });

    onComplete?.(data);
  };

  // 处理失败
  const handleFailed = (data: GenerationFailedData) => {
    if (data.taskId !== taskId) return;

    progress.value = {
      ...progress.value,
      status: "failed",
      errorMessage: data.errorMessage,
      retryable: data.retryable,
    };

    onFailed?.(data);
  };

  // 订阅任务
  const subscribe = () => {
    if (!taskId) return;

    // 确保 WebSocket 已连接
    if (!wsStore.isConnected) {
      wsStore.connect().catch(console.error);
    }

    // 订阅任务
    wsStore.subscribe(taskId, {
      onProgress: handleProgress,
      onComplete: handleComplete,
      onFailed: handleFailed,
    });
  };

  // 取消订阅
  const unsubscribe = () => {
    if (!taskId) return;
    wsStore.unsubscribe(taskId);
  };

  // 手动刷新任务状态
  const refresh = async () => {
    try {
      const task = await imageGenStore.fetchTaskDetail(taskId);
      if (task) {
        const mappedStatus =
          task.status === "generating"
            ? "processing"
            : task.status === "partial_failed"
              ? "failed"
              : task.status === "cancelled"
                ? "failed"
                : task.status;
        progress.value = {
          ...progress.value,
          status: mappedStatus as
            | "pending"
            | "processing"
            | "completed"
            | "failed"
            | "unknown",
          percentage: task.progress?.percentage || 0,
          currentStep: task.progress?.currentStep || "等待中",
          completed: task.progress?.completed || 0,
          total: task.progress?.total || 1,
          failed: task.progress?.failed || 0,
        };
      }
    } catch (err) {
      console.error("[useImageGenProgress] 刷新任务状态失败:", err);
    }
  };

  // 组件挂载时订阅
  onMounted(() => {
    if (autoSubscribe) {
      subscribe();
      // 获取初始状态
      refresh();
    }
  });

  // 组件卸载时取消订阅
  onUnmounted(() => {
    unsubscribe();
  });

  // 监听 taskId 变化
  watch(
    () => taskId,
    (newTaskId, oldTaskId) => {
      if (newTaskId !== oldTaskId) {
        unsubscribe();
        progress.value = {
          taskId: newTaskId,
          status: "unknown",
          percentage: 0,
          currentStep: "等待中",
          completed: 0,
          total: 0,
          failed: 0,
        };
        if (autoSubscribe && newTaskId) {
          subscribe();
          refresh();
        }
      }
    },
  );

  return {
    // 状态
    progress,
    isComplete,
    isFailed,
    isProcessing,
    statusText,
    showProgress,

    // 方法
    subscribe,
    unsubscribe,
    refresh,
  };
}

export default useImageGenProgress;
