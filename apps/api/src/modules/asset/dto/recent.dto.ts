/**
 * 最近使用相关 DTO
 */

import { z } from "zod";
import { GetRecentSchema } from "@pixaura/shared-types";

// 重新导出 Schema
export { GetRecentSchema };

// 导出 DTO 类型
export type GetRecentDto = z.infer<typeof GetRecentSchema>;
