<template>
  <n-card
    title="生成进度"
    class="generation-progress-card"
  >
    <!-- 总体进度 -->
    <div class="overall-progress">
      <n-progress
        type="circle"
        :percentage="task.progress.percentage"
        :status="progressStatus"
        :stroke-width="10"
      />
      <div class="status-text">
        <n-h3>{{ currentStepLabel }}</n-h3>
        <n-text depth="3">
          {{ statusDescription }}
        </n-text>
      </div>
    </div>

    <!-- 步骤详情 -->
    <n-steps
      vertical
      :current="currentStepIndex"
      class="steps-detail"
    >
      <n-step
        v-for="step in task.progress.steps"
        :key="step.name"
        :title="step.label"
        :status="getStepStatus(step)"
      >
        <template #description>
          <n-progress
            v-if="step.status === 'processing'"
            :percentage="step.progress"
            size="small"
            :show-indicator="false"
          />
          <n-text
            v-if="step.message"
            depth="3"
          >
            {{ step.message }}
          </n-text>
        </template>
      </n-step>
    </n-steps>

    <!-- 操作按钮 -->
    <n-space
      v-if="canCancel"
      justify="center"
      class="action-buttons"
    >
      <n-button
        :loading="cancelling"
        @click="handleCancel"
      >
        取消生成
      </n-button>
    </n-space>
  </n-card>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import type { VideoGenTaskDetailDto } from "@pixaura/shared-types";

const props = defineProps<{
  task: VideoGenTaskDetailDto;
}>();

const emit = defineEmits<{
  cancel: [];
}>();

const cancelling = ref(false);

const progressStatus = computed(() => {
  if (props.task.status === "failed") return "error";
  if (props.task.status === "completed") return "success";
  return "default";
});

const currentStepIndex = computed(() => {
  const index = props.task.progress.steps.findIndex(
    (s) => s.status === "processing",
  );
  return index >= 0 ? index : props.task.progress.steps.length;
});

const currentStepLabel = computed(() => {
  const step = props.task.progress.steps.find((s) => s.status === "processing");
  if (step) return step.label;
  if (props.task.status === "completed") return "生成完成";
  if (props.task.status === "failed") return "生成失败";
  return "等待中";
});

const statusDescription = computed(() => {
  switch (props.task.status) {
    case "pending":
      return "任务已提交，等待进入队列";
    case "queued":
      return "任务在队列中，即将开始生成";
    case "generating":
      return "正在生成视频中，请稍候";
    case "completed":
      return "视频生成成功";
    case "failed":
      return props.task.error?.message || "生成失败，请重试";
    case "cancelled":
      return "任务已取消";
    default:
      return "";
  }
});

const canCancel = computed(() => {
  return ["pending", "queued", "generating"].includes(props.task.status);
});

function getStepStatus(step: { status: string }) {
  switch (step.status) {
    case "completed":
      return "finish";
    case "processing":
      return "process";
    case "failed":
      return "error";
    default:
      return "wait";
  }
}

async function handleCancel() {
  cancelling.value = true;
  try {
    emit("cancel");
  } finally {
    cancelling.value = false;
  }
}
</script>

<style scoped>
.generation-progress-card {
  margin-bottom: 16px;
}

.overall-progress {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding: 24px 0;
}

.status-text {
  text-align: center;
}

.status-text h3 {
  margin: 0 0 8px;
}

.steps-detail {
  margin-top: 16px;
}

.action-buttons {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--n-border-color);
}
</style>
