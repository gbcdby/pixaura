<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  NLayout,
  NLayoutHeader,
  NLayoutContent,
  NButton,
  NInput,
  NSelect,
  NCheckbox,
  NEmpty,
  NPagination,
  NSpace,
  NTag,
  NIcon,
  useMessage,
  NSpin,
  NBreadcrumb,
  NBreadcrumbItem,
  NDivider,
} from "naive-ui";
import { Search, ArrowBack, CloseOutline } from "@vicons/ionicons5";
import type { SelectOption } from "naive-ui";
import type { LibraryAssetType } from "@pixaura/shared-types";

// 路由
const route = useRoute();
const router = useRouter();
const message = useMessage();

// 搜索关键词
const searchKeyword = ref("");

// 筛选条件
const filters = ref({
  type: "" as LibraryAssetType | "",
  projectId: "",
  includeSystem: false,
});

// 分页
const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 0,
});

// 加载状态
const loading = ref(false);

// 搜索结果
const searchResults = ref<
  Array<{
    id: string;
    type: LibraryAssetType;
    name: string;
    description: string;
    thumbnailUrl: string;
    projectId: string;
    projectName: string;
    isSystemTemplate?: boolean;
    createdAt: string;
    updatedAt: string;
    isFavorited: boolean;
  }>
>([]);

// 项目列表（用于筛选）
const projectOptions = ref<SelectOption[]>([{ label: "全部项目", value: "" }]);

// 类型选项
const typeOptions: SelectOption[] = [
  { label: "全部类型", value: "" },
  { label: "角色", value: "character" },
  { label: "场景", value: "scene" },
  { label: "道具", value: "prop" },
];

// 结果数文本
const resultCountText = computed(() => {
  if (loading.value) return "搜索中...";
  const count = pagination.value.total;
  return `找到 ${count} 个结果`;
});

// 是否有筛选条件
const hasFilters = computed(() => {
  return (
    filters.value.type || filters.value.projectId || filters.value.includeSystem
  );
});

// 从 URL 参数初始化
const initFromQuery = () => {
  const query = route.query;
  if (query.q) {
    searchKeyword.value = String(query.q);
  }
  if (query.type) {
    filters.value.type = String(query.type) as LibraryAssetType;
  }
  if (query.projectId) {
    filters.value.projectId = String(query.projectId);
  }
  if (query.includeSystem) {
    filters.value.includeSystem = String(query.includeSystem) === "true";
  }
};

// 执行搜索
const performSearch = async (_page: number = 1) => {
  if (!searchKeyword.value.trim()) {
    message.warning("请输入搜索关键词");
    return;
  }

  loading.value = true;
  try {
    // TODO: 从 asset store 获取数据
    // const res = await assetStore.searchAssets({
    //   q: searchKeyword.value,
    //   page,
    //   pageSize: pagination.value.pageSize,
    //   type: filters.value.type || undefined,
    //   projectId: filters.value.projectId || undefined,
    //   includeSystem: filters.value.includeSystem,
    // });
    // searchResults.value = res.list;
    // pagination.value = res.pagination;

    // 更新 URL
    router.replace({
      query: {
        q: searchKeyword.value,
        ...(filters.value.type && { type: filters.value.type }),
        ...(filters.value.projectId && { projectId: filters.value.projectId }),
        ...(filters.value.includeSystem && { includeSystem: "true" }),
      },
    });

    // 模拟空数据
    searchResults.value = [];
    pagination.value.total = 0;
    pagination.value.totalPages = 0;
  } finally {
    loading.value = false;
  }
};

// 初始化
onMounted(() => {
  initFromQuery();
  if (searchKeyword.value) {
    performSearch();
  }
});

// 返回素材库
const goBack = () => {
  router.push("/assets");
};

// 分页变化
const handlePageChange = (page: number) => {
  performSearch(page);
};

// 清除筛选
const clearFilters = () => {
  filters.value = {
    type: "",
    projectId: "",
    includeSystem: false,
  };
  performSearch(1);
};

// 清除搜索
const clearSearch = () => {
  searchKeyword.value = "";
  searchResults.value = [];
  pagination.value.total = 0;
  router.replace({ query: {} });
};
</script>

