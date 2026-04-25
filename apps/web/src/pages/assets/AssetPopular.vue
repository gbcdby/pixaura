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
  NSpin,
  NBreadcrumb,
  NBreadcrumbItem,
  NDivider,
  NCard,
  NStatistic,
  NNumberAnimation,
} from "naive-ui";
import {
  TrendingUpOutline,
  ArrowBack,
  FlameOutline,
  EyeOutline,
  DownloadOutline,
  HeartOutline,
  TrophyOutline,
  MedalOutline,
  RibbonOutline,
} from "@vicons/ionicons5";
import type { SelectOption } from "naive-ui";
import type { LibraryAssetType } from "@pixaura/shared-types";

// 路由
const router = useRouter();

// 周期选择
const period = ref<"week" | "month" | "all">("month");

// 类型筛选
const typeFilter = ref<LibraryAssetType | "">("");

// 加载状态
const loading = ref(false);

// 热门资产列表
const popularAssets = ref<
  Array<{
    rank: number;
    id: string;
    type: LibraryAssetType;
    name: string;
    description: string;
    thumbnailUrl: string;
    projectId: string;
    projectName: string;
    heatScore: number;
    importCount: number;
    usageCount: number;
  }>
>([]);

// 更新时间
const updatedAt = ref<string>("");

// 周期选项
const periodOptions: SelectOption[] = [
  { label: "本周", value: "week" },
  { label: "本月", value: "month" },
  { label: "全部时间", value: "all" },
];

// 类型选项
const typeOptions: SelectOption[] = [
  { label: "全部类型", value: "" },
  { label: "角色", value: "character" },
  { label: "场景", value: "scene" },
  { label: "道具", value: "prop" },
];

// 统计数据
const statistics = computed(() => {
  const totalImport = popularAssets.value.reduce(
    (sum, item) => sum + item.importCount,
    0,
  );
  const totalUsage = popularAssets.value.reduce(
    (sum, item) => sum + item.usageCount,
    0,
  );
  const avgHeat =
    popularAssets.value.length > 0
      ? Math.round(
          popularAssets.value.reduce((sum, item) => sum + item.heatScore, 0) /
            popularAssets.value.length,
        )
      : 0;

  return {
    totalImport,
    totalUsage,
    avgHeat,
  };
});

// 加载热门资产
const loadPopularAssets = async () => {
  loading.value = true;
  try {
    // TODO: 从 asset store 获取数据
    // const res = await assetStore.fetchPopularAssets({
    //   period: period.value,
    //   type: typeFilter.value || undefined,
    //   limit: 20,
    // });
    // popularAssets.value = res.list;
    // updatedAt.value = res.updatedAt;

    // 模拟空数据
    popularAssets.value = [];
    updatedAt.value = new Date().toISOString();
  } finally {
    loading.value = false;
  }
};

// 初始化加载
onMounted(() => {
  loadPopularAssets();
});

// 监听筛选条件变化
watch(
  () => [period.value, typeFilter.value],
  () => {
    loadPopularAssets();
  },
  { deep: true },
);

// 返回素材库
const goBack = () => {
  router.push("/assets");
};

// 获取排名图标
const getRankIcon = (rank: number) => {
  switch (rank) {
    case 1:
      return TrophyOutline;
    case 2:
      return MedalOutline;
    case 3:
      return RibbonOutline;
    default:
      return null;
  }
};

// 获取排名颜色
const getRankColor = (rank: number): string => {
  switch (rank) {
    case 1:
      return "#FFD700"; // 金色
    case 2:
      return "#C0C0C0"; // 银色
    case 3:
      return "#CD7F32"; // 铜色
    default:
      return "#999";
  }
};

// 获取排名标签类型
const getRankTagType = (
  rank: number,
): "error" | "warning" | "success" | "default" => {
  switch (rank) {
    case 1:
      return "error";
    case 2:
      return "warning";
    case 3:
      return "success";
    default:
      return "default";
  }
};

// 格式化数字
const formatNumber = (num: number): string => {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + "w";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "k";
  }
  return String(num);
};

// 格式化时间
const formatTime = (timeStr: string): string => {
  if (!timeStr) return "-";
  const date = new Date(timeStr);
  return date.toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};
</script>

