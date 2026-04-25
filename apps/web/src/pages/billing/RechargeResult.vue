<template>
  <div class="recharge-result">
    <n-card
      v-if="loading"
      class="loading-card"
    >
      <n-spin size="large" />
      <p>正在查询订单状态...</p>
    </n-card>

    <n-card
      v-else-if="order"
      class="result-card"
    >
      <div
        v-if="isSuccess"
        class="success-content"
      >
        <div class="success-icon">
          <n-icon
            :size="64"
            color="#52c41a"
          >
            <CheckmarkCircle />
          </n-icon>
        </div>
        <h2>充值成功！</h2>
        <div class="result-info">
          <p>
            <span class="label">充值金额：</span>
            <span class="value">¥{{ order.amount }}</span>
          </p>
          <p>
            <span class="label">获得额度：</span>
            <span class="value">{{ order.credits }} 点</span>
          </p>
          <p v-if="order.paidAt">
            <span class="label">支付时间：</span>
            <span class="value">{{ formatDate(order.paidAt) }}</span>
          </p>
        </div>
      </div>

      <div
        v-else-if="isPending"
        class="pending-content"
      >
        <div class="pending-icon">
          <n-icon
            :size="64"
            color="#faad14"
          >
            <Time />
          </n-icon>
        </div>
        <h2>等待支付</h2>
        <p class="pending-text">
          订单已创建，请完成支付
        </p>
        <div class="result-info">
          <p>
            <span class="label">订单金额：</span>
            <span class="value">¥{{ order.amount }}</span>
          </p>
          <p>
            <span class="label">预计额度：</span>
            <span class="value">{{ order.credits }} 点</span>
          </p>
        </div>
      </div>

      <div
        v-else
        class="fail-content"
      >
        <div class="fail-icon">
          <n-icon
            :size="64"
            color="#ff4d4f"
          >
            <CloseCircle />
          </n-icon>
        </div>
        <h2>充值失败</h2>
        <p class="fail-text">
          订单已取消或支付超时
        </p>
      </div>

      <n-space
        justify="center"
        class="actions"
      >
        <n-button
          type="primary"
          @click="$router.push('/user/profile')"
        >
          返回个人中心
        </n-button>
        <n-button @click="$router.push('/billing/history')">
          查看记录
        </n-button>
      </n-space>
    </n-card>

    <n-card
      v-else
      class="error-card"
    >
      <n-empty description="订单不存在或已过期" />
      <n-space
        justify="center"
        class="actions"
      >
        <n-button
          type="primary"
          @click="$router.push('/billing/recharge')"
        >
          重新充值
        </n-button>
      </n-space>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import { CheckmarkCircle, Time, CloseCircle } from "@vicons/ionicons5";
import { useBillingStore } from "@/stores/billing";
import type { RechargeOrder } from "@/types/billing";

const route = useRoute();
const billingStore = useBillingStore();

const order = ref<RechargeOrder | null>(null);
const loading = ref(true);

const isSuccess = computed(() => order.value?.paymentStatus === "paid");
const isPending = computed(() => order.value?.paymentStatus === "pending");

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("zh-CN");
}

onMounted(async () => {
  const orderId = route.query.orderId as string;
  if (!orderId) {
    loading.value = false;
    return;
  }

  try {
    const data = await billingStore.fetchRechargeOrder(orderId);
    order.value = data;
  } catch {
    order.value = null;
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped lang="scss">
.recharge-result {
  max-width: 600px;
  margin: 0 auto;
  padding: 24px;
}

.loading-card,
.result-card,
.error-card {
  text-align: center;
  padding: 48px 24px;
}

.success-icon,
.pending-icon,
.fail-icon {
  margin-bottom: 24px;
}

h2 {
  margin-bottom: 24px;
  color: #333;
}

.result-info {
  margin: 24px 0;
  text-align: left;
  max-width: 300px;
  margin-left: auto;
  margin-right: auto;

  p {
    display: flex;
    justify-content: space-between;
    margin: 12px 0;
    padding: 8px 0;
    border-bottom: 1px solid #f0f0f0;

    &:last-child {
      border-bottom: none;
    }
  }

  .label {
    color: #666;
  }

  .value {
    font-weight: 500;
    color: #333;
  }
}

.pending-text,
.fail-text {
  color: #666;
  margin-bottom: 16px;
}

.actions {
  margin-top: 32px;
}
</style>
