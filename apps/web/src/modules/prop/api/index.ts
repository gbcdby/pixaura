import { api } from "@/utils/request";
import type {
  CreatePropDto,
  UpdatePropDto,
  QueryPropsDto,
  BatchCreatePropsDto,
  GeneratePropImageDto,
  UploadPropImageDto,
  ImportPropsDto,
  PropListItemDto,
  PropDetailDto,
  GeneratePropImageTaskDto,
  BatchCreatePropsResultDto,
  ImportPropsResultDto,
} from "@pixaura/shared-types";

const BASE_URL = "/projects";
const PROPS_URL = "/props";

/**
 * 道具 API
 */
export const propApi = {
  /**
   * 创建道具
   */
  createProp(projectId: string, data: CreatePropDto) {
    return api.post<PropDetailDto>(
      `${BASE_URL}/${projectId}${PROPS_URL}`,
      data,
    );
  },

  /**
   * 查询道具列表
   */
  queryProps(projectId: string, params: QueryPropsDto) {
    return api.get<{
      list: PropListItemDto[];
      pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
      };
    }>(`${BASE_URL}/${projectId}${PROPS_URL}`, { params });
  },

  /**
   * 获取道具详情
   */
  getProp(propId: string) {
    return api.get<PropDetailDto>(`${PROPS_URL}/${propId}`);
  },

  /**
   * 更新道具
   */
  updateProp(propId: string, data: UpdatePropDto) {
    return api.patch<PropDetailDto>(`${PROPS_URL}/${propId}`, data);
  },

  /**
   * 删除道具
   */
  deleteProp(propId: string) {
    return api.delete(`${PROPS_URL}/${propId}`);
  },

  /**
   * 批量删除道具
   */
  batchDeleteProps(ids: string[]) {
    return api.delete(`${PROPS_URL}/batch`, { data: { ids } });
  },

  /**
   * 批量创建道具（从剧本）
   */
  batchCreateProps(projectId: string, data: BatchCreatePropsDto) {
    return api.post<BatchCreatePropsResultDto>(
      `${BASE_URL}/${projectId}${PROPS_URL}/batch`,
      data,
    );
  },

  // ==================== 图片管理 ====================

  /**
   * 异步生成道具参考图
   */
  generateImage(propId: string, data: GeneratePropImageDto) {
    return api.post<GeneratePropImageTaskDto>(
      `${PROPS_URL}/${propId}/images/generate`,
      data,
    );
  },

  /**
   * 上传道具参考图
   */
  uploadImage(propId: string, data: UploadPropImageDto, file: File) {
    const formData = new FormData();
    formData.append("file", file);

    // type 通过 query 参数传递给后端
    const params = new URLSearchParams();
    params.append("type", data.type);

    return api.post(`${PROPS_URL}/${propId}/images/upload?${params.toString()}`, formData);
  },

  /**
   * 删除道具参考图
   */
  deleteImage(propId: string, imageId: string) {
    return api.delete(`${PROPS_URL}/${propId}/images/${imageId}`);
  },

  // ==================== 跨项目导入 ====================

  /**
   * 从其他项目导入道具
   */
  importProps(projectId: string, data: ImportPropsDto) {
    return api.post<ImportPropsResultDto>(
      `${BASE_URL}/${projectId}${PROPS_URL}/import`,
      data,
    );
  },

  /**
   * 查询可导入的道具列表
   */
  queryImportableProps(_projectId: string, sourceProjectId: string) {
    return api.get<{ list: unknown[]; total: number }>(
      `${BASE_URL}/${sourceProjectId}${PROPS_URL}`,
      {
        params: { status: "active", pageSize: 100 },
      },
    );
  },
};
