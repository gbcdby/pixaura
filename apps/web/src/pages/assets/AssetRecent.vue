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
  NSpace,
  NTag,
  NIcon,
  useMessage,
  NSpin,
  NBreadcrumb,
  NBreadcrumbItem,
  NDivider,
  NPopconfirm,
} from "naive-ui";
import {
  TimeOutline,
  ArrowBack,
  TrashOutline,
  EyeOutline,
  DownloadOutline,
  FilmOutline,
  CloseOutline,
} from "@vicons/ionicons5";
import type { SelectOption } from "naive-ui";
import type { LibraryAssetType, UserActionType } from "@pixaura/shared-types";

// 路由
const router = useRouter();
const message = useMessage();

// 筛选条件
const filters = ref({
  type: "" as LibraryAssetType | "",
  action: "" as UserActionType | "",
});

// 加载状态
const loading = ref(false);

// 最近使用列表
const recentItems = ref<
  Array<{
    id: string;
    assetType: LibraryAssetType;
    assetId: string;
    name: string;
    thumbnailUrl: string;
    action: UserActionType;
    context?: {
      sourceProjectName?: string;
      targetProjectName?: string;
    };
    usedAt: string;
  }>
>([]);

// 类型选项
const typeOptions: SelectOption[] = [
  { label: "全部类型", value: "" },
  { label: "角色", value: "character" },
  { label: "场景", value: "scene" },
  { label: "道具", value: "prop" },
];

// 操作类型选项
const actionOptions: SelectOption[] = [
  { label: "全部操作", value: "" },
  { label: "查看", value: "view" },
  { label: "导入", value: "import" },
  { label: "使用", value: "use_in_shot" },
];

// 是否有筛选条件
const hasFilters = computed(() => {
  return filters.value.type || filters.value.action;
});

// 按时间分组的最近使用记录
const groupedRecentItems = computed(() => {
  const groups: Record<string, typeof recentItems.value> = {
    today: [],
    yesterday: [],
    earlier: [],
  };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  recentItems.value.forEach((item) => {
    const itemDate = new Date(item.usedAt);
    if (itemDate >= today) {
      groups.today.push(item);
    } else if (itemDate >= yesterday) {
      groups.yesterday.push(item);
    } else {
      groups.earlier.push(item);
    }
  });

  return groups;
});

// 加载最近使用列表
const loadRecentItems = async () => {
  loading.value = true;
  try {
    // TODO: 从 asset store 获取数据
    // const res = await assetStore.fetchRecent({
    //   limit: 50,
    //   type: filters.value.type || undefined,
    //   action: filters.value.action || undefined,
    // });
    // recentItems.value = res;

    // 模拟空数据
    recentItems.value = [];
  } finally {
    loading.value = false;
  }
};

// 初始化加载
onMounted(() => {
  loadRecentItems();
});

// 监听筛选条件变化
watch(
  () => filters.value,
  () => {
    loadRecentItems();
  },
  { deep: true },
);

// 返回素材库
const goBack = () => {
  router.push("/assets");
};

// 清除筛选
const clearFilters = () => {
  filters.value = {
    type: "",
    action: "",
  };
  loadRecentItems();
};

// 清除所有历史
const handleClearAll = async () => {
  // TODO: 调用 store 清除历史
  // await assetStore.clearRecentHistory();
  message.success("历史记录已清除");
  recentItems.value = [];
};

// 获取操作图标
const getActionIcon = (action: UserActionType) => {
  switch (action) {
    case "view":
      return EyeOutline;
    case "import":
      return DownloadOutline;
    case "use_in_shot":
      return FilmOutline;
    default:
      return TimeOutline;
  }
};

// 获取操作文本
const getActionText = (action: UserActionType) => {
  switch (action) {
    case "view":
      return "查看";
    case "import":
      return "导入";
    case "use_in_shot":
      return "使用";
    default:
      return action;
  }
};

// 获取操作标签类型
const getActionTagType = (
  action: UserActionType,
): "default" | "primary" | "success" | "warning" => {
  switch (action) {
    case "view":
      return "default";
    case "import":
      return "success";
    case "use_in_shot":
      return "warning";
    default:
      return "default";
  }
};

// 格式化时间
const formatTime = (timeStr: string) => {
  const date = new Date(timeStr);
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

// 格式化日期
const formatDate = (timeStr: string) => {
  const date = new Date(timeStr);
  return date.toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
  });
};
</script>

