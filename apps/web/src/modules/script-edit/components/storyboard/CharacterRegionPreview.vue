<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from "vue";
import { NImage, NIcon, NAvatar, NTooltip } from "naive-ui";
import { CreateOutline } from "@vicons/ionicons5";

/**
 * CharacterRegionPreview - 角色框选预览组件
 * 用于在对口型模式下显示分镜图中角色的框选区域
 * 分析 Mask 图片白色像素区域，计算边界框并显示
 */

interface Region {
  x: number; // 百分比 0-100
  y: number;
  width: number;
  height: number;
}

interface Props {
  /** 分镜图主图 URL */
  storyboardImageUrl: string;
  /** 角色名称 */
  characterName: string;
  /** 角色头像（可选） */
  characterAvatar?: string;
  /** Mask 图片 URL（可选，无则不显示框选） */
  maskImageUrl?: string;
  /** 宽高比（格式如 "9/16"） */
  aspectRatio?: string;
  /** 是否只读 */
  isReadonly?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  aspectRatio: "9/16",
  isReadonly: false,
});

const emit = defineEmits<{
  (e: "click"): void;
}>();

// 框选区域（百分比坐标）
const region = ref<Region | null>(null);
// 图片加载状态
const isLoading = ref(false);
// Mask 加载错误
const maskError = ref(false);
// 分镜图加载状态
const imageLoaded = ref(false);

// 计算宽高比数值
const aspectRatioValue = computed(() => {
  const parts = props.aspectRatio.split("/");
  if (parts.length === 2) {
    const w = parseFloat(parts[0]);
    const h = parseFloat(parts[1]);
    if (w > 0 && h > 0) {
      return `${w} / ${h}`;
    }
  }
  return "9 / 16";
});

// 是否有框选区域
const hasRegion = computed(() => region.value !== null);

// 加载并分析 Mask 图片
async function loadAndAnalyzeMask() {
  if (!props.maskImageUrl) {
    region.value = null;
    return;
  }

  isLoading.value = true;
  maskError.value = false;

  try {
    const img = new Image();
    img.crossOrigin = "anonymous";

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Mask 图片加载失败"));
      img.src = props.maskImageUrl!;
    });

    // 创建 Canvas 分析像素
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("无法创建 Canvas context");
    }

    ctx.drawImage(img, 0, 0);

    // 获取像素数据
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    // 遍历像素找白色区域边界
    let minX = canvas.width;
    let minY = canvas.height;
    let maxX = 0;
    let maxY = 0;
    let hasWhitePixel = false;

    // 遍历所有像素（RGBA 格式，每4个字节一个像素）
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const idx = (y * canvas.width + x) * 4;
        const r = pixels[idx];
        const g = pixels[idx + 1];
        const b = pixels[idx + 2];

        // 检测白色像素（RGB 都接近 255）
        if (r > 200 && g > 200 && b > 200) {
          hasWhitePixel = true;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (hasWhitePixel) {
      // 转换为百分比坐标（0-100）
      region.value = {
        x: (minX / canvas.width) * 100,
        y: (minY / canvas.height) * 100,
        width: ((maxX - minX + 1) / canvas.width) * 100,
        height: ((maxY - minY + 1) / canvas.height) * 100,
      };
    } else {
      region.value = null;
    }

    isLoading.value = false;
  } catch {
    maskError.value = true;
    isLoading.value = false;
    region.value = null;
  }
}

// 点击组件
function handleClick() {
  if (!props.isReadonly) {
    emit("click");
  }
}

// 分镜图加载完成
function handleImageLoad() {
  imageLoaded.value = true;
}

// 监听 Mask URL 变化
watch(
  () => props.maskImageUrl,
  () => {
    loadAndAnalyzeMask();
  },
  { immediate: true },
);

// 清理
onUnmounted(() => {
  region.value = null;
});
</script>

