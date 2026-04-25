<script setup lang="ts">
import { computed } from "vue";
import { NEmpty, NSpin } from "naive-ui";
import AssetCard from "./AssetCard.vue";
import type { AssetSummaryDto } from "@pixaura/shared-types";

interface Props {
  assets: AssetSummaryDto[];
  loading?: boolean;
  selectedIds?: string[];
  selectable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  selectedIds: () => [],
  selectable: false,
});

const emit = defineEmits<{
  (e: "click", asset: AssetSummaryDto): void;
  (e: "favorite", asset: AssetSummaryDto): void;
  (e: "import", asset: AssetSummaryDto): void;
  (e: "select", asset: AssetSummaryDto, selected: boolean): void;
}>();

// 选中的ID集合
const selectedSet = computed(() => new Set(props.selectedIds));

// 判断是否选中
const isSelected = (assetId: string) => selectedSet.value.has(assetId);

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
  <div class="asset-grid-container">
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

    <!-- 网格列表 -->
    <div
      v-else
      class="asset-grid"
    >
      <asset-card
        v-for="asset in assets"
        :key="asset.id"
        :asset="asset"
        view-mode="grid"
        :selected="isSelected(asset.id)"
        @click="handleClick(asset)"
        @favorite="handleFavorite"
        @import="handleImport"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.asset-grid-container {
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

.asset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 20px;

  // 响应式布局
  @media (max-width: 576px) {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  @media (min-width: 577px) and (max-width: 768px) {
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }

  @media (min-width: 769px) and (max-width: 1200px) {
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
  }

  @media (min-width: 1201px) and (max-width: 1600px) {
    grid-template-columns: repeat(5, 1fr);
    gap: 20px;
  }

  @media (min-width: 1601px) {
    grid-template-columns: repeat(6, 1fr);
    gap: 20px;
  }
}
</style>
