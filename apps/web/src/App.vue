<template>
  <n-config-provider :theme-overrides="themeOverrides">
    <n-message-provider>
      <n-dialog-provider>
        <n-notification-provider>
          <n-loading-bar-provider>
            <router-view v-slot="{ Component }">
              <component :is="Component" />
            </router-view>
          </n-loading-bar-provider>
        </n-notification-provider>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { h, onMounted, ref, watch } from "vue";
import {
  type GlobalThemeOverrides,
  createDiscreteApi,
  NButton,
} from "naive-ui";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useWebSocketStore } from "@/stores/websocket";
import { WsEventNames } from "@pixaura/shared-types";

const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: "#8B9AFF",
    primaryColorHover: "#B56CFF",
    primaryColorPressed: "#7A89EE",
  },
};

const router = useRouter();
const authStore = useAuthStore();
const wsStore = useWebSocketStore();

// 使用 createDiscreteApi 创建独立的通知 API（绕过 provider 限制）
const { notification } = createDiscreteApi(["notification"]);

// 标记：是否已完成认证初始化
const authInitialized = ref(false);

onMounted(async () => {
  // 1. 先完成认证初始化
  await authStore.initAuth();
  authInitialized.value = true;

  // 2. 认证完成后，根据状态决定是否连接 WebSocket
  if (authStore.isLogin) {
    console.log("[App] 用户已登录，初始化 WebSocket");
    try {
      await wsStore.connect();
    } catch (err) {
      console.error("[App] WebSocket 连接失败:", err);
    }
  }

  // 3. 设置全局通知处理器
  wsStore.setNotificationHandler(handleGlobalNotification);
});

// 监听登录状态变化（登录/登出）
watch(
  () => authStore.isLogin,
  async (isLogin, wasLogin) => {
    // 只有初始化完成后才响应
    if (!authInitialized.value) return;

    if (isLogin && !wasLogin) {
      // 登录：连接 WebSocket
      console.log("[App] 用户登录，连接 WebSocket");
      await wsStore.connect();
    } else if (!isLogin && wasLogin) {
      // 登出：断开 WebSocket
      console.log("[App] 用户登出，断开 WebSocket");
      wsStore.disconnect();
    }
  },
);

/**
 * 全局通知处理：根据事件类型和当前路由显示通知
 * 如果用户在相关页面（如剧本编辑页），则不弹通知（页面会处理）
 */
function handleGlobalNotification(event: string, data: unknown) {
  const currentRoute = router.currentRoute.value;

  // 剧本生成完成
  if (event === WsEventNames.SCRIPT_GENERATE_DONE) {
    const scriptId = (data as any)?.scriptId;
    const currentScriptId = currentRoute.params.scriptId;

    // 如果不在剧本编辑页或不在对应剧本页，显示通知
    if (currentRoute.name !== "ScriptEdit" || currentScriptId !== scriptId) {
      const projectId = (data as any)?.projectId;
      notification.success({
        title: "剧本生成完成",
        content: "点击查看",
        duration: 5000,
        action:
          projectId && scriptId
            ? () => {
                // 使用 n-button 实现点击跳转
                return h(
                  NButton,
                  {
                    text: true,
                    type: "primary",
                    onClick: () =>
                      router.push(`/projects/${projectId}/scripts/${scriptId}`),
                  },
                  { default: () => "查看" },
                );
              }
            : undefined,
      });
    }
  }

  // 剧本生成失败
  if (event === WsEventNames.SCRIPT_GENERATE_FAILED) {
    notification.error({
      title: "剧本生成失败",
      content: (data as any)?.error?.message || "请重试",
    });
  }

  // 导出完成
  if (event === WsEventNames.EXPORT_COMPLETE) {
    const output = (data as any)?.output;
    notification.success({
      title: "视频导出完成",
      content: output?.fileSize
        ? `文件大小: ${(output.fileSize / 1024 / 1024).toFixed(2)}MB`
        : "导出成功",
    });
  }

  // 额度告警
  if (event === WsEventNames.QUOTA_WARNING) {
    notification.warning({
      title: "额度提醒",
      content: (data as any)?.message || "额度即将用尽",
    });
  }

  // 系统通知
  if (event === WsEventNames.SYSTEM_NOTIFICATION) {
    const sysData = data as any;
    const type = sysData?.type || "info";
    const n =
      type === "error"
        ? notification.error
        : type === "warning"
          ? notification.warning
          : notification.info;
    n({
      title: sysData?.title || "系统通知",
      content: sysData?.content || "",
      duration: 5000,
    });
  }
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue",
    Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji",
    "Segoe UI Symbol", "Noto Color Emoji";
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background-color: #f5f5f5;
}

#app {
  min-height: 100vh;
}
</style>
