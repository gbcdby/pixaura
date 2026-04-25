import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { billingApi, adminBillingApi } from "@/api/billing";
import type {
  UserQuota,
  QuotaRecord,
  BalanceRecord,
  RechargeOrder,
  Subscription,
  CreateRechargeOrderDto,
  CreateSubscriptionDto,
  QuotaConfig,
  RechargePromotion,
  PaginatedData,
  AvailableTier,
  PricingItem,
  PricingHistoryItem,
  PendingQuota,
} from "@/types/billing";

// 用户端 Store
export const useBillingStore = defineStore("billing", () => {
  // State
  const quota = ref<UserQuota | null>(null);
  const isAdminUser = ref(false);
  const quotaHistory = ref<PaginatedData<QuotaRecord> | null>(null);
  const balanceRecords = ref<PaginatedData<BalanceRecord> | null>(null);
  const subscription = ref<Subscription | null>(null);
  const availableTiers = ref<AvailableTier[]>([]);
  const currentOrder = ref<RechargeOrder | null>(null);
  const loading = ref(false);
  const pendingQuota = ref<PendingQuota | null>(null);

  // Getters
  const balance = computed(() => quota.value?.balance.amount || 0);
  const hasSubscription = computed(
    () => subscription.value?.status === "active",
  );
  const subscriptionTier = computed(() => subscription.value?.tier || "free");
  const isAdmin = computed(() => isAdminUser.value);

  // 获取额度信息
  async function fetchQuota() {
    loading.value = true;
    try {
      const data = await billingApi.getQuota();
      quota.value = data;
      // 从 API 响应中提取 isAdmin 标志（API 返回扩展字段）
      const quotaData = data as unknown as Record<string, unknown>;
      isAdminUser.value = (quotaData.isAdmin as boolean) || false;
      return data;
    } finally {
      loading.value = false;
    }
  }

  // 获取预扣额度
  async function fetchPendingQuota() {
    loading.value = true;
    try {
      const data = await billingApi.getPendingQuota();
      pendingQuota.value = data;
      return data;
    } finally {
      loading.value = false;
    }
  }

  // 获取额度历史
  async function fetchQuotaHistory(params?: {
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }) {
    loading.value = true;
    try {
      const data = await billingApi.getQuotaHistory(params);
      quotaHistory.value = data;
      return data;
    } finally {
      loading.value = false;
    }
  }

  // 获取余额记录
  async function fetchBalanceRecords(params?: {
    page?: number;
    pageSize?: number;
  }) {
    loading.value = true;
    try {
      const data = await billingApi.getBalance(params);
      balanceRecords.value = data.records;
      if (quota.value) {
        quota.value.balance = data.balance;
      }
      return data;
    } finally {
      loading.value = false;
    }
  }

  // 获取订阅信息
  async function fetchSubscription() {
    loading.value = true;
    try {
      const data = await billingApi.getSubscription();
      subscription.value = data.subscription;
      availableTiers.value = data.availableTiers;
      return data;
    } finally {
      loading.value = false;
    }
  }

  // 创建充值订单
  async function createRechargeOrder(data: CreateRechargeOrderDto) {
    loading.value = true;
    try {
      const result = await billingApi.createRechargeOrder(data);
      return result;
    } finally {
      loading.value = false;
    }
  }

  // 查询充值订单
  async function fetchRechargeOrder(orderId: string) {
    loading.value = true;
    try {
      const data = await billingApi.getRechargeOrder(orderId);
      currentOrder.value = data;
      return data;
    } finally {
      loading.value = false;
    }
  }

  // 创建订阅
  async function createSubscription(data: CreateSubscriptionDto) {
    loading.value = true;
    try {
      const result = await billingApi.createSubscription(data);
      subscription.value = result.subscription;
      return result;
    } finally {
      loading.value = false;
    }
  }

  // 取消订阅
  async function cancelSubscription() {
    loading.value = true;
    try {
      const result = await billingApi.cancelSubscription();
      subscription.value = result.subscription;
      return result;
    } finally {
      loading.value = false;
    }
  }

  return {
    // State
    quota,
    isAdminUser,
    quotaHistory,
    balanceRecords,
    subscription,
    availableTiers,
    currentOrder,
    loading,
    pendingQuota,
    // Getters
    balance,
    hasSubscription,
    subscriptionTier,
    isAdmin,
    // Actions
    fetchQuota,
    fetchPendingQuota,
    fetchQuotaHistory,
    fetchBalanceRecords,
    fetchSubscription,
    createRechargeOrder,
    fetchRechargeOrder,
    createSubscription,
    cancelSubscription,
  };
});

