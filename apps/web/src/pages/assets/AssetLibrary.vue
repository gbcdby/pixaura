<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import {
  NLayout,
  NLayoutHeader,
  NLayoutContent,
  NButton,
  NInput,
  NSelect,
  NRadioGroup,
  NRadioButton,
  NEmpty,
  NPagination,
  NSpace,
  NTag,
  NIcon,
  NTooltip,
  NSpin,
} from "naive-ui";
import {
  Search,
  GridOutline,
  ListOutline,
  HeartOutline,
  TimeOutline,
  TrendingUpOutline,
  FilterOutline,
} from "@vicons/ionicons5";
import type { SelectOption } from "naive-ui";
import type {
  LibraryAssetType,
  LibraryAssetStatus,
} from "@pixaura/shared-types";
import { useAssetStore } from "@/stores/asset";
import AssetGrid from "@/components/asset/AssetGrid.vue";
import AssetList from "@/components/asset/AssetList.vue";

// 路由
const router = useRouter();

// Store
const assetStore = useAssetStore();

// 视图模式：网格或列表
const viewMode = ref<"grid" | "list">("grid");

// 搜索关键词
const searchKeyword = ref("");

// 筛选条件
const filters = ref({
  type: "" as LibraryAssetType | "",
  projectId: "",
  status: "" as LibraryAssetStatus | "",
  sortBy: "updatedAt" as "createdAt" | "updatedAt" | "name" | "heatScore",
  sortOrder: "desc" as "asc" | "desc",
});

// 分页（从 store 获取）
const pagination = computed(() => assetStore.pagination);

// 加载状态
const loading = computed(() => assetStore.loading);

// 资产列表（从 store 获取）
const assets = computed(() => assetStore.assets);

// 项目列表（用于筛选）
const projectOptions = ref<SelectOption[]>([{ label: "全部项目", value: "" }]);

// 类型选项
const typeOptions: SelectOption[] = [
  { label: "全部类型", value: "" },
  { label: "角色", value: "character" },
  { label: "场景", value: "scene" },
  { label: "道具", value: "prop" },
];

// 状态选项
const statusOptions: SelectOption[] = [
  { label: "全部状态", value: "" },
  { label: "草稿", value: "draft" },
  { label: "已发布", value: "active" },
  { label: "已归档", value: "archived" },
];

// 排序选项
const sortOptions: SelectOption[] = [
  { label: "最近更新", value: "updatedAt" },
  { label: "创建时间", value: "createdAt" },
  { label: "名称", value: "name" },
  { label: "热度", value: "heatScore" },
];

// 是否有筛选条件
const hasFilters = computed(() => {
  return (
    filters.value.type ||
    filters.value.projectId ||
    filters.value.status ||
    searchKeyword.value
  );
});

// 加载资产列表
const loadAssets = async (page: number = 1) => {
  // 同步筛选条件到 store
  assetStore.updateFilters({
    assetType: filters.value.type || "all",
    projectId: filters.value.projectId || "all",
    status: filters.value.status || "all",
    sortBy: filters.value.sortBy,
    sortOrder: filters.value.sortOrder,
    keyword: searchKeyword.value,
  });
  assetStore.setPage(page);

  await assetStore.fetchAssets();

  // 更新项目选项（从返回数据中提取）
  const projectMap = new Map<string, string>();
  assets.value.forEach((asset) => {
    if (asset.projectId && asset.projectName) {
      projectMap.set(asset.projectId, asset.projectName);
    }
  });
  projectOptions.value = [
    { label: "全部项目", value: "" },
    ...Array.from(projectMap.entries()).map(([id, name]) => ({
      label: name,
      value: id,
    })),
  ];
};

// 初始化加载
onMounted(() => {
  loadAssets();
});

// 监听筛选条件变化
watch(
  () => filters.value,
  () => {
    loadAssets(1);
  },
  { deep: true },
);

// 分页变化
const handlePageChange = (page: number) => {
  assetStore.setPage(page);
  loadAssets(page);
};

