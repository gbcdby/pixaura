import { z } from "zod";
import { VideoResolution, AspectRatio } from "./video-common";

// ==================== 枚举常量 ====================

/**
 * 视频生成任务状态
 */
export const VideoGenTaskStatus = {
  PENDING: "pending",
  QUEUED: "queued",
  GENERATING: "generating",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export type VideoGenTaskStatus =
  (typeof VideoGenTaskStatus)[keyof typeof VideoGenTaskStatus];

/**
 * 视频生成任务类型
 */
export const VideoGenTaskType = {
  SINGLE: "single",
  BATCH: "batch",
} as const;

export type VideoGenTaskType =
  (typeof VideoGenTaskType)[keyof typeof VideoGenTaskType];

/**
 * 视频生成模式
 * 重命名说明：
 * - audio_driven → audio_reference（音频驱动视频生成）
 * - video_first → lip_sync（对口型模式）
 * - video_only 保持不变
 */
export const VideoMode = {
  AUDIO_REFERENCE: "audio_reference",
  LIP_SYNC: "lip_sync",
  VIDEO_ONLY: "video_only",
} as const;

export type VideoMode = (typeof VideoMode)[keyof typeof VideoMode];

// 向后兼容的值映射（deprecated，迁移完成后删除）
/** @deprecated 使用 VideoMode.AUDIO_REFERENCE 代替 */
export const VIDEO_MODE_AUDIO_DRIVEN = "audio_driven" as const;
/** @deprecated 使用 VideoMode.LIP_SYNC 代替 */
export const VIDEO_MODE_VIDEO_FIRST = "video_first" as const;

/**
 * 参考模式
 */
export const ReferenceMode = {
  SINGLE_REFERENCE: "single_reference",
  MULTI_REFERENCE: "multi_reference",
} as const;

export type ReferenceMode = (typeof ReferenceMode)[keyof typeof ReferenceMode];

/**
 * 输出类型
 */
export const VideoGenOutputType = {
  VIDEO: "video",
  AUDIO: "audio",
  PREVIEW: "preview",
} as const;

export type VideoGenOutputType =
  (typeof VideoGenOutputType)[keyof typeof VideoGenOutputType];

/**
 * 批量任务批次状态
 */
export const VideoGenBatchStatus = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  PARTIAL_FAILED: "partial_failed",
  FAILED: "failed",
} as const;

export type VideoGenBatchStatus =
  (typeof VideoGenBatchStatus)[keyof typeof VideoGenBatchStatus];

/**
 * 生成步骤状态
 */
export const GenerationStepStatus = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export type GenerationStepStatus =
  (typeof GenerationStepStatus)[keyof typeof GenerationStepStatus];

/**
 * 审核状态
 */
export const ModerationStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export type ModerationStatus =
  (typeof ModerationStatus)[keyof typeof ModerationStatus];

// ==================== JSONB 子结构 ====================

/**
 * 输出配置
 */
export const VideoOutputConfigSchema = z.object({
  resolution: z
    .enum([VideoResolution.P480, VideoResolution.P720, VideoResolution.P1080])
    .default(VideoResolution.P720)
    .describe("分辨率"),
  aspectRatio: z
    .enum([AspectRatio.R16_9, AspectRatio.R9_16, AspectRatio.R1_1])
    .default(AspectRatio.R9_16)
    .describe("视频比例"),
});

export type VideoOutputConfig = z.infer<typeof VideoOutputConfigSchema>;

/**
 * Sequence 序列项
 */
export const SequenceItemSchema = z.object({
  timeStart: z.number().min(0).describe("开始时间（秒）"),
  timeEnd: z.number().min(0).describe("结束时间（秒）"),
  description: z.string().describe("描述"),
  dialogue: z
    .object({
      speaker: z.string().describe("说话人名称"),
      speakerId: z.string().describe("说话人ID"),
      text: z.string().describe("对白文本"),
      emotion: z.string().describe("情绪"),
    })
    .optional()
    .describe("对白信息"),
  camera: z
    .object({
      shotSize: z.string().describe("景别"),
      movement: z.string().describe("运镜"),
    })
    .optional()
    .describe("镜头信息"),
});

export type SequenceItem = z.infer<typeof SequenceItemSchema>;

/**
 * 参考资源
 */
