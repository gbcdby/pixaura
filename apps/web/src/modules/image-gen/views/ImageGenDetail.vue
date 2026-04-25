<template>
  <div
    v-if="task"
    class="image-gen-detail-page"
  >
    <PageHeader
      :title="pageTitle"
      :breadcrumb="breadcrumb"
    >
      <template #action>
        <n-button
          v-if="canCancel"
          @click="handleCancel"
        >
          取消任务
        </n-button>
        <n-button
          v-if="canDelete"
          type="error"
          @click="handleDelete"
        >
          删除
        </n-button>
      </template>
    </PageHeader>

    <div class="page-content">
      <!-- 任务信息 -->
      <n-card
        title="任务信息"
        class="info-card"
      >
        <n-descriptions :columns="4">
          <n-descriptions-item label="任务ID">
            {{ task.id }}
          </n-descriptions-item>
          <n-descriptions-item label="状态">
            <n-tag :type="statusTagType">
              {{ statusText }}
            </n-tag>
          </n-descriptions-item>
          <n-descriptions-item label="场景类型">
            {{ sceneTypeText }}
          </n-descriptions-item>
          <n-descriptions-item label="创建时间">
            {{ formatTime(task.createdAt) }}
          </n-descriptions-item>
          <n-descriptions-item label="模型">
            {{ modelName }}
          </n-descriptions-item>
          <n-descriptions-item label="消耗">
            {{ actualCost }} 积分
          </n-descriptions-item>
          <n-descriptions-item label="图片尺寸">
            {{ imageSize }}
          </n-descriptions-item>
          <n-descriptions-item label="耗时">
            {{ duration }}
          </n-descriptions-item>
        </n-descriptions>
      </n-card>

      <!-- 生成进度 -->
      <n-card
        v-if="isProcessing"
        title="生成进度"
      >
        <ImageGenerationProgress
          :progress="task.progress"
          :status="task.status"
        />
      </n-card>

      <!-- 生成结果 -->
      <n-card title="生成结果">
        <ImageResultGrid
          v-if="task.results?.length"
          :results="task.results"
          :show-actions="true"
          @regenerate="handleRegenerate"
          @download="handleDownload"
          @delete="handleDeleteResult"
        />
        <n-empty
          v-else
          description="暂无生成结果"
        />
      </n-card>

      <!-- 生成参数 -->
      <n-card
        title="生成参数"
        class="params-card"
      >
        <n-code
          :code="JSON.stringify(task.config, null, 2)"
          language="json"
        />
      </n-card>
    </div>
  </div>
  <n-spin v-else />
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  NButton,
  NTag,
  NCard,
  NDescriptions,
  NDescriptionsItem,
  NCode,
  NEmpty,
  NSpin,
} from "naive-ui";
import PageHeader from "@/components/PageHeader.vue";
import ImageGenerationProgress from "../components/ImageGenerationProgress.vue";
import ImageResultGrid from "../components/ImageResultGrid.vue";
import { useImageGenerationStore } from "@/stores/imageGeneration";
import type {
  ImageGenTaskStatus,
  ImageGenResultDto,
} from "@pixaura/shared-types";

const route = useRoute();
const router = useRouter();
const imageGenStore = useImageGenerationStore();

const projectId = computed(() => route.params.id as string);
const taskId = computed(() => route.params.taskId as string);

const task = computed(() => imageGenStore.currentTask);

const pageTitle = computed(() => "生成详情");

const breadcrumb = [
  { name: "项目", path: "/projects" },
  { name: "图片生成", path: `/projects/${projectId.value}/image-gen` },
  { name: "生成详情" },
];

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

const statusTextMap: Record<ImageGenTaskStatus, string> = {
  pending: "待处理",
  queued: "排队中",
  generating: "生成中",
  completed: "已完成",
  partial_failed: "部分失败",
  failed: "失败",
  cancelled: "已取消",
};

