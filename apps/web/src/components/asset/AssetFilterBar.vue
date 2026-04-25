<script setup lang="ts">
import { ref, computed, watch } from "vue";
import {
  NInput,
  NSelect,
  NButton,
  NIcon,
  NRadioGroup,
  NRadioButton,
} from "naive-ui";
import {
  SearchOutline,
  GridOutline,
  ListOutline,
  ArrowDownOutline,
  ArrowUpOutline,
} from "@vicons/ionicons5";
import type { AssetFilters, LibraryAssetType } from "@pixaura/shared-types";

interface Props {
  filters: AssetFilters;
  viewMode: "grid" | "list";
  projects?: Array<{ id: string; name: string; assetCount?: number }>;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  projects: () => [],
  loading: false,
});

const emit = defineEmits<{
  (e: "update:filters", filters: AssetFilters): void;
  (e: "update:viewMode", viewMode: "grid" | "list"): void;
  (e: "search", keyword: string): void;
}>();

// 本地筛选状态
const localFilters = ref<AssetFilters>({ ...props.filters });

// 监听外部筛选变化
watch(
  () => props.filters,
  (newFilters) => {
    localFilters.value = { ...newFilters };
  },
  { deep: true },
);

// 资产类型选项
const typeOptions = [
  { label: "全部", value: "all" },
  { label: "角色", value: "character" as LibraryAssetType },
  { label: "场景", value: "scene" as LibraryAssetType },
  { label: "道具", value: "prop" as LibraryAssetType },
];

// 项目选项
const projectOptions = computed(() => [
  { label: "全部项目", value: "all" },
  ...props.projects.map((p) => ({
    label: p.assetCount ? `${p.name} (${p.assetCount})` : p.name,
    value: p.id,
  })),
]);

// 排序选项
const sortOptions = [
  { label: "最近更新", value: "updatedAt" },
  { label: "最新创建", value: "createdAt" },
  { label: "名称", value: "name" },
  { label: "热度", value: "heatScore" },
];

// 搜索防抖
let searchTimeout: ReturnType<typeof setTimeout> | null = null;

// 处理搜索输入
const handleSearchInput = (value: string) => {
  localFilters.value.keyword = value;

  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }

  searchTimeout = setTimeout(() => {
    emit("update:filters", { ...localFilters.value });
    emit("search", value);
  }, 300);
};

// 处理类型切换
const handleTypeChange = (value: string) => {
  localFilters.value.assetType = value as "all" | LibraryAssetType;
  emit("update:filters", { ...localFilters.value });
};

// 处理项目切换
const handleProjectChange = (value: string) => {
  localFilters.value.projectId = value;
  emit("update:filters", { ...localFilters.value });
};

// 处理排序切换
const handleSortChange = (value: string) => {
  localFilters.value.sortBy = value as AssetFilters["sortBy"];
  emit("update:filters", { ...localFilters.value });
};

// 处理排序方向切换
const toggleSortOrder = () => {
  localFilters.value.sortOrder =
    localFilters.value.sortOrder === "asc" ? "desc" : "asc";
  emit("update:filters", { ...localFilters.value });
};

// 处理视图切换
const handleViewModeChange = (mode: "grid" | "list") => {
  emit("update:viewMode", mode);
};

// 清除筛选
const clearFilters = () => {
  localFilters.value = {
    projectId: "all",
    assetType: "all",
    status: "all",
    sortBy: "updatedAt",
    sortOrder: "desc",
    keyword: "",
  };
  emit("update:filters", { ...localFilters.value });
};

// 是否有活跃筛选
const hasActiveFilters = computed(() => {
  return (
    localFilters.value.assetType !== "all" ||
    localFilters.value.projectId !== "all" ||
    localFilters.value.status !== "all" ||
    localFilters.value.keyword !== ""
  );
});
</script>

<template>
  <div class="asset-filter-bar">
    <div class="filter-row">
      <!-- 搜索框 -->
      <div class="search-section">
        <n-input
          :value="localFilters.keyword"
          placeholder="搜索资产名称、描述..."
          clearable
          :loading="loading"
          @update:value="handleSearchInput"
        >
          <template #prefix>
            <n-icon><SearchOutline /></n-icon>
          </template>
        </n-input>
      </div>

      <!-- 类型筛选 -->
      <div class="filter-section">
        <n-radio-group
          :value="localFilters.assetType"
          size="small"
          @update:value="handleTypeChange"
        >
          <n-radio-button
            v-for="option in typeOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </n-radio-button>
        </n-radio-group>
      </div>
    </div>

    <div class="filter-row secondary">
      <!-- 项目筛选 -->
      <div class="filter-item">
        <span class="filter-label">项目：</span>
        <n-select
          :value="localFilters.projectId"
          :options="projectOptions"
          size="small"
          style="width: 160px"
          @update:value="handleProjectChange"
        />
      </div>

      <!-- 排序 -->
      <div class="filter-item">
        <span class="filter-label">排序：</span>
        <n-select
          :value="localFilters.sortBy"
          :options="sortOptions"
          size="small"
          style="width: 120px"
          @update:value="handleSortChange"
        />
        <n-button
          size="small"
          quaternary
          @click="toggleSortOrder"
        >
          <template #icon>
            <n-icon v-if="localFilters.sortOrder === 'asc'">
              <ArrowUpOutline />
            </n-icon>
            <n-icon v-else>
              <ArrowDownOutline />
            </n-icon>
          </template>
        </n-button>
      </div>

      <!-- 清除筛选 -->
      <n-button
        v-if="hasActiveFilters"
        size="small"
        quaternary
        @click="clearFilters"
      >
        清除筛选
      </n-button>

      <!-- 视图切换 -->
      <div class="view-toggle">
        <n-button-group>
          <n-button
            size="small"
            :type="viewMode === 'grid' ? 'primary' : 'default'"
            @click="handleViewModeChange('grid')"
          >
            <template #icon>
              <n-icon><GridOutline /></n-icon>
            </template>
            网格
          </n-button>
          <n-button
            size="small"
            :type="viewMode === 'list' ? 'primary' : 'default'"
            @click="handleViewModeChange('list')"
          >
            <template #icon>
              <n-icon><ListOutline /></n-icon>
            </template>
            列表
          </n-button>
        </n-button-group>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.asset-filter-bar {
  background: #fff;
  padding: 16px 20px;
  border-radius: 8px;
  border: 1px solid #f0f0f0;
  margin-bottom: 20px;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 16px;

  &.secondary {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #f0f0f0;
  }
}

.search-section {
  flex: 1;
  max-width: 400px;
}

.filter-section {
  flex-shrink: 0;
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 8px;

  .filter-label {
    font-size: 13px;
    color: #666;
    white-space: nowrap;
  }
}

.view-toggle {
  margin-left: auto;
}

// 响应式
@media (max-width: 768px) {
  .filter-row {
    flex-wrap: wrap;

    &.secondary {
      flex-direction: column;
      align-items: flex-start;
    }
  }

  .search-section {
    max-width: 100%;
    width: 100%;
  }

  .view-toggle {
    margin-left: 0;
    width: 100%;
    display: flex;
    justify-content: flex-end;
  }
}
</style>
