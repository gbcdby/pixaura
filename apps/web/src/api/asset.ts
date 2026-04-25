/**
 * Asset 模块 API 客户端
 */
import { api } from "@/utils/request";
import type {
  // DTO 类型
  QueryAssetsDto,
  SearchAssetsDto,
  GetPopularAssetsDto,
  ImportAssetDto,
  BatchImportAssetsDto,
  CheckImportConflictDto,
  AddFavoriteDto,
  GetFavoritesDto,
  GetRecentDto,
  AssetSuggestDto,
  // 响应类型
  AssetListDto,
  AssetDetailBaseDto,
  AssetStatsDto,
  PopularAssetsDto,
  CheckImportConflictResultDto,
  ImportAssetResponseDto,
  BatchImportAssetsResponseDto,
  BatchImportDetailDto,
  ImportHistoryDto,
  FavoriteListDto,
  AddFavoriteResponseDto,
  RecentItemDto,
  AssetFilterOptionsDto,
  AssetSuggestionsDto,
} from "@pixaura/shared-types";

const BASE_URL = "/assets";
const USER_URL = "/user";
const PROJECTS_URL = "/projects";

/**
 * 资产 API 客户端
 */
export const assetApi = {
  // ==================== 资产浏览 ====================

  /**
   * 获取资产列表
   * @param params 查询参数
   * @returns 资产列表
   */
  getAssets(params: QueryAssetsDto): Promise<AssetListDto> {
    return api.get<AssetListDto>(BASE_URL, { params }).then((res) => res.data);
  },

  /**
   * 获取资产详情
   * @param type 资产类型
   * @param id 资产ID
   * @returns 资产详情
   */
  getAssetDetail(type: string, id: string): Promise<AssetDetailBaseDto> {
    return api
      .get<AssetDetailBaseDto>(`${BASE_URL}/${type}/${id}`)
      .then((res) => res.data);
  },

  /**
   * 获取资产统计
   * @param type 资产类型
   * @param id 资产ID
   * @returns 资产统计
   */
  getAssetStats(type: string, id: string): Promise<AssetStatsDto> {
    return api
      .get<AssetStatsDto>(`${BASE_URL}/${type}/${id}/stats`)
      .then((res) => res.data);
  },

  /**
   * 获取热门资产
   * @param params 查询参数
   * @returns 热门资产列表
   */
  getPopularAssets(params: GetPopularAssetsDto): Promise<PopularAssetsDto> {
    return api
      .get<PopularAssetsDto>(`${BASE_URL}/popular`, { params })
      .then((res) => res.data);
  },

  // ==================== 搜索 ====================

  /**
   * 搜索资产
   * @param params 搜索参数
   * @returns 搜索结果
   */
  searchAssets(params: SearchAssetsDto): Promise<AssetListDto> {
    return api
      .get<AssetListDto>(`${BASE_URL}/search`, { params })
      .then((res) => res.data);
  },

  /**
   * 获取筛选选项
   * @returns 筛选选项
   */
  getFilterOptions(): Promise<AssetFilterOptionsDto> {
    return api
      .get<AssetFilterOptionsDto>(`${BASE_URL}/filters`)
      .then((res) => res.data);
  },

  /**
   * 获取搜索建议
   * @param params 建议参数
   * @returns 搜索建议
   */
  getSearchSuggestions(params: AssetSuggestDto): Promise<AssetSuggestionsDto> {
    return api
      .get<AssetSuggestionsDto>(`${BASE_URL}/suggest`, { params })
      .then((res) => res.data);
  },

  // ==================== 导入 ====================

  /**
   * 导入单个资产
   * @param projectId 目标项目ID
   * @param data 导入参数
   * @returns 导入结果
   */
  importAsset(
    projectId: string,
    data: ImportAssetDto,
  ): Promise<ImportAssetResponseDto> {
    return api
      .post<ImportAssetResponseDto>(
        `${PROJECTS_URL}/${projectId}${BASE_URL}/import`,
        data,
      )
      .then((res) => res.data);
  },

  /**
   * 批量导入资产
   * @param projectId 目标项目ID
   * @param data 批量导入参数
   * @returns 批量导入结果
   */
  batchImportAssets(
    projectId: string,
    data: BatchImportAssetsDto,
  ): Promise<BatchImportAssetsResponseDto> {
    return api
      .post<BatchImportAssetsResponseDto>(
        `${PROJECTS_URL}/${projectId}${BASE_URL}/import/batch`,
        data,
      )
      .then((res) => res.data);
  },

  /**
   * 检查导入冲突
   * @param projectId 目标项目ID
   * @param data 检查参数
   * @returns 冲突检查结果
   */
  checkImportConflicts(
    projectId: string,
    data: CheckImportConflictDto,
  ): Promise<CheckImportConflictResultDto> {
    return api
      .post<CheckImportConflictResultDto>(
        `${PROJECTS_URL}/${projectId}${BASE_URL}/import/check`,
        data,
      )
      .then((res) => res.data);
  },

  /**
   * 获取导入历史
   * @param projectId 项目ID
   * @param params 分页参数
   * @returns 导入历史
   */
  getImportHistory(
    projectId: string,
    params?: { page?: number; pageSize?: number },
  ): Promise<ImportHistoryDto> {
    return api
      .get<ImportHistoryDto>(
        `${PROJECTS_URL}/${projectId}${BASE_URL}/import-history`,
        { params },
      )
      .then((res) => res.data);
  },

  /**
   * 获取批量导入详情
   * @param projectId 项目ID
   * @param batchId 批次ID
   * @returns 批量导入详情
   */
  getBatchImportDetail(
    projectId: string,
    batchId: string,
  ): Promise<BatchImportDetailDto> {
    return api
      .get<BatchImportDetailDto>(
        `${PROJECTS_URL}/${projectId}${BASE_URL}/import/batch/${batchId}`,
      )
      .then((res) => res.data);
  },

  // ==================== 收藏 ====================

  /**
   * 获取用户收藏列表
   * @param params 查询参数
   * @returns 收藏列表
   */
  getFavorites(params?: GetFavoritesDto): Promise<FavoriteListDto> {
    return api
      .get<FavoriteListDto>(`${USER_URL}/favorites`, { params })
      .then((res) => res.data);
  },

  /**
   * 添加收藏
   * @param data 收藏参数
   * @returns 收藏结果
   */
  addFavorite(data: AddFavoriteDto): Promise<AddFavoriteResponseDto> {
    return api
      .post<AddFavoriteResponseDto>(`${USER_URL}/favorites`, data)
      .then((res) => res.data);
  },

  /**
   * 取消收藏
   * @param type 资产类型
   * @param id 资产ID
   */
  removeFavorite(type: string, id: string): Promise<void> {
    return api
      .delete(`${USER_URL}/favorites/${type}/${id}`)
      .then(() => undefined);
  },

  // ==================== 最近使用 ====================

  /**
   * 获取最近使用列表
   * @param params 查询参数
   * @returns 最近使用列表
   */
  getRecent(params?: GetRecentDto): Promise<RecentItemDto[]> {
    return api
      .get<{ list: RecentItemDto[] }>(`${USER_URL}/recent`, { params })
      .then((res) => res.data.list);
  },

  /**
   * 清除最近使用记录
   */
  clearRecent(): Promise<void> {
    return api.delete(`${USER_URL}/recent`).then(() => undefined);
  },
};

export default assetApi;
