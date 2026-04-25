<script setup lang="ts">
import { computed } from "vue";
import { NEmpty, NSpin, NCheckbox } from "naive-ui";
import AssetCard from "./AssetCard.vue";
import type { AssetSummaryDto } from "@pixaura/shared-types";

interface Props {
  assets: AssetSummaryDto[];
  loading?: boolean;
  selectedIds?: string[];
  selectable?: boolean;
  showHeader?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  selectedIds: () => [],
  selectable: false,
  showHeader: true,
});

const emit = defineEmits<{
  (e: "click", asset: AssetSummaryDto): void;
  (e: "favorite", asset: AssetSummaryDto): void;
  (e: "import", asset: AssetSummaryDto): void;
  (e: "select", asset: AssetSummaryDto, selected: boolean): void;
  (e: "selectAll", selected: boolean): void;
}>();

// 选中的ID集合
const selectedSet = computed(() => new Set(props.selectedIds));

// 判断是否选中
const isSelected = (assetId: string) => selectedSet.value.has(assetId);

// 是否全选
const isAllSelected = computed(() => {
  if (props.assets.length === 0) return false;
  return props.assets.every((asset) => selectedSet.value.has(asset.id));
});

// 是否部分选中
const isIndeterminate = computed(() => {
  if (props.assets.length === 0) return false;
  const selectedCount = props.assets.filter((asset) =>
    selectedSet.value.has(asset.id),
  ).length;
  return selectedCount > 0 && selectedCount < props.assets.length;
});

// 处理全选
const handleSelectAll = (checked: boolean) => {
  emit("selectAll", checked);
};

// 处理卡片点击
const handleClick = (asset: AssetSummaryDto) => {
  if (props.selectable) {
    const selected = !isSelected(asset.id);
    emit("select", asset, selected);
  } else {
    emit("click", asset);
  }
};

// 处理收藏
const handleFavorite = (asset: AssetSummaryDto) => {
  emit("favorite", asset);
};

// 处理导入
const handleImport = (asset: AssetSummaryDto) => {
  emit("import", asset);
};
</script>

<template>
  <div class="asset-list-container">
    <!-- 加载状态 -->
    <div
      v-if="loading"
      class="loading-wrapper"
    >
      <n-spin size="large" />
    </div>

    <!-- 空状态 -->
    <n-empty
      v-else-if="assets.length === 0"
      description="暂无资产"
      class="empty-wrapper"
    >
      <template #icon>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          style="width: 64px; height: 64px; color: #d9d9d9"
        >
          <rect
            x="3"
            y="3"
            width="18"
            height="18"
            rx="2"
          />
          <circle
            cx="9"
            cy="9"
            r="2"
          />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      </template>
    </n-empty>

    <!-- 列表 -->
    <div
      v-else
      class="asset-list"
    >
      <!-- 表头 -->
      <div
        v-if="showHeader"
        class="list-header"
      >
        <div
          v-if="selectable"
          class="header-checkbox"
        >
          <n-checkbox
            :checked="isAllSelected"
            :indeterminate="isIndeterminate"
            @update:checked="handleSelectAll"
          />
        </div>
        <div class="header-thumbnail">
          缩略图
        </div>
        <div class="header-info">
          资产信息
        </div>
        <div class="header-project">
          所属项目
        </div>
        <div class="header-status">
          状态
        </div>
        <div class="header-stats">
          统计
        </div>
        <div class="header-actions">
          操作
        </div>
      </div>

      <!-- 列表项 -->
      <div class="list-body">
        <div
          v-for="asset in assets"
          :key="asset.id"
          class="list-item-wrapper"
        >
          <div
            v-if="selectable"
            class="item-checkbox"
          >
            <n-checkbox
              :checked="isSelected(asset.id)"
              @update:checked="(checked) => emit('select', asset, checked)"
            />
          </div>
          <asset-card
            :asset="asset"
            view-mode="list"
            :selected="isSelected(asset.id)"
            @click="handleClick(asset)"
            @favorite="handleFavorite"
            @import="handleImport"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.asset-list-container {
  width: 100%;
}

.loading-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
}

.empty-wrapper {
  padding: 60px 0;
}

.asset-list {
  background: #fff;
  border-radius: 8px;
  border: 1px solid #f0f0f0;
  overflow: hidden;
}

.list-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: #fafafa;
  border-bottom: 1px solid #f0f0f0;
  font-size: 13px;
  font-weight: 500;
  color: #666;

  .header-checkbox {
    width: 40px;
    flex-shrink: 0;
  }

  .header-thumbnail {
    width: 80px;
    text-align: center;
    flex-shrink: 0;
  }

  .header-info {
    flex: 1;
    margin-left: 16px;
  }

  .header-project {
    width: 120px;
    text-align: center;
    flex-shrink: 0;
  }

  .header-status {
    width: 80px;
    text-align: center;
    flex-shrink: 0;
  }

  .header-stats {
    width: 120px;
    text-align: center;
    flex-shrink: 0;
  }

  .header-actions {
    width: 120px;
    text-align: right;
    flex-shrink: 0;
  }
}

.list-body {
  .list-item-wrapper {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid #f0f0f0;
    transition: background 0.2s;

    &:last-child {
      border-bottom: none;
    }

    &:hover {
      background: #fafafa;
    }

    .item-checkbox {
      width: 40px;
      flex-shrink: 0;
    }

    :deep(.asset-card-list) {
      flex: 1;
      padding: 0;
      border: none;
      background: transparent;

      &:hover {
        background: transparent;
        border-color: transparent;
      }
    }
  }
}
</style>
