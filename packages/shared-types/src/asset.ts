import { z } from "zod";

/**
 * 素材库资产类型
 */
export const LibraryAssetType = {
  CHARACTER: "character",
  SCENE: "scene",
  PROP: "prop",
} as const;

export type LibraryAssetType =
  (typeof LibraryAssetType)[keyof typeof LibraryAssetType];

/**
 * 素材库资产状态
 */
export const LibraryAssetStatus = {
  DRAFT: "draft",
  ACTIVE: "active",
  ARCHIVED: "archived",
} as const;

export type LibraryAssetStatus =
  (typeof LibraryAssetStatus)[keyof typeof LibraryAssetStatus];

/**
 * 用户操作类型
 */
export const UserActionType = {
  VIEW: "view",
  IMPORT: "import",
  USE_IN_SHOT: "use_in_shot",
} as const;

export type UserActionType =
  (typeof UserActionType)[keyof typeof UserActionType];

/**
 * 冲突处理方式
 */
export const ConflictHandling = {
  SKIP: "skip",
  RENAME: "rename",
  REPLACE: "replace",
} as const;

export type ConflictHandling =
  (typeof ConflictHandling)[keyof typeof ConflictHandling];

/**
 * 导入方式
 */
export const ImportMethod = {
  SINGLE: "single",
  BATCH: "batch",
} as const;

export type ImportMethod = (typeof ImportMethod)[keyof typeof ImportMethod];

// ==================== 子结构 Schema ====================

/**
 * 资产统计信息
 */
export const AssetStatsInfoSchema = z.object({
  usageCount: z.number().default(0).describe("被引用次数"),
  importCount: z.number().default(0).describe("被导入次数"),
  heatScore: z.number().default(0).describe("热度分数"),
});

export type AssetStatsInfo = z.infer<typeof AssetStatsInfoSchema>;

/**
 * 资产快照
 */
export const AssetSnapshotSchema = z.object({
  name: z.string().describe("资产名称"),
  description: z.string().describe("资产描述"),
  thumbnailUrl: z.string().describe("缩略图URL"),
  projectName: z.string().describe("所属项目名称"),
  projectId: z.string().describe("所属项目ID"),
});

export type AssetSnapshot = z.infer<typeof AssetSnapshotSchema>;

/**
 * 导入上下文
 */
export const ImportContextSchema = z.object({
  sourceProjectId: z.string().optional().describe("源项目ID"),
  targetProjectId: z.string().optional().describe("目标项目ID"),
  shotId: z.string().optional().describe("分镜ID"),
});

export type ImportContext = z.infer<typeof ImportContextSchema>;

/**
 * 使用分布
 */
export const UsageDistributionSchema = z.object({
  byProject: z
    .array(
      z.object({
        projectId: z.string(),
        projectName: z.string(),
        count: z.number(),
      }),
    )
    .describe("按项目分布"),
  byTime: z
    .array(
      z.object({
        date: z.string(),
        count: z.number(),
      }),
    )
    .describe("按时间分布（最近30天）"),
});

export type UsageDistribution = z.infer<typeof UsageDistributionSchema>;

// ==================== 请求 DTOs ====================

/**
 * 查询资产列表参数
 */
export const QueryAssetsSchema = z.object({
  type: z
    .enum([
      LibraryAssetType.CHARACTER,
      LibraryAssetType.SCENE,
      LibraryAssetType.PROP,
    ])
    .optional()
    .describe("资产类型"),
  projectId: z.string().optional().describe("项目ID，不传则查所有项目"),
  status: z
    .enum([
      LibraryAssetStatus.DRAFT,
      LibraryAssetStatus.ACTIVE,
      LibraryAssetStatus.ARCHIVED,
    ])
    .optional()
    .describe("状态"),
  keyword: z.string().optional().describe("关键词搜索"),
  sortBy: z
    .enum(["createdAt", "updatedAt", "name", "heatScore"])
    .default("updatedAt")
    .describe("排序字段"),
  sortOrder: z.enum(["asc", "desc"]).default("desc").describe("排序方向"),
  page: z.coerce.number().int().positive().default(1).describe("页码"),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(100)
    .default(20)
    .describe("每页数量"),
});

export type QueryAssetsDto = z.infer<typeof QueryAssetsSchema>;

/**
 * 搜索资产参数
 */
export const SearchAssetsSchema = z.object({
  q: z.string().min(2).describe("搜索关键词，最少2个字符"),
  type: z.string().optional().describe("资产类型，可多选（逗号分隔）"),
  projectId: z.string().optional().describe("限定项目"),
  includeSystem: z.coerce.boolean().default(false).describe("是否包含系统模板"),
  page: z.coerce.number().int().positive().default(1).describe("页码"),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(100)
    .default(20)
    .describe("每页数量"),
});

