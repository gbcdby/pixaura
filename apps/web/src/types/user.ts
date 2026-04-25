// 用户信息
export interface UserInfo {
  id: string;
  username: string;
  phone: string;
  email?: string;
  emailVerified: boolean;
  avatar?: string;
  bio?: string;
  perms: number;
  subscriptionTier: "free" | "basic" | "pro";
  subscriptionExpiresAt?: string;
  balance: number;
  createdAt: string;
}

// 登录请求
export interface LoginDto {
  username: string;
  password: string;
  remember?: boolean;
}

// 手机号登录
export interface PhoneLoginDto {
  phone: string;
  code: string;
}

// 注册请求
export interface RegisterDto {
  phone: string;
  code: string;
  username: string;
  password: string;
  confirmPassword: string;
  email?: string;
}

// 登录响应
export interface LoginResponse {
  accessToken: string;
  accessTokenExpires: number;
  user: UserInfo;
}

// 更新用户信息
export interface UpdateUserDto {
  username?: string;
  email?: string;
}

// 修改密码
export interface ChangePasswordDto {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// 修改手机号
export interface ChangePhoneDto {
  newPhone: string;
  newPhoneCode: string;
  verifyToken: string;
}

// 修改邮箱
export interface ChangeEmailDto {
  newEmail: string;
  code: string;
}

// 重置密码
export interface ResetPasswordDto {
  phone: string;
  code: string;
  newPassword: string;
  confirmPassword: string;
}

// 发送验证码
export interface SendCodeDto {
  phone: string;
  type: "register" | "login" | "reset_password" | "change_phone";
}

// API 响应格式
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}
