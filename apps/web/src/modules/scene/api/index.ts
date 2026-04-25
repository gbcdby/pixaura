import { api } from "@/utils/request";
import type {
  CreateSceneDto,
  UpdateSceneDto,
  QueryScenesDto,
  BatchCreateScenesDto,
  GenerateSceneImageDto,
  UploadSceneImageDto,
  ImportScenesDto,
  SceneListItemDto,
  SceneDetailDto,
  GenerateSceneImageTaskDto,
  BatchCreateScenesResultDto,
  ImportScenesResultDto,
} from "@pixaura/shared-types";

const BASE_URL = "/projects";
const SCENES_URL = "/scenes";

/**
 * 场景 API
 */
export const sceneApi = {
  /**
   * 创建场景
   */
  createScene(projectId: string, data: CreateSceneDto) {
    return api.post<SceneDetailDto>(
      `${BASE_URL}/${projectId}${SCENES_URL}`,
      data,
    );
  },

  /**
   * 查询场景列表
   */
  queryScenes(projectId: string, params: QueryScenesDto) {
    return api.get<{
      list: SceneListItemDto[];
      pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
      };
    }>(`${BASE_URL}/${projectId}${SCENES_URL}`, { params });
  },

  /**
   * 获取场景详情
   */
  getScene(sceneId: string) {
    return api.get<SceneDetailDto>(`${SCENES_URL}/${sceneId}`);
  },

  /**
   * 更新场景
   */
  updateScene(sceneId: string, data: UpdateSceneDto) {
    return api.patch<SceneDetailDto>(`${SCENES_URL}/${sceneId}`, data);
  },

  /**
   * 删除场景
   */
  deleteScene(sceneId: string) {
    return api.delete(`${SCENES_URL}/${sceneId}`);
  },

  /**
   * 批量删除场景
   */
  batchDeleteScenes(ids: string[]) {
    return api.delete(`${SCENES_URL}/batch`, { data: { ids } });
  },

  /**
   * 批量创建场景（从剧本）
   */
  batchCreateScenes(projectId: string, data: BatchCreateScenesDto) {
    return api.post<BatchCreateScenesResultDto>(
      `${BASE_URL}/${projectId}${SCENES_URL}/batch`,
      data,
    );
  },

  // ==================== 图片管理 ====================

  /**
   * 异步生成场景参考图
   */
  generateImage(sceneId: string, data: GenerateSceneImageDto) {
    return api.post<GenerateSceneImageTaskDto>(
      `${SCENES_URL}/${sceneId}/images/generate`,
      data,
    );
  },

  /**
   * 上传场景参考图
   * 注意：后端使用 multipart 处理，type 通过 query 参数传递
   */
  uploadImage(sceneId: string, data: UploadSceneImageDto, file: File) {
    // 构建 query 参数
    const params = new URLSearchParams();
    params.append("type", data.type);
    if (data.variantType) {
      params.append("variantType", data.variantType);
    }
    if (data.variantValue) {
      params.append("variantValue", data.variantValue);
    }

    const formData = new FormData();
    formData.append("file", file);

    return api.post(`${SCENES_URL}/${sceneId}/images/upload?${params.toString()}`, formData);
  },

  /**
   * 删除场景参考图
   */
  deleteImage(sceneId: string, imageId: string) {
    return api.delete(`${SCENES_URL}/${sceneId}/images/${imageId}`);
  },

  // ==================== 跨项目导入 ====================

  /**
   * 从其他项目导入场景
   */
  importScenes(projectId: string, data: ImportScenesDto) {
    return api.post<ImportScenesResultDto>(
      `${BASE_URL}/${projectId}${SCENES_URL}/import`,
      data,
    );
  },

  /**
   * 查询可导入的场景列表
   */
  queryImportableScenes(_projectId: string, sourceProjectId: string) {
    return api.get<{ list: unknown[]; total: number }>(
      `${BASE_URL}/${sourceProjectId}${SCENES_URL}`,
      {
        params: { status: "active", pageSize: 100 },
      },
    );
  },
};
