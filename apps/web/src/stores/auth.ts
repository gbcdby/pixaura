import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { authApi } from "@/api/auth";
import { userApi } from "@/api/user";
import type {
  UserInfo,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from "@/types/user";

// 从 cookie 读取 accessToken
function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
  return null;
}

export const useAuthStore = defineStore("auth", () => {
  // State - 从 cookie 读取 token
  const token = ref<string | null>(getCookie("accessToken"));
  const tokenExpireTime = ref<number | null>(null);
  const user = ref<UserInfo | null>(null);
  const loading = ref(false);
  const cooldownSeconds = ref(0);

  // 初始化状态跟踪（防重复请求）
  let initPromise: Promise<void> | null = null;
  let initialized = false;

  // Getters
  const isLogin = computed(() => !!token.value && !!user.value);
  const userPerms = computed(() => user.value?.perms || 0);
  const hasVerifiedEmail = computed(() => user.value?.emailVerified || false);

  // 检查是否有指定权限
  function hasPerm(perm: number): boolean {
    return (userPerms.value & perm) !== 0;
  }

  // 检查是否为管理员
  const isAdmin = computed(() => hasPerm(1)); // 1 << 0

  // 初始化认证状态（带防重入机制）
  async function initAuth(): Promise<void> {
    // 如果已经完成初始化，直接返回
    if (initialized) {
      return;
    }

    // 如果正在初始化中，返回同一个 Promise
    if (initPromise) {
      return initPromise;
    }

    // 创建新的初始化 Promise
    initPromise = doInitAuth().finally(() => {
      initPromise = null;
    });

    return initPromise;
  }

  // 实际的初始化逻辑
  async function doInitAuth(): Promise<void> {
    // 从 cookie 读取 token
    const storedToken = getCookie("accessToken");

    if (storedToken) {
      token.value = storedToken;
      // 获取用户信息（后端会从 cookie 验证 token）
      try {
        await fetchUserInfo();
      } catch {
        clearAuth();
      }
    }

    initialized = true;
  }

  // 登录
  async function login(data: LoginDto & { remember?: boolean }) {
    loading.value = true;
    try {
      const response = await authApi.login(data);
      setAuth(response, data.remember);
      return response;
    } finally {
      loading.value = false;
    }
  }

  // 手机号登录
  async function loginWithPhone(phone: string, code: string) {
    loading.value = true;
    try {
      const response = await authApi.loginPhone({ phone, code });
      setAuth(response);
      return response;
    } finally {
      loading.value = false;
    }
  }

  // 注册
  async function register(data: RegisterDto) {
    loading.value = true;
    try {
      const response = await authApi.register(data);
      return response;
    } finally {
      loading.value = false;
    }
  }

  // 退出登录
  async function logout() {
    try {
      await authApi.logout();
    } finally {
      clearAuth();
    }
  }

  // 刷新 Token - 后端通过 cookie 刷新并设置新 token
  async function refreshAccessToken() {
    try {
      const response = await authApi.refreshToken();
      token.value = response.accessToken;
      tokenExpireTime.value = response.accessTokenExpires * 1000;

      // Token 由后端通过 cookie 设置，前端不需要手动存储
      return response;
    } catch (error) {
      clearAuth();
      throw error;
    }
  }

  // 获取用户信息
  async function fetchUserInfo() {
    // 优先调用 API 获取最新数据，确保用户信息一致性
    const userInfo = await userApi.getProfile();
    user.value = userInfo;
    return userInfo;
  }

  // 发送验证码
  async function sendVerifyCode(
    phone: string,
    type: "register" | "login" | "reset_password" | "change_phone",
  ) {
    await authApi.sendCode({ phone, type });
    startCooldown();
  }

  // 重置密码
  async function resetPassword(data: ResetPasswordDto) {
    await authApi.resetPassword(data);
  }

  // 设置认证信息 - 后端已设置 cookie，前端只需更新状态
  function setAuth(
    response: {
      accessToken: string;
      accessTokenExpires: number;
      user: UserInfo;
    },
    _remember?: boolean,
  ) {
    token.value = response.accessToken;
    tokenExpireTime.value = response.accessTokenExpires * 1000;
    user.value = response.user;
    initialized = true;

    // Token 由后端通过 cookie 设置，前端不需要手动存储
    // cookie 的过期时间由后端控制
  }

  // 清除认证信息 - 后端会清除 cookie，前端只需更新状态
  function clearAuth() {
    token.value = null;
    tokenExpireTime.value = null;
    user.value = null;
    initialized = false;
    initPromise = null;

    // Token cookie 由后端清除，前端不需要手动操作
    // 这里可以添加一个调用来确保后端清除 cookie（如果需要）
  }

  // 开始验证码倒计时
  function startCooldown() {
    cooldownSeconds.value = 60;
    const timer = setInterval(() => {
      cooldownSeconds.value--;
      if (cooldownSeconds.value <= 0) {
        clearInterval(timer);
      }
    }, 1000);
  }

  return {
    // State
    token,
    tokenExpireTime,
    user,
    loading,
    cooldownSeconds,
    // Getters
    isLogin,
    userPerms,
    hasVerifiedEmail,
    isAdmin,
    // Actions
    hasPerm,
    initAuth,
    login,
    loginWithPhone,
    register,
    logout,
    refreshAccessToken,
    fetchUserInfo,
    sendVerifyCode,
    resetPassword,
    setAuth,
    clearAuth,
  };
});
