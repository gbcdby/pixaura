<template>
  <n-modal :show="visible" @update:show="onModalUpdate" preset="card" title="账户充值" style="width: 600px">
    <n-spin :show="loading">
      <!-- 推荐套餐 -->
      <div v-if="activePromotions.length" class="section">
        <div class="section-title">推荐套餐</div>
        <div class="promotion-list">
          <div
            v-for="promo in activePromotions"
            :key="promo.id"
            class="promotion-card"
            :class="{ active: selectedPromoId === promo.id }"
            @click="selectPromotion(promo)"
          >
            <div class="promo-header">
              <span class="promo-name">{{ promo.name }}</span>
              <span v-if="promo.bonusValue > 0" class="promo-tag">赠</span>
            </div>
            <div class="promo-amount">¥{{ formatAmount(promo.minAmount) }}</div>
            <div v-if="promo.bonusValue > 0" class="promo-bonus">
              赠送 {{ formatPromoBonusText(promo) }}
            </div>
            <div v-if="promo.description" class="promo-desc">
              {{ promo.description }}
            </div>
          </div>
        </div>
      </div>

      <!-- 充值金额 -->
      <div class="section">
        <div class="section-title">充值金额</div>
        <div class="amount-input-row">
          <n-input-group>
            <n-input-group-label>¥</n-input-group-label>
            <n-input-number
              v-model:value="customAmount"
              :min="1"
              :max="10000"
              placeholder="输入充值金额"
            />
            <n-input-group-label>元</n-input-group-label>
          </n-input-group>
          <div v-if="bonusDisplay.text" class="bonus-inline" :class="bonusDisplay.type">
            <n-tag v-if="bonusDisplay.type === 'warning'" :type="bonusDisplay.type" size="small">
              {{ bonusDisplay.text }}
            </n-tag>
            <n-tag v-else :type="bonusDisplay.type" size="small">
              {{ bonusDisplay.text }}
            </n-tag>
          </div>
        </div>
      </div>

      <!-- 支付方式 -->
      <div class="section payment-group">
        <div class="payment-label">支付方式</div>
        <n-radio-group v-model:value="paymentMethod">
          <n-space>
            <n-radio value="alipay">
              <n-space align="center">
                <svg class="payment-icon alipay" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
                  <path d="M789 610.3c-38.7-12.9-90.7-32.7-148.5-53.6c34.8-60.3 62.5-129 80.7-203.6H530.5v-68.6h233.6v-38.3H530.5V132h-95.4c-16.7 0-16.7 16.5-16.7 16.5v97.8H182.2v38.3h236.3v68.6H223.4v38.3h378.4a667.18 667.18 0 0 1-54.5 132.9c-122.8-40.4-253.8-73.2-336.1-53c-52.6 13-86.5 36.1-106.5 60.3c-91.4 111-25.9 279.6 167.2 279.6C386 811.2 496 747.6 581.2 643C708.3 704 960 808.7 960 808.7V659.4s-31.6-2.5-171-49.1zM253.9 746.6c-150.5 0-195-118.3-120.6-183.1c24.8-21.9 70.2-32.6 94.4-35c89.4-8.8 172.2 25.2 269.9 72.8c-68.8 89.5-156.3 145.3-243.7 145.3z" fill="currentColor"/>
                </svg>
                <span>支付宝</span>
              </n-space>
            </n-radio>
            <n-radio value="wechat">
              <n-space align="center">
                <svg class="payment-icon wechat" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
                  <path d="M408.67 298.53a21 21 0 1 1 20.9-21a20.85 20.85 0 0 1-20.9 21m-102.17 0a21 21 0 1 1 20.9-21a20.84 20.84 0 0 1-20.9 21m152.09 118.86C491.1 394.08 512 359.13 512 319.51c0-71.08-68.5-129.35-154.41-129.35s-154.42 58.27-154.42 129.35s68.5 129.34 154.42 129.34c17.41 0 34.83-2.33 49.92-7c2.49-.86 3.48-1.17 4.64-1.17a16.67 16.67 0 0 1 8.13 2.34L454 462.83a11.62 11.62 0 0 0 3.48 1.17a5 5 0 0 0 4.65-4.66a14.27 14.27 0 0 0-.77-3.86c-.41-1.46-5-16-7.36-25.27a18.94 18.94 0 0 1-.33-3.47a11.4 11.4 0 0 1 5-9.35" fill="currentColor"/>
                  <path d="M246.13 178.51a24.47 24.47 0 0 1 0-48.94c12.77 0 24.38 11.65 24.38 24.47c1.16 12.82-10.45 24.47-24.38 24.47m-123.06 0A24.47 24.47 0 1 1 147.45 154a24.57 24.57 0 0 1-24.38 24.47M184.6 48C82.43 48 0 116.75 0 203c0 46.61 24.38 88.56 63.85 116.53C67.34 321.84 68 327 68 329a11.38 11.38 0 0 1-.66 4.49C63.85 345.14 59.4 364 59.21 365s-1.16 3.5-1.16 4.66a5.49 5.49 0 0 0 5.8 5.83a7.15 7.15 0 0 0 3.49-1.17L108 351c3.49-2.33 5.81-2.33 9.29-2.33a16.33 16.33 0 0 1 5.81 1.16c18.57 5.83 39.47 8.16 60.37 8.16h10.45a133.24 133.24 0 0 1-5.81-38.45c0-78.08 75.47-141 168.35-141h10.45C354.1 105.1 277.48 48 184.6 48" fill="currentColor"/>
                </svg>
                <span>微信支付</span>
              </n-space>
            </n-radio>
          </n-space>
        </n-radio-group>
      </div>

      <!-- 总计 -->
      <div v-if="finalAmount > 0" class="summary">
        <div class="summary-row">
          <span class="summary-label">充值金额</span>
          <span class="summary-value">¥{{ finalAmount.toFixed(2) }}</span>
        </div>
        <div v-if="actualBonus > 0" class="summary-row">
          <span class="summary-label">赠送额度</span>
          <span class="summary-value bonus">+{{ actualBonus }} 点</span>
        </div>
        <div class="summary-row total">
          <span class="summary-label">预计获得</span>
          <span class="summary-value">{{ baseCredits }} 点{{ actualBonus > 0 ? `（含赠送 ${actualBonus} 点）` : "" }}</span>
        </div>
      </div>
    </n-spin>

    <template #footer>
      <n-space justify="end">
        <n-button @click="onClose">取消</n-button>
        <n-button
          type="primary"
          :loading="submitting"
          :disabled="!canSubmit"
          @click="handleRecharge"
        >
          确认充值 ¥{{ finalAmount.toFixed(2) }}
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useBillingStore } from "@/stores/billing";
import { billingApi } from "@/api/billing";
import { useMessage } from "naive-ui";
import type { RechargePromotion } from "@/types/billing";

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  "update:visible": [value: boolean];
}>();

