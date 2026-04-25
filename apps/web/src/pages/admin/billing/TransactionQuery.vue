<template>
  <div class="transaction-query-page">
    <n-h2>流水查询</n-h2>

    <n-card>
      <n-space
        class="toolbar"
        align="center"
      >
        <n-input
          v-model:value="searchKeyword"
          placeholder="用户ID/用户名"
          clearable
          style="width: 200px"
        />
        <n-date-picker
          v-model:value="dateRange"
          type="daterange"
          clearable
          placeholder="日期范围"
        />
        <n-select
          v-if="activeTab === 'recharge'"
          v-model:value="filterStatus"
          placeholder="支付状态"
          clearable
          style="width: 120px"
          :options="statusOptions"
        />
        <n-select
          v-if="activeTab === 'consumption'"
          v-model:value="filterType"
          placeholder="类型"
          clearable
          style="width: 120px"
          :options="typeOptions"
        />
        <n-button
          type="primary"
          @click="handleSearch"
        >
          查询
        </n-button>
        <n-button @click="handleReset">
          重置
        </n-button>
      </n-space>

      <n-tabs
        v-model:value="activeTab"
        type="line"
        @update:value="handleTabChange"
      >
        <n-tab-pane
          name="recharge"
          tab="充值记录"
        >
          <n-data-table
            :data="rechargeData.items"
            :columns="rechargeColumns"
            :loading="adminBillingStore.loading"
            :pagination="rechargePagination"
            @update:page="handleRechargePageChange"
            @update:page-size="handleRechargePageSizeChange"
          />
        </n-tab-pane>
        <n-tab-pane
          name="consumption"
          tab="消费记录"
        >
          <n-data-table
            :data="consumptionData.items"
            :columns="consumptionColumns"
            :loading="adminBillingStore.loading"
            :pagination="consumptionPagination"
            @update:page="handleConsumptionPageChange"
            @update:page-size="handleConsumptionPageSizeChange"
          />
        </n-tab-pane>
      </n-tabs>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, h } from "vue";
import { NTag, NButton } from "naive-ui";
import { useAdminBillingStore } from "@/stores/billing";
import type { DataTableColumns } from "naive-ui";
import type { RechargeOrder, BalanceRecord } from "@/types/billing";

const adminBillingStore = useAdminBillingStore();

const activeTab = ref<"recharge" | "consumption">("recharge");
const searchKeyword = ref("");
const dateRange = ref<[number, number] | null>(null);
const filterStatus = ref<string | null>(null);
const filterType = ref<string | null>(null);

// 分页状态
const rechargePage = ref(1);
const rechargePageSize = ref(20);
const consumptionPage = ref(1);
const consumptionPageSize = ref(20);

// 数据
const rechargeData = ref({
  items: [] as RechargeOrder[],
  total: 0,
  page: 1,
  pageSize: 20,
});
const consumptionData = ref({
  items: [] as BalanceRecord[],
  total: 0,
  page: 1,
  pageSize: 20,
});

const statusOptions = [
  { label: "待支付", value: "pending" },
  { label: "已支付", value: "paid" },
  { label: "已取消", value: "cancelled" },
  { label: "已失败", value: "failed" },
  { label: "已退款", value: "refunded" },
];

const typeOptions = [
  { label: "充值", value: "recharge" },
  { label: "消费", value: "consumption" },
  { label: "退款", value: "refund" },
];

// 充值记录列定义
const rechargeColumns: DataTableColumns<RechargeOrder> = [
  {
    title: "流水号",
    key: "id",
    width: 220,
  },
  {
    title: "用户ID",
    key: "userId",
    width: 220,
  },
  {
    title: "用户名",
    key: "username",
    width: 120,
    render: (row) => row.username || "-",
  },
  {
    title: "充值金额",
    key: "amount",
    width: 100,
    render: (row) => `¥${Number(row.amount).toFixed(2)}`,
  },
  {
    title: "获得额度",
    key: "credits",
    width: 100,
    render: (row) => Number(row.credits),
  },
  {
    title: "支付方式",
    key: "paymentMethod",
    width: 100,
    render: (row) => {
      const map: Record<string, string> = {
        alipay: "支付宝",
        wechat: "微信支付",
      };
      return map[row.paymentMethod || ""] || "-";
    },
  },
  {
    title: "状态",
    key: "paymentStatus",
    width: 100,
    render: (row) => {
      const typeMap: Record<
        string,
        "default" | "success" | "error" | "warning"
      > = {
        pending: "default",
        paid: "success",
        cancelled: "warning",
        failed: "error",
        refunded: "warning",
      };
      const labelMap: Record<string, string> = {
        pending: "待支付",
        paid: "已支付",
        cancelled: "已取消",
        failed: "已失败",
        refunded: "已退款",
      };
      return h(
        NTag,
        { type: typeMap[row.paymentStatus] || "default" },
        {
          default: () => labelMap[row.paymentStatus] || row.paymentStatus,
        },
      );
    },
  },
  {
    title: "交易号",
    key: "transactionNo",
    width: 180,
    render: (row) => row.transactionNo || "-",
  },
  {
    title: "创建时间",
    key: "createdAt",
    width: 180,
    render: (row) => formatDateTime(row.createdAt),
  },
];