export const VideoGenReferencesSchema = z.object({
  characters: z
    .array(
      z.object({
        id: z.string().describe("角色ID"),
        name: z.string().describe("角色名称"),
      }),
    )
    .default([])
    .describe("角色列表"),
  scenes: z
    .array(
      z.object({
        id: z.string().describe("场景ID"),
        name: z.string().describe("场景名称"),
      }),
    )
    .default([])
    .describe("场景列表"),
  props: z
    .array(
      z.object({
        id: z.string().describe("道具ID"),
        name: z.string().describe("道具名称"),
      }),
    )
    .default([])
    .describe("道具列表"),
  composedImage: z
    .string()
    .optional()
    .describe("合成参考图URL（分镜图生视频图模式使用）"),
});

export type VideoGenReferences = z.infer<typeof VideoGenReferencesSchema>;

/**
 * 分镜数据
 */
export const ShotDataSchema = z.object({
  briefDescription: z.string().describe("简要描述"),
  detailedDescription: z.string().describe("详细描述"),
  sequence: z.array(SequenceItemSchema).default([]).describe("序列信息"),
  references: VideoGenReferencesSchema.describe("参考资源"),
});

export type ShotData = z.infer<typeof ShotDataSchema>;

/**
 * 生成配置
 */
export const VideoGenConfigSchema = z.object({
  referenceMode: z
    .enum([ReferenceMode.SINGLE_REFERENCE, ReferenceMode.MULTI_REFERENCE])
    .describe("参考模式"),
  videoMode: z
    .enum([VideoMode.AUDIO_REFERENCE, VideoMode.LIP_SYNC, VideoMode.VIDEO_ONLY])
    .describe("视频生成模式"),
  modelId: z.string().optional().describe("视频生成模型ID"),
  shotData: ShotDataSchema.describe("分镜数据"),
  outputConfig: VideoOutputConfigSchema.describe("输出配置"),
});

export type VideoGenConfig = z.infer<typeof VideoGenConfigSchema>;

/**
 * 生成步骤
 */
export const GenerationStepSchema = z.object({
  name: z.string().describe("步骤名称"),
  label: z.string().describe("步骤显示名称"),
  status: z
    .enum([
      GenerationStepStatus.PENDING,
      GenerationStepStatus.PROCESSING,
      GenerationStepStatus.COMPLETED,
      GenerationStepStatus.FAILED,
    ])
    .default(GenerationStepStatus.PENDING)
    .describe("步骤状态"),
  progress: z.number().min(0).max(100).default(0).describe("步骤进度"),
  message: z.string().optional().describe("步骤说明"),
});

export type GenerationStep = z.infer<typeof GenerationStepSchema>;

/**
 * 进度信息
 */
export const VideoGenProgressSchema = z.object({
  currentStep: z.string().default("").describe("当前步骤名称"),
  percentage: z.number().min(0).max(100).default(0).describe("总进度百分比"),
  steps: z
    .array(GenerationStepSchema)
    .default([
      {
        name: "prepare",
        label: "准备数据",
        status: GenerationStepStatus.PENDING,
        progress: 0,
      },
      {
        name: "tts",
        label: "生成音频",
        status: GenerationStepStatus.PENDING,
        progress: 0,
      },
      {
        name: "video",
        label: "生成视频",
        status: GenerationStepStatus.PENDING,
        progress: 0,
      },
      {
        name: "sync",
        label: "音画同步",
        status: GenerationStepStatus.PENDING,
        progress: 0,
      },
    ])
    .describe("步骤列表"),
});

export type VideoGenProgress = z.infer<typeof VideoGenProgressSchema>;

/**
 * 成本信息
 */
export const VideoGenCostSchema = z.object({
  estimatedCost: z.number().default(0).describe("预估成本"),
  actualCost: z.number().default(0).describe("实际成本"),
  currency: z.string().default("CNY").describe("货币单位"),
  deductedQuota: z.number().optional().describe("已扣减额度"),
  deductedFrom: z
    .enum(["subscription", "balance"])
    .nullable()
    .optional()
    .describe("扣减来源"),
  refundAmount: z.number().optional().describe("返还额度"),
});

export type VideoGenCost = z.infer<typeof VideoGenCostSchema>;

/**
 * 错误信息
 */
