<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import {
  NCard,
  NButton,
  NSpace,
  NGrid,
  NGridItem,
  NStatistic,
  NTag,
  NTimeline,
  NTimelineItem,
  NEmpty,
  NSpin,
  useMessage,
  NIcon,
  NDivider,
} from "naive-ui";
import { useModelConfigStore } from "@/stores/model-config";
import type { ProviderHealthStatusDto } from "@/types/model-config";
import {
  Refresh,
  Pulse,
  CheckmarkCircle,
  CloseCircle,
  HelpCircle,
  Time,
  Fitness,
  PlayCircle,
  StopCircle,
} from "@vicons/ionicons5";

const message = useMessage();
const store = useModelConfigStore();

// 自动刷新定时器
let refreshTimer: number | null = null;
const isAutoRefresh = ref(true);

// 健康状态统计
const healthyCount = ref(0);
const unhealthyCount = ref(0);
const unknownCount = ref(0);
const avgResponseTime = ref(0);

// 健康检查日志
const healthLogs = ref<
  Array<{
    id: string;
    providerName: string;
    status: "success" | "failed";
    message: string;
    time: string;
  }>
>([]);

// 加载数据
async function loadData() {
  await store.fetchHealthStatus();
  updateStats();
}

// 更新统计数据
function updateStats() {
  const status = store.healthStatus;
  healthyCount.value = status.filter(
    (s) => s.healthStatus === "healthy",
  ).length;
  unhealthyCount.value = status.filter(
    (s) => s.healthStatus === "unhealthy",
  ).length;
  unknownCount.value = status.filter(
    (s) => s.healthStatus === "unknown",
  ).length;

  const totalResponseTime = status.reduce(
    (sum, s) => sum + s.avgResponseTimeMs,
    0,
  );
  avgResponseTime.value =
    status.length > 0 ? Math.round(totalResponseTime / status.length) : 0;

  // 更新日志
  updateLogs(status);
}

// 更新日志
function updateLogs(status: ProviderHealthStatusDto[]) {
  const logs = status.map((s) => ({
    id: s.providerId,
    providerName: s.providerName,
    status: (s.healthStatus === "healthy" ? "success" : "failed") as
      | "success"
      | "failed",
    message:
      s.healthStatus === "healthy"
        ? `响应时间 ${s.avgResponseTimeMs}ms`
        : s.failoverTo
          ? `已故障转移至 ${s.failoverTo}`
          : "健康检查失败",
    time: s.lastCheckAt ? new Date(s.lastCheckAt).toLocaleTimeString() : "未知",
  }));
  healthLogs.value = logs;
}

// 手动触发健康检查
async function handleManualCheck() {
  try {
    await store.triggerHealthCheck();
    updateStats();
    message.success("健康检查完成");
  } catch (error) {
    message.error("健康检查失败");
  }
}

// 刷新数据
async function handleRefresh() {
  await loadData();
  message.success("刷新成功");
}

// 获取状态标签类型
function getStatusType(status: string) {
  const typeMap: Record<string, "success" | "error" | "default"> = {
    healthy: "success",
    unhealthy: "error",
    unknown: "default",
  };
  return typeMap[status] || "default";
}

// 获取状态文本
function getStatusText(status: string) {
  const textMap: Record<string, string> = {
    healthy: "健康",
    unhealthy: "故障",
    unknown: "未知",
  };
  return textMap[status] || status;
}

// 获取状态图标
function getStatusIcon(status: string) {
  const iconMap: Record<string, any> = {
    healthy: CheckmarkCircle,
    unhealthy: CloseCircle,
    unknown: HelpCircle,
  };
  return iconMap[status] || HelpCircle;
}

// 启动自动刷新
function startAutoRefresh() {
  if (refreshTimer) return;
  refreshTimer = window.setInterval(() => {
    loadData();
  }, 30000); // 30秒刷新一次
}

// 停止自动刷新
function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

