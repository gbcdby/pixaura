/**
 * Scene 模块 DTOs
 * 所有类型从 @pixaura/shared-types 导入，避免重复定义
 */

export {
  // Schemas
  CreateSceneSchema,
  UpdateSceneSchema,
  QueryScenesSchema,
  BatchCreateScenesSchema,
  GenerateSceneImageSchema,
  UploadSceneImageSchema,
  ImportScenesSchema,
  // DTO Types
  type CreateSceneDto,
  type UpdateSceneDto,
  type QueryScenesDto,
  type BatchCreateScenesDto,
  type GenerateSceneImageDto,
  type UploadSceneImageDto,
  type ImportScenesDto,
  // 常量
  SceneImageType,
  VariantType,
} from "@pixaura/shared-types";
