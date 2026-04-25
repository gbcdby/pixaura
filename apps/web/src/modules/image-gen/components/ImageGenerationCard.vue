<template>
  <n-card
    class="image-gen-card"
    :bordered="false"
    hoverable
    @click="handleClick"
  >
    <div class="card-header">
      <n-tag :type="statusTagType">
        {{ statusText }}
      </n-tag>
      <span class="create-time">{{ formatTime(task.createdAt) }}</span>
    </div>

    <!-- 生成进度条（仅活跃任务显示） -->
    <div
      v-if="isActiveTask"
      class="progress-section"
    >
      <div class="progress-info">
        <span class="current-step">{{ currentStepText }}</span>
        <span class="percentage">{{ progressPercentage }}%</span>
      </div>
      <n-progress
        type="line"
        :percentage="progressPercentage"
        :status="progressStatus"
        :processing="isProcessing"
        :show-indicator="false"
        :height="6"
      />
      <div
        v-if="wsError"
        class="ws-error"
      >
        <n-icon
          :component="WifiOff"
          :size="12"
        />
        <span>实时更新已断开</span>
      </div>
    </div>

    <div class="preview-grid">
      <div
        v-for="result in previewResults"
        :key="result.id"
        class="preview-item"
        :class="{ 'is-failed': result.status === 'failed' }"
      >
        <n-image
          v-if="result.status === 'success' && result.image"
          :src="result.image.thumbnailUrl"
          :preview-src="result.image.url"
          object-fit="cover"
          class="preview-image"
        />
        <div
          v-else-if="result.status === 'pending'"
          class="placeholder"
        >
          <n-spin size="small" />
        </div>
        <div
          v-else
          class="placeholder error"
        >
          <n-icon :component="AlertTriangle" />
        </div>
      </div>
      <div
        v-if="!previewResults.length"
        class="no-preview"
      >
        <n-empty
          description="等待生成"
          size="small"
        />
      </div>
    </div>

    <div class="card-footer">
      <span class="scene-type">{{ sceneTypeText }}</span>
      <span class="progress">{{ progressText }}</span>
    </div>
  </n-card>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { NCard, NTag, NImage, NSpin, NIcon, NEmpty, NProgress } from "naive-ui";
import { AlertTriangle, WifiOff } from "lucide-vue-next";
import type {
  ImageGenTaskDetailDto,
  ImageGenTaskStatus,
} from "@pixaura/shared-types";
import {
  useWebSocketStore,
  type GenerationProgressData,
} from "@/stores/websocket";

const props = defineProps<{
  task: ImageGenTaskDetailDto;
}>();

const emit = defineEmits<{
  click: [taskId: string];
}>();

const wsStore = useWebSocketStore();

// WebSocket 进度缓存
const wsProgress = ref<{
  percentage: number;
  currentStep: string;
  status: string;
  errorMessage?: string;
} | null>(null);

// 判断是否为活跃任务（需要 WebSocket 订阅）
const isActiveTask = computed(() => {
  return ["pending", "queued", "generating"].includes(props.task.status);
});

// 状态标签类型映射
const statusTagTypeMap: Record<
  ImageGenTaskStatus,
  "default" | "success" | "warning" | "error" | "info"
> = {
  pending: "default",
  queued: "info",
  generating: "warning",
  completed: "success",
  partial_failed: "warning",
  failed: "error",
  cancelled: "default",
};

// 状态文本映射
const statusTextMap: Record<ImageGenTaskStatus, string> = {
  pending: "待处理",
  queued: "排队中",
  generating: "生成中",
  completed: "已完成",
  partial_failed: "部分失败",
  failed: "失败",
  cancelled: "已取消",
};

// 场景类型文本映射
const sceneTypeTextMap: Record<string, string> = {
  character_views: "角色视图",
  scene_views: "场景视图",
  prop_views: "道具视图",
  storyboard_reference: "分镜参考",
  text_to_image: "文生图",
  image_to_image: "图生图",
};

