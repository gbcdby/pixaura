import { z } from "zod";
import type { FunctionCategory } from "./model-config";
import type { SubscriptionTier } from "./permissions";

// Re-export for convenience
export { FunctionCategory } from "./model-config";
export { SubscriptionTier } from "./permissions";

// ==================== Enums ====================

export enum SubscriptionPeriod {
  MONTHLY = "monthly",
  YEARLY = "yearly",
}

export enum SubscriptionStatus {
  ACTIVE = "active",
  EXPIRED = "expired",
  CANCELLED = "cancelled",
}

export enum QuotaTargetType {
  MODEL = "model",
  CATEGORY = "category",
}

export enum QuotaCycleType {
  SMALL = "small",
  LARGE = "large",
}

export enum QuotaType {
  SMALL = "small",
  LARGE = "large",
}

export enum QuotaReason {
  GENERATION = "generation",
  EXPIRED = "expired",
  REFUND = "refund",
}

export enum PaymentMethod {
  ALIPAY = "alipay",
  WECHAT = "wechat",
}

export enum PaymentStatus {
  PENDING = "pending",
  PAID = "paid",
  FAILED = "failed",
  REFUNDED = "refunded",
}

export enum BalanceRecordType {
  RECHARGE = "recharge",
  CONSUMPTION = "consumption",
  REFUND = "refund",
}

export enum BonusType {
  PERCENT = "percent",
  FIXED = "fixed",
}

// ==================== Zod Schemas ====================

export const SubscriptionTierSchema = z.enum(["free", "basic", "pro"]);
export const SubscriptionPeriodSchema = z.enum(["monthly", "yearly"]);
export const SubscriptionStatusSchema = z.enum([
  "active",
  "expired",
  "cancelled",
]);
export const PaymentMethodSchema = z.enum(["alipay", "wechat"]);
export const PaymentStatusSchema = z.enum([
  "pending",
  "paid",
  "failed",
  "refunded",
]);

// FunctionCategory schema (for billing system)
// Note: LIP_SYNC is included here for billing purposes, but not in model-config's FunctionCategory
export const FunctionCategorySchema = z.enum([
  "TEXT_GENERATION",
  "IMAGE_GENERATION",
  "VIDEO_GENERATION",
  "AUDIO_GENERATION",
  "VOICE_GENERATION",
  "LIP_SYNC", // 对口型计费类别（独立于模型配置系统）
]);

// 创建充值订单
export const CreateRechargeOrderSchema = z.object({
  amount: z.number().min(10, "充值金额至少10元"),
  paymentMethod: PaymentMethodSchema,
});

// 创建/升级订阅
export const CreateSubscriptionSchema = z.object({
  tier: SubscriptionTierSchema,
  period: SubscriptionPeriodSchema,
  paymentMethod: PaymentMethodSchema,
  autoRenew: z.boolean().default(true),
});

// 支付回调
export const PaymentCallbackSchema = z.object({
  orderId: z.string().uuid(),
  transactionNo: z.string().min(1, "交易号不能为空"),
  tradeStatus: z.enum(["SUCCESS", "TRADE_SUCCESS"]).optional(),
});

// 额度检查请求（内部接口）
export const CheckQuotaSchema = z.object({
  userId: z.string().uuid(),
  modelId: z.string().optional(), // 可选：类别配额时不需要模型ID
  category: FunctionCategorySchema,
  count: z.number().int().positive().default(1),
  duration: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("视频时长（秒），按秒计费时使用"),
});

// 额度扣减请求（内部接口）
export const DeductQuotaSchema = z.object({
  userId: z.string().uuid(),
  modelId: z.string().optional(), // 可选：类别配额时不需要模型ID
  category: FunctionCategorySchema,
  count: z.number().int().positive().default(1),
  referenceId: z.string().uuid(),
  idempotencyKey: z.string(),
  duration: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("视频时长（秒），按秒计费时使用"),
});

// 调整余额（管理员）
export const AdjustBalanceSchema = z
  .object({
    userId: z.union([z.string().uuid(), z.literal(""), z.undefined()]),
    username: z.string().min(1).optional(),
    amount: z.number(),
    reason: z.string().min(1, "请输入调整原因"),
    description: z.string().optional(),
    operatorId: z.string().uuid().optional(),
  })
  .refine((data) => data.userId || data.username, {
    message: "用户ID或用户名至少填写一个",
    path: ["userId"],
  });

