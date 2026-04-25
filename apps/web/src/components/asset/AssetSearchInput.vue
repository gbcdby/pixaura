<script setup lang="ts">
import { ref, computed, watch, h } from "vue";
import { NAutoComplete, NIcon, NEmpty, NTag } from "naive-ui";
import {
  SearchOutline,
  TimeOutline,
  TrendingUpOutline,
  PricetagOutline,
} from "@vicons/ionicons5";
import type { AssetSuggestionDto } from "@pixaura/shared-types";

interface Props {
  value: string;
  suggestions?: AssetSuggestionDto[];
  loading?: boolean;
  placeholder?: string;
  clearable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  suggestions: () => [],
  loading: false,
  placeholder: "搜索资产...",
  clearable: true,
});

const emit = defineEmits<{
  (e: "update:value", value: string): void;
  (e: "search", value: string): void;
  (e: "select", suggestion: AssetSuggestionDto): void;
  (e: "focus"): void;
  (e: "blur"): void;
}>();

// 本地输入值
const localValue = ref(props.value);

// 是否显示下拉
const showDropdown = ref(false);

// 监听外部值变化
watch(
  () => props.value,
  (newValue) => {
    localValue.value = newValue;
  },
);

// 搜索防抖
let searchTimeout: ReturnType<typeof setTimeout> | null = null;

// 处理输入
const handleInput = (value: string) => {
  localValue.value = value;
  emit("update:value", value);

  // 防抖搜索
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }

  searchTimeout = setTimeout(() => {
    if (value.trim()) {
      emit("search", value);
    }
  }, 300);
};

// 处理选择建议
const handleSelect = (value: string) => {
  localValue.value = value;
  emit("update:value", value);
  emit("search", value);

  // 查找对应的建议项
  const suggestion = props.suggestions.find((s) => s.text === value);
  if (suggestion) {
    emit("select", suggestion);
  }
};

// 处理聚焦
const handleFocus = () => {
  showDropdown.value = true;
  emit("focus");
};

// 处理失焦
const handleBlur = () => {
  // 延迟关闭下拉，以便点击选项
  setTimeout(() => {
    showDropdown.value = false;
  }, 200);
  emit("blur");
};

// 获取建议图标
const getSuggestionIcon = (type: AssetSuggestionDto["type"]) => {
  switch (type) {
    case "recent":
      return TimeOutline;
    case "tag":
      return PricetagOutline;
    case "name":
    default:
      return TrendingUpOutline;
  }
};

// 获取建议标签
const getSuggestionTag = (type: AssetSuggestionDto["type"]) => {
  switch (type) {
    case "recent":
      return "最近";
    case "tag":
      return "标签";
    case "name":
    default:
      return "热门";
  }
};

// 获取建议标签类型
const getSuggestionTagType = (
  type: AssetSuggestionDto["type"],
): "default" | "primary" | "success" | "warning" | "error" | "info" => {
  switch (type) {
    case "recent":
      return "info";
    case "tag":
      return "success";
    case "name":
    default:
      return "warning";
  }
};

// 自动完成选项
const autoCompleteOptions = computed(() => {
  if (!props.suggestions.length) {
    return [];
  }

  return props.suggestions.map((suggestion) => ({
    label: suggestion.text,
    value: suggestion.text,
    suggestion,
  }));
});

// 渲染选项
const renderOption = ({
  option,
}: {
  option: { label: string; value: string; suggestion: AssetSuggestionDto };
}) => {
  const suggestion = option.suggestion;
  const IconComponent = getSuggestionIcon(suggestion.type);
  const tagType = getSuggestionTagType(suggestion.type);
  const tagText = getSuggestionTag(suggestion.type);

  return h("div", { class: "suggestion-item" }, [
    h("div", { class: "suggestion-left" }, [
      h(
        NIcon,
        { size: 16, class: "suggestion-icon" },
        { default: () => h(IconComponent) },
      ),
      h("span", { class: "suggestion-text" }, option.label),
    ]),
    h("div", { class: "suggestion-right" }, [
      h(NTag, { size: "tiny", type: tagType }, { default: () => tagText }),
      ...(suggestion.count !== undefined
        ? [
            h(
              "span",
              { class: "suggestion-count" },
              `${suggestion.count} 个结果`,
            ),
          ]
        : []),
    ]),
  ]);
};
</script>

<template>
  <div class="asset-search-input">
    <n-auto-complete
      :value="localValue"
      :options="autoCompleteOptions"
      :loading="loading"
      :placeholder="placeholder"
      :clearable="clearable"
      :render-label="renderOption"
      @update:value="handleInput"
      @select="handleSelect"
      @focus="handleFocus"
      @blur="handleBlur"
    >
      <template #prefix>
        <n-icon><SearchOutline /></n-icon>
      </template>

      <template #empty>
        <n-empty
          v-if="localValue && !loading"
          description="无匹配结果"
          size="small"
        />
        <n-empty
          v-else-if="!localValue && !loading"
          description="输入关键词搜索"
          size="small"
        />
      </template>
    </n-auto-complete>
  </div>
</template>

<style scoped lang="scss">
.asset-search-input {
  width: 100%;

  :deep(.n-auto-complete) {
    width: 100%;
  }
}

.suggestion-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  width: 100%;

  .suggestion-left {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;

    .suggestion-icon {
      color: #999;
      flex-shrink: 0;
    }

    .suggestion-text {
      font-size: 14px;
      color: #333;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .suggestion-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;

    .suggestion-count {
      font-size: 12px;
      color: #999;
    }
  }
}
</style>
