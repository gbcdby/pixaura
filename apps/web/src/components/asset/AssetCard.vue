<script setup lang="ts">
import { computed } from "vue";
import { NCard, NSpace, NIcon, NButton, NTooltip, NTag } from "naive-ui";
import {
  Star,
  StarOutline,
  DownloadOutline,
  EyeOutline,
} from "@vicons/ionicons5";
import type {
  AssetSummaryDto,
  LibraryAssetType,
  LibraryAssetStatus,
} from "@pixaura/shared-types";

interface Props {
  asset: AssetSummaryDto;
  viewMode: "grid" | "list";
  showStats?: boolean;
  showFavorite?: boolean;
  showActions?: boolean;
  selected?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showStats: true,
  showFavorite: true,
  showActions: true,
  selected: false,
});

const emit = defineEmits<{
  (e: "click", asset: AssetSummaryDto): void;
  (e: "favorite", asset: AssetSummaryDto): void;
  (e: "import", asset: AssetSummaryDto): void;
  (e: "select", asset: AssetSummaryDto, selected: boolean): void;
}>();

// 资产类型映射
const assetTypeMap: Record<LibraryAssetType, { label: string; color: string }> =
  {
    character: { label: "角色", color: "#18a058" },
    scene: { label: "场景", color: "#2080f0" },
    prop: { label: "道具", color: "#f0a020" },
  };

// 资产状态映射
const assetStatusMap: Record<
  LibraryAssetStatus,
  {
    label: string;
    type: "default" | "primary" | "success" | "warning" | "error" | "info";
  }
> = {
  draft: { label: "草稿", type: "warning" },
  active: { label: "活跃", type: "success" },
  archived: { label: "归档", type: "default" },
};

// 类型信息
const typeInfo = computed(
  () => assetTypeMap[props.asset.type] || { label: "未知", color: "#999" },
);

// 状态信息
const statusInfo = computed(
  () =>
    assetStatusMap[props.asset.status] || { label: "未知", type: "default" },
);

// 封面背景色（如果没有缩略图）
const coverColors = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
];

const coverStyle = computed(() => {
  if (props.asset.thumbnailUrl) {
    return {
      backgroundImage: `url(${props.asset.thumbnailUrl})`,
    };
  }
  // 根据资产ID生成固定的颜色
  const colorIndex =
    props.asset.id
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0) % coverColors.length;
  return {
    background: coverColors[colorIndex],
  };
});

// 处理点击
const handleClick = () => {
  emit("click", props.asset);
};

// 处理收藏
const handleFavorite = (e: Event) => {
  e.stopPropagation();
  emit("favorite", props.asset);
};

// 处理导入
const handleImport = (e: Event) => {
  e.stopPropagation();
  emit("import", props.asset);
};

// 格式化数字
const formatNumber = (num?: number) => {
  if (num === undefined || num === null) return "0";
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + "w";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "k";
  }
  return num.toString();
};
</script>

<template>
  <!-- 网格视图 -->
  <n-card
    v-if="viewMode === 'grid'"
    class="asset-card asset-card-grid"
    :class="{ selected }"
    :bordered="false"
    hoverable
    @click="handleClick"
  >
    <!-- 缩略图 -->
    <div
      class="cover"
      :style="coverStyle"
    >
      <div class="cover-overlay">
        <!-- 类型标签 -->
        <n-tag
          :color="{
            color: typeInfo.color + '20',
            textColor: typeInfo.color,
            borderColor: typeInfo.color + '40',
          }"
          size="small"
          class="type-tag"
        >
          {{ typeInfo.label }}
        </n-tag>

        <!-- 收藏按钮 -->
        <n-button
          v-if="showFavorite"
          circle
          size="small"
          class="favorite-btn"
          :class="{ favorited: asset.isFavorited }"
          @click.stop="handleFavorite"
        >
          <template #icon>
            <n-icon :color="asset.isFavorited ? '#f0a020' : undefined">
              <Star v-if="asset.isFavorited" />
              <StarOutline v-else />
            </n-icon>
          </template>
        </n-button>
      </div>
    </div>

    <!-- 内容 -->
    <div class="content">
      <h3 class="title">
        {{ asset.name }}
      </h3>
      <p class="project-name">
        {{ asset.projectName }}
      </p>

      <!-- 统计信息 -->
      <div
        v-if="showStats && asset.stats"
        class="stats"
      >
        <n-space
          align="center"
          :size="12"
        >
          <n-tooltip>
            <template #trigger>
              <span class="stat-item">
                <n-icon size="14"><EyeOutline /></n-icon>
                {{ formatNumber(asset.stats.usageCount) }}
              </span>
            </template>
            使用次数
          </n-tooltip>
          <n-tooltip>
            <template #trigger>
              <span class="stat-item">
                <n-icon size="14"><DownloadOutline /></n-icon>
                {{ formatNumber(asset.stats.importCount) }}
              </span>
            </template>
            导入次数
          </n-tooltip>
        </n-space>
      </div>
    </div>

    <!-- 导入按钮（悬浮显示） -->
    <n-button
      v-if="showActions"
      class="import-btn"
      type="primary"
      size="small"
      @click.stop="handleImport"
    >
      <template #icon>
        <n-icon><DownloadOutline /></n-icon>
      </template>
      导入
    </n-button>
  </n-card>

  <!-- 列表视图 -->
  <div
    v-else
    class="asset-card asset-card-list"
    :class="{ selected }"
    @click="handleClick"
  >
    <!-- 缩略图 -->
    <div
      class="list-thumbnail"
      :style="coverStyle"
    >
      <n-tag
        :color="{
          color: typeInfo.color + '20',
          textColor: typeInfo.color,
          borderColor: typeInfo.color + '40',
        }"
        size="small"
        class="list-type-tag"
      >
        {{ typeInfo.label }}
      </n-tag>
    </div>

    <!-- 信息区 -->
    <div class="list-info">
      <h3 class="list-title">
        {{ asset.name }}
      </h3>
      <p class="list-description">
        {{ asset.description || "暂无描述" }}
      </p>
    </div>

    <!-- 项目 -->
    <div class="list-project">
      {{ asset.projectName }}
    </div>

    <!-- 类型 -->
    <div class="list-type">
      <n-tag
        :type="statusInfo.type"
        size="small"
      >
        {{ statusInfo.label }}
      </n-tag>
    </div>

    <!-- 统计 -->
    <div
      v-if="showStats && asset.stats"
      class="list-stats"
    >
      <n-space
        align="center"
        :size="8"
      >
        <n-tooltip>
          <template #trigger>
            <span class="stat-item">
              <n-icon size="14"><EyeOutline /></n-icon>
              {{ formatNumber(asset.stats.usageCount) }}
            </span>
          </template>
          使用次数
        </n-tooltip>
        <n-tooltip>
          <template #trigger>
            <span class="stat-item">
              <n-icon size="14"><DownloadOutline /></n-icon>
              {{ formatNumber(asset.stats.importCount) }}
            </span>
          </template>
          导入次数
        </n-tooltip>
      </n-space>
    </div>

    <!-- 操作 -->
    <div
      v-if="showActions || showFavorite"
      class="list-actions"
    >
      <n-space>
        <n-button
          v-if="showFavorite"
          circle
          size="small"
          :type="asset.isFavorited ? 'warning' : 'default'"
          @click.stop="handleFavorite"
        >
          <template #icon>
            <n-icon>
              <Star v-if="asset.isFavorited" />
              <StarOutline v-else />
            </n-icon>
          </template>
        </n-button>
        <n-button
          v-if="showActions"
          type="primary"
          size="small"
          @click.stop="handleImport"
        >
          <template #icon>
            <n-icon><DownloadOutline /></n-icon>
          </template>
          导入
        </n-button>
      </n-space>
    </div>
  </div>