// 切换自动刷新
function toggleAutoRefresh() {
  isAutoRefresh.value = !isAutoRefresh.value;
  if (isAutoRefresh.value) {
    startAutoRefresh();
    message.success("已开启自动刷新");
  } else {
    stopAutoRefresh();
    message.info("已关闭自动刷新");
  }
}

onMounted(() => {
  loadData();
  startAutoRefresh();
});

onUnmounted(() => {
  stopAutoRefresh();
});
</script>

<template>
  <div class="health-monitor page-container">
    <!-- 页面标题区 -->
    <div class="page-header">
      <div class="page-title">
        <n-icon
          size="24"
          class="title-icon"
        >
          <Pulse />
        </n-icon>
        <span>健康监控</span>
      </div>
      <n-space>
        <n-button
          quaternary
          @click="toggleAutoRefresh"
        >
          <template #icon>
            <n-icon>
              <StopCircle v-if="isAutoRefresh" />
              <PlayCircle v-else />
            </n-icon>
          </template>
          {{ isAutoRefresh ? "关闭" : "开启" }}自动刷新
        </n-button>
        <n-button
          quaternary
          @click="handleRefresh"
        >
          <template #icon>
            <n-icon><Refresh /></n-icon>
          </template>
          刷新
        </n-button>
        <n-button
          type="primary"
          @click="handleManualCheck"
        >
          <template #icon>
            <n-icon><Fitness /></n-icon>
          </template>
          手动检查
        </n-button>
      </n-space>
    </div>

    <n-divider class="page-divider" />

    <!-- 统计卡片 -->
    <n-grid
      :cols="4"
      :x-gap="16"
      :y-gap="16"
      class="stats-grid"
    >
      <n-grid-item>
        <n-card
          class="stat-card stat-card-success"
          :bordered="false"
        >
          <div class="stat-icon">
            <n-icon size="24">
              <CheckmarkCircle />
            </n-icon>
          </div>
          <n-statistic
            label="健康供应商"
            :value="healthyCount"
          >
            <template #suffix>
              <n-tag
                type="success"
                size="small"
              >
                正常
              </n-tag>
            </template>
          </n-statistic>
        </n-card>
      </n-grid-item>

      <n-grid-item>
        <n-card
          class="stat-card stat-card-error"
          :bordered="false"
        >
          <div class="stat-icon">
            <n-icon size="24">
              <CloseCircle />
            </n-icon>
          </div>
          <n-statistic
            label="故障供应商"
            :value="unhealthyCount"
          >
            <template #suffix>
              <n-tag
                type="error"
                size="small"
              >
                故障
              </n-tag>
            </template>
          </n-statistic>
        </n-card>
      </n-grid-item>

      <n-grid-item>
        <n-card
          class="stat-card stat-card-default"
          :bordered="false"
        >
          <div class="stat-icon">
            <n-icon size="24">
              <HelpCircle />
            </n-icon>
          </div>
          <n-statistic
            label="未知状态"
            :value="unknownCount"
          >
            <template #suffix>
              <n-tag size="small">
                未知
              </n-tag>
            </template>
          </n-statistic>
        </n-card>
      </n-grid-item>

      <n-grid-item>
        <n-card
          class="stat-card"
          :bordered="false"
        >
          <div class="stat-icon">
            <n-icon size="24">
              <Time />
            </n-icon>
          </div>
          <n-statistic
            label="平均响应时间"
            :value="avgResponseTime"
            suffix="ms"
          />
        </n-card>
      </n-grid-item>
    </n-grid>

    <!-- 详情区域 -->
    <n-grid
      :cols="2"
      :x-gap="16"
      :y-gap="16"
      class="detail-grid"
    >
      <n-grid-item>
        <n-card
          class="detail-card"
          title="供应商健康状态"
          :bordered="false"
        >
          <n-spin :show="store.loading">
            <div
              v-if="store.healthStatus.length === 0"
              class="empty"
            >
              <n-empty description="暂无供应商数据" />
            </div>
            <div
              v-else
              class="provider-list"
            >
              <div
                v-for="provider in store.healthStatus"
                :key="provider.providerId"
                class="provider-item"
              >
                <div class="provider-info">
                  <span class="provider-name">{{ provider.providerName }}</span>
                  <n-tag
                    :type="getStatusType(provider.healthStatus)"
                    size="small"
                  >
                    <template #icon>
                      <n-icon>
                        <component :is="getStatusIcon(provider.healthStatus)" />
                      </n-icon>
                    </template>
                    {{ getStatusText(provider.healthStatus) }}
                  </n-tag>
                </div>
                <div class="provider-detail">
                  <span v-if="provider.avgResponseTimeMs > 0">响应时间: {{ provider.avgResponseTimeMs }}ms</span>
                  <span
                    v-if="provider.failoverTo"
                    class="failover"
                  >已转移至: {{ provider.failoverTo }}</span>
                  <span
                    v-if="provider.failureCount > 0"
                    class="failure-count"
                  >失败次数: {{ provider.failureCount }}</span>
                </div>
              </div>
            </div>
          </n-spin>
        </n-card>
      </n-grid-item>

      <!-- 健康检查日志 -->
      <n-grid-item>
        <n-card
          class="detail-card"
          title="健康检查日志"
          :bordered="false"
        >
          <n-spin :show="store.loading">
            <div
              v-if="healthLogs.length === 0"
              class="empty"
            >
              <n-empty description="暂无检查日志" />
            </div>
            <n-timeline v-else>
              <n-timeline-item
                v-for="log in healthLogs"
                :key="log.id"
                :type="log.status === 'success' ? 'success' : 'error'"
                :title="log.providerName"
                :content="log.message"
                :time="log.time"
              />
            </n-timeline>
          </n-spin>
        </n-card>
      </n-grid-item>
    </n-grid>
  </div>
