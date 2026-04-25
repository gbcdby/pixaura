// 订阅等级
export type SubscriptionTier = "free" | "basic" | "pro";

// 订阅周期
export type SubscriptionPeriod = "monthly" | "yearly";

// 支付方式
export type PaymentMethod = "alipay" | "wechat";

// 订阅信息
export interface Subscription {
  id: string;
  userId: string;
  username?: string;
  tier: SubscriptionTier;
  period: SubscriptionPeriod;
  status: "active" | "expired" | "cancelled";
  startedAt: string;
  expiresAt: string;
  autoRenew: boolean;
}

// 可用订阅等级信息
export interface AvailableTier {
  tier: SubscriptionTier;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
}

// 额度信息（后端返回的格式 - 新结构）
export interface QuotaInfo {
  modelId: string;
  modelName: string;
  category: string;
  categoryName: string;
  smallCycle: { total: number; used: number; remaining: number };
  largeCycle: { total: number; used: number; remaining: number };
  canUseSubscription: boolean;
}

// 功能类别额度（后端返回的格式 - 新结构）
export interface CategoryQuota {
  categoryId: string;
  categoryName: string;
  smallCycle: { total: number; used: number; remaining: number };
  largeCycle: { total: number; used: number; remaining: number };
  canUseSubscription: boolean;
}

// 额度状态
export interface QuotaStatus {
  canUseSubscription: boolean;
  message: string;
}

// 用户额度总览
export interface UserQuota {
  subscription: Subscription | null;
  quotaStatus: QuotaStatus;
  quotas: {
    models: QuotaInfo[];
    categories: CategoryQuota[];
  };
  balance: {
    amount: number;
    currency: string;
  };
}

// 额度使用记录
export interface QuotaRecord {
  id: string;
  modelId: string;
  modelName: string;
  category: string;
  count: number;
  remainingQuota: number;
  deductedFrom: "subscription" | "balance";
  createdAt: string;
}

// 余额记录
export interface BalanceRecord {
  id: string;
  changeAmount: number;
  balanceAfter: number;
  type: "recharge" | "consumption" | "refund" | "adjust";
  description: string;
  createdAt: string;
}

// 充值订单
export interface RechargeOrder {
  orderId: string;
  amount: number;
  credits: number;
  paymentStatus: "pending" | "paid" | "cancelled" | "failed" | "refunded";
  paymentMethod?: PaymentMethod;
  transactionNo?: string;
  paidAt?: string;
  createdAt: string;
  username?: string;
}

// 扩展的余额记录
export interface BalanceRecordWithUser extends BalanceRecord {
  username?: string;
}

// 创建充值订单请求
export interface CreateRechargeOrderDto {
  amount: number;
  paymentMethod: PaymentMethod;
}

// 创建订阅请求
export interface CreateSubscriptionDto {
  tier: SubscriptionTier;
  period: SubscriptionPeriod;
  paymentMethod: PaymentMethod;
  autoRenew?: boolean;
}

// 订阅创建结果
export interface CreateSubscriptionResult {
  subscription: Subscription;
  amount: number;
  isUpgrade: boolean;
  paymentParams?: Record<string, unknown>;
}

// 充值活动
export interface RechargePromotion {
  id: string;
  name: string;
  description?: string;
  minAmount: number;
  bonusType: "percent" | "fixed";
  bonusValue: number;
  maxBonus?: number;
  isActive: boolean;
  startAt?: string;
  endAt?: string;
}

// 额度配置
export interface QuotaConfig {
  id: string;
  tier: SubscriptionTier;
  cycleType: "small" | "large";
  targetType: "model" | "category";
  targetId: string;
  targetName: string;
  quotaValue: number;
  isActive: boolean;
}

// 管理员调整余额请求
export interface AdjustBalanceDto {
  userId?: string;
  username?: string;
  amount: number;
  reason: string;
  description?: string;
}

// 管理员赋予订阅请求
export interface GrantSubscriptionDto {
  userId?: string;
  username?: string;
  tier: SubscriptionTier;
  period: SubscriptionPeriod;
  durationDays: number;
  reason: string;
  description?: string;
}

// 分页数据
export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// 预扣额度类别
export interface PendingQuotaCategory {
  category: string;
  categoryName: string;
  pendingTokens: number;
  pendingCount: number;
}

// 预扣额度总览
export interface PendingQuota {
  categories: PendingQuotaCategory[];
  totalCount: number;
  totalTokens: number;
}

// ==================== 价格配置管理类型 ====================
// 价格配置项
export interface PricingItem {
  id: string;
  tier: "basic" | "pro";
  tier_name: string;
  period: "monthly" | "yearly";
  period_name: string;
  price: number;
  original_price: number | null;
  is_active: boolean;
  updated_at: string;
  updated_by: string;
  updater_name: string;
}

// 价格变更历史记录
export interface PricingHistoryItem {
  id: string;
  pricingId: string;
  tier: string;
  tierName: string;
  period: string;
  periodName: string;
  oldPrice: number;
  newPrice: number;
  priceChange: number;
  priceChangePercent: number;
  operatorId: string;
  operatorName: string;
  changeReason: string | null;
  changedAt: string;
}
