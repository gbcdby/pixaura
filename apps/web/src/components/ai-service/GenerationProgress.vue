<template>
  <div class="generation-progress">
    <div class="generation-progress__header">
      <h3 class="generation-progress__title">
        {{ title }}
      </h3>
      <button
        v-if="showCancel && !isCompleted && !isFailed"
        class="btn btn--text btn--danger"
        @click="$emit('cancel')"
      >
        取消
      </button>
    </div>

    <div class="generation-progress__status">
      <div
        class="status-icon"
        :class="`status-icon--${status}`"
      >
        <i
          v-if="status === 'pending'"
          class="icon-pending"
        >⏳</i>
        <i
          v-else-if="status === 'processing' || status === 'streaming'"
          class="icon-processing"
        >⚡</i>
        <i
          v-else-if="status === 'completed'"
          class="icon-completed"
        >✓</i>
        <i
          v-else-if="status === 'failed'"
          class="icon-failed"
        >✗</i>
        <i
          v-else-if="status === 'cancelled'"
          class="icon-cancelled"
        >⊘</i>
      </div>
      <div class="status-info">
        <div class="status-text">
          {{ statusText }}
        </div>
        <div
          v-if="stage"
          class="status-stage"
        >
          {{ stage }}
        </div>
      </div>
    </div>

    <div class="generation-progress__bar">
      <div
        class="progress-bar"
        :class="{ 'progress-bar--indeterminate': isIndeterminate }"
      >
        <div
          class="progress-bar__fill"
          :style="{ width: `${progress}%` }"
        />
      </div>
      <span class="progress-text">{{ progress }}%</span>
    </div>

    <div
      v-if="isStreaming && chunks.length > 0"
      class="generation-progress__preview"
    >
      <div class="preview-label">
        生成内容预览：
      </div>
      <div class="preview-content">
        {{ previewText }}
      </div>
    </div>

    <div
      v-if="errorMessage"
      class="generation-progress__error"
    >
      <div class="error-label">
        错误信息：
      </div>
      <div class="error-content">
        {{ errorMessage }}
      </div>
      <button
        v-if="showRetry"
        class="btn btn--primary btn--sm"
        @click="$emit('retry')"
      >
        重试
      </button>
    </div>

    <div
      v-if="isCompleted && result"
      class="generation-progress__result"
    >
      <div class="result-label">
        生成完成
      </div>
      <div
        v-if="usage"
        class="result-usage"
      >
        消耗：{{ usage.tokens }} tokens / ¥{{ usage.cost.toFixed(4) }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Props {
  title: string;
  status:
    | "pending"
    | "processing"
    | "streaming"
    | "completed"
    | "failed"
    | "cancelled";
  progress: number;
  stage?: string;
  chunks?: string[];
  errorMessage?: string;
  result?: Record<string, unknown>;
  usage?: { tokens: number; cost: number };
  showCancel?: boolean;
  showRetry?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  stage: "",
  chunks: () => [],
  errorMessage: "",
  result: undefined,
  usage: undefined,
  showCancel: true,
  showRetry: true,
});

defineEmits<{
  cancel: [];
  retry: [];
}>();

const isIndeterminate = computed(
  () =>
    props.status === "pending" ||
    (props.status === "processing" && props.progress === 0),
);

const isCompleted = computed(() => props.status === "completed");
const isFailed = computed(() => props.status === "failed");
const isStreaming = computed(() => props.status === "streaming");

const statusText = computed(() => {
  const texts: Record<string, string> = {
    pending: "排队中...",
    processing: "处理中...",
    streaming: "生成中...",
    completed: "已完成",
    failed: "生成失败",
    cancelled: "已取消",
  };
  return texts[props.status] || props.status;
});

const previewText = computed(() => {
  return props.chunks.join("");
});
</script>

<style scoped lang="scss">
.generation-progress {
  padding: 20px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  &__title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #333;
  }

  &__status {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;

    .status-icon {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;

      &--pending {
        background: #fff3e0;
      }

      &--processing,
      &--streaming {
        background: #e3f2fd;
        animation: pulse 2s infinite;
      }

      &--completed {
        background: #e8f5e9;
        color: #4caf50;
      }

      &--failed,
      &--cancelled {
        background: #ffebee;
        color: #f44336;
      }
    }

    .status-info {
      flex: 1;
    }

    .status-text {
      font-size: 14px;
      font-weight: 500;
      color: #333;
    }

    .status-stage {
      font-size: 12px;
      color: #666;
      margin-top: 2px;
    }
  }

  &__bar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;

    .progress-bar {
      flex: 1;
      height: 8px;
      background: #e0e0e0;
      border-radius: 4px;
      overflow: hidden;

      &--indeterminate {
        .progress-bar__fill {
          width: 30% !important;
          animation: indeterminate 1.5s infinite;
        }
      }

      &__fill {
        height: 100%;
        background: linear-gradient(90deg, #1976d2, #42a5f5);
        border-radius: 4px;
        transition: width 0.3s ease;
      }
    }

    .progress-text {
      font-size: 13px;
      color: #666;
      min-width: 40px;
      text-align: right;
    }
  }

  &__preview {
    margin-bottom: 16px;
    padding: 12px;
    background: #f5f5f5;
    border-radius: 4px;

    .preview-label {
      font-size: 12px;
      color: #999;
      margin-bottom: 8px;
    }

    .preview-content {
      font-size: 13px;
      color: #333;
      line-height: 1.6;
      max-height: 200px;
      overflow-y: auto;
      white-space: pre-wrap;
    }
  }

  &__error {
    padding: 12px;
    background: #ffebee;
    border-radius: 4px;
    margin-bottom: 16px;

    .error-label {
      font-size: 12px;
      color: #d32f2f;
      margin-bottom: 4px;
    }

    .error-content {
      font-size: 13px;
      color: #f44336;
      margin-bottom: 12px;
    }
  }

  &__result {
    padding: 12px;
    background: #e8f5e9;
    border-radius: 4px;

    .result-label {
      font-size: 14px;
      font-weight: 500;
      color: #4caf50;
      margin-bottom: 4px;
    }

    .result-usage {
      font-size: 12px;
      color: #666;
    }
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

@keyframes indeterminate {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(300%);
  }
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;

  &--text {
    background: transparent;
    padding: 4px 8px;
  }

  &--danger {
    color: #d32f2f;

    &:hover {
      background: #ffebee;
    }
  }

  &--primary {
    background: #1976d2;
    color: #fff;

    &:hover {
      background: #1565c0;
    }
  }

  &--sm {
    padding: 6px 12px;
    font-size: 13px;
  }
}
</style>