export const VideoGenErrorSchema = z.object({
  code: z.number().describe("错误码"),
  message: z.string().describe("错误信息"),
  details: z.string().optional().describe("详细错误信息"),
  step: z.string().optional().describe("失败的步骤"),
});

export type VideoGenError = z.infer<typeof VideoGenErrorSchema>;

/**
 * 文件信息
 */
export const VideoGenFileSchema = z.object({
  url: z.string().describe("文件URL"),
  thumbnailUrl: z.string().optional().describe("缩略图URL"),
  format: z.string().describe("文件格式"),
  resolution: z.string().optional().describe("分辨率"),
  duration: z.number().describe("时长（秒）"),
  size: z.number().describe("文件大小（字节）"),
});

export type VideoGenFile = z.infer<typeof VideoGenFileSchema>;

/**
 * 生成参数快照
 */
export const GenerationParamsSchema = z.object({
  modelId: z.string().describe("模型ID"),
  referenceMode: z.string().describe("参考模式"),
  videoMode: z.string().describe("视频生成模式"),
  resolution: z.string().describe("分辨率"),
});

export type GenerationParams = z.infer<typeof GenerationParamsSchema>;

/**
 * 审核状态
 */
export const ModerationSchema = z.object({
  status: z
    .enum([
      ModerationStatus.PENDING,
      ModerationStatus.APPROVED,
      ModerationStatus.REJECTED,
    ])
    .default(ModerationStatus.PENDING)
    .describe("审核状态"),
  checkedAt: z.string().datetime().optional().describe("审核时间"),
  rejectReason: z.string().optional().describe("拒绝原因"),
});

export type Moderation = z.infer<typeof ModerationSchema>;

/**
 * 批次统计
 */
export const BatchStatsSchema = z.object({
  total: z.number().default(0).describe("总任务数"),
  completed: z.number().default(0).describe("已完成数"),
  failed: z.number().default(0).describe("失败数"),
  pending: z.number().default(0).describe("待处理数"),
});

export type BatchStats = z.infer<typeof BatchStatsSchema>;

// ==================== 请求 DTOs ====================

/**
 * 提交视频生成任务 DTO
 */
export const CreateVideoGenTaskSchema = z.object({
  projectId: z.string().describe("项目ID"),
  shotId: z.string().describe("分镜ID"),
  config: VideoGenConfigSchema.describe("生成配置"),
  notifyWs: z.boolean().default(true).describe("是否通过 WebSocket 通知进度"),
});

export type CreateVideoGenTaskDto = z.infer<typeof CreateVideoGenTaskSchema>;

/**
 * 批量提交视频生成 DTO - 单个分镜配置
 */
export const BatchVideoGenShotSchema = z.object({
  shotId: z.string().describe("分镜ID"),
  config: VideoGenConfigSchema.describe("生成配置"),
});

export type BatchVideoGenShotDto = z.infer<typeof BatchVideoGenShotSchema>;

/**
 * 批量提交视频生成 DTO
 */
export const CreateBatchVideoGenSchema = z.object({
  projectId: z.string().describe("项目ID"),
  shots: z
    .array(BatchVideoGenShotSchema)
    .max(10)
    .describe("分镜配置列表（最多10个）"),
  commonConfig: z
    .object({
      modelId: z.string().optional().describe("视频生成模型ID"),
      outputConfig: VideoOutputConfigSchema.partial()
        .optional()
        .describe("输出配置"),
    })
    .optional()
    .describe("通用配置"),
  notifyWs: z.boolean().default(true).describe("是否通过 WebSocket 通知进度"),
});

export type CreateBatchVideoGenDto = z.infer<typeof CreateBatchVideoGenSchema>;

/**
 * 重试任务 DTO
 */
export const RetryVideoGenTaskSchema = z.object({
  overrideConfig: z
    .object({
      modelId: z.string().optional().describe("视频生成模型ID"),
      outputConfig: z
        .object({
          resolution: z
            .enum([
              VideoResolution.P480,
              VideoResolution.P720,
              VideoResolution.P1080,
            ])
            .optional()
            .describe("分辨率"),
        })
        .optional()
        .describe("输出配置"),
    })
    .optional()
    .describe("覆盖配置"),
});

export type RetryVideoGenTaskDto = z.infer<typeof RetryVideoGenTaskSchema>;

