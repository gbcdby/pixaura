<script setup lang="ts">
import { onMounted, computed, h, ref } from "vue";
import { NSelect, NTag, NSpace } from "naive-ui";
import { useModelConfigStore } from "@/stores/model-config";
import { useBillingStore } from "@/stores/billing";
import { useAuthStore } from "@/stores/auth";
import type {
  UserModelListItemDto,
  FunctionCategory,
} from "@/types/model-config";

const props = defineProps<{
  modelValue: string;
  category?: FunctionCategory;
  placeholder?: string;
  showPrice?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
  change: [model: UserModelListItemDto | undefined];
}>();

const store = useModelConfigStore();
const billingStore = useBillingStore();
const authStore = useAuthStore();

// 额度加载状态
const quotaLoading = ref(false);

// 管理员判断
const isAdmin = computed(() => authStore.isAdmin);

// 将 models 数组转换为按 modelId 索引的 Map（优先使用小周期额度）
const quotaInfo = computed(() => {
  const map: Record<string, { remaining: number; total: number }> = {};
  if (!billingStore.quota?.quotas?.models) return map;

  // 按模型ID分组，优先使用小周期额度
  const modelQuotas = billingStore.quota.quotas.models;
  modelQuotas.forEach((m) => {
    // 优先使用小周期额度
    if (m.smallCycle.remaining > 0 || !map[m.modelId]) {
      map[m.modelId] = {
        remaining: m.smallCycle.remaining || m.largeCycle.remaining,
        total: m.smallCycle.total || m.largeCycle.total,
      };
    }
  });

  return map;
});

// 额度状态标签类型映射
function getQuotaTagType(
  remaining: number,
  total: number,
): "success" | "warning" | "error" {
  // 额度为 0 时显示 error
  if (remaining <= 0) return "error";
  // 剩余比例大于 20% 显示 success
  const percent = remaining / total;
  if (percent > 0.2) return "success";
  // 剩余比例 10%-20% 显示 warning
  if (percent > 0.1) return "warning";
  return "error";
}

// 根据类别筛选模型
const filteredModels = computed(() => {
  if (!props.category) {
    // 返回所有模型（平铺）
    const allModels: UserModelListItemDto[] = [];
    store.userModels.forEach((group) => {
      allModels.push(...group.models);
    });
    return allModels;
  }

  // 返回指定类别的模型
  const group = store.userModels.find((g) => g.category === props.category);
  return group?.models || [];
});

// 转换为 Select 选项（含禁用逻辑）
const modelOptions = computed(() => {
  return filteredModels.value.map((model) => {
    const quota = quotaInfo.value[model.modelId];
    // 非管理员且额度为 0 时禁用
    const disabled = !isAdmin.value && quota?.remaining <= 0;

    return {
      label: model.modelName,
      value: model.modelId,
      model,
      disabled,
    };
  });
});

// 处理选择变化
function handleChange(value: string) {
  emit("update:modelValue", value);
  const model = filteredModels.value.find((m) => m.modelId === value);
  emit("change", model);
}

// 合并加载状态（模型列表 + 额度信息）
const isLoading = computed(() => store.loading || quotaLoading.value);

// 加载数据
onMounted(async () => {
  // 加载模型列表
  if (store.userModels.length === 0) {
    store.fetchUserModels();
  }

  // 非管理员时加载额度信息
  if (!isAdmin.value) {
    quotaLoading.value = true;
    try {
      await billingStore.fetchQuota();
    } finally {
      quotaLoading.value = false;
    }
  }
});

// 渲染标签 - 使用渲染函数
function renderLabel(option: {
  label: string;
  value: string;
  model: UserModelListItemDto;
}) {
  const model = option.model;
  const quota = quotaInfo.value[model.modelId];
  const children: (string | ReturnType<typeof h> | null)[] = [option.label];

  // 默认标签
  if (model.isDefault) {
    children.push(
      h(NTag, { type: "primary", size: "tiny" }, { default: () => "默认" }),
    );
  }

  // 额度状态标签（新增）
  if (isAdmin.value) {
    // 管理员显示无限制
    children.push(
      h(
        NTag,
        { type: "primary", size: "tiny" },
        { default: () => "管理员" },
      ),
    );
  } else if (quota && quota.remaining > 0) {
    // 有额度显示剩余次数
    const tagType = getQuotaTagType(quota.remaining, quota.total);
    children.push(
      h(
        NTag,
        { type: tagType, size: "tiny" },
        { default: () => `${quota.remaining}次` },
      ),
    );
  } else {
    // 无额度显示额度不足
    children.push(
      h(
        NTag,
        { type: "error", size: "tiny" },
        { default: () => "额度不足" },
      ),
    );
  }

  // 价格信息
  if (props.showPrice && model.pricePer1kTokens) {
    children.push(
      h(
        "span",
        { style: "color: #999; font-size: 12px;" },
        `¥${model.pricePer1kTokens}/千token`,
      ),
    );
  }

  if (props.showPrice && model.pricePerCall) {
    children.push(
      h(
        "span",
        { style: "color: #999; font-size: 12px;" },
        `¥${model.pricePerCall}/次`,
      ),
    );
  }

  if (props.showPrice && model.pricePerSecond) {
    children.push(
      h(
        "span",
        { style: "color: #999; font-size: 12px;" },
        `¥${model.pricePerSecond}/秒`,
      ),
    );
  }

  return h(NSpace, { align: "center", size: 8 }, { default: () => children });
}
</script>

<template>
  <NSelect
    :value="modelValue"
    :options="modelOptions"
    :placeholder="placeholder || '请选择模型'"
    :loading="isLoading"
    :render-label="renderLabel"
    clearable
    @update:value="handleChange"
  />
</template>

<style scoped>
.model-selector {
  width: 100%;
}
</style>