<template>
  <div class="asset-popular-page">
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
              <n-breadcrumb-item>热门资产</n-breadcrumb-item>
            </n-breadcrumb>
          </div>
          <div class="header-right">
            <n-space align="center">
              <n-icon
                size="24"
                color="#ff4d4f"
              >
                <FlameOutline />
              </n-icon>
              <span class="page-title">热门排行</span>
            </n-space>
          </div>
        </div>
      </n-layout-header>

      <!-- 筛选栏 -->
      <div class="filter-bar">
        <n-space
          align="center"
          :size="16"
        >
          <!-- 周期选择 -->
          <n-select
            v-model:value="period"
            :options="periodOptions"
            placeholder="统计周期"
            style="width: 140px"
          />

          <!-- 类型筛选 -->
          <n-select
            v-model:value="typeFilter"
            :options="typeOptions"
            placeholder="资产类型"
            clearable
            style="width: 140px"
          />

          <n-divider vertical />

          <!-- 更新时间 -->
          <span
            v-if="updatedAt"
            class="update-time"
          >
            更新时间：{{ formatTime(updatedAt) }}
          </span>
        </n-space>
      </div>

      <!-- 统计卡片 -->
      <div class="statistics-bar">
        <n-space :size="16">
          <n-card
            class="stat-card"
            size="small"
          >
            <n-statistic label="总导入次数">
              <n-number-animation
                :from="0"
                :to="statistics.totalImport"
                :duration="1000"
              />
            </n-statistic>
          </n-card>
          <n-card
            class="stat-card"
            size="small"
          >
            <n-statistic label="总使用次数">
              <n-number-animation
                :from="0"
                :to="statistics.totalUsage"
                :duration="1000"
              />
            </n-statistic>
          </n-card>
          <n-card
            class="stat-card"
            size="small"
          >
            <n-statistic label="平均热度">
              <n-number-animation
                :from="0"
                :to="statistics.avgHeat"
                :duration="1000"
              />
            </n-statistic>
          </n-card>
        </n-space>
      </div>

      <!-- 内容区 -->
      <n-layout-content class="content">
        <n-spin :show="loading">
          <!-- 空状态 -->
          <n-empty
            v-if="!loading && popularAssets.length === 0"
            description="暂无热门资产数据"
            class="empty-state"
          >
            <template #icon>
              <n-icon size="48">
                <TrendingUpOutline />
              </n-icon>
            </template>
            <template #extra>
              <n-button
                type="primary"
                @click="goBack"
              >
                去浏览素材库
              </n-button>
            </template>
          </n-empty>

          <!-- 热门资产列表 -->
          <div
            v-else
            class="popular-list"
          >
            <div
              v-for="item in popularAssets"
              :key="item.id"
              class="popular-item"
              :class="{ 'top-three': item.rank <= 3 }"
            >
              <!-- 排名 -->
              <div
                class="rank-badge"
                :style="{ color: getRankColor(item.rank) }"
              >
                <n-icon
                  v-if="getRankIcon(item.rank)"
                  size="32"
                >
                  <component :is="getRankIcon(item.rank)" />
                </n-icon>
                <span
                  v-else
                  class="rank-number"
                >{{ item.rank }}</span>
              </div>

              <!-- 缩略图 -->
              <div class="item-thumbnail-wrapper">
                <img
                  :src="item.thumbnailUrl"
                  :alt="item.name"
                  class="item-thumbnail"
                >
                <n-tag
                  v-if="item.rank <= 3"
                  :type="getRankTagType(item.rank)"
                  size="small"
                  class="rank-tag"
                >
                  TOP {{ item.rank }}
                </n-tag>
              </div>

              <!-- 资产信息 -->
              <div class="item-info">
                <h4 class="item-name">
                  {{ item.name }}
                </h4>
                <p class="item-description">
                  {{ item.description }}
                </p>
                <n-space :size="8">
                  <n-tag size="small">
                    {{ item.type }}
                  </n-tag>
                  <n-tag
                    size="small"
                    type="info"
                  >
                    {{ item.projectName }}
                  </n-tag>
                </n-space>
              </div>

              <!-- 统计数据 -->
              <div class="item-stats">
                <div class="stat-item">
                  <n-icon
                    size="16"
                    color="#ff4d4f"
                  >
                    <FlameOutline />
                  </n-icon>
                  <span class="stat-value heat">{{
                    formatNumber(item.heatScore)
                  }}</span>
                  <span class="stat-label">热度</span>
                </div>
                <div class="stat-item">
                  <n-icon
                    size="16"
                    color="#1890ff"
                  >
                    <DownloadOutline />
                  </n-icon>
                  <span class="stat-value">{{
                    formatNumber(item.importCount)
                  }}</span>
                  <span class="stat-label">导入</span>
                </div>
                <div class="stat-item">
                  <n-icon
                    size="16"
                    color="#52c41a"
                  >
                    <EyeOutline />
                  </n-icon>
                  <span class="stat-value">{{
                    formatNumber(item.usageCount)
                  }}</span>
                  <span class="stat-label">使用</span>
                </div>
              </div>

              <!-- 操作按钮 -->
              <div class="item-actions">
                <n-button
                  type="primary"
                  size="small"
                >
                  查看详情
                </n-button>
                <n-button size="small">
                  <template #icon>
                    <n-icon><HeartOutline /></n-icon>
                  </template>
                  收藏
                </n-button>
              </div>
            </div>
          </div>
        </n-spin>
      </n-layout-content>
    </n-layout>
  </div>
