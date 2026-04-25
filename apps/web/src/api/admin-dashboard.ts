import { api } from "@/utils/request";

export interface DashboardStats {
  userTotal: number;
  userTodayNew: number;
  userYesterdayNew: number;
  revenueTotal: number;
  revenueToday: number;
  revenueYesterday: number;
  modelTotal: number;
}

export const adminDashboardApi = {
  /**
   * 获取仪表盘统计数据
   */
  async getStats(): Promise<DashboardStats> {
    return (await api.get("/admin/dashboard/stats")) as DashboardStats;
  },
};