</template>

<style scoped lang="scss">
.page-container {
  padding: 24px;
  min-height: 100%;
  background: #fff;
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

// 统计卡片样式
.stats-grid {
  margin-bottom: 24px;
}

.stat-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(31, 38, 135, 0.04);
  border: 1px solid rgba(157, 138, 231, 0.1);
  position: relative;
  overflow: hidden;

  .stat-icon {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(157, 138, 231, 0.1);
    color: #9d8ae7;
  }

  &.stat-card-success {
    .stat-icon {
      background: rgba(16, 185, 129, 0.1);
      color: #10b981;
    }
  }

  &.stat-card-error {
    .stat-icon {
      background: rgba(239, 68, 68, 0.1);
      color: #ef4444;
    }
  }

  &.stat-card-default {
    .stat-icon {
      background: rgba(156, 163, 175, 0.1);
      color: #9ca3af;
    }
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
}

// 详情卡片样式
.detail-grid {
  .detail-card {
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(31, 38, 135, 0.04);
    border: 1px solid rgba(157, 138, 231, 0.1);

    :deep(.n-card-header) {
      border-bottom: 1px solid rgba(157, 138, 231, 0.1);
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
  }
}

.empty {
  padding: 40px 0;
}

.provider-list {
  .provider-item {
    padding: 16px;
    border-bottom: 1px solid rgba(157, 138, 231, 0.1);
    transition: all 0.3s ease;

    &:last-child {
      border-bottom: none;
    }

    &:hover {
      background: rgba(157, 138, 231, 0.04);
      border-radius: 8px;
    }

    .provider-info {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;

      .provider-name {
        font-weight: 500;
        font-size: 14px;
        color: #2d2b4d;
      }
    }

    .provider-detail {
      display: flex;
      gap: 16px;
      font-size: 12px;
      color: #6b6690;

      .failover {
        color: #f59e0b;
      }

      .failure-count {
        color: #ef4444;
      }
    }
  }
}
</style>
