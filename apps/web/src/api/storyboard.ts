import { api } from "@/utils/request";
import type {
  CreateStoryboardDto,
  UpdateStoryboardDto,
  QueryStoryboardsDto,
  ReorderStoryboardsDto,
  BatchUpdateStatusDto,
  GenerateStoryboardImageDto,
  StoryboardListItemDto,
  StoryboardDetailDto,
  StoryboardImageDto,
  GenerateStoryboardImageTaskDto,
  BatchUpdateStatusResultDto,
} from "@pixaura/shared-types";

export interface StoryboardsResponse {
  items: StoryboardListItemDto[];
  total: number;
}

export const storyboardApi = {
  // ==================== 分镜 CRUD ====================

  // 获取分镜列表
  getStoryboards(
    projectId: string,
    params: QueryStoryboardsDto,
  ): Promise<StoryboardsResponse> {
    return api.get(`/projects/${projectId}/storyboards`, { params });
  },

  // 创建分镜
  createStoryboard(
    projectId: string,
    data: CreateStoryboardDto,
  ): Promise<StoryboardDetailDto> {
    return api.post(`/projects/${projectId}/storyboards`, data);
  },

  // 获取分镜详情
  getStoryboardDetail(storyboardId: string): Promise<StoryboardDetailDto> {
    return api.get(`/storyboards/${storyboardId}`);
  },

  // 更新分镜
  updateStoryboard(
    storyboardId: string,
    data: UpdateStoryboardDto,
  ): Promise<StoryboardDetailDto> {
    return api.patch(`/storyboards/${storyboardId}`, data);
  },

  // 删除分镜
  deleteStoryboard(storyboardId: string): Promise<void> {
    return api.delete(`/storyboards/${storyboardId}`);
  },

  // 批量重排序
  reorderStoryboards(
    projectId: string,
    data: ReorderStoryboardsDto,
  ): Promise<void> {
    return api.put(`/projects/${projectId}/storyboards/reorder`, data);
  },

  // ==================== 状态流转 ====================

  // 批量更新状态
  batchUpdateStatus(
    projectId: string,
    data: BatchUpdateStatusDto,
  ): Promise<BatchUpdateStatusResultDto> {
    return api.patch(`/projects/${projectId}/storyboards/status`, data);
  },

  // 提交粗剪完成
  submitRoughCut(projectId: string): Promise<BatchUpdateStatusResultDto> {
    return api.post(`/projects/${projectId}/storyboards/submit-rough`);
  },

  // 提交音频配置
  submitAudio(projectId: string): Promise<BatchUpdateStatusResultDto> {
    return api.post(`/projects/${projectId}/storyboards/submit-audio`);
  },

  // 提交精剪完成
  submitFinalCut(projectId: string): Promise<BatchUpdateStatusResultDto> {
    return api.post(`/projects/${projectId}/storyboards/submit-final`);
  },

  // 导出到视频生成
  exportToVideo(projectId: string): Promise<{
    exportJobId: string;
    storyboardCount: number;
    totalDuration: number;
  }> {
    return api.post(`/projects/${projectId}/storyboards/export`);
  },

  // ==================== 图片管理 ====================

  // 获取分镜图片列表
  getStoryboardImages(storyboardId: string): Promise<StoryboardImageDto[]> {
    return api.get(`/storyboards/${storyboardId}/images`);
  },

  // 生成预览图
  generateImage(
    storyboardId: string,
    data: GenerateStoryboardImageDto,
  ): Promise<GenerateStoryboardImageTaskDto> {
    return api.post(`/storyboards/${storyboardId}/images/generate`, data);
  },

  // 删除图片
  deleteImage(storyboardId: string, imageId: string): Promise<void> {
    return api.delete(`/storyboards/${storyboardId}/images/${imageId}`);
  },

  // 设置主图
  setPrimaryImage(storyboardId: string, imageId: string): Promise<void> {
    return api.patch(`/storyboards/${storyboardId}/images/${imageId}/primary`);
  },
};
