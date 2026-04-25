<template>
  <div class="image-result-grid">
    <div
      v-for="result in results"
      :key="result.id"
      class="result-item"
      :class="`type-${result.type}`"
    >
      <div class="image-wrapper">
        <n-image
          v-if="result.status === 'success' && result.image"
          :src="result.image.thumbnailUrl"
          :preview-src="result.image.url"
          object-fit="cover"
          class="result-image"
        />
        <div
          v-else-if="result.status === 'pending'"
          class="status-pending"
        >
          <n-spin />
          <span>生成中...</span>
        </div>
        <div
          v-else
          class="status-failed"
        >
          <n-icon
            :component="CircleX"
            :size="32"
          />
          <span>生成失败</span>
          <n-button
            size="small"
            @click="handleRegenerate(result)"
          >
            重试
          </n-button>
        </div>
      </div>

      <div class="result-info">
        <n-tag size="small">
          {{ viewTypeText(result.type) }}
        </n-tag>
        <n-dropdown
          v-if="showActions"
          :options="getActionOptions(result)"
          @select="handleAction($event, result)"
        >
          <n-button text>
            <n-icon :component="MoreHorizontal" />
          </n-button>
        </n-dropdown>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { h } from "vue";
import { NImage, NSpin, NIcon, NButton, NTag, NDropdown } from "naive-ui";
import { CircleX, MoreHorizontal, Download, Trash2 } from "lucide-vue-next";
import type { ImageGenResultDto } from "@pixaura/shared-types";

defineProps<{
  results: ImageGenResultDto[];
  showActions?: boolean;
}>();

const emit = defineEmits<{
  regenerate: [resultId: string];
  download: [result: ImageGenResultDto];
  delete: [resultId: string];
}>();

const viewTypeMap: Record<string, string> = {
  front_view: "正视图",
  side_view: "侧视图",
  back_view: "后视图",
  angle_view: "斜视图",
  top_view: "俯视图",
  additional: "生成图",
};

function viewTypeText(type: string) {
  return viewTypeMap[type] || type;
}

function getActionOptions(_result: ImageGenResultDto) {
  return [
    {
      label: "下载",
      key: "download",
      icon: () => h(NIcon, null, { default: () => h(Download) }),
    },
    {
      label: "删除",
      key: "delete",
      icon: () => h(NIcon, null, { default: () => h(Trash2) }),
    },
  ];
}

function handleAction(key: string, result: ImageGenResultDto) {
  if (key === "download") {
    emit("download", result);
  } else if (key === "delete") {
    emit("delete", result.id);
  }
}

function handleRegenerate(result: ImageGenResultDto) {
  emit("regenerate", result.id);
}
</script>

<style scoped lang="scss">
.image-result-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.result-item {
  border-radius: 8px;
  overflow: hidden;
  background: var(--fill-color);
  transition: all 0.2s ease;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
}

.image-wrapper {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;

  :deep(.result-image img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.status-pending,
.status-failed {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
}

.status-pending {
  color: var(--text-color-3);
}

.status-failed {
  color: var(--error-color);
}

.result-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
}
</style>
