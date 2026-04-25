<template>
  <div class="pricing-config-page">
    <n-h2>订阅价格配置</n-h2>

    <n-card>
      <n-alert
        type="info"
        title="价格配置说明"
        style="margin-bottom: 24px"
      >
        <template #default>
          <div>
            <n-text>修改价格后即时生效，会影响所有新订阅和续费的用户。</n-text>
            <br>
            <n-text depth="3">
              价格变更会被记录到历史中，可在"价格历史"页面查看。
            </n-text>
          </div>
        </template>
      </n-alert>

      <n-space
        v-if="pricingStore.loading"
        justify="center"
        style="padding: 40px 0"
      >
        <n-spin size="large" />
      </n-space>

      <div
        v-else
        class="pricing-grid"
      >
        <!-- 普通订阅 -->
        <div class="tier-section">
          <div class="tier-title">
            <n-tag
              color="blue"
              size="medium"
            >
              普通订阅 (Basic)
            </n-tag>
          </div>

          <n-grid
            cols="1 s:2"
            responsive="screen"
            :x-gap="16"
            :y-gap="16"
          >
            <n-grid-item
              v-for="pricing in basicPricings"
              :key="pricing.id"
            >
              <PricingCard
                :tier="pricing.tier"
                :period="pricing.period"
                :price="pricing.price"
                :updated_at="pricing.updated_at"
                :updater_name="pricing.updater_name"
                @edit="openEditDialog(pricing)"
              />
            </n-grid-item>
          </n-grid>
        </div>

        <!-- 专业订阅 -->
        <div class="tier-section">
          <div class="tier-title">
            <n-tag
              color="green"
              size="medium"
            >
              专业订阅 (Pro)
            </n-tag>
          </div>

          <n-grid
            cols="1 s:2"
            responsive="screen"
            :x-gap="16"
            :y-gap="16"
          >
            <n-grid-item
              v-for="pricing in proPricings"
              :key="pricing.id"
            >
              <PricingCard
                :tier="pricing.tier"
                :period="pricing.period"
                :price="pricing.price"
                :updated_at="pricing.updated_at"
                :updater_name="pricing.updater_name"
                @edit="openEditDialog(pricing)"
              />
            </n-grid-item>
          </n-grid>
        </div>
      </div>
    </n-card>

    <!-- 价格编辑对话框 -->
    <PricingEditDialog
      v-model:visible="editDialogVisible"
      :pricing-info="currentPricing"
      :confirm-loading="pricingStore.updating"
      @submit="handlePriceUpdate"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useMessage } from "naive-ui";
import PricingCard from "./components/PricingCard.vue";
import PricingEditDialog from "./components/PricingEditDialog.vue";
import { usePricingConfigStore } from "@/stores/billing";
import type { PricingItem } from "@/types/billing";

const pricingStore = usePricingConfigStore();
const message = useMessage();

const editDialogVisible = ref(false);
const currentPricing = ref<PricingItem | null>(null);

const basicPricings = computed(() => pricingStore.basicPricing);
const proPricings = computed(() => pricingStore.proPricing);

// 打开编辑对话框
const openEditDialog = (pricing: PricingItem) => {
  currentPricing.value = pricing;
  editDialogVisible.value = true;
};

// 处理价格更新
const handlePriceUpdate = async (data: { price: number; reason?: string }) => {
  if (!currentPricing.value) return;

  try {
    await pricingStore.updatePricing({
      tier: currentPricing.value.tier,
      period: currentPricing.value.period,
      price: data.price,
      reason: data.reason,
    });
    message.success("价格更新成功");
    editDialogVisible.value = false;
  } catch (error: any) {
    console.error("价格更新失败", error);
    message.error(error?.response?.data?.msg || "价格更新失败，请重试");
  }
};

onMounted(() => {
  pricingStore.fetchPricingConfig();
});
</script>

<style scoped lang="scss">
.pricing-config-page {
  padding: 24px;

  h2 {
    margin-bottom: 24px;
    color: #333;
  }
}

.pricing-grid {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.tier-section {
  .tier-title {
    margin-bottom: 16px;
  }
}
</style>
