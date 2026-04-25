<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import {
  NLayout,
  NLayoutHeader,
  NLayoutContent,
  NButton,
  NSelect,
  NEmpty,
  NPagination,
  NSpace,
  NTag,
  NIcon,
  useMessage,
  useDialog,
  NSpin,
  NBreadcrumb,
  NBreadcrumbItem,
  NDivider,
} from "naive-ui";
import {
  Heart,
  HeartOutline,
  ArrowBack,
  CloseOutline,
  PricetagOutline,
} from "@vicons/ionicons5";
import type { SelectOption } from "naive-ui";
import type { LibraryAssetType } from "@pixaura/shared-types";

// 路由
const router = useRouter();
const message = useMessage();
const dialog = useDialog();

// 筛选条件
const filters = ref({
  type: "" as LibraryAssetType | "",
  tag: "",
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

// 收藏列表
const favorites = ref<
  Array<{
    id: string;
    assetType: LibraryAssetType;
    assetId: string;
    name: string;
    description: string;
    thumbnailUrl: string;
    projectName: string;
    projectId: string;
    favoritedAt: string;
    tags: string[];
  }>
>([]);

// 所有标签（用于筛选）
const allTags = ref<string[]>([]);

// 类型选项
const typeOptions: SelectOption[] = [
  { label: "全部类型", value: "" },
  { label: "角色", value: "character" },
  { label: "场景", value: "scene" },
  { label: "道具", value: "prop" },
];

// 标签选项
const tagOptions = computed<SelectOption[]>(() => {
  return [
    { label: "全部标签", value: "" },
    ...allTags.value.map((tag) => ({ label: tag, value: tag })),
  ];
});

// 收藏数量
const favoriteCount = computed(() => pagination.value.total);

// 是否有筛选条件
const hasFilters = computed(() => {
  return filters.value.type || filters.value.tag;
});

// 加载收藏列表
const loadFavorites = async (_page: number = 1) => {
  loading.value = true;
  try {
    // TODO: 从 asset store 获取数据
    // const res = await assetStore.fetchFavorites({
    //   page,
    //   pageSize: pagination.value.pageSize,
    //   type: filters.value.type || undefined,
    //   tag: filters.value.tag || undefined,
    // });
    // favorites.value = res.list;
    // pagination.value = res.pagination;

    // 模拟空数据
    favorites.value = [];
    pagination.value.total = 0;
    pagination.value.totalPages = 0;
  } finally {
    loading.value = false;
  }
};

// 初始化加载
onMounted(() => {
  loadFavorites();
  // TODO: 加载用户所有标签
  // loadUserTags();
});

// 监听筛选条件变化
watch(
  () => filters.value,
  () => {
    loadFavorites(1);
  },
  { deep: true },
);

// 返回素材库
const goBack = () => {
  router.push("/assets");
};

// 分页变化
const handlePageChange = (page: number) => {
  loadFavorites(page);
};

// 清除筛选
const clearFilters = () => {
  filters.value = {
    type: "",
    tag: "",
  };
  loadFavorites(1);
};

// 取消收藏
const handleRemoveFavorite = (item: (typeof favorites.value)[0]) => {
  const d = dialog.warning({
    title: "确认取消收藏",
    content: `确定要取消收藏 "${item.name}" 吗？`,
    positiveText: "确认",
    negativeText: "取消",
    onPositiveClick: async () => {
      d.loading = true;
      try {
        // TODO: 调用 store 取消收藏
        // await assetStore.removeFavorite(item.assetType, item.assetId);
        message.success("已取消收藏");
        loadFavorites();
      } catch (error) {
        message.error("操作失败");
      } finally {
        d.loading = false;
      }
    },
  });
};

// 点击标签筛选
const filterByTag = (tag: string) => {
  filters.value.tag = tag;
};
</script>

<template>
  <div class="asset-favorites-page">
    <n-layout class="main-layout">
      <!-- 页面头部 -->
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
              <n-breadcrumb-item>我的收藏</n-breadcrumb-item>
            </n-breadcrumb>
          </div>
          <div class="header-right">
            <n-space align="center">
              <n-icon
                size="20"
                color="#ff4d4f"
              >
                <Heart />
              </n-icon>
              <n-tag
                type="error"
                size="small"
              >
                {{ favoriteCount }} 个收藏
              </n-tag>
            </n-space>
          </div>
        </div>
      </n-layout-header>

      <!-- 标签筛选栏 -->
      <div class="tag-filter-bar">
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

          <!-- 标签筛选 -->
          <n-select
            v-model:value="filters.tag"
            :options="tagOptions"
            placeholder="标签筛选"
            clearable
            style="width: 160px"
          >
            <template #arrow>
              <n-icon><PricetagOutline /></n-icon>
            </template>
          </n-select>

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

        <!-- 快捷标签 -->
        <div
          v-if="allTags.length > 0"
          class="quick-tags"
        >
          <n-space :size="8">
            <n-tag
              v-for="tag in allTags.slice(0, 10)"
              :key="tag"
              size="small"
              :type="filters.tag === tag ? 'primary' : 'default'"
              style="cursor: pointer"
              @click="filterByTag(tag)"
            >
              {{ tag }}
            </n-tag>
          </n-space>
        </div>
      </div>

      <!-- 内容区 -->
      <n-layout-content class="content">
        <n-spin :show="loading">
          <!-- 空状态 -->
          <n-empty
            v-if="!loading && favorites.length === 0"
            description="暂无收藏资产"
            class="empty-state"
          >
            <template #icon>
              <n-icon
                size="48"
                color="#ff4d4f"
              >
                <HeartOutline />
              </n-icon>
            </template>
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
                  @click="goBack"
                >
                  去浏览素材库
                </n-button>
              </n-space>
            </template>
          </n-empty>

          <!-- 收藏列表 -->
          <div
            v-else
            class="favorites-list"
          >
            <!-- TODO: 使用 AssetGrid 组件展示收藏列表 -->
            <div class="placeholder-text">
              收藏列表 - 等待组件实现
              <div class="favorite-items">
                <div
                  v-for="item in favorites"
                  :key="item.id"
                  class="favorite-item"
                >
                  <div class="item-info">
                    <img
                      :src="item.thumbnailUrl"
                      :alt="item.name"
                      class="thumbnail"
                    >
                    <div class="item-details">
                      <h4>{{ item.name }}</h4>
                      <p>{{ item.description }}</p>
                      <n-space :size="8">
                        <n-tag size="small">
                          {{ item.assetType }}
                        </n-tag>
                        <n-tag
                          v-for="tag in item.tags"
                          :key="tag"
                          size="small"
                          type="info"
                        >
                          {{ tag }}
                        </n-tag>
                      </n-space>
                    </div>
                  </div>
                  <n-button
                    quaternary
                    type="error"
                    size="small"
                    @click="handleRemoveFavorite(item)"
                  >
                    <template #icon>
                      <n-icon><Heart /></n-icon>
                    </template>
                    取消收藏
                  </n-button>
                </div>
              </div>
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
                    loadFavorites(1);
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
.asset-favorites-page {
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
    }

    .header-right {
      display: flex;
      align-items: center;
    }
  }
}