// 跳转到搜索页
const goToSearch = () => {
  if (searchKeyword.value.trim()) {
    router.push({
      path: "/assets/search",
      query: { q: searchKeyword.value },
    });
  }
};

// 跳转到收藏页
const goToFavorites = () => {
  router.push("/assets/favorites");
};

// 跳转到最近使用页
const goToRecent = () => {
  router.push("/assets/recent");
};

// 跳转到热门资产页
const goToPopular = () => {
  router.push("/assets/popular");
};

// 清除筛选
const clearFilters = () => {
  filters.value = {
    type: "",
    projectId: "",
    status: "",
    sortBy: "updatedAt",
    sortOrder: "desc",
  };
  searchKeyword.value = "";
  assetStore.resetFilters();
  loadAssets(1);
};

// 切换排序方向
const toggleSortOrder = () => {
  filters.value.sortOrder = filters.value.sortOrder === "asc" ? "desc" : "asc";
};
</script>

<template>
  <div class="asset-library-page">
    <n-layout class="main-layout">
      <!-- 页面头部 -->
      <n-layout-header
        class="header"
        bordered
      >
        <div class="header-content">
          <div class="header-left">
            <h1 class="page-title">
              素材库
            </h1>
            <n-tag
              v-if="pagination.total > 0"
              type="info"
              size="small"
            >
              共 {{ pagination.total }} 个
            </n-tag>
          </div>
          <div class="header-right">
            <n-space>
              <!-- 快捷入口 -->
              <n-button
                quaternary
                @click="goToFavorites"
              >
                <template #icon>
                  <n-icon><HeartOutline /></n-icon>
                </template>
                我的收藏
              </n-button>
              <n-button
                quaternary
                @click="goToRecent"
              >
                <template #icon>
                  <n-icon><TimeOutline /></n-icon>
                </template>
                最近使用
              </n-button>
              <n-button
                quaternary
                @click="goToPopular"
              >
                <template #icon>
                  <n-icon><TrendingUpOutline /></n-icon>
                </template>
                热门资产
              </n-button>
            </n-space>
          </div>
        </div>
      </n-layout-header>

      <!-- 搜索栏 -->
      <div class="search-bar">
        <n-input
          v-model:value="searchKeyword"
          placeholder="搜索资产名称、描述..."
          clearable
          size="large"
          style="max-width: 600px"
          @keyup.enter="goToSearch"
        >
          <template #prefix>
            <n-icon><Search /></n-icon>
          </template>
          <template #suffix>
            <n-button
              type="primary"
              size="small"
              @click="goToSearch"
            >
              搜索
            </n-button>
          </template>
        </n-input>
      </div>

      <!-- 筛选栏 -->
      <div class="filter-bar">
        <n-space
          align="center"
          :size="16"
        >
          <!-- 类型筛选 -->
          <n-select
            v-model:value="filters.type"
            :options="typeOptions"
            placeholder="资产类型"
            clearable
            style="width: 140px"
          />

          <!-- 项目筛选 -->
          <n-select
            v-model:value="filters.projectId"
            :options="projectOptions"
            placeholder="所属项目"
            clearable
            style="width: 160px"
          />

          <!-- 状态筛选 -->
          <n-select
            v-model:value="filters.status"
            :options="statusOptions"
            placeholder="状态"
            clearable
            style="width: 120px"
          />

          <!-- 排序 -->
          <n-select
            v-model:value="filters.sortBy"
            :options="sortOptions"
            placeholder="排序方式"
            style="width: 140px"
          />

          <n-tooltip trigger="hover">
            <template #trigger>
              <n-button
                circle
                @click="toggleSortOrder"
              >
                {{ filters.sortOrder === "asc" ? "↑" : "↓" }}
              </n-button>
            </template>
            {{ filters.sortOrder === "asc" ? "升序" : "降序" }}
          </n-tooltip>

          <n-divider vertical />

          <!-- 视图切换 -->
          <n-radio-group
            v-model:value="viewMode"
            size="small"
          >
            <n-radio-button value="grid">
              <n-icon><GridOutline /></n-icon>
            </n-radio-button>
            <n-radio-button value="list">
              <n-icon><ListOutline /></n-icon>
            </n-radio-button>
          </n-radio-group>

          <n-divider vertical />

          <!-- 清除筛选 -->
          <n-button
            v-if="hasFilters"
            quaternary
            @click="clearFilters"
          >
            <template #icon>
              <n-icon><FilterOutline /></n-icon>
            </template>
            清除筛选
          </n-button>
        </n-space>
      </div>

      <!-- 内容区 -->
      <n-layout-content class="content">
        <n-spin :show="loading">
          <!-- 空状态 -->
          <n-empty
            v-if="!loading && assets.length === 0"
            description="暂无资产"
            class="empty-state"
          >
            <template #extra>
              <n-space>
                <n-button
                  v-if="hasFilters"
                  @click="clearFilters"
                >
                  清除筛选条件
                </n-button>
                <n-button
                  type="primary"
                  @click="goToPopular"
                >
                  浏览热门资产
                </n-button>
              </n-space>
            </template>
          </n-empty>

          <!-- 资产列表 -->
          <div
            v-else
            class="asset-list"
          >
            <!-- 网格视图 -->
            <asset-grid
              v-if="viewMode === 'grid'"
              :assets="assets"
              :loading="loading"
              :selected-ids="Array.from(assetStore.selectedAssets)"
              @click="(asset) => console.log('click', asset)"
              @favorite="(asset) => console.log('favorite', asset)"
              @import="(asset) => console.log('import', asset)"
            />

            <!-- 列表视图 -->
            <asset-list
              v-else
              :assets="assets"
              :loading="loading"
              :selected-ids="Array.from(assetStore.selectedAssets)"
              @click="(asset) => console.log('click', asset)"
              @favorite="(asset) => console.log('favorite', asset)"
              @import="(asset) => console.log('import', asset)"
            />

            <!-- 分页 -->
            <div
              v-if="pagination.totalPages > 1"
              class="pagination"
            >
              <n-pagination
                :page="pagination.page"
                :page-count="pagination.totalPages"
                :page-size="pagination.pageSize"
                show-size-picker
                :page-sizes="[12, 20, 50, 100]"
                @update:page="handlePageChange"
                @update:page-size="
                  (size) => {
                    assetStore.setPageSize(size);
                    loadAssets(1);
                  }
                "
              />
            </div>
          </div>
        </n-spin>
      </n-layout-content>
    </n-layout>
  </div>
