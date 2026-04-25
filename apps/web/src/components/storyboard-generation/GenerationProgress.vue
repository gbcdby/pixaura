<template>
  <div class="generation-progress">
    <!-- 进度头部 -->
    <div class="progress-header">
      <div class="progress-title">
        <span class="job-name">生成任务 {{ jobId.slice(-6) }}</span>
        <n-tag
          :type="statusType"
          size="small"
        >
          {{ statusText }}
        </n-tag>
      </div>
      <n-button
        v-if="canCancel"
        size="small"
        type="error"
        ghost
        @click="handleCancel"
      >
        取消任务
      </n-button>
    </div>

    <!-- 总进度条 -->
    <div class="progress-main">
      <div class="progress-info">
        <span class="stage-name">{{ currentStage }}</span>
        <span class="percentage">{{ progressPercentage }}%</span>
      </div>
      <n-progress
        :percentage="progressPercentage"
        :status="progressStatus"
        :processing="isProcessing"
        :show-indicator="false"
        type="line"
      />
      <div class="progress-detail">
        <span>已完成 {{ completedCount }} / {{ totalCount || "?" }}</span>
        <span
          v-if="failedCount > 0"
          class="failed-count"
        >
          失败 {{ failedCount }} 个
        </span>
        <span
          v-if="estimatedTime"
          class="estimated-time"
        >
          预计剩余 {{ estimatedTime }}
        </span>
      </div>
    </div>

    <!-- 阶段时间线 -->
    <div class="stage-timeline">
      <div
        v-for="stage in stages"
        :key="stage.key"
        class="stage-item"
        :class="{
          'is-completed': stage.isCompleted,
          'is-active': stage.isActive,
          'is-pending': stage.isPending,
        }"
      >
        <div class="stage-icon">
          <n-icon
            v-if="stage.isCompleted"
            :component="CheckmarkCircle"
          />
          <n-icon
            v-else-if="stage.isActive"
            :component="Time"
          />
          <n-icon
            v-else
            :component="Circle"
          />
        </div>
        <div class="stage-content">
          <div class="stage-name">
            {{ stage.name }}
          </div>
          <div
            v-if="stage.time"
            class="stage-time"
          >
            {{ stage.time }}
          </div>
          <div
            v-if="stage.detail"
            class="stage-detail"
          >
            {{ stage.detail }}
          </div>
        </div>
      </div>
    </div>

    <!-- 实时日志 -->
    <div
      v-if="showLogs && logs.length > 0"
      class="progress-logs"
    >
      <div class="logs-header">
        <span>实时日志</span>
        <n-button
          text
          size="tiny"
          @click="clearLogs"
        >
          清空
        </n-button>
      </div>
      <div
        ref="logsRef"
        class="logs-content"
      >
        <div
          v-for="(log, index) in displayedLogs"
          :key="index"
          class="log-item"
          :class="`log-${log.level}`"
        >
          <span class="log-time">{{ formatTime(log.timestamp) }}</span>
          <span class="log-message">{{ log.message }}</span>
        </div>
      </div>
    </div>

    <!-- 已生成预览 -->
    <div
      v-if="generatedItems.length > 0"
      class="generated-preview"
    >
      <div class="preview-header">
        <span>已生成分镜预览</span>
        <span class="preview-count">已生成 {{ generatedItems.length }} 个</span>
      </div>
      <div class="preview-grid">
        <div
          v-for="item in displayedItems"
          :key="item.id"
          class="preview-item"
        >
          <n-image
            v-if="item.previewImageUrl"
            :src="item.previewImageUrl"
            :preview-src="item.previewImageUrl"
            class="preview-image"
            object-fit="cover"
          />
          <div
            v-else
            class="preview-placeholder"
          >
            <n-icon :component="Image" />
          </div>
          <div class="preview-number">
            #{{ item.sequenceNumber }}
          </div>
        </div>
      </div>
    </div>

    <!-- 完成后操作 -->
    <div
      v-if="isCompleted"
      class="completion-actions"
    >
      <n-button
        type="primary"
        size="large"
        @click="handleViewResults"
      >
        查看生成分镜
      </n-button>
      <n-text depth="3">
        {{ countdownText }}
      </n-text>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from "vue";
