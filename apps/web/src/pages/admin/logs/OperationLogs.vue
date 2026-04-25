<script setup lang="ts">
import { ref, onMounted, h, computed } from "vue";
import {
  NCard,
  NDataTable,
  NSelect,
  NDatePicker,
  NButton,
  NSpace,
  NIcon,
  NTag,
  NPagination,
  NDrawer,
  NDrawerContent,
  NDescriptions,
  NDescriptionsItem,
  NCode,
  NEmpty,
  useMessage,
} from "naive-ui";
import {
  DocumentText,
  Search,
  Refresh,
  Eye,
  Person,
  Time,
  Desktop,
} from "@vicons/ionicons5";
import { useAdminLogStore } from "@/stores/system-admin";
import {
  operationTypeMap,
  targetTypeMap,
  type OperationLog,
} from "@/types/admin";
import type { DataTableColumns } from "naive-ui";

const message = useMessage();
const logStore = useAdminLogStore();

// 从 Store 获取状态
const loading = computed(() => logStore.isLoading);
const logs = computed(() => logStore.logList);
const total = computed(() => logStore.logTotal);
const page = computed({
  get: () => logStore.filter.page,
  set: (val) => logStore.setFilter({ page: val }),
});
const pageSize = computed({
  get: () => logStore.filter.pageSize,
  set: (val) => logStore.setFilter({ pageSize: val }),
});

// 筛选条件
const operationType = ref<string | undefined>(undefined);
const dateRange = ref<[number, number] | null>(null);

// 详情抽屉
const detailDrawerVisible = ref(false);
const selectedLog = ref<OperationLog | null>(null);

// 操作类型选项
const operationTypeOptions = [
  { label: "全部操作", value: "" },
  { label: "封禁用户", value: "user_ban" },
  { label: "解封用户", value: "user_unban" },
  { label: "配置更新", value: "config_update" },
  { label: "余额调整", value: "balance_adjust" },
  { label: "订阅赋予", value: "subscription_grant" },
  { label: "额度刷新", value: "quota_refresh" },
];

// 表格列定义
const columns: DataTableColumns<OperationLog> = [
  {
    title: "时间",
    key: "createdAt",
    width: 180,
    render(row) {
      return formatDate(row.createdAt);
    },
  },
  {
    title: "管理员",
    key: "adminUsername",
    width: 120,
    render(row) {
      return row.adminUsername || row.adminId.slice(0, 8);
    },
  },
  {
    title: "操作类型",
    key: "operationType",
    width: 120,
    render(row) {
      const type = operationTypeMap[row.operationType] || row.operationType;
      const typeColors: Record<string, string> = {
        user_ban: "error",
        user_unban: "success",
        config_update: "warning",
        balance_adjust: "info",
        subscription_grant: "success",
        quota_refresh: "info",
      };
      return h(
        NTag,
        { type: typeColors[row.operationType] as any, size: "small" },
        {
          default: () => type,
        },
      );
    },
  },
  {
    title: "操作对象",
    key: "target",
    width: 200,
    render(row) {
      const targetType = targetTypeMap[row.targetType] || row.targetType;
      const targetId = row.targetId ? row.targetId.slice(0, 16) + "..." : "-";
      return h(
        NSpace,
        { size: 4, vertical: true },
        {
          default: () => [
            h(
              NTag,
              { size: "small", bordered: false },
              { default: () => targetType },
            ),
            h("span", { style: "font-size: 12px; color: #666;" }, targetId),
          ],
        },
      );
    },
  },
  {
    title: "IP地址",
    key: "ipAddress",
    width: 140,
  },
  {
    title: "操作",
    key: "actions",
    width: 100,
    fixed: "right",
    render(row) {
      return h(
        NButton,
        {
          size: "small",
          type: "primary",
          ghost: true,
          onClick: () => viewDetail(row),
        },
        {
          icon: () => h(NIcon, null, { default: () => h(Eye) }),
          default: () => "详情",
        },
      );
    },
  },
];

// 格式化日期
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// 获取日志列表
async function fetchLogs() {
  try {
    logStore.setFilter({
      operationType: operationType.value,
      startDate: dateRange.value
        ? new Date(dateRange.value[0]).toISOString()
        : undefined,
      endDate: dateRange.value
        ? new Date(dateRange.value[1]).toISOString()
        : undefined,
    });
    await logStore.fetchLogs();
  } catch (error) {
    message.error("获取操作日志失败");
  }
}

// 搜索
function handleSearch() {
  logStore.setFilter({ page: 1 });
  fetchLogs();
}

// 重置筛选
function handleReset() {
  operationType.value = undefined;
  dateRange.value = null;
  logStore.resetFilter();
  fetchLogs();
}

// 查看详情
function viewDetail(log: OperationLog) {
  selectedLog.value = log;
  detailDrawerVisible.value = true;
}

// 分页变化
function handlePageChange(newPage: number) {
  page.value = newPage;
  fetchLogs();
}

// 每页条数变化
function handlePageSizeChange(newSize: number) {
  pageSize.value = newSize;
  page.value = 1;
  fetchLogs();
}

onMounted(() => {
  fetchLogs();
});
</script>

