import { defineStore } from "pinia";
import { ref, computed } from "vue";
import {
  aiApi,
  type AITaskType,
  type AITaskStatus,
  type ModelCategory,
  type SubmitTaskRequest,
  type AIModelInfo,
} from "@/api/ai";

/**
 * AI 任务（前端状态）
 */
interface AITask {
  taskId: string;
  type: AITaskType;
  status: AITaskStatus;
  projectId?: string;
  requestData: Record<string, unknown>;
  result?: Record<string, unknown>;
  errorMessage?: string;
  progress: number;
  queuePosition: number;
  submittedAt: string;
  startedAt?: string;
  completedAt?: string;
  // 流式输出相关
  streamContent?: string;
  streamChunks: string[];
}

/**
 * SSE 连接状态
 */
interface SSEConnection {
  taskId: string;
  eventSource: EventSource | null;
  isConnected: boolean;
}

export const useAIStore = defineStore("ai", () => {
  // ==================== State ====================

  // 当前用户的任务列表
  const tasks = ref<AITask[]>([]);

  // 当前正在处理的任务
  const currentTask = ref<AITask | null>(null);

  // 可用模型列表
  const availableModels = ref<AIModelInfo[]>([]);

  // SSE 连接
  const sseConnection = ref<SSEConnection | null>(null);

  // 加载状态
  const loading = ref(false);
  const loadingCount = ref(0); // 并发请求计数器
  const submitting = ref(false);
  const cancelling = ref(false);
  const retrying = ref(false);

  // 分页
  const pagination = ref({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });

  // ==================== Getters ====================

  const isLoading = computed(() => loadingCount.value > 0);
  const isSubmitting = computed(() => submitting.value);
  const isCancelling = computed(() => cancelling.value);
  const isRetrying = computed(() => retrying.value);

  /**
   * 按类别分组的模型
   */
  const modelsByCategory = computed(() => {
    const grouped: Record<ModelCategory, AIModelInfo[]> = {
      TEXT_GENERATION: [],
      IMAGE_GENERATION: [],
      VIDEO_GENERATION: [],
      AUDIO_GENERATION: [],
    };

    for (const model of availableModels.value) {
      grouped[model.category].push(model);
    }

    return grouped;
  });

  /**
   * 获取默认模型
   */
  const getDefaultModel = (
    category: ModelCategory,
  ): AIModelInfo | undefined => {
    return availableModels.value.find(
      (m) => m.category === category && m.isDefault,
    );
  };

  // ==================== Actions ====================

  /**
   * 提交异步任务
   */
  async function submitTask(request: SubmitTaskRequest) {
    submitting.value = true;
    try {
      const response = await aiApi.submitTask(request);

      // 添加到任务列表
      const newTask: AITask = {
        taskId: response.taskId,
        type: response.type,
        status: response.status,
        projectId: request.projectId,
        requestData: request.requestData,
        progress: 0,
        queuePosition: response.queuePosition,
        submittedAt: response.submittedAt,
        streamChunks: [],
      };

      tasks.value.unshift(newTask);
      currentTask.value = newTask;

      return response;
    } finally {
      submitting.value = false;
    }
  }

  /**
   * 提交流式任务
   */
  async function submitStreamTask(request: SubmitTaskRequest) {
    submitting.value = true;
    try {
      const response = await aiApi.submitStreamTask(request);

      // 创建任务记录
      const newTask: AITask = {
        taskId: response.taskId,
        type: response.type,
        status: response.status,
        projectId: request.projectId,
        requestData: request.requestData,
        progress: 0,
        queuePosition: 0,
        submittedAt: response.submittedAt,
        streamChunks: [],
      };

      tasks.value.unshift(newTask);
      currentTask.value = newTask;

      return response;
    } finally {
      submitting.value = false;
    }
  }

  /**
   * 建立 SSE 连接并监听流式输出
   */
  function connectToStream(
    taskId: string,
    callbacks?: {
      onStart?: () => void;
      onChunk?: (chunk: string, index: number) => void;
      onProgress?: (progress: number, stage: string) => void;
      onDone?: (result: Record<string, unknown>) => void;
      onError?: (code: string, message: string) => void;
    },
  ) {
    // 关闭现有连接
    if (sseConnection.value?.eventSource) {
      sseConnection.value.eventSource.close();
    }

    const task = tasks.value.find((t) => t.taskId === taskId);
    if (!task) return;

    const eventSource = aiApi.connectToStream(taskId, {
      onStart: () => {
        task.status = "streaming";
        callbacks?.onStart?.();
      },
      onChunk: (chunk, index) => {
        task.streamChunks.push(chunk);
        task.streamContent = task.streamChunks.join("");
        callbacks?.onChunk?.(chunk, index);
      },
      onProgress: (progress, stage) => {
        task.progress = progress;
        callbacks?.onProgress?.(progress, stage);
      },
      onDone: (result, _usage) => {
        task.status = "completed";
        task.result = result;
        task.progress = 100;
        task.completedAt = new Date().toISOString();
        sseConnection.value = null;
        callbacks?.onDone?.(result);
      },
      onError: (code, message) => {
        task.status = "failed";
        task.errorMessage = message;
        sseConnection.value = null;
        callbacks?.onError?.(code, message);
      },
    });

    sseConnection.value = {
      taskId,
      eventSource,
      isConnected: true,
    };

    return eventSource;
  }

  /**
   * 关闭 SSE 连接
   */
  function closeStreamConnection() {
    if (sseConnection.value?.eventSource) {
      sseConnection.value.eventSource.close();
      sseConnection.value = null;
    }
  }

  /**
   * 获取任务状态
   */
  async function fetchTaskStatus(taskId: string) {
    const response = await aiApi.getTaskStatus(taskId);

    // 更新任务状态
    const task = tasks.value.find((t) => t.taskId === taskId);
    if (task) {
      task.status = response.status;
      task.progress = response.progress;
      task.queuePosition = response.queuePosition;
      task.startedAt = response.startedAt;
    }

    return response;
  }

  /**
   * 获取任务结果
   */
  async function fetchTaskResult(taskId: string) {
    const response = await aiApi.getTaskResult(taskId);

    // 更新任务结果
    const task = tasks.value.find((t) => t.taskId === taskId);
    if (task) {
      task.status = response.status;
      task.result = response.result;
      task.completedAt = response.completedAt;
    }

    return response;
  }

  /**
   * 获取任务列表
   */
  async function fetchTaskList(
    params: {
      type?: AITaskType;
      status?: AITaskStatus;
      projectId?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ) {
    loading.value = true;
    try {
      const response = await aiApi.getTaskList(params);
      tasks.value = response.list.map((item) => ({
        taskId: item.taskId,
        type: item.type,
        status: item.status,
        projectId: item.taskId, // TODO: API 返回中需要包含 projectId
        requestData: {},
        progress: 0,
        queuePosition: 0,
        submittedAt: item.submittedAt,
        completedAt: item.completedAt,
        streamChunks: [],
      }));
      pagination.value = response.pagination;
      return response;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 取消任务
   */
  async function cancelTask(taskId: string) {
    cancelling.value = true;
    try {
      const response = await aiApi.cancelTask(taskId);

      // 更新任务状态
      const task = tasks.value.find((t) => t.taskId === taskId);
      if (task) {
        task.status = "cancelled";
      }

      // 关闭 SSE 连接
      if (sseConnection.value?.taskId === taskId) {
        closeStreamConnection();
      }

      return response;
    } finally {
      cancelling.value = false;
    }
  }

  /**
   * 重试任务
   */
  async function retryTask(taskId: string) {
    retrying.value = true;
    try {
      const response = await aiApi.retryTask(taskId);

      // 添加新任务到列表
      const newTask: AITask = {
        taskId: response.newTaskId,
        type: "script:generate", // 需要从原任务获取
        status: response.status,
        projectId: undefined,
        requestData: {},
        progress: 0,
        queuePosition: 0,
        submittedAt: response.submittedAt,
        streamChunks: [],
      };

      tasks.value.unshift(newTask);

      return response;
    } finally {
      retrying.value = false;
    }
  }

  /**
   * 获取可用模型列表
   */
  async function fetchAvailableModels(category?: ModelCategory) {
    loadingCount.value++;
    try {
      const response = await aiApi.getAvailableModels(category);
      if (category) {
        // 按类别更新：先过滤掉该类别的旧数据，再追加新数据
        const otherModels = availableModels.value.filter(
          (m) => m.category !== category,
        );
        availableModels.value = [...otherModels, ...response.models];
      } else {
        // 无类别筛选时，直接替换全部数据
        availableModels.value = response.models;
      }
      return response;
    } finally {
      loadingCount.value--;
    }
  }

  /**
   * 清除当前任务
   */
  function clearCurrentTask() {
    currentTask.value = null;
  }

  return {
    // State
    tasks,
    currentTask,
    availableModels,
    sseConnection,
    loading,
    submitting,
    cancelling,
    retrying,
    pagination,

    // Getters
    isLoading,
    isSubmitting,
    isCancelling,
    isRetrying,
    modelsByCategory,
    getDefaultModel,

    // Actions
    submitTask,
    submitStreamTask,
    connectToStream,
    closeStreamConnection,
    fetchTaskStatus,
    fetchTaskResult,
    fetchTaskList,
    cancelTask,
    retryTask,
    fetchAvailableModels,
    clearCurrentTask,
  };
});
