<template>
  <n-card
    class="pricing-card"
    :bordered="false"
    size="small"
  >
    <template #header>
      <div class="card-header">
        <span class="tier-name">{{ tierName }}</span>
        <n-tag :color="periodTagColor">
          {{ periodName }}
        </n-tag>
      </div>
    </template>

    <div class="price-info">
      <div class="price-label">
        当前价格
      </div>
      <div class="price-value">
        <span class="currency">￥</span>
        <span class="amount">{{ price?.toFixed(2) }}</span>
      </div>
    </div>

    <div
      v-if="updatedInfo"
      class="update-info"
    >
      <n-text
        depth="3"
        style="font-size: 12px"
      >
        更新于 {{ formatDateTime(updatedInfo.updated_at) }}
      </n-text>
      <n-text
        depth="3"
        style="font-size: 12px"
      >
        由 {{ updatedInfo.updater_name }} 修改
      </n-text>
    </div>

    <template #action>
      <n-button
        type="primary"
        block
        secondary
        @click="$emit('edit')"
      >
        编辑
      </n-button>
    </template>
  </n-card>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Props {
  tier: "basic" | "pro";
  period: "monthly" | "yearly";
  price: number;
  updated_at?: string;
  updater_name?: string;
}

interface Emits {
  (e: "edit"): void;
}

const props = defineProps<Props>();
defineEmits<Emits>();

const tierNameMap: Record<string, string> = {
  basic: "普通订阅",
  pro: "专业订阅",
};

const periodNameMap: Record<string, string> = {
  monthly: "月度",
  yearly: "年度",
};

const periodTagColorMap: Record<string, string> = {
  monthly: "blue",
  yearly: "green",
};

const tierName = computed(() => tierNameMap[props.tier]);
const periodName = computed(() => periodNameMap[props.period]);
const periodTagColor = computed(() => periodTagColorMap[props.period]);

const updatedInfo = computed(() => {
  if (!props.updated_at || !props.updater_name) return null;
  return {
    updated_at: props.updated_at,
    updater_name: props.updater_name,
  };
});

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
</script>

<style scoped lang="scss">
.pricing-card {
  height: 100%;
  transition: all 0.3s ease;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .tier-name {
      font-size: 16px;
      font-weight: 600;
      color: #333;
    }
  }

  .price-info {
    text-align: center;
    padding: 16px 0;

    .price-label {
      color: #666;
      font-size: 14px;
      margin-bottom: 8px;
    }

    .price-value {
      display: flex;
      align-items: baseline;
      justify-content: center;
      gap: 4px;

      .currency {
        font-size: 16px;
        font-weight: 600;
        color: #1890ff;
      }

      .amount {
        font-size: 32px;
        font-weight: bold;
        color: #1890ff;
        font-family:
          -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
    }
  }

  .update-info {
    text-align: center;
    padding: 8px 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
}
</style>
