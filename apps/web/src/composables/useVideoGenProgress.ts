/**
 * 视频生成进度 Composable
 * 自动订阅视频生成任务进度，支持批量任务进度聚合
 */
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import {
  useWebSocketStore,
  type GenerationProgressData,
  type GenerationCompleteData,
  type GenerationFailedData,
} from "@/stores/websocket";
import { useVideoGenStore } from "@/stores/video-gen";

// 视频生成进度状态
export interface VideoGenProgressState {
  taskId: string;
  status: "pending" | "processing" | "completed" | "failed" | "unknown";
  percentage: number;
  currentStep: string;
  completed: number;
  total: number;
  failed: number;
  processing: number;
  message?: string;
  resultUrl?: string;
  errorMessage?: string;
  retryable?: boolean;
  isBatch?: boolean;
  batchStats?: {
    total: number;
    completed: number;
    failed: number;
    processing: number;
    pending: number;
  };
}

// 批量任务中的单个任务进度
export interface BatchTaskProgress {
  taskId: string;
  status: string;
  progress: number;
  currentStep?: string;
}

/**
 * 使用视频生成进度
 * @param taskId 任务ID（可以是单个任务或批量任务ID）
 * @param options 配置选项
 */
export function useVideoGenProgress(
  taskId: string,
  options: {
    autoSubscribe?: boolean;
    isBatch?: boolean;
    onComplete?: (data: GenerationCompleteData) => void;
    onFailed?: (data: GenerationFailedData) => void;
    onProgress?: (data: GenerationProgressData) => void;
  } = {},
) {
  const {
    autoSubscribe = true,
    isBatch = false,
    onComplete,
    onFailed,
    onProgress,
  } = options;

  const wsStore = useWebSocketStore();
  const videoGenStore = useVideoGenStore();

  // 进度状态
  const progress = ref<VideoGenProgressState>({
    taskId,
    status: "unknown",
    percentage: 0,
    currentStep: "等待中",
    completed: 0,
    total: 0,
    failed: 0,
    processing: 0,
    isBatch,
  });

  // 批量任务中的子任务进度
  const batchTasks = ref<Map<string, BatchTaskProgress>>(new Map());

  const isComplete = computed(() => progress.value.status === "completed");
  const isFailed = computed(() => progress.value.status === "failed");
  const isProcessing = computed(() =>
    ["processing", "pending", "queued", "generating"].includes(
      progress.value.status,
    ),
  );

  // 状态文本
  const statusText = computed(() => {
    const stepMap: Record<string, string> = {
      pending: "等待中",
      queued: "排队中",
      preparing: "准备中",
      generating: "生成中",
      post_processing: "后处理中",
      uploading: "上传中",
      completed: "已完成",
      failed: "失败",
      cancelled: "已取消",
    };

    if (progress.value.isBatch && progress.value.batchStats) {
      const stats = progress.value.batchStats;
      return `批量生成中 (${stats.completed}/${stats.total})`;
    }

    return (
      stepMap[progress.value.currentStep] ||
      progress.value.currentStep ||
      "等待中"
    );
  });

  // 是否显示进度条
  const showProgress = computed(() => {
    return ["pending", "processing", "queued", "generating"].includes(
      progress.value.status,
    );
  });

  // 批量任务进度列表
  const batchTaskList = computed(() => {
    return Array.from(batchTasks.value.values());
  });

  // 处理进度更新
  const handleProgress = (data: GenerationProgressData) => {
    if (data.taskId !== taskId) return;

    // 解析消息中的批量统计信息
    let batchStats = progress.value.batchStats;
    if (data.message && data.message.includes("已完成")) {
      const match = data.message.match(
        /已完成 (\d+)\/(\d+), 失败 (\d+), 进行中 (\d+)/,
      );
      if (match) {
        batchStats = {
          total: parseInt(match[2]),
          completed: parseInt(match[1]),
          failed: parseInt(match[3]),
          processing: parseInt(match[4]),
          pending:
            parseInt(match[2]) -
            parseInt(match[1]) -
            parseInt(match[3]) -
            parseInt(match[4]),
        };
      }
    }

    progress.value = {
      ...progress.value,
      status: data.status,
      percentage: data.progress,
      currentStep: data.currentStep,
      message: data.message,
      batchStats,
    };

    // 更新 store 中的任务状态
    const mappedStatus =
      data.status === "processing" ? "generating" : data.status;
    videoGenStore.handleProgressUpdate({
      taskId: data.taskId,
      status: mappedStatus as
        | "pending"
        | "queued"
        | "generating"
        | "completed"
        | "failed"
        | "cancelled",
      progress: {
        percentage: data.progress,
        currentStep: data.currentStep,
        steps: [],
      },
    });

    onProgress?.(data);
  };

  // 处理完成
  const handleComplete = (data: GenerationCompleteData) => {
    if (data.taskId !== taskId) return;

    const isBatchComplete = data.metadata?.isBatch === "true";

    progress.value = {
      ...progress.value,
      status: "completed",
      percentage: 100,
      currentStep: "completed",
      resultUrl: data.resultUrl,
      isBatch: isBatchComplete,
    };

    if (isBatchComplete && data.metadata) {
      progress.value.batchStats = {
        total: parseInt(data.metadata.totalTasks || "0"),
        completed: parseInt(data.metadata.successCount || "0"),
        failed: parseInt(data.metadata.failedCount || "0"),
        processing: 0,
        pending: 0,
      };
    }

    // 更新 store
    videoGenStore.handleTaskCompleted({
      taskId: data.taskId,
      status: "completed",
      outputs: data.resultUrl
        ? {
            videoUrl: data.resultUrl,
            duration: parseInt(data.metadata?.videoDuration || "0"),
          }
        : undefined,
      cost: { actualCost: 0 },
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
      const task = await videoGenStore.fetchTaskDetail(taskId);
      if (task) {
        const mappedStatus =
          task.status === "generating"
            ? "processing"
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
          completed: 0,
          total: 0,
          failed: 0,
          processing: task.status === "generating" ? 1 : 0,
        };
      }
    } catch (err) {
      console.error("[useVideoGenProgress] 刷新任务状态失败:", err);
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
        batchTasks.value.clear();
        progress.value = {
          taskId: newTaskId,
          status: "unknown",
          percentage: 0,
          currentStep: "等待中",
          completed: 0,
          total: 0,
          failed: 0,
          processing: 0,
          isBatch,
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
    batchTasks: batchTaskList,
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

/**
 * 使用批量视频生成进度
 * 用于管理多个视频生成任务的进度聚合
 * @param batchId 批量任务ID
 * @param taskIds 子任务ID列表
 */
export function useBatchVideoGenProgress(
  batchId: string,
  taskIds: string[] = [],
  options: {
    autoSubscribe?: boolean;
    onAllComplete?: () => void;
  } = {},
) {
  const { autoSubscribe = true, onAllComplete } = options;
  const wsStore = useWebSocketStore();

  // 所有任务的进度
  const taskProgressMap = ref<Map<string, VideoGenProgressState>>(new Map());

  // 总体统计
  const summary = computed(() => {
    const tasks = Array.from(taskProgressMap.value.values());
    return {
      total: taskIds.length,
      completed: tasks.filter((t) => t.status === "completed").length,
      failed: tasks.filter((t) => t.status === "failed").length,
      processing: tasks.filter((t) =>
        ["processing", "pending"].includes(t.status),
      ).length,
      pending: tasks.filter((t) => t.status === "unknown").length,
      percentage: tasks.length
        ? Math.round(
            (tasks.filter((t) => t.status === "completed").length /
              tasks.length) *
              100,
          )
        : 0,
    };
  });

  const allCompleted = computed(() => {
    return summary.value.completed + summary.value.failed === taskIds.length;
  });

  // 处理单个任务进度
  const createTaskHandler = (taskId: string) => {
    return {
      onProgress: (data: GenerationProgressData) => {
        taskProgressMap.value.set(taskId, {
          ...taskProgressMap.value.get(taskId),
          taskId,
          status: data.status,
          percentage: data.progress,
          currentStep: data.currentStep,
          message: data.message,
        } as VideoGenProgressState);
      },
      onComplete: () => {
        const current = taskProgressMap.value.get(taskId);
        if (current) {
          current.status = "completed";
          current.percentage = 100;
        }
        if (allCompleted.value) {
          onAllComplete?.();
        }
      },
      onFailed: (data: GenerationFailedData) => {
        const current = taskProgressMap.value.get(taskId);
        if (current) {
          current.status = "failed";
          current.errorMessage = data.errorMessage;
        }
        if (allCompleted.value) {
          onAllComplete?.();
        }
      },
    };
  };

  // 订阅所有任务
  const subscribe = () => {
    if (!wsStore.isConnected) {
      wsStore.connect().catch(console.error);
    }

    // 订阅批量任务本身
    if (batchId) {
      wsStore.subscribe(batchId, {
        onProgress: (data) => {
          // 批量任务进度更新
          console.log("[useBatchVideoGenProgress] 批量任务进度:", data);
        },
        onComplete: () => {
          console.log("[useBatchVideoGenProgress] 批量任务完成");
        },
        onFailed: (data) => {
          console.error("[useBatchVideoGenProgress] 批量任务失败:", data);
        },
      });
    }

    // 订阅所有子任务
    taskIds.forEach((taskId) => {
      const handlers = createTaskHandler(taskId);
      wsStore.subscribe(taskId, handlers);
    });
  };

  // 取消订阅
  const unsubscribe = () => {
    if (batchId) {
      wsStore.unsubscribe(batchId);
    }
    taskIds.forEach((taskId) => {
      wsStore.unsubscribe(taskId);
    });
  };

  // 获取单个任务进度
  const getTaskProgress = (taskId: string) => {
    return computed(() => taskProgressMap.value.get(taskId));
  };

  onMounted(() => {
    if (autoSubscribe) {
      subscribe();
    }
  });

  onUnmounted(() => {
    unsubscribe();
  });

  return {
    summary,
    allCompleted,
    taskProgressMap,
    subscribe,
    unsubscribe,
    getTaskProgress,
  };
}

export default useVideoGenProgress;
