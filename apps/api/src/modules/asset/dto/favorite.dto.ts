/**
 * 收藏相关 DTO
 */

import { z } from "zod";
import { AddFavoriteSchema, GetFavoritesSchema } from "@pixaura/shared-types";

// 重新导出 Schema
export { AddFavoriteSchema, GetFavoritesSchema };

// 导出 DTO 类型
export type AddFavoriteDto = z.infer<typeof AddFavoriteSchema>;
export type GetFavoritesDto = z.infer<typeof GetFavoritesSchema>;
