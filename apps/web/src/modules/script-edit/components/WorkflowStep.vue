<script setup lang="ts">
import { computed } from "vue";
import { NCard, NSpace, NButton, NIcon, NTag, NProgress } from "naive-ui";
import {
  CheckmarkCircle,
  EllipsisHorizontal,
  AlertCircle,
  Refresh,
  TimeOutline,
} from "@vicons/ionicons5";

// 步骤状态类型
export type StepStatus =
  | "pending"
  | "waiting"
  | "processing"
  | "completed"
  | "failed"
  | "parsing";

// 定义Props
interface Props {
  stepId: string;
  title: string;
  status: StepStatus;
  stepNumber: number;
  description?: string;
  progress?: number;
  showModelSelector?: boolean;
  selectedModelId?: string;
  loading?: boolean;
  errorMessage?: string;
  actionButtons?: {
    key: string;
    label: string;
    type?: "primary" | "default" | "error";
    disabled?: boolean;
    loading?: boolean;
    icon?: unknown;
  }[];
}

const props = withDefaults(defineProps<Props>(), {
  description: "",
  progress: 0,
  showModelSelector: true,
  selectedModelId: "",
  loading: false,
  errorMessage: "",
  actionButtons: () => [],
});

// 定义Emits
const emit = defineEmits<{
  (e: "action", actionKey: string): void;
  (e: "modelChange", modelId: string): void;
  (e: "retry"): void;
}>();

// 状态标签映射
const statusMap: Record<
  StepStatus,
  {
    text: string;
    type: "default" | "primary" | "success" | "error" | "info" | "warning";
  }
> = {
  pending: { text: "待生成", type: "warning" },
  waiting: { text: "待开始", type: "default" },
  processing: { text: "待生成", type: "warning" },
  completed: { text: "已完成", type: "success" },
  failed: { text: "失败", type: "error" },
  parsing: { text: "待生成", type: "warning" },
};

// 状态图标
const statusIcon = computed(() => {
  switch (props.status) {
    case "completed":
      return CheckmarkCircle;
    case "processing":
      return TimeOutline; // 进行中 - 使用时钟图标
    case "parsing":
      return null; // 使用旋转动画（保留，但目前只显示文字）
    case "failed":
      return AlertCircle;
    case "pending":
      return TimeOutline; // 待生成 - 使用时钟图标
    case "waiting":
      return EllipsisHorizontal; // 待开始 - 使用三个点图标
    default:
      return EllipsisHorizontal;
  }
});

// 步骤样式类
const stepClass = computed(() => {
  return {
    "workflow-step": true,
    [`status-${props.status}`]: true,
    "is-loading": props.loading,
  };
});

// 处理操作按钮点击
function handleActionClick(actionKey: string) {
  emit("action", actionKey);
}

// 处理重试
function handleRetry() {
  emit("retry");
}
</script>

<template>
  <n-card
    :class="stepClass"
    :bordered="false"
    class="workflow-step-card"
  >
    <!-- 步骤头部 -->
    <div class="step-header">
      <div class="step-info">
        <div class="step-number">
          {{ stepNumber }}
        </div>
        <div class="step-title-wrapper">
          <h3 class="step-title">
            {{ title }}
          </h3>
          <p
            v-if="description"
            class="step-description"
          >
            {{ description }}
          </p>
        </div>
      </div>

      <div class="step-header-right">
        <!-- 模型选择器插槽（放在状态标签左侧） -->
        <div
          v-if="showModelSelector && $slots.modelSelector"
          class="step-model-selector-inline"
        >
          <span class="selector-label">模型：</span>
          <slot name="modelSelector" />
        </div>

        <div class="step-status">
          <n-tag
            :type="statusMap[status].type"
            size="small"
            class="status-tag"
            round
          >
            <template #icon>
              <n-icon
                v-if="statusIcon"
                :component="statusIcon"
              />
              <!-- 移除 n-spin，processing/parsing 状态只显示文字 -->
            </template>
            {{ statusMap[status].text }}
          </n-tag>
        </div>
      </div>
    </div>

    <!-- 进度条（仅在处理中状态显示） -->
    <div
      v-if="status === 'processing' && progress > 0"
      class="step-progress"
    >
      <n-progress
        type="line"
        :percentage="progress"
        :indicator-placement="'inside'"
        :processing="true"
        :height="6"
        :border-radius="3"
        fill-border-radius="3"
      />
    </div>

    <!-- 错误信息 -->
    <div
      v-if="status === 'failed' && errorMessage"
      class="step-error"
    >
      <n-icon :component="AlertCircle" />
      <span>{{ errorMessage }}</span>
      <n-button
        text
        type="primary"
        size="small"
        @click="handleRetry"
      >
        <template #icon>
          <n-icon :component="Refresh" />
        </template>
        重试
      </n-button>
    </div>

    <!-- 内容区域 -->
    <div
      v-if="$slots.default"
      class="step-content"
      :class="{ 'is-loading': loading }"
    >
      <!-- Loading遮罩 -->
      <div
        v-if="loading"
        class="loading-overlay"
      >
        <n-spin size="medium" />
        <span class="loading-text">处理中...</span>
      </div>

      <slot />
    </div>

    <!-- 操作按钮区域 -->
    <div
      v-if="actionButtons.length > 0"
      class="step-actions"
    >
      <n-space>
        <n-button
          v-for="btn in actionButtons"
          :key="btn.key"
          :type="btn.type || 'default'"
          :disabled="btn.disabled || loading"
          :loading="btn.loading"
          size="medium"
          @click="handleActionClick(btn.key)"
        >
          <template
            v-if="btn.icon"
            #icon
          >
            <n-icon :component="btn.icon" />
          </template>
          {{ btn.label }}
        </n-button>
      </n-space>
    </div>

    <!-- 底部插槽 -->
    <div
      v-if="$slots.footer"
      class="step-footer"
    >
      <slot name="footer" />
    </div>
  </n-card>
