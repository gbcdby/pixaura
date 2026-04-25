import { z } from "zod";

/**
 * 封禁用户 Schema
 */
export const BanUserSchema = z.object({
  reason: z.string().min(1, "封禁原因不能为空").max(255, "封禁原因过长"),
  durationDays: z.number().int().min(-1, "封禁时长不能小于-1"),
  notifyUser: z.boolean().optional(),
});

export type BanUserDto = z.infer<typeof BanUserSchema>;

/**
 * 解封用户 Schema
 */
export const UnbanUserSchema = z.object({
  reason: z.string().min(1, "解封原因不能为空").max(255, "解封原因过长"),
});

export type UnbanUserDto = z.infer<typeof UnbanUserSchema>;

/**
 * 文件上传配置 Schema
 */
export const FileUploadConfigSchema = z.object({
  maxSize: z.number().positive("最大尺寸必须为正数"),
  allowedTypes: z
    .array(
      z
        .string()
        .min(1, "文件格式不能为空")
        .regex(
          /^[a-z0-9]+$/,
          "文件格式只能包含小写字母和数字，不能包含点号或其他特殊字符",
        ),
    )
    .optional(),
  dailyLimit: z.number().int().positive().optional(),
});

export type FileUploadConfigDto = z.infer<typeof FileUploadConfigSchema>;

/**
 * 更新文件上传配置 Schema
 */
export const UpdateFileUploadConfigSchema = z.object({
  avatar: FileUploadConfigSchema.optional(),
  reference: FileUploadConfigSchema.optional(),
  project: FileUploadConfigSchema.optional(),
});

export type UpdateFileUploadConfigDto = z.infer<
  typeof UpdateFileUploadConfigSchema
>;

/**
 * 限流配置 Schema
 */
export const RateLimitConfigSchema = z.object({
  enabled: z.boolean(),
  windowSeconds: z.number().int().positive("窗口时长必须为正数"),
  maxRequests: z.number().int().positive("最大请求数必须为正数"),
  banDurationSeconds: z.number().int().nonnegative("封禁时长不能为负数"),
  whitelistIps: z.array(z.string()).optional(),
});

export type RateLimitConfigDto = z.infer<typeof RateLimitConfigSchema>;

/**
 * 更新限流配置 Schema
 */
export const UpdateRateLimitConfigSchema = z.object({
  enabled: z.boolean().optional(),
  windowSeconds: z.number().int().positive().optional(),
  maxRequests: z.number().int().positive().optional(),
  banDurationSeconds: z.number().int().positive().optional(),
  whitelistIps: z.array(z.string()).optional(),
});

export type UpdateRateLimitConfigDto = z.infer<
  typeof UpdateRateLimitConfigSchema
>;

/**
 * 操作日志查询 Schema
 */
export const OperationLogQuerySchema = z.object({
  adminId: z.string().uuid().optional(),
  operationType: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
});

export type OperationLogQueryDto = z.infer<typeof OperationLogQuerySchema>;

/**
 * TTS 模型价格配置 Schema
 */
export const TTSModelPriceSchema = z.object({
  enabled: z.boolean().default(true),
  costPerChar: z.number().min(0, "成本不能为负数").default(0.00002),
  pricePerChar: z.number().min(0, "售价不能为负数").default(0.00005),
});

export type TTSModelPriceDto = z.infer<typeof TTSModelPriceSchema>;

/**
 * TTS 模型配置 Schema
 */
export const TTSModelsConfigSchema = z.object({
  flash: TTSModelPriceSchema.optional(),
  instructFlash: TTSModelPriceSchema.optional(),
});

export type TTSModelsConfigDto = z.infer<typeof TTSModelsConfigSchema>;

/**
 * TTS API 配置 Schema
 */
export const TTSApiConfigSchema = z.object({
  apiKey: z.string().min(1, "API Key 不能为空"),
  baseUrl: z.string().url("Base URL 格式不正确").optional(),
  enabled: z.boolean().default(true),
  models: TTSModelsConfigSchema.optional(),
});

export type TTSApiConfigDto = z.infer<typeof TTSApiConfigSchema>;

/**
 * 更新 TTS API 配置 Schema
 */
export const UpdateTTSApiConfigSchema = z.object({
  apiKey: z.string().min(1, "API Key 不能为空").optional(),
  baseUrl: z.string().url("Base URL 格式不正确").optional(),
  enabled: z.boolean().optional(),
  models: TTSModelsConfigSchema.optional(),
});

export type UpdateTTSApiConfigDto = z.infer<typeof UpdateTTSApiConfigSchema>;

/**
 * 主体检测计费配置 Schema
 */
export const SubjectDetectionPriceSchema = z.object({
  enabled: z.boolean().default(true),
  costPerRequest: z.number().min(0, "成本不能为负数").default(0.02),
  pricePerRequest: z.number().min(0, "售价不能为负数").default(0.05),
});

export type SubjectDetectionPriceDto = z.infer<
  typeof SubjectDetectionPriceSchema
>;

/**
 * 对口型视频计费配置 Schema
 */
export const LipSyncVideoPriceSchema = z.object({
  enabled: z.boolean().default(true),
  costPerSecond: z.number().min(0, "成本不能为负数").default(0.1),
  pricePerSecond: z.number().min(0, "售价不能为负数").default(0.2),
});

export type LipSyncVideoPriceDto = z.infer<typeof LipSyncVideoPriceSchema>;

/**
 * 对口型 API 配置 Schema（完整配置）
 * 火山引擎需要 AccessKey 和 SecretKey
 */
export const LipSyncApiConfigSchema = z.object({
  accessKey: z.string().min(1, "AccessKey 不能为空"),
  secretKey: z.string().min(1, "SecretKey 不能为空"),
  baseUrl: z.string().url("Base URL 格式不正确").optional(),
  enabled: z.boolean().default(true),
  subjectDetection: SubjectDetectionPriceSchema.optional(),
  lipSync: LipSyncVideoPriceSchema.optional(),
});

export type LipSyncApiConfigDto = z.infer<typeof LipSyncApiConfigSchema>;

/**
 * 更新对口型 API 配置 Schema
 */
export const UpdateLipSyncApiConfigSchema = z.object({
  accessKey: z.string().min(1, "AccessKey 不能为空").optional(),
  secretKey: z.string().min(1, "SecretKey 不能为空").optional(),
  baseUrl: z.string().url("Base URL 格式不正确").optional(),
  enabled: z.boolean().optional(),
  subjectDetection: SubjectDetectionPriceSchema.partial().optional(),
  lipSync: LipSyncVideoPriceSchema.partial().optional(),
});

export type UpdateLipSyncApiConfigDto = z.infer<
  typeof UpdateLipSyncApiConfigSchema
>;
