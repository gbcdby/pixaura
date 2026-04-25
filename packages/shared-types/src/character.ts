import { z } from "zod";
// 从 script.ts 导入复用的类型
import {
  CharacterImportance,
  CharacterImportance as CharacterImportanceEnum,
} from "./script";

export { CharacterImportance } from "./script";

/**
 * 角色状态
 */
export const CharacterStatus = {
  DRAFT: "draft",
  ACTIVE: "active",
  ARCHIVED: "archived",
} as const;

export type CharacterStatus =
  (typeof CharacterStatus)[keyof typeof CharacterStatus];

/**
 * 角色性别
 */
export const CharacterGender = {
  MALE: "male",
  FEMALE: "female",
  OTHER: "other",
  UNKNOWN: "unknown",
} as const;

export type CharacterGender =
  (typeof CharacterGender)[keyof typeof CharacterGender];

/**
 * 图片类型
 */
export const CharacterImageType = {
  FRONT_VIEW: "front_view",
  SIDE_VIEW: "side_view",
  BACK_VIEW: "back_view",
  ANGLE_VIEW: "angle_view",
  ADDITIONAL: "additional",
} as const;

export type CharacterImageType =
  (typeof CharacterImageType)[keyof typeof CharacterImageType];

// ==================== JSONB 子结构 ====================

/**
 * 外观细节
 */
export const CharacterAppearanceSchema = z.object({
  height: z.string().optional().describe("身高"),
  bodyType: z.string().optional().describe("体型"),
  hairColor: z.string().optional().describe("发色"),
  hairStyle: z.string().optional().describe("发型"),
  eyeColor: z.string().optional().describe("眼色"),
  skinTone: z.string().optional().describe("肤色"),
  clothingStyle: z.string().optional().describe("着装风格"),
  distinctiveFeatures: z.array(z.string()).optional().describe("显著特征"),
});

export type CharacterAppearance = z.infer<typeof CharacterAppearanceSchema>;

/**
 * 剧本关联信息
 */
export const ScriptRefSchema = z.object({
  scriptId: z.string().describe("来源剧本ID"),
  extractedAt: z.string().datetime().describe("提取时间"),
  importance: z
    .enum([
      CharacterImportance.PROTAGONIST,
      CharacterImportance.SUPPORTING,
      CharacterImportance.MINOR,
    ])
    .describe("重要性"),
});

export type ScriptRef = z.infer<typeof ScriptRefSchema>;

/**
 * 跨项目导入信息（角色专用）
 */
export const CharacterImportInfoSchema = z.object({
  sourceProjectId: z.string().describe("源项目ID"),
  sourceCharacterId: z.string().describe("源角色ID"),
  importedAt: z.string().datetime().describe("导入时间"),
});

export type CharacterImportInfo = z.infer<typeof CharacterImportInfoSchema>;

/**
 * 生成信息
 */
export const GenerationInfoSchema = z.object({
  generationId: z.string().describe("生成任务ID"),
  prompt: z.string().describe("使用的提示词"),
  negativePrompt: z.string().optional().describe("负面提示词"),
  modelId: z.string().describe("使用的模型ID"),
  seed: z.number().optional().describe("随机种子"),
  createdAt: z.string().datetime().describe("生成时间"),
});

export type GenerationInfo = z.infer<typeof GenerationInfoSchema>;

/**
 * 上传信息
 */
export const UploadInfoSchema = z.object({
  originalFilename: z.string().describe("原始文件名"),
  fileSize: z.number().describe("文件大小（字节）"),
  mimeType: z.string().describe("MIME类型"),
  uploadedAt: z.string().datetime().describe("上传时间"),
});

export type UploadInfo = z.infer<typeof UploadInfoSchema>;

// ==================== 请求 DTOs ====================

/**
 * 创建角色 DTO
 */
export const CreateCharacterSchema = z.object({
  name: z.string().min(1).max(100).describe("角色名称"),
  description: z.string().max(500).optional().describe("角色描述"),
  personality: z.string().max(200).optional().describe("性格特征"),
  age: z.string().max(20).optional().describe("年龄描述"),
  gender: z
    .enum([
      CharacterGender.MALE,
      CharacterGender.FEMALE,
      CharacterGender.OTHER,
      CharacterGender.UNKNOWN,
    ])
    .optional()
    .describe("性别"),
  occupation: z.string().max(50).optional().describe("职业"),
  background: z.string().optional().describe("背景故事"),
  appearance: CharacterAppearanceSchema.optional().describe("外观细节"),
  importance: z
    .enum([
      CharacterImportance.PROTAGONIST,
      CharacterImportance.SUPPORTING,
      CharacterImportance.MINOR,
    ])
    .default(CharacterImportance.MINOR)
    .describe("重要性"),
});

export type CreateCharacterDto = z.infer<typeof CreateCharacterSchema>;

/**
 * 更新角色 DTO
 */