<template>
  <div class="asset-search-page">
    <n-layout class="main-layout">
      <!-- 搜索头部 -->
      <n-layout-header
        class="header"
        bordered
      >
        <div class="header-content">
          <div class="header-left">
            <n-button
              quaternary
              @click="goBack"
            >
              <template #icon>
                <n-icon><ArrowBack /></n-icon>
              </template>
              返回
            </n-button>
            <n-divider vertical />
            <n-breadcrumb>
              <n-breadcrumb-item @click="goBack">
                素材库
              </n-breadcrumb-item>
              <n-breadcrumb-item>搜索结果</n-breadcrumb-item>
            </n-breadcrumb>
          </div>
          <div class="header-right">
            <n-tag
              type="info"
              size="small"
            >
              {{ resultCountText }}
            </n-tag>
          </div>
        </div>

        <!-- 搜索框 -->
        <div class="search-input-wrapper">
          <n-input
            v-model:value="searchKeyword"
            placeholder="搜索资产名称、描述..."
            clearable
            size="large"
            @keyup.enter="() => performSearch(1)"
          >
            <template #prefix>
              <n-icon><Search /></n-icon>
            </template>
            <template #suffix>
              <n-button
                type="primary"
                @click="() => performSearch(1)"
              >
                搜索
              </n-button>
            </template>
          </n-input>
        </div>
      </n-layout-header>

      <!-- 筛选面板 -->
      <div class="filter-panel">
        <n-space
          align="center"
          :size="16"
        >
          <span class="filter-label">筛选条件：</span>

          <!-- 类型筛选 -->
          <n-select
            v-model:value="filters.type"
            :options="typeOptions"
            placeholder="资产类型"
            clearable
            style="width: 140px"
            @update:value="performSearch(1)"
          />

          <!-- 项目筛选 -->
          <n-select
            v-model:value="filters.projectId"
            :options="projectOptions"
            placeholder="所属项目"
            clearable
            style="width: 160px"
            @update:value="performSearch(1)"
          />

          <!-- 包含系统模板 -->
          <n-checkbox
            v-model:checked="filters.includeSystem"
            @update:checked="performSearch(1)"
          >
            包含系统模板
          </n-checkbox>

          <n-divider vertical />

          <!-- 清除筛选 -->
          <n-button
            v-if="hasFilters"
            quaternary
            size="small"
            @click="clearFilters"
          >
            <template #icon>
              <n-icon><CloseOutline /></n-icon>
            </template>
            清除筛选
          </n-button>
        </n-space>
      </div>

      <!-- 内容区 -->
      <n-layout-content class="content">
        <n-spin :show="loading">
          <!-- 无搜索关键词状态 -->
          <n-empty
            v-if="!searchKeyword && !loading"
            description="请输入关键词开始搜索"
            class="empty-state"
          >
            <template #icon>
              <n-icon size="48">
                <Search />
              </n-icon>
            </template>
          </n-empty>

          <!-- 无结果状态 -->
          <n-empty
            v-else-if="!loading && searchResults.length === 0 && searchKeyword"
            description="未找到相关资产"
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
                <n-button @click="clearSearch">
                  重新搜索
                </n-button>
              </n-space>
            </template>
          </n-empty>

          <!-- 搜索结果列表 -->
          <div
            v-else
            class="search-results"
          >
            <!-- TODO: 使用 AssetGrid 或 AssetList 组件 -->
            <div class="placeholder-text">
              搜索结果列表 - 等待组件实现
            </div>

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
                    pagination.pageSize = size;
                    performSearch(1);
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
.asset-search-page {
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
    margin-bottom: 16px;

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header-right {
      display: flex;
      align-items: center;
    }
  }

  .search-input-wrapper {
    max-width: 600px;

    :deep(.n-input) {
      .n-input__suffix {
        padding-right: 4px;
      }
    }
  }
}

// 筛选面板
.filter-panel {
  padding: 12px 24px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;

  .filter-label {
    color: #666;
    font-size: 14px;
  }
}

// 内容区
.content {
  padding: 24px;
  background: #f5f7fa;

  .empty-state {
    padding: 80px 0;
  }

  .search-results {
    .placeholder-text {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 400px;
      color: #999;
      font-size: 14px;
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
    padding: 12px 16px;

    .header-content {
      flex-wrap: wrap;
      gap: 8px;

      .header-left {
        width: 100%;
      }
    }

    .search-input-wrapper {
      max-width: 100%;
    }
  }

  .filter-panel {
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
