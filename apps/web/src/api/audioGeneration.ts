import { api } from "@/utils/request";
import type {
  CreateTTSTaskDto,
  CreateLipSyncTaskDto,
  CreateBGMTaskDto,
  CreateAmbienceTaskDto,
  CreateMixingTaskDto,
  AudioGenTaskDetailDto,
  AudioGenTaskStatus,
} from "@pixaura/shared-types";

export interface TaskListParams {
  projectId: string;
  type?: string;
  status?: AudioGenTaskStatus;
  limit?: number;
  offset?: number;
}

export interface TaskListResponse {
  tasks: AudioGenTaskDetailDto[];
  total: number;
}

export const audioGenerationApi = {
  /**
   * TTS 文本转语音
   */
  createTTS(data: CreateTTSTaskDto): Promise<{
    taskId: string;
    status: AudioGenTaskStatus;
    estimatedCost: number;
    estimatedTime?: number;
  }> {
    return api.post("/audio-gen/tts", data);
  },

  /**
   * 对口型合成
   */
  createLipSync(data: CreateLipSyncTaskDto): Promise<{
    taskId: string;
    status: AudioGenTaskStatus;
    estimatedCost: number;
    estimatedTime?: number;
  }> {
    return api.post("/audio-gen/lip-sync", data);
  },

  /**
   * BGM 背景音乐生成
   */
  createBGM(data: CreateBGMTaskDto): Promise<{
    taskId: string;
    status: AudioGenTaskStatus;
    estimatedCost: number;
    estimatedTime?: number;
  }> {
    return api.post("/audio-gen/bgm", data);
  },

  /**
   * 环境音效生成
   */
  createAmbience(data: CreateAmbienceTaskDto): Promise<{
    taskId: string;
    status: AudioGenTaskStatus;
    estimatedCost: number;
    estimatedTime?: number;
  }> {
    return api.post("/audio-gen/ambience", data);
  },

  /**
   * 多轨道音频混音
   */
  createMixing(data: CreateMixingTaskDto): Promise<{
    taskId: string;
    status: AudioGenTaskStatus;
    estimatedCost: number;
    estimatedTime?: number;
  }> {
    return api.post("/audio-gen/mix", data);
  },

  /**
   * 获取任务列表
   */
  getTaskList(params: TaskListParams): Promise<TaskListResponse> {
    return api.get("/audio-gen/tasks", { params });
  },

  /**
   * 获取任务详情
   */
  getTaskDetail(taskId: string): Promise<AudioGenTaskDetailDto> {
    return api.get(`/audio-gen/tasks/${taskId}`);
  },

  /**
   * 取消任务
   */
  cancelTask(taskId: string): Promise<{
    taskId: string;
    status: "cancelled" | "cancelling";
    refundAmount: number;
  }> {
    return api.post(`/audio-gen/tasks/${taskId}/cancel`);
  },

  /**
   * 删除任务
   */
  deleteTask(taskId: string): Promise<void> {
    return api.delete(`/audio-gen/tasks/${taskId}`);
  },
};