</template>

<style scoped lang="scss">
.workflow-step-card {
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  transition: all 0.3s ease;

  &:hover {
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
  }

  &.status-processing {
    box-shadow: 0 4px 24px rgba(32, 128, 240, 0.1);
  }

  &.status-completed {
    border: 1px solid #e8f5e9;
  }

  &.status-failed {
    border: 1px solid #ffebee;
  }

  :deep(.n-card__content) {
    padding: 24px;
  }
}

.step-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.step-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.step-number {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: linear-gradient(135deg, #f0f0f0 0%, #e8e8e8 100%);
  color: #999;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  flex-shrink: 0;
  transition: all 0.3s ease;

  .status-completed & {
    background: linear-gradient(135deg, #18a058 0%, #36ad6a 100%);
    color: #fff;
  }

  .status-failed & {
    background: linear-gradient(135deg, #d03050 0%, #de576d 100%);
    color: #fff;
  }

  .status-processing & {
    background: linear-gradient(135deg, #2080f0 0%, #4098ff 100%);
    color: #fff;
    animation: pulse 2s ease-in-out infinite;
  }
}

@keyframes pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(32, 128, 240, 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(32, 128, 240, 0);
  }
}

.step-title-wrapper {
  flex: 1;
}

.step-title {
  margin: 0 0 4px;
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
}

.step-description {
  margin: 0;
  font-size: 13px;
  color: #999;
  line-height: 1.5;
}

.step-header-right {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
  margin-left: auto;
  padding-left: 16px;
}

.step-model-selector-inline {
  display: flex;
  align-items: center;
  gap: 8px;

  .selector-label {
    font-size: 13px;
    color: #666;
    flex-shrink: 0;
  }

  :deep(.n-base-selection) {
    min-width: 160px;
  }

  :deep(.n-base-selection-label),
  :deep(.n-base-selection-input) {
    display: flex;
    align-items: center;
    white-space: nowrap !important;
  }

  :deep(.n-base-selection-label > .n-space) {
    flex-wrap: nowrap !important;
    gap: 6px;
  }
}

.step-status {
  flex-shrink: 0;
}

.status-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
}

.step-progress {
  margin-bottom: 20px;
  padding: 0 4px;
}

.step-error {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #fff5f5;
  border-radius: 12px;
  margin-bottom: 20px;
  color: #cf1322;
  font-size: 14px;

  .n-icon {
    font-size: 20px;
    flex-shrink: 0;
  }

  span {
    flex: 1;
  }
}

.step-content {
  position: relative;
  min-height: 100px;

  &.is-loading {
    pointer-events: none;
  }
}

.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  z-index: 10;
  border-radius: 12px;
  backdrop-filter: blur(4px);

  .loading-text {
    font-size: 14px;
    color: #666;
    font-weight: 500;
  }
}

.step-actions {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #f5f5f5;
  display: flex;
  justify-content: flex-end;
}

.step-footer {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #f5f5f5;
}

// 响应式适配
@media (max-width: 768px) {
  .step-header {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }

  .step-info {
    width: 100%;
  }

  .step-status {
    align-self: flex-start;
  }

  .step-model-selector-inline {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    width: 100%;
  }
}
</style>