export type SearchAssetsDto = z.infer<typeof SearchAssetsSchema>;

/**
 * 获取热门资产参数
 */
export const GetPopularAssetsSchema = z.object({
  type: z
    .enum([
      LibraryAssetType.CHARACTER,
      LibraryAssetType.SCENE,
      LibraryAssetType.PROP,
    ])
    .optional()
    .describe("资产类型"),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(50)
    .default(10)
    .describe("返回数量"),
  period: z
    .enum(["week", "month", "all"])
    .default("month")
    .describe("统计周期"),
});

export type GetPopularAssetsDto = z.infer<typeof GetPopularAssetsSchema>;

/**
 * 导入资产 DTO
 */
export const ImportAssetSchema = z.object({
  assetType: z
    .enum([
      LibraryAssetType.CHARACTER,
      LibraryAssetType.SCENE,
      LibraryAssetType.PROP,
    ])
    .describe("资产类型"),
  assetId: z.string().describe("源资产ID"),
  sourceProjectId: z.string().describe("源项目ID"),
  conflictHandling: z
    .enum([
      ConflictHandling.SKIP,
      ConflictHandling.RENAME,
      ConflictHandling.REPLACE,
    ])
    .default(ConflictHandling.RENAME)
    .describe("冲突处理方式"),
  newName: z.string().optional().describe("重命名时的新名称"),
});

export type ImportAssetDto = z.infer<typeof ImportAssetSchema>;

/**
 * 批量导入资产 DTO
 */
export const BatchImportAssetsSchema = z.object({
  assets: z
    .array(
      z.object({
        assetType: z
          .enum([
            LibraryAssetType.CHARACTER,
            LibraryAssetType.SCENE,
            LibraryAssetType.PROP,
          ])
          .describe("资产类型"),
        assetId: z.string().describe("资产ID"),
        sourceProjectId: z.string().describe("源项目ID"),
      }),
    )
    .min(1)
    .max(20)
    .describe("资产列表，单次最多20个"),
  conflictHandling: z
    .enum([
      ConflictHandling.SKIP,
      ConflictHandling.RENAME,
      ConflictHandling.REPLACE,
    ])
    .default(ConflictHandling.RENAME)
    .describe("冲突处理方式"),
  continueOnError: z
    .boolean()
    .default(true)
    .describe("是否继续处理后续（遇到错误时）"),
});

export type BatchImportAssetsDto = z.infer<typeof BatchImportAssetsSchema>;

/**
 * 检查导入冲突 DTO
 */
export const CheckImportConflictSchema = z.object({
  assets: z
    .array(
      z.object({
        assetType: z
          .enum([
            LibraryAssetType.CHARACTER,
            LibraryAssetType.SCENE,
            LibraryAssetType.PROP,
          ])
          .describe("资产类型"),
        assetId: z.string().describe("资产ID"),
        sourceProjectId: z.string().describe("源项目ID"),
      }),
    )
    .min(1)
    .describe("资产列表"),
});

export type CheckImportConflictDto = z.infer<typeof CheckImportConflictSchema>;

/**
 * 添加收藏 DTO
 */
export const AddFavoriteSchema = z.object({
  assetType: z
    .enum([
      LibraryAssetType.CHARACTER,
      LibraryAssetType.SCENE,
      LibraryAssetType.PROP,
    ])
    .describe("资产类型"),
  assetId: z.string().describe("资产ID"),
  tags: z.array(z.string().max(50)).max(10).optional().describe("自定义标签"),
});

export type AddFavoriteDto = z.infer<typeof AddFavoriteSchema>;

/**
 * 获取收藏列表参数
 */
export const GetFavoritesSchema = z.object({
  type: z
    .enum([
      LibraryAssetType.CHARACTER,
      LibraryAssetType.SCENE,
      LibraryAssetType.PROP,
    ])
    .optional()
    .describe("资产类型"),
  tag: z.string().optional().describe("标签筛选"),
  page: z.coerce.number().int().positive().default(1).describe("页码"),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(50)
    .default(20)
    .describe("每页数量"),
});

export type GetFavoritesDto = z.infer<typeof GetFavoritesSchema>;

/**
 * 获取最近使用参数
 */
export const GetRecentSchema = z.object({
  type: z
    .enum([
      LibraryAssetType.CHARACTER,
      LibraryAssetType.SCENE,
      LibraryAssetType.PROP,
    ])
    .optional()
    .describe("资产类型"),
  action: z
    .enum([
      UserActionType.VIEW,
      UserActionType.IMPORT,
      UserActionType.USE_IN_SHOT,
    ])
    .optional()
    .describe("操作类型"),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(50)
    .default(20)
    .describe("返回数量"),
});

