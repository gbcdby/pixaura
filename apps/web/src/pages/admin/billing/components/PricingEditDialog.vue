<template>
  <n-modal
    v-model:show="visibleModel"
    title="编辑价格"
    preset="card"
    style="width: 500px"
    :closable="true"
  >
    <n-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-placement="left"
      label-width="100"
    >
      <n-form-item label="订阅方案">
        <n-text strong>
          {{ pricingInfo?.tier_name }} - {{ pricingInfo?.period_name }}
        </n-text>
      </n-form-item>

      <n-form-item label="当前价格">
        <n-text depth="3">
          ￥{{ pricingInfo?.price?.toFixed(2) }}
        </n-text>
      </n-form-item>

      <n-form-item
        label="新价格"
        path="price"
        required
      >
        <n-input-number
          v-model:value="form.price"
          :min="0"
          :precision="2"
          :step="1"
          style="width: 100%"
          placeholder="请输入新价格"
        />
      </n-form-item>

      <n-form-item label="变更原因">
        <n-input
          v-model:value="form.reason"
          placeholder="可选，建议填写变更原因"
          clearable
        />
      </n-form-item>

      <n-divider />

      <n-alert
        v-if="form.price && pricingInfo?.price"
        type="info"
        show-icon
      >
        <template #header>
          <n-text>变更确认</n-text>
        </template>
        <div class="change-summary">
          <div>原价：￥{{ pricingInfo.price.toFixed(2) }}</div>
          <div>新价：￥{{ form.price.toFixed(2) }}</div>
          <div>变化：{{ calculateChangePercent() }}%</div>
        </div>
      </n-alert>
    </n-form>

    <template #footer>
      <n-space justify="end">
        <n-button @click="handleCancel">
          取消
        </n-button>
        <n-button
          type="primary"
          :loading="confirmLoading"
          @click="handleSubmit"
        >
          确认修改
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import type { PricingItem } from "@/types/billing";
import type { FormInst, FormRules } from "naive-ui";

interface Props {
  visible: boolean;
  pricingInfo: PricingItem | null;
  confirmLoading: boolean;
}

interface Emits {
  (e: "update:visible", value: boolean): void;
  (e: "submit", data: { price: number; reason?: string }): void;
}

const props = withDefaults(defineProps<Props>(), {
  pricingInfo: null,
});

const emit = defineEmits<Emits>();

const formRef = ref<FormInst | null>(null);

const form = ref({
  price: 0,
  reason: "",
});

// 表单验证规则
const rules: FormRules = {
  price: {
    required: true,
    type: "number",
    min: 0,
    message: "请输入有效的价格（不能为负数）",
    trigger: ["blur", "change"],
  },
};

// 监听定价信息变化，重置表单
watch(
  () => props.pricingInfo,
  (val) => {
    if (val) {
      form.value.price = val.price;
      form.value.reason = "";
    }
  },
);

// 可见性的双向绑定
const visibleModel = computed({
  get: () => props.visible,
  set: (val) => emit("update:visible", val),
});

// 计算价格变化百分比
const calculateChangePercent = () => {
  if (!props.pricingInfo?.price || !form.value.price) return "0.00";
  const change =
    ((form.value.price - props.pricingInfo.price) / props.pricingInfo.price) *
    100;
  return change.toFixed(2);
};

// 取消
const handleCancel = () => {
  emit("update:visible", false);
  form.value.price = 0;
  form.value.reason = "";
  formRef.value?.restoreValidation();
};

// 提交
const handleSubmit = async () => {
  try {
    await formRef.value?.validate();
    emit("submit", {
      price: form.value.price,
      reason: form.value.reason || undefined,
    });
  } catch (err) {
    console.error("表单验证失败", err);
  }
};
</script>

<style scoped lang="scss">
.change-summary {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 14px;
}
</style>
