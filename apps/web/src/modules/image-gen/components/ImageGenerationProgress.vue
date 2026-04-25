<template>
  <div class="generation-progress">
    <div class="progress-header">
      <span class="step-name">{{ currentStep }}</span>
      <span class="percentage">{{ progress.percentage }}%</span>
    </div>
    <n-progress
      :percentage="progress.percentage"
      :status="progressStatus"
      :processing="isProcessing"
      :show-indicator="false"
    />
    <div class="progress-detail">
      <span>已完成 {{ progress.completed }} / {{ progress.total }}</span>
      <span
        v-if="progress.failed > 0"
        class="failed-count"
      >
        失败 {{ progress.failed }} 个
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NProgress } from "naive-ui";
import type { ImageGenProgress } from "@pixaura/shared-types";

const props = defineProps<{
  progress: ImageGenProgress;
  status: string;
}>();

const stepNameMap: Record<string, string> = {
  pending: "等待中",
  queued: "排队中",
  preparing: "准备中",
  generating: "生成中",
  uploading: "上传中",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

const currentStep = computed(
  () => stepNameMap[props.progress.currentStep] || props.progress.currentStep,
);

const isProcessing = computed(() =>
  ["pending", "queued", "generating"].includes(props.status),
);

const progressStatus = computed(() => {
  if (props.status === "failed") return "error";
  if (props.status === "cancelled") return "warning";
  if (props.status === "completed") return "success";
  return "default";
});
</script>

<style scoped lang="scss">
.generation-progress {
  padding: 16px;
  background: var(--fill-color);
  border-radius: 8px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.step-name {
  font-weight: 500;
  color: var(--text-color);
}

.percentage {
  font-size: 14px;
  color: var(--text-color-2);
}

.progress-detail {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-color-3);
}

.failed-count {
  color: var(--error-color);
}
</style>
