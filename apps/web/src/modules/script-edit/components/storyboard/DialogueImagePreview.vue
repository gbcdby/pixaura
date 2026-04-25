<script setup lang="ts">
import { computed, toRef } from "vue";
import { NImage, NTooltip, NButton, NIcon } from "naive-ui";
import { ScanOutline } from "@vicons/ionicons5";
import { useImageOverlay } from "@/composables/useImageOverlay";

/**
 * DialogueImagePreview - 对话分镜图预览组件
 * 使用 Canvas 合成角色框选蒙层，显示在对话中的分镜图上
 */

interface Region {
  x: number; // 百分比 0-1
  y: number;
  width: number;
  height: number;
}

interface Props {
  /** 分镜图 URL */
  imageUrl: string;
  /** 角色框选区域 */
  region?: Region;
  /** 角色颜色 */
  color?: string;
  /** 是否使用手动框选 */
  isManual?: boolean;
  /** 宽高比 */
  aspectRatio?: string;
  /** 是否只读 */
  isReadonly?: boolean;
  /** 是否显示框选按钮 */
  showSelectBtn?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  region: undefined,
  color: "#2080f0",
  isManual: false,
  aspectRatio: "9/16",
  isReadonly: false,
  showSelectBtn: false,
});

const emit = defineEmits<{
  (e: "select-region"): void;
}>();

// 图片 URL 引用
const imageUrlRef = toRef(props, "imageUrl");

// 框选叠加层配置
const overlayConfigs = computed(() => {
  if (!props.region) return [];
  return [
    {
      characterId: "current",
      region: props.region,
      isManual: props.isManual,
      color: props.color,
    },
  ];
});

// 使用 useImageOverlay 合成图片（显示蒙层，不显示标签）
const { composedImageUrl, isComposing } = useImageOverlay({
  imageUrl: imageUrlRef,
  overlays: overlayConfigs,
  showLabels: false,
  showMask: true,
  maskOpacity: 0.4,
});

// 处理框选按钮点击
function handleSelectRegion() {
  emit("select-region");
}
</script>

<template>
  <div
    class="dialogue-image-preview"
    :style="{ aspectRatio: aspectRatio }"
  >
    <!-- Bug #3 修复：预览时也显示带框选的合成图片 -->
    <n-image
      v-if="composedImageUrl"
      :src="composedImageUrl"
      :preview-src="composedImageUrl"
      class="preview-image"
      object-fit="cover"
    />

    <!-- 原图（无框选时） -->
    <n-image
      v-else
      :src="imageUrl"
      class="preview-image"
      object-fit="cover"
    />

    <!-- 合成中状态 -->
    <div
      v-if="isComposing"
      class="composing-overlay"
    >
      <span>加载中...</span>
    </div>

    <!-- 框选按钮 -->
    <n-tooltip
      v-if="!isReadonly && showSelectBtn"
      placement="top"
      :delay="300"
    >
      <template #trigger>
        <n-button
          size="small"
          circle
          class="region-select-btn"
          @click="handleSelectRegion"
        >
          <n-icon size="14">
            <ScanOutline />
          </n-icon>
        </n-button>
      </template>
      角色框选
    </n-tooltip>
  </div>
</template>

<style scoped lang="scss">
.dialogue-image-preview {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 8px;
  overflow: hidden;
  background: #f5f5f5;

  .preview-image {
    width: 100%;
    height: 100%;
  }

  .composing-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.7);
    font-size: 12px;
    color: #888;
  }

  .region-select-btn {
    position: absolute;
    bottom: 6px;
    right: 2px;
    width: 24px;
    height: 24px;
    padding: 0;
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(4px);
    border: 1px solid rgba(0, 0, 0, 0.1);
    z-index: 2;

    &:hover:not(:disabled) {
      background: rgba(255, 255, 255, 1);
      border-color: #2080f0;
    }
  }
}
</style>