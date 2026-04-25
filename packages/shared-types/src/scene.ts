import { z } from "zod";

/**
 * 场景状态
 */
export const SceneStatus = {
  DRAFT: "draft",
  ACTIVE: "active",
  ARCHIVED: "archived",
} as const;

export type SceneStatus = (typeof SceneStatus)[keyof typeof SceneStatus];

/**
 * 场景类型
 */
export const SceneType = {
  INTERIOR: "interior",
  EXTERIOR: "exterior",
  BOTH: "both",
} as const;

export type SceneType = (typeof SceneType)[keyof typeof SceneType];

/**
 * 场景图片类型
 */
export const SceneImageType = {
  PANORAMA: "panorama",
  WIDE_SHOT: "wide_shot",
  DETAIL: "detail",
  VARIANT: "variant",
  ADDITIONAL: "additional",
} as const;

export type SceneImageType =
  (typeof SceneImageType)[keyof typeof SceneImageType];

/**
 * 变体类型
 */
export const VariantType = {
  TIME_OF_DAY: "time_of_day",
  WEATHER: "weather",
} as const;

export type VariantType = (typeof VariantType)[keyof typeof VariantType];

/**
 * 空间大小
 */
export const SpaceSize = {
  SMALL: "small",
  MEDIUM: "medium",
  LARGE: "large",
  HUGE: "huge",
} as const;

export type SpaceSize = (typeof SpaceSize)[keyof typeof SpaceSize];

/**
 * 光源类型
 */
export const LightingType = {
  NATURAL: "natural",
  ARTIFICIAL: "artificial",
  MIXED: "mixed",
} as const;

export type LightingType = (typeof LightingType)[keyof typeof LightingType];

/**
 * 光线氛围
 */
export const LightingMood = {
  BRIGHT: "bright",
  DIM: "dim",
  DRAMATIC: "dramatic",
  SOFT: "soft",
} as const;

export type LightingMood = (typeof LightingMood)[keyof typeof LightingMood];

/**
 * 时间段
 */
export const TimeOfDay = {
  DAWN: "dawn",
  MORNING: "morning",
  NOON: "noon",
  AFTERNOON: "afternoon",
  DUSK: "dusk",
  NIGHT: "night",
} as const;

export type TimeOfDay = (typeof TimeOfDay)[keyof typeof TimeOfDay];

/**
 * 天气
 */
export const Weather = {
  SUNNY: "sunny",
  CLOUDY: "cloudy",
  RAINY: "rainy",
  SNOWY: "snowy",
  FOGGY: "foggy",
  STORMY: "stormy",
} as const;

export type Weather = (typeof Weather)[keyof typeof Weather];

// ==================== JSONB 子结构 ====================

/**
 * 空间属性
 */
export const SceneSpaceSchema = z.object({
  size: z
    .enum([SpaceSize.SMALL, SpaceSize.MEDIUM, SpaceSize.LARGE, SpaceSize.HUGE])
    .optional()
    .describe("空间大小"),
  layout: z.string().optional().describe("布局描述"),
  keyAreas: z.array(z.string()).optional().describe("关键区域"),
});

export type SceneSpace = z.infer<typeof SceneSpaceSchema>;

/**
 * 视觉属性
 */
export const SceneVisualsSchema = z.object({
  primaryColor: z.string().optional().describe("主色调"),
  lighting: z
    .enum([LightingType.NATURAL, LightingType.ARTIFICIAL, LightingType.MIXED])
    .optional()
    .describe("光源类型"),
  lightingMood: z
    .enum([
      LightingMood.BRIGHT,
      LightingMood.DIM,
      LightingMood.DRAMATIC,
      LightingMood.SOFT,
    ])
    .optional()
    .describe("光线氛围"),
});

export type SceneVisuals = z.infer<typeof SceneVisualsSchema>;

/**
 * 氛围属性
 */
export const SceneAtmosphereSchema = z.object({
  timeOfDay: z
    .enum([
      TimeOfDay.DAWN,
      TimeOfDay.MORNING,
      TimeOfDay.NOON,
      TimeOfDay.AFTERNOON,
      TimeOfDay.DUSK,
      TimeOfDay.NIGHT,
    ])
    .optional()
    .describe("时间"),
  weather: z
    .enum([
      Weather.SUNNY,
      Weather.CLOUDY,
      Weather.RAINY,
      Weather.SNOWY,
      Weather.FOGGY,
      Weather.STORMY,
    ])
    .optional()
    .describe("天气"),
  mood: z.string().optional().describe("氛围描述"),
});

export type SceneAtmosphere = z.infer<typeof SceneAtmosphereSchema>;

