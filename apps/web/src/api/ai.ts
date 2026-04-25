import { api } from "@/utils/request";

/**
 * AI 任务类型
 */
export type AITaskType =
  | "script:generate"
  | "script:continue"
  | "script:rewrite"
  | "script:expand"
  | "script:condense"
  | "script:parse"
  | "character:generate"
  | "scene:generate"
  | "storyboard:generate"
  | "video:generate"
  | "audio:generate"
  | "music:generate";

/**
 * AI 任务状态
 */
export type AITaskStatus =
  | "pending"
  | "processing"
  | "streaming"
  | "completed"
  | "failed"
  | "cancelled"
  | "timeout";

/**
 * 模型类别
 */
export type ModelCategory =
  | "TEXT_GENERATION"
  | "IMAGE_GENERATION"
  | "VIDEO_GENERATION"
  | "AUDIO_GENERATION";

/**
 * 提交任务请求
 */
export interface SubmitTaskRequest {
  type: AITaskType;
  projectId?: string;
  requestData: Record<string, unknown>;
  modelId?: string;
  priority?: number;
}

/**
 * 提交任务响应
 */
export interface SubmitTaskResponse {
  taskId: string;
  type: AITaskType;
  status: AITaskStatus;
  queuePosition: number;
  estimatedWaitSeconds: number;
  submittedAt: string;
}

/**
 * 提交流式任务响应
 */
export interface SubmitStreamTaskResponse {
  taskId: string;
  type: AITaskType;
  status: AITaskStatus;
  streamEndpoint: string;
  submittedAt: string;
}

/**
 * 任务状态响应
 */
export interface TaskStatusResponse {
  taskId: string;
  type: AITaskType;
  status: AITaskStatus;
  progress: number;
  queuePosition: number;
  startedAt?: string;
  estimatedCompletionAt?: string;
}

/**
 * 任务结果响应
 */
export interface TaskResultResponse {
  taskId: string;
  type: AITaskType;
  status: AITaskStatus;
  result: Record<string, unknown>;
  usage: {
    tokens: number;
    cost: number;
  };
  completedAt: string;
}

/**
 * 任务列表项
 */
export interface TaskListItem {
  taskId: string;
  type: AITaskType;
  status: AITaskStatus;
  modelId: string;
  actualCost: number;
  submittedAt: string;
  completedAt?: string;
}

/**
 * 任务列表响应
 */