// 管理端 Store
export const useAdminBillingStore = defineStore("adminBilling", () => {
  // State
  const quotaConfigs = ref<QuotaConfig[]>([]);
  const subscriptions = ref<PaginatedData<Subscription> | null>(null);
  const promotions = ref<RechargePromotion[]>([]);
  const loading = ref(false);

  // 获取额度配置
  async function fetchQuotaConfigs(tier?: string) {
    loading.value = true;
    try {
      const data = await adminBillingApi.getQuotaConfigs(tier);
      quotaConfigs.value = data;
      return data;
    } finally {
      loading.value = false;
    }
  }

  // 更新额度配置
  async function updateQuotaConfig(
    configId: string,
    data: Partial<QuotaConfig>,
  ) {
    loading.value = true;
    try {
      const result = await adminBillingApi.updateQuotaConfig(configId, data);
      const index = quotaConfigs.value.findIndex((c) => c.id === configId);
      if (index !== -1) {
        quotaConfigs.value[index] = result;
      }
      return result;
    } finally {
      loading.value = false;
    }
  }

  // 创建类别额度配置
  async function createCategoryQuotaConfig(data: {
    tier: string;
    targetId: string;
    smallCycleQuota: number;
    largeCycleQuota: number;
    isActive?: boolean;
  }) {
    loading.value = true;
    try {
      const result = await adminBillingApi.createCategoryQuotaConfig(data);
      quotaConfigs.value.push(result.smallCycle, result.largeCycle);
      return result;
    } finally {
      loading.value = false;
    }
  }

  // 刷新所有额度
  async function refreshAllQuotas() {
    loading.value = true;
    try {
      const result = await adminBillingApi.refreshAllQuotas();
      return result;
    } finally {
      loading.value = false;
    }
  }

  // 获取订阅列表
  async function fetchSubscriptions(params?: {
    userId?: string;
    username?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }) {
    loading.value = true;
    try {
      const data = await adminBillingApi.getSubscriptions(params);
      subscriptions.value = data;
      return data;
    } finally {
      loading.value = false;
    }
  }

  // 调整余额
  async function adjustBalance(data: {
    userId: string;
    amount: number;
    reason: string;
    description?: string;
  }) {
    loading.value = true;
    try {
      const result = await adminBillingApi.adjustBalance(data);
      return result;
    } finally {
      loading.value = false;
    }
  }

  // 赋予订阅
  async function grantSubscription(data: {
    userId: string;
    tier: "basic" | "pro";
    period: "monthly" | "yearly";
    durationDays: number;
    reason: string;
    description?: string;
  }) {
    loading.value = true;
    try {
      const result = await adminBillingApi.grantSubscription(data);
      return result;
    } finally {
      loading.value = false;
    }
  }

  // 获取充值活动
  async function fetchPromotions() {
    loading.value = true;
    try {
      const data = await adminBillingApi.getPromotions();
      promotions.value = data;
      return data;
    } finally {
      loading.value = false;
    }
  }

  // 创建充值活动
  async function createPromotion(
    data: Omit<RechargePromotion, "id" | "createdAt" | "updatedAt">,
  ) {
    loading.value = true;
    try {
      const result = await adminBillingApi.createPromotion(data);
      promotions.value.push(result);
      return result;
    } finally {
      loading.value = false;
    }
  }

  // 更新充值活动
  async function updatePromotion(
    promotionId: string,
    data: Partial<RechargePromotion>,
  ) {
    loading.value = true;
    try {
      const result = await adminBillingApi.updatePromotion(promotionId, data);
      const index = promotions.value.findIndex((p) => p.id === promotionId);
      if (index !== -1) {
        promotions.value[index] = result;
      }
      return result;
    } finally {
      loading.value = false;
    }
  }

  // 获取用户余额流水
  async function fetchUserBalanceRecords(
    userId: string,
    params?: { page?: number; pageSize?: number },
  ) {
    loading.value = true;
    try {
      const data = await adminBillingApi.getBalanceRecords({
        userId,
        ...params,
      });
      return data;
    } finally {
      loading.value = false;
    }
  }

  // 查询所有充值记录
  async function fetchAllRechargeRecords(params?: {
    userId?: string;
    username?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }) {
    loading.value = true;
    try {
      const data = await adminBillingApi.getAllRechargeRecords(params);
      return data;
    } finally {
      loading.value = false;
    }
  }

  // 查询所有消费记录
  async function fetchAllConsumptionRecords(params?: {
    userId?: string;
    username?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }) {
    loading.value = true;
    try {
      const data = await adminBillingApi.getAllConsumptionRecords(params);
      return data;
    } finally {
      loading.value = false;
    }
  }

  return {
    // State
    quotaConfigs,
    subscriptions,
    promotions,
    loading,
    // Actions
    fetchQuotaConfigs,
    updateQuotaConfig,
    createCategoryQuotaConfig,
    refreshAllQuotas,
    fetchSubscriptions,
    adjustBalance,
    grantSubscription,
    fetchPromotions,
    createPromotion,
    updatePromotion,
    fetchUserBalanceRecords,
    fetchAllRechargeRecords,
    fetchAllConsumptionRecords,
  };
});

