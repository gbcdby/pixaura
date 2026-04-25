/**
 * 搜索资产 DTO
 */

import { z } from "zod";
import { SearchAssetsSchema, AssetSuggestSchema } from "@pixaura/shared-types";

// 重新导出 Schema
export { SearchAssetsSchema, AssetSuggestSchema };

// 导出 DTO 类型
export type SearchAssetsDto = z.infer<typeof SearchAssetsSchema>;
export type AssetSuggestDto = z.infer<typeof AssetSuggestSchema>;
