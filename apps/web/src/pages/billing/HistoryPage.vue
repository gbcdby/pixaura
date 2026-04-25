<template>
  <div class="history-page">
    <n-layout>
      <n-layout-header class="header">
        <div class="header-content">
          <div class="logo" @click="$router.push('/')">
            <h2>Pixaura</h2>
          </div>
          <n-space>
            <n-button quaternary @click="$router.push('/user/profile')">个人中心</n-button>
            <n-button quaternary @click="$router.push('/')">返回首页</n-button>
          </n-space>
        </div>
      </n-layout-header>

      <n-layout-content class="main-content">
      <n-tabs
        v-model:value="activeTab"
        type="line"
        class="history-tabs"
        animated
      >
        <n-tab-pane name="quota" tab="额度使用记录">
          <n-card class="table-card">
            <n-table :bordered="false" :single-line="false">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>操作</th>
                  <th>模型</th>
                  <th>消耗</th>
                  <th>剩余额度</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="record in billingStore.quotaHistory?.items" :key="record.id">
                  <td>{{ formatDate(record.createdAt) }}</td>
                  <td>{{ getCategoryName(record.category) }}</td>
                  <td>{{ record.modelName }}</td>
                  <td class="amount-consume">-{{ record.count }}</td>
                  <td>{{ record.remainingQuota }}</td>
                </tr>
              </tbody>
            </n-table>
            <n-empty v-if="!billingStore.quotaHistory?.items?.length" description="暂无额度使用记录" />
          </n-card>
        </n-tab-pane>

        <n-tab-pane name="balance" tab="余额消费记录">
          <n-card class="table-card">
            <n-table :bordered="false" :single-line="false">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>类型</th>
                  <th>变动金额</th>
                  <th>变动后余额</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="record in billingStore.balanceRecords?.items" :key="record.id">
                  <td>{{ formatDate(record.createdAt) }}</td>
                  <td>
                    <n-tag :type="getBalanceTypeTag(record.type)" round size="small">
                      {{ getBalanceTypeName(record.type) }}
                    </n-tag>
                  </td>
                  <td :class="record.changeAmount >= 0 ? 'amount-income' : 'amount-expense'">
                    {{ record.changeAmount > 0 ? "+" : "" }}{{ record.changeAmount.toFixed(2) }}
                  </td>
                  <td>¥{{ record.balanceAfter.toFixed(2) }}</td>
                  <td class="col-desc">{{ record.description }}</td>
                </tr>
              </tbody>
            </n-table>
            <n-empty v-if="!billingStore.balanceRecords?.items?.length" description="暂无余额记录" />
          </n-card>
        </n-tab-pane>
      </n-tabs>
      </n-layout-content>
    </n-layout>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useBillingStore } from "@/stores/billing";

const billingStore = useBillingStore();
const activeTab = ref("quota");

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("zh-CN");
}

function getCategoryName(category: string) {
  const map: Record<string, string> = {
    TEXT_GENERATION: "文本生成",
    IMAGE_GENERATION: "图像生成",
    VIDEO_GENERATION: "视频生成",
    AUDIO_GENERATION: "音频生成",
    LIP_SYNC: "对口型配音",
  };
  return map[category] || category;
}

function getBalanceTypeName(type: string) {
  const map: Record<string, string> = {
    recharge: "充值",
    consumption: "消费",
    refund: "退款",
    adjust: "调整",
  };
  return map[type] || type;
}

function getBalanceTypeTag(type: string): "success" | "error" | "warning" | "default" {
  const map: Record<string, "success" | "error" | "warning" | "default"> = {
    recharge: "success",
    consumption: "error",
    refund: "warning",
    adjust: "default",
  };
  return map[type] || "default";
}

watch(activeTab, (tab) => {
  if (tab === "quota") {
    billingStore.fetchQuotaHistory();
  } else if (tab === "balance") {
    billingStore.fetchBalanceRecords();
  }
});

onMounted(() => {
  billingStore.fetchQuotaHistory();
});
</script>

<style scoped lang="scss">
.history-page {
  min-height: 100vh;
  background: var(--color-bg-base);
}

:deep(.n-layout),
:deep(.n-layout-scroll-container) {
  background: transparent;
  overflow: visible;
}

:deep(.n-layout-header) {
  background: transparent;
}

:deep(.n-layout-content) {
  background: var(--color-bg-base);
  overflow: visible;
}

.header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--color-bg-elevated);
  border-bottom: 1px solid var(--color-border);
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
  height: 64px;
}

.logo {
  cursor: pointer;

  h2 {
    margin: 0;
    background: var(--gradient-primary);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
}

.main-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
  background: var(--color-bg-base);
}

.history-tabs {
  :deep(.n-tabs-nav) {
    margin-bottom: 16px;
  }
}

.table-card {
  background: var(--color-bg-elevated);
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-md);

  :deep(.n-card__content) {
    padding: 0;
  }

  :deep(.n-empty) {
    padding: 48px 0;
  }
}

.amount-consume {
  color: var(--color-error);
  font-weight: 500;
}

.amount-income {
  color: var(--color-success);
  font-weight: 500;
}

.amount-expense {
  color: var(--color-error);
  font-weight: 500;
}

.col-desc {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
