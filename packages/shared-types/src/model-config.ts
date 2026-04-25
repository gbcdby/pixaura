import { z } from "zod";

// ==================== Enums ====================

/**
 * 功能类别
 */
export const FunctionCategory = {
  TEXT_GENERATION: "TEXT_GENERATION",
  IMAGE_GENERATION: "IMAGE_GENERATION",
  VIDEO_GENERATION: "VIDEO_GENERATION",
  AUDIO_GENERATION: "AUDIO_GENERATION",
  VOICE_GENERATION: "VOICE_GENERATION",
  LIP_SYNC: "LIP_SYNC",
} as const;

export type FunctionCategory =
  (typeof FunctionCategory)[keyof typeof FunctionCategory];

/**
 * 功能类别名称映射（单一来源）
 * 所有类别相关的显示名称都从此处获取
 */
export const FunctionCategoryNames: Record<FunctionCategory, string> = {
  [FunctionCategory.TEXT_GENERATION]: "文本生成",
  [FunctionCategory.IMAGE_GENERATION]: "图像生成",
  [FunctionCategory.VIDEO_GENERATION]: "视频生成",
  [FunctionCategory.AUDIO_GENERATION]: "音频生成",
  [FunctionCategory.VOICE_GENERATION]: "语音生成",
  [FunctionCategory.LIP_SYNC]: "对口型",
};

/**
 * 功能类别选项列表（用于下拉选择）
 */
export const FunctionCategoryOptions = Object.entries(
  FunctionCategoryNames,
).map(([value, label]) => ({ value: value as FunctionCategory, label }));

/**
 * 供应商类型
 */
export const ProviderType = {
  OFFICIAL: "official",
  PROXY: "proxy",
  RELAY: "relay",
} as const;

export type ProviderType = (typeof ProviderType)[keyof typeof ProviderType];

/**
 * 认证类型
 */
export const AuthType = {
  API_KEY: "api_key",
  AKSK: "aksk",
  OAUTH: "oauth",
} as const;

export type AuthType = (typeof AuthType)[keyof typeof AuthType];

/**
 * 计费模式
 */
export const BillingMode = {
  PER_TOKEN: "per_token",
  PER_CALL: "per_call",
  PER_SECOND: "per_second",
} as const;

export type BillingMode = (typeof BillingMode)[keyof typeof BillingMode];

/**
 * 健康状态
 */
export const HealthStatus = {
  HEALTHY: "healthy",
  UNHEALTHY: "unhealthy",
  UNKNOWN: "unknown",
} as const;

export type HealthStatus = (typeof HealthStatus)[keyof typeof HealthStatus];

// ==================== Entity Interfaces ====================

/**
 * 供应商实体
 */
