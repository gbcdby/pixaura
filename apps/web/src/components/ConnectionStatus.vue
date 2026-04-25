<!--
  ConnectionStatus 组件
  显示 WebSocket 连接状态，支持手动重连
-->
<template>
  <div class="connection-status">
    <!-- 连接状态指示器 -->
    <n-tooltip :placement="tooltipPlacement">
      <template #trigger>
        <div
          class="status-indicator"
          :class="statusClass"
          @click="handleClick"
        >
          <n-icon size="16">
            <wifi-outline v-if="isConnected" />
            <wifi-sharp v-else-if="hasError" />
            <sync-outline
              v-else-if="isReconnecting"
              class="spin"
            />
            <wifi-outline v-else />
          </n-icon>
          <span
            v-if="showText"
            class="status-text"
          >{{ statusText }}</span>
        </div>
      </template>
      <template #default>
        <div class="tooltip-content">
          <p>{{ tooltipText }}</p>
          <p
            v-if="errorMessage"
            class="error-message"
          >
            {{ errorMessage }}
          </p>
          <p
            v-if="!isConnected && !isReconnecting"
            class="hint"
          >
            点击重连
          </p>
        </div>
      </template>
    </n-tooltip>

    <!-- 断线警告提示 -->
    <n-alert
      v-if="showAlert && !isConnected && !isReconnecting"
      type="warning"
      closable
      @close="showAlert = false"
    >
      <template #header>
        连接已断开
      </template>
      实时进度更新已暂停，
      <n-button
        text
        type="primary"
        @click="handleReconnect"
      >
        点击重连
      </n-button>
    </n-alert>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { WifiOutline, WifiSharp, SyncOutline } from "@vicons/ionicons5";
import { useWebSocketStore } from "@/stores/websocket";
import { NTooltip, NIcon, NAlert, NButton, useMessage } from "naive-ui";

const props = defineProps<{
  showText?: boolean;
  showAlert?: boolean;
  tooltipPlacement?:
    | "top"
    | "top-start"
    | "top-end"
    | "bottom"
    | "bottom-start"
    | "bottom-end"
    | "left"
    | "left-start"
    | "left-end"
    | "right"
    | "right-start"
    | "right-end";
}>();

const emit = defineEmits<{
  reconnect: [];
}>();

const wsStore = useWebSocketStore();
const message = useMessage();

const showAlert = ref(props.showAlert ?? true);

// 状态计算
const isConnected = computed(() => wsStore.isConnected);
const isReconnecting = computed(() => wsStore.isReconnecting);
const hasError = computed(() => wsStore.hasError);
const errorMessage = computed(() => wsStore.error);

// 状态样式类
const statusClass = computed(() => ({
  connected: isConnected.value,
  disconnected: !isConnected.value && !isReconnecting.value && !hasError.value,
  error: hasError.value,
  reconnecting: isReconnecting.value,
}));

// 状态文本
const statusText = computed(() => {
  if (isConnected.value) return "已连接";
  if (isReconnecting.value) return "重连中";
  if (hasError.value) return "连接错误";
  return "未连接";
});

// 提示文本
const tooltipText = computed(() => {
  if (isConnected.value) return "WebSocket 连接正常";
  if (isReconnecting.value) return `正在重连 (${wsStore.reconnectCount}/${5})`;
  if (hasError.value) return "连接失败";
  return "点击连接";
});

// 点击处理
const handleClick = () => {
  if (!isConnected.value && !isReconnecting.value) {
    handleReconnect();
  }
};

// 重连处理
const handleReconnect = async () => {
  try {
    message.loading("正在连接...");
    await wsStore.reconnect();
    message.success("连接成功");
    emit("reconnect");
  } catch (error) {
    message.error("连接失败，请稍后重试");
  }
};

// 监听连接状态变化，自动显示警告
watch(
  () => wsStore.status,
  (newStatus, oldStatus) => {
    if (newStatus === "error" && oldStatus === "connected") {
      showAlert.value = true;
    }
  },
);
</script>

<style scoped lang="scss">
.connection-status {
  display: inline-flex;
  flex-direction: column;
  gap: 8px;
}

.status-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 12px;

  &.connected {
    color: var(--success-color, #18a058);
    background: var(--success-color-suppl, rgba(24, 160, 88, 0.1));
  }

  &.disconnected {
    color: var(--text-color-3, #999);
    background: var(--fill-color, #f5f5f5);

    &:hover {
      background: var(--fill-color-hover, #e8e8e8);
    }
  }

  &.error {
    color: var(--error-color, #d03050);
    background: var(--error-color-suppl, rgba(208, 48, 80, 0.1));

    &:hover {
      background: var(--error-color-hover, rgba(208, 48, 80, 0.2));
    }
  }

  &.reconnecting {
    color: var(--warning-color, #f0a020);
    background: var(--warning-color-suppl, rgba(240, 160, 32, 0.1));
  }
}

.status-text {
  font-size: 12px;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.tooltip-content {
  text-align: center;

  .error-message {
    color: var(--error-color, #d03050);
    font-size: 12px;
    margin-top: 4px;
  }

  .hint {
    color: var(--info-color, #2080f0);
    font-size: 12px;
    margin-top: 4px;
  }
}
</style>
