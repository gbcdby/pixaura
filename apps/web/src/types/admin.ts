// 用户列表项
export interface AdminUser {
  id: string;
  username: string;
  phone: string | null;
  email: string | null;
  perms: number;
  subscriptionTier: string | null;
  balance: number;
  isBanned: boolean;
  bannedReason: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

// 用户详情
export interface AdminUserDetail {
  user: AdminUser & {
    emailVerified: boolean;
    subscriptionExpiresAt: string | null;
    updatedAt: string;
    bannedAt: string | null;
  };
  banRecords: BanRecord[];
}

// 封禁记录
export interface BanRecord {
  id: string;
  reason: string;
  durationDays: number;
  bannedAt: string;
  unbannedAt: string | null;
  unbanReason: string | null;
}

// 封禁用户请求
export interface BanUserDto {
  reason: string;
  durationDays: number;
  notifyUser?: boolean;
}

// 解封用户请求
export interface UnbanUserDto {
  reason: string;
}

// 文件上传配置项
export interface FileUploadItemConfig {
  maxSize?: number;
  allowedTypes?: string[];
  dailyLimit?: number;
}

// 文件上传配置
export interface FileUploadConfig {
  avatar?: FileUploadItemConfig;
  reference?: FileUploadItemConfig;
  project?: { maxSize?: number };
}

// 限流配置
export interface RateLimitConfig {
  enabled?: boolean;
  windowSeconds?: number;
  maxRequests?: number;
  banDurationSeconds?: number;
  whitelistIps?: string[];
}

// 系统完整配置
export interface SystemFullConfig {
  fileUpload: FileUploadConfig;
  rateLimit: RateLimitConfig;
}

// 操作日志
export interface OperationLog {
  id: string;
  adminId: string;
  adminUsername?: string;
  operationType: string;
  targetType: string;
  targetId: string | null;
  details: Record<string, unknown>;
  ipAddress: string;
  userAgent: string | null;
  createdAt: string;
}

// 分页数据
export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// 操作类型枚举
export type OperationType =
  | "user_ban"
  | "user_unban"
  | "config_update"
  | "balance_adjust"
  | "subscription_grant"
  | "quota_refresh";

// 操作类型中文映射
export const operationTypeMap: Record<string, string> = {
  user_ban: "封禁用户",
  user_unban: "解封用户",
  config_update: "配置更新",
  balance_adjust: "余额调整",
  subscription_grant: "订阅赋予",
  quota_refresh: "额度刷新",
};

// 操作对象类型中文映射
export const targetTypeMap: Record<string, string> = {
  user: "用户",
  config: "配置",
  subscription: "订阅",
  quota: "额度",
};