/**
 * 剧本关联信息
 */
export const SceneScriptRefSchema = z.object({
  scriptId: z.string().describe("来源剧本ID"),
  extractedAt: z.string().datetime().describe("提取时间"),
});

export type SceneScriptRef = z.infer<typeof SceneScriptRefSchema>;

/**
 * 跨项目导入信息
 */
export const SceneImportInfoSchema = z.object({
  sourceProjectId: z.string().describe("源项目ID"),
  sourceSceneId: z.string().describe("源场景ID"),
  importedAt: z.string().datetime().describe("导入时间"),
});

export type SceneImportInfo = z.infer<typeof SceneImportInfoSchema>;

/**
 * 生成信息
 */
export const SceneGenerationInfoSchema = z.object({
  generationId: z.string().describe("生成任务ID"),
  prompt: z.string().describe("使用的提示词"),
  negativePrompt: z.string().optional().describe("负面提示词"),
  modelId: z.string().describe("使用的模型ID"),
  seed: z.number().optional().describe("随机种子"),
  createdAt: z.string().datetime().describe("生成时间"),
});

export type SceneGenerationInfo = z.infer<typeof SceneGenerationInfoSchema>;

/**
 * 上传信息
 */
export const SceneUploadInfoSchema = z.object({
  originalFilename: z.string().describe("原始文件名"),
  fileSize: z.number().describe("文件大小（字节）"),
  mimeType: z.string().describe("MIME类型"),
  uploadedAt: z.string().datetime().describe("上传时间"),
});

export type SceneUploadInfo = z.infer<typeof SceneUploadInfoSchema>;

// ==================== 请求 DTOs ====================

/**
 * 创建场景 DTO
 */
export const CreateSceneSchema = z.object({
  name: z.string().min(1).max(100).describe("场景名称"),
  description: z.string().max(500).optional().describe("场景描述"),
  type: z
    .enum([SceneType.INTERIOR, SceneType.EXTERIOR, SceneType.BOTH])
    .default(SceneType.INTERIOR)
    .describe("场景类型"),
  space: SceneSpaceSchema.optional().describe("空间属性"),
  visuals: SceneVisualsSchema.optional().describe("视觉属性"),
  atmosphere: SceneAtmosphereSchema.optional().describe("氛围属性"),
});

export type CreateSceneDto = z.infer<typeof CreateSceneSchema>;

/**
 * 更新场景 DTO
 */
export const UpdateSceneSchema = z
  .object({
    name: z.string().min(1).max(100).optional().describe("场景名称"),
    description: z.string().max(500).optional().describe("场景描述"),
    type: z
      .enum([SceneType.INTERIOR, SceneType.EXTERIOR, SceneType.BOTH])
      .optional()
      .describe("场景类型"),
    space: SceneSpaceSchema.optional().describe("空间属性"),
    visuals: SceneVisualsSchema.optional().describe("视觉属性"),
    atmosphere: SceneAtmosphereSchema.optional().describe("氛围属性"),
    status: z
      .enum([SceneStatus.DRAFT, SceneStatus.ACTIVE, SceneStatus.ARCHIVED])
      .optional()
      .describe("状态"),
  })
  .strict();

export type UpdateSceneDto = z.infer<typeof UpdateSceneSchema>;

/**
 * 查询场景列表参数
 */
