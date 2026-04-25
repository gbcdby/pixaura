<template>
  <div class="shot-video-gen">
    <!-- 当前任务状态（如果有） -->
    <template v-if="currentTask && isActive">
      <VideoGenerationProgress
        :task="currentTask"
        @cancel="handleCancel"
      />

      <n-card
        v-if="currentTask.status === 'completed'"
        size="small"
        class="result-card"
      >
        <VideoPreview
          :outputs="currentTask.outputs"
          :status="currentTask.status"
          :video-mode="currentTask.config.videoMode"
          @regenerate="handleRegenerate"
        />
      </n-card>
    </template>

    <!-- 生成配置（没有任务或任务已结束） -->
    <template v-else>
      <n-form
        size="small"
        label-placement="left"
        label-width="80"
      >
        <n-form-item label="参考模式">
          <n-radio-group
            v-model:value="config.referenceMode"
            size="small"
          >
            <n-radio-button value="single_reference">
              单张参考图
            </n-radio-button>
            <n-radio-button value="multi_reference">
              多资产参考
            </n-radio-button>
          </n-radio-group>
        </n-form-item>

        <n-form-item label="生成模式">
          <n-radio-group
            v-model:value="config.videoMode"
            size="small"
          >
            <n-radio-button value="audio_reference">
              音频参考
            </n-radio-button>
            <n-radio-button value="lip_sync">
              对口型
            </n-radio-button>
            <n-radio-button value="video_only">
              纯视频
            </n-radio-button>
          </n-radio-group>
        </n-form-item>

        <n-form-item label="分辨率">
          <n-radio-group
            v-model:value="config.outputConfig.resolution"
            size="small"
          >
            <n-radio-button value="480p">
              480P
            </n-radio-button>
            <n-radio-button value="720p">
              720P
            </n-radio-button>
            <n-radio-button value="1080p">
              1080P
            </n-radio-button>
          </n-radio-group>
        </n-form-item>

        <n-form-item label="画面比例">
          <n-radio-group
            v-model:value="config.outputConfig.aspectRatio"
            size="small"
          >
            <n-radio-button value="9:16">
              竖屏
            </n-radio-button>
            <n-radio-button value="16:9">
              横屏
            </n-radio-button>
            <n-radio-button value="1:1">
              方形
            </n-radio-button>
          </n-radio-group>
        </n-form-item>
      </n-form>

      <!-- 生成按钮 -->
      <n-space
        justify="center"
        class="action-area"
      >
        <n-button
          v-if="currentTask?.status === 'failed'"
          type="primary"
          :loading="submitting"
          @click="handleRetry"
        >
          <template #icon>
            <n-icon :component="RefreshOutline" />
          </template>
          重试
        </n-button>

        <n-button
          v-else
          type="primary"
          :loading="submitting"
          @click="handleSubmit"
        >
          <template #icon>
            <n-icon :component="PlayOutline" />
          </template>
          生成视频
        </n-button>
      </n-space>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useVideoGenStore } from "@/stores/video-gen";
import { RefreshOutline, PlayOutline } from "@vicons/ionicons5";
import VideoGenerationProgress from "./VideoGenerationProgress.vue";
import VideoPreview from "./VideoPreview.vue";
import { useMessage } from "naive-ui";

const props = defineProps<{
  projectId: string;
  shotId: string;
}>();

const message = useMessage();
const store = useVideoGenStore();
const {
  currentTask,
  submitting,
  generationConfig: config,
} = storeToRefs(store);

const isActive = computed(() => {
  return ["pending", "queued", "generating"].includes(
    currentTask.value?.status || "",
  );
});

async function handleSubmit() {
  try {
    await store.createTask(props.projectId, props.shotId);
    message.success("任务已提交");
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
  await handleSubmit();
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
.shot-video-gen {
  padding: 8px 0;
}

.result-card {
  margin-top: 12px;
}

.action-area {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--n-border-color);
}
</style>
