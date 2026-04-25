<template>
  <n-card
    class="video-generation-panel"
    :bordered="false"
  >
    <n-tabs
      v-model:value="activeTab"
      type="line"
      animated
    >
      <n-tab-pane
        name="single"
        tab="单个生成"
      >
        <div class="panel-content">
          <!-- 模式选择 -->
          <n-card
            title="生成设置"
            size="small"
          >
            <GenerationModeSelector
              v-model:reference-mode="config.referenceMode"
              v-model:video-mode="config.videoMode"
              :shot-type="shotType"
            />
          </n-card>

          <!-- 输出配置 -->
          <n-card
            title="输出配置"
            size="small"
            class="config-card"
          >
            <OutputConfig
              v-model:resolution="config.outputConfig.resolution"
              v-model:aspect-ratio="config.outputConfig.aspectRatio"
            />
          </n-card>

          <!-- 预览与生成 -->
          <n-card
            v-if="canShowPreview"
            title="生成预览"
            size="small"
            class="preview-card"
          >
            <VideoGenerationProgress
              v-if="isGenerating || hasResult"
              :task="currentTask!"
              @cancel="handleCancel"
            />

            <VideoPreview
              v-if="hasResult"
              :outputs="currentTask?.outputs"
              :status="currentTask?.status"
              :video-mode="currentTask?.config.videoMode"
              @regenerate="handleRegenerate"
            />

            <!-- 生成按钮 -->
            <n-space
              v-if="!isGenerating"
              justify="center"
              class="action-area"
            >
              <n-button
                v-if="
                  currentTask?.status === 'failed' ||
                    currentTask?.status === 'cancelled'
                "
                type="primary"
                size="large"
                :loading="submitting"
                @click="handleRetry"
              >
                <template #icon>
                  <n-icon :component="RefreshOutline" />
                </template>
                重试生成
              </n-button>

              <n-button
                v-else-if="currentTask?.status === 'completed'"
                type="primary"
                size="large"
                :loading="submitting"
                @click="handleRegenerate"
              >
                <template #icon>
                  <n-icon :component="VideocamOutline" />
                </template>
                重新生成
              </n-button>

              <n-button
                v-else
                type="primary"
                size="large"
                :loading="submitting"
                @click="handleSubmit"
              >
                <template #icon>
                  <n-icon :component="PlayOutline" />
                </template>
                开始生成
              </n-button>
            </n-space>
          </n-card>

          <!-- 错误提示 -->
          <n-alert
            v-if="currentTask?.error"
            type="error"
            :title="'生成失败'"
            class="error-alert"
          >
            {{ currentTask.error.message }}
          </n-alert>
        </div>
      </n-tab-pane>

      <n-tab-pane
        name="batch"
        tab="批量生成"
      >
        <n-empty
          description="批量生成功能开发中"
          class="empty-batch"
        />
      </n-tab-pane>
    </n-tabs>
  </n-card>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { storeToRefs } from "pinia";
import { useVideoGenStore } from "@/stores/video-gen";
import GenerationModeSelector from "./GenerationModeSelector.vue";
import OutputConfig from "./OutputConfig.vue";
import VideoGenerationProgress from "./VideoGenerationProgress.vue";
import VideoPreview from "./VideoPreview.vue";
import {
  PlayOutline,
  RefreshOutline,
  VideocamOutline,
} from "@vicons/ionicons5";
import { useMessage } from "naive-ui";

const props = defineProps<{
  projectId: string;
  shotId?: string;
  shotType?: string;
}>();

const message = useMessage();
const store = useVideoGenStore();
const {
  currentTask,
  submitting,
  generationConfig: config,
} = storeToRefs(store);

const activeTab = ref("single");

const isGenerating = computed(() => {
  return ["pending", "queued", "generating"].includes(
    currentTask.value?.status || "",
  );
});

const hasResult = computed(() => {
  return (
    currentTask.value?.status === "completed" ||
    currentTask.value?.status === "failed" ||
    currentTask.value?.status === "cancelled"
  );
});

const canShowPreview = computed(() => {
  return !!currentTask.value || !props.shotId;
});

async function handleSubmit() {
  if (!props.shotId) {
    message.warning("请先选择分镜");
    return;
  }

  try {
    await store.createTask(props.projectId, props.shotId);
    message.success("任务已提交，开始生成视频");
  } catch (error: any) {
    message.error(error.message || "提交失败");
  }
}

async function handleRetry() {
  if (!currentTask.value) return;

  try {
    await store.retryTask(currentTask.value.id);
    message.success("任务已重新提交");
  } catch (error: any) {
    message.error(error.message || "重试失败");
  }
}

async function handleRegenerate() {
  if (!props.shotId) return;

  try {
    await store.createTask(props.projectId, props.shotId);
    message.success("任务已提交");
  } catch (error: any) {
    message.error(error.message || "提交失败");
  }
}

async function handleCancel() {
  if (!currentTask.value) return;

  try {
    await store.cancelTask(currentTask.value.id);
    message.info("任务已取消");
  } catch (error: any) {
    message.error(error.message || "取消失败");
  }
}
</script>

<style scoped>
.video-generation-panel {
  min-height: 500px;
}

.panel-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 0;
}

.config-card,
.preview-card {
  margin-top: 8px;
}

.action-area {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--n-border-color);
}

.error-alert {
  margin-top: 16px;
}

.empty-batch {
  padding: 48px 0;
}
</style>
