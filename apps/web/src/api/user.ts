import { api } from "@/utils/request";
import type {
  UserInfo,
  UpdateUserDto,
  ChangePasswordDto,
  ChangePhoneDto,
  ChangeEmailDto,
} from "@/types/user";

export const userApi = {
  // 获取用户信息
  getProfile(): Promise<UserInfo> {
    return api.get("/user/profile");
  },

  // 更新用户信息
  updateProfile(data: UpdateUserDto): Promise<UserInfo> {
    return api.put("/user/profile", data);
  },

  // 修改密码
  changePassword(data: ChangePasswordDto): Promise<void> {
    return api.put("/user/password", data);
  },

  // 修改手机号
  changePhone(data: ChangePhoneDto): Promise<void> {
    return api.put("/user/phone", data);
  },

  // 发送修改手机号验证码
  sendUpdatePhoneCode(
    type: "verify_old" | "verify_new",
    phone?: string,
  ): Promise<void> {
    return api.post("/user/send-update-phone-code", { type, phone });
  },

  // 验证原手机号
  verifyOldPhone(code: string): Promise<{ verifyToken: string }> {
    return api.post("/user/phone/verify-old", { code });
  },

  // 上传头像
  uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
    const formData = new FormData();
    formData.append("file", file);
    return api.post("/user/avatar", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },

  // 发送修改邮箱验证码
  sendChangeEmailCode(newEmail: string): Promise<void> {
    return api.post("/user/send-change-email-code", { newEmail });
  },

  // 修改邮箱
  changeEmail(data: ChangeEmailDto): Promise<void> {
    return api.put("/user/email", data);
  },
};