export const QueryScenesSchema = z.object({
  status: z
    .enum([SceneStatus.DRAFT, SceneStatus.ACTIVE, SceneStatus.ARCHIVED])
    .optional()
    .describe("状态筛选"),
  type: z
    .enum([SceneType.INTERIOR, SceneType.EXTERIOR, SceneType.BOTH])
    .optional()
    .describe("类型筛选"),
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

export type QueryScenesDto = z.infer<typeof QueryScenesSchema>;

/**
 * 批量创建场景（从剧本）DTO
 */
export const BatchCreateSceneItemSchema = z.object({
  name: z.string().describe("场景名称"),
  description: z.string().optional().describe("场景描述"),
  type: z.string().optional().describe("场景类型"),
});

export const BatchCreateScenesSchema = z.object({
  scriptId: z.string().describe("剧本ID"),
  scenes: z.array(BatchCreateSceneItemSchema).min(1).describe("场景列表"),
});

export type BatchCreateScenesDto = z.infer<typeof BatchCreateScenesSchema>;

/**
 * 生成图片 DTO
 * type 字段可选，默认生成全景图
 */
export const GenerateSceneImageSchema = z.object({
  type: z
    .enum([
      SceneImageType.PANORAMA,
      SceneImageType.WIDE_SHOT,
      SceneImageType.VARIANT,
    ])
    .optional()
    .default(SceneImageType.PANORAMA)
    .describe("生成类型，默认全景图"),
  variantType: z
    .enum([VariantType.TIME_OF_DAY, VariantType.WEATHER])
    .optional()
    .describe("变体类型"),
  variantValue: z.string().optional().describe("变体值"),
  modelId: z.string().optional().describe("指定模型"),
  customPrompt: z.string().optional().describe("自定义提示词补充"),
  referenceImages: z
    .array(z.string())
    .optional()
    .describe("参考图 URL 列表（最多 3 张）"),
});

export type GenerateSceneImageDto = z.infer<typeof GenerateSceneImageSchema>;

/**
 * 上传图片 DTO
 */
export const UploadSceneImageSchema = z.object({
  type: z
    .enum([
      SceneImageType.PANORAMA,
      SceneImageType.WIDE_SHOT,
      SceneImageType.DETAIL,
      SceneImageType.VARIANT,
      SceneImageType.ADDITIONAL,
    ])
    .describe("图片类型"),
  variantType: z
    .enum([VariantType.TIME_OF_DAY, VariantType.WEATHER])
    .optional()
    .describe("变体类型"),
  variantValue: z.string().optional().describe("变体值"),
});

export type UploadSceneImageDto = z.infer<typeof UploadSceneImageSchema>;

/**
 * 跨项目导入场景 DTO
 */
export const ImportScenesSchema = z.object({
  sourceProjectId: z.string().describe("源项目ID"),
  sourceSceneIds: z.array(z.string()).min(1).describe("源场景ID列表"),
});

export type ImportScenesDto = z.infer<typeof ImportScenesSchema>;

// ==================== Response DTOs ====================

/**
 * 场景图片响应
 */
export interface SceneImageDto {
  id: string;
  type: SceneImageType;
  variantType: VariantType | null;
  variantValue: string | null;
  url: string;
  thumbnailUrl: string | null;
  generation: SceneGenerationInfo | null;
  uploadInfo: SceneUploadInfo | null;
  version: number;
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * 场景列表项响应
 */
export interface SceneListItemDto {
  id: string;
  name: string;
  description: string | null;
  type: SceneType;
  status: SceneStatus;
  images: {
    panorama?: { thumbnailUrl: string };
    wideShot?: { thumbnailUrl: string };
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
 * 场景详情响应
 */
export interface SceneDetailDto {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  type: SceneType;
  space: SceneSpace | null;
  visuals: SceneVisuals | null;
  atmosphere: SceneAtmosphere | null;
  status: SceneStatus;
  images: {
    panorama?: SceneImageDto;
    wideShot?: SceneImageDto;
    detailShots: SceneImageDto[];
    variants: {
      timeOfDay?: Record<string, SceneImageDto>;
      weather?: Record<string, SceneImageDto>;
    };
    additional: SceneImageDto[];
  };
  scriptRef: SceneScriptRef | null;
  importInfo: SceneImportInfo | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

/**
 * 批量创建结果
 */
export interface BatchCreateScenesResultDto {
  created: number;
  scenes: Array<{
    id: string;
    name: string;
    status: SceneStatus;
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
export interface GenerateSceneImageTaskDto {
  generationTaskId: string;
  status: "pending" | "processing";
  type: string;
  estimatedTime: number;
}

/**
 * 跨项目导入结果
 */
export interface ImportScenesResultDto {
  imported: number;
  scenes: Array<{
    id: string;
    name: string;
    sourceSceneId: string;
    importedAt: string;
  }>;
  errors?: Array<{
    sourceSceneId: string;
    error: string;
    errorCode: number;
  }>;
}

/**
 * 可导入场景列表项
 */
export interface ImportableSceneDto {
  id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  sourceProjectId: string;
  sourceProjectName: string;
}

// ==================== 类型别名 ====================

/**
 * 场景资产库通用类型别名（前端列表页使用）
 */
export type SceneDto = SceneListItemDto;

// ==================== WebSocket 类型 ====================

/**
 * 图片生成进度（WebSocket）
 */
export interface SceneImageGenerationProgressDto {
  type: "scene_generation_progress";
  data: {
    sceneId: string;
    generationTaskId: string;
    imageType: SceneImageType;
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

// ==================== 前端状态类型 ====================

/**
 * 场景状态（Pinia）
 */
export interface SceneState {
  scenes: SceneListItemDto[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  loading: boolean;
  currentScene: SceneDetailDto | null;
  generatingImages: boolean;
  generationProgress: number;
}
