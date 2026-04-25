import { defineStore } from "pinia";
import { ref, computed } from "vue";
import {
  systemNoticeApi,
  adminNoticeApi,
  type ClientNoticeItem,
  type AdminNoticeItem,
  type AdminNoticeDetail,
  type CreateNoticeRequest,
  type UpdateNoticeRequest,
  type NoticeStatus,
  type AdminNoticeListQuery,
} from "@/api/system-notice";

export const useSystemNoticeStore = defineStore("systemNotice", () => {
  // ==================== State ====================
  const clientNotices = ref<ClientNoticeItem[]>([]);
  const adminNotices = ref<AdminNoticeItem[]>([]);
  const currentNotice = ref<AdminNoticeDetail | null>(null);
  const total = ref(0);
  const loading = ref(false);
  const currentPage = ref(1);
  const pageSize = ref(20);

  // 筛选条件
  const filter = ref<AdminNoticeListQuery>({
    page: 1,
    pageSize: 20,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  // ==================== Getters ====================
  const topNotices = computed(() => clientNotices.value.filter((n) => n.isTop));
  const normalNotices = computed(() =>
    clientNotices.value.filter((n) => !n.isTop),
  );

  // 获取仪表盘显示的公告（最多5条）
  const dashboardNotices = computed(() => {
    const sorted = [...clientNotices.value].sort((a, b) => {
      // 高优先级置顶
      if (a.priority === "high" && b.priority !== "high") return -1;
      if (a.priority !== "high" && b.priority === "high") return 1;
      // 按时间倒序
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return sorted.slice(0, 5);
  });

  // ==================== Actions ====================

  /**
   * 获取客户端公告列表
   */
  async function fetchClientNotices(params?: { limit?: number }) {
    loading.value = true;
    try {
      const res = await systemNoticeApi.getNotices(params);
      clientNotices.value = res.items;
      return res;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 获取管理端公告列表
   */
  async function fetchAdminNotices(params?: AdminNoticeListQuery) {
    loading.value = true;
    try {
      const query = { ...filter.value, ...params };
      const res = await adminNoticeApi.getAdminNotices(query);
      adminNotices.value = res.items;
      total.value = res.total;
      currentPage.value = res.page;
      pageSize.value = res.pageSize;
      return res;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 获取公告详情
   */
  async function fetchNoticeDetail(id: string) {
    loading.value = true;
    try {
      const res = await adminNoticeApi.getAdminNoticeDetail(id);
      currentNotice.value = res;
      return res;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 创建公告
   */
  async function createNotice(data: CreateNoticeRequest) {
    const res = await adminNoticeApi.createNotice(data);
    return res;
  }

  /**
   * 更新公告
   */
  async function updateNotice(id: string, data: UpdateNoticeRequest) {
    const res = await adminNoticeApi.updateNotice(id, data);
    return res;
  }

  /**
   * 删除公告
   */
  async function deleteNotice(id: string) {
    await adminNoticeApi.deleteNotice(id);
    // 从列表中移除
    adminNotices.value = adminNotices.value.filter((n) => n.id !== id);
  }

  /**
   * 更新公告状态
   */
  async function updateNoticeStatus(id: string, status: NoticeStatus) {
    const res = await adminNoticeApi.updateNoticeStatus(id, { status });
    // 更新本地状态
    const notice = adminNotices.value.find((n) => n.id === id);
    if (notice) {
      notice.status = status;
      notice.updatedAt = res.updatedAt;
    }
    return res;
  }

  /**
   * 设置筛选条件
   */
  function setFilter(newFilter: Partial<AdminNoticeListQuery>) {
    filter.value = { ...filter.value, ...newFilter };
  }

  /**
   * 重置筛选条件
   */
  function resetFilter() {
    filter.value = {
      page: 1,
      pageSize: 20,
      sortBy: "createdAt",
      sortOrder: "desc",
    };
  }

  /**
   * 清空当前公告
   */
  function clearCurrentNotice() {
    currentNotice.value = null;
  }

  return {
    // State
    clientNotices,
    adminNotices,
    currentNotice,
    total,
    loading,
    currentPage,
    pageSize,
    filter,
    // Getters
    topNotices,
    normalNotices,
    dashboardNotices,
    // Actions
    fetchClientNotices,
    fetchAdminNotices,
    fetchNoticeDetail,
    createNotice,
    updateNotice,
    deleteNotice,
    updateNoticeStatus,
    setFilter,
    resetFilter,
    clearCurrentNotice,
  };
});
