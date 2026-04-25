<template>
  <div class="subscription-manage-page">
    <n-h2>订阅管理</n-h2>

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
        <n-select
          v-model:value="filterStatus"
          placeholder="状态"
          clearable
          style="width: 120px"
          :options="statusOptions"
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
        <n-button
          type="primary"
          @click="showGrantModal = true"
        >
          赋予订阅
        </n-button>
        <n-button @click="showAdjustModal = true">
          调整余额
        </n-button>
      </n-space>

      <n-table
        :data="adminBillingStore.subscriptions?.items || []"
        :loading="adminBillingStore.loading"
        striped
      >
        <thead>
          <tr>
            <th>用户ID</th>
            <th>用户名</th>
            <th>等级</th>
            <th>周期</th>
            <th>状态</th>
            <th>开始时间</th>
            <th>过期时间</th>
            <th>自动续费</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="sub in adminBillingStore.subscriptions?.items"
            :key="sub.id"
          >
            <td>{{ sub.userId }}</td>
            <td>{{ sub.username || "-" }}</td>
            <td>
              <n-tag :type="sub.tier === 'pro' ? 'warning' : 'success'">
                {{ sub.tier === "pro" ? "专业" : "普通" }}
              </n-tag>
            </td>
            <td>{{ sub.period === "monthly" ? "月度" : "年度" }}</td>
            <td>
              <n-tag :type="getStatusType(sub.status)">
                {{ getStatusName(sub.status) }}
              </n-tag>
            </td>
            <td>{{ formatDate(sub.startedAt) }}</td>
            <td>{{ formatDate(sub.expiresAt) }}</td>
            <td>{{ sub.autoRenew ? "是" : "否" }}</td>
          </tr>
        </tbody>
      </n-table>

      <n-empty
        v-if="!adminBillingStore.subscriptions?.items?.length"
        description="暂无订阅数据"
      />

      <n-pagination
        v-if="adminBillingStore.subscriptions?.total"
        v-model:page="currentPage"
        v-model:page-size="pageSize"
        :item-count="adminBillingStore.subscriptions.total"
        :page-sizes="[10, 20, 50]"
        show-size-picker
        @update:page="handlePageChange"
        @update:page-size="handlePageSizeChange"
      />
    </n-card>

    <!-- 赋予订阅对话框 -->
    <n-modal
      v-model:show="showGrantModal"
      title="手动赋予订阅"
      preset="card"
      style="width: 450px"
    >
      <n-form :model="grantForm">
        <n-form-item label="用户ID">
          <n-input
            v-model:value="grantForm.userId"
            placeholder="输入用户ID（UUID格式）"
          />
        </n-form-item>
        <n-form-item label="用户名">
          <n-input
            v-model:value="grantForm.username"
            placeholder="输入用户名（与用户ID至少填一个）"
          />
        </n-form-item>
        <n-form-item
          label="订阅等级"
          required
        >
          <n-radio-group v-model:value="grantForm.tier">
            <n-radio value="basic">
              普通订阅
            </n-radio>
            <n-radio value="pro">
              专业订阅
            </n-radio>
          </n-radio-group>
        </n-form-item>
        <n-form-item
          label="订阅周期"
          required
        >
          <n-radio-group v-model:value="grantForm.period">
            <n-radio value="monthly">
              月度
            </n-radio>
            <n-radio value="yearly">
              年度
            </n-radio>
          </n-radio-group>
        </n-form-item>
        <n-form-item
          label="时长(天)"
          required
        >
          <n-input-number
            v-model:value="grantForm.durationDays"
            :min="1"
            :max="365"
          />
        </n-form-item>
        <n-form-item
          label="赋予原因"
          required
        >
          <n-input
            v-model:value="grantForm.reason"
            placeholder="如：运营活动"
          />
        </n-form-item>
        <n-form-item label="详细说明">
          <n-input
            v-model:value="grantForm.description"
            type="textarea"
            placeholder="补充说明"
          />
        </n-form-item>
      </n-form>

      <template #footer>
        <n-space justify="end">
          <n-button @click="showGrantModal = false">
            取消
          </n-button>
          <n-button
            type="primary"
            :loading="adminBillingStore.loading"
            @click="handleGrant"
          >
            确认赋予
          </n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- 调整余额对话框 -->
    <n-modal
      v-model:show="showAdjustModal"
      title="调整用户余额"
      preset="card"
      style="width: 450px"
    >
      <n-form :model="adjustForm">
        <n-form-item label="用户ID">
          <n-input
            v-model:value="adjustForm.userId"
            placeholder="输入用户ID（UUID格式）"
          />
        </n-form-item>
        <n-form-item label="用户名">
          <n-input
            v-model:value="adjustForm.username"
            placeholder="输入用户名（与用户ID至少填一个）"
          />
        </n-form-item>
        <n-form-item
          label="调整金额"
          required
        >
          <n-input-number
            v-model:value="adjustForm.amount"
            placeholder="正数增加，负数减少"
          />
          <p class="hint">
            正数增加余额，负数减少余额
          </p>
        </n-form-item>
        <n-form-item
          label="调整原因"
          required
        >
          <n-input
            v-model:value="adjustForm.reason"
            placeholder="如：系统补偿"
          />
        </n-form-item>
        <n-form-item label="详细说明">
          <n-input
            v-model:value="adjustForm.description"
            type="textarea"
            placeholder="补充说明"
          />
        </n-form-item>
      </n-form>

      <template #footer>
        <n-space justify="end">
          <n-button @click="showAdjustModal = false">
            取消
          </n-button>
          <n-button
            type="primary"
            :loading="adminBillingStore.loading"
            @click="handleAdjust"
          >
            确认调整
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useMessage } from "naive-ui";
import { useAdminBillingStore } from "@/stores/billing";

