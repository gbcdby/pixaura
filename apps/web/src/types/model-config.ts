import type {
  ProviderType,
  AuthType,
  HealthStatus,
  FunctionCategory,
  BillingMode,
  ProviderListItemDto,
  AdminModelListItemDto,
  UserModelListItemDto,
  UserModelDetailDto,
  ProviderHealthStatusDto,
} from "@pixaura/shared-types";
import { FunctionCategory as FC } from "@pixaura/shared-types";

export type {
  ProviderType,
  AuthType,
  HealthStatus,
  FunctionCategory,
  BillingMode,
  ProviderListItemDto,
  AdminModelListItemDto,
  UserModelListItemDto,
  UserModelDetailDto,
  ProviderHealthStatusDto,
};

// ==================== 模型默认参数类型 ====================

/**
 * 文本生成模型参数
 */
export interface TextGenerationParams extends Record<string, unknown> {
  temperature: number;
  max_tokens: number;
}

/**
 * 图片生成模型参数（合并文生图和图生图）
 * 参考图数量可为 0，此时为文生图模式；有参考图时为图生图模式
 */
export interface ImageGenerationParams extends Record<string, unknown> {
  image_size: string;
  quality: string;
  number: number;
  max_references: number;
  size_mode: "ratio" | "pixel";
}

/**
 * 视频生成模型参数
 */
export interface VideoGenerationParams extends Record<string, unknown> {
  aspect_ratio: string;
  duration: number[];
  quality: string;
  max_references_images: number;
  max_references_videos: number;
  max_references_audios: number;
  generate_audio: boolean;
  generation_mode: "first_last_frame" | "multi_reference";
}

/**
 * 按类别分类的默认参数类型
 */
export type DefaultParamsByCategory = {
  [FC.TEXT_GENERATION]: TextGenerationParams;
  [FC.IMAGE_GENERATION]: ImageGenerationParams;
  [FC.VIDEO_GENERATION]: VideoGenerationParams;
  [FC.AUDIO_GENERATION]: Record<string, never>;
  [FC.VOICE_GENERATION]: Record<string, never>;
  [FC.LIP_SYNC]: Record<string, never>;
};

/**
 * 获取默认参数配置
 */
export function getDefaultParamsByCategory(
  category: FunctionCategory,
): DefaultParamsByCategory[FunctionCategory] {
  switch (category) {
    case FC.TEXT_GENERATION:
      return {
        temperature: 0.7,
        max_tokens: 8000,
      };
    case FC.IMAGE_GENERATION:
      return {
        image_size: "1:1",
        quality: "1k",
        number: 1,
        max_references: 3,
        size_mode: "ratio",
      };
    case FC.VIDEO_GENERATION:
      return {
        aspect_ratio: "16:9",
        duration: [3],
        quality: "720p",
        max_references_images: 3,
        max_references_videos: 3,
        max_references_audios: 3,
        generate_audio: false,
        generation_mode: "first_last_frame",
      };
    case FC.AUDIO_GENERATION:
      return {};
    case FC.VOICE_GENERATION:
      return {};
    case FC.LIP_SYNC:
      return {};
    default:
      return {};
  }
}

/**
 * 图片尺寸选项
 */
export const IMAGE_SIZE_OPTIONS = [
  { label: "1:1", value: "1:1" },
  { label: "16:9", value: "16:9" },
  { label: "9:16", value: "9:16" },
  { label: "4:3", value: "4:3" },
  { label: "3:4", value: "3:4" },
  { label: "2:3", value: "2:3" },
  { label: "3:2", value: "3:2" },
];

/**
 * 图片质量选项
 */
export const IMAGE_QUALITY_OPTIONS = [
  { label: "不设置", value: "" },
  { label: "512", value: "512" },
  { label: "1k", value: "1k" },
  { label: "2k", value: "2k" },
  { label: "4k", value: "4k" },
];

/**
 * 视频比例选项
 */
export const VIDEO_ASPECT_RATIO_OPTIONS = [
  { label: "16:9", value: "16:9" },
  { label: "9:16", value: "9:16" },
  { label: "4:3", value: "4:3" },
  { label: "3:4", value: "3:4" },
  { label: "1:1", value: "1:1" },
];

/**
 * 视频质量选项
 */
export const VIDEO_QUALITY_OPTIONS = [
  { label: "720p", value: "720p" },
  { label: "1080p", value: "1080p" },
  { label: "4k", value: "4k" },
];

/**
 * 视频生成方式选项
 */
export const VIDEO_GENERATION_MODE_OPTIONS = [
  { label: "首尾帧", value: "first_last_frame" },
  { label: "多参考", value: "multi_reference" },
];

// 创建供应商请求
export interface CreateProviderDto {
  providerId: string;
  providerName: string;
  providerType: ProviderType;
  baseUrl: string;
  authType: AuthType;
  apiKey?: string;
  apiSecret?: string;
}

// 更新供应商请求
export interface UpdateProviderDto {
  providerName?: string;
  baseUrl?: string;
  authType?: AuthType;
  apiKey?: string;
  apiSecret?: string;
  status?: "enabled" | "disabled";
  checkConfig?: Record<string, unknown>;
  rateLimitConfig?: Record<string, unknown>;
}

// 创建模型请求
export interface CreateModelDto {
  modelId: string;
  modelName: string;
  providerId: string;
  providerModelId?: string;
  category: FunctionCategory;
  description?: string;
  minTier: "free" | "basic" | "pro";
  isDefault: boolean;
  billingMode: BillingMode;
  costPer1kTokens?: number;
  pricePer1kTokens?: number;
  costPerCall?: number;
  pricePerCall?: number;
  costPerSecond?: number;
  pricePerSecond?: number;
  defaultParams?: Record<string, unknown>;
  customParams?: Record<string, unknown>;
  supportedFeatures?: string[];
}

// 更新模型请求
export interface UpdateModelDto {
  modelName?: string;
  description?: string;
  minTier?: "free" | "basic" | "pro";
  isDefault?: boolean;
  status?: "enabled" | "disabled";
  billingMode?: BillingMode;
  costPer1kTokens?: number;
  pricePer1kTokens?: number;
  costPerCall?: number;
  pricePerCall?: number;
  costPerSecond?: number;
  pricePerSecond?: number;
  defaultParams?: Record<string, unknown>;
  customParams?: Record<string, unknown>;
  supportedFeatures?: string[];
}

// 设置模型供应商请求
export interface SetModelProviderDto {
  providerId: string;
  isPrimary: boolean;
  priority: number;
  providerModelId?: string;
}

// 供应商详情
export interface ProviderDetail extends ProviderListItemDto {
  apiKeyEnc: string | null;
  apiSecretEnc: string | null;
  checkConfig: Record<string, unknown>;
  rateLimitConfig: Record<string, unknown>;
}

// 模型详情
export interface ModelDetail extends AdminModelListItemDto {
  description: string | null;
  defaultParams: Record<string, unknown>;
  supportedFeatures: string[];
  providers: Array<{
    providerId: string;
    providerName: string;
    isPrimary: boolean;
    priority: number;
    providerModelId: string | null;
    status: "enabled" | "disabled";
  }>;
}

// 健康检查日志
export interface HealthCheckLog {
  id: string;
  providerId: string;
  providerName: string;
  status: "success" | "failed";
  responseTimeMs: number;
  errorMessage?: string;
  checkedAt: Date;
}

// 用户默认模型配置
export interface UserDefaultModelsDto {
  configs: Record<string, string | null>;
}
