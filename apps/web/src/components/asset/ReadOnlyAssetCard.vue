<script setup lang="ts">
/**
 * 只读资产卡片组件
 * 用于资产库列表页面展示
 * 点击卡片触发编辑弹窗
 */
import { computed } from "vue";
import { NCard, NIcon, NImage, NImageGroup, NCheckbox } from "naive-ui";
import { ImageOutline, PersonOutline, CubeOutline } from "@vicons/ionicons5";

// 资产类型
type AssetType = "character" | "scene" | "prop";

// 资产数据接口（兼容三种类型）
interface AssetData {
  id: string;
  name: string;
  description?: string | null;
  status?: string;
  // 角色类型
  gender?: string;
  age?: string;
  voiceId?: string;
  // 图片数据（兼容 null 和 undefined）
  images?: {
    frontView?: { url?: string; thumbnailUrl?: string | null };
    panorama?: { url?: string; thumbnailUrl?: string | null };
    referenceImages?: Array<{ url?: string; thumbnailUrl?: string | null }>;
  };
}

interface Props {
  type: AssetType;
  data: AssetData;
  selectable?: boolean;
  selected?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "click"): void;
  (e: "select"): void;
}>();

// 性别映射
const genderMap: Record<string, string> = {
  male: "男",
  female: "女",
  unknown: "未知",
};

const genderLabel = computed(() => {
  if (props.type !== "character") return "";
  return genderMap[props.data.gender || "unknown"] || "未知";
});

// 获取主图
const mainImage = computed(() => {
  if (props.type === "scene") {
    return props.data.images?.panorama?.url || props.data.images?.panorama?.thumbnailUrl;
  }
  return props.data.images?.frontView?.url || props.data.images?.frontView?.thumbnailUrl;
});

// 获取参考图列表
const referenceImages = computed(() => {
  return props.data.images?.referenceImages || [];
});

// 占位图图标
const placeholderIcon = computed(() => {
  switch (props.type) {
    case "character":
      return PersonOutline;
    case "scene":
      return ImageOutline;
    case "prop":
      return CubeOutline;
    default:
      return ImageOutline;
  }
});

const handleClick = () => {
  if (props.selectable) {
    emit("select");
    return;
  }
  emit("click");
};
</script>

<template>
  <n-card
    class="readonly-asset-card"
    :bordered="false"
    hoverable
    @click="handleClick"
  >
    <!-- 选择框 -->
    <div v-if="selectable" class="select-overlay" @click.stop="emit('select')">
      <n-checkbox :checked="selected" />
    </div>

    <!-- 图片区域 -->
    <div class="image-section">
      <n-image-group v-if="mainImage">
        <div class="image-layout">
          <div class="main-image-wrapper">
            <n-image
              :src="mainImage"
              :alt="data.name"
              class="main-image"
              object-fit="cover"
              preview-disabled
            />
          </div>
        </div>
      </n-image-group>
      <!-- 无图片时的占位 -->
      <div
        v-else
        class="image-placeholder"
      >
        <div class="placeholder-content">
          <n-icon
            size="48"
            color="#99999940"
          >
            <component :is="placeholderIcon" />
          </n-icon>
          <span class="placeholder-text">暂无图片</span>
        </div>
      </div>
    </div>

    <!-- 参考图区域 -->
    <div
      v-if="referenceImages.length > 0"
      class="reference-section"
    >
      <div class="reference-label">参考图片</div>
      <div class="reference-list">
        <n-image-group>
          <div
            v-for="img in referenceImages.slice(0, 3)"
            :key="img.url"
            class="reference-item"
          >
            <n-image
              :src="img.thumbnailUrl || img.url"
              :preview-disabled="true"
              alt="参考图"
              class="reference-image"
              object-fit="cover"
            />
          </div>
        </n-image-group>
      </div>
    </div>

    <!-- 信息区域 -->
    <div class="info-section">
      <div class="name">{{ data.name }}</div>

      <!-- 角色：性别/年龄 -->
      <div
        v-if="type === 'character' && (genderLabel || data.age)"
        class="character-meta"
      >
        <span v-if="genderLabel">{{ genderLabel }}</span>
        <span v-if="data.age">{{ data.age }}岁</span>
      </div>

      <!-- 角色：音色 -->
      <div
        v-if="type === 'character' && data.voiceId"
        class="voice-section"
      >
        <span class="voice-label">已配置音色</span>
      </div>

      <!-- 描述 -->
      <div
        v-if="data.description"
        class="description"
      >
        {{ data.description }}
      </div>
    </div>
  </n-card>
</template>

<style scoped lang="scss">
// 卡片改为适配 grid 布局，去掉固定宽度
.readonly-asset-card {
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  cursor: pointer;
  position: relative;
  border: 1px solid #f0f0f5;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    border-color: #e0e0e8;
  }

  :deep(.n-card__content) {
    padding: 0;
    display: flex;
    flex-direction: column;
  }
}

// 选择框
.select-overlay {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 10;
  padding: 4px;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 8px;
  cursor: pointer;
}

// 图片区域改为正方形（1:1 比例）
.image-section {
  position: relative;
  margin: 12px 12px 0;
  overflow: hidden;
  border-radius: 12px;
  aspect-ratio: 1/1; // 正方形比例
  background: #f5f5f5;
}

.image-layout {
  position: absolute;
  inset: 0;
  display: flex;
}

.main-image-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 12px;
  overflow: hidden;
  background: #f5f5f5;

  :deep(.main-image) {
    display: block;
    width: 100%;
    height: 100%;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s ease;
    }
  }

  &:hover :deep(.main-image img) {
    transform: scale(1.03);
  }
}

.image-placeholder {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  display: flex;
  align-items: center;
  justify-content: center;

  .placeholder-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;

    .placeholder-text {
      font-size: 14px;
      color: #999;
    }
  }
}

// 参考图片区域
.reference-section {
  padding: 12px;
  border-bottom: 1px solid #f5f5f5;

  .reference-label {
    font-size: 12px;
    color: #999;
    margin-bottom: 10px;
    font-weight: 500;
  }

  .reference-list {
    display: flex;
    gap: 8px;
  }

  .reference-item {
    position: relative;
    width: 56px;
    height: 56px;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid #f0f0f0;

    :deep(.reference-image) {
      display: block;
      width: 100%;
      height: 100%;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }
  }
}

// 信息区域
.info-section {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;

  .name {
    font-size: 14px;
    font-weight: 600;
    color: #1a1a1a;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .character-meta {
    display: flex;
    gap: 8px;
    font-size: 12px;
    color: #666;
  }

  .voice-section {
    .voice-label {
      font-size: 12px;
      color: #18a058;
    }
  }

  .description {
    font-size: 12px;
    color: #999;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    line-height: 1.4;
  }
}

// 暗黑模式适配
[data-theme="dark"] {
  .readonly-asset-card {
    background: rgba(16, 16, 32, 0.5);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);

    &:hover {
      background: rgba(16, 16, 32, 0.7);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    }

    .image-section {
      background: linear-gradient(135deg, #1a1030, #0f0a1a);
    }

    .image-placeholder {
      background: linear-gradient(135deg, #1a1030, #0f0a1a);

      .placeholder-content {
        color: #6a6a8a;
      }
    }

    .reference-section {
      border-bottom-color: #3a3a5a;

      .reference-item {
        border-color: #3a3a5a;
      }
    }

    .info-section {
      .name {
        color: #e0e0e0;
      }

      .character-meta {
        color: #8a8aaa;
      }

      .description {
        color: #8a8aaa;
      }
    }
  }
}
</style>