</template>

<style scoped lang="scss">
.asset-popular-page {
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
      gap: 8px;

      .page-title {
        font-size: 18px;
        font-weight: 600;
        color: #1a1a1a;
      }
    }
  }
}

// 筛选栏
.filter-bar {
  padding: 12px 24px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;

  .update-time {
    font-size: 13px;
    color: #999;
  }
}

// 统计栏
.statistics-bar {
  padding: 16px 24px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;

  .stat-card {
    min-width: 150px;
    text-align: center;

    :deep(.n-statistic__label) {
      font-size: 13px;
      color: #666;
    }

    :deep(.n-statistic__value) {
      font-size: 24px;
      font-weight: 600;
      color: #1890ff;
    }
  }
}

// 内容区
.content {
  padding: 24px;
  background: #f5f7fa;

  .empty-state {
    padding: 80px 0;
  }

  .popular-list {
    .popular-item {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      background: #fff;
      border-radius: 8px;
      margin-bottom: 12px;
      transition: all 0.2s;

      &:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        transform: translateY(-2px);
      }

      &.top-three {
        background: linear-gradient(135deg, #fff 0%, #fffbf0 100%);
        border: 1px solid #ffe7ba;
      }

      .rank-badge {
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;

        .rank-number {
          font-size: 20px;
          font-weight: 600;
        }
      }

      .item-thumbnail-wrapper {
        position: relative;
        flex-shrink: 0;

        .item-thumbnail {
          width: 100px;
          height: 100px;
          object-fit: cover;
          border-radius: 8px;
        }

        .rank-tag {
          position: absolute;
          top: 4px;
          left: 4px;
        }
      }

      .item-info {
        flex: 1;
        min-width: 0;

        .item-name {
          font-size: 16px;
          font-weight: 600;
          color: #1a1a1a;
          margin: 0 0 8px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .item-description {
          font-size: 13px;
          color: #666;
          margin: 0 0 12px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }

      .item-stats {
        display: flex;
        gap: 24px;
        padding: 0 16px;

        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;

          .stat-value {
            font-size: 18px;
            font-weight: 600;
            color: #1a1a1a;

            &.heat {
              color: #ff4d4f;
            }
          }

          .stat-label {
            font-size: 12px;
            color: #999;
          }
        }
      }

      .item-actions {
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex-shrink: 0;
      }
    }
  }
}

// 响应式
@media (max-width: 992px) {
  .content {
    .popular-list {
      .popular-item {
        flex-wrap: wrap;

        .item-stats {
          width: 100%;
          justify-content: center;
          padding: 12px 0;
          border-top: 1px solid #f0f0f0;
          margin-top: 8px;
        }

        .item-actions {
          flex-direction: row;
          width: 100%;
          justify-content: flex-end;
        }
      }
    }
  }
}

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

  .filter-bar,
  .statistics-bar {
    padding: 12px 16px;

    :deep(.n-space) {
      flex-wrap: wrap;
    }
  }

  .content {
    padding: 16px;

    .popular-list {
      .popular-item {
        flex-direction: column;
        align-items: flex-start;

        .rank-badge {
          position: absolute;
          top: 8px;
          left: 8px;
          background: rgba(255, 255, 255, 0.9);
          border-radius: 50%;
        }

        .item-thumbnail-wrapper {
          width: 100%;

          .item-thumbnail {
            width: 100%;
            height: 180px;
          }
        }

        .item-info {
          width: 100%;
        }

        .item-stats {
          width: 100%;
          justify-content: space-around;
        }

        .item-actions {
          width: 100%;
          justify-content: center;
        }
      }
    }
  }
}
</style>