export type GetRecentDto = z.infer<typeof GetRecentSchema>;

/**
 * 搜索建议参数
 */
export const AssetSuggestSchema = z.object({
  q: z.string().min(1).describe("关键词前缀"),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(20)
    .default(10)
    .describe("返回数量"),
});

export type AssetSuggestDto = z.infer<typeof AssetSuggestSchema>;

// ==================== Response DTOs ====================

/**
 * 分页信息
 */
export interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * 资产摘要（列表展示）
 */
export interface AssetSummaryDto {
  id: string;
  type: LibraryAssetType;
  name: string;
  description: string;
  thumbnailUrl: string;
  status: LibraryAssetStatus;
  projectId: string;
  projectName: string;
  createdAt: string;
  updatedAt: string;
  stats?: AssetStatsInfo;
  isFavorited: boolean;
}

/**
 * 资产列表响应
 */
export interface AssetListDto {
  list: AssetSummaryDto[];
  pagination: PaginationInfo;
}

/**
 * 资产详情响应（基础）
 */
export interface AssetDetailBaseDto {
  id: string;
  type: LibraryAssetType;
  name: string;
  description: string;
  status: LibraryAssetStatus;
  projectId: string;
  projectName: string;
  thumbnailUrl: string;
  stats: AssetStatsInfo;
  isFavorited: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * 资产统计响应
 */
export interface AssetStatsDto {
  assetId: string;
  assetType: LibraryAssetType;
  projectId: string;
  usageCount: number;
  importCount: number;
  viewCount: number;
  firstUsedAt?: string;
  lastUsedAt?: string;
  lastImportedAt?: string;
  heatScore: number;
  heatRank?: number;
  usageDistribution: UsageDistribution;
}

/**
 * 热门资产项
 */
export interface PopularAssetItemDto {
  rank: number;
  id: string;
  type: LibraryAssetType;
  name: string;
  description: string;
  thumbnailUrl: string;
  projectId: string;
  projectName: string;
  heatScore: number;
  importCount: number;
  usageCount: number;
}

/**
 * 热门资产响应
 */
export interface PopularAssetsDto {
  list: PopularAssetItemDto[];
  updatedAt: string;
}

/**
 * 导入冲突信息
 */
export interface ImportConflictDto {
  assetId: string;
  assetType: LibraryAssetType;
  sourceName: string;
  conflictType: "name";
  existingAsset: {
    id: string;
    name: string;
    createdAt: string;
  };
}

/**
 * 检查导入冲突响应
 */
export interface CheckImportConflictResultDto {
  total: number;
  conflicts: ImportConflictDto[];
  conflictCount: number;
}

/**
 * 导入结果
 */
export interface ImportResultDto {
  assetId: string;
  assetType: LibraryAssetType;
  success: boolean;
  targetAssetId?: string;
  targetAssetName?: string;
  error?: {
    code: number;
    message: string;
  };
}

/**
 * 单资产导入响应
 */
export interface ImportAssetResponseDto {
  success: boolean;
  targetAssetId: string;
  targetAssetName: string;
  conflictResolved?: {
    originalName: string;
    resolution: ConflictHandling;
    newName?: string;
  };
  importedAt: string;
}

/**
 * 批量导入响应
 */
export interface BatchImportAssetsResponseDto {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  results: ImportResultDto[];
  importId: string;
}

/**
 * 批量导入批次详情
 */
export interface BatchImportDetailDto {
  batchId: string;
  projectId: string;
  status: "completed" | "partial_failed" | "failed";
  summary: {
    total: number;
    success: number;
    failed: number;
    skipped: number;
  };
  createdAt: string;
  completedAt: string;
  failedItems: Array<{
    assetId: string;
    assetType: LibraryAssetType;
    sourceProjectId: string;
    sourceProjectName: string;
    sourceAssetName: string;
    error: {
      code: number;
      message: string;
    };
    retryable: boolean;
  }>;
  successItems: Array<{
    assetId: string;
    assetType: LibraryAssetType;
    targetAssetId: string;
    targetAssetName: string;
  }>;
}

/**
 * 导入历史项
 */
export interface ImportHistoryItemDto {
  id: string;
  sourceAssetType: LibraryAssetType;
  sourceAssetId: string;
  sourceAssetName: string;
  sourceProjectId: string;
  sourceProjectName: string;
  targetAssetId: string;
  targetAssetName: string;
  importedBy: string;
  importedByName: string;
  importedAt: string;
  conflictHandling?: ConflictHandling;
}

/**
 * 导入历史响应
 */
export interface ImportHistoryDto {
  list: ImportHistoryItemDto[];
  pagination: PaginationInfo;
}

/**
 * 收藏资产项
 */
export interface FavoriteItemDto {
  id: string;
  assetType: LibraryAssetType;
  assetId: string;
  name: string;
  description: string;
  thumbnailUrl: string;
  projectName: string;
  projectId: string;
  favoritedAt: string;
  tags: string[];
}

/**
 * 收藏列表响应
 */
export interface FavoriteListDto {
  list: FavoriteItemDto[];
  pagination: PaginationInfo;
}

/**
 * 添加收藏响应
 */
export interface AddFavoriteResponseDto {
  id: string;
  assetType: LibraryAssetType;
  assetId: string;
  favoritedAt: string;
}

/**
 * 最近使用项
 */
export interface RecentItemDto {
  id: string;
  assetType: LibraryAssetType;
  assetId: string;
  name: string;
  thumbnailUrl: string;
  action: UserActionType;
  context?: {
    sourceProjectName?: string;
    targetProjectName?: string;
  };
  usedAt: string;
}

/**
 * 筛选选项响应
 */
export interface AssetFilterOptionsDto {
  types: Array<{
    value: LibraryAssetType;
    label: string;
    count: number;
  }>;
  statuses: Array<{
    value: LibraryAssetStatus;
    label: string;
  }>;
  projects: Array<{
    id: string;
    name: string;
    assetCount: number;
  }>;
  sortOptions: Array<{
    value: string;
    label: string;
  }>;
}

/**
 * 搜索建议项
 */
export interface AssetSuggestionDto {
  text: string;
  type: "name" | "tag" | "recent";
  count?: number;
}

/**
 * 搜索建议响应
 */
export interface AssetSuggestionsDto {
  suggestions: AssetSuggestionDto[];
}

// ==================== 前端状态类型 ====================

/**
 * 资产筛选条件
 */
export interface AssetFilters {
  projectId: string | "all";
  assetType: "all" | LibraryAssetType;
  status: "all" | LibraryAssetStatus;
  sortBy: "createdAt" | "updatedAt" | "name" | "heatScore";
  sortOrder: "asc" | "desc";
  keyword: string;
}

/**
 * 资产摘要（前端使用）
 * 与 AssetSummaryDto 相同，但使用 camelCase
 * 注意：避免与 script.ts 中的 AssetSummary 冲突
 */
export interface LibraryAssetSummary {
  id: string;
  type: LibraryAssetType;
  name: string;
  description: string;
  thumbnailUrl: string;
  status: LibraryAssetStatus;
  projectId: string;
  projectName: string;
  createdAt: string;
  updatedAt: string;
  stats?: AssetStatsInfo;
  isFavorited: boolean;
}

/**
 * 收藏资产（前端使用）
 * 注意：避免与可能的其他类型冲突，使用 LibraryAssetFavorite
 */
export interface LibraryAssetFavorite {
  id: string;
  assetType: LibraryAssetType;
  assetId: string;
  name: string;
  description: string;
  thumbnailUrl: string;
  projectName: string;
  projectId: string;
  favoritedAt: string;
  tags: string[];
}

/**
 * 最近使用（前端使用）
 * 注意：避免与可能的其他类型冲突，使用 LibraryAssetRecent
 */
export interface LibraryAssetRecent {
  id: string;
  assetType: LibraryAssetType;
  assetId: string;
  name: string;
  thumbnailUrl: string;
  action: UserActionType;
  context?: {
    sourceProjectName?: string;
    targetProjectName?: string;
  };
  usedAt: string;
}

/**
 * 资产统计（前端使用）
 * 注意：避免与可能的其他类型冲突，使用 LibraryAssetStats
 */
export interface LibraryAssetStats {
  assetId: string;
  assetType: LibraryAssetType;
  projectId: string;
  usageCount: number;
  importCount: number;
  viewCount: number;
  firstUsedAt?: string;
  lastUsedAt?: string;
  lastImportedAt?: string;
  heatScore: number;
  heatRank?: number;
  usageDistribution: UsageDistribution;
}

/**
 * 素材库状态（Pinia）
 */
export interface AssetLibraryState {
  filters: AssetFilters;
  viewMode: "grid" | "list";
  currentPage: number;
  pageSize: number;
  assets: AssetSummaryDto[];
  pagination: PaginationInfo;
  loading: boolean;
  selectedAssets: Set<string>;
}
