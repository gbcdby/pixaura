/**
 * 查询资产列表 DTO
 */

import { z } from "zod";
import { QueryAssetsSchema } from "@pixaura/shared-types";

// 重新导出 Schema
export { QueryAssetsSchema };

// 导出 DTO 类型
export type QueryAssetsDto = z.infer<typeof QueryAssetsSchema>;
