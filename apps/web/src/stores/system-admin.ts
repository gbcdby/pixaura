import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { adminUserApi, adminConfigApi, adminLogApi } from "@/api/admin";
import type {
  AdminUser,
  AdminUserDetail,
  BanUserDto,
  UnbanUserDto,
  SystemFullConfig,
  FileUploadConfig,
  RateLimitConfig,
  OperationLog,
  PaginatedData,
} from "@/types/admin";

// 用户管理 Store
export const useAdminUserStore = defineStore("adminUser", () => {
  // State
  const users = ref<AdminUser[]>([]);
  const total = ref(0);
  const currentUser = ref<AdminUserDetail | null>(null);
  const loading = ref(false);
  const detailLoading = ref(false);

  // 筛选条件
  const filter = ref({
    keyword: "",
    isBanned: undefined as boolean | undefined,
    page: 1,
    pageSize: 20,
  });

  // Getters
  const userList = computed(() => users.value);
  const userTotal = computed(() => total.value);
  const isLoading = computed(() => loading.value);
  const isDetailLoading = computed(() => detailLoading.value);

  // Actions
  async function fetchUsers() {
    loading.value = true;
    try {
      const result: PaginatedData<AdminUser> = await adminUserApi.getUserList({
        keyword: filter.value.keyword || undefined,
        isBanned: filter.value.isBanned,
        page: filter.value.page,
        pageSize: filter.value.pageSize,
      });
      users.value = result.items;
      total.value = result.total;
      return result;
    } finally {
      loading.value = false;
    }
  }

  async function fetchUserDetail(userId: string) {
    detailLoading.value = true;
    try {
      const result = await adminUserApi.getUserDetail(userId);
      currentUser.value = result;
      return result;
    } finally {
      detailLoading.value = false;
    }
  }

  async function banUser(userId: string, data: BanUserDto) {
    const result = await adminUserApi.banUser(userId, data);
    // 更新本地状态
    const user = users.value.find((u) => u.id === userId);
    if (user) {
      user.isBanned = true;
    }
    if (currentUser.value?.user.id === userId) {
      currentUser.value.user.isBanned = true;
    }
    return result;
  }

  async function unbanUser(userId: string, data: UnbanUserDto) {
    const result = await adminUserApi.unbanUser(userId, data);
    // 更新本地状态
    const user = users.value.find((u) => u.id === userId);
    if (user) {
      user.isBanned = false;
    }
    if (currentUser.value?.user.id === userId) {
      currentUser.value.user.isBanned = false;
    }
    return result;
  }

  function setFilter(newFilter: Partial<typeof filter.value>) {
    filter.value = { ...filter.value, ...newFilter };
  }

  function resetFilter() {
    filter.value = {
      keyword: "",
      isBanned: undefined,
      page: 1,
      pageSize: 20,
    };
  }

  function clearCurrentUser() {
    currentUser.value = null;
  }

  return {
    // State
    users,
    total,
    currentUser,
    loading,
    detailLoading,
    filter,
    // Getters
    userList,
    userTotal,
    isLoading,
    isDetailLoading,
    // Actions
    fetchUsers,
    fetchUserDetail,
    banUser,
    unbanUser,
    setFilter,
    resetFilter,
    clearCurrentUser,
  };
});