// 手动赋予订阅（管理员）
export const GrantSubscriptionSchema = z
  .object({
    userId: z.union([z.string().uuid(), z.literal(""), z.undefined()]),
    username: z.string().min(1).optional(),
    tier: SubscriptionTierSchema,
    period: SubscriptionPeriodSchema,
    durationDays: z.number().int().positive(),
    reason: z.string().min(1, "请输入赋予原因"),
    description: z.string().optional(),
    grantedBy: z.string().uuid().optional(),
  })
  .refine((data) => data.userId || data.username, {
    message: "用户ID或用户名至少填写一个",
    path: ["userId"],
  });

// 更新额度配置（管理员）
export const UpdateQuotaConfigSchema = z.object({
  quotaValue: z.number().int(),
  isActive: z.boolean(),
});

// 创建类别额度配置（管理员）
export const CreateCategoryQuotaConfigSchema = z.object({
  tier: SubscriptionTierSchema,
  targetId: z.string().min(1, "请选择类别"),
  smallCycleQuota: z.number().int().min(0, "小周期额度不能为负数"),
  largeCycleQuota: z.number().int().min(0, "大周期额度不能为负数"),
  isActive: z.boolean().default(true),
});

// 创建充值活动（管理员）
export const CreatePromotionSchema = z.object({
  name: z.string().min(1, "请输入活动名称"),
  description: z.string().optional(),
  minAmount: z.number().min(0, "最低金额不能为负数"),
  bonusType: z.enum(["percent", "fixed"]),
  bonusValue: z.number().min(0, "赠送值不能为负数"),
  maxBonus: z.number().optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  isActive: z.boolean().default(true),
});

// 更新价格配置（管理员）
export const UpdatePricingConfigSchema = z.object({
  tier: z.enum(["basic", "pro"], {
    errorMap: () => ({ message: "订阅等级不合法，必须是 basic 或 pro" }),
  }),
  period: z.enum(["monthly", "yearly"], {
    errorMap: () => ({ message: "周期类型不合法，必须是 monthly 或 yearly" }),
  }),
  price: z.number().min(0, "价格不能为负数"),
  reason: z.string().optional(),
});

// ==================== DTO Types ====================

export type CreateRechargeOrderDto = z.infer<typeof CreateRechargeOrderSchema>;
export type CreateSubscriptionDto = z.infer<typeof CreateSubscriptionSchema>;
export type PaymentCallbackDto = z.infer<typeof PaymentCallbackSchema>;
export type CheckQuotaDto = z.infer<typeof CheckQuotaSchema>;
export type DeductQuotaDto = z.infer<typeof DeductQuotaSchema>;

// AdjustBalance 和 GrantSubscription 需要显式类型定义（因为使用了 .refine()）
export interface AdjustBalanceDto {
  userId?: string;
  username?: string;
  amount: number;
  reason: string;
  description?: string;
  operatorId?: string;
}

export interface GrantSubscriptionDto {
  userId?: string;
  username?: string;
  tier: "free" | "basic" | "pro";
  period: "monthly" | "yearly";
  durationDays: number;
  reason: string;
  description?: string;
  grantedBy?: string;
}
export type UpdateQuotaConfigDto = z.infer<typeof UpdateQuotaConfigSchema>;
export type CreateCategoryQuotaConfigDto = z.infer<
  typeof CreateCategoryQuotaConfigSchema
>;
export type CreatePromotionDto = z.infer<typeof CreatePromotionSchema>;
export type UpdatePricingConfigDto = z.infer<typeof UpdatePricingConfigSchema>;

// ==================== Entity Interfaces ====================