/**
 * 内部接口 - 生成分镜视频 DTO
 */
export const InternalCreateVideoGenSchema = z.object({
  projectId: z.string().describe("项目ID"),
  shotId: z.string().describe("分镜ID"),
  generationConfig: VideoGenConfigSchema.describe("生成配置"),
  callbackUrl: z.string().optional().describe("完成回调地址"),
});

export type InternalCreateVideoGenDto = z.infer<
  typeof InternalCreateVideoGenSchema
>;

/**
 * 内部接口 - 批量生成分镜视频 DTO
 */
export const InternalBatchCreateVideoGenSchema = z.object({
  projectId: z.string().describe("项目ID"),
  shots: z
    .array(
      z.object({
        shotId: z.string().describe("分镜ID"),
        generationConfig: VideoGenConfigSchema.describe("生成配置"),
      }),
    )
    .describe("分镜配置列表"),
  commonConfig: z
    .object({
      modelId: z.string().optional().describe("视频生成模型ID"),
      outputConfig: VideoOutputConfigSchema.partial()
        .optional()
        .describe("输出配置"),
    })
    .optional()
    .describe("通用配置"),
  callbackUrl: z.string().optional().describe("完成回调地址"),
});

export type InternalBatchCreateVideoGenDto = z.infer<
  typeof InternalBatchCreateVideoGenSchema
>;

// ==================== Response DTOs ====================

/**
 * 视频生成步骤预览
 */
export interface VideoGenStepPreviewDto {
  name: string;
  label: string;
}

/**
 * 提交视频生成任务响应
 */
export interface CreateVideoGenTaskResponseDto {
  taskId: string;
  status: VideoGenTaskStatus;
  estimatedCost: number;
  estimatedTime: number;
  steps: VideoGenStepPreviewDto[];
  quotaInfo?: QuotaInfoDto;
}

/**
 * 批量提交响应 - 单个任务
 */
export interface BatchTaskItemDto {
  shotId: string;
  taskId: string;
  status: VideoGenTaskStatus;
}

/**
 * 批量提交视频生成响应
 */
export interface CreateBatchVideoGenResponseDto {
  batchId: string;
  tasks: BatchTaskItemDto[];
  totalCost: number;
  estimatedTime: number;
  quotaInfo?: BatchQuotaInfoDto;
}

/**
 * 视频生成输出结果
 */
export interface VideoGenOutputDto {
  id: string;
  type: VideoGenOutputType;
  file: VideoGenFile;
}

/**
 * 任务详情响应
 */
export interface VideoGenTaskDetailDto {
  id: string;
  projectId: string;
  shotId: string;
  status: VideoGenTaskStatus;
  config: VideoGenConfig;
  progress: VideoGenProgress;
  outputs?: VideoGenOutputDto[];
  cost: VideoGenCost & {
    deductedQuota?: number;
    deductedFrom?: "subscription" | "balance" | null;
    refundAmount?: number;
  };
  quotaRecordId?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: VideoGenError;
}

/**
 * 取消任务响应
 */
export interface CancelVideoGenTaskResponseDto {
  taskId: string;
  status: "cancelled" | "cancelling";
  refundAmount: number;
  refundStatus?: "pending" | "completed" | "failed";
}

/**
 * 额度信息
 */
export interface QuotaInfoDto {
  deducted: number;
  deductedFrom: "subscription" | "balance" | null; // null 表示管理员豁免
  remainingBalance: number;
}

/**
 * 批量任务额度信息
 */
export interface BatchQuotaInfoDto {
  totalDeducted: number;
  deductedFrom: "subscription" | "balance" | null; // null 表示管理员豁免
  remainingBalance: number;
}

/**
 * 额度扣减记录查询参数
 */
export const GetQuotaRecordsSchema = z.object({
  startDate: z.string().datetime().optional().describe("开始日期（ISO 8601）"),
  endDate: z.string().datetime().optional().describe("结束日期（ISO 8601）"),
  status: z
    .enum(["pending", "confirmed", "refunded"])
    .optional()
    .describe("状态过滤"),
  page: z.number().int().min(1).default(1).describe("页码"),
  pageSize: z.number().int().min(1).max(100).default(20).describe("每页数量"),
});

export type GetQuotaRecordsDto = z.infer<typeof GetQuotaRecordsSchema>;

