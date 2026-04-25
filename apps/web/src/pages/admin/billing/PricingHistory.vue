<template>
  <div class="pricing-history-page">
    <n-h2>价格变更历史</n-h2>

    <n-card>
      <!-- 筛选条件 -->
      <div class="filter-section">
        <n-grid
          cols="1 s:2 l:4"
          responsive="screen"
          :x-gap="12"
          :y-gap="12"
        >
          <n-grid-item>
            <n-form-item label="订阅等级">
              <n-select
                v-model:value="filters.tier"
                :options="tierOptions"
                placeholder="全部"
                clearable
                @update:value="handleFilterChange"
              />
            </n-form-item>
          </n-grid-item>

          <n-grid-item>
            <n-form-item label="周期类型">
              <n-select
                v-model:value="filters.period"
                :options="periodOptions"
                placeholder="全部"
                clearable
                @update:value="handleFilterChange"
              />
            </n-form-item>
          </n-grid-item>

          <n-grid-item>
            <n-form-item label="操作人 ID">
              <n-input
                v-model:value="filters.operator_id"
                placeholder="输入操作人 ID"
                clearable
                @keyup.enter="handleFilterChange"
              />
            </n-form-item>
          </n-grid-item>

          <n-grid-item>
            <n-space justify="end">
              <n-button @click="handleReset">
                重置
              </n-button>
            </n-space>
          </n-grid-item>
        </n-grid>

        <!-- 时间范围筛选 -->
        <div class="date-range-filter">
          <n-form-item label="变更时间">
            <n-date-picker
              v-model:values="dateRange"
              type="daterange"
              placeholder="选择时间范围"
              clearable
              @update:value="handleDateRangeChange"
            />
          </n-form-item>
        </div>
      </div>

      <!-- 数据表格 -->
      <n-data-table
        :columns="columns"
        :data="historyStore.history"
        :loading="historyStore.loading"
        :pagination="pagination"
        :bordered="false"
        size="small"
      />

      <!-- 空数据提示 -->
      <n-empty
        v-if="!historyStore.loading && historyStore.history.length === 0"
        description="暂无价格变更记录"
        style="margin-top: 24px"
      />
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, h, onMounted } from "vue";
import { useMessage, NTag, type DataTableColumns } from "naive-ui";
import { usePricingHistoryStore } from "@/stores/billing";
import type { PricingHistoryItem } from "@/types/billing";

const historyStore = usePricingHistoryStore();
const message = useMessage();

const filters = ref({
  tier: undefined as string | undefined,
  period: undefined as string | undefined,
  operator_id: undefined as string | undefined,
});

const dateRange = ref<[number, number] | null>(null);

// 选项数据
const tierOptions = [
  { label: "普通订阅", value: "basic" },
  { label: "专业订阅", value: "pro" },
];

const periodOptions = [
  { label: "月度", value: "monthly" },
  { label: "年度", value: "yearly" },
];

// 表格列定义
const columns: DataTableColumns<PricingHistoryItem> = [
  {
    title: "变更时间",
    key: "changedAt",
    width: 180,
    render: (row) => formatDateTime(row.changedAt),
  },
  {
    title: "订阅方案",
    key: "tierName",
    width: 100,
    render: (row) => {
      return h(
        NTag,
        {
          type: row.tier === "basic" ? "info" : "success",
          size: "small",
        },
        { default: () => row.tierName },
      );
    },
  },
  {
    title: "周期",
    key: "periodName",
    width: 80,
    render: (row) => row.periodName,
  },
  {
    title: "原价",
    key: "oldPrice",
    width: 90,
    render: (row) => `￥${row.oldPrice.toFixed(2)}`,
  },
  {
    title: "新价",
    key: "newPrice",
    width: 90,
    render: (row) => `￥${row.newPrice.toFixed(2)}`,
  },
  {
    title: "变化",
    key: "priceChangePercent",
    width: 90,
    render: (row) => {
      const percent = row.priceChangePercent;
      const isIncrease = percent > 0;
      const color = isIncrease ? "red" : "green";
      const sign = isIncrease ? "+" : "";
      return h(
        "span",
        {
          style: {
            color,
            fontWeight: "bold",
          },
        },
        `${sign}${percent.toFixed(2)}%`,
      );
    },
  },
  {
    title: "操作人",
    key: "operatorName",
    width: 120,
    render: (row) => row.operatorName,
  },
  {
    title: "变更原因",
    key: "changeReason",
    minWidth: 150,
    ellipsis: {
      tooltip: true,
    },
    render: (row) => row.changeReason || "-",
  },
];

// 分页配置
const pagination = computed(() => ({
  page: historyStore.page,
  pageSize: historyStore.page_size,
  itemCount: historyStore.total,
  showSizePicker: true,
  prefix: () => `共 ${historyStore.total} 条`,
  onUpdatePage: historyStore.setPage,
  onUpdatePageSize: historyStore.setPageSize,
}));

// 格式化日期时间
const formatDateTime = (dateStr: string) => {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

// 筛选条件变化
const handleFilterChange = () => {
  historyStore.setFilters({
    tier: filters.value.tier,
    period: filters.value.period,
    operator_id: filters.value.operator_id,
    start_date: dateRange.value
      ? new Date(dateRange.value[0]).toISOString().split("T")[0]
      : undefined,
    end_date: dateRange.value
      ? new Date(dateRange.value[1]).toISOString().split("T")[0]
      : undefined,
  });
};

// 日期范围变化
const handleDateRangeChange = () => {
  handleFilterChange();
};

// 重置筛选
const handleReset = () => {
  filters.value = {
    tier: undefined,
    period: undefined,
    operator_id: undefined,
  };
  dateRange.value = null;
  historyStore.resetFilters();
  message.success("筛选条件已重置");
};

onMounted(() => {
  historyStore.fetchHistory();
});
</script>

<style scoped lang="scss">
.pricing-history-page {
  padding: 24px;

  h2 {
    margin-bottom: 24px;
    color: #333;
  }
}

.filter-section {
  margin-bottom: 24px;
  padding: 16px;
  background: #f5f5f5;
  border-radius: 8px;

  .date-range-filter {
    margin-top: 12px;
  }
}
</style>
