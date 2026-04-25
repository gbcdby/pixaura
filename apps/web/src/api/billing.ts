import { api } from "@/utils/request";
import type {
  UserQuota,
  QuotaRecord,
  BalanceRecord,
  RechargeOrder,
  Subscription,
  CreateRechargeOrderDto,
  CreateSubscriptionDto,
  CreateSubscriptionResult,
  PaginatedData,
  QuotaConfig,
  RechargePromotion,
  AdjustBalanceDto,
  GrantSubscriptionDto,
  AvailableTier,
  PricingItem,
  PricingHistoryItem,
  PendingQuota,
} from "@/types/billing";

// 用户端接口
export const billingApi = {
  // 获取用户额度信息
  getQuota(): Promise<UserQuota> {
    return api.get("/billing/quota");
  },

  // 获取预扣额度
  getPendingQuota(): Promise<PendingQuota> {
    return api.get("/billing/quota/pending");
  },

  // 获取额度使用历史
  getQuotaHistory(params?: {
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedData<QuotaRecord>> {
    return api.get("/billing/quota/history", { params });
  },

  // 获取余额和流水
  getBalance(params?: { page?: number; pageSize?: number }): Promise<{
    balance: { amount: number; currency: string };
    records: PaginatedData<BalanceRecord>;
  }> {
    return api.get("/billing/balance", { params });
  },

  // 创建充值订单
  createRechargeOrder(data: CreateRechargeOrderDto): Promise<{
    orderId: string;
    amount: number;
    credits: number;
    paymentStatus: string;
    paymentParams: Record<string, unknown>;
    expiresAt: string;
  }> {
    return api.post("/billing/recharge", data);
  },

  // 查询充值订单
  getRechargeOrder(orderId: string): Promise<RechargeOrder> {
    return api.get(`/billing/recharge/${orderId}`);
  },

  // 获取当前订阅
  getSubscription(): Promise<{
    subscription: Subscription | null;
    availableTiers: AvailableTier[];
  }> {
    return api.get("/billing/subscription");
  },

  // 创建或升级订阅
  createSubscription(
    data: CreateSubscriptionDto,
  ): Promise<CreateSubscriptionResult> {
    return api.post("/billing/subscription", data);
  },

  // 获取充值活动列表
  getPromotions(): Promise<RechargePromotion[]> {
    return api.get("/billing/promotions");
  },

  // 取消订阅自动续费
  cancelSubscription(): Promise<{
    message: string;
    subscription: Subscription;
  }> {
    return api.delete("/billing/subscription");
  },
};

// 管理端接口
export const adminBillingApi = {
  // 获取额度配置列表
  getQuotaConfigs(tier?: string): Promise<QuotaConfig[]> {
    return api.get("/admin/billing/quota-config", { params: { tier } });
  },

  // 更新额度配置
  updateQuotaConfig(
    configId: string,
    data: Partial<QuotaConfig>,
  ): Promise<QuotaConfig> {
    return api.put(`/admin/billing/quota-config/${configId}`, data);
  },

  // 创建类别额度配置
  createCategoryQuotaConfig(data: {
    tier: string;
    targetId: string;
    smallCycleQuota: number;
    largeCycleQuota: number;
    isActive?: boolean;
  }): Promise<{ smallCycle: QuotaConfig; largeCycle: QuotaConfig }> {
    return api.post("/admin/billing/quota-config/category", data);
  },

  // 刷新所有用户额度
  refreshAllQuotas(): Promise<{ message: string }> {
    return api.post("/admin/billing/quota/refresh-all");
  },

  // 获取订阅列表
  getSubscriptions(params?: {
    userId?: string;
    username?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedData<Subscription>> {
    return api.get("/admin/billing/subscriptions", { params });
  },

  // 调整用户余额
  adjustBalance(data: AdjustBalanceDto): Promise<{
    userId: string;
    beforeBalance: number;
    afterBalance: number;
    adjustAmount: number;
    reason: string;
  }> {
    return api.post("/admin/billing/balance/adjust", data);
  },

  // 手动赋予用户订阅
  grantSubscription(
    data: GrantSubscriptionDto,
  ): Promise<{ subscription: Subscription; message: string }> {
    return api.post("/admin/billing/subscription/grant", data);
  },

  // 获取充值活动列表
  getPromotions(): Promise<RechargePromotion[]> {
    return api.get("/admin/billing/promotions");
  },

  // 创建充值活动
  createPromotion(
    data: Omit<RechargePromotion, "id" | "createdAt" | "updatedAt">,
  ): Promise<RechargePromotion> {
    return api.post("/admin/billing/promotions", data);
  },

  // 更新充值活动
  updatePromotion(
    promotionId: string,
    data: Partial<RechargePromotion>,
  ): Promise<RechargePromotion> {
    return api.put(`/admin/billing/promotions/${promotionId}`, data);
  },

  // 获取用户余额流水
  getBalanceRecords(params: {
    userId: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedData<BalanceRecord>> {
    return api.get("/admin/billing/balance/records", { params });
  },

  // 查询所有充值记录
  getAllRechargeRecords(params?: {
    userId?: string;
    username?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedData<RechargeOrder>> {
    return api.get("/admin/billing/transactions/recharge", { params });
  },

  // 查询所有消费记录
  getAllConsumptionRecords(params?: {
    userId?: string;
    username?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedData<BalanceRecord>> {
    return api.get("/admin/billing/transactions/consumption", { params });
  },

  // ==================== 价格配置管理 ====================
  // 获取当前价格配置
  getPricingConfig(): Promise<{
    pricings: PricingItem[];
  }> {
    return api.get("/admin/billing/pricing-config");
  },

  // 更新价格配置
  updatePricingConfig(params: {
    tier: "basic" | "pro";
    period: "monthly" | "yearly";
    price: number;
    reason?: string;
  }): Promise<PricingItem> {
    return api.put("/admin/billing/pricing-config", params);
  },

  // 获取价格变更历史
  getPricingHistory(params?: {
    tier?: string;
    period?: string;
    operator_id?: string;
    start_date?: string;
    end_date?: string;
    page?: number;
    page_size?: number;
  }): Promise<{
    total: number;
    page: number;
    page_size: number;
    items: PricingHistoryItem[];
  }> {
    return api.get("/admin/billing/pricing-history", { params });
  },
};
