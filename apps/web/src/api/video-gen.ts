import { api } from "@/utils/request";
import type {
  CreateVideoGenTaskDto,
  CreateBatchVideoGenDto,
  RetryVideoGenTaskDto,
  CreateVideoGenTaskResponseDto,
  CreateBatchVideoGenResponseDto,
  VideoGenTaskDetailDto,
  CancelVideoGenTaskResponseDto,
  RetryVideoGenTaskResponseDto,
} from "@pixaura/shared-types";

export const videoGenApi = {
  // ==================== 视频生成任务管理 ====================

  // 提交视频生成任务
  createTask(
    projectId: string,
    data: CreateVideoGenTaskDto,
  ): Promise<CreateVideoGenTaskResponseDto> {
    return api.post(`/projects/${projectId}/video-gen/tasks`, data);
  },

  // 批量提交视频生成任务
  createBatchTasks(
    projectId: string,
    data: CreateBatchVideoGenDto,
  ): Promise<CreateBatchVideoGenResponseDto> {
    return api.post(`/projects/${projectId}/video-gen/tasks/batch`, data);
  },

  // 获取任务详情
  getTaskDetail(taskId: string): Promise<VideoGenTaskDetailDto> {
    return api.get(`/video-gen/tasks/${taskId}`);
  },

  // 取消任务
  cancelTask(taskId: string): Promise<CancelVideoGenTaskResponseDto> {
    return api.patch(`/video-gen/tasks/${taskId}/cancel`);
  },

  // 重试任务
  retryTask(
    taskId: string,
    data?: RetryVideoGenTaskDto,
  ): Promise<RetryVideoGenTaskResponseDto> {
    return api.patch(`/video-gen/tasks/${taskId}/retry`, data);
  },

  // 获取项目的进行中的任务
  getActiveTasks(projectId: string): Promise<VideoGenTaskDetailDto[]> {
    return api.get(`/projects/${projectId}/video-gen/active-tasks`);
  },
};