const sceneTypeTextMap: Record<string, string> = {
  character_views: "角色视图",
  scene_views: "场景视图",
  prop_views: "道具视图",
  storyboard_reference: "分镜参考",
  text_to_image: "文生图",
  image_to_image: "图生图",
};

const statusTagType = computed(
  () => statusTagTypeMap[task.value?.status || "pending"],
);
const statusText = computed(
  () => statusTextMap[task.value?.status || "pending"],
);
const sceneTypeText = computed(
  () => sceneTypeTextMap[task.value?.sceneType || ""] || task.value?.sceneType,
);

const modelName = computed(() => {
  return (task.value?.config as { modelId?: string })?.modelId || "默认模型";
});

const actualCost = computed(() => task.value?.cost?.actualCost || 0);

const imageSize = computed(() => {
  const config = task.value?.config as {
    textConfig?: { width: number; height: number };
    imageConfig?: { width?: number; height?: number };
    batchConfig?: { width: number; height: number };
  };
  if (config?.textConfig) {
    return `${config.textConfig.width}x${config.textConfig.height}`;
  }
  if (config?.imageConfig) {
    return `${config.imageConfig.width || 1024}x${config.imageConfig.height || 1024}`;
  }
  if (config?.batchConfig) {
    return `${config.batchConfig.width}x${config.batchConfig.height}`;
  }
  return "-";
});

const duration = computed(() => {
  if (!task.value?.createdAt) return "-";
  const start = new Date(task.value.createdAt);
  const end = task.value.completedAt
    ? new Date(task.value.completedAt)
    : new Date();
  const diff = Math.floor((end.getTime() - start.getTime()) / 1000);
  if (diff < 60) return `${diff}秒`;
  if (diff < 3600) return `${Math.floor(diff / 60)}分${diff % 60}秒`;
  return `${Math.floor(diff / 3600)}时${Math.floor((diff % 3600) / 60)}分`;
});

const isProcessing = computed(() =>
  ["pending", "queued", "generating"].includes(task.value?.status || ""),
);

const canCancel = computed(() =>
  ["pending", "queued"].includes(task.value?.status || ""),
);

const canDelete = computed(() =>
  ["completed", "failed", "cancelled"].includes(task.value?.status || ""),
);

let pollInterval: number | null = null;

function startPolling() {
  pollInterval = window.setInterval(async () => {
    await imageGenStore.fetchTaskDetail(taskId.value);
    if (!isProcessing.value) {
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

async function handleCancel() {
  try {
    await imageGenStore.cancelTask(taskId.value);
    stopPolling();
  } catch (error) {
    console.error("取消失败:", error);
  }
}

async function handleDelete() {
  try {
    await imageGenStore.deleteTask(taskId.value);
    router.push({
      name: "ImageGenList",
      params: { projectId: projectId.value },
    });
  } catch (error) {
    console.error("删除失败:", error);
  }
}

async function handleRegenerate(resultId: string) {
  await imageGenStore.regenerateImage(resultId, {});
  startPolling();
}

function handleDownload(result: ImageGenResultDto) {
  if (result.image?.url) {
    window.open(result.image.url, "_blank");
  }
}

async function handleDeleteResult(resultId: string) {
  // TODO: 实现删除单张结果
  console.log("删除结果:", resultId);
}

function formatTime(timeStr: string) {
  return new Date(timeStr).toLocaleString("zh-CN");
}

onMounted(async () => {
  await imageGenStore.fetchTaskDetail(taskId.value);
  if (isProcessing.value) {
    startPolling();
  }
});

onUnmounted(() => {
  stopPolling();
  imageGenStore.clearCurrentTask();
});
</script>

<style scoped lang="scss">
.image-gen-detail-page {
  padding: 24px;
}

.page-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-top: 24px;
}

.info-card,
.params-card {
  :deep(.n-card__content) {
    padding: 16px;
  }
}
</style>
