<script setup lang="ts">
/**
 * TTS 指令输入组件
 * 用于输入千问 TTS 的指令控制文本
 * 支持预设模板选择和字数统计
 */
import { ref, computed, watch } from "vue";
import { NInput, NSelect, NTooltip, NIcon } from "naive-ui";
import { HelpCircleOutline } from "@vicons/ionicons5";
import type {
  InstructionsInputProps,
  TTSInstructionTemplate,
} from "./tts-voice.types";
import type { SelectOption } from "naive-ui";

const props = withDefaults(defineProps<InstructionsInputProps>(), {
  maxLength: 1600,
  placeholder: "输入指令控制语音风格、情感、语速等...",
  disabled: false,
});

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

// 内部文本值
const innerValue = ref(props.modelValue || "");

// 监听外部变化
watch(
  () => props.modelValue,
  (val) => {
    innerValue.value = val || "";
  },
);

// 字数统计
const charCount = computed(() => innerValue.value.length);
const isOverLimit = computed(() => charCount.value > props.maxLength);

// 模板选项类型
interface TemplateOption extends SelectOption {
  template?: TTSInstructionTemplate;
}

// 预设模板列表（后续从 API 加载）
const templateOptions = computed<TemplateOption[]>(() => {
  // TODO: 从 API 加载模板
  const defaultTemplates: TTSInstructionTemplate[] = [
    {
      id: "calm",
      name: "平静自然",
      category: "情感",
      content: "语调平静自然，语速适中",
      isSystem: true,
    },
    {
      id: "excited",
      name: "兴奋激动",
      category: "情感",
      content: "语调兴奋，语速稍快，带有激情",
      isSystem: true,
    },
    {
      id: "sad",
      name: "悲伤低沉",
      category: "情感",
      content: "语调低沉悲伤，语速缓慢",
      isSystem: true,
    },
    {
      id: "angry",
      name: "愤怒激烈",
      category: "情感",
      content: "语调激烈，带有愤怒情绪",
      isSystem: true,
    },
    {
      id: "narration",
      name: "旁白叙述",
      category: "风格",
      content: "旁白风格，叙述清晰，语速均匀",
      isSystem: true,
    },
  ];

  return [
    { label: "选择模板...", value: "" },
    ...defaultTemplates.map((t) => ({
      label: t.name,
      value: t.id,
      template: t,
    })),
  ];
});

// 处理文本输入
function handleInput(value: string) {
  innerValue.value = value;
  emit("update:modelValue", value);
}

// 选择模板
function handleTemplateSelect(id: string) {
  if (!id) return;

  const option = templateOptions.value.find((o) => o.value === id);
  if (option?.template) {
    // 追加模板内容到现有文本
    const newValue = innerValue.value
      ? `${innerValue.value}，${option.template.content}`
      : option.template.content;
    innerValue.value = newValue;
    emit("update:modelValue", newValue);
  }
}
</script>

<template>
  <div class="instructions-input">
    <!-- 顶部工具栏 -->
    <div class="instructions-toolbar">
      <n-select
        :options="templateOptions"
        placeholder="选择模板"
        aria-label="指令模板"
        size="small"
        style="width: 160px"
        :disabled="disabled"
        :consistent-menu-width="false"
        @update:value="handleTemplateSelect"
      />

      <n-tooltip trigger="hover">
        <template #trigger>
          <n-icon
            size="16"
            class="help-icon"
          >
            <HelpCircleOutline />
          </n-icon>
        </template>
        <div class="help-content">
          <p><strong>指令说明：</strong></p>
          <p>可通过自然语言描述控制语音效果：</p>
          <ul>
            <li>语速控制：语速快/慢/适中</li>
            <li>情感控制：开心/悲伤/愤怒/平静</li>
            <li>风格控制：温柔/严肃/活泼</li>
            <li>停顿控制：句尾停顿/段落停顿</li>
          </ul>
        </div>
      </n-tooltip>
    </div>

    <!-- 文本输入区 -->
    <n-input
      :value="innerValue"
      type="textarea"
      :placeholder="placeholder"
      aria-label="TTS指令"
      :maxlength="maxLength"
      :disabled="disabled"
      :status="isOverLimit ? 'error' : undefined"
      show-count
      :rows="3"
      autosize
      @update:value="handleInput"
    />

    <!-- 字数统计 -->
    <div
      class="char-count"
      :class="{ 'over-limit': isOverLimit }"
    >
      {{ charCount }} / {{ maxLength }}
    </div>
  </div>
</template>

<style scoped lang="scss">
.instructions-input {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .instructions-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;

    .help-icon {
      color: #999;
      cursor: help;

      &:hover {
        color: #666;
      }
    }
  }

  .char-count {
    font-size: 12px;
    color: #999;
    text-align: right;

    &.over-limit {
      color: #d03050;
    }
  }

  .help-content {
    max-width: 260px;

    p {
      margin: 0 0 4px;
    }

    ul {
      margin: 0;
      padding-left: 16px;
    }

    li {
      margin: 2px 0;
    }
  }
}
</style>
