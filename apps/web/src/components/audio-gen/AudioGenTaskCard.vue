<script setup lang="ts">
import { computed } from "vue";
import { NCard, NButton, NTag, NProgress } from "naive-ui";
import type { AudioGenTaskDetailDto } from "@pixaura/shared-types";

const props = defineProps<{
  task: AudioGenTaskDetailDto;
}>();

const emit = defineEmits<{
  cancel: [taskId: string];
  delete: [taskId: string];
}>();

const isProcessing = computed(() => {
  return ["pending", "queued", "processing"].includes(props.task.status);
});

// 本地状态描述映射
const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: "待提交", color: "default" },
  queued: { label: "排队中", color: "warning" },
  processing: { label: "处理中", color: "processing" },
  completed: { label: "已完成", color: "success" },
  failed: { label: "失败", color: "error" },
  cancelled: { label: "已取消", color: "default" },
};

const typeMap: Record<string, { label: string }> = {
  tts: { label: "语音合成" },
  lip_sync: { label: "对口型" },
  bgm: { label: "背景音乐" },
  ambience: { label: "环境音效" },
  mixing: { label: "音频混音" },
};

const statusDesc = computed(
  () =>
    statusMap[props.task.status] || {
      label: props.task.status,
      color: "default",
    },
);
const typeDesc = computed(
  () => typeMap[props.task.type] || { label: props.task.type },
);
</script>

<template>
  <NCard
    size="small"
    class="task-card"
  >
    <div class="task-header">
      <div class="task-info">
        <NTag
          :type="statusDesc.color as any"
          size="small"
        >
          {{ statusDesc.label }}
        </NTag>
        <span class="task-type">{{ typeDesc.label }}</span>
        <span class="task-id">{{ task.id.slice(0, 8) }}...</span>
      </div>
      <div class="task-actions">
        <NButton
          v-if="isProcessing"
          text
          type="warning"
          size="small"
          @click="emit('cancel', task.id)"
        >
          取消
        </NButton>
        <NButton
          text
          type="error"
          size="small"
          @click="emit('delete', task.id)"
        >
          删除
        </NButton>
      </div>
    </div>

    <div
      v-if="task.config.ttsConfig"
      class="task-details"
    >
      <div class="detail-item">
        <span class="label">文本:</span>
        <span class="value">{{ task.config.ttsConfig.text }}</span>
      </div>
    </div>

    <div
      v-if="isProcessing"
      class="task-progress"
    >
      <NProgress
        :percentage="task.progress.percentage"
        processing
      />
      <div class="progress-step">
        {{ task.progress.currentStep }}
      </div>
    </div>

    <div class="task-cost">
      <span class="cost-label">预估成本:</span>
      <span class="cost-value">{{ task.cost.estimatedCost }} {{ task.cost.currency }}</span>
    </div>
  </NCard>
</template>

<style scoped>
.task-card {
  margin-bottom: 12px;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.task-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.task-type {
  font-weight: 500;
  color: #333;
}

.task-id {
  font-size: 12px;
  color: #999;
}

.task-actions {
  display: flex;
  gap: 8px;
}

.task-details {
  margin-top: 8px;
  padding: 8px;
  background: #f5f5f5;
  border-radius: 4px;
}

.detail-item {
  display: flex;
  gap: 8px;
}

.detail-item .label {
  color: #666;
  font-size: 12px;
}

.detail-item .value {
  color: #333;
  font-size: 12px;
}

.task-progress {
  margin-top: 8px;
}

.progress-step {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
}

.task-cost {
  margin-top: 8px;
  font-size: 12px;
  color: #666;
}

.cost-value {
  color: #f0a020;
  font-weight: 500;
}
</style>
