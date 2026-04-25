<script setup lang="ts">
import { ref, computed, onMounted, type Component } from "vue";
import {
  NCard,
  NGrid,
  NGridItem,
  NStatistic,
  NSpace,
  NButton,
  NIcon,
  NDivider,
  NSkeleton,
  NTag,
  NModal,
} from "naive-ui";
import {
  BarChart,
  People,
  Card,
  Cube,
  TrendingUp,
  Refresh,
  Megaphone,
  ChevronForward,
  Time,
  Build,
  Sparkles,
  AlertCircle,
  DocumentText,
} from "@vicons/ionicons5";
import { useRouter } from "vue-router";
import { useAdminDashboardStore } from "@/stores/admin-dashboard";
import { useSystemNoticeStore } from "@/stores/system-notice";
import { storeToRefs } from "pinia";
import type { ClientNoticeItem, NoticeType } from "@/api/system-notice";

const router = useRouter();
const dashboardStore = useAdminDashboardStore();
const noticeStore = useSystemNoticeStore();
const { formattedStats, loading } = storeToRefs(dashboardStore);
const { dashboardNotices, loading: noticeLoading } = storeToRefs(noticeStore);

// 统计数据列表
const statsList = computed(() => {
  if (!formattedStats.value) return [];

  return [
    {
      label: "用户总数",
      value: formattedStats.value.userTotal,
      change: formatChange(formattedStats.value.userChange),
      icon: People,
      color: "#9D8AE7",
      path: "/admin/users",
    },
    {
      label: "今日新增",
      value: formattedStats.value.userTodayNew,
      change: formatChange(formattedStats.value.userChange),
      icon: TrendingUp,
      color: "#10B981",
      path: "/admin/users",
    },
    {
      label: "收入金额",
      value: formattedStats.value.revenueTotal,
      change: formatChange(formattedStats.value.revenueChange),
      icon: Card,
      color: "#F59E0B",
      path: "/admin/billing",
    },
    {
      label: "模型总数",
      value: formattedStats.value.modelTotal,
      change: "+0", // 模型数量变化暂不统计
      icon: Cube,
      color: "#3B82F6",
      path: "/admin/model-config/models",
    },
  ];
});

// 格式化变化百分比
function formatChange(percent: number): string {
  const sign = percent >= 0 ? "+" : "";
  return `${sign}${percent}%`;
}

// 刷新数据
async function handleRefresh() {
  await dashboardStore.fetchStats();
  await noticeStore.fetchClientNotices({ limit: 5 });
}

// 公告相关
const showNoticeModal = ref(false);
const currentNotice = ref<ClientNoticeItem | null>(null);

// 类型图标映射
const typeIconMap: Record<NoticeType, Component> = {
  maintenance: Build,
  feature: Sparkles,
  important: AlertCircle,
  other: DocumentText,
};

// 类型颜色映射
const typeColorMap: Record<NoticeType, string> = {
  maintenance: "#f5222d",
  feature: "#1890ff",
  important: "#fa8c16",
  other: "#8c8c8c",
};

// 类型标签映射
const typeLabelMap: Record<NoticeType, string> = {
  maintenance: "系统维护",
  feature: "新功能",
  important: "重要通知",
  other: "其他",
};

// 格式化相对时间
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const dayDiff = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (dayDiff === 0) {
    const hourDiff = Math.floor(diff / (1000 * 60 * 60));
    if (hourDiff === 0) {
      const minDiff = Math.floor(diff / (1000 * 60));
      return minDiff <= 0 ? "刚刚" : `${minDiff}分钟前`;
    }
    return `${hourDiff}小时前`;
  } else if (dayDiff === 1) {
    return "昨天";
  } else if (dayDiff < 7) {
    return `${dayDiff}天前`;
  } else {
    return date.toLocaleDateString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
    });
  }
}

// 判断是否为新公告（24小时内）
function isNewNotice(dateStr: string): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  return diff < 24 * 60 * 60 * 1000;
}

// 查看公告详情
function viewNoticeDetail(notice: ClientNoticeItem) {
  currentNotice.value = notice;
  showNoticeModal.value = true;
}

// 跳转到公告管理
function goToNoticeManage() {
  router.push("/admin/notices");
}

// 页面加载时获取数据
onMounted(() => {
  dashboardStore.fetchStats();
  noticeStore.fetchClientNotices({ limit: 5 });
});

// 快捷入口
const quickLinks = [
  { label: "用户管理", path: "/admin/users", icon: People },
  { label: "供应商管理", path: "/admin/model-config/providers", icon: Cube },
  { label: "模型管理", path: "/admin/model-config/models", icon: Cube },
  { label: "健康监控", path: "/admin/model-config/health", icon: BarChart },
];
</script>

