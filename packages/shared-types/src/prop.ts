import { z } from "zod";

/**
 * 道具状态
 */
export const PropStatus = {
  DRAFT: "draft",
  ACTIVE: "active",
  ARCHIVED: "archived",
} as const;

export type PropStatus = (typeof PropStatus)[keyof typeof PropStatus];

/**
 * 道具重要性
 */
export const PropImportance = {
  KEY: "key",
  SECONDARY: "secondary",
  BACKGROUND: "background",
} as const;

export type PropImportance =
  (typeof PropImportance)[keyof typeof PropImportance];

/**
 * 道具图片类型
 */
export const PropImageType = {
  FRONT_VIEW: "front_view",
  SIDE_VIEW: "side_view",
  TOP_VIEW: "top_view",
  ADDITIONAL: "additional",
} as const;

export type PropImageType = (typeof PropImageType)[keyof typeof PropImageType];

/**
 * 道具大小
 */
export const PropSize = {
  TINY: "tiny",
  SMALL: "small",
  MEDIUM: "medium",
  LARGE: "large",
  HUGE: "huge",
} as const;

export type PropSize = (typeof PropSize)[keyof typeof PropSize];

/**
 * 道具新旧程度
 */
export const PropCondition = {
  NEW: "new",
  WORN: "worn",
  DAMAGED: "damaged",
  ANCIENT: "ancient",
} as const;

export type PropCondition = (typeof PropCondition)[keyof typeof PropCondition];

// ==================== JSONB 子结构 ====================

/**
 * 外观属性
 */
export const PropAppearanceSchema = z.object({
  color: z.string().optional().describe("主要颜色"),
  material: z.string().optional().describe("材质"),
  size: z
    .enum([
      PropSize.TINY,
      PropSize.SMALL,
      PropSize.MEDIUM,
      PropSize.LARGE,
      PropSize.HUGE,
    ])
    .optional()
    .describe("大小"),
  condition: z
    .enum([
      PropCondition.NEW,
      PropCondition.WORN,
      PropCondition.DAMAGED,
      PropCondition.ANCIENT,
    ])
    .optional()
    .describe("新旧程度"),
  distinctiveFeatures: z.array(z.string()).optional().describe("显著特征"),
});

export type PropAppearance = z.infer<typeof PropAppearanceSchema>;

/**
 * 剧本关联信息
 */
export const PropScriptRefSchema = z.object({
  scriptId: z.string().describe("来源剧本ID"),
  extractedAt: z.string().datetime().describe("提取时间"),
  sceneIds: z.array(z.string()).describe("出现的场次列表"),
});

export type PropScriptRef = z.infer<typeof PropScriptRefSchema>;

/**
 * 跨项目导入信息
 */
export const PropImportInfoSchema = z.object({
  sourceProjectId: z.string().describe("源项目ID"),
  sourcePropId: z.string().describe("源道具ID"),
  importedAt: z.string().datetime().describe("导入时间"),
});

export type PropImportInfo = z.infer<typeof PropImportInfoSchema>;

/**
 * 生成信息
 */
export const PropGenerationInfoSchema = z.object({
  generationId: z.string().describe("生成任务ID"),
  prompt: z.string().describe("使用的提示词"),
  negativePrompt: z.string().optional().describe("负面提示词"),
  modelId: z.string().describe("使用的模型ID"),
  seed: z.number().optional().describe("随机种子"),
  createdAt: z.string().datetime().describe("生成时间"),
});

export type PropGenerationInfo = z.infer<typeof PropGenerationInfoSchema>;

/**
 * 上传信息
 */
export const PropUploadInfoSchema = z.object({
  originalFilename: z.string().describe("原始文件名"),
  fileSize: z.number().describe("文件大小（字节）"),
  mimeType: z.string().describe("MIME类型"),
  uploadedAt: z.string().datetime().describe("上传时间"),
});

export type PropUploadInfo = z.infer<typeof PropUploadInfoSchema>;

// ==================== 请求 DTOs ====================

/**
 * 创建道具 DTO
 */
export const CreatePropSchema = z.object({
  name: z.string().min(1).max(100).describe("道具名称"),
  description: z.string().max(500).optional().describe("道具描述"),
  appearance: PropAppearanceSchema.optional().describe("外观属性"),
  function: z.string().max(200).optional().describe("道具功能/用途"),
  importance: z
    .enum([
      PropImportance.KEY,
      PropImportance.SECONDARY,
      PropImportance.BACKGROUND,
    ])
    .default(PropImportance.BACKGROUND)
    .describe("重要性"),
});

export type CreatePropDto = z.infer<typeof CreatePropSchema>;

/**
 * 更新道具 DTO
 */
export const UpdatePropSchema = z
  .object({
    name: z.string().min(1).max(100).optional().describe("道具名称"),
    description: z.string().max(500).optional().describe("道具描述"),
    appearance: PropAppearanceSchema.optional().describe("外观属性"),
    function: z.string().max(200).optional().describe("道具功能/用途"),
    importance: z
      .enum([
        PropImportance.KEY,
        PropImportance.SECONDARY,
        PropImportance.BACKGROUND,
      ])
      .optional()
      .describe("重要性"),
    status: z
      .enum([PropStatus.DRAFT, PropStatus.ACTIVE, PropStatus.ARCHIVED])
      .optional()
      .describe("状态"),
  })
  .strict();