export interface ProviderEntity {
  id: string;
  providerId: string;
  providerName: string;
  providerType: ProviderType;
  baseUrl: string;
  authType: AuthType;
  apiKeyEnc: string | null;
  apiSecretEnc: string | null;
  status: "enabled" | "disabled";
  healthStatus: HealthStatus;
  checkConfig: Record<string, unknown>;
  rateLimitConfig: Record<string, unknown>;
  apiKeyExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * AI 模型实体
 */
export interface AiModelEntity {
  id: string;
  modelId: string;
  modelName: string;
  category: FunctionCategory;
  description: string | null;
  minTier: string;
  isDefault: boolean;
  status: "enabled" | "disabled";
  defaultParams: Record<string, unknown>;
  customParams: Record<string, unknown>;
  costConfig: Record<string, unknown>;
  supportedFeatures: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 模型供应商关联实体
 */
export interface ModelProviderEntity {
  id: string;
  modelId: string;
  providerId: string;
  isPrimary: boolean;
  priority: number;
  providerModelId: string | null;
  status: "enabled" | "disabled";
  createdAt: Date;
}

// ==================== Provider DTOs ====================

/**
 * 创建供应商 DTO
 */
export const CreateProviderSchema = z.object({
  providerId: z.string().min(1).max(50).describe("供应商唯一标识"),
  providerName: z.string().min(1).max(100).describe("供应商名称"),
  providerType: z.enum(["official", "proxy", "relay"]).describe("供应商类型"),
  baseUrl: z.string().url().max(500).describe("API 基础 URL"),
  authType: z.enum(["api_key", "aksk", "oauth"]).describe("认证类型"),
  apiKey: z.string().optional().describe("API Key"),
  apiSecret: z.string().optional().describe("API Secret"),
  apiKeyExpiresAt: z
    .string()
    .datetime()
    .optional()
    .describe("API Key 过期时间"),
});

export type CreateProviderDto = z.infer<typeof CreateProviderSchema>;

/**
 * 更新供应商 DTO
 */
export const UpdateProviderSchema = z.object({
  providerName: z.string().min(1).max(100).optional().describe("供应商名称"),
  baseUrl: z.string().url().max(500).optional().describe("API 基础 URL"),
  authType: z
    .enum(["api_key", "aksk", "oauth"])
    .optional()
    .describe("认证类型"),
  apiKey: z.string().optional().describe("API Key"),
  apiSecret: z.string().optional().describe("API Secret"),
  apiKeyExpiresAt: z
    .string()
    .datetime()
    .optional()
    .describe("API Key 过期时间"),
  status: z.enum(["enabled", "disabled"]).optional().describe("状态"),
  checkConfig: z.record(z.unknown()).optional().describe("健康检查配置"),
  rateLimitConfig: z.record(z.unknown()).optional().describe("限流配置"),
});

export type UpdateProviderDto = z.infer<typeof UpdateProviderSchema>;

/**
 * 供应商列表项 DTO
 */
export interface ProviderListItemDto {
  providerId: string;
  providerName: string;
  providerType: ProviderType;
  baseUrl: string;
  authType: AuthType;
  status: "enabled" | "disabled";
  healthStatus: HealthStatus;
  modelsCount: number;
  apiKeyMasked?: string | null;
  apiKeyExpiresAt: Date | null;
  createdAt: Date;
}

// ==================== Model DTOs ====================

/**
 * 创建模型 DTO
 */
export const CreateModelSchema = z.object({
  modelId: z.string().min(1).max(100).describe("模型唯一标识"),
  modelName: z.string().min(1).max(200).describe("模型名称"),
  providerId: z.string().min(1).max(50).describe("供应商ID"),
  providerModelId: z.string().max(200).optional().describe("供应商侧的模型ID"),
  category: z
    .enum([
      "TEXT_GENERATION",
      "IMAGE_GENERATION",
      "VIDEO_GENERATION",
      "AUDIO_GENERATION",
      "VOICE_GENERATION",
      "LIP_SYNC",
    ])
    .describe("功能类别"),
  description: z.string().max(1000).optional().describe("模型描述"),
  minTier: z
    .enum(["free", "basic", "pro"])
    .default("free")
    .describe("最低可用订阅等级"),
  isDefault: z.boolean().default(false).describe("是否为默认模型"),
  billingMode: z
    .enum(["per_token", "per_call", "per_second"])
    .describe("计费模式"),
  costPer1kTokens: z.number().min(0).optional().describe("每千token成本"),
  pricePer1kTokens: z.number().min(0).optional().describe("每千token售价"),
  costPerCall: z.number().min(0).optional().describe("每次调用成本"),
  pricePerCall: z.number().min(0).optional().describe("每次调用售价"),
  costPerSecond: z.number().min(0).optional().describe("每秒成本"),
  pricePerSecond: z.number().min(0).optional().describe("每秒售价"),
  defaultParams: z.record(z.unknown()).default({}).describe("默认参数"),
  customParams: z.record(z.unknown()).default({}).describe("自定义参数（原样透传给外部服务）"),
  supportedFeatures: z.array(z.string()).default([]).describe("支持的特性"),
});

export type CreateModelDto = z.infer<typeof CreateModelSchema>;

/**
 * 更新模型 DTO
 */
export const UpdateModelSchema = z.object({
  modelName: z.string().min(1).max(200).optional().describe("模型名称"),
  description: z.string().max(1000).optional().describe("模型描述"),
  minTier: z
    .enum(["free", "basic", "pro"])
    .optional()
    .describe("最低可用订阅等级"),
  isDefault: z.boolean().optional().describe("是否为默认模型"),
  status: z.enum(["enabled", "disabled"]).optional().describe("状态"),
  billingMode: z
    .enum(["per_token", "per_call", "per_second"])
    .optional()
    .describe("计费模式"),
  costPer1kTokens: z.number().min(0).optional().describe("每千token成本"),
  pricePer1kTokens: z.number().min(0).optional().describe("每千token售价"),
  costPerCall: z.number().min(0).optional().describe("每次调用成本"),
  pricePerCall: z.number().min(0).optional().describe("每次调用售价"),
  costPerSecond: z.number().min(0).optional().describe("每秒成本"),
  pricePerSecond: z.number().min(0).optional().describe("每秒售价"),
  defaultParams: z.record(z.unknown()).optional().describe("默认参数"),
  customParams: z.record(z.unknown()).optional().describe("自定义参数（原样透传给外部服务）"),
  supportedFeatures: z.array(z.string()).optional().describe("支持的特性"),
});

export type UpdateModelDto = z.infer<typeof UpdateModelSchema>;

/**
 * 用户端模型列表项 DTO
 */
export interface UserModelListItemDto {
  modelId: string;
  modelName: string;
  description: string | null;
  isDefault: boolean;
  pricePer1kTokens?: number;
  pricePerCall?: number;
  pricePerSecond?: number;
  pricePerChar?: number; // TTS 按字计费
  /** 模型默认参数，包含 max_references、max_references_images 等能力字段 */
  defaultParams: Record<string, unknown>;
  /** 自定义参数（原样透传给外部服务） */
  customParams: Record<string, unknown>;
}

/**
 * 管理端模型列表项 DTO
 */
export interface AdminModelListItemDto {
  modelId: string;
  modelName: string;
  providerId: string;
  providerName: string;
  category: FunctionCategory;
  status: "enabled" | "disabled";
  minTier: string;
  isDefault: boolean;
  billingMode?: string;
  costPer1kTokens?: number;
  pricePer1kTokens?: number;
  costPerCall?: number;
  pricePerCall?: number;
  costPerSecond?: number;
  pricePerSecond?: number;
  defaultParams: Record<string, unknown>;
  customParams: Record<string, unknown>;
  supportedFeatures: string[];
  createdAt: Date;
}

/**
 * 按类别分组的模型 DTO
 */
export interface ModelByCategoryDto {
  category: FunctionCategory;
  categoryName: string;
  models: UserModelListItemDto[];
}

/**
 * 用户端模型详情 DTO
 */
export interface UserModelDetailDto {
  modelId: string;
  modelName: string;
  category: FunctionCategory;
  description: string | null;
  defaultParams: Record<string, unknown>;
  customParams: Record<string, unknown>;
  supportedFeatures: string[];
  pricePer1kTokens?: number;
  pricePerCall?: number;
  pricePerSecond?: number;
}

// ==================== Health DTOs ====================

/**
 * 供应商健康状态 DTO
 */
export interface ProviderHealthStatusDto {
  providerId: string;
  providerName: string;
  healthStatus: HealthStatus;
  lastCheckAt: Date | null;
  avgResponseTimeMs: number;
  failureCount: number;
  failoverTo?: string;
}

/**
 * 健康检查结果 DTO
 */
export interface HealthCheckResultDto {
  providerId: string;
  healthStatus: HealthStatus;
  responseTimeMs: number;
}

// ==================== Internal DTOs ====================

/**
 * 内部调用配置 DTO
 */
export interface InternalCallConfigDto {
  modelId: string;
  modelName: string;
  provider: {
    providerId: string;
    baseUrl: string;
    apiKey: string;
  };
  category: FunctionCategory;
  defaultParams: Record<string, unknown>;
  customParams: Record<string, unknown>;
  pricePer1kTokens?: number;
  pricePerCall?: number;
}

/**
 * 统一生成请求
 */
export interface UniformGenerateRequest {
  modelId: string;
  requestId: string;
  messages?: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  prompt?: string;
  imageUrl?: string;
  parameters?: Record<string, unknown>;
  stream?: boolean;
}

/**
 * Token 用量
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * 统一生成响应
 */
export interface UniformGenerateResponse {
  success: boolean;
  requestId: string;
  data?: {
    content?: string;
    url?: string;
    usage?: TokenUsage;
  };
  error?: {
    code: number;
    msg: string;
  };
}

// ==================== Model Provider DTOs ====================

/**
 * 设置模型供应商 DTO
 */
export const SetModelProviderSchema = z.object({
  providerId: z.string().min(1).describe("供应商ID"),
  isPrimary: z.boolean().describe("是否为主要供应商"),
  priority: z.number().int().min(0).describe("优先级"),
  providerModelId: z.string().optional().describe("供应商侧的模型ID"),
});

export type SetModelProviderDto = z.infer<typeof SetModelProviderSchema>;

// ==================== Call Stats DTOs ====================

/**
 * 模型调用统计 DTO
 */
export interface CallStatsDto {
  modelId: string;
  modelName?: string;
  totalCalls: number;
  successCalls: number;
  failedCalls: number;
  successRate: number;
  avgResponseTimeMs: number;
  period: string;
}

/**
 * 供应商调用统计 DTO
 */
export interface ProviderCallStatsDto {
  providerId: string;
  providerName?: string;
  totalCalls: number;
  successCalls: number;
  failedCalls: number;
  successRate: number;
  avgResponseTimeMs: number;
  period: string;
}

// ==================== User Default Models DTOs ====================

/**
 * 用户默认模型配置 DTO
 * configs 对象中每个类别对应一个模型ID，null 表示使用系统默认
 */
export interface UserDefaultModelsDto {
  configs: Record<string, string | null>;
}

/**
 * 更新用户默认模型配置 Schema
 */
export const UpdateUserDefaultModelsSchema = z.object({
  configs: z
    .record(z.string().nullable())
    .describe("模型配置，key为功能类别，value为模型ID，null表示使用系统默认"),
});

export type UpdateUserDefaultModelsDto = z.infer<
  typeof UpdateUserDefaultModelsSchema
>;

// ==================== Model Default Params Types ====================

/**
 * 文本生成模型默认参数
 */
export interface ModelConfigTextGenerationParams {
  temperature: number; // 0-2, 默认 0.7
  max_tokens: number; // 1000-128000, 默认 8000
}

/**
 * 图像生成模型默认参数（合并文生图和图生图）
 * 参考图数量可为 0，此时为文生图模式；有参考图时为图生图模式
 */
export interface ModelConfigImageGenerationParams {
  image_size: string; // "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "2:3" | "3:2", 默认 "1:1"
  quality: string; // "512" | "1k" | "2k" | "4k", 默认 "1k"
  number: number; // 1-4, 默认 1
  max_references: number; // 0-20, 默认 3，可为 0 表示纯文生图
  size_mode: "ratio" | "pixel"; // 尺寸传递模式：ratio=比例模式直接透传, pixel=像素模式按 quality 转换, 默认 "ratio"
}

/**
 * 视频生成模型默认参数
 */
export interface ModelConfigVideoGenerationParams {
  aspect_ratio: string; // "16:9" | "9:16" | "4:3" | "3:4" | "1:1", 默认 "16:9"
  duration: number[]; // 视频时长选项数组，如 [1,2,3,4,5]
  quality: string; // "720p" | "1080p" | "4k", 默认 "720p"
  max_references_images: number; // 0-20, 默认 3
  max_references_videos: number; // 0-20, 默认 3
  max_references_audios: number; // 0-20, 默认 3
  generate_audio: boolean; // 默认 false
  generation_mode: "first_last_frame" | "multi_reference"; // 视频生成方式，默认 "first_last_frame"
}

/**
 * 音频生成模型默认参数 (无额外参数)
 */
export type ModelConfigAudioGenerationParams = Record<string, never>;

/**
 * 语音生成模型默认参数 (无额外参数)
 */
export type ModelConfigVoiceGenerationParams = Record<string, never>;

/**
 * 对口型模型默认参数 (无额外参数)
 */
export type ModelConfigLipSyncParams = Record<string, never>;

/**
 * 模型默认参数联合类型
 */
export type ModelDefaultParams =
  | ModelConfigTextGenerationParams
  | ModelConfigImageGenerationParams
  | ModelConfigVideoGenerationParams
  | ModelConfigAudioGenerationParams
  | ModelConfigVoiceGenerationParams
  | ModelConfigLipSyncParams;

/**
 * 各类型模型的默认参数值
 */
export const DefaultParamsByCategory: Partial<
  Record<FunctionCategory, ModelDefaultParams>
> = {
  TEXT_GENERATION: { temperature: 0.7, max_tokens: 8000 },
  IMAGE_GENERATION: {
    image_size: "1:1",
    quality: "1k",
    number: 1,
    max_references: 3,
    size_mode: "ratio",
  },
  VIDEO_GENERATION: {
    aspect_ratio: "16:9",
    duration: [3],
    quality: "720p",
    max_references_images: 3,
    max_references_videos: 3,
    max_references_audios: 3,
    generate_audio: false,
    generation_mode: "first_last_frame",
  },
  AUDIO_GENERATION: {},
  VOICE_GENERATION: {},
  LIP_SYNC: {},
};

/**
 * 根据功能类别获取默认参数
 */
export function getDefaultParamsByCategory(
  category: FunctionCategory,
): ModelDefaultParams | undefined {
  return DefaultParamsByCategory[category];
}

// ==================== Zod Schemas for Params ====================

/**
 * 文本生成参数 Schema
 */
export const ModelConfigTextGenerationParamsSchema = z.object({
  temperature: z.number().min(0).max(2).default(0.7),
  max_tokens: z.number().int().min(1000).max(128000).default(8000),
});

/**
 * 图像生成参数 Schema（合并文生图和图生图）
 * 参考图数量可为 0，表示纯文生图模式
 */
export const ModelConfigImageGenerationParamsSchema = z.object({
  image_size: z
    .enum(["1:1", "16:9", "9:16", "4:3", "3:4", "2:3", "3:2"])
    .default("1:1"),
  quality: z.enum(["512", "1k", "2k", "4k"]).default("1k"),
  number: z.number().int().min(1).max(4).default(1),
  max_references: z.number().int().min(0).max(20).default(3),
  size_mode: z.enum(["ratio", "pixel"]).default("ratio"),
});

/**
 * 视频生成参数 Schema
 */
export const ModelConfigVideoGenerationParamsSchema = z.object({
  aspect_ratio: z.enum(["16:9", "9:16", "4:3", "3:4", "1:1"]).default("16:9"),
  duration: z.array(z.number().int().min(1).max(3600)).default([3]),
  quality: z.enum(["720p", "1080p", "4k"]).default("720p"),
  max_references_images: z.number().int().min(0).max(20).default(3),
  max_references_videos: z.number().int().min(0).max(20).default(3),
  max_references_audios: z.number().int().min(0).max(20).default(3),
  generate_audio: z.boolean().default(false),
  generation_mode: z
    .enum(["first_last_frame", "multi_reference"])
    .default("first_last_frame"),
});

/**
 * 音频生成参数 Schema (空对象)
 */
export const ModelConfigAudioGenerationParamsSchema = z.object({}).strict();

/**
 * 语音生成参数 Schema (空对象)
 */
export const ModelConfigVoiceGenerationParamsSchema = z.object({}).strict();

/**
 * 对口型参数 Schema (空对象)
 */
export const ModelConfigLipSyncParamsSchema = z.object({}).strict();
