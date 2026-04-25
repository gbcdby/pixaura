/**
 * Asset 模块前端类型定义
 */

// 从 shared-types 复用类型
export type {
  // 枚举类型
  LibraryAssetType,
  LibraryAssetStatus,
  UserActionType,
  ConflictHandling,
  ImportMethod,
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
  PaginationInfo,
  AssetSummaryDto,
  AssetListDto,
  AssetDetailBaseDto,
  AssetStatsDto,
  PopularAssetItemDto,
  PopularAssetsDto,
  ImportConflictDto,
  CheckImportConflictResultDto,
  ImportResultDto,
  ImportAssetResponseDto,
  BatchImportAssetsResponseDto,
  BatchImportDetailDto,
  ImportHistoryItemDto,
  ImportHistoryDto,
  FavoriteItemDto,
  FavoriteListDto,
  AddFavoriteResponseDto,
  RecentItemDto,
  AssetFilterOptionsDto,
  AssetSuggestionDto,
  AssetSuggestionsDto,
  // 状态类型
  AssetFilters,
  AssetLibraryState,
  // 子结构类型
  AssetStatsInfo,
  AssetSnapshot,
  ImportContext,
  UsageDistribution,
} from "@pixaura/shared-types";

// ==================== 前端特定类型 ====================

/**
 * 分页参数
 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

/**
 * 资产卡片组件 Props
 */
export interface AssetCardProps {
  /** 资产数据 */
  asset: import("@pixaura/shared-types").AssetSummaryDto;
  /** 视图模式 */
  viewMode?: "grid" | "list";
  /** 是否选中 */
  selected?: boolean;
  /** 是否显示选择框 */
  showCheckbox?: boolean;
  /** 是否显示收藏按钮 */
  showFavorite?: boolean;
  /** 是否显示操作菜单 */
  showActions?: boolean;
  /** 点击卡片回调 */
  onClick?: (asset: import("@pixaura/shared-types").AssetSummaryDto) => void;
  /** 切换选中状态回调 */
  onSelect?: (
    asset: import("@pixaura/shared-types").AssetSummaryDto,
    selected: boolean,
  ) => void;
  /** 切换收藏状态回调 */
  onFavorite?: (
    asset: import("@pixaura/shared-types").AssetSummaryDto,
    favorited: boolean,
  ) => void;
  /** 导入资产回调 */
  onImport?: (asset: import("@pixaura/shared-types").AssetSummaryDto) => void;
  /** 查看详情回调 */
  onViewDetail?: (
    asset: import("@pixaura/shared-types").AssetSummaryDto,
  ) => void;
}

/**
 * 资产列表组件 Props
 */
export interface AssetListProps {
  /** 资产列表 */
  assets: import("@pixaura/shared-types").AssetSummaryDto[];
  /** 视图模式 */
  viewMode?: "grid" | "list";
  /** 加载状态 */
  loading?: boolean;
  /** 选中的资产ID集合 */
  selectedIds?: Set<string>;
  /** 是否显示选择框 */
  showCheckbox?: boolean;
  /** 空状态提示文本 */
  emptyText?: string;
  /** 点击资产回调 */
  onAssetClick?: (
    asset: import("@pixaura/shared-types").AssetSummaryDto,
  ) => void;
  /** 切换选中状态回调 */
  onAssetSelect?: (
    asset: import("@pixaura/shared-types").AssetSummaryDto,
    selected: boolean,
  ) => void;
  /** 切换收藏状态回调 */
  onAssetFavorite?: (
    asset: import("@pixaura/shared-types").AssetSummaryDto,
    favorited: boolean,
  ) => void;
  /** 导入资产回调 */
  onAssetImport?: (
    asset: import("@pixaura/shared-types").AssetSummaryDto,
  ) => void;
}

/**
 * 资产筛选组件 Props
 */
export interface AssetFilterProps {
  /** 当前筛选条件 */
  filters: import("@pixaura/shared-types").AssetFilters;
  /** 筛选选项数据 */
  filterOptions?: import("@pixaura/shared-types").AssetFilterOptionsDto;
  /** 筛选变更回调 */
  onChange?: (filters: import("@pixaura/shared-types").AssetFilters) => void;
  /** 搜索回调 */
  onSearch?: (keyword: string) => void;
  /** 重置回调 */
  onReset?: () => void;
}

/**
 * 资产导入对话框 Props
 */
export interface AssetImportDialogProps {
  /** 是否可见 */
  visible: boolean;
  /** 目标项目ID */
  targetProjectId: string;
  /** 预选中的资产列表 */
  preselectedAssets?: Array<{
    assetType: import("@pixaura/shared-types").LibraryAssetType;
    assetId: string;
    sourceProjectId: string;
  }>;
  /** 关闭回调 */
  onClose?: () => void;
  /** 导入成功回调 */
  onSuccess?: (
    result: import("@pixaura/shared-types").BatchImportAssetsResponseDto,
  ) => void;
}

/**
 * 批量导入确认对话框 Props
 */
export interface ImportConfirmDialogProps {
  /** 是否可见 */
  visible: boolean;
  /** 冲突检查结果 */
  conflictResult?: import("@pixaura/shared-types").CheckImportConflictResultDto;
  /** 确认回调 */
  onConfirm?: (
    handling: import("@pixaura/shared-types").ConflictHandling,
  ) => void;
  /** 取消回调 */
  onCancel?: () => void;
}

/**
 * 收藏夹组件 Props
 */