export type UpdatePropDto = z.infer<typeof UpdatePropSchema>;

/**
 * 查询道具列表参数
 */
export const QueryPropsSchema = z.object({
  status: z
    .enum([PropStatus.DRAFT, PropStatus.ACTIVE, PropStatus.ARCHIVED])
    .optional()
    .describe("状态筛选"),
  importance: z
    .enum([
      PropImportance.KEY,
      PropImportance.SECONDARY,
      PropImportance.BACKGROUND,
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

export type QueryPropsDto = z.infer<typeof QueryPropsSchema>;

/**
 * 批量创建道具（从剧本）DTO
 */
export const BatchCreatePropItemSchema = z.object({
  name: z.string().describe("道具名称"),
  description: z.string().optional().describe("道具描述"),
  importance: z.string().optional().describe("重要性"),
});

export const BatchCreatePropsSchema = z.object({
  scriptId: z.string().describe("剧本ID"),
  props: z.array(BatchCreatePropItemSchema).min(1).describe("道具列表"),
});

export type BatchCreatePropsDto = z.infer<typeof BatchCreatePropsSchema>;

/**
 * 生成图片 DTO
 */
export const GeneratePropImageSchema = z.object({
  type: z
    .enum([
      PropImageType.FRONT_VIEW,
      PropImageType.SIDE_VIEW,
      PropImageType.TOP_VIEW,
    ])
    .describe("生成类型"),
  modelId: z.string().optional().describe("指定模型"),
  customPrompt: z.string().optional().describe("自定义提示词补充"),
  referenceImages: z
    .array(z.string())
    .optional()
    .describe("参考图 URL 列表（最多 3 张）"),
});

export type GeneratePropImageDto = z.infer<typeof GeneratePropImageSchema>;

/**
 * 上传图片 DTO
 */
export const UploadPropImageSchema = z.object({
  type: z
    .enum([
      PropImageType.FRONT_VIEW,
      PropImageType.SIDE_VIEW,
      PropImageType.TOP_VIEW,
      PropImageType.ADDITIONAL,
    ])
    .describe("图片类型"),
});

export type UploadPropImageDto = z.infer<typeof UploadPropImageSchema>;

/**
 * 跨项目导入道具 DTO
 */
export const ImportPropsSchema = z.object({
  sourceProjectId: z.string().describe("源项目ID"),
  sourcePropIds: z.array(z.string()).min(1).describe("源道具ID列表"),
});

export type ImportPropsDto = z.infer<typeof ImportPropsSchema>;

// ==================== Response DTOs ====================

/**
 * 道具图片响应
 */
export interface PropImageDto {
  id: string;
  type: PropImageType;
  url: string;
  thumbnailUrl: string | null;
  generation: PropGenerationInfo | null;
  uploadInfo: PropUploadInfo | null;
  version: number;
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
  metadata?: {
    seed?: number;
    style?: string;
    background?: string;
    [key: string]: unknown;
  };
}

/**
 * 道具列表项响应
 */
export interface PropListItemDto {
  id: string;
  name: string;
  description: string | null;
  importance: PropImportance;
  status: PropStatus;
  images: {
    frontView?: { thumbnailUrl: string };
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
 * 道具详情响应
 */
export interface PropDetailDto {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  appearance: PropAppearance | null;
  function: string | null;
  importance: PropImportance;
  status: PropStatus;
  images: {
    frontView?: PropImageDto;
    sideView?: PropImageDto;
    topView?: PropImageDto;
    additional: PropImageDto[];
  };
  scriptRef: PropScriptRef | null;
  importInfo: PropImportInfo | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

/**
 * 批量创建结果
 */
export interface BatchCreatePropsResultDto {
  created: number;
  props: Array<{
    id: string;
    name: string;
    status: PropStatus;
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
export interface GeneratePropImageTaskDto {
  generationTaskId: string;
  status: "pending" | "processing";
  type: string;
  estimatedTime: number;
}

/**
 * 跨项目导入结果
 */
export interface ImportPropsResultDto {
  imported: number;
  props: Array<{
    id: string;
    name: string;
    sourcePropId: string;
    importedAt: string;
  }>;
  errors?: Array<{
    sourcePropId: string;
    error: string;
    errorCode: number;
  }>;
}

/**
 * 可导入道具列表项
 */
export interface ImportablePropDto {
  id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  sourceProjectId: string;
  sourceProjectName: string;
}

// ==================== 类型别名 ====================

/**
 * 道具资产库通用类型别名（前端列表页使用）
 */
export type PropDto = PropListItemDto;

// ==================== WebSocket 类型 ====================

/**
 * 图片生成进度（WebSocket）
 */
export interface PropImageGenerationProgressDto {
  type: "prop_generation_progress";
  data: {
    propId: string;
    generationTaskId: string;
    imageType: PropImageType;
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
 * 道具状态（Pinia）
 */
export interface PropState {
  props: PropListItemDto[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  loading: boolean;
  currentProp: PropDetailDto | null;
  generatingImages: boolean;
  generationProgress: number;
}