// 标签筛选栏
.tag-filter-bar {
  padding: 16px 24px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;

  .quick-tags {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px dashed #e8e8e8;
  }
}

// 内容区
.content {
  padding: 24px;
  background: #f5f7fa;

  .empty-state {
    padding: 80px 0;
  }

  .favorites-list {
    .placeholder-text {
      color: #999;
      font-size: 14px;

      .favorite-items {
        margin-top: 24px;

        .favorite-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          background: #fff;
          border-radius: 8px;
          margin-bottom: 12px;

          .item-info {
            display: flex;
            align-items: center;
            gap: 16px;

            .thumbnail {
              width: 80px;
              height: 80px;
              object-fit: cover;
              border-radius: 4px;
            }

            .item-details {
              h4 {
                margin: 0 0 8px;
                font-size: 16px;
                color: #1a1a1a;
              }

              p {
                margin: 0 0 8px;
                font-size: 14px;
                color: #666;
                max-width: 400px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              }
            }
          }
        }
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
    padding: 12px 16px;

    .header-content {
      flex-wrap: wrap;
      gap: 8px;

      .header-left {
        width: 100%;
      }
    }
  }

  .tag-filter-bar {
    padding: 12px 16px;

    :deep(.n-space) {
      flex-wrap: wrap;
    }

    .quick-tags {
      :deep(.n-space) {
        flex-wrap: wrap;
      }
    }
  }

  .content {
    padding: 16px;

    .favorites-list {
      .favorite-items {
        .favorite-item {
          flex-direction: column;
          align-items: flex-start !important;
          gap: 12px;

          .item-info {
            width: 100%;

            .item-details {
              flex: 1;
              min-width: 0;

              p {
                max-width: 100%;
              }
            }
          }
        }
      }
    }
  }
}
</style>
