/**
 * Asset 模块 DTOs
 * 所有类型从 @pixaura/shared-types 导入，避免重复定义
 */

export {
  // Schemas
  QueryAssetsSchema,
  SearchAssetsSchema,
  GetPopularAssetsSchema,
  ImportAssetSchema,
  BatchImportAssetsSchema,
  CheckImportConflictSchema,
  AddFavoriteSchema,
  GetFavoritesSchema,
  GetRecentSchema,
  AssetSuggestSchema,
  // DTO Types
  type QueryAssetsDto,
  type SearchAssetsDto,
  type GetPopularAssetsDto,
  type ImportAssetDto,
  type BatchImportAssetsDto,
  type CheckImportConflictDto,
  type AddFavoriteDto,
  type GetFavoritesDto,
  type GetRecentDto,
  type AssetSuggestDto,
} from "@pixaura/shared-types";
