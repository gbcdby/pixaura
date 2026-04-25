<template>
  <div class="subscription-page">
    <n-layout>
      <!-- 顶部导航 -->
      <n-layout-header bordered class="header">
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
        <!-- 当前订阅 -->
        <n-card title="当前订阅" class="subscription-card">
          <!-- 管理员特例 -->
          <n-alert v-if="authStore.isAdmin" type="success" class="admin-alert">
            管理员账户无额度限制，可无限使用所有功能
          </n-alert>

          <!-- 普通用户订阅状态 -->
          <n-descriptions v-if="!authStore.isAdmin" bordered>
            <n-descriptions-item label="订阅等级">
              <n-tag :type="tierTagType">
                {{ tierName }}
              </n-tag>
            </n-descriptions-item>
            <n-descriptions-item v-if="billingStore.subscription?.period" label="订阅周期">
              {{ periodName }}
            </n-descriptions-item>
            <n-descriptions-item label="有效期">
              {{ formatDateOnly(userStore.profile?.subscriptionExpiresAt) }}
              <span v-if="daysRemaining > 0" class="days-remaining">（剩余 {{ daysRemaining }} 天）</span>
              <span v-else-if="userStore.profile?.subscriptionExpiresAt" class="expired-text">（已过期）</span>
            </n-descriptions-item>
            <n-descriptions-item v-if="billingStore.subscription?.autoRenew" label="自动续费">
              {{ billingStore.subscription.autoRenew ? "已开启" : "已关闭" }}
            </n-descriptions-item>
          </n-descriptions>

          <n-space
            v-if="!authStore.isAdmin && billingStore.subscription?.tier !== 'free' && billingStore.subscription?.autoRenew"
            class="actions"
          >
            <n-button type="warning" @click="handleCancelRenew">
              取消自动续费
            </n-button>
          </n-space>
        </n-card>

        <!-- 订阅方案比较 -->
        <n-card
          title="订阅方案"
          class="plans-card"
        >
          <n-grid
            :cols="2"
            :x-gap="16"
            responsive="screen"
          >
            <n-grid-item
              v-for="tier in billingStore.availableTiers"
              :key="tier.tier"
            >
              <n-card
                :class="['plan-card', { current: isCurrentPlan(tier.tier) }]"
                :title="tier.name"
              >
                <div class="plan-price">
                  <span class="price">¥{{ tier.monthlyPrice }}</span>
                  <span class="unit">/月</span>
                </div>

                <div class="yearly-price">
                  年度订阅 ¥{{ tier.yearlyPrice }}/年 (省
                  {{ calculateYearlySavings(tier) }}元)
                </div>

                <n-divider />

                <ul class="feature-list">
                  <li
                    v-for="feature in tier.features"
                    :key="feature"
                  >
                    <n-icon color="#52c41a">
                      <Checkmark />
                    </n-icon>
                    {{ feature }}
                  </li>
                </ul>

                <template #footer>
                  <n-button
                    v-if="isCurrentPlan(tier.tier)"
                    type="primary"
                    disabled
                    block
                  >
                    当前方案
                  </n-button>
                  <n-button
                    v-else
                    type="primary"
                    block
                    @click="handleSubscribe(tier.tier, 'monthly')"
                  >
                    {{
                      billingStore.subscription?.tier === "free"
                        ? "立即订阅"
                        : "升级"
                    }}
                  </n-button>
                </template>
              </n-card>
            </n-grid-item>
          </n-grid>
        </n-card>

        <n-spin
          v-if="billingStore.loading"
          size="large"
          class="loading-spin"
        />
      </n-layout-content>
    </n-layout>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { Checkmark } from "@vicons/ionicons5";
import { useBillingStore } from "@/stores/billing";
import { useUserStore } from "@/stores/user";
import { useAuthStore } from "@/stores/auth";
import { useDialog, useMessage } from "naive-ui";