import {
  NProgress,
  NTag,
  NButton,
  NIcon,
  NImage,
  NText,
  useDialog,
} from "naive-ui";
import {
  CheckmarkCircle,
  Time,
  RadioButtonOff as Circle,
  Image,
} from "@vicons/ionicons5";
import type { GenerationItem, GenerationLog } from "@pixaura/shared-types";

const props = defineProps<{
  jobId: string;
  status: string;
  progress: number;
  currentStage?: string;
  completedCount: number;
  totalCount?: number;
  failedCount: number;
  logs: GenerationLog[];
  generatedItems: GenerationItem[];
  canCancel: boolean;
  isProcessing: boolean;
  isCompleted: boolean;
  showLogs?: boolean;
}>();

const emit = defineEmits<{
  cancel: [];
  viewResults: [];
  clearLogs: [];
}>();

const dialog = useDialog();
const logsRef = ref<HTMLElement | null>(null);

// 阶段定义
const stageDefinitions = [
  { key: "parsing", name: "剧本解析" },
  { key: "generating", name: "AI生成分镜" },
  { key: "mapping", name: "资产映射" },
  { key: "preview", name: "生成预览图" },
  { key: "completed", name: "生成完成" },
];

// 计算属性
const progressPercentage = computed(() =>
  Math.min(100, Math.max(0, props.progress)),
);

const statusType = computed(() => {
  switch (props.status) {
    case "completed":
      return "success";
    case "failed":
    case "cancelled":
      return "error";
    case "pending":
    case "parsing":
    case "generating":
    case "mapping":
    case "preview":
      return "info";
    default:
      return "default";
  }
});

const statusText = computed(() => {
  const statusMap: Record<string, string> = {
    pending: "等待中",
    parsing: "解析中",
    generating: "生成中",
    mapping: "映射中",
    preview: "生成预览图",
    completed: "已完成",
    failed: "失败",
    cancelled: "已取消",
  };
  return statusMap[props.status] || props.status;
});

const progressStatus = computed(() => {
  if (props.status === "failed") return "error";
  if (props.status === "cancelled") return "warning";
  if (props.status === "completed") return "success";
  return "default";
});

