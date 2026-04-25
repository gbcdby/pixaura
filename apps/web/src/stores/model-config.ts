import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { modelConfigApi } from "@/api/model-config";
import type {
  ProviderListItemDto,
  AdminModelListItemDto,
  UserModelListItemDto,
  UserModelDetailDto,
  ProviderHealthStatusDto,
  CreateProviderDto,
  UpdateProviderDto,
  CreateModelDto,
  UpdateModelDto,
  SetModelProviderDto,
  FunctionCategory,
} from "@/types/model-config";

export const useModelConfigStore = defineStore("modelConfig", () => {
  // ==================== State ====================
  const loading = ref(false);
  const providers = ref<ProviderListItemDto[]>([]);
  const models = ref<AdminModelListItemDto[]>([]);
  const userModels = ref<
    { category: string; categoryName: string; models: UserModelListItemDto[] }[]
  >([]);
  const healthStatus = ref<ProviderHealthStatusDto[]>([]);

  // ==================== Getters ====================
  const enabledProviders = computed(() =>
    providers.value.filter((p) => p.status === "enabled"),
  );
  const enabledModels = computed(() =>
    models.value.filter((m) => m.status === "enabled"),
  );

  const modelsByCategory = computed(() => {
    const grouped = new Map<FunctionCategory, AdminModelListItemDto[]>();
    models.value.forEach((model) => {
      if (!grouped.has(model.category)) {
        grouped.set(model.category, []);
      }
      grouped.get(model.category)!.push(model);
    });
    return grouped;
  });

  const healthyProviders = computed(() =>
    healthStatus.value.filter((h) => h.healthStatus === "healthy"),
  );

  const unhealthyProviders = computed(() =>
    healthStatus.value.filter((h) => h.healthStatus === "unhealthy"),
  );

  // ==================== Actions - 用户端 ====================

  // 获取模型列表（用户端）
  async function fetchUserModels() {
    loading.value = true;
    try {
      const data = await modelConfigApi.getModels();
      userModels.value = data;
      return data;
    } finally {
      loading.value = false;
    }
  }

  // 获取模型详情
  async function fetchModelDetail(
    modelId: string,
  ): Promise<UserModelDetailDto> {
    loading.value = true;
    try {
      return await modelConfigApi.getModelDetail(modelId);
    } finally {
      loading.value = false;
    }
  }

  // ==================== Actions - 供应商管理 ====================

  // 获取供应商列表
  async function fetchProviders() {
    loading.value = true;
    try {
      const data = await modelConfigApi.getProviders();
      providers.value = data;
      return data;
    } finally {
      loading.value = false;
    }
  }

  // 创建供应商
  async function createProvider(data: CreateProviderDto) {
    loading.value = true;
    try {
      await modelConfigApi.createProvider(data);
      await fetchProviders();
    } finally {
      loading.value = false;
    }
  }

  // 更新供应商
  async function updateProvider(providerId: string, data: UpdateProviderDto) {
    loading.value = true;
    try {
      await modelConfigApi.updateProvider(providerId, data);
      await fetchProviders();
    } finally {
      loading.value = false;
    }
  }

  // 删除供应商
  async function deleteProvider(providerId: string) {
    loading.value = true;
    try {
      await modelConfigApi.deleteProvider(providerId);
      await fetchProviders();
    } finally {
      loading.value = false;
    }
  }

  // ==================== Actions - 模型管理 ====================

  // 获取模型列表
  async function fetchModels() {
    loading.value = true;
    try {
      const data = await modelConfigApi.getAdminModels();
      models.value = data;
      return data;
    } finally {
      loading.value = false;
    }
  }

  // 创建模型
  async function createModel(data: CreateModelDto) {
    loading.value = true;
    try {
      await modelConfigApi.createModel(data);
      await fetchModels();
    } finally {
      loading.value = false;
    }
  }

  // 更新模型
  async function updateModel(modelId: string, data: UpdateModelDto) {
    loading.value = true;
    try {
      await modelConfigApi.updateModel(modelId, data);
      await fetchModels();
    } finally {
      loading.value = false;
    }
  }

  // 删除模型
  async function deleteModel(modelId: string) {
    loading.value = true;
    try {
      await modelConfigApi.deleteModel(modelId);
      await fetchModels();
    } finally {
      loading.value = false;
    }
  }

  // 设置模型供应商
  async function setModelProvider(modelId: string, data: SetModelProviderDto) {
    loading.value = true;
    try {
      await modelConfigApi.setModelProvider(modelId, data);
      await fetchModels();
    } finally {
      loading.value = false;
    }
  }

  // ==================== Actions - 健康检查 ====================

  // 获取健康状态
  async function fetchHealthStatus() {
    loading.value = true;
    try {
      const data = await modelConfigApi.getHealthStatus();
      healthStatus.value = data;
      return data;
    } finally {
      loading.value = false;
    }
  }

  // 手动触发健康检查（可选指定 providerId）
  async function triggerHealthCheck(providerId?: string) {
    loading.value = true;
    try {
      const data = await modelConfigApi.triggerHealthCheck(providerId);
      healthStatus.value = data as ProviderHealthStatusDto[];
      return data;
    } finally {
      loading.value = false;
    }
  }

  // 从供应商获取远程模型列表
  async function fetchRemoteModels(providerId: string) {
    loading.value = true;
    try {
      const data = await modelConfigApi.fetchRemoteModels(providerId);
      return data;
    } finally {
      loading.value = false;
    }
  }

  return {
    // State
    loading,
    providers,
    models,
    userModels,
    healthStatus,
    // Getters
    enabledProviders,
    enabledModels,
    modelsByCategory,
    healthyProviders,
    unhealthyProviders,
    // Actions
    fetchUserModels,
    fetchModelDetail,
    fetchProviders,
    createProvider,
    updateProvider,
    deleteProvider,
    fetchModels,
    createModel,
    updateModel,
    deleteModel,
    setModelProvider,
    fetchHealthStatus,
    triggerHealthCheck,
    fetchRemoteModels,
  };
});