<template>
  <div
    class="character-region-preview"
    :class="{ clickable: !isReadonly, loading: isLoading }"
    :style="{ aspectRatio: aspectRatioValue }"
    @click="handleClick"
  >
    <!-- 分镜图主图 -->
    <n-image
      :src="storyboardImageUrl"
      alt="分镜图"
      object-fit="cover"
      class="storyboard-image"
      :img-props="{ crossorigin: 'anonymous' }"
      @load="handleImageLoad"
    />

    <!-- 框选框 -->
    <div
      v-if="hasRegion && region"
      class="region-box"
      :style="{
        left: `${region.x}%`,
        top: `${region.y}%`,
        width: `${region.width}%`,
        height: `${region.height}%`,
      }"
    >
      <!-- 框选边框 -->
      <div class="region-border" />
    </div>

    <!-- 角色名称标签 -->
    <div
      v-if="hasRegion && region"
      class="character-label"
      :style="{
        left: `${region.x}%`,
        top: `calc(${region.y}% - 24px)`,
        maxWidth: `${Math.max(region.width, 30)}%`,
      }"
    >
      <!-- 角色头像 -->
      <n-avatar
        v-if="characterAvatar"
        :src="characterAvatar"
        :size="16"
        round
        class="label-avatar"
      />
      <!-- 角色名称 -->
      <span class="label-name">{{ characterName }}</span>
    </div>

    <!-- 无框选提示 -->
    <div
      v-if="!hasRegion && !isLoading && imageLoaded && !isReadonly"
      class="no-region-hint"
    >
      <n-tooltip>
        <template #trigger>
          <div class="hint-content">
            <n-icon
              size="16"
              color="#2080f0"
            >
              <CreateOutline />
            </n-icon>
            <span>点击框选</span>
          </div>
        </template>
        点击手动框选角色区域
      </n-tooltip>
    </div>

    <!-- 加载状态 -->
    <div
      v-if="isLoading"
      class="loading-overlay"
    >
      <span class="loading-text">分析中...</span>
    </div>

    <!-- 编辑提示（非只读模式） -->
    <div
      v-if="!isReadonly && hasRegion"
      class="edit-hint"
    >
      <n-icon
        size="14"
        color="#2080f0"
      >
        <CreateOutline />
      </n-icon>
    </div>
  </div>
</template>

<style scoped lang="scss">
.character-region-preview {
  position: relative;
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  background: #f5f5f5;
  cursor: default;
  transition: all 0.2s;

  &.clickable {
    cursor: pointer;

    &:hover {
      box-shadow: 0 2px 8px rgba(32, 128, 240, 0.2);

      .region-border {
        border-color: #2080f0;
        background: rgba(32, 128, 240, 0.1);
      }

      .edit-hint {
        opacity: 1;
      }
    }
  }

  &.loading {
    cursor: wait;
  }
}

.storyboard-image {
  width: 100%;
  height: 100%;
  display: block;
}

.region-box {
  position: absolute;
  pointer-events: none;
}

.region-border {
  position: absolute;
  inset: 0;
  border: 2px dashed #18a058;
  border-radius: 4px;
  background: rgba(24, 160, 88, 0.08);
  transition: all 0.2s;
}

.character-label {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: rgba(32, 128, 240, 0.9);
  border-radius: 4px;
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transform: translateX(-0%);
  pointer-events: none;

  // 确保标签不超出容器
  max-width: calc(100% - 8px);

  .label-avatar {
    flex-shrink: 0;
  }

  .label-name {
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.no-region-hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.8);

  .hint-content {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    background: #fff;
    border-radius: 6px;
    border: 1px dashed #2080f0;
    color: #2080f0;
    font-size: 12px;
    font-weight: 500;
    transition: all 0.2s;

    &:hover {
      background: #e6f4ff;
      border-style: solid;
    }
  }
}

.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.7);

  .loading-text {
    font-size: 12px;
    color: #2080f0;
    font-weight: 500;
  }
}

.edit-hint {
  position: absolute;
  top: 4px;
  right: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: rgba(32, 128, 240, 0.9);
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
}
</style>