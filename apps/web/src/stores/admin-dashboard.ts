import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { adminDashboardApi, type DashboardStats } from "@/api/admin-dashboard";

export const useAdminDashboardStore = defineStore("adminDashboard", () => {
  // ==================== State ====================
  const stats = ref<DashboardStats | null>(null);
  const loading = ref(false);
  const lastUpdated = ref<Date | null>(null);

  // ==================== Getters ====================
  const userChangePercent = computed(() => {
    if (!stats.value || stats.value.userYesterdayNew === 0) return 0;
    return Math.round(
      ((stats.value.userTodayNew - stats.value.userYesterdayNew) /
        stats.value.userYesterdayNew) *
        100,
    );
  });

  const revenueChangePercent = computed(() => {
    if (!stats.value || stats.value.revenueYesterday === 0) return 0;
    return Math.round(
      ((stats.value.revenueToday - stats.value.revenueYesterday) /
        stats.value.revenueYesterday) *
        100,
    );
  });

  const formattedStats = computed(() => {
    if (!stats.value) return null;
    return {
      userTotal: stats.value.userTotal,
      userTodayNew: stats.value.userTodayNew,
      userChange: userChangePercent.value,
      revenueTotal: formatCurrency(stats.value.revenueTotal),
      revenueToday: stats.value.revenueToday,
      revenueChange: revenueChangePercent.value,
      modelTotal: stats.value.modelTotal,
    };
  });

  // ==================== Actions ====================
  async function fetchStats() {
    loading.value = true;
    try {
      const data = await adminDashboardApi.getStats();
      stats.value = data;
      lastUpdated.value = new Date();
      return data;
    } finally {
      loading.value = false;
    }
  }

  function formatCurrency(amount: number): string {
    return (
      "¥" +
      amount.toLocaleString("zh-CN", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })
    );
  }

  return {
    // State
    stats,
    loading,
    lastUpdated,
    // Getters
    userChangePercent,
    revenueChangePercent,
    formattedStats,
    // Actions
    fetchStats,
  };
});
