import { z } from "zod";

/**
 * 用户状态
 */
export const UserStatus = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  BANNED: "banned",
} as const;

export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

/**
 * 用户实体（数据库）
 */
export interface UserEntity {
  id: string;
  username: string;
  phone: string;
  email: string | null;
  emailVerified: boolean;
  passwordHash: string;
  avatar: string | null;
  bio: string | null;
  perms: number;
  subscriptionTier: string;
  subscriptionExpiresAt: Date | null;
  subscriptionQuota: Record<string, unknown>;
  defaultModels: Record<string, string | null>;
  balance: number;
  balanceLimit: number;
  isBanned: boolean;
  lastLoginAt: Date | null;
  bannedReason: string | null;
  bannedAt: Date | null;
  phoneChangedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 登录日志实体
 */
export interface LoginLogEntity {
  id: string;
  userId: string;
  ip: string;
  userAgent: string;
  deviceType: string;
  loginType: string;
  status: string;
  failReason: string | null;
  createdAt: Date;
}

// ==================== DTOs ====================

/**
 * 登录 DTO
 */
export const LoginSchema = z.object({
  username: z.string().min(1).describe("用户名/手机号/邮箱"),
  password: z.string().min(1).describe("密码"),
});

export type LoginDto = z.infer<typeof LoginSchema>;

/**
 * 手机号登录 DTO
 */
export const PhoneLoginSchema = z.object({
  phone: z
    .string()
    .regex(/^1[3-9]\d{9}$/, "手机号格式不正确")
    .describe("手机号"),
  code: z.string().length(6).describe("验证码"),
});

export type PhoneLoginDto = z.infer<typeof PhoneLoginSchema>;

/**
 * 注册 DTO
 */
export const RegisterSchema = z.object({
  phone: z
    .string()
    .regex(/^1[3-9]\d{9}$/, "手机号格式不正确")
    .describe("手机号"),
  code: z.string().length(6).describe("验证码"),
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/, "用户名只能包含字母、数字和下划线")
    .describe("用户名"),
  password: z.string().min(8).max(32).describe("密码"),
  email: z.string().email("邮箱格式不正确").optional().describe("邮箱（可选）"),
});

export type RegisterDto = z.infer<typeof RegisterSchema>;

/**
 * 发送验证码 DTO
 */
export const SendCodeSchema = z.object({
  phone: z
    .string()
    .regex(/^1[3-9]\d{9}$/, "手机号格式不正确")
    .describe("手机号"),
  type: z
    .enum(["register", "login", "resetPassword", "changePhone"])
    .describe("验证码类型"),
});

export type SendCodeDto = z.infer<typeof SendCodeSchema>;

/**
 * 重置密码 DTO
 */
export const ResetPasswordSchema = z.object({
  phone: z
    .string()
    .regex(/^1[3-9]\d{9}$/, "手机号格式不正确")
    .describe("手机号"),
  code: z.string().length(6).describe("验证码"),
  newPassword: z.string().min(8).max(32).describe("新密码"),
});

export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>;

/**
 * 修改密码 DTO
 */
export const ChangePasswordSchema = z.object({
  oldPassword: z.string().min(1).describe("旧密码"),
  newPassword: z.string().min(8).max(32).describe("新密码"),
});

export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>;

/**
 * 更新用户信息 DTO
 */
export const UpdateUserSchema = z
  .object({
    username: z
      .string()
      .min(3)
      .max(20)
      .regex(/^[a-zA-Z0-9_]+$/, "用户名只能包含字母、数字和下划线")
      .optional()
      .describe("用户名"),
    bio: z.string().max(500).optional().describe("个人简介"),
    email: z.string().email().optional().describe("邮箱"),
  })
  .strict();

export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;

/**
 * 修改手机号 DTO
 */
export const ChangePhoneSchema = z.object({
  newPhone: z
    .string()
    .regex(/^1[3-9]\d{9}$/, "手机号格式不正确")
    .describe("新手机号"),
  newPhoneCode: z.string().length(6).describe("验证码"),
  verifyToken: z.string().uuid().describe("验证令牌"),
});

export type ChangePhoneDto = z.infer<typeof ChangePhoneSchema>;

/**
 * 验证原手机号 DTO
 */
export const VerifyOldPhoneSchema = z.object({
  code: z.string().length(6).describe("验证码"),
});

export type VerifyOldPhoneDto = z.infer<typeof VerifyOldPhoneSchema>;

/**
 * 发送修改手机验证码 DTO
 */
export const SendUpdatePhoneCodeSchema = z.object({
  type: z.enum(["verify_old", "verify_new"]).describe("验证类型"),
  phone: z
    .string()
    .regex(/^1[3-9]\d{9}$/, "手机号格式不正确")
    .optional()
    .describe("新手机号（verify_new 时需要）"),
});

export type SendUpdatePhoneCodeDto = z.infer<typeof SendUpdatePhoneCodeSchema>;

/**
 * 发送修改邮箱验证码 DTO
 */
export const SendChangeEmailCodeSchema = z.object({
  newEmail: z.string().email("邮箱格式不正确").describe("新邮箱"),
});

export type SendChangeEmailCodeDto = z.infer<typeof SendChangeEmailCodeSchema>;

/**
 * 修改邮箱 DTO
 */
export const ChangeEmailSchema = z.object({
  newEmail: z.string().email("邮箱格式不正确").describe("新邮箱"),
  code: z.string().length(6, "验证码为6位数字").describe("验证码"),
});

export type ChangeEmailDto = z.infer<typeof ChangeEmailSchema>;

// ==================== Response DTOs ====================

/**
 * 用户信息响应
 */
export interface UserResponseDto {
  id: string;
  username: string;
  phone: string;
  email: string | null;
  emailVerified: boolean;
  avatar: string | null;
  bio: string | null;
  perms: number;
  subscriptionTier: string;
  subscriptionExpiresAt: Date | null;
  balance: number;
  lastLoginAt: Date | null;
  createdAt: Date;
}

/**
 * 登录响应
 */
export interface LoginResponseDto {
  user: UserResponseDto;
  accessToken: string;
  accessTokenExpires: number;
}

/**
 * Token 刷新响应
 */
export interface TokenRefreshResponseDto {
  accessToken: string;
  accessTokenExpires: number;
}

/**
 * 会话信息
 */
export interface SessionInfo {
  id: string;
  deviceType: string;
  ip: string;
  location: string;
  createdAt: Date;
  isCurrent: boolean;
}

// ==================== 前端使用类型 ====================

/**
 * 认证状态
 */
export interface AuthState {
  user: UserResponseDto | null;
  isLoggedIn: boolean;
  isLoading: boolean;
}