export const UpdateCharacterSchema = z
  .object({
    name: z.string().min(1).max(100).optional().describe("角色名称"),
    description: z.string().max(500).optional().describe("角色描述"),
    personality: z.string().max(200).optional().describe("性格特征"),
    age: z.string().max(20).optional().describe("年龄描述"),
    gender: z
      .enum([
        CharacterGender.MALE,
        CharacterGender.FEMALE,
        CharacterGender.OTHER,
        CharacterGender.UNKNOWN,
      ])
      .optional()
      .describe("性别"),
    occupation: z.string().max(50).optional().describe("职业"),
    background: z.string().optional().describe("背景故事"),
    appearance: CharacterAppearanceSchema.optional().describe("外观细节"),
    importance: z
      .enum([
        CharacterImportance.PROTAGONIST,
        CharacterImportance.SUPPORTING,
        CharacterImportance.MINOR,
      ])
      .optional()
      .describe("重要性"),
    status: z
      .enum([
        CharacterStatus.DRAFT,
        CharacterStatus.ACTIVE,
        CharacterStatus.ARCHIVED,
      ])
      .optional()
      .describe("状态"),
  })
  .strict();

export type UpdateCharacterDto = z.infer<typeof UpdateCharacterSchema>;

/**
 * 查询角色列表参数
 */
export const QueryCharactersSchema = z.object({
  status: z
    .enum([
      CharacterStatus.DRAFT,
      CharacterStatus.ACTIVE,
      CharacterStatus.ARCHIVED,
    ])
    .optional()
    .describe("状态筛选"),
  importance: z
    .enum([
      CharacterImportance.PROTAGONIST,
      CharacterImportance.SUPPORTING,
      CharacterImportance.MINOR,
    ])
    .optional()
    .describe("重要性筛选"),
  search: z.string().optional().describe("关键词搜索"),
  page: z.coerce.number().int().positive().default(1).describe("页码"),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(50)
    .default(20)
    .describe("每页数量"),
  sortBy: z
    .enum(["createdAt", "updatedAt", "name"])
    .default("createdAt")
    .describe("排序字段"),
  sortOrder: z.enum(["asc", "desc"]).default("desc").describe("排序方向"),
});

export type QueryCharactersDto = z.infer<typeof QueryCharactersSchema>;

/**
 * 批量创建角色（从剧本）DTO
 */
export const BatchCreateCharacterItemSchema = z.object({
  name: z.string().describe("角色名称"),
  description: z.string().optional().describe("角色描述"),
  importance: z
    .enum([
      CharacterImportance.PROTAGONIST,
      CharacterImportance.SUPPORTING,
      CharacterImportance.MINOR,
    ])
    .optional()
    .describe("重要性"),
  personality: z.string().optional().describe("性格"),
  age: z.string().optional().describe("年龄"),
  gender: z.string().optional().describe("性别"),
});

export const BatchCreateCharactersSchema = z.object({
  scriptId: z.string().describe("剧本ID"),
  characters: z
    .array(BatchCreateCharacterItemSchema)
    .min(1)
    .describe("角色列表"),
});

export type BatchCreateCharactersDto = z.infer<
  typeof BatchCreateCharactersSchema
>;

/**
 * 生成图片 DTO
 */
export const GenerateImageSchema = z.object({
  type: z
    .enum([
      CharacterImageType.FRONT_VIEW,
      CharacterImageType.SIDE_VIEW,
      CharacterImageType.BACK_VIEW,
      CharacterImageType.ANGLE_VIEW,
    ])
    .or(z.literal("all"))
    .describe("生成类型"),
  modelId: z.string().optional().describe("指定模型"),
  customPrompt: z.string().optional().describe("自定义提示词补充"),
  useAppearance: z
    .boolean()
    .default(true)
    .describe("是否使用 appearance 字段生成提示词"),
  referenceImages: z
    .array(z.string())
    .optional()
    .describe("参考图 URL 列表（最多 3 张）"),
});

export type GenerateImageDto = z.infer<typeof GenerateImageSchema>;

/**
 * 上传图片 DTO
 */
export const UploadImageSchema = z.object({
  type: z
    .enum([
      CharacterImageType.FRONT_VIEW,
      CharacterImageType.SIDE_VIEW,
      CharacterImageType.BACK_VIEW,
      CharacterImageType.ANGLE_VIEW,
      CharacterImageType.ADDITIONAL,
    ])
    .describe("图片类型"),
});

export type UploadImageDto = z.infer<typeof UploadImageSchema>;

/**
 * 跨项目导入角色 DTO
 */
export const ImportCharactersSchema = z.object({
  sourceProjectId: z.string().describe("源项目ID"),
  sourceCharacterIds: z.array(z.string()).min(1).describe("源角色ID列表"),
});

export type ImportCharactersDto = z.infer<typeof ImportCharactersSchema>;

// ==================== Response DTOs ====================

/**
 * 角色图片响应
 */
