<template>
  <div class="image-to-image-page">
    <PageHeader
      title="图生图"
      :breadcrumb="breadcrumb"
    />

    <div class="page-content two-column">
      <!-- 左侧：参数设置 -->
      <div class="settings-panel">
        <n-card title="生成设置">
          <GenerationSettings
            v-model="generationConfig"
            mode="image-to-image"
            @validate="isValid = $event"
          />

          <div class="cost-estimate">
            <span>预估消耗</span>
            <span class="cost">{{ estimatedCost }} 积分</span>
          </div>

          <n-button
            type="primary"
            size="large"
            block
            :loading="submitting"
            :disabled="!isValid"
            @click="handleSubmit"
          >
            开始生成
          </n-button>
        </n-card>
      </div>

      <!-- 右侧：预览和历史 -->
      <div class="preview-panel">
        <n-card title="实时预览">
          <!-- 生成进度 -->
          <ImageGenerationProgress
            v-if="activeTask"
            :progress="activeTask.progress"
            :status="activeTask.status"
          />

          <!-- 结果预览 -->
          <ImageResultGrid
            v-if="activeTask?.results?.length"
            :results="activeTask.results"
            @regenerate="handleRegenerate"
          />

          <n-empty
            v-else
            description="提交任务后将在此显示进度和结果"
          />
        </n-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { NCard, NButton, NEmpty } from "naive-ui";
import PageHeader from "@/components/PageHeader.vue";
import GenerationSettings from "../components/GenerationSettings.vue";
import ImageGenerationProgress from "../components/ImageGenerationProgress.vue";
import ImageResultGrid from "../components/ImageResultGrid.vue";
import { useImageGenerationStore } from "@/stores/imageGeneration";
import type { UnifiedImageGenerationConfig } from "@pixaura/shared-types";

const route = useRoute();
const imageGenStore = useImageGenerationStore();

const projectId = computed(() => route.params.id as string);

const breadcrumb = [
  { name: "项目", path: "/projects" },
  { name: "图片生成", path: `/projects/${projectId.value}/image-gen` },
  { name: "图生图" },
];

// 生成配置
const generationConfig = ref<UnifiedImageGenerationConfig>({
  modelId: "default",
  prompt: "",
  negativePrompt: "",
  width: 1024,
  height: 1024,
  seed: undefined,
  style: undefined,
  parameters: {},
  referenceImageUrl: "",
  strength: 0.7,
});

const isValid = ref(false);
const submitting = ref(false);
const currentTaskId = ref<string | null>(null);

// 预估成本（0.5 CNY = 50 积分/张）
const estimatedCost = computed(() => 50);

// 当前活跃任务
const activeTask = computed(() => {
  if (!currentTaskId.value) return null;
  return (
    imageGenStore.activeTasks.find((t) => t.id === currentTaskId.value) ||
    imageGenStore.taskList.find((t) => t.id === currentTaskId.value)
  );
});

// 轮询任务状态
let pollInterval: number | null = null;

function startPolling(taskId: string) {
  pollInterval = window.setInterval(async () => {
    await imageGenStore.fetchTaskDetail(taskId);
    const task = imageGenStore.currentTask;
    if (task && ["completed", "failed", "cancelled"].includes(task.status)) {
      stopPolling();
    }
  }, 2000);
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

async function handleSubmit() {
  if (!isValid.value) return;

  submitting.value = true;
  try {
    const result = await imageGenStore.createImageGeneration(projectId.value, {
      projectId: projectId.value,
      sceneType: "storyboard_reference",
      config: generationConfig.value,
      notifyWs: true,
    });

    currentTaskId.value = result.taskId;
    startPolling(result.taskId);
  } catch (error) {
    console.error("提交失败:", error);
  } finally {
    submitting.value = false;
  }
}

async function handleRegenerate(resultId: string) {
  await imageGenStore.regenerateImage(resultId, {});
}

onUnmounted(() => {
  stopPolling();
});
</script>

<style scoped lang="scss">
.image-to-image-page {
  padding: 24px;
}

.page-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-top: 24px;
}

.settings-panel {
  max-width: 500px;
}

.cost-estimate {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 24px 0;
  padding: 12px 16px;
  background: var(--fill-color);
  border-radius: 8px;

  .cost {
    font-weight: bold;
    color: var(--primary-color);
  }
}

@media (max-width: 1024px) {
  .page-content {
    grid-template-columns: 1fr;
  }

  .settings-panel {
    max-width: 100%;
  }
}
</style>