</template>

<style scoped lang="scss">
// 网格视图样式
.asset-card-grid {
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);

    .import-btn {
      opacity: 1;
      transform: translateY(0);
    }
  }

  &.selected {
    box-shadow: 0 0 0 2px #2080f0;
  }

  :deep(.n-card__content) {
    padding: 0;
  }

  .cover {
    height: 160px;
    background-size: cover;
    background-position: center;
    position: relative;

    .cover-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        to bottom,
        rgba(0, 0, 0, 0.3) 0%,
        transparent 40%,
        rgba(0, 0, 0, 0.1) 100%
      );
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 12px;

      .type-tag {
        background: rgba(255, 255, 255, 0.95) !important;
      }

      .favorite-btn {
        background: rgba(255, 255, 255, 0.9);
        opacity: 0;
        transition: opacity 0.2s;

        &:hover {
          background: #fff;
        }

        &.favorited {
          opacity: 1;
        }
      }
    }

    &:hover .favorite-btn {
      opacity: 1;
    }
  }

  .content {
    padding: 16px;

    .title {
      font-size: 15px;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0 0 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .project-name {
      font-size: 13px;
      color: #666;
      margin: 0 0 12px;
    }

    .stats {
      padding-top: 12px;
      border-top: 1px solid #f0f0f0;

      .stat-item {
        font-size: 13px;
        color: #999;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
    }
  }

  .import-btn {
    position: absolute;
    bottom: 16px;
    right: 16px;
    opacity: 0;
    transform: translateY(10px);
    transition: all 0.3s ease;
  }
}

// 列表视图样式
.asset-card-list {
  display: flex;
  align-items: center;
  padding: 16px;
  background: #fff;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 1px solid transparent;

  &:hover {
    background: #f8f8f8;
    border-color: #e0e0e0;
  }

  &.selected {
    border-color: #2080f0;
    background: #f0f7ff;
  }

  .list-thumbnail {
    width: 80px;
    height: 60px;
    border-radius: 6px;
    background-size: cover;
    background-position: center;
    position: relative;
    flex-shrink: 0;

    .list-type-tag {
      position: absolute;
      top: 4px;
      left: 4px;
      background: rgba(255, 255, 255, 0.95) !important;
    }
  }

  .list-info {
    flex: 1;
    min-width: 0;
    margin-left: 16px;

    .list-title {
      font-size: 15px;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0 0 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .list-description {
      font-size: 13px;
      color: #999;
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .list-project {
    width: 120px;
    font-size: 13px;
    color: #666;
    text-align: center;
    flex-shrink: 0;
  }

  .list-type {
    width: 80px;
    text-align: center;
    flex-shrink: 0;
  }

  .list-stats {
    width: 120px;
    flex-shrink: 0;

    .stat-item {
      font-size: 13px;
      color: #999;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
  }

  .list-actions {
    width: 120px;
    text-align: right;
    flex-shrink: 0;
  }
}
</style>