const billingStore = useBillingStore();
const router = useRouter();
const message = useMessage();

const loading = ref(false);
const submitting = ref(false);
const promotions = ref<RechargePromotion[]>([]);
const selectedPromoId = ref<string | null>(null);
const customAmount = ref<number | null>(null);
const paymentMethod = ref<"alipay" | "wechat">("alipay");

// 生效的活动
const activePromotions = computed(() =>
  promotions.value.filter((p) => p.isActive),
);

// 最终金额以自定义输入为准
const finalAmount = computed(() => customAmount.value || 0);

// 当前绑定的活动规则（选中的套餐，或自动匹配的）
const boundPromo = computed<RechargePromotion | null>(() => {
  if (selectedPromoId.value) {
    return promotions.value.find((p) => p.id === selectedPromoId.value) || null;
  }
  // 自动匹配门槛最高的活动
  const amount = finalAmount.value;
  if (amount <= 0) return null;
  return activePromotions.value
    .filter((p) => p.bonusValue > 0 && amount >= p.minAmount)
    .sort((a, b) => b.minAmount - a.minAmount)[0] || null;
});

// 计算赠送额度
function calcBonus(promo: RechargePromotion, amount: number): number {
  if (amount < promo.minAmount) return 0;
  if (promo.bonusType === "percent") {
    let bonus = amount * 10 * (promo.bonusValue / 100);
    if (promo.maxBonus != null && bonus > promo.maxBonus) {
      bonus = promo.maxBonus;
    }
    return Math.floor(bonus);
  }
  return promo.bonusValue;
}

// 当前实际赠送额度
const actualBonus = computed(() => {
  const amount = finalAmount.value;
  if (amount <= 0 || !boundPromo.value) return 0;
  return calcBonus(boundPromo.value, amount);
});

// 基础额度（1元 = 10点）
const baseCredits = computed(() => finalAmount.value * 10);

// 赠送提示信息
const bonusDisplay = computed(() => {
  const amount = finalAmount.value;
  if (amount <= 0) return { text: "", type: "default" as const };

  if (selectedPromoId.value) {
    const promo = promotions.value.find((p) => p.id === selectedPromoId.value);
    if (!promo || promo.bonusValue <= 0) {
      return { text: "", type: "default" as const };
    }
    // 选中了套餐但金额不够门槛
    if (amount < promo.minAmount) {
      return {
        text: `未达该活动最低充值要求（¥${formatAmount(promo.minAmount)}）`,
        type: "warning" as const,
      };
    }
    const bonus = calcBonus(promo, amount);
    if (bonus <= 0) return { text: "", type: "default" as const };
    return { text: `赠送 ${bonus} 点`, type: "success" as const };
  }

  // 未选套餐，自动匹配
  if (boundPromo.value && amount >= boundPromo.value.minAmount) {
    const bonus = calcBonus(boundPromo.value, amount);
    if (bonus <= 0) return { text: "", type: "default" as const };
    return { text: `赠送 ${bonus} 点`, type: "success" as const };
  }

  // 金额太小，不匹配任何活动
  const minActive = activePromotions.value
    .filter((p) => p.bonusValue > 0)
    .sort((a, b) => a.minAmount - b.minAmount)[0];

  if (minActive && amount < minActive.minAmount) {
    return {
      text: `未达最低活动金额（¥${formatAmount(minActive.minAmount)}）`,
      type: "warning" as const,
    };
  }

  return { text: "", type: "default" as const };
});

