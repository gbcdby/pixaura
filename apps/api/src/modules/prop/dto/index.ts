/**
 * Prop 模块 DTOs
 * 所有类型从 @pixaura/shared-types 导入，避免重复定义
 */

export {
  // Schemas
  CreatePropSchema,
  UpdatePropSchema,
  QueryPropsSchema,
  BatchCreatePropsSchema,
  GeneratePropImageSchema,
  UploadPropImageSchema,
  ImportPropsSchema,
  // DTO Types
  type CreatePropDto,
  type UpdatePropDto,
  type QueryPropsDto,
  type BatchCreatePropsDto,
  type GeneratePropImageDto,
  type UploadPropImageDto,
  type ImportPropsDto,
} from "@pixaura/shared-types";