const adminBillingStore = useAdminBillingStore();
const message = useMessage();

const searchKeyword = ref("");
const filterStatus = ref<string | null>(null);

const statusOptions = [
  { label: "有效", value: "active" },
  { label: "已过期", value: "expired" },
  { label: "已取消", value: "cancelled" },
];

const currentPage = ref(1);
const pageSize = ref(10);

const showGrantModal = ref(false);
const showAdjustModal = ref(false);

const grantForm = ref({
  userId: "",
  username: "",
  tier: "basic" as "basic" | "pro",
  period: "monthly" as "monthly" | "yearly",
  durationDays: 30,
  reason: "",
  description: "",
});

const adjustForm = ref({
  userId: "",
  username: "",
  amount: 0,
  reason: "",
  description: "",
});

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("zh-CN");
}

function getStatusType(status: string): "success" | "error" | "warning" {
  const map: Record<string, "success" | "error" | "warning"> = {
    active: "success",
    expired: "error",
    cancelled: "warning",
  };
  return map[status] || "default";
}

function getStatusName(status: string) {
  const map: Record<string, string> = {
    active: "有效",
    expired: "已过期",
    cancelled: "已取消",
  };
  return map[status] || status;
}

function handleSearch() {
  currentPage.value = 1;
  loadSubscriptions();
}

function handleReset() {
  searchKeyword.value = "";
  filterStatus.value = null;
  currentPage.value = 1;
  loadSubscriptions();
}

function handlePageChange(page: number) {
  currentPage.value = page;
  loadSubscriptions();
}

function handlePageSizeChange(size: number) {
  pageSize.value = size;
  currentPage.value = 1;
  loadSubscriptions();
}

function loadSubscriptions() {
  const keyword = searchKeyword.value.trim();
  // 判断是用户ID（UUID格式）还是用户名
  const isUserId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      keyword,
    );

  adminBillingStore.fetchSubscriptions({
    userId: isUserId ? keyword : undefined,
    username: !isUserId && keyword ? keyword : undefined,
    status: filterStatus.value || undefined,
    page: currentPage.value,
    pageSize: pageSize.value,
  });
}

async function handleGrant() {
  // 支持 userId 或 username 任一即可
  if (
    (!grantForm.value.userId && !grantForm.value.username) ||
    !grantForm.value.reason
  ) {
    message.error("请填写用户ID或用户名，以及赋予原因");
    return;
  }

  try {
    await adminBillingStore.grantSubscription(grantForm.value);
    message.success("订阅赋予成功");
    showGrantModal.value = false;
    loadSubscriptions();
    resetGrantForm();
  } catch (error: any) {
    const errorMsg = error?.response?.data?.msg || error?.message || "操作失败";
    message.error(errorMsg);
  }
}

async function handleAdjust() {
  // 支持 userId 或 username 任一即可
  if (
    (!adjustForm.value.userId && !adjustForm.value.username) ||
    !adjustForm.value.reason ||
    adjustForm.value.amount === 0
  ) {
    message.error("请填写用户ID或用户名、调整原因和调整金额");
    return;
  }

  try {
    await adminBillingStore.adjustBalance(adjustForm.value);
    message.success("余额调整成功");
    showAdjustModal.value = false;
    resetAdjustForm();
  } catch (error: any) {
    const errorMsg = error?.response?.data?.msg || error?.message || "操作失败";
    message.error(errorMsg);
  }
}

function resetGrantForm() {
  grantForm.value = {
    userId: "",
    username: "",
    tier: "basic",
    period: "monthly",
    durationDays: 30,
    reason: "",
    description: "",
  };
}

function resetAdjustForm() {
  adjustForm.value = {
    userId: "",
    username: "",
    amount: 0,
    reason: "",
    description: "",
  };
}

onMounted(() => {
  loadSubscriptions();
});
</script>

<style scoped lang="scss">
.subscription-manage-page {
  padding: 24px;
}

.toolbar {
  margin-bottom: 16px;
}

.hint {
  color: #999;
  font-size: 12px;
  margin-top: 4px;
}
</style>