export interface AssetFavoritesProps {
  /** 当前选中的类型筛选 */
  selectedType?: import("@pixaura/shared-types").LibraryAssetType | "all";
  /** 点击资产回调 */
  onAssetClick?: (
    asset: import("@pixaura/shared-types").FavoriteItemDto,
  ) => void;
  /** 取消收藏回调 */
  onRemoveFavorite?: (
    asset: import("@pixaura/shared-types").FavoriteItemDto,
  ) => void;
  /** 导入资产回调 */
  onImportAsset?: (
    asset: import("@pixaura/shared-types").FavoriteItemDto,
  ) => void;
}

/**
 * 最近使用组件 Props
 */
export interface AssetRecentProps {
  /** 显示数量限制 */
  limit?: number;
  /** 点击资产回调 */
  onAssetClick?: (asset: import("@pixaura/shared-types").RecentItemDto) => void;
  /** 导入资产回调 */
  onImportAsset?: (
    asset: import("@pixaura/shared-types").RecentItemDto,
  ) => void;
  /** 清空历史回调 */
  onClear?: () => void;
}

/**
 * 搜索建议组件 Props
 */
export interface SearchSuggestionsProps {
  /** 搜索关键词 */
  keyword: string;
  /** 建议列表 */
  suggestions: import("@pixaura/shared-types").AssetSuggestionDto[];
  /** 加载状态 */
  loading?: boolean;
  /** 选择建议回调 */
  onSelect?: (
    suggestion: import("@pixaura/shared-types").AssetSuggestionDto,
  ) => void;
  /** 关闭回调 */
  onClose?: () => void;
}

/**
 * 导入历史列表组件 Props
 */
export interface ImportHistoryProps {
  /** 项目ID */
  projectId: string;
  /** 点击导入记录回调 */
  onRecordClick?: (
    record: import("@pixaura/shared-types").ImportHistoryItemDto,
  ) => void;
  /** 重新导入回调 */
  onReimport?: (
    record: import("@pixaura/shared-types").ImportHistoryItemDto,
  ) => void;
}

/**
 * 批量导入结果组件 Props
 */
export interface BatchImportResultProps {
  /** 批量导入响应结果 */
  result: import("@pixaura/shared-types").BatchImportAssetsResponseDto;
  /** 查看详情回调 */
  onViewDetail?: (batchId: string) => void;
  /** 关闭回调 */
  onClose?: () => void;
}

/**
 * 资产统计卡片组件 Props
 */
export interface AssetStatsCardProps {
  /** 资产ID */
  assetId: string;
  /** 资产类型 */
  assetType: import("@pixaura/shared-types").LibraryAssetType;
  /** 统计数据 */
  stats?: import("@pixaura/shared-types").AssetStatsDto;
  /** 加载状态 */
  loading?: boolean;
}

/**
 * 热门资产列表组件 Props
 */
export interface PopularAssetsProps {
  /** 资产类型筛选 */
  type?: import("@pixaura/shared-types").LibraryAssetType;
  /** 显示数量 */
  limit?: number;
  /** 点击资产回调 */
  onAssetClick?: (
    asset: import("@pixaura/shared-types").PopularAssetItemDto,
  ) => void;
  /** 导入资产回调 */
  onImportAsset?: (
    asset: import("@pixaura/shared-types").PopularAssetItemDto,
  ) => void;
}

/**
 * 导入状态
 */
export interface ImportState {
  /** 是否正在导入 */
  importing: boolean;
  /** 导入进度 (0-100) */
  progress: number;
  /** 当前处理的资产索引 */
  currentIndex: number;
  /** 总数量 */
  total: number;
  /** 成功数量 */
  success: number;
  /** 失败数量 */
  failed: number;
  /** 跳过数量 */
  skipped: number;
  /** 当前处理中的资产名称 */
  currentAssetName?: string;
  /** 错误信息 */
  error?: string;
}

/**
 * 资产选择器组件 Props
 */
export interface AssetSelectorProps {
  /** 是否可见 */
  visible: boolean;
  /** 标题 */
  title?: string;
  /** 资产类型筛选 */
  assetType?: import("@pixaura/shared-types").LibraryAssetType | "all";
  /** 是否多选 */
  multiple?: boolean;
  /** 已选中的资产ID列表 */
  selectedIds?: string[];
  /** 排除的资产ID列表（不可选） */
  excludeIds?: string[];
  /** 确认回调 */
  onConfirm?: (
    selectedAssets: import("@pixaura/shared-types").AssetSummaryDto[],
  ) => void;
  /** 取消回调 */
  onCancel?: () => void;
}

/**
 * 资产拖拽数据
 */
export interface AssetDragData {
  /** 资产类型 */
  type: import("@pixaura/shared-types").LibraryAssetType;
  /** 资产ID */
  id: string;
  /** 资产名称 */
  name: string;
  /** 缩略图URL */
  thumbnailUrl: string;
  /** 源项目ID */
  projectId: string;
}

/**
 * 资产导入预览项
 */
export interface ImportPreviewItem {
  /** 资产类型 */
  assetType: import("@pixaura/shared-types").LibraryAssetType;
  /** 资产ID */
  assetId: string;
  /** 资产名称 */
  assetName: string;
  /** 源项目名称 */
  sourceProjectName: string;
  /** 缩略图URL */
  thumbnailUrl?: string;
  /** 是否有冲突 */
  hasConflict: boolean;
  /** 冲突信息 */
  conflictInfo?: import("@pixaura/shared-types").ImportConflictDto;
  /** 是否选中 */
  selected: boolean;
}
