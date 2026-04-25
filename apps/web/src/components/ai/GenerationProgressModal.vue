<script setup lang="ts">
import { computed, watch } from "vue";
import { NModal, NProgress, NSpace, NText, NButton, NIcon } from "naive-ui";
import { CheckmarkCircle, CloseCircle, AlertCircle } from "@vicons/ionicons5";
import { useAIStore } from "@/stores/ai";
import type { AITaskStatus } from "@/api/ai";

interface Props {
  show: boolean;
  taskId?: string;
  title?: string;
}

interface Emits {
  (e: "update:show", show: boolean): void;
  (e: "success", result: Record<string, unknown>): void;
  (e: "error", code: string, message: string): void;
  (e: "cancel"): void;
}

const props = withDefaults(defineProps<Props>(), {
  title: "AI 生成中",
});

const emit = defineEmits<Emits>();

const aiStore = useAIStore();

// 当前任务
const task = computed(() => {
  if (!props.taskId) return null;
  return aiStore.tasks.find((t) => t.taskId === props.taskId) || null;
});

// 任务状态
const status = computed<AITaskStatus>(() => {
  return task.value?.status || "pending";
});

// 进度百分比
const progress = computed(() => {
  return task.value?.progress || 0;
});

// 流式内容
const streamContent = computed(() => {
  return task.value?.streamContent || "";
});

// 状态文本
const statusText = computed(() => {
  const statusMap: Record<AITaskStatus, string> = {
    pending: "排队中...",
    processing: "处理中...",
    streaming: "生成中...",
    completed: "已完成",
    failed: "生成失败",
    cancelled: "已取消",
    timeout: "超时",
  };
  return statusMap[status.value] || "未知状态";
});

// 状态类型
const statusType = computed(() => {
  const typeMap: Record<
    AITaskStatus,
    "default" | "success" | "error" | "warning" | "info"
  > = {
    pending: "info",
    processing: "info",
    streaming: "info",
    completed: "success",
    failed: "error",
    cancelled: "warning",
    timeout: "error",
  };
  return typeMap[status.value] || "default";
});

// 是否可以取消
const canCancel = computed(() => {
  return ["pending", "processing", "streaming"].includes(status.value);
});

// 取消任务
const handleCancel = async () => {
  if (!props.taskId) return;
  try {
    await aiStore.cancelTask(props.taskId);
    emit("cancel");
    emit("update:show", false);
  } catch (error) {
    console.error("取消任务失败:", error);
  }
};

// 关闭弹窗
const handleClose = () => {
  emit("update:show", false);
};

// 监听任务状态变化
watch(
  () => status.value,
  (newStatus) => {
    if (newStatus === "completed" && task.value?.result) {
      emit("success", task.value.result);
      setTimeout(() => {
        emit("update:show", false);
      }, 1500);
    } else if (newStatus === "failed" && task.value?.errorMessage) {
      emit("error", "TASK_FAILED", task.value.errorMessage);
    }
  },
);
</script>

<template>
  <NModal
    :show="show"
    :mask-closable="false"
    :close-on-esc="false"
    preset="card"
    style="width: 600px; max-width: 90vw"
    :title="title"
    @close="handleClose"
  >
    <NSpace
      vertical
      size="large"
    >
      <!-- 状态图标 -->
      <div class="status-icon">
        <NIcon
          v-if="status === 'completed'"
          size="64"
          color="#18a058"
        >
          <CheckmarkCircle />
        </NIcon>
        <NIcon
          v-else-if="status === 'failed' || status === 'timeout'"
          size="64"
          color="#d03050"
        >
          <CloseCircle />
        </NIcon>
        <NIcon
          v-else-if="status === 'cancelled'"
          size="64"
          color="#f0a020"
        >
          <AlertCircle />
        </NIcon>
        <div
          v-else
          class="loading-spinner"
        />
      </div>

      <!-- 状态文本 -->
      <NText
        type="statusType"
        style="font-size: 18px; text-align: center; display: block"
      >
        {{ statusText }}
      </NText>

      <!-- 进度条 -->
      <NProgress
        type="line"
        :percentage="progress"
        :status="statusType"
        :show-indicator="true"
      />

      <!-- 流式内容预览 -->
      <div
        v-if="streamContent"
        class="stream-preview"
      >
        <NText
          depth="3"
          style="font-size: 12px"
        >
          生成内容预览:
        </NText>
        <div class="content-box">
          {{ streamContent.slice(-200) }}
          <span
            v-if="status === 'streaming'"
            class="cursor"
          >|</span>
        </div>
      </div>

      <!-- 操作按钮 -->
      <NSpace justify="center">
        <NButton
          v-if="canCancel"
          @click="handleCancel"
        >
          取消生成
        </NButton>
        <NButton
          v-else
          @click="handleClose"
        >
          关闭
        </NButton>
      </NSpace>
    </NSpace>
  </NModal>
</template>

<style scoped lang="scss">
.status-icon {
  display: flex;
  justify-content: center;
  padding: 20px 0;
}

.loading-spinner {
  width: 64px;
  height: 64px;
  border: 4px solid #f0f0f0;
  border-top-color: #2080f0;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.stream-preview {
  padding: 12px;
  background: #f8f8f8;
  border-radius: 8px;
}

.content-box {
  margin-top: 8px;
  padding: 12px;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  font-size: 14px;
  line-height: 1.6;
  max-height: 200px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.cursor {
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}
</style>
