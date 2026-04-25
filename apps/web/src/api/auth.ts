import { api } from "@/utils/request";
import type {
  LoginDto,
  PhoneLoginDto,
  RegisterDto,
  ResetPasswordDto,
  SendCodeDto,
  LoginResponse,
  UserInfo,
} from "@/types/user";

export const authApi = {
  // 账号密码登录
  login(data: LoginDto & { remember?: boolean }): Promise<LoginResponse> {
    return api.post("/auth/login", data);
  },

  // 手机号验证码登录
  loginPhone(data: PhoneLoginDto): Promise<LoginResponse> {
    return api.post("/auth/sms-login", data);
  },

  // 注册
  register(data: RegisterDto): Promise<UserInfo> {
    return api.post("/auth/register", data);
  },

  // 退出登录
  logout(): Promise<void> {
    return api.post("/auth/logout");
  },

  // 刷新 Token
  refreshToken(): Promise<{ accessToken: string; accessTokenExpires: number }> {
    return api.post("/auth/refresh");
  },

  // 发送验证码
  sendCode(data: SendCodeDto): Promise<void> {
    switch (data.type) {
      case "register":
        return api.post("/auth/send-register-code", { phone: data.phone });
      case "login":
        return api.post("/auth/send-login-code", { phone: data.phone });
      case "reset_password":
        return api.post("/auth/send-reset-password-code", {
          phone: data.phone,
        });
      default:
        return api.post("/auth/send-code", data);
    }
  },

  // 发送注册验证码
  sendRegisterCode(phone: string): Promise<void> {
    return api.post("/auth/send-register-code", { phone });
  },

  // 重置密码
  resetPassword(data: ResetPasswordDto): Promise<void> {
    return api.put("/auth/password", data);
  },

  // 验证邮箱
  verifyEmail(token: string): Promise<void> {
    return api.post("/auth/verify-email", { token });
  },

  // 发送邮箱验证邮件
  sendEmailVerify(email: string): Promise<void> {
    return api.post("/auth/send-email-verify", { email });
  },
};
