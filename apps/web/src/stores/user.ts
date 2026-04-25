import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { userApi } from "@/api/user";
import { useAuthStore } from "./auth";
import type {
  UserInfo,
  UpdateUserDto,
  ChangePasswordDto,
  ChangePhoneDto,
  ChangeEmailDto,
} from "@/types/user";

export const useUserStore = defineStore("user", () => {
  // State
  const loading = ref(false);

  // 复用 authStore 的用户数据作为唯一数据源
  const authStore = useAuthStore();
  const profile = computed({
    get: () => authStore.user,
    set: (value) => {
      authStore.user = value;
    },
  });

  // 获取用户信息 - 带缓存机制
  async function fetchProfile(forceRefresh = false): Promise<UserInfo> {
    // 如果已有数据且不是强制刷新，直接返回缓存数据
    if (profile.value && !forceRefresh) {
      return profile.value;
    }

    loading.value = true;
    try {
      const userInfo = await userApi.getProfile();
      profile.value = userInfo;
      return userInfo;
    } finally {
      loading.value = false;
    }
  }

  // 更新用户信息
  async function updateProfile(data: UpdateUserDto): Promise<UserInfo> {
    loading.value = true;
    try {
      const userInfo = await userApi.updateProfile(data);
      // 同步更新 authStore 的数据（单一数据源）
      profile.value = userInfo;
      return userInfo;
    } finally {
      loading.value = false;
    }
  }

  // 修改密码
  async function changePassword(data: ChangePasswordDto): Promise<void> {
    await userApi.changePassword(data);
  }

  // 修改手机号
  async function changePhone(data: ChangePhoneDto): Promise<void> {
    await userApi.changePhone(data);
  }

  // 发送修改邮箱验证码
  async function sendChangeEmailCode(newEmail: string): Promise<void> {
    await userApi.sendChangeEmailCode(newEmail);
  }

  // 修改邮箱
  async function changeEmail(data: ChangeEmailDto): Promise<void> {
    await userApi.changeEmail(data);
    // 修改成功后强制刷新用户信息
    await fetchProfile(true);
  }

  // 上传头像
  async function uploadAvatar(file: File): Promise<string> {
    const result = await userApi.uploadAvatar(file);
    // 同步更新头像到 authStore
    if (profile.value) {
      profile.value = { ...profile.value, avatar: result.avatarUrl };
    }
    return result.avatarUrl;
  }

  return {
    // State
    profile,
    loading,
    // Actions
    fetchProfile,
    updateProfile,
    changePassword,
    changePhone,
    sendChangeEmailCode,
    changeEmail,
    uploadAvatar,
  };
});