</template>

<style scoped lang="scss">
.asset-library-page {
  min-height: calc(100vh - 56px);
  background: #f5f7fa;
}

.main-layout {
  min-height: calc(100vh - 56px);
  background: transparent;
}

// 页面头部
.header {
  background: #fff;
  padding: 16px 24px;
  border-bottom: 1px solid #e8e8e8;

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;

      .page-title {
        font-size: 20px;
        font-weight: 600;
        color: #1a1a1a;
        margin: 0;
      }
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  }
}

// 搜索栏
.search-bar {
  padding: 24px 24px 16px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  display: flex;
  justify-content: center;
}

// 筛选栏
.filter-bar {
  padding: 12px 24px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

// 内容区
.content {
  padding: 24px;
  background: #f5f7fa;

  .empty-state {
    padding: 80px 0;
  }

  .asset-list {
    .asset-grid,
    .asset-list-view {
      min-height: 400px;

      .placeholder-text {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 400px;
        color: #999;
        font-size: 14px;
      }
    }

    .pagination {
      display: flex;
      justify-content: center;
      margin-top: 24px;
      padding: 16px;
      background: #fff;
      border-radius: 8px;
    }
  }
}

// 响应式
@media (max-width: 768px) {
  .header {
    .header-content {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;

      .header-right {
        width: 100%;
        justify-content: flex-start;
        flex-wrap: wrap;
      }
    }
  }

  .search-bar {
    padding: 16px;

    :deep(.n-input) {
      max-width: 100% !important;
    }
  }

  .filter-bar {
    padding: 12px 16px;

    :deep(.n-space) {
      flex-wrap: wrap;
    }
  }

  .content {
    padding: 16px;
  }
}
</style>
