import { api } from "@/utils/request";
import type {
  GetScriptModelConfigsResponse,
  UpdateScriptModelConfigsDto,
  UpdateScriptModelConfigsResponse,
  ResolvedAssetResponse,
} from "@pixaura/shared-types";

export const scriptApi = {
  // ==================== 剧本模型配置 ====================

  /**
   * 获取剧本模型配置
   */
  async getScriptModelConfigs(
    projectId: string,
    scriptId: string,
  ): Promise<GetScriptModelConfigsResponse> {
    const res = (await api.get(
      `/projects/${projectId}/scripts/${scriptId}/models`,
    )) as GetScriptModelConfigsResponse;
    return res;
  },

  /**
   * 更新剧本模型配置
   */
  async updateScriptModelConfigs(
    projectId: string,
    scriptId: string,
    data: UpdateScriptModelConfigsDto,
  ): Promise<UpdateScriptModelConfigsResponse> {
    const res = (await api.put(
      `/projects/${projectId}/scripts/${scriptId}/models`,
      data,
    )) as UpdateScriptModelConfigsResponse;
    return res;
  },

  // ==================== 统一数据源 ====================

  /**
   * 获取剧本关联资产的完整数据（Ref + 素材库 Asset 组合）
   * 用于前端显示素材库的完整数据
   */
  async getResolvedAssets(
    projectId: string,
    scriptId: string,
  ): Promise<ResolvedAssetResponse> {
    const res = (await api.get(
      `/projects/${projectId}/scripts/${scriptId}/assets/resolved`,
    )) as ResolvedAssetResponse;
    return res;
  },
};
