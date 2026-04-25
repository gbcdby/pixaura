<script setup lang="ts">
import { computed } from "vue";
import {
  NDrawer,
  NDrawerContent,
  NButton,
  NSpace,
  NIcon,
  NTag,
  NStatistic,
  NDivider,
  NEmpty,
  NSpin,
  NTimeline,
  NTimelineItem,
} from "naive-ui";
import {
  Star,
  StarOutline,
  DownloadOutline,
  EyeOutline,
  FlameOutline,
  FolderOutline,
  InformationCircleOutline,
} from "@vicons/ionicons5";
import type {
  AssetDetailBaseDto,
  AssetStatsDto,
  LibraryAssetType,
  LibraryAssetStatus,
} from "@pixaura/shared-types";

interface Props {
  show: boolean;
  asset: AssetDetailBaseDto | null;
  stats?: AssetStatsDto | null;
  loading?: boolean;
  width?: number | string;
}

const props = withDefaults(defineProps<Props>(), {
  stats: null,
  loading: false,
  width: 480,
});

const emit = defineEmits<{
  (e: "update:show", show: boolean): void;
  (e: "favorite"): void;
  (e: "import"): void;
  (e: "close"): void;
}>();

// 资产类型映射
const assetTypeMap: Record<
  LibraryAssetType,
  { label: string; color: string; icon: string }