const canSubmit = computed(() => finalAmount.value > 0);

function formatAmount(n: number): string {
  return n % 1 === 0 ? n.toString() : n.toFixed(2);
}

// 格式化套餐赠送文本（基于套餐自身 minAmount）
function formatPromoBonusText(promo: RechargePromotion): string {
  const bonus = calcBonus(promo, promo.minAmount);
  if (promo.bonusType === "percent" && promo.maxBonus != null) {
    return `${bonus} 点（最高 ${promo.maxBonus} 点）`;
  }
  return `${bonus} 点`;
}

// 选择套餐：填充金额并绑定规则
function selectPromotion(promo: RechargePromotion) {
  selectedPromoId.value = promo.id;
  customAmount.value = promo.minAmount;
}

function onModalUpdate(show: boolean) {
  if (!show) {
    resetState();
  }
  emit("update:visible", show);
}

function onClose() {
  emit("update:visible", false);
}

function resetState() {
  selectedPromoId.value = null;
  customAmount.value = null;
  paymentMethod.value = "alipay";
}

async function handleRecharge() {
  const amount = finalAmount.value;
  if (amount <= 0) {
    message.error("请输入充值金额");
    return;
  }

  try {
    submitting.value = true;
    const result = await billingStore.createRechargeOrder({
      amount,
      paymentMethod: paymentMethod.value,
    });

    emit("update:visible", false);
    router.push({
      path: "/billing/recharge/result",
      query: { orderId: result.orderId },
    });
  } catch {
    message.error("创建订单失败，请重试");
  } finally {
    submitting.value = false;
  }
}

// 监听弹窗打开，加载活动列表
watch(
  () => props.visible,
  async (val) => {
    if (val && promotions.value.length === 0) {
      try {
        await loadPromotions();
      } catch {
        // 加载失败不阻塞弹窗
      }
    }
  },
);

async function loadPromotions() {
  try {
    loading.value = true;
    const raw = await billingApi.getPromotions();
    // 后端返回的 decimal 字段是字符串，需要转为数字
    promotions.value = raw.map((p) => ({
      ...p,
      minAmount: Number(p.minAmount),
      bonusValue: Number(p.bonusValue),
      maxBonus: p.maxBonus != null ? Number(p.maxBonus) : undefined,
    }));
  } catch {
    message.error("加载充值活动失败");
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  if (props.visible) {
    loadPromotions();
  }
});
</script>

<style scoped lang="scss">
.section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--n-text-color);
  margin-bottom: 12px;
}

.promotion-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 280px;
  overflow-y: auto;
}

.promotion-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-2xl);
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 4%, transparent);
  }

  &.active {
    border: 2px solid var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 6%, transparent);
    padding: 15px;
  }

  .promo-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;

    .promo-name {
      font-size: 15px;
      font-weight: 600;
      color: var(--n-text-color);
    }

    .promo-tag {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 2px 8px;
      font-size: 12px;
      font-weight: 500;
      color: #fff;
      background: linear-gradient(135deg, #ff6b35, #f7931e);
      border-radius: var(--radius-md);
    }
  }

  .promo-amount {
    font-size: 24px;
    font-weight: 700;
    color: var(--n-text-color);
  }

  .promo-bonus {
    margin-top: 4px;
    font-size: 13px;
    color: #52c41a;
    font-weight: 500;
  }

  .promo-desc {
    margin-top: 8px;
    font-size: 12px;
    color: var(--n-text-color-3);
    line-height: 1.5;
  }
}

// 金额输入 + 赠送信息同行
.amount-input-row {
  display: flex;
  align-items: center;
  gap: 12px;

  .n-input-group {
    flex: 1;
  }

  .bonus-inline {
    flex-shrink: 0;
  }
}

.payment-group {
  .payment-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--n-text-color);
    margin-bottom: 12px;
  }
}

.payment-icon {
  width: 28px;
  height: 28px;
  padding: 2px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;

  &.alipay {
    background: #1677ff;
  }

  &.wechat {
    background: #07c160;
  }

  svg {
    width: 100%;
    height: 100%;
  }
}

// 总计区域
.summary {
  padding: 16px;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-2xl);
  border: 1px solid var(--color-border);
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  font-size: 14px;

  .summary-label {
    color: var(--n-text-color-3);
  }

  .summary-value {
    font-weight: 500;
    color: var(--n-text-color);

    &.bonus {
      color: #52c41a;
    }
  }

  &.total {
    padding-top: 12px;
    margin-top: 8px;
    border-top: 1px dashed var(--color-border);

    .summary-label {
      color: var(--n-text-color);
      font-weight: 600;
    }

    .summary-value {
      font-weight: 700;
      font-size: 16px;
      color: var(--color-primary);
    }
  }
}
</style>
