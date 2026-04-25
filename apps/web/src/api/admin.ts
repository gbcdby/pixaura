import { api } from "@/utils/request";
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

// 用户管理接口
export const adminUserApi = {
  // 获取用户列表
  getUserList(params?: {
    keyword?: string;
    isBanned?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedData<AdminUser>> {
    return api.get("/admin/users", { params });
  },

  // 获取用户详情
  getUserDetail(userId: string): Promise<AdminUserDetail> {
    return api.get(`/admin/users/${userId}`);
  },

  // 封禁用户
  banUser(
    userId: string,
    data: BanUserDto,
  ): Promise<{
    userId: string;
    isBanned: boolean;
    bannedAt: string;
    banExpiresAt: string | null;
  }> {
    return api.post(`/admin/users/${userId}/ban`, data);
  },

  // 解封用户
  unbanUser(
    userId: string,
    data: UnbanUserDto,
  ): Promise<{
    userId: string;
    isBanned: false;
    unbannedAt: string;
  }> {
    return api.post(`/admin/users/${userId}/unban`, data);
  },
};

// 系统配置接口
export const adminConfigApi = {
  // 获取完整配置
  getFullConfig(): Promise<SystemFullConfig> {
    return api.get("/admin/config");
  },

  // 更新文件上传配置
  updateFileUploadConfig(
    config: Partial<FileUploadConfig>,
  ): Promise<FileUploadConfig> {
    return api.put("/admin/config/file-upload", config);
  },

  // 更新限流配置
  updateRateLimitConfig(
    config: Partial<RateLimitConfig>,
  ): Promise<RateLimitConfig> {
    return api.put("/admin/config/rate-limit", config);
  },

  // TTS API 配置
  getTTSApiConfig(): Promise<{
    apiKey: string;
    baseUrl: string;
    enabled: boolean;
    hasApiKey: boolean;
  } | null> {
    return api.get("/admin/config/tts");
  },

  updateTTSApiConfig(config: {
    apiKey?: string;
    baseUrl?: string;
    enabled?: boolean;
    models?: {
      flash?: {
        enabled?: boolean;
        costPerChar?: number;
        pricePerChar?: number;
      };
      instructFlash?: {
        enabled?: boolean;
        costPerChar?: number;
        pricePerChar?: number;
      };
    };
  }): Promise<{
    apiKey: string;
    baseUrl: string;
    enabled: boolean;
    hasApiKey: boolean;
    models: {
      flash: { enabled: boolean; costPerChar: number; pricePerChar: number };
      instructFlash: {
        enabled: boolean;
        costPerChar: number;
        pricePerChar: number;
      };
    };
  }> {
    return api.put("/admin/config/tts", config);
  },

  // 对口型 API 配置
  getLipSyncApiConfig(): Promise<{
    accessKey: string;
    secretKey: string;
    baseUrl: string;
    enabled: boolean;
    hasCredentials: boolean;
    subjectDetection: {
      enabled: boolean;
      costPerRequest: number;
      pricePerRequest: number;
    };
    lipSync: {
      enabled: boolean;
      costPerSecond: number;
      pricePerSecond: number;
    };
  } | null> {
    return api.get("/admin/config/lip-sync");
  },

  updateLipSyncApiConfig(config: {
    accessKey?: string;
    secretKey?: string;
    baseUrl?: string;
    enabled?: boolean;
    subjectDetection?: {
      enabled?: boolean;
      costPerRequest?: number;
      pricePerRequest?: number;
    };
    lipSync?: {
      enabled?: boolean;
      costPerSecond?: number;
      pricePerSecond?: number;
    };
  }): Promise<{
    accessKey: string;
    secretKey: string;
    baseUrl: string;
    enabled: boolean;
    hasCredentials: boolean;
    subjectDetection: {
      enabled: boolean;
      costPerRequest: number;
      pricePerRequest: number;
    };
    lipSync: {
      enabled: boolean;
      costPerSecond: number;
      pricePerSecond: number;
    };
  }> {
    return api.put("/admin/config/lip-sync", config);
  },
};

// 操作日志接口
export const adminLogApi = {
  // 获取操作日志列表
  getOperationLogs(params?: {
    adminId?: string;
    operationType?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedData<OperationLog>> {
    return api.get("/admin/logs/operations", { params });
  },
};
