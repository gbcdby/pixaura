<script setup lang="ts">
import { computed, onMounted, watch, h } from "vue";
import { NSelect, NTag, NSpace, NSpin } from "naive-ui";
import type {
  SelectOption,
  SelectRenderLabel,
  SelectRenderOption,
} from "naive-ui";
import { useAIStore } from "@/stores/ai";
import type { ModelCategory, AIModelInfo } from "@/api/ai";

interface Props {
  category: ModelCategory;
  modelId?: string;
  placeholder?: string;
}

interface Emits {
  (e: "update:modelId", modelId: string): void;
  (e: "change", model: AIModelInfo): void;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: "选择模型",
});

const emit = defineEmits<Emits>();

const aiStore = useAIStore();

// 加载状态
const loading = computed(() => aiStore.loading);

// 当前选中的模型ID
const selectedModelId = computed({
  get: () => props.modelId || "",
  set: (value) => {
    emit("update:modelId", value);
    const model = availableModels.value.find((m) => m.modelId === value);
    if (model) {
      emit("change", model);
    }
  },
});

// 可用模型列表
const availableModels = computed(() => {
  return aiStore.modelsByCategory[props.category] || [];
});

// 选项列表
const options = computed<SelectOption[]>(() => {
  return availableModels.value.map((model) => ({
    label: model.name,
    value: model.modelId,
    model,
  }));
});

// 渲染标签
const renderLabel: SelectRenderLabel = (option) => {
  const model = option.model as AIModelInfo;
  return h(
    NSpace,
    { align: "center", size: "small" },
    {
      default: () => [
        h("span", null, model.name),
        model.isDefault
          ? h(
              NTag,
              { type: "success", size: "tiny" },
              { default: () => "默认" },
            )
          : null,
      ],
    },
  );
};

// 渲染选项
const renderOption: SelectRenderOption = ({ option }) => {
  const model = option.model as AIModelInfo;
  return h(
    NSpace,
    { vertical: true, size: "small", style: { padding: "4px 0" } },
    {
      default: () => [
        h(
          NSpace,
          {
            align: "center",
            justify: "space-between",
            style: { width: "100%" },
          },
          {
            default: () => [
              h("span", { style: { fontWeight: 500 } }, model.name),
              h(
                NSpace,
                { size: "small" },
                {
                  default: () => [
                    model.isDefault
                      ? h(
                          NTag,
                          { type: "success", size: "tiny" },
                          { default: () => "默认" },
                        )
                      : null,
                    h(
                      NTag,
                      { size: "tiny", type: "info" },
                      { default: () => model.provider },
                    ),
                  ],
                },
              ),
            ],
          },
        ),
        h(
          "span",
          { style: { fontSize: "12px", color: "#999" } },
          model.description,
        ),
        h(
          "span",
          { style: { fontSize: "12px", color: "#666" } },
          model.pricing.type === "per_token"
            ? `输入: ¥${model.pricing.inputPricePer1k}/1K tokens / 输出: ¥${model.pricing.outputPricePer1k}/1K tokens`
            : `¥${model.pricing.pricePerCall}/次`,
        ),
      ],
    },
  );
};

// 加载模型列表
const loadModels = async () => {
  await aiStore.fetchAvailableModels(props.category);
  // 如果没有选中模型，选择默认模型
  if (!selectedModelId.value && availableModels.value.length > 0) {
    const defaultModel =
      availableModels.value.find((m) => m.isDefault) ||
      availableModels.value[0];
    selectedModelId.value = defaultModel.modelId;
  }
};

onMounted(() => {
  loadModels();
});

watch(
  () => props.category,
  () => {
    loadModels();
  },
);
</script>

<template>
  <NSpin :show="loading">
    <NSelect
      v-model:value="selectedModelId"
      :options="options"
      :placeholder="placeholder"
      :render-label="renderLabel"
      :render-option="renderOption"
      filterable
    />
  </NSpin>
</template>