<template>
  <div class="page-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <div class="page-title">
        <n-icon
          size="24"
          class="title-icon"
        >
          <DocumentText />
        </n-icon>
        <span>操作日志</span>
      </div>
    </div>

    <!-- 搜索筛选 -->
    <n-card
      class="filter-card"
      :bordered="false"
    >
      <n-space
        align="center"
        :size="16"
      >
        <n-select
          v-model:value="operationType"
          :options="operationTypeOptions"
          placeholder="操作类型"
          clearable
          style="width: 160px"
        />
        <n-date-picker
          v-model:value="dateRange"
          type="datetimerange"
          placeholder="选择时间范围"
          style="width: 340px"
        />
        <n-button
          type="primary"
          @click="handleSearch"
        >
          <template #icon>
            <n-icon><Search /></n-icon>
          </template>
          查询
        </n-button>
        <n-button @click="handleReset">
          <template #icon>
            <n-icon><Refresh /></n-icon>
          </template>
          重置
        </n-button>
      </n-space>
    </n-card>

    <!-- 日志表格 -->
    <n-card
      class="table-card"
      :bordered="false"
    >
      <n-data-table
        :columns="columns"
        :data="logs"
        :loading="loading"
        :pagination="false"
        :scroll-x="900"
        striped
      />

      <!-- 分页 -->
      <div class="pagination-wrapper">
        <n-pagination
          v-model:page="page"
          v-model:page-size="pageSize"
          :item-count="total"
          :page-sizes="[10, 20, 50, 100]"
          show-size-picker
          show-quick-jumper
          @update:page="handlePageChange"
          @update:page-size="handlePageSizeChange"
        />
      </div>
    </n-card>

    <!-- 详情抽屉 -->
    <n-drawer
      v-model:show="detailDrawerVisible"
      width="500"
      placement="right"
    >
      <n-drawer-content
        title="操作详情"
        closable
      >
        <template v-if="selectedLog">
          <n-descriptions
            :column="1"
            bordered
            class="detail-descriptions"
          >
            <n-descriptions-item label="操作时间">
              <n-space
                align="center"
                :size="4"
              >
                <n-icon
                  size="16"
                  color="#9D8AE7"
                >
                  <Time />
                </n-icon>
                {{ formatDate(selectedLog.createdAt) }}
              </n-space>
            </n-descriptions-item>

            <n-descriptions-item label="管理员">
              <n-space
                align="center"
                :size="4"
              >
                <n-icon
                  size="16"
                  color="#9D8AE7"
                >
                  <Person />
                </n-icon>
                {{ selectedLog.adminUsername || selectedLog.adminId }}
              </n-space>
            </n-descriptions-item>

            <n-descriptions-item label="操作类型">
              <n-tag
                :type="
                  {
                    user_ban: 'error',
                    user_unban: 'success',
                    config_update: 'warning',
                    balance_adjust: 'info',
                    subscription_grant: 'success',
                    quota_refresh: 'info',
                  }[selectedLog.operationType] as any
                "
              >
                {{
                  operationTypeMap[selectedLog.operationType] ||
                    selectedLog.operationType
                }}
              </n-tag>
            </n-descriptions-item>

            <n-descriptions-item label="操作对象类型">
              {{
                targetTypeMap[selectedLog.targetType] || selectedLog.targetType
              }}
            </n-descriptions-item>

            <n-descriptions-item label="操作对象ID">
              <span class="copyable-text">{{
                selectedLog.targetId || "-"
              }}</span>
            </n-descriptions-item>

            <n-descriptions-item label="IP地址">
              <n-space
                align="center"
                :size="4"
              >
                <n-icon
                  size="16"
                  color="#9D8AE7"
                >
                  <Desktop />
                </n-icon>
                {{ selectedLog.ipAddress }}
              </n-space>
            </n-descriptions-item>

            <n-descriptions-item label="User Agent">
              <div class="user-agent-text">
                {{ selectedLog.userAgent || "-" }}
              </div>
            </n-descriptions-item>
          </n-descriptions>

          <div class="details-section">
            <h4>操作详情</h4>
            <n-code
              :code="JSON.stringify(selectedLog.details, null, 2)"
              language="json"
              show-line-numbers
            />
          </div>
        </template>
        <n-empty
          v-else
          description="暂无数据"
        />
      </n-drawer-content>
    </n-drawer>
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
  margin-bottom: 24px;

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

.filter-card {
  margin-bottom: 16px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(31, 38, 135, 0.04);
  border: 1px solid rgba(157, 138, 231, 0.1);
}

.table-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(31, 38, 135, 0.04);
  border: 1px solid rgba(157, 138, 231, 0.1);

  .pagination-wrapper {
    margin-top: 16px;
    display: flex;
    justify-content: flex-end;
  }
}

.detail-descriptions {
  :deep(.n-descriptions-item-label) {
    width: 100px;
  }
}

.details-section {
  margin-top: 24px;

  h4 {
    font-size: 14px;
    font-weight: 600;
    color: #2d2b4d;
    margin: 0 0 12px;
  }

  :deep(.n-code) {
    background: rgba(157, 138, 231, 0.05);
    border-radius: 8px;
    padding: 12px;
  }
}

.copyable-text {
  font-family: monospace;
  font-size: 13px;
  color: #666;
}

.user-agent-text {
  font-size: 12px;
  color: #666;
  word-break: break-all;
  max-height: 100px;
  overflow-y: auto;
}
</style>