export interface Subscription {
  id: string;
  userId: string;
  tier: SubscriptionTier;
  period: SubscriptionPeriod;
  status: SubscriptionStatus;
  startedAt: Date;
  expiresAt: Date;
  autoRenew: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuotaConfig {
  id: string;
  tier: SubscriptionTier;
  cycleType: QuotaCycleType;
  targetType: QuotaTargetType;
  targetId: string;
  quotaValue: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuotaUsage {
  id: string;
  userId: string;
  quotaType: QuotaType;
  targetType: string;
  targetId: string;
  cycleNumber: number;
  amount: number;
  balanceAfter: number;
  reason: QuotaReason;
  referenceId: string | null;
  createdAt: Date;
}

export interface RechargeOrder {
  id: string;
  userId: string;
  amount: number;
  credits: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  transactionNo: string | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BalanceRecord {
  id: string;
  userId: string;
  changeAmount: number;
  balanceAfter: number;
  type: BalanceRecordType;
  referenceId: string | null;
  description: string | null;
  createdAt: Date;
}

export interface RechargePromotion {
  id: string;
  name: string;
  minAmount: number;
  bonusType: BonusType;
  bonusValue: number;
  maxBonus: number | null;
  isActive: boolean;
  startAt: Date | null;
  endAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== Response Types ====================

export interface QuotaInfo {
  total: number;
  used: number;
  remaining: number;
}

export interface ModelQuota {
  modelId: string;
  modelName: string;
  smallCycle: QuotaInfo;
  largeCycle: QuotaInfo;
  canUseSubscription: boolean;
}

export interface CategoryQuota {
  category: FunctionCategory;
  categoryName: string;
  smallCycle: QuotaInfo;
  largeCycle: QuotaInfo;
  canUseSubscription: boolean;
}

export interface SubscriptionInfo {
  tier: SubscriptionTier;
  period: SubscriptionPeriod;
  status: SubscriptionStatus;
  startedAt: Date;
  expiresAt: Date;
  smallCycleEndAt: Date;
  largeCycleEndAt: Date;
}

export interface QuotaStatus {
  canUseSubscription: boolean;
  message: string;
}

export interface GetQuotaResponse {
  subscription: SubscriptionInfo | null;
  quotaStatus: QuotaStatus;
  quotas: {
    models: ModelQuota[];
    categories: CategoryQuota[];
  };
  balance: {
    amount: number;
    currency: string;
  };
}

export interface QuotaCheckResult {
  canExecute: boolean;
  deductFrom: "subscription" | "balance" | null;
  estimatedCost: number;
  quotaCheck: {
    modelSmallCycle: { required: number; available: number; passed: boolean };
    modelLargeCycle: { required: number; available: number; passed: boolean };
    categorySmallCycle: {
      required: number;
      available: number;
      passed: boolean;
    };
    categoryLargeCycle: {
      required: number;
      available: number;
      passed: boolean;
    };
  };
  reason?: string;
  message?: string;
  remainingBalance: number;
}

export interface QuotaDeductResult {
  deductedFrom: "subscription" | "balance" | null; // null 表示管理员豁免
  amount: number;
  deductedQuota?: {
    modelSmallCycle: { before: number; deducted: number; after: number };
    modelLargeCycle: { before: number; deducted: number; after: number };
    categorySmallCycle: { before: number; deducted: number; after: number };
    categoryLargeCycle: { before: number; deducted: number; after: number };
  };
  remainingBalance: number;
}

// ==================== 消费流水类型 ====================

export interface ConsumptionRecord {
  id: string;
  consumptionType: "subscription" | "balance";
  source: "model" | "category" | "balance";
  sourceId: string | null;
  sourceName: string | null; // 模型名或类别名
  quantity: number | null; // 订阅扣减次数
  costCny: number; // 余额扣减金额（元）
  referenceId: string | null;
  createdAt: Date;
}

export interface ConsumptionSummary {
  period: { startDate: Date; endDate: Date };
  totalConsumption: number; // 总消费金额（元）
  subscriptionUsage: number; // 订阅额度使用次数
  balanceUsage: number; // 余额使用金额
  byCategory: {
    category: FunctionCategory;
    count: number;
    costCny: number;
  }[];
}

// 消费流水查询参数
export interface ConsumptionQueryParams {
  startDate?: Date;
  endDate?: Date;
  type?: "subscription" | "balance" | "all";
  category?: FunctionCategory;
  page?: number;
  pageSize?: number;
}