// 步骤文本映射
const stepTextMap: Record<string, string> = {
  pending: "等待中",
  queued: "排队中",
  preparing: "准备中",
  generating: "生成中",
  uploading: "上传中",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

const statusTagType = computed(() => statusTagTypeMap[props.task.status]);
const statusText = computed(() => statusTextMap[props.task.status]);
const sceneTypeText = computed(
  () => sceneTypeTextMap[props.task.sceneType] || props.task.sceneType,
);

const previewResults = computed(() => {
  return props.task.results?.slice(0, 4) || [];
});

// 进度百分比（优先使用 WebSocket 数据）
const progressPercentage = computed(() => {
  return wsProgress.value?.percentage ?? props.task.progress?.percentage ?? 0;
});

// 当前步骤文本
const currentStepText = computed(() => {
  const step =
    wsProgress.value?.currentStep || props.task.progress?.currentStep;
  return stepTextMap[step] || step || "等待中";
});

// 是否正在处理中
const isProcessing = computed(() => {
  return ["pending", "queued", "generating"].includes(props.task.status);
});

// 进度条状态
const progressStatus = computed(() => {
  if (props.task.status === "failed") return "error";
  if (props.task.status === "completed") return "success";
  return "default";
});

// WebSocket 错误状态
const wsError = computed(() => {
  return (
    wsProgress.value?.status === "failed" && wsProgress.value?.errorMessage
  );
});

const progressText = computed(() => {
  // 优先使用 WebSocket 的进度数据
  if (wsProgress.value) {
    const completed = props.task.progress?.completed || 0;
    const total = props.task.progress?.total || 1;
    const failed = props.task.progress?.failed || 0;
    if (total === 0) return "";
    if (failed > 0) {
      return `${completed}/${total} (失败 ${failed})`;
    }
    return `${completed}/${total}`;
  }

  const { completed, total, failed } = props.task.progress;
  if (total === 0) return "";
  if (failed > 0) {
    return `${completed}/${total} (失败 ${failed})`;
  }
  return `${completed}/${total}`;
});

function formatTime(timeStr: string) {
  const date = new Date(timeStr);
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function handleClick() {
  emit("click", props.task.id);
}

// 组件挂载时订阅 WebSocket
onMounted(() => {
  if (isActiveTask.value) {
    // 确保 WebSocket 已连接
    if (!wsStore.isConnected) {
      wsStore.connect().catch(console.error);
    }

    // 订阅任务
    wsStore.subscribe(props.task.id, {
      onProgress: (data: GenerationProgressData) => {
        wsProgress.value = {
          percentage: data.progress,
          currentStep: data.currentStep,
          status: data.status,
        };
      },
      onComplete: () => {
        wsProgress.value = {
          percentage: 100,
          currentStep: "completed",
          status: "completed",
        };
        // 完成后取消订阅
        wsStore.unsubscribe(props.task.id);
      },
      onFailed: (data) => {
        wsProgress.value = {
          percentage: wsProgress.value?.percentage || 0,
          currentStep: "failed",
          status: "failed",
          errorMessage: data.errorMessage,
        };
        wsStore.unsubscribe(props.task.id);
      },
    });
  }
});

// 组件卸载时取消订阅
onUnmounted(() => {
  if (isActiveTask.value) {
    wsStore.unsubscribe(props.task.id);
  }
});
</script>

<style scoped lang="scss">
.image-gen-card {
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.create-time {
  font-size: 12px;
  color: var(--text-color-3);
}

.progress-section {
  margin-bottom: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--divider-color);
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
  font-size: 12px;

  .current-step {
    color: var(--text-color-2);
  }

  .percentage {
    color: var(--primary-color);
    font-weight: 500;
  }
}

.ws-error {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  font-size: 11px;
  color: var(--warning-color);
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-bottom: 12px;
  min-height: 120px;
}

.preview-item {
  aspect-ratio: 1;
  border-radius: 4px;
  overflow: hidden;
  background: var(--fill-color);

  &.is-failed {
    border: 1px solid var(--error-color);
  }

  :deep(.preview-image img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--fill-color);

  &.error {
    color: var(--error-color);
  }
}

.no-preview {
  grid-column: 1 / -1;
  height: 120px;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.scene-type {
  color: var(--text-color-2);
}

.progress {
  color: var(--text-color-3);
}
</style>