> = {
  character: { label: "角色", color: "#18a058", icon: "👤" },
  scene: { label: "场景", color: "#2080f0", icon: "🏞️" },
  prop: { label: "道具", color: "#f0a020", icon: "📦" },
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
const typeInfo = computed(() => {
  if (!props.asset) return { label: "未知", color: "#999", icon: "" };
  return (
    assetTypeMap[props.asset.type] || { label: "未知", color: "#999", icon: "" }
  );
});

// 状态信息
const statusInfo = computed(() => {
  if (!props.asset) return { label: "未知", type: "default" as const };
  return (
    assetStatusMap[props.asset.status] || {
      label: "未知",
      type: "default" as const,
    }
  );
});

// 格式化日期
const formatDate = (dateStr?: string) => {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString("zh-CN");
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

// 处理关闭
const handleClose = () => {
  emit("update:show", false);
  emit("close");
};

// 处理收藏
const handleFavorite = () => {
  emit("favorite");
};

// 处理导入
const handleImport = () => {
  emit("import");
};
</script>

<template>
  <n-drawer
    :show="show"
    :width="width"
    placement="right"
    @update:show="handleClose"
  >
    <n-drawer-content
      v-if="asset"
      closable
      @close="handleClose"
    >
      <template #header>
        <div class="drawer-header">
          <n-space align="center">
            <span class="type-icon">{{ typeInfo.icon }}</span>
            <span class="header-title">资产详情</span>
          </n-space>
        </div>
      </template>

      <!-- 加载状态 -->
      <div
        v-if="loading"
        class="loading-wrapper"
      >
        <n-spin size="large" />
      </div>

      <div
        v-else
        class="drawer-content"
      >
        <!-- 大图展示 -->
        <div class="asset-image-section">
          <div
            class="asset-image"
            :style="
              asset.thumbnailUrl
                ? { backgroundImage: `url(${asset.thumbnailUrl})` }
                : {}
            "
          >
            <div
              v-if="!asset.thumbnailUrl"
              class="image-placeholder"
            >
              <span class="placeholder-icon">{{ typeInfo.icon }}</span>
              <span class="placeholder-text">{{ typeInfo.label }}</span>
            </div>
            <div class="image-overlay">
              <n-tag
                :type="statusInfo.type"
                size="small"
              >
                {{ statusInfo.label }}
              </n-tag>
            </div>
          </div>
        </div>

        <!-- 基本信息 -->
        <div class="asset-info-section">
          <h2 class="asset-name">
            {{ asset.name }}
          </h2>
          <p
            v-if="asset.description"
            class="asset-description"
          >
            {{ asset.description }}
          </p>

          <!-- 所属项目 -->
          <div class="info-item">
            <n-icon size="16">
              <FolderOutline />
            </n-icon>
            <span class="info-label">所属项目：</span>
            <span class="info-value">{{ asset.projectName }}</span>
          </div>

          <!-- 资产类型 -->
          <div class="info-item">
            <n-icon size="16">
              <InformationCircleOutline />
            </n-icon>
            <span class="info-label">资产类型：</span>
            <n-tag
              :color="{
                color: typeInfo.color + '20',
                textColor: typeInfo.color,
                borderColor: typeInfo.color + '40',
              }"
              size="small"
            >
              {{ typeInfo.label }}
            </n-tag>
          </div>
        </div>

        <!-- 统计信息 -->
        <div
          v-if="stats"
          class="asset-stats-section"
        >
          <n-divider title-placement="left">
            统计信息
          </n-divider>

          <div class="stats-grid">
            <n-statistic
              label="使用次数"
              :value="formatNumber(stats.usageCount)"
            >
              <template #prefix>
                <n-icon><EyeOutline /></n-icon>
              </template>
            </n-statistic>

            <n-statistic
              label="导入次数"
              :value="formatNumber(stats.importCount)"
            >
              <template #prefix>
                <n-icon><DownloadOutline /></n-icon>
              </template>
            </n-statistic>

            <n-statistic
              label="热度分数"
              :value="formatNumber(stats.heatScore)"
            >
              <template #prefix>
                <n-icon><FlameOutline /></n-icon>
              </template>
            </n-statistic>

            <n-statistic
              label="查看次数"
              :value="formatNumber(stats.viewCount)"
            >
              <template #prefix>
                <n-icon><EyeOutline /></n-icon>
              </template>
            </n-statistic>
          </div>

          <!-- 时间线 -->
          <div
            v-if="stats.lastUsedAt || stats.lastImportedAt"
            class="stats-timeline"
          >
            <n-timeline>
              <n-timeline-item
                v-if="stats.lastUsedAt"
                type="success"
                title="最近使用"
                :time="formatDate(stats.lastUsedAt)"
              />
              <n-timeline-item
                v-if="stats.lastImportedAt"
                type="info"
                title="最近导入"
                :time="formatDate(stats.lastImportedAt)"
              />
              <n-timeline-item
                v-if="stats.firstUsedAt"
                type="default"
                title="首次使用"
                :time="formatDate(stats.firstUsedAt)"
              />
            </n-timeline>
          </div>
        </div>

        <!-- 元信息 -->
        <div class="asset-meta-section">
          <n-divider title-placement="left">
            元信息
          </n-divider>

          <div class="meta-list">
            <div class="meta-item">
              <span class="meta-label">创建时间：</span>
              <span class="meta-value">{{ formatDate(asset.createdAt) }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">更新时间：</span>
              <span class="meta-value">{{ formatDate(asset.updatedAt) }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">资产ID：</span>
              <span class="meta-value">{{ asset.id }}</span>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="drawer-footer">
          <n-space
            justify="space-between"
            style="width: 100%"
          >
            <n-button
              :type="asset?.isFavorited ? 'warning' : 'default'"
              @click="handleFavorite"
            >
              <template #icon>
                <n-icon>
                  <Star v-if="asset?.isFavorited" />
                  <StarOutline v-else />
                </n-icon>
              </template>
              {{ asset?.isFavorited ? "已收藏" : "收藏" }}
            </n-button>

            <n-button
              type="primary"
              @click="handleImport"
            >
              <template #icon>
                <n-icon><DownloadOutline /></n-icon>
              </template>
              导入资产
            </n-button>
          </n-space>
        </div>
      </template>
    </n-drawer-content>

    <!-- 空状态 -->
    <n-drawer-content
      v-else
      title="资产详情"
    >
      <n-empty description="请选择要查看的资产" />
    </n-drawer-content>
  </n-drawer>
</template>

<style scoped lang="scss">
.drawer-header {
  display: flex;
  align-items: center;

  .type-icon {
    font-size: 20px;
  }

  .header-title {
    font-size: 16px;
    font-weight: 600;
  }
}

.loading-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.drawer-content {
  padding: 0 4px;
}

.asset-image-section {
  margin-bottom: 20px;

  .asset-image {
    width: 100%;
    height: 240px;
    border-radius: 12px;
    background-size: cover;
    background-position: center;
    position: relative;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    overflow: hidden;

    .image-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: rgba(255, 255, 255, 0.8);

      .placeholder-icon {
        font-size: 48px;
        margin-bottom: 8px;
      }

      .placeholder-text {
        font-size: 14px;
      }
    }

    .image-overlay {
      position: absolute;
      top: 12px;
      right: 12px;
    }
  }
}

.asset-info-section {
  margin-bottom: 20px;

  .asset-name {
    font-size: 20px;
    font-weight: 600;
    color: #1a1a1a;
    margin: 0 0 12px;
  }

  .asset-description {
    font-size: 14px;
    color: #666;
    line-height: 1.6;
    margin: 0 0 16px;
  }

  .info-item {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    font-size: 14px;

    .info-label {
      color: #999;
    }

    .info-value {
      color: #333;
      font-weight: 500;
    }
  }
}

.asset-stats-section {
  margin-bottom: 20px;

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }

  .stats-timeline {
    margin-top: 20px;
  }
}

.asset-meta-section {
  .meta-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .meta-item {
    display: flex;
    font-size: 13px;

    .meta-label {
      color: #999;
      width: 80px;
      flex-shrink: 0;
    }

    .meta-value {
      color: #666;
      font-family: monospace;
    }
  }
}

.drawer-footer {
  padding: 12px 0;
}
</style>