// 系统配置 Store
export const useAdminConfigStore = defineStore("adminConfig", () => {
  // State
  const config = ref<SystemFullConfig>({
    fileUpload: {
      avatar: {
        maxSize: 1,
        allowedTypes: ["jpg", "png", "webp"],
        dailyLimit: 3,
      },
      reference: {
        maxSize: 5,
        allowedTypes: ["jpg", "png", "webp"],
      },
      project: {
        maxSize: 50,
      },
    },
    rateLimit: {
      enabled: true,
      windowSeconds: 60,
      maxRequests: 100,
      banDurationSeconds: 300,
      whitelistIps: ["127.0.0.1"],
    },
  });
  const loading = ref(false);
  const saving = ref(false);

  // Getters
  const fileUploadConfig = computed(() => config.value.fileUpload);
  const rateLimitConfig = computed(() => config.value.rateLimit);
  const isLoading = computed(() => loading.value);
  const isSaving = computed(() => saving.value);

  // 辅助函数：字节转 MB
  function bytesToMB(bytes: number): number {
    return Math.round(bytes / 1024 / 1024);
  }

  // 辅助函数：MB 转字节
  function mbToBytes(mb: number): number {
    return mb * 1024 * 1024;
  }

  // Actions
  async function fetchConfig() {
    loading.value = true;
    try {
      const result = await adminConfigApi.getFullConfig();
      // 将字节转换为 MB 显示
      config.value = {
        fileUpload: {
          avatar: {
            maxSize: bytesToMB(result.fileUpload.avatar?.maxSize || 1048576),
            allowedTypes: result.fileUpload.avatar?.allowedTypes || [
              "jpg",
              "png",
              "webp",
            ],
            dailyLimit: result.fileUpload.avatar?.dailyLimit || 3,
          },
          reference: {
            maxSize: bytesToMB(result.fileUpload.reference?.maxSize || 5242880),
            allowedTypes: result.fileUpload.reference?.allowedTypes || [
              "jpg",
              "png",
              "webp",
            ],
          },
          project: {
            maxSize: bytesToMB(result.fileUpload.project?.maxSize || 52428800),
          },
        },
        rateLimit: result.rateLimit,
      };
      return result;
    } finally {
      loading.value = false;
    }
  }

  async function updateFileUploadConfig(uploadConfig: FileUploadConfig) {
    saving.value = true;
    try {
      // 将 MB 转换为字节提交
      const configToSubmit = {
        avatar: uploadConfig.avatar?.maxSize
          ? {
              maxSize: mbToBytes(uploadConfig.avatar.maxSize),
              allowedTypes: uploadConfig.avatar.allowedTypes,
              dailyLimit: uploadConfig.avatar.dailyLimit,
            }
          : undefined,
        reference: uploadConfig.reference?.maxSize
          ? {
              maxSize: mbToBytes(uploadConfig.reference.maxSize),
              allowedTypes: uploadConfig.reference.allowedTypes,
            }
          : undefined,
        project: uploadConfig.project?.maxSize
          ? {
              maxSize: mbToBytes(uploadConfig.project.maxSize),
            }
          : undefined,
      };
      const result =
        await adminConfigApi.updateFileUploadConfig(configToSubmit);
      // 更新本地状态
      if (result) {
        config.value.fileUpload = {
          avatar: {
            maxSize: bytesToMB(result.avatar?.maxSize || 1048576),
            allowedTypes: result.avatar?.allowedTypes || ["jpg", "png", "webp"],
            dailyLimit: result.avatar?.dailyLimit || 3,
          },
          reference: {
            maxSize: bytesToMB(result.reference?.maxSize || 5242880),
            allowedTypes: result.reference?.allowedTypes || [
              "jpg",
              "png",
              "webp",
            ],
          },
          project: {
            maxSize: bytesToMB(result.project?.maxSize || 52428800),
          },
        };
      }
      return result;
    } finally {
      saving.value = false;
    }
  }

  async function updateRateLimitConfig(rateLimit: RateLimitConfig) {
    saving.value = true;
    try {
      const result = await adminConfigApi.updateRateLimitConfig(rateLimit);
      // 更新本地状态
      if (result) {
        config.value.rateLimit = result;
      }
      return result;
    } finally {
      saving.value = false;
    }
  }

  // 添加 IP 白名单
  function addWhitelistIp(ip: string) {
    if (!config.value.rateLimit.whitelistIps) {
      config.value.rateLimit.whitelistIps = [];
    }
    if (!config.value.rateLimit.whitelistIps.includes(ip)) {
      config.value.rateLimit.whitelistIps.push(ip);
    }
  }

  // 移除 IP 白名单
  function removeWhitelistIp(ip: string) {
    const ips = config.value.rateLimit.whitelistIps || [];
    const index = ips.indexOf(ip);
    if (index > -1) {
      ips.splice(index, 1);
    }
  }

  return {
    // State
    config,
    loading,
    saving,
    // Getters
    fileUploadConfig,
    rateLimitConfig,
    isLoading,
    isSaving,
    // Actions
    fetchConfig,
    updateFileUploadConfig,
    updateRateLimitConfig,
    addWhitelistIp,
    removeWhitelistIp,
  };
});

// 操作日志 Store
export const useAdminLogStore = defineStore("adminLog", () => {
  // State
  const logs = ref<OperationLog[]>([]);
  const total = ref(0);
  const loading = ref(false);

  // 筛选条件
  const filter = ref({
    operationType: undefined as string | undefined,
    startDate: undefined as string | undefined,
    endDate: undefined as string | undefined,
    page: 1,
    pageSize: 20,
  });

  // Getters
  const logList = computed(() => logs.value);
  const logTotal = computed(() => total.value);
  const isLoading = computed(() => loading.value);

  // Actions
  async function fetchLogs() {
    loading.value = true;
    try {
      const params: {
        operationType?: string;
        startDate?: string;
        endDate?: string;
        page: number;
        pageSize: number;
      } = {
        page: filter.value.page,
        pageSize: filter.value.pageSize,
      };

      if (filter.value.operationType) {
        params.operationType = filter.value.operationType;
      }

      if (filter.value.startDate) {
        params.startDate = filter.value.startDate;
      }

      if (filter.value.endDate) {
        params.endDate = filter.value.endDate;
      }

      const result: PaginatedData<OperationLog> =
        await adminLogApi.getOperationLogs(params);
      logs.value = result.items;
      total.value = result.total;
      return result;
    } finally {
      loading.value = false;
    }
  }

  function setFilter(newFilter: Partial<typeof filter.value>) {
    filter.value = { ...filter.value, ...newFilter };
  }

  function resetFilter() {
    filter.value = {
      operationType: undefined,
      startDate: undefined,
      endDate: undefined,
      page: 1,
      pageSize: 20,
    };
  }

  return {
    // State
    logs,
    total,
    loading,
    filter,
    // Getters
    logList,
    logTotal,
    isLoading,
    // Actions
    fetchLogs,
    setFilter,
    resetFilter,
  };
});