<template>
  <div class="dashboard page-container">
    <!-- 页面标题区 -->
    <div class="page-header">
      <div class="page-title">
        <n-icon
          size="24"
          class="title-icon"
        >
          <BarChart />
        </n-icon>
        <span>仪表盘</span>
      </div>
      <n-space>
        <n-button
          quaternary
          :loading="loading"
          @click="handleRefresh"
        >
          <template #icon>
            <n-icon><Refresh /></n-icon>
          </template>
          刷新
        </n-button>
      </n-space>
    </div>

    <n-divider class="page-divider" />

    <!-- 统计卡片 -->
    <n-grid
      v-if="!loading"
      :cols="4"
      :x-gap="16"
      :y-gap="16"
      class="stats-grid"
    >
      <n-grid-item
        v-for="stat in statsList"
        :key="stat.label"
      >
        <n-card
          class="stat-card"
          :bordered="false"
          hoverable
          @click="router.push(stat.path)"
        >
          <div
            class="stat-icon"
            :style="{ background: `${stat.color}20`, color: stat.color }"
          >
            <n-icon size="24">
              <component :is="stat.icon" />
            </n-icon>
          </div>
          <n-statistic
            :label="stat.label"
            :value="stat.value"
          >
            <template #suffix>
              <span
                class="stat-change"
                :style="{
                  color: stat.change.startsWith('+') ? '#10B981' : '#EF4444',
                }"
              >
                {{ stat.change }}
              </span>
            </template>
          </n-statistic>
        </n-card>
      </n-grid-item>
    </n-grid>

    <!-- 加载状态 -->
    <n-grid
      v-else
      :cols="4"
      :x-gap="16"
      :y-gap="16"
      class="stats-grid"
    >
      <n-grid-item
        v-for="i in 4"
        :key="i"
      >
        <n-card
          class="stat-card"
          :bordered="false"
        >
          <div
            class="stat-icon"
            style="background: #f5f5f5"
          >
            <n-skeleton
              text
              width="24px"
              height="24px"
            />
          </div>
          <n-skeleton
            text
            width="60%"
            style="margin-bottom: 8px"
          />
          <n-skeleton
            text
            width="40%"
          />
        </n-card>
      </n-grid-item>
    </n-grid>

    <!-- 快捷入口 -->
    <n-card
      class="quick-links-card"
      title="快捷入口"
      :bordered="false"
    >
      <n-space :size="16">
        <n-button
          v-for="link in quickLinks"
          :key="link.path"
          size="large"
          class="quick-link-btn"
          @click="router.push(link.path)"
        >
          <template #icon>
            <n-icon>
              <component :is="link.icon" />
            </n-icon>
          </template>
          {{ link.label }}
        </n-button>
      </n-space>
    </n-card>

    <!-- 系统公告 -->
    <n-card
      class="notice-card"
      :bordered="false"
    >
      <template #header>
        <div class="notice-card-header">
          <span class="card-title">
            <n-icon
              size="18"
              style="margin-right: 8px"
            >
              <Megaphone />
            </n-icon>
            系统公告
          </span>
          <n-button
            text
            size="small"
            @click="goToNoticeManage"
          >
            全部
            <template #icon>
              <n-icon><ChevronForward /></n-icon>
            </template>
          </n-button>
        </div>
      </template>

      <div
        v-if="noticeLoading"
        class="notice-loading"
      >
        <n-skeleton
          text
          :repeat="3"
        />
      </div>

      <div
        v-else-if="dashboardNotices.length === 0"
        class="notice-empty"
      >
        暂无公告
      </div>

      <div
        v-else
        class="notice-list"
      >
        <div
          v-for="notice in dashboardNotices"
          :key="notice.id"
          class="notice-item"
          @click="viewNoticeDetail(notice)"
        >
          <div
            class="notice-icon"
            :style="{
              background: `${typeColorMap[notice.type]}20`,
              color: typeColorMap[notice.type],
            }"
          >
            <n-icon size="16">
              <component :is="typeIconMap[notice.type]" />
            </n-icon>
          </div>
          <div class="notice-content">
            <div class="notice-title-wrapper">
              <span
                v-if="notice.isTop"
                class="top-tag"
              >置顶</span>
              <span
                v-if="isNewNotice(notice.createdAt)"
                class="new-tag"
              >NEW</span>
              <span class="notice-title">{{ notice.title }}</span>
            </div>
            <div
              class="notice-desc"
              v-html="
                notice.content.substring(0, 80) +
                  (notice.content.length > 80 ? '...' : '')
              "
            />
            <div class="notice-meta">
              <span class="notice-type">{{ typeLabelMap[notice.type] }}</span>
              <span class="notice-time">
                <n-icon
                  size="12"
                  style="margin-right: 4px"
                >
                  <Time />
                </n-icon>
                {{ formatRelativeTime(notice.createdAt) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </n-card>

    <!-- 公告详情弹窗 -->
    <n-modal
      v-model:show="showNoticeModal"
      preset="card"
      style="width: 600px"
      :bordered="false"
      :title="currentNotice?.title"
    >
      <div
        v-if="currentNotice"
        class="notice-detail"
      >
        <div class="notice-detail-header">
          <n-tag
            v-if="currentNotice.isTop"
            type="error"
            size="small"
          >
            置顶
          </n-tag>
          <span class="notice-detail-type">
            <n-icon
              size="14"
              style="margin-right: 4px"
            >
              <component :is="typeIconMap[currentNotice.type]" />
            </n-icon>
            {{ typeLabelMap[currentNotice.type] }}
          </span>
          <span class="notice-detail-time">
            发布时间：{{
              new Date(currentNotice.createdAt).toLocaleString("zh-CN")
            }}
          </span>
        </div>
        <div
          class="notice-detail-content"
          v-html="currentNotice.content"
        />
      </div>
    </n-modal>
  </div>
</template>

<style scoped lang="scss">
.page-container {
  padding: 24px;
  min-height: 100%;
  background: #f8f7fb;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;

  .page-title {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 20px;
    font-weight: 600;
    color: #2d2b4d;

    .title-icon {
      color: #9d8ae7;
    }
  }
}

.page-divider {
  margin: 16px 0 24px;
}

// 统计卡片
.stats-grid {
  margin-bottom: 24px;
}

.stat-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.06);
  position: relative;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }

  .stat-icon {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  :deep(.n-statistic) {
    .n-statistic__label {
      font-size: 14px;
      color: #6b6690;
      margin-bottom: 8px;
    }

    .n-statistic__value {
      font-size: 28px;
      font-weight: 600;
      color: #2d2b4d;
    }
  }

  .stat-change {
    font-size: 14px;
    font-weight: 500;
    margin-left: 8px;
  }
}