// 消费记录列定义
const consumptionColumns: DataTableColumns<BalanceRecord> = [
  {
    title: "流水号",
    key: "id",
    width: 220,
  },
  {
    title: "用户ID",
    key: "userId",
    width: 220,
  },
  {
    title: "用户名",
    key: "username",
    width: 120,
    render: (row: BalanceRecord & { username?: string }) => row.username || "-",
  },
  {
    title: "变动金额",
    key: "changeAmount",
    width: 100,
    render: (row) => {
      const amount = Number(row.changeAmount);
      return h(
        "span",
        { style: { color: amount >= 0 ? "#18a058" : "#d03050" } },
        [
          amount >= 0
            ? `+¥${amount.toFixed(2)}`
            : `-¥${Math.abs(amount).toFixed(2)}`,
        ],
      );
    },
  },
  {
    title: "余额",
    key: "balanceAfter",
    width: 100,
    render: (row) => `¥${Number(row.balanceAfter).toFixed(2)}`,
  },
  {
    title: "类型",
    key: "type",
    width: 100,
    render: (row) => {
      const typeMap: Record<string, "success" | "error" | "warning"> = {
        recharge: "success",
        consumption: "error",
        refund: "warning",
      };
      const labelMap: Record<string, string> = {
        recharge: "充值",
        consumption: "消费",
        refund: "退款",
      };
      return h(
        NTag,
        { type: typeMap[row.type] || "default" },
        {
          default: () => labelMap[row.type] || row.type,
        },
      );
    },
  },
  {
    title: "描述",
    key: "description",
    width: 250,
    ellipsis: true,
  },
  {
    title: "时间",
    key: "createdAt",
    width: 180,
    render: (row) => formatDateTime(row.createdAt),
  },
];

// 分页配置
const rechargePagination = computed(() => ({
  page: rechargePage.value,
  pageSize: rechargePageSize.value,
  itemCount: rechargeData.value.total,
  pageSizes: [10, 20, 50, 100],
  showSizePicker: true,
  prefix: () => `共 ${rechargeData.value.total} 条`,
}));

const consumptionPagination = computed(() => ({
  page: consumptionPage.value,
  pageSize: consumptionPageSize.value,
  itemCount: consumptionData.value.total,
  pageSizes: [10, 20, 50, 100],
  showSizePicker: true,
  prefix: () => `共 ${consumptionData.value.total} 条`,
}));

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function handleSearch() {
  if (activeTab.value === "recharge") {
    rechargePage.value = 1;
    loadRechargeRecords();
  } else {
    consumptionPage.value = 1;
    loadConsumptionRecords();
  }
}

function handleReset() {
  searchKeyword.value = "";
  dateRange.value = null;
  filterStatus.value = null;
  filterType.value = null;
  handleSearch();
}

function handleTabChange() {
  // 切换标签时重置筛选条件
  searchKeyword.value = "";
  dateRange.value = null;
  filterStatus.value = null;
  filterType.value = null;

  if (activeTab.value === "recharge") {
    rechargePage.value = 1;
    loadRechargeRecords();
  } else {
    consumptionPage.value = 1;
    loadConsumptionRecords();
  }
}

function handleRechargePageChange(page: number) {
  rechargePage.value = page;
  loadRechargeRecords();
}

function handleRechargePageSizeChange(size: number) {
  rechargePageSize.value = size;
  rechargePage.value = 1;
  loadRechargeRecords();
}

function handleConsumptionPageChange(page: number) {
  consumptionPage.value = page;
  loadConsumptionRecords();
}

function handleConsumptionPageSizeChange(size: number) {
  consumptionPageSize.value = size;
  consumptionPage.value = 1;
  loadConsumptionRecords();
}

async function loadRechargeRecords() {
  const keyword = searchKeyword.value.trim();
  const isUserId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      keyword,
    );

  const data = await adminBillingStore.fetchAllRechargeRecords({
    userId: isUserId ? keyword : undefined,
    username: !isUserId && keyword ? keyword : undefined,
    status: filterStatus.value || undefined,
    startDate: dateRange.value
      ? new Date(dateRange.value[0]).toISOString()
      : undefined,
    endDate: dateRange.value
      ? new Date(dateRange.value[1]).toISOString()
      : undefined,
    page: rechargePage.value,
    pageSize: rechargePageSize.value,
  });

  if (data) {
    rechargeData.value = data;
  }
}

async function loadConsumptionRecords() {
  const keyword = searchKeyword.value.trim();
  const isUserId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      keyword,
    );

  const data = await adminBillingStore.fetchAllConsumptionRecords({
    userId: isUserId ? keyword : undefined,
    username: !isUserId && keyword ? keyword : undefined,
    type: filterType.value || undefined,
    startDate: dateRange.value
      ? new Date(dateRange.value[0]).toISOString()
      : undefined,
    endDate: dateRange.value
      ? new Date(dateRange.value[1]).toISOString()
      : undefined,
    page: consumptionPage.value,
    pageSize: consumptionPageSize.value,
  });

  if (data) {
    consumptionData.value = data;
  }
}

onMounted(() => {
  loadRechargeRecords();
});
</script>

<style scoped lang="scss">
.transaction-query-page {
  padding: 24px;
}

.toolbar {
  margin-bottom: 16px;
}
</style>
