/**
 * Character 模块 DTOs
 * 所有类型从 @pixaura/shared-types 导入，避免重复定义
 */

export {
  // Schemas
  CreateCharacterSchema,
  UpdateCharacterSchema,
  QueryCharactersSchema,
  BatchCreateCharactersSchema,
  GenerateImageSchema,
  UploadImageSchema,
  ImportCharactersSchema,
  // DTO Types
  type CreateCharacterDto,
  type UpdateCharacterDto,
  type QueryCharactersDto,
  type BatchCreateCharactersDto,
  type GenerateImageDto,
  type UploadImageDto,
  type ImportCharactersDto,
} from "@pixaura/shared-types";