const billingStore = useBillingStore();
const userStore = useUserStore();
const authStore = useAuthStore();
const dialog = useDialog();
const message = useMessage();

// 计算订阅剩余天数（和个人中心一致）
const daysRemaining = computed(() => {
  const expiresAt = userStore.profile?.subscriptionExpiresAt;
  if (!expiresAt) return 0;
  const expires = new Date(expiresAt);
  const now = new Date();
  const diff = expires.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});

const tierName = computed(() => {
  const map: Record<string, string> = {
    free: "免费版",
    basic: "基础版",
    pro: "专业版",
  };
  return map[userStore.profile?.subscriptionTier || "free"];
});

const tierTagType = computed(() => {
  const map: Record<string, "default" | "primary" | "success"> = {
    free: "default",
    basic: "primary",
    pro: "success",
  };
  return map[userStore.profile?.subscriptionTier || "free"];
});

const periodName = computed(() => {
  const map: Record<string, string> = {
    monthly: "月度",
    yearly: "年度",
  };
  return map[billingStore.subscription?.period || "monthly"];
});

function isCurrentPlan(tier: string) {
  return userStore.profile?.subscriptionTier === tier;
}

function formatDateOnly(date?: string): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("zh-CN");
}

function calculateYearlySavings(tier: {
  monthlyPrice: number;
  yearlyPrice: number;
}) {
  return tier.monthlyPrice * 12 - tier.yearlyPrice;
}

function handleCancelRenew() {
  dialog.warning({
    title: "取消自动续费",
    content: "取消后，订阅到期后将不会自动扣费续期。确定要取消吗？",
    positiveText: "确定",
    negativeText: "取消",
    onPositiveClick: async () => {
      try {
        await billingStore.cancelSubscription();
        message.success("已取消自动续费");
      } catch {
        message.error("操作失败，请重试");
      }
    },
  });
}

async function handleSubscribe(_tier: string, _period: string) {
  // 暂不支持在线支付，提示用户联系客服
  dialog.info({
    title: "订阅提示",
    content: "在线支付功能正在开发中，如需订阅请联系客服或管理员",
    positiveText: "确定",
  });
}

onMounted(() => {
  billingStore.fetchSubscription();
  userStore.fetchProfile();
});
</script>

<style scoped lang="scss">
.subscription-page {
  min-height: 100vh;
  background: var(--color-bg-base);
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
  min-height: calc(100vh - 64px);
}

// 卡片统一样式
.subscription-card,
.plans-card {
  background: var(--color-bg-elevated);
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-md);
}

.subscription-card {
  margin-bottom: 16px;

  .admin-alert {
    margin-bottom: 16px;
  }

  .days-remaining {
    color: var(--color-text-secondary);
    margin-left: 4px;
  }

  .expired-text {
    color: var(--color-error);
    margin-left: 4px;
  }

  .actions {
    margin-top: 16px;
  }
}

.plans-card {
  .plan-card {
    height: 100%;
    background: var(--color-bg-elevated);
    border-radius: var(--radius-xl);
    border: 1px solid var(--color-border);
    transition: all 0.2s ease;

    &:hover {
      box-shadow: var(--shadow-lg);
    }

    &.current {
      border-color: var(--color-primary);
      background: linear-gradient(135deg, rgba(157, 138, 231, 0.08) 0%, rgba(157, 138, 231, 0.04) 100%);
    }

    .plan-price {
      text-align: center;
      margin-bottom: 8px;

      .price {
        font-size: 36px;
        font-weight: bold;
        color: var(--color-text-primary);
      }

      .unit {
        color: var(--color-text-secondary);
      }
    }

    .yearly-price {
      text-align: center;
      color: var(--color-primary);
      font-size: 14px;
    }

    .feature-list {
      list-style: none;
      padding: 0;
      margin: 0;

      li {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 0;
        color: var(--color-text-secondary);
      }
    }
  }
}

.loading-spin {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

@media (max-width: 768px) {
  .main-content {
    padding: 16px;
  }
}
</style>