// 快捷入口
.quick-links-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.06);
  margin-bottom: 24px;

  :deep(.n-card-header) {
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    padding: 16px 20px;

    .n-card-header__main {
      font-size: 16px;
      font-weight: 600;
      color: #2d2b4d;
    }
  }

  :deep(.n-card__content) {
    padding: 20px;
  }

  .quick-link-btn {
    min-width: 160px;
    justify-content: space-between;

    &:hover {
      color: #9d8ae7;
      border-color: #9d8ae7;
    }
  }
}

// 系统公告
.notice-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.06);

  .notice-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;

    .card-title {
      display: flex;
      align-items: center;
      font-size: 16px;
      font-weight: 600;
      color: #2d2b4d;
    }
  }

  :deep(.n-card__content) {
    padding: 20px;
  }

  .notice-loading {
    padding: 20px 0;
  }

  .notice-empty {
    padding: 40px 0;
    text-align: center;
    color: #999;
    font-size: 14px;
  }

  .notice-list {
    .notice-item {
      display: flex;
      gap: 12px;
      padding: 16px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
      cursor: pointer;
      transition: background 0.2s;
      border-radius: 8px;

      &:hover {
        background: rgba(157, 138, 231, 0.05);
      }

      &:last-child {
        border-bottom: none;
      }

      .notice-icon {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .notice-content {
        flex: 1;
        min-width: 0;

        .notice-title-wrapper {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;

          .top-tag {
            background: #ff4d4f;
            color: #fff;
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 500;
          }

          .new-tag {
            background: #52c41a;
            color: #fff;
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 500;
          }

          .notice-title {
            font-size: 14px;
            font-weight: 500;
            color: #2d2b4d;
          }
        }

        .notice-desc {
          font-size: 13px;
          color: #6b6690;
          margin-bottom: 8px;
          line-height: 1.5;
        }

        .notice-meta {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 12px;

          .notice-type {
            color: #9d8ae7;
          }

          .notice-time {
            color: #9b98b5;
            display: flex;
            align-items: center;
          }
        }
      }
    }
  }
}

// 公告详情
.notice-detail {
  .notice-detail-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    margin-bottom: 16px;

    .notice-detail-type {
      display: flex;
      align-items: center;
      color: #666;
      font-size: 13px;
    }

    .notice-detail-time {
      color: #999;
      font-size: 13px;
      margin-left: auto;
    }
  }

  .notice-detail-content {
    font-size: 14px;
    line-height: 1.8;
    color: #333;

    :deep(p) {
      margin-bottom: 12px;
    }

    :deep(ul),
    :deep(ol) {
      margin-bottom: 12px;
      padding-left: 24px;
    }

    :deep(li) {
      margin-bottom: 4px;
    }

    :deep(h1),
    :deep(h2),
    :deep(h3) {
      margin-bottom: 12px;
      font-weight: 600;
    }

    :deep(a) {
      color: #9d8ae7;
    }
  }
}
</style>