<template>
  <div class="asset-recent-page">
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
              <n-breadcrumb-item>最近使用</n-breadcrumb-item>
            </n-breadcrumb>
          </div>
          <div class="header-right">
            <n-popconfirm
              negative-text="取消"
              positive-text="确认清除"
              @positive-click="handleClearAll"
            >
              <template #trigger>
                <n-button
                  quaternary
                  type="error"
                >
                  <template #icon>
                    <n-icon><TrashOutline /></n-icon>
                  </template>
                  清除历史
                </n-button>
              </template>
              确定要清除所有最近使用记录吗？此操作不可恢复。
            </n-popconfirm>
          </div>
        </div>
      </n-layout-header>

      <!-- 操作类型筛选栏 -->
      <div class="action-filter-bar">
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

          <!-- 操作类型筛选 -->
          <n-select
            v-model:value="filters.action"
            :options="actionOptions"
            placeholder="操作类型"
            clearable
            style="width: 140px"
          />

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
          <!-- 空状态 -->
          <n-empty
            v-if="!loading && recentItems.length === 0"
            description="暂无使用记录"
            class="empty-state"
          >
            <template #icon>
              <n-icon size="48">
                <TimeOutline />
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

          <!-- 时间线展示 -->
          <div
            v-else
            class="recent-timeline"
          >
            <!-- 今天 -->
            <div
              v-if="groupedRecentItems.today.length > 0"
              class="timeline-section"
            >
              <h3 class="section-title">
                今天
              </h3>
              <div class="item-list">
                <div
                  v-for="item in groupedRecentItems.today"
                  :key="item.id"
                  class="recent-item"
                >
                  <div class="item-time">
                    {{ formatTime(item.usedAt) }}
                  </div>
                  <div class="item-content">
                    <img
                      :src="item.thumbnailUrl"
                      :alt="item.name"
                      class="item-thumbnail"
                    >
                    <div class="item-info">
                      <div class="item-name">
                        {{ item.name }}
                      </div>
                      <n-space :size="8">
                        <n-tag size="small">
                          {{ item.assetType }}
                        </n-tag>
                        <n-tag
                          :type="getActionTagType(item.action)"
                          size="small"
                        >
                          <n-icon :component="getActionIcon(item.action)" />
                          {{ getActionText(item.action) }}
                        </n-tag>
                      </n-space>
                      <div
                        v-if="item.context"
                        class="item-context"
                      >
                        <span v-if="item.context.sourceProjectName">来自：{{ item.context.sourceProjectName }}</span>
                        <span v-if="item.context.targetProjectName">导入到：{{ item.context.targetProjectName }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 昨天 -->
            <div
              v-if="groupedRecentItems.yesterday.length > 0"
              class="timeline-section"
            >
              <h3 class="section-title">
                昨天
              </h3>
              <div class="item-list">
                <div
                  v-for="item in groupedRecentItems.yesterday"
                  :key="item.id"
                  class="recent-item"
                >
                  <div class="item-time">
                    {{ formatTime(item.usedAt) }}
                  </div>
                  <div class="item-content">
                    <img
                      :src="item.thumbnailUrl"
                      :alt="item.name"
                      class="item-thumbnail"
                    >
                    <div class="item-info">
                      <div class="item-name">
                        {{ item.name }}
                      </div>
                      <n-space :size="8">
                        <n-tag size="small">
                          {{ item.assetType }}
                        </n-tag>
                        <n-tag
                          :type="getActionTagType(item.action)"
                          size="small"
                        >
                          <n-icon :component="getActionIcon(item.action)" />
                          {{ getActionText(item.action) }}
                        </n-tag>
                      </n-space>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 更早 -->
            <div
              v-if="groupedRecentItems.earlier.length > 0"
              class="timeline-section"
            >
              <h3 class="section-title">
                更早
              </h3>
              <div class="item-list">
                <div
                  v-for="item in groupedRecentItems.earlier"
                  :key="item.id"
                  class="recent-item"
                >
                  <div class="item-time">
                    <div>{{ formatDate(item.usedAt) }}</div>
                    <div class="time-sub">
                      {{ formatTime(item.usedAt) }}
                    </div>
                  </div>
                  <div class="item-content">
                    <img
                      :src="item.thumbnailUrl"
                      :alt="item.name"
                      class="item-thumbnail"
                    >
                    <div class="item-info">
                      <div class="item-name">
                        {{ item.name }}
                      </div>
                      <n-space :size="8">
                        <n-tag size="small">
                          {{ item.assetType }}
                        </n-tag>
                        <n-tag
                          :type="getActionTagType(item.action)"
                          size="small"
                        >
                          <n-icon :component="getActionIcon(item.action)" />
                          {{ getActionText(item.action) }}
                        </n-tag>
                      </n-space>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </n-spin>
      </n-layout-content>
    </n-layout>
  </div>
</template>

<style scoped lang="scss">
.asset-recent-page {
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

// 操作类型筛选栏
.action-filter-bar {
  padding: 12px 24px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
}

// 内容区
.content {
  padding: 24px;
  background: #f5f7fa;

  .empty-state {
    padding: 80px 0;
  }

  .recent-timeline {
    .timeline-section {
      margin-bottom: 32px;

      .section-title {
        font-size: 16px;
        font-weight: 600;
        color: #1a1a1a;
        margin: 0 0 16px;
        padding-bottom: 8px;
        border-bottom: 2px solid #e8e8e8;
      }

      .item-list {
        .recent-item {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 12px 16px;
          background: #fff;
          border-radius: 8px;
          margin-bottom: 8px;
          transition: background-color 0.2s;

          &:hover {
            background: #f5f5f5;
          }

          .item-time {
            width: 60px;
            flex-shrink: 0;
            font-size: 14px;
            color: #666;
            text-align: center;

            .time-sub {
              font-size: 12px;
              color: #999;
            }
          }

          .item-content {
            flex: 1;
            display: flex;
            align-items: center;
            gap: 12px;

            .item-thumbnail {
              width: 60px;
              height: 60px;
              object-fit: cover;
              border-radius: 4px;
              flex-shrink: 0;
            }

            .item-info {
              flex: 1;
              min-width: 0;

              .item-name {
                font-size: 15px;
                font-weight: 500;
                color: #1a1a1a;
                margin-bottom: 8px;
              }

              .item-context {
                margin-top: 4px;
                font-size: 12px;
                color: #999;

                span {
                  margin-right: 12px;
                }
              }
            }
          }
        }
      }
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

  .action-filter-bar {
    padding: 12px 16px;

    :deep(.n-space) {
      flex-wrap: wrap;
    }
  }

  .content {
    padding: 16px;

    .recent-timeline {
      .timeline-section {
        .recent-item {
          flex-direction: column;
          align-items: flex-start !important;
          gap: 8px;

          .item-time {
            width: 100%;
            text-align: left;
            display: flex;
            gap: 8px;

            .time-sub {
              color: #999;
            }
          }

          .item-content {
            width: 100%;
          }
        }
      }
    }
  }
}
</style>