const estimatedTime = computed(() => {
  if (!props.totalCount || props.completedCount >= props.totalCount) {
    return "";
  }
  const remaining = props.totalCount - props.completedCount;
  const minutes = Math.ceil(remaining * 0.5); // 假设每个分镜需要30秒
  if (minutes < 1) return "不到1分钟";
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours} 小时 ${mins} 分钟`;
});

const stages = computed(() => {
  const currentStageKey = props.currentStage || "parsing";
  return stageDefinitions.map((stage) => {
    const isCompleted = isStageCompleted(stage.key, currentStageKey);
    const isActive = stage.key === currentStageKey;
    const isPending = !isCompleted && !isActive;

    // 查找该阶段的日志时间
    const stageLog = props.logs.find((log) => log.stage === stage.key);

    return {
      ...stage,
      isCompleted,
      isActive,
      isPending,
      time: stageLog ? formatTime(stageLog.timestamp, true) : undefined,
      detail: getStageDetail(stage.key),
    };
  });
});

const displayedLogs = computed(() => {
  // 最多显示最近20条日志
  return props.logs.slice(-20);
});

const displayedItems = computed(() => {
  // 最多显示12个预览
  return props.generatedItems.slice(0, 12);
});

// 倒计时
const countdown = ref(3);
const countdownText = computed(() => {
  if (countdown.value > 0) {
    return `${countdown.value} 秒后自动跳转...`;
  }
  return "";
});

// 监听完成状态，启动倒计时
watch(
  () => props.isCompleted,
  (completed) => {
    if (completed) {
      countdown.value = 3;
      const timer = setInterval(() => {
        countdown.value--;
        if (countdown.value <= 0) {
          clearInterval(timer);
          emit("viewResults");
        }
      }, 1000);
    }
  },
);

// 监听日志变化，自动滚动
watch(
  () => props.logs.length,
  async () => {
    await nextTick();
    if (logsRef.value) {
      logsRef.value.scrollTop = logsRef.value.scrollHeight;
    }
  },
);

// 方法
function isStageCompleted(stageKey: string, currentKey: string): boolean {
  const order = ["parsing", "generating", "mapping", "preview", "completed"];
  const stageIndex = order.indexOf(stageKey);
  const currentIndex = order.indexOf(currentKey);
  return stageIndex < currentIndex;
}

function getStageDetail(stageKey: string): string | undefined {
  switch (stageKey) {
    case "parsing":
      return props.completedCount > 0
        ? `识别出 ${props.completedCount} 个场景`
        : undefined;
    case "generating":
      return props.completedCount > 0
        ? `生成 ${props.completedCount} 个分镜`
        : undefined;
    case "mapping":
      return "映射角色和场景关联";
    case "preview":
      return props.completedCount > 0
        ? `${props.completedCount}/${props.totalCount || "?"}`
        : undefined;
    default:
      return undefined;
  }
}

function formatTime(timestamp: string, short = false): string {
  const date = new Date(timestamp);
  if (short) {
    return date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function handleCancel() {
  dialog.warning({
    title: "确认取消",
    content: "取消后任务将停止，已生成的分镜将保留。确定要取消吗？",
    positiveText: "确认取消",
    negativeText: "继续生成",
    onPositiveClick: () => {
      emit("cancel");
    },
  });
}

function handleViewResults() {
  emit("viewResults");
}

function clearLogs() {
  emit("clearLogs");
}
</script>

<style scoped lang="scss">
.generation-progress {
  padding: 24px;
  background: var(--fill-color);
  border-radius: 12px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;

  .progress-title {
    display: flex;
    align-items: center;
    gap: 12px;

    .job-name {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-color);
    }
  }
}

.progress-main {
  margin-bottom: 24px;
  padding: 16px;
  background: var(--card-color);
  border-radius: 8px;

  .progress-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;

    .stage-name {
      font-weight: 500;
      color: var(--text-color);
    }

    .percentage {
      font-size: 14px;
      color: var(--text-color-2);
    }
  }

  .progress-detail {
    display: flex;
    gap: 16px;
    margin-top: 8px;
    font-size: 12px;
    color: var(--text-color-3);

    .failed-count {
      color: var(--error-color);
    }

    .estimated-time {
      margin-left: auto;
    }
  }
}

.stage-timeline {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;

  .stage-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
    border-radius: 8px;
    transition: all 0.3s;

    &.is-completed {
      .stage-icon {
        color: var(--success-color);
      }
    }

    &.is-active {
      background: var(--card-color);

      .stage-icon {
        color: var(--primary-color);
        animation: pulse 2s infinite;
      }
    }

    &.is-pending {
      opacity: 0.6;

      .stage-icon {
        color: var(--text-color-3);
      }
    }

    .stage-icon {
      font-size: 20px;
      margin-top: 2px;
    }

    .stage-content {
      flex: 1;

      .stage-name {
        font-weight: 500;
        color: var(--text-color);
      }

      .stage-time {
        font-size: 12px;
        color: var(--text-color-3);
        margin-top: 2px;
      }

      .stage-detail {
        font-size: 12px;
        color: var(--text-color-2);
        margin-top: 4px;
      }
    }
  }
}

.progress-logs {
  margin-bottom: 24px;
  background: var(--card-color);
  border-radius: 8px;
  overflow: hidden;

  .logs-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--divider-color);
    font-weight: 500;
  }

  .logs-content {
    max-height: 200px;
    overflow-y: auto;
    padding: 12px 16px;

    .log-item {
      display: flex;
      gap: 12px;
      padding: 4px 0;
      font-size: 12px;
      font-family: monospace;

      .log-time {
        color: var(--text-color-3);
        flex-shrink: 0;
      }

      .log-message {
        color: var(--text-color);
      }

      &.log-warning {
        .log-message {
          color: var(--warning-color);
        }
      }

      &.log-error {
        .log-message {
          color: var(--error-color);
        }
      }
    }
  }
}

.generated-preview {
  margin-bottom: 24px;

  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    font-weight: 500;

    .preview-count {
      font-size: 12px;
      color: var(--text-color-3);
      font-weight: normal;
    }
  }

  .preview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 8px;

    .preview-item {
      position: relative;
      aspect-ratio: 16 / 9;
      border-radius: 4px;
      overflow: hidden;
      background: var(--card-color);

      .preview-image {
        width: 100%;
        height: 100%;
      }

      .preview-placeholder {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-color-3);
        font-size: 24px;
      }

      .preview-number {
        position: absolute;
        bottom: 2px;
        left: 4px;
        font-size: 10px;
        color: white;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
      }
    }
  }
}

.completion-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px;
  background: var(--card-color);
  border-radius: 8px;
  text-align: center;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
