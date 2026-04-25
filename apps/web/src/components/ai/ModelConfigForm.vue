<script setup lang="ts">
/**
 * ModelConfigForm - 模型配置表单组件
 *
 * 可复用的模型配置表单组件，用于统一用户默认模型设置和项目模型配置的UI
 */
import { h } from "vue";
import { NForm, NFormItem, NSelect, NSpace, NIcon, NTag } from "naive-ui";
import type { SelectOption } from "naive-ui";
import type { UserModelListItemDto } from "@pixaura/shared-types";
import type { ModelCategoryConfig } from "@/constants/model";

/**
 * 组件Props定义
 */
interface Props {
  /** 选中的模型配置，key为类别，value为模型ID（空字符串表示使用默认） */
  modelValue: Record<string, string>;
  /** 模型类别列表 */
  categories: ModelCategoryConfig[];
  /** 可用模型数据，按类别分组 */
  models: Record<string, UserModelListItemDto[]>;
  /** 是否禁用（用于权限控制） */
  disabled?: boolean;
  /** 是否显示价格 */
  showPrice?: boolean;
  /** 加载状态 */
  loading?: boolean;
  /** 表单标签宽度 */
  labelWidth?: number;
  /** 模型来源信息，key为类别，value为来源 */
  modelSources?: Record<string, "project" | "user" | "system">;
  /** 默认级别描述文本：个人中心显示"系统默认"，项目设置显示"用户默认" */
  defaultLevelLabel?: string;
  /** 级联解析后的默认模型名称映射，key为类别，value为模型名称 */
  cascadeDefaultNames?: Record<string, string>;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  showPrice: true,
  loading: false,
  labelWidth: 140,
  modelSources: () => ({}),
  defaultLevelLabel: "系统默认",
  cascadeDefaultNames: () => ({}),
});

/**
 * 组件事件定义
 */
interface Emits {
  (e: "update:modelValue", value: Record<string, string>): void;
}

const emit = defineEmits<Emits>();

/**
 * 更新模型选择
 * @param categoryKey - 类别key
 * @param value - 选中的模型ID
 */
const handleUpdate = (categoryKey: string, value: string) => {
  const newValue = { ...props.modelValue, [categoryKey]: value };
  emit("update:modelValue", newValue);
};

/**
 * 格式化价格信息
 * @param model - 模型数据
 * @returns 价格字符串数组
 */
const formatPriceInfo = (model: UserModelListItemDto): string[] => {
  const prices: string[] = [];
  if (model.pricePer1kTokens) {
    prices.push(`¥${model.pricePer1kTokens}/千token`);
  }
  if (model.pricePerCall) {
    prices.push(`¥${model.pricePerCall}/次`);
  }
  if (model.pricePerSecond) {
    prices.push(`¥${model.pricePerSecond}/秒`);
  }
  if (model.pricePerChar) {
    prices.push(`¥${model.pricePerChar}/字`);
  }
  // 未配置售价时显示"免费"
  if (prices.length === 0) {
    prices.push("免费");
  }
  return prices;
};

/**
 * 渲染带价格的选项标签
 * @param model - 模型数据
 * @param showDefault - 是否显示默认标签
 * @returns VNode
 */
const renderModelLabel = (model: UserModelListItemDto, showDefault: boolean = false) => {
  const children: (string | ReturnType<typeof h> | null)[] = [model.modelName];

  // 默认标签
  if (showDefault && model.isDefault) {
    children.push(
      h(NTag, { type: "primary", size: "tiny" }, { default: () => "默认" }),
    );
  }

  // 价格信息
  if (props.showPrice) {
    const prices = formatPriceInfo(model);
    prices.forEach((price) => {
      children.push(
        h("span", { style: "color: #999; font-size: 12px;" }, price),
      );
    });
  }

  return h(NSpace, { align: "center", size: 8 }, { default: () => children });
};

/**
 * 获取某类别的选项列表
 * @param categoryKey - 类别key
 * @returns 选项列表
 */
const getOptionsForCategory = (categoryKey: string): SelectOption[] => {
  const categoryModels = props.models[categoryKey] || [];

  // 使用级联解析后的模型名称（优先级：项目 → 用户 → 系统）
  const cascadeModelName = props.cascadeDefaultNames[categoryKey];
  const defaultModel = categoryModels.find((m) => m.isDefault);
  // 级联名称优先，其次系统默认模型名称，最后兜底标签
  const defaultModelName = cascadeModelName || defaultModel?.modelName || props.defaultLevelLabel;

  return [
    {
      label: () =>
        h(
          NSpace,
          { align: "center", size: 8 },
          {
            default: () => [
              h("span", { title: `${props.defaultLevelLabel} - ${defaultModelName}` }, `${props.defaultLevelLabel}`),
              defaultModelName && props.showPrice
                ? h("span", { style: "color: #999; font-size: 12px;" }, defaultModelName)
                : null,
            ],
          },
        ),
      value: "",
    },
    ...categoryModels.map((m) => ({
      label: () => renderModelLabel(m, false),
      value: m.modelId,
    })),
  ];
};

/**
 * 获取当前选中的值
 * @param categoryKey - 类别key
 * @returns 当前选中的模型ID
 */
const getSelectedValue = (categoryKey: string): string => {
  return props.modelValue[categoryKey] || "";
};
</script>

<template>
  <n-form
    label-placement="left"
    :label-width="labelWidth"
  >
    <n-form-item
      v-for="category in categories"
      :key="category.key"
    >
      <template #label>
        <div class="category-label">
          <n-icon :size="18">
            <component :is="category.icon" />
          </n-icon>
          <span>{{ category.label }}</span>
        </div>
      </template>

      <n-select
        :value="getSelectedValue(category.key)"
        :options="getOptionsForCategory(category.key)"
        :placeholder="category.description"
        :disabled="disabled || loading"
        :loading="loading"
        :consistent-menu-width="false"
        :menu-props="{ style: { maxWidth: '500px' } }"
        style="width: 100%; max-width: 480px"
        @update:value="(val) => handleUpdate(category.key, val)"
      />
    </n-form-item>
  </n-form>
</template>

<style scoped lang="scss">
.category-label {
  display: flex;
  align-items: center;
  gap: 8px;
}
:deep(.n-base-selection-label),
:deep(.n-base-selection-input) {
  display: flex;
  align-items: center;
  white-space: nowrap !important;
}

:deep(.n-base-selection-label > .n-space) {
  flex-wrap: nowrap !important;
  gap: 6px;
}
</style>