// ==================== 价格配置管理 Store ====================
// 价格配置 Store
export const usePricingConfigStore = defineStore("pricingConfig", () => {
  // State
  const pricings = ref<PricingItem[]>([]);
  const loading = ref(false);
  const updating = ref(false);

  // Getters
  const basicPricing = computed(() =>
    pricings.value.filter((p) => p.tier === "basic"),
  );
  const proPricing = computed(() =>
    pricings.value.filter((p) => p.tier === "pro"),
  );

  // Actions
  async function fetchPricingConfig() {
    loading.value = true;
    try {
      const res = await adminBillingApi.getPricingConfig();
      pricings.value = res.pricings;
      return res;
    } finally {
      loading.value = false;
    }
  }

  async function updatePricing(params: {
    tier: "basic" | "pro";
    period: "monthly" | "yearly";
    price: number;
    reason?: string;
  }) {
    updating.value = true;
    try {
      const result = await adminBillingApi.updatePricingConfig(params);
      // 刷新列表
      await fetchPricingConfig();
      return result;
    } finally {
      updating.value = false;
    }
  }

  return {
    // State
    pricings,
    loading,
    updating,
    // Getters
    basicPricing,
    proPricing,
    // Actions
    fetchPricingConfig,
    updatePricing,
  };
});

// 价格历史 Store
export const usePricingHistoryStore = defineStore("pricingHistory", () => {
  // State
  const history = ref<PricingHistoryItem[]>([]);
  const total = ref(0);
  const page = ref(1);
  const page_size = ref(20);
  const loading = ref(false);
  const filters = ref<{
    tier?: string;
    period?: string;
    operator_id?: string;
    start_date?: string;
    end_date?: string;
  }>({});

  // Actions
  async function fetchHistory() {
    loading.value = true;
    try {
      const params = {
        ...filters.value,
        page: page.value,
        page_size: page_size.value,
      };
      const res = await adminBillingApi.getPricingHistory(params);
      history.value = res.items;
      total.value = res.total;
      return res;
    } finally {
      loading.value = false;
    }
  }

  function setFilters(newFilters: Partial<typeof filters.value>) {
    filters.value = { ...filters.value, ...newFilters };
    page.value = 1; // 重置页码
    fetchHistory();
  }

  function resetFilters() {
    filters.value = {};
    page.value = 1;
    fetchHistory();
  }

  function setPage(newPage: number) {
    page.value = newPage;
    fetchHistory();
  }

  function setPageSize(newPageSize: number) {
    page_size.value = newPageSize;
    page.value = 1;
    fetchHistory();
  }

  return {
    // State
    history,
    total,
    page,
    page_size,
    loading,
    filters,
    // Actions
    fetchHistory,
    setFilters,
    resetFilters,
    setPage,
    setPageSize,
  };
});
