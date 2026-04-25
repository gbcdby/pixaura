import axios, {
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import { useAuthStore } from "@/stores/auth";
import router from "@/router";

// 创建 axios 实例
const api: AxiosInstance = axios.create({
  baseURL: "/api",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // 允许携带 Cookie
});

// Token 刷新状态管理
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

/**
 * 订阅刷新完成事件
 * 当 token 刷新完成后，所有等待的请求会被重新执行
 */
function subscribeTokenRefresh(callback: (token: string) => void): void {
  refreshSubscribers.push(callback);
}

/**
 * 通知所有订阅者刷新完成
 */
function onRefreshed(token: string): void {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
}

/**
 * 刷新失败，清除所有订阅者
 */
function onRefreshFailed(): void {
  refreshSubscribers = [];
}

// 请求拦截器
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // FormData 请求需要移除默认的 application/json，让浏览器自动设置 multipart/form-data
    if (config.data instanceof FormData) {
      delete (config.headers as Record<string, unknown>)["Content-Type"];
    }
    // 后端从 Cookie 自动读取 accessToken，前端不需要手动添加
    // Cookie 通过 withCredentials: true 自动携带
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// 响应拦截器
api.interceptors.response.use(
  (response: AxiosResponse) => {
    // 直接返回数据
    const { data } = response;
    if (data.code !== 0) {
      const error = new Error(data.msg || data.message || "请求失败");
      (error as any).code = data.code;
      (error as any).response = response;
      return Promise.reject(error);
    }
    return data.data;
  },
  async (error) => {
    const originalRequest = error.config;
    const authStore = useAuthStore();

    // 跳过不需要刷新的请求：刷新token本身、登出请求
    const skipRefresh =
      originalRequest.url?.includes("/auth/refresh") ||
      originalRequest.url?.includes("/auth/logout");

    // Token 过期，尝试刷新（但跳过刷新和登出请求，避免无限循环）
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !skipRefresh
    ) {
      originalRequest._retry = true;

      // 如果正在刷新，将请求加入队列等待
      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh(() => {
            resolve(api(originalRequest));
          });
        });
      }

      isRefreshing = true;

      try {
        await authStore.refreshAccessToken();
        isRefreshing = false;

        // 通知所有等待的请求重新执行
        onRefreshed(authStore.token || "");

        // 重试当前请求
        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        onRefreshFailed();

        // 刷新失败，直接清除登录状态（不再调用logout，避免循环）
        authStore.clearAuth();
        router.push({
          name: "Login",
          query: { redirect: router.currentRoute.value.fullPath },
        });
        return Promise.reject(refreshError);
      }
    }

    // 处理错误信息
    const message =
      error.response?.data?.message || error.message || "网络错误";
    const customError = new Error(message);
    (customError as any).code =
      error.response?.data?.code || error.response?.status;
    (customError as any).response = error.response;

    return Promise.reject(customError);
  },
);

export { api };
