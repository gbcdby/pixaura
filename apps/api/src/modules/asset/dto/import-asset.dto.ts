/**
 * 导入资产相关 DTO
 */

import { z } from "zod";
import {
  ImportAssetSchema,
  BatchImportAssetsSchema,
  CheckImportConflictSchema,
} from "@pixaura/shared-types";

// 重新导出 Schema
export {
  ImportAssetSchema,
  BatchImportAssetsSchema,
  CheckImportConflictSchema,
};

// 导出 DTO 类型
export type ImportAssetDto = z.infer<typeof ImportAssetSchema>;
export type BatchImportAssetsDto = z.infer<typeof BatchImportAssetsSchema>;
export type CheckImportConflictDto = z.infer<typeof CheckImportConflictSchema>;