export interface CharacterImageDto {
  id: string;
  type: CharacterImageType;
  url: string;
  thumbnailUrl: string | null;
  generation: GenerationInfo | null;
  uploadInfo: UploadInfo | null;
  version: number;
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
  metadata?: {
    seed?: number;
    style?: string;
    [key: string]: unknown;
  };
}

/**
 * 角色列表项响应
 */
export interface CharacterListItemDto {
  id: string;
  name: string;
  description: string | null;
  gender: CharacterGender | null;
  age: string | null;
  importance: CharacterImportance;
  status: CharacterStatus;
  images: {
    frontView?: { url?: string; thumbnailUrl?: string | null };
    sideView?: { url?: string; thumbnailUrl?: string | null };
    backView?: { url?: string; thumbnailUrl?: string | null };
    angleView?: { url?: string; thumbnailUrl?: string | null };
    referenceImages?: Array<{ url?: string; thumbnailUrl?: string | null; id?: string }>;
  };
  createdAt: string;
  updatedAt: string;
  /** 是否来自剧本关联（非资产表独立记录），仅当 includeScriptAssets=true 时有意义 */
  isScriptLinked?: boolean;
  /** 来源剧本ID（仅 isScriptLinked=true 时存在） */
  sourceScriptId?: string;
  /** 资产状态（仅 isScriptLinked=true 时存在） */
  assetStatus?: string;
}

/**
 * 角色详情响应
 */
export interface CharacterDetailDto {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  personality: string | null;
  age: string | null;
  gender: CharacterGender | null;
  occupation: string | null;
  background: string | null;
  appearance: CharacterAppearance | null;
  importance: CharacterImportance;
  status: CharacterStatus;
  images: {
    frontView?: CharacterImageDto;
    sideView?: CharacterImageDto;
    backView?: CharacterImageDto;
    angleView?: CharacterImageDto;
    additional: CharacterImageDto[];
  };
  scriptRef: ScriptRef | null;
  importInfo: CharacterImportInfo | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

/**
 * 批量创建结果
 */
export interface BatchCreateCharactersResultDto {
  created: number;
  characters: Array<{
    id: string;
    name: string;
    status: CharacterStatus;
    createdAt: string;
  }>;
  errors?: Array<{
    name: string;
    error: string;
    errorCode: number;
  }>;
}

/**
 * 生成图片任务响应
 */
export interface GenerateImageTaskDto {
  generationTaskId: string;
  status: "pending" | "processing";
  type: string;
  estimatedTime: number;
}

/**
 * 图片版本历史项
 */
export interface ImageVersionDto {
  id: string;
  url: string;
  thumbnailUrl: string;
  version: number;
  isCurrent: boolean;
  generation?: {
    prompt: string;
    modelId: string;
    createdAt: string;
  };
  uploadInfo?: {
    originalFilename: string;
    uploadedAt: string;
  };
  createdAt: string;
}

/**
 * 图片版本历史响应
 */
export interface ImageVersionsDto {
  type: CharacterImageType;
  currentVersion: number;
  versions: ImageVersionDto[];
}

/**
 * 跨项目导入结果
 */
export interface ImportCharactersResultDto {
  imported: number;
  characters: Array<{
    id: string;
    name: string;
    sourceCharacterId: string;
    importedAt: string;
  }>;
  errors?: Array<{
    sourceCharacterId: string;
    error: string;
    errorCode: number;
  }>;
}

/**
 * 导出模板响应
 */
export interface ExportCharacterTemplateDto {
  template: {
    name: string;
    description?: string;
    personality?: string;
    age?: string;
    gender?: string;
    occupation?: string;
    background?: string;
    appearance?: CharacterAppearance;
    importance: string;
    images: {
      frontView?: string;
      sideView?: string;
      backView?: string;
      angleView?: string;
    };
  };
  exportedAt: string;
}

/**
 * 可导入角色列表项
 */
export interface ImportableCharacterDto {
  id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  sourceProjectId: string;
  sourceProjectName: string;
}

// ==================== WebSocket 类型 ====================

/**
 * 图片生成进度（WebSocket）
 */
export interface CharacterImageGenerationProgressDto {
  type: "character_generation_progress";
  data: {
    characterId: string;
    generationTaskId: string;
    imageType: CharacterImageType;
    status: "pending" | "processing" | "completed" | "failed";
    progress?: number;
    result?: {
      imageId: string;
      url: string;
      thumbnailUrl: string;
    };
    error?: string;
    updatedAt: string;
  };
}

// ==================== 类型别名 ====================

/**
 * 角色资产库通用类型别名（前端列表页使用）
 */
export type CharacterDto = CharacterListItemDto;

// ==================== 前端状态类型 ====================

/**
 * 角色状态（Pinia）
 */
export interface CharacterState {
  characters: CharacterListItemDto[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  loading: boolean;
  currentCharacter: CharacterDetailDto | null;
  generatingImages: boolean;
  generationProgress: number;
}
