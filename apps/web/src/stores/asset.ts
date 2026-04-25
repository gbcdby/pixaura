import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { assetApi } from "@/api/asset";
import { ConflictHandling } from "@pixaura/shared-types";
import type {
  AssetSummaryDto,
  AssetListDto,
  FavoriteItemDto,
  FavoriteListDto,
  RecentItemDto,
  PopularAssetsDto,
  ImportAssetResponseDto,
  BatchImportAssetsResponseDto,
  QueryAssetsDto,
  SearchAssetsDto,
  GetPopularAssetsDto,
  ImportAssetDto,
  BatchImportAssetsDto,
  AddFavoriteDto,
  GetFavoritesDto,
  GetRecentDto,
  AssetFilters,
  PaginationInfo,
  LibraryAssetType,
} from "@pixaura/shared-types";

/**
 * Asset Store - 素材库资产管理
 * 管理资产列表、收藏、最近使用、导入等功能
 */
export const useAssetStore = defineStore("asset", () => {
  // ==================== State ====================

  /**
   * 筛选条件
   */
  const filters = ref<AssetFilters>({
    projectId: "all",
    assetType: "all",
    status: "all",
    sortBy: "updatedAt",
    sortOrder: "desc",
    keyword: "",
  });

  /**
   * 视图模式：网格或列表
   */
  const viewMode = ref<"grid" | "list">("grid");

  /**
   * 资产列表
   */
  const assets = ref<AssetSummaryDto[]>([]);

  /**
   * 分页信息
   */
  const pagination = ref<PaginationInfo>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });

  /**
   * 加载状态
   */
  const loading = ref(false);

  /**
   * 已选中的资产ID集合
   */
  const selectedAssets = ref<Set<string>>(new Set());

  /**
   * 收藏列表
   */
  const favorites = ref<FavoriteItemDto[]>([]);

  /**
   * 收藏分页信息
   */
  const favoritesPagination = ref<PaginationInfo>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });

  /**
   * 最近使用列表
   */
  const recent = ref<RecentItemDto[]>([]);

  /**
   * 热门资产列表
   */
  const popularAssets = ref<AssetSummaryDto[]>([]);

  // ==================== Getters ====================

  /**
   * 是否全选
   */
  const isAllSelected = computed(() => {
    return (
      assets.value.length > 0 &&
      selectedAssets.value.size === assets.value.length
    );
  });

  /**
   * 是否有选中项
   */
  const hasSelection = computed(() => selectedAssets.value.size > 0);

  /**
   * 选中项数量
   */
  const selectedCount = computed(() => selectedAssets.value.size);

  /**
   * 选中项列表
   */
  const selectedItems = computed(() => {
    return assets.value.filter((asset) => selectedAssets.value.has(asset.id));
  });

  // ==================== Actions: 资产列表 ====================

  /**
   * 获取资产列表
   * @param options - 查询参数，可选
   * @returns 资产列表响应
   */
  async function fetchAssets(
    options?: Partial<QueryAssetsDto>,
  ): Promise<AssetListDto> {
    loading.value = true;
    try {
      // 合并筛选条件和传入的参数
      const params: QueryAssetsDto = {
        type:
          filters.value.assetType === "all"
            ? undefined
            : filters.value.assetType,
        projectId:
          filters.value.projectId === "all"
            ? undefined
            : filters.value.projectId,
        status:
          filters.value.status === "all" ? undefined : filters.value.status,
        keyword: filters.value.keyword || undefined,
        sortBy: filters.value.sortBy,
        sortOrder: filters.value.sortOrder,
        page: pagination.value.page,
        pageSize: pagination.value.pageSize,
        ...options,
      };

      const res = await assetApi.getAssets(params);
      assets.value = res.list;
      pagination.value = res.pagination;
      return res;
    } catch (error) {
      console.error("获取资产列表失败:", error);
      throw error;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 搜索资产
   * @param keyword - 搜索关键词
   * @param options - 其他搜索参数
   * @returns 搜索结果
   */
  async function searchAssets(
    keyword: string,
    options?: Partial<SearchAssetsDto>,
  ): Promise<AssetListDto> {
    loading.value = true;
    try {
      const params: SearchAssetsDto = {
        q: keyword,
        type:
          filters.value.assetType === "all"
            ? undefined
            : filters.value.assetType,
        projectId:
          filters.value.projectId === "all"
            ? undefined
            : filters.value.projectId,
        includeSystem: false,
        page: 1,
        pageSize: pagination.value.pageSize,
        ...options,
      };

      const res = await assetApi.searchAssets(params);
      assets.value = res.list;
      pagination.value = res.pagination;
      // 更新筛选条件中的关键词
      filters.value.keyword = keyword;
      return res;
    } catch (error) {
      console.error("搜索资产失败:", error);
      throw error;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 获取热门资产
   * @param type - 资产类型，可选
   * @param options - 其他参数
   * @returns 热门资产列表
   */
  async function fetchPopularAssets(
    type?: LibraryAssetType,
    options?: Partial<GetPopularAssetsDto>,
  ): Promise<PopularAssetsDto> {
    loading.value = true;
    try {
      const params: GetPopularAssetsDto = {
        type,
        limit: 10,
        period: "month",
        ...options,
      };

      const res = await assetApi.getPopularAssets(params);
      // 将 PopularAssetItemDto 转换为 AssetSummaryDto 格式
      popularAssets.value = res.list.map((item) => ({
        id: item.id,
        type: item.type,
        name: item.name,
        description: item.description,
        thumbnailUrl: item.thumbnailUrl,
        status: "active",
        projectId: item.projectId,
        projectName: item.projectName,
        createdAt: "",
        updatedAt: "",
        stats: {
          usageCount: item.usageCount,
          importCount: item.importCount,
          heatScore: item.heatScore,
        },
        isFavorited: false,
      }));
      return res;
    } catch (error) {
      console.error("获取热门资产失败:", error);
      throw error;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 更新筛选条件
   * @param newFilters - 新的筛选条件
   */
  function updateFilters(newFilters: Partial<AssetFilters>) {
    filters.value = { ...filters.value, ...newFilters };
    // 重置到第一页
    pagination.value.page = 1;
  }

  /**
   * 重置筛选条件
   */
  function resetFilters() {
    filters.value = {
      projectId: "all",
      assetType: "all",
      status: "all",
      sortBy: "updatedAt",
      sortOrder: "desc",
      keyword: "",
    };
    pagination.value.page = 1;
  }

  /**
   * 设置视图模式
   * @param mode - 视图模式
   */
  function setViewMode(mode: "grid" | "list") {
    viewMode.value = mode;
  }

  // ==================== Actions: 导入 ====================

  /**
   * 导入单个资产
   * @param asset - 要导入的资产信息
   * @param targetProjectId - 目标项目ID
   * @param conflictHandling - 冲突处理方式
   * @returns 导入结果
   */
  async function importAsset(
    asset: {
      assetType: LibraryAssetType;
      assetId: string;
      sourceProjectId: string;
    },
    targetProjectId: string,
    conflictHandling: ConflictHandling = ConflictHandling.RENAME,
  ): Promise<ImportAssetResponseDto> {
    try {
      const data: ImportAssetDto = {
        assetType: asset.assetType,
        assetId: asset.assetId,
        sourceProjectId: asset.sourceProjectId,
        conflictHandling,
      };

      const res = await assetApi.importAsset(targetProjectId, data);
      return res;
    } catch (error) {
      console.error("导入资产失败:", error);
      throw error;
    }
  }

  /**
   * 批量导入资产
   * @param assets - 要导入的资产列表
   * @param targetProjectId - 目标项目ID
   * @param conflictHandling - 冲突处理方式
   * @returns 批量导入结果
   */
  async function batchImportAssets(
    assets: Array<{
      assetType: LibraryAssetType;
      assetId: string;
      sourceProjectId: string;
    }>,
    targetProjectId: string,
    conflictHandling: ConflictHandling = ConflictHandling.RENAME,
  ): Promise<BatchImportAssetsResponseDto> {
    try {
      const data: BatchImportAssetsDto = {
        assets: assets.map((a) => ({
          assetType: a.assetType,
          assetId: a.assetId,
          sourceProjectId: a.sourceProjectId,
        })),
        conflictHandling,
        continueOnError: true,
      };

      const res = await assetApi.batchImportAssets(targetProjectId, data);
      return res;
    } catch (error) {
      console.error("批量导入资产失败:", error);
      throw error;
    }
  }

  // ==================== Actions: 收藏 ====================

  /**
   * 添加收藏
   * @param assetType - 资产类型
   * @param assetId - 资产ID
   * @param tags - 自定义标签，可选
   * @returns 添加收藏响应
   */
  async function favoriteAsset(
    assetType: LibraryAssetType,
    assetId: string,
    tags?: string[],
  ): Promise<void> {
    try {
      const data: AddFavoriteDto = {
        assetType,
        assetId,
        tags,
      };

      await assetApi.addFavorite(data);

      // 更新本地资产列表中的收藏状态
      const asset = assets.value.find(
        (a) => a.id === assetId && a.type === assetType,
      );
      if (asset) {
        asset.isFavorited = true;
      }

      // 更新热门资产列表中的收藏状态
      const popularAsset = popularAssets.value.find(
        (a) => a.id === assetId && a.type === assetType,
      );
      if (popularAsset) {
        popularAsset.isFavorited = true;
      }
    } catch (error) {
      console.error("添加收藏失败:", error);
      throw error;
    }
  }

  /**
   * 取消收藏
   * @param assetType - 资产类型
   * @param assetId - 资产ID
   */
  async function unfavoriteAsset(
    assetType: LibraryAssetType,
    assetId: string,
  ): Promise<void> {
    try {
      await assetApi.removeFavorite(assetType, assetId);

      // 更新本地资产列表中的收藏状态
      const asset = assets.value.find(
        (a) => a.id === assetId && a.type === assetType,
      );
      if (asset) {
        asset.isFavorited = false;
      }

      // 更新热门资产列表中的收藏状态
      const popularAsset = popularAssets.value.find(
        (a) => a.id === assetId && a.type === assetType,
      );
      if (popularAsset) {
        popularAsset.isFavorited = false;
      }

      // 从收藏列表中移除
      favorites.value = favorites.value.filter(
        (f) => !(f.assetType === assetType && f.assetId === assetId),
      );
    } catch (error) {
      console.error("取消收藏失败:", error);
      throw error;
    }
  }

  /**
   * 获取收藏列表
   * @param type - 资产类型筛选，可选
   * @param options - 其他参数
   * @returns 收藏列表响应
   */
  async function fetchFavorites(
    type?: LibraryAssetType,
    options?: Partial<GetFavoritesDto>,
  ): Promise<FavoriteListDto> {
    loading.value = true;
    try {
      const params: GetFavoritesDto = {
        type,
        page: favoritesPagination.value.page,
        pageSize: favoritesPagination.value.pageSize,
        ...options,
      };

      const res = await assetApi.getFavorites(params);
      favorites.value = res.list;
      favoritesPagination.value = res.pagination;
      return res;
    } catch (error) {
      console.error("获取收藏列表失败:", error);
      throw error;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 切换收藏状态
   * @param assetType - 资产类型
   * @param assetId - 资产ID
   * @param tags - 自定义标签，可选
   */
  async function toggleFavorite(
    assetType: LibraryAssetType,
    assetId: string,
    tags?: string[],
  ): Promise<void> {
    // 检查当前是否已收藏
    const isFavorited =
      assets.value.find((a) => a.id === assetId)?.isFavorited ||
      favorites.value.some(
        (f) => f.assetType === assetType && f.assetId === assetId,
      );

    if (isFavorited) {
      await unfavoriteAsset(assetType, assetId);
    } else {
      await favoriteAsset(assetType, assetId, tags);
    }
  }

  // ==================== Actions: 最近使用 ====================

  /**
   * 获取最近使用列表
   * @param limit - 返回数量限制
   * @param type - 资产类型筛选，可选
   * @returns 最近使用列表
   */
  async function fetchRecent(
    limit: number = 20,
    type?: LibraryAssetType,
  ): Promise<RecentItemDto[]> {
    try {
      const params: GetRecentDto = {
        limit,
        type,
      };

      const res = await assetApi.getRecent(params);
      recent.value = res;
      return res;
    } catch (error) {
      console.error("获取最近使用列表失败:", error);
      throw error;
    }
  }

  /**
   * 清除最近使用记录
   */
  async function clearRecent(): Promise<void> {
    try {
      await assetApi.clearRecent();
      recent.value = [];
    } catch (error) {
      console.error("清除最近使用记录失败:", error);
      throw error;
    }
  }

  // ==================== Actions: 选择操作（批量） ====================

  /**
   * 选中资产
   * @param assetId - 资产ID
   */
  function selectAsset(assetId: string) {
    selectedAssets.value.add(assetId);
  }

  /**
   * 取消选中资产
   * @param assetId - 资产ID
   */
  function deselectAsset(assetId: string) {
    selectedAssets.value.delete(assetId);
  }

  /**
   * 切换选中状态
   * @param assetId - 资产ID
   */
  function toggleSelect(assetId: string) {
    if (selectedAssets.value.has(assetId)) {
      selectedAssets.value.delete(assetId);
    } else {
      selectedAssets.value.add(assetId);
    }
  }

  /**
   * 清除所有选中
   */
  function clearSelection() {
    selectedAssets.value.clear();
  }

  /**
   * 全选
   */
  function selectAll() {
    assets.value.forEach((asset) => {
      selectedAssets.value.add(asset.id);
    });
  }

  /**
   * 反选
   */
  function invertSelection() {
    const newSelection = new Set<string>();
    assets.value.forEach((asset) => {
      if (!selectedAssets.value.has(asset.id)) {
        newSelection.add(asset.id);
      }
    });
    selectedAssets.value = newSelection;
  }

  // ==================== 其他 Actions ====================

  /**
   * 设置当前页码
   * @param page - 页码
   */
  function setPage(page: number) {
    pagination.value.page = page;
  }

  /**
   * 设置每页数量
   * @param pageSize - 每页数量
   */
  function setPageSize(pageSize: number) {
    pagination.value.pageSize = pageSize;
    pagination.value.page = 1;
  }

  /**
   * 重置 Store 状态
   */
  function reset() {
    filters.value = {
      projectId: "all",
      assetType: "all",
      status: "all",
      sortBy: "updatedAt",
      sortOrder: "desc",
      keyword: "",
    };
    viewMode.value = "grid";
    assets.value = [];
    pagination.value = {
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    };
    selectedAssets.value.clear();
    favorites.value = [];
    recent.value = [];
    popularAssets.value = [];
  }

  // ==================== Return ====================

  return {
    // State
    filters,
    viewMode,
    assets,
    pagination,
    loading,
    selectedAssets,
    favorites,
    favoritesPagination,
    recent,
    popularAssets,

    // Getters
    isAllSelected,
    hasSelection,
    selectedCount,
    selectedItems,

    // Actions: 资产列表
    fetchAssets,
    searchAssets,
    fetchPopularAssets,
    updateFilters,
    resetFilters,
    setViewMode,

    // Actions: 导入
    importAsset,
    batchImportAssets,

    // Actions: 收藏
    favoriteAsset,
    unfavoriteAsset,
    fetchFavorites,
    toggleFavorite,

    // Actions: 最近使用
    fetchRecent,
    clearRecent,

    // Actions: 选择操作
    selectAsset,
    deselectAsset,
    toggleSelect,
    clearSelection,
    selectAll,
    invertSelection,

    // 其他 Actions
    setPage,
    setPageSize,
    reset,
  };
});
