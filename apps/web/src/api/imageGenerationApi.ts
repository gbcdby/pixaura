import { api } from "@/utils/request";
import type {
  CreateImageGenerationTaskDto,
  CreateBatchImageGenDto,
  RegenerateImageDto,
  ImageGenTaskDetailDto,
  ImageGenTaskStatus,
} from "@pixaura/shared-types";

export interface TaskListParams {
  projectId: string;
  status?: ImageGenTaskStatus;
  page?: number;
  limit?: number;
}

export interface TaskListResponse {
  tasks: ImageGenTaskDetailDto[];
  total: number;
}

export const imageGenerationApi = {
  /**
   * 统一图像生成接口（文生图/图生图合并）
   * 当 config.referenceImageUrl 存在时，使用图生图逻辑
   * 当 config.referenceImageUrl 不存在时，使用文生图逻辑
   */
  createImageGeneration(data: CreateImageGenerationTaskDto): Promise<{
    taskId: string;
    status: ImageGenTaskStatus;
    estimatedCost: number;
    estimatedTime: number;
    mode: "text_to_image" | "image_to_image";
  }> {
    return api.post("/image-gen/generate", data);
  },

  /**
   * @deprecated 使用 createImageGeneration 替代
   * 提交文生图任务
   */
  createTextToImage(data: CreateImageGenerationTaskDto): Promise<{
    taskId: string;
    status: ImageGenTaskStatus;
    estimatedCost: number;
    estimatedTime: number;
  }> {
    return api.post("/image-gen/text-to-image", data);
  },

  /**
   * @deprecated 使用 createImageGeneration 替代
   * 提交图生图任务
   */
  createImageToImage(data: CreateImageGenerationTaskDto): Promise<{
    taskId: string;
    status: ImageGenTaskStatus;
    estimatedCost: number;
    estimatedTime: number;
  }> {
    return api.post("/image-gen/image-to-image", data);
  },

  /**
   * 提交批量生成任务
   */
  createBatch(data: CreateBatchImageGenDto): Promise<{
    taskId: string;
    status: ImageGenTaskStatus;
    batchCount: number;
    estimatedCost: number;
    estimatedTime: number;
  }> {
    return api.post("/image-gen/batch", data);
  },

  /**
   * 获取任务列表
   */
  getTaskList(params: TaskListParams): Promise<TaskListResponse> {
    return api.get("/image-gen/tasks", { params });
  },

  /**
   * 获取任务详情
   */
  getTaskDetail(taskId: string): Promise<ImageGenTaskDetailDto> {
    return api.get(`/image-gen/tasks/${taskId}`);
  },

  /**
   * 取消任务
   */
  cancelTask(taskId: string): Promise<{
    taskId: string;
    status: string;
    refundAmount: number;
  }> {
    return api.post(`/image-gen/tasks/${taskId}/cancel`);
  },

  /**
   * 删除任务
   */
  deleteTask(taskId: string): Promise<{ taskId: string }> {
    return api.delete(`/image-gen/tasks/${taskId}`);
  },

  /**
   * 重新生成单张图片
   */
  regenerateImage(
    resultId: string,
    data: RegenerateImageDto,
  ): Promise<{
    newResultId: string;
    status: ImageGenTaskStatus;
  }> {
    return api.post(`/image-gen/results/${resultId}/regenerate`, data);
  },
};
