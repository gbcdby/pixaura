import { z } from "zod";

// ==================== 枚举常量 ====================

/**
 * 图片生成任务状态
 */
export const ImageGenTaskStatus = {
  PENDING: "pending",
  QUEUED: "queued",
  GENERATING: "generating",
  COMPLETED: "completed",
  PARTIAL_FAILED: "partial_failed",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export type ImageGenTaskStatus =
  (typeof ImageGenTaskStatus)[keyof typeof ImageGenTaskStatus];

/**
 * 图片生成任务类型
 */
export const ImageGenTaskType = {
  TEXT_TO_IMAGE: "text_to_image",
  IMAGE_TO_IMAGE: "image_to_image",
  BATCH_GENERATION: "batch_generation",
} as const;

export type ImageGenTaskType =
  (typeof ImageGenTaskType)[keyof typeof ImageGenTaskType];

/**
 * 生成场景类型
 */
export const ImageGenSceneType = {
  CHARACTER_VIEWS: "character_views",
  SCENE_VIEWS: "scene_views",
  PROP_VIEWS: "prop_views",
  STORYBOARD_REFERENCE: "storyboard_reference",
} as const;

export type ImageGenSceneType =
  (typeof ImageGenSceneType)[keyof typeof ImageGenSceneType];

/**
 * 视图类型
 */
export const ViewType = {
  FRONT_VIEW: "front_view",
  SIDE_VIEW: "side_view",
  BACK_VIEW: "back_view",
  ANGLE_VIEW: "angle_view",
  TOP_VIEW: "top_view",
  ADDITIONAL: "additional",
} as const;

export type ViewType = (typeof ViewType)[keyof typeof ViewType];

/**
 * 图片结果状态
 */
export const ImageGenResultStatus = {
  PENDING: "pending",
  SUCCESS: "success",
  FAILED: "failed",
} as const;

export type ImageGenResultStatus =
  (typeof ImageGenResultStatus)[keyof typeof ImageGenResultStatus];

/**
 * 审核状态
 */
export const ImageModerationStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export type ImageModerationStatus =
  (typeof ImageModerationStatus)[keyof typeof ImageModerationStatus];

/**
 * 图片比例
 */
export const ImageAspectRatio = {
  R1_1: "1:1",
  R16_9: "16:9",
  R9_16: "9:16",
  R3_4: "3:4",
  R4_3: "4:3",
} as const;

export type ImageAspectRatio =
  (typeof ImageAspectRatio)[keyof typeof ImageAspectRatio];

// ==================== JSONB 子结构 ====================

/**
 * 文生图配置
 */
export const TextToImageConfigSchema = z.object({
  modelId: z.string().default("default").describe("模型ID"),
  prompt: z.string().min(1, "提示词不能为空").max(1000).describe("正向提示词"),
  negativePrompt: z.string().max(500).optional().describe("负面提示词"),
  width: z.number().min(512).max(2048).default(1024).describe("宽度"),
  height: z.number().min(512).max(2048).default(1024).describe("高度"),
  seed: z.number().optional().describe("随机种子"),
  style: z.string().optional().describe("风格预设"),
  parameters: z.record(z.unknown()).optional().describe("模型特定参数"),
});

export type TextToImageConfig = z.infer<typeof TextToImageConfigSchema>;

/**
 * 统一图像生成配置（文生图 + 可选参考图）
 */
export const UnifiedImageGenerationConfigSchema = z.object({
  modelId: z.string().default("default").describe("模型ID"),
  prompt: z.string().min(1, "提示词不能为空").max(1000).describe("正向提示词"),
  negativePrompt: z.string().max(500).optional().describe("负面提示词"),
  width: z.number().min(512).max(2048).default(1024).describe("宽度"),
  height: z.number().min(512).max(2048).default(1024).describe("高度"),
  seed: z.number().optional().describe("随机种子"),
  style: z.string().optional().describe("风格预设"),
  // 可选参考图 - 存在时使用图生图逻辑，不存在时使用文生图逻辑
  referenceImageUrl: z.string().optional().describe("参考图URL（可选）"),
  strength: z
    .number()
    .min(0)
    .max(1)
    .default(0.7)
    .describe("控制强度 (0.0-1.0)，使用参考图时生效"),
  parameters: z.record(z.unknown()).optional().describe("模型特定参数"),
});

export type UnifiedImageGenerationConfig = z.infer<
  typeof UnifiedImageGenerationConfigSchema
>;

/**
 * @deprecated 使用 UnifiedImageGenerationConfigSchema 替代
 * 图生图配置
 */
export const ImageToImageConfigSchema = UnifiedImageGenerationConfigSchema;

export type ImageToImageConfig = UnifiedImageGenerationConfig;

/**
 * 批量生成项
 */
export const BatchItemSchema = z.object({
  index: z.number().describe("序号"),
  type: z.string().describe("视图类型（front_view / side_view 等）"),
  promptSuffix: z.string().describe("提示词后缀"),
});

export type BatchItem = z.infer<typeof BatchItemSchema>;

/**
 * 批量生成配置
 */
export const BatchGenerationConfigSchema = z.object({
  modelId: z.string().default("default").describe("模型ID"),
  basePrompt: z.string().max(1000).describe("基础描述"),
  negativePrompt: z.string().max(500).optional().describe("负面提示词"),
  width: z.number().min(512).max(2048).default(1024).describe("宽度"),
  height: z.number().min(512).max(2048).default(1024).describe("高度"),
  style: z.string().optional().describe("风格预设"),
  shareSeed: z.boolean().default(true).describe("是否共享种子"),
  baseSeed: z.number().optional().describe("基础种子"),
  items: z.array(BatchItemSchema).max(4).describe("批量项（最多4个）"),
});

export type BatchGenerationConfig = z.infer<typeof BatchGenerationConfigSchema>;

/**
 * 生成配置
 */
export const ImageGenerationConfigSchema = z.object({
  modelId: z.string().describe("模型ID"),
  textConfig: TextToImageConfigSchema.optional().describe("文生图配置"),
  imageConfig: ImageToImageConfigSchema.optional().describe("图生图配置"),
  batchConfig: BatchGenerationConfigSchema.optional().describe("批量生成配置"),
});

export type ImageGenerationConfig = z.infer<typeof ImageGenerationConfigSchema>;

/**
 * 进度信息
 */
export const ImageGenProgressSchema = z.object({
  total: z.number().default(0).describe("总数量"),
  completed: z.number().default(0).describe("已完成"),
  failed: z.number().default(0).describe("失败数"),
  currentStep: z.string().default("").describe("当前步骤"),
  percentage: z.number().min(0).max(100).default(0).describe("进度百分比"),
});

export type ImageGenProgress = z.infer<typeof ImageGenProgressSchema>;

/**
 * 成本信息
 */
export const ImageGenCostSchema = z.object({
  estimatedCost: z.number().default(0).describe("预估成本"),
  actualCost: z.number().default(0).describe("实际成本"),
  currency: z.string().default("CNY").describe("货币单位"),
});

export type ImageGenCost = z.infer<typeof ImageGenCostSchema>;

/**
 * 错误信息
 */
export const ImageGenErrorSchema = z.object({
  code: z.number().describe("错误码"),
  message: z.string().describe("错误信息"),
  details: z.string().optional().describe("详细错误信息"),
});

export type ImageGenError = z.infer<typeof ImageGenErrorSchema>;

/**
 * 图片信息
 */
export const ImageInfoSchema = z.object({
  url: z.string().describe("原图URL"),
  thumbnailUrl: z.string().describe("缩略图URL"),
  width: z.number().describe("宽度"),
  height: z.number().describe("高度"),
  format: z.string().describe("格式 (png/jpg/webp)"),
  size: z.number().describe("文件大小（字节）"),
});

export type ImageInfo = z.infer<typeof ImageInfoSchema>;

/**
 * 生成参数快照
 */
export const ImageGenerationParamsSchema = z.object({
  prompt: z.string().describe("提示词"),
  negativePrompt: z.string().optional().describe("负面提示词"),
  seed: z.number().describe("种子"),
  modelId: z.string().describe("模型ID"),
  width: z.number().describe("宽度"),
  height: z.number().describe("高度"),
  referenceImageUrl: z.string().optional().describe("参考图URL"),
  strength: z.number().optional().describe("控制强度"),
});

export type ImageGenerationParams = z.infer<typeof ImageGenerationParamsSchema>;

/**
 * 审核状态
 */
export const ImageModerationSchema = z.object({
  status: z
    .enum([
      ImageModerationStatus.PENDING,
      ImageModerationStatus.APPROVED,
      ImageModerationStatus.REJECTED,
    ])
    .default(ImageModerationStatus.PENDING)
    .describe("审核状态"),
  checkedAt: z.string().datetime().optional().describe("审核时间"),
  rejectReason: z.string().optional().describe("拒绝原因"),
});

export type ImageModeration = z.infer<typeof ImageModerationSchema>;

// ==================== 请求 DTOs ====================

/**
 * 统一提交图像生成任务 DTO（文生图 + 可选图生图）
 * 当 referenceImageUrl 存在时，使用图生图逻辑
 * 当 referenceImageUrl 不存在时，使用文生图逻辑
 */
export const CreateImageGenerationTaskSchema = z.object({
  projectId: z.string().describe("项目ID"),
  sceneType: z
    .enum([
      ImageGenSceneType.CHARACTER_VIEWS,
      ImageGenSceneType.SCENE_VIEWS,
      ImageGenSceneType.PROP_VIEWS,
      ImageGenSceneType.STORYBOARD_REFERENCE,
    ])
    .describe("生成场景"),
  config: UnifiedImageGenerationConfigSchema.describe("生成配置"),
  notifyWs: z.boolean().default(true).describe("是否通过 WebSocket 通知进度"),
});

export type CreateImageGenerationTaskDto = z.infer<
  typeof CreateImageGenerationTaskSchema
>;

/**
 * @deprecated 使用 CreateImageGenerationTaskSchema 替代
 * 提交文生图任务 DTO
 */
export const CreateTextToImageTaskSchema = CreateImageGenerationTaskSchema;

export type CreateTextToImageTaskDto = CreateImageGenerationTaskDto;

/**
 * @deprecated 使用 CreateImageGenerationTaskSchema 替代
 * 提交图生图任务 DTO
 */
export const CreateImageToImageTaskSchema = CreateImageGenerationTaskSchema;

export type CreateImageToImageTaskDto = CreateImageGenerationTaskDto;

/**
 * 提交批量生成任务 DTO
 */
export const CreateBatchImageGenSchema = z.object({
  projectId: z.string().describe("项目ID"),
  sceneType: z
    .enum([
      ImageGenSceneType.CHARACTER_VIEWS,
      ImageGenSceneType.SCENE_VIEWS,
      ImageGenSceneType.PROP_VIEWS,
    ])
    .describe("生成场景"),
  config: BatchGenerationConfigSchema.describe("批量生成配置"),
  notifyWs: z.boolean().default(true).describe("是否通过 WebSocket 通知进度"),
});

export type CreateBatchImageGenDto = z.infer<typeof CreateBatchImageGenSchema>;

/**
 * 重新生成单张 DTO
 */
export const RegenerateImageSchema = z.object({
  overrideConfig: z
    .object({
      prompt: z.string().max(1000).optional().describe("提示词"),
      negativePrompt: z.string().max(500).optional().describe("负面提示词"),
      seed: z.number().optional().describe("随机种子"),
      strength: z.number().min(0).max(1).optional().describe("控制强度"),
    })
    .optional()
    .describe("覆盖配置"),
});

export type RegenerateImageDto = z.infer<typeof RegenerateImageSchema>;

/**
 * 内部接口 - 生成角色四视图 DTO
 */
export const InternalCreateCharacterViewsSchema = z.object({
  projectId: z.string().describe("项目ID"),
  characterId: z.string().describe("角色ID"),
  characterDescription: z.string().describe("角色描述"),
  generationConfig: z
    .object({
      modelId: z.string().optional().describe("模型ID"),
      style: z.string().optional().describe("风格"),
      seed: z.number().optional().describe("种子"),
    })
    .optional()
    .describe("生成配置"),
  callbackUrl: z.string().optional().describe("完成回调地址"),
});

export type InternalCreateCharacterViewsDto = z.infer<
  typeof InternalCreateCharacterViewsSchema
>;

/**
 * 内部接口 - 生成场景参考图 DTO
 */
export const InternalCreateSceneViewsSchema = z.object({
  projectId: z.string().describe("项目ID"),
  sceneId: z.string().describe("场景ID"),
  sceneDescription: z.string().describe("场景描述"),
  variants: z
    .array(z.enum(["day", "night", "rain"]))
    .optional()
    .describe("需要生成的变体"),
  generationConfig: z
    .object({
      modelId: z.string().optional().describe("模型ID"),
      style: z.string().optional().describe("风格"),
      seed: z.number().optional().describe("种子"),
    })
    .optional()
    .describe("生成配置"),
  callbackUrl: z.string().optional().describe("完成回调地址"),
});

export type InternalCreateSceneViewsDto = z.infer<
  typeof InternalCreateSceneViewsSchema
>;

/**
 * 内部接口 - 生成道具三视图 DTO
 */
export const InternalCreatePropViewsSchema = z.object({
  projectId: z.string().describe("项目ID"),
  propId: z.string().describe("道具ID"),
  propDescription: z.string().describe("道具描述"),
  generationConfig: z
    .object({
      modelId: z.string().optional().describe("模型ID"),
      style: z.string().optional().describe("风格"),
      seed: z.number().optional().describe("种子"),
    })
    .optional()
    .describe("生成配置"),
  callbackUrl: z.string().optional().describe("完成回调地址"),
});

export type InternalCreatePropViewsDto = z.infer<
  typeof InternalCreatePropViewsSchema
>;

/**
 * 内部接口 - 生成分镜参考图 DTO
 */
export const InternalCreateStoryboardRefSchema = z.object({
  projectId: z.string().describe("项目ID"),
  shotId: z.string().describe("分镜ID"),
  mode: z.enum(["single_reference", "multi_reference"]).describe("生成模式"),
  description: z
    .object({
      brief: z.string().describe("简要描述"),
      detailed: z.string().describe("详细描述"),
    })
    .describe("分镜描述"),
  references: z
    .object({
      characterImages: z
        .array(z.string())
        .optional()
        .describe("角色参考图URL列表"),
      sceneImage: z.string().optional().describe("场景参考图URL"),
      propImages: z.array(z.string()).optional().describe("道具参考图URL列表"),
    })
    .describe("参考资源"),
  shotConfig: z
    .object({
      shotType: z.string().describe("景别"),
      cameraAngle: z.string().describe("角度"),
    })
    .optional()
    .describe("镜头设置"),
  generationConfig: z
    .object({
      modelId: z.string().optional().describe("模型ID"),
      style: z.string().optional().describe("风格"),
      seed: z.number().optional().describe("种子"),
    })
    .optional()
    .describe("生成配置"),
  callbackUrl: z.string().optional().describe("完成回调地址"),
});

export type InternalCreateStoryboardRefDto = z.infer<
  typeof InternalCreateStoryboardRefSchema
>;

// ==================== Response DTOs ====================

/**
 * 提交图片生成任务响应
 */
export interface CreateImageGenTaskResponseDto {
  taskId: string;
  status: ImageGenTaskStatus;
  estimatedCost: number;
  estimatedTime: number;
}

/**
 * 批量提交图片生成响应
 */
export interface CreateBatchImageGenResponseDto {
  taskId: string;
  status: ImageGenTaskStatus;
  batchCount: number;
  estimatedCost: number;
  estimatedTime: number;
}

/**
 * 图片生成结果 DTO
 */
export interface ImageGenResultDto {
  id: string;
  index: number;
  type: string;
  image: ImageInfo;
  generationParams: ImageGenerationParams;
  status: ImageGenResultStatus;
  error?: ImageGenError;
  moderation?: ImageModeration;
  createdAt: string;
  completedAt?: string;
}

/**
 * 任务详情响应
 */
export interface ImageGenTaskDetailDto {
  id: string;
  projectId: string;
  generationTaskId?: string;
  type: ImageGenTaskType;
  sceneType: ImageGenSceneType;
  status: ImageGenTaskStatus;
  config: ImageGenerationConfig;
  progress: ImageGenProgress;
  cost: ImageGenCost;
  results?: ImageGenResultDto[];
  error?: ImageGenError;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

/**
 * 取消任务响应
 */
export interface CancelImageGenTaskResponseDto {
  taskId: string;
  status: "cancelled" | "cancelling";
  refundAmount: number;
}

/**
 * 重新生成响应
 */
export interface RegenerateImageResponseDto {
  newResultId: string;
  status: ImageGenTaskStatus;
}

/**
 * 内部接口 - 创建任务响应
 */
export interface InternalCreateImageGenResponseDto {
  taskId: string;
  status: ImageGenTaskStatus;
}

/**
 * 回调通知数据 - 角色四视图完成
 */
export interface CharacterViewsCallbackData {
  event: "character_views_completed";
  data: {
    taskId: string;
    characterId: string;
    results: {
      frontView?: ImageGenResultDto;
      sideView?: ImageGenResultDto;
      backView?: ImageGenResultDto;
      angleView?: ImageGenResultDto;
    };
    status: ImageGenTaskStatus;
  };
}

// ==================== WebSocket 类型 ====================

/**
 * 任务进度 WebSocket 通知
 */
export interface ImageGenProgressWebSocketDto {
  type: "image_gen_progress";
  data: {
    taskId: string;
    projectId: string;
    status: ImageGenTaskStatus;
    progress: ImageGenProgress;
    currentResult?: {
      index: number;
      type: string;
      thumbnailUrl?: string;
      status: string;
    };
  };
  timestamp: number;
}

/**
 * 任务完成 WebSocket 通知
 */
export interface ImageGenCompletedWebSocketDto {
  type: "image_gen_completed";
  data: {
    taskId: string;
    projectId: string;
    status: ImageGenTaskStatus;
    resultsCount: number;
    summary: {
      success: number;
      failed: number;
    };
  };
  timestamp: number;
}

// ==================== 前端状态类型 ====================

/**
 * 图片生成状态（Pinia）
 */
export interface ImageGenState {
  // 当前任务
  currentTask: ImageGenTaskDetailDto | null;
  taskLoading: boolean;

  // 任务列表
  tasks: ImageGenTaskDetailDto[];
  tasksLoading: boolean;
  tasksTotal: number;

  // 生成中任务
  activeTasks: ImageGenTaskDetailDto[];

  // 模型列表
  availableModels: Array<{
    id: string;
    name: string;
    description?: string;
    supportedSizes: Array<{ width: number; height: number }>;
  }>;
  modelsLoading: boolean;
}

/**
 * 生成场景描述
 */
export const SCENE_TYPE_DESCRIPTIONS: Record<
  ImageGenSceneType,
  { label: string; description: string; viewCount: number }
> = {
  [ImageGenSceneType.CHARACTER_VIEWS]: {
    label: "角色四视图",
    description: "生成角色的正视图、侧视图、背视图、45度视图",
    viewCount: 4,
  },
  [ImageGenSceneType.SCENE_VIEWS]: {
    label: "场景参考图",
    description: "生成场景的全景图及时间/天气变体",
    viewCount: 4,
  },
  [ImageGenSceneType.PROP_VIEWS]: {
    label: "道具三视图",
    description: "生成道具的正视图、侧视图、俯视图",
    viewCount: 3,
  },
  [ImageGenSceneType.STORYBOARD_REFERENCE]: {
    label: "分镜参考图",
    description: "生成分镜的构图参考图",
    viewCount: 1,
  },
};

/**
 * 视图类型描述
 */
export const VIEW_TYPE_DESCRIPTIONS: Record<
  ViewType,
  { label: string; description: string }
> = {
  [ViewType.FRONT_VIEW]: {
    label: "正视图",
    description: "正对镜头的视图",
  },
  [ViewType.SIDE_VIEW]: {
    label: "侧视图",
    description: "90度侧面的视图",
  },
  [ViewType.BACK_VIEW]: {
    label: "背视图",
    description: "背对镜头的视图",
  },
  [ViewType.ANGLE_VIEW]: {
    label: "45度视图",
    description: "斜侧面的视图",
  },
  [ViewType.TOP_VIEW]: {
    label: "俯视图",
    description: "从上方俯视的视图",
  },
  [ViewType.ADDITIONAL]: {
    label: "附加视图",
    description: "其他类型的视图",
  },
};

/**
 * 图片比例描述
 */
export const IMAGE_ASPECT_RATIO_DESCRIPTIONS: Record<
  ImageAspectRatio,
  { label: string; width: number; height: number }
> = {
  [ImageAspectRatio.R1_1]: { label: "1:1", width: 1024, height: 1024 },
  [ImageAspectRatio.R16_9]: { label: "16:9", width: 1024, height: 576 },
  [ImageAspectRatio.R9_16]: { label: "9:16", width: 576, height: 1024 },
  [ImageAspectRatio.R3_4]: { label: "3:4", width: 768, height: 1024 },
  [ImageAspectRatio.R4_3]: { label: "4:3", width: 1024, height: 768 },
};
