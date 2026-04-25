<template>
  <div
    class="generation-item-card"
    :class="{
      'is-selected': isSelected,
      'is-confirmed': item.status === 'confirmed',
      'is-rejected': item.status === 'rejected',
    }"
    @click="handleClick"
  >
    <!-- 选择框 -->
    <div
      v-if="selectable"
      class="card-checkbox"
      @click.stop
    >
      <n-checkbox
        :checked="isSelected"
        @update:checked="handleSelect"
      />
    </div>

    <!-- 序号 -->
    <div class="card-number">
      #{{ item.sequenceNumber }}
    </div>

    <!-- 预览图 -->
    <div class="card-preview">
      <n-image
        v-if="item.previewImageUrl"
        :src="item.previewImageThumbnailUrl || item.previewImageUrl"
        :preview-src="item.previewImageUrl"
        class="preview-image"
        object-fit="cover"
      />
      <div
        v-else
        class="preview-placeholder"
      >
        <n-icon :component="Image" />
        <span>无预览图</span>
      </div>

      <!-- 预览图生成状态 -->
      <div
        v-if="item.previewGenerationStatus === 'pending'"
        class="preview-status"
      >
        <n-spin size="small" />
        <span>生成中</span>
      </div>
    </div>

    <!-- 信息区 -->
    <div class="card-info">
      <div class="info-row">
        <n-tag
          v-if="item.sceneName"
          size="small"
          type="info"
        >
          {{ item.sceneName }}
        </n-tag>
        <span class="duration">{{ item.duration }}秒</span>
        <span class="shot-type">{{ shotTypeText }}</span>
      </div>

      <div class="description">
        {{ truncatedDescription }}
      </div>

      <!-- 置信度 -->
      <div
        v-if="showConfidence && item.confidenceScore"
        class="confidence"
      >
        <n-progress
          :percentage="Math.round(item.confidenceScore * 100)"
          :show-indicator="false"
          :height="4"
          :color="confidenceColor"
        />
      </div>
    </div>

    <!-- 状态标签 -->
    <div class="card-status">
      <n-tag
        :type="statusType"
        size="small"
      >
        {{ statusText }}
      </n-tag>
    </div>

    <!-- 操作区 -->
    <div
      v-if="item.status === 'generated'"
      class="card-actions"
      @click.stop
    >
      <n-button
        size="tiny"
        type="primary"
        @click="handleConfirm"
      >
        确认
      </n-button>
      <n-button
        size="tiny"
        @click="handleEdit"
      >
        编辑
      </n-button>
      <n-button
        size="tiny"
        type="error"
        ghost
        @click="handleReject"
      >
        拒绝
      </n-button>
    </div>

    <div
      v-else-if="item.status === 'confirmed'"
      class="card-actions"
      @click.stop
    >
      <n-button
        size="tiny"
        @click="handleEdit"
      >
        编辑
      </n-button>
      <n-button
        size="tiny"
        type="primary"
        ghost
        @click="handleRegenerate"
      >
        重新生成
      </n-button>
    </div>

    <div
      v-else-if="item.status === 'rejected'"
      class="card-actions"
      @click.stop
    >
      <n-button
        size="tiny"
        type="primary"
        ghost
        @click="handleRegenerate"
      >
        重新生成
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  NImage,
  NIcon,
  NTag,
  NButton,
  NCheckbox,
  NProgress,
  NSpin,
} from "naive-ui";
import { Image } from "@vicons/ionicons5";
import type { GenerationItem } from "@pixaura/shared-types";

const props = defineProps<{
  item: GenerationItem;
  isSelected?: boolean;
  selectable?: boolean;
  showConfidence?: boolean;
}>();

const emit = defineEmits<{
  click: [item: GenerationItem];
  select: [itemId: string, selected: boolean];
  confirm: [itemId: string];
  edit: [itemId: string];
  reject: [itemId: string];
  regenerate: [itemId: string];
}>();

// 计算属性
const truncatedDescription = computed(() => {
  const maxLength = 60;
  if (props.item.description.length <= maxLength) {
    return props.item.description;
  }
  return props.item.description.slice(0, maxLength) + "...";
});

const shotTypeText = computed(() => {
  const typeMap: Record<string, string> = {
    extreme_wide: "极远景",
    wide: "远景",
    medium: "中景",
    close_up: "特写",
    extreme_close_up: "极特写",
    establishing: "定场",
  };
  return typeMap[props.item.shotType] || props.item.shotType;
});

const statusType = computed(() => {
  switch (props.item.status) {
    case "confirmed":
      return "success";
    case "rejected":
      return "error";
    case "generated":
    default:
      return "default";
  }
});

const statusText = computed(() => {
  switch (props.item.status) {
    case "confirmed":
      return "已确认";
    case "rejected":
      return "已拒绝";
    case "generated":
    default:
      return "待确认";
  }
});

const confidenceColor = computed(() => {
  const score = props.item.confidenceScore || 0;
  if (score >= 0.8) return "#18a058";
  if (score >= 0.6) return "#f0a020";
  return "#d03050";
});

// 方法
function handleClick() {
  emit("click", props.item);
}

function handleSelect(checked: boolean) {
  emit("select", props.item.id, checked);
}

function handleConfirm() {
  emit("confirm", props.item.id);
}

function handleEdit() {
  emit("edit", props.item.id);
}

function handleReject() {
  emit("reject", props.item.id);
}

function handleRegenerate() {
  emit("regenerate", props.item.id);
}
</script>

<style scoped lang="scss">
.generation-item-card {
  position: relative;
  background: var(--card-color);
  border-radius: 8px;
  padding: 12px;
  border: 2px solid transparent;
  transition: all 0.3s;
  cursor: pointer;

  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  &.is-selected {
    border-color: var(--primary-color);
    background: var(--primary-color-fade);
  }

  &.is-confirmed {
    border-left: 3px solid var(--success-color);
  }

  &.is-rejected {
    border-left: 3px solid var(--error-color);
    opacity: 0.7;
  }

  .card-checkbox {
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 1;
  }

  .card-number {
    position: absolute;
    top: 8px;
    right: 8px;
    font-size: 12px;
    color: var(--text-color-3);
    background: var(--fill-color);
    padding: 2px 8px;
    border-radius: 4px;
    z-index: 1;
  }

  .card-preview {
    position: relative;
    margin-bottom: 12px;

    .preview-image {
      width: 100%;
      aspect-ratio: 16 / 9;
      border-radius: 4px;
      overflow: hidden;
    }

    .preview-placeholder {
      width: 100%;
      aspect-ratio: 16 / 9;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: var(--fill-color);
      border-radius: 4px;
      color: var(--text-color-3);
      font-size: 32px;
      gap: 8px;

      span {
        font-size: 12px;
      }
    }

    .preview-status {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.5);
      border-radius: 4px;
      color: white;
      gap: 8px;

      span {
        font-size: 12px;
      }
    }
  }

  .card-info {
    margin-bottom: 12px;

    .info-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      flex-wrap: wrap;

      .duration,
      .shot-type {
        font-size: 12px;
        color: var(--text-color-3);
      }
    }

    .description {
      font-size: 13px;
      color: var(--text-color);
      line-height: 1.5;
      margin-bottom: 8px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .confidence {
      margin-top: 8px;
    }
  }

  .card-status {
    margin-bottom: 12px;
  }

  .card-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
}
</style>