/**
 * 额度扣减记录项
 */
export interface QuotaRecordItemDto {
  id: string;
  taskId: string;
  type: "deduct" | "refund";
  amount: number;
  status: "pending" | "confirmed" | "refunded";
  deductedFrom: "subscription" | "balance";
  createdAt: string;
  completedAt?: string;
}

/**
 * 额度扣减记录查询响应
 */
export interface GetQuotaRecordsResponseDto {
  items: QuotaRecordItemDto[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * 重试任务响应
 */
export interface RetryVideoGenTaskResponseDto {
  taskId: string;
  status: VideoGenTaskStatus;
  message: string;
}

/**
 * 内部接口 - 创建任务响应
 */
export interface InternalCreateVideoGenResponseDto {
  taskId: string;
  status: VideoGenTaskStatus;
}

/**
 * 内部接口 - 批量创建任务响应
 */
export interface InternalBatchCreateVideoGenResponseDto {
  batchId: string;
  tasks: BatchTaskItemDto[];
}

/**
 * 回调通知数据
 */
export interface VideoGenCallbackData {
  event: "video_gen_completed";
  data: {
    taskId: string;
    shotId: string;
    projectId: string;
    status: "completed" | "failed";
    outputs?: {
      videoUrl?: string;
      audioUrl?: string;
      duration: number;
    };
    error?: {
      code: number;
      message: string;
    };
  };
}

// ==================== WebSocket 类型 ====================

/**
 * 任务进度 WebSocket 通知
 */
export interface VideoGenProgressWebSocketDto {
  type: "video_gen_progress";
  data: {
    taskId: string;
    projectId: string;
    shotId: string;
    status: VideoGenTaskStatus;
    progress: VideoGenProgress;
  };
  timestamp: number;
}

/**
 * 任务完成 WebSocket 通知
 */
export interface VideoGenCompletedWebSocketDto {
  type: "video_gen_completed";
  data: {
    taskId: string;
    projectId: string;
    shotId: string;
    status: "completed" | "failed";
    outputs?: {
      videoUrl?: string;
      audioUrl?: string;
      duration: number;
    };
    cost: {
      actualCost: number;
    };
  };
  timestamp: number;
}

/**
 * 步骤更新 WebSocket 通知
 */
export interface VideoGenStepUpdateWebSocketDto {
  type: "video_gen_step_update";
  data: {
    taskId: string;
    step: GenerationStep;
  };
  timestamp: number;
}

// ==================== 前端状态类型 ====================

/**
 * 视频生成状态（Pinia）
 */
export interface VideoGenState {
  // 当前任务
  currentTask: VideoGenTaskDetailDto | null;
  taskLoading: boolean;

  // 批量任务
  batchTasks: VideoGenTaskDetailDto[];
  batchLoading: boolean;

  // 生成中任务列表
  activeTasks: VideoGenTaskDetailDto[];

  // 模型列表
  availableModels: Array<{
    id: string;
    name: string;
    description?: string;
    supportedResolutions: VideoResolution[];
  }>;
  modelsLoading: boolean;
}

/**
 * 生成模式描述
 */
export const VIDEO_MODE_DESCRIPTIONS: Record<
  VideoMode,
  { label: string; description: string }
> = {
  [VideoMode.AUDIO_REFERENCE]: {
    label: "音频参考",
    description:
      "先生成音频，再由音频作为参考素材参与视频生成，适合动作/对话镜头",
  },
  [VideoMode.LIP_SYNC]: {
    label: "对口型",
    description:
      "先生成无声视频，再配音，然后对口型（可以省略），适合动作/对话镜头",
  },
  [VideoMode.VIDEO_ONLY]: {
    label: "纯视频",
    description: "只生成画面，无音频，适合氛围展示镜头",
  },
};

/**
 * 参考模式描述
 */
export const REFERENCE_MODE_DESCRIPTIONS: Record<
  ReferenceMode,
  { label: string; description: string }
> = {
  [ReferenceMode.SINGLE_REFERENCE]: {
    label: "单张参考图",
    description: "使用合成参考图精确控制画面构图",
  },
  [ReferenceMode.MULTI_REFERENCE]: {
    label: "多资产参考",
    description: "组合角色/场景/道具图片作为参考",
  },
};