export interface TaskListResponse {
  list: TaskListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/**
 * 取消任务响应
 */
export interface CancelTaskResponse {
  taskId: string;
  status: AITaskStatus;
  cancelledAt: string;
  refundAmount: number;
}

/**
 * 重试任务响应
 */
export interface RetryTaskResponse {
  taskId: string;
  newTaskId: string;
  status: AITaskStatus;
  submittedAt: string;
}

/**
 * 模型信息
 */
export interface AIModelInfo {
  modelId: string;
  name: string;
  provider: string;
  category: ModelCategory;
  capabilities: string[];
  pricing: {
    type: "per_token" | "per_call";
    inputPricePer1k?: number;
    outputPricePer1k?: number;
    pricePerCall?: number;
  };
  isDefault: boolean;
  description: string;
}

/**
 * SSE 事件类型
 */
export type SSEEventType = "start" | "chunk" | "progress" | "done" | "error";

/**
 * SSE 事件数据
 */
export interface SSEEventData {
  type: SSEEventType;
  taskId: string;
  timestamp: number;
  // start
  // chunk
  data?: string;
  index?: number;
  // progress
  progress?: number;
  stage?: string;
  // done
  result?: Record<string, unknown>;
  usage?: {
    tokens: number;
    cost: number;
  };
  // error
  code?: string;
  message?: string;
}

/**
 * AI API 客户端
 */
export const aiApi = {
  /**
   * 提交异步任务
   * @param data 任务请求数据
   */
  submitTask(data: SubmitTaskRequest): Promise<SubmitTaskResponse> {
    return api.post("/ai/tasks", {
      type: data.type,
      project_id: data.projectId,
      request_data: data.requestData,
      model_id: data.modelId,
      priority: data.priority,
    });
  },

  /**
   * 提交流式任务
   * @param data 任务请求数据
   */
  submitStreamTask(data: SubmitTaskRequest): Promise<SubmitStreamTaskResponse> {
    return api.post("/ai/tasks/stream", {
      type: data.type,
      project_id: data.projectId,
      request_data: data.requestData,
      model_id: data.modelId,
      priority: data.priority,
    });
  },

  /**
   * 获取任务状态
   * @param taskId 任务ID
   */
  getTaskStatus(taskId: string): Promise<TaskStatusResponse> {
    return api.get(`/ai/tasks/${taskId}/status`);
  },

  /**
   * 获取任务结果
   * @param taskId 任务ID
   */
  getTaskResult(taskId: string): Promise<TaskResultResponse> {
    return api.get(`/ai/tasks/${taskId}/result`);
  },

  /**
   * 获取任务列表
   * @param params 查询参数
   */
  getTaskList(
    params: {
      type?: AITaskType;
      status?: AITaskStatus;
      projectId?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ): Promise<TaskListResponse> {
    return api.get("/ai/tasks", {
      params: {
        type: params.type,
        status: params.status,
        project_id: params.projectId,
        page: params.page || 1,
        page_size: params.pageSize || 20,
      },
    });
  },

  /**
   * 取消任务
   * @param taskId 任务ID
   */
  cancelTask(taskId: string): Promise<CancelTaskResponse> {
    return api.post(`/ai/tasks/${taskId}/cancel`);
  },

  /**
   * 重试任务
   * @param taskId 任务ID
   */
  retryTask(taskId: string): Promise<RetryTaskResponse> {
    return api.post(`/ai/tasks/${taskId}/retry`);
  },

  /**
   * 获取可用模型列表
   * @param category 模型类别筛选
   */
  getAvailableModels(category?: ModelCategory): Promise<{
    models: AIModelInfo[];
  }> {
    return api.get("/ai/models", {
      params: category ? { category } : undefined,
    });
  },

  /**
   * 建立 SSE 连接
   * @param taskId 任务ID
   * @param handlers 事件处理器
   * @returns EventSource 实例
   */
  connectToStream(
    taskId: string,
    handlers: {
      onStart?: () => void;
      onChunk?: (chunk: string, index: number) => void;
      onProgress?: (progress: number, stage: string) => void;
      onDone?: (
        result: Record<string, unknown>,
        usage: { tokens: number; cost: number },
      ) => void;
      onError?: (code: string, message: string) => void;
    },
  ): EventSource {
    const eventSource = new EventSource(
      `/api/ai/tasks/${taskId}/stream`,
      { withCredentials: true },
    );

    eventSource.addEventListener("start", () => {
      handlers.onStart?.();
    });

    eventSource.addEventListener("chunk", (e: MessageEvent) => {
      const data: SSEEventData = JSON.parse(e.data);
      handlers.onChunk?.(data.data || "", data.index || 0);
    });

    eventSource.addEventListener("progress", (e: MessageEvent) => {
      const data: SSEEventData = JSON.parse(e.data);
      handlers.onProgress?.(data.progress || 0, data.stage || "");
    });

    eventSource.addEventListener("done", (e: MessageEvent) => {
      const data: SSEEventData = JSON.parse(e.data);
      handlers.onDone?.(
        data.result || {},
        data.usage || { tokens: 0, cost: 0 },
      );
      eventSource.close();
    });

    eventSource.addEventListener("error", (e: MessageEvent) => {
      const data: SSEEventData = JSON.parse(e.data);
      handlers.onError?.(
        data.code || "UNKNOWN_ERROR",
        data.message || "未知错误",
      );
      eventSource.close();
    });

    return eventSource;
  },
};
