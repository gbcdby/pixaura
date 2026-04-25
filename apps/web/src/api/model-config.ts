import { api } from "@/utils/request";
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
} from "@/types/model-config";

export const modelConfigApi = {
  // ==================== 用户端接口 ====================

  // 获取模型列表（按类别分组）
  async getModels(): Promise<
    { category: string; categoryName: string; models: UserModelListItemDto[] }[]
  > {
    const res = (await api.get("/model-config/models")) as {
      categories?: {
        category: string;
        categoryName: string;
        models: UserModelListItemDto[];
      }[];
    };
    return res.categories || [];
  },

  // 获取模型详情
  getModelDetail(modelId: string): Promise<UserModelDetailDto> {
    return api.get(`/model-config/models/${modelId}`);
  },

  // 获取系统配置中的模型价格（TTS、LipSync 等）
  async getSystemPrices(): Promise<{
    tts: {
      flash: { pricePerChar: number };
      instructFlash: { pricePerChar: number };
    };
    lipSync: {
      pricePerSecond: number;
      subjectDetection: { pricePerRequest: number };
    };
  }> {
    return api.get("/model-config/system-prices");
  },

  // ==================== 管理端接口 - 供应商 ====================

  // 获取供应商列表
  async getProviders(): Promise<ProviderListItemDto[]> {
    const res = (await api.get("/admin/model-config/providers")) as {
      providers?: ProviderListItemDto[];
    };
    return res.providers || [];
  },

  // 创建供应商
  createProvider(data: CreateProviderDto): Promise<void> {
    return api.post("/admin/model-config/providers", data);
  },

  // 更新供应商
  updateProvider(providerId: string, data: UpdateProviderDto): Promise<void> {
    return api.put(`/admin/model-config/providers/${providerId}`, data);
  },

  // 删除供应商
  deleteProvider(providerId: string): Promise<void> {
    return api.delete(`/admin/model-config/providers/${providerId}`);
  },

  // ==================== 管理端接口 - 模型 ====================

  // 获取模型列表
  async getAdminModels(): Promise<AdminModelListItemDto[]> {
    const res = (await api.get("/admin/model-config/models")) as {
      models?: AdminModelListItemDto[];
    };
    return res.models || [];
  },

  // 创建模型
  createModel(data: CreateModelDto): Promise<void> {
    return api.post("/admin/model-config/models", data);
  },

  // 更新模型
  updateModel(modelId: string, data: UpdateModelDto): Promise<void> {
    return api.put(`/admin/model-config/models/${modelId}`, data);
  },

  // 删除模型
  deleteModel(modelId: string): Promise<void> {
    return api.delete(`/admin/model-config/models/${modelId}`);
  },

  // 设置模型供应商
  setModelProvider(modelId: string, data: SetModelProviderDto): Promise<void> {
    return api.post(`/admin/model-config/models/${modelId}/providers`, data);
  },

  // ==================== 管理端接口 - 健康检查 ====================

  // 获取健康状态
  async getHealthStatus(): Promise<ProviderHealthStatusDto[]> {
    const res = (await api.get("/admin/model-config/health")) as {
      status?: ProviderHealthStatusDto[];
    };
    return res.status || [];
  },

  // 手动触发健康检查（可选指定 providerId）
  triggerHealthCheck(providerId?: string): Promise<ProviderHealthStatusDto[]> {
    if (providerId) {
      return api.post("/admin/model-config/health-check", { providerId });
    }
    return api.post("/admin/model-config/health-check");
  },

  // 从供应商获取远程模型列表
  async fetchRemoteModels(providerId: string): Promise<
    Array<{
      id: string;
      name: string;
      description?: string;
    }>
  > {
    const res = (await api.get(
      `/admin/model-config/providers/${providerId}/remote-models`,
    )) as {
      models?: Array<{
        id: string;
        name: string;
        description?: string;
      }>;
    };
    return res.models || [];
  },

  // ==================== 用户默认模型配置接口 ====================

  // 获取用户默认模型配置
  async getUserDefaultModels(): Promise<Record<string, string | null>> {
    const res = (await api.get("/user/default-models")) as {
      configs?: Record<string, string | null>;
    };
    return res.configs || {};
  },

  // 更新用户默认模型配置
  async updateUserDefaultModels(
    configs: Record<string, string | null>,
  ): Promise<Record<string, string | null>> {
    const res = (await api.put("/user/default-models", { configs })) as {
      configs?: Record<string, string | null>;
    };
    return res.configs || {};
  },
};
