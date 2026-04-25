<script setup lang="ts">
import { computed } from "vue";
import { NRadioGroup, NRadioButton, NTooltip, NIcon } from "naive-ui";
import { InformationCircleOutline, WarningOutline } from "@vicons/ionicons5";

/**
 * VideoModeSelector - 视频生成模式选择器
 * 支持 audio_reference（音频驱动）、lip_sync（对口型）、video_only（纯视频）三种模式
 * 包含可用条件校验、tooltip 提示、默认值自动切换逻辑
 */

type VideoMode = "audio_reference" | "lip_sync" | "video_only";
type ReferenceMode = "single_reference" | "multi_reference";

interface Props {
  /** 当前选中的 videoMode */
  modelValue: VideoMode;
  /** 参考模式（分镜组级别） */
  referenceMode: ReferenceMode;
  /** 是否有对话 */
  hasDialogue?: boolean;
  /** 是否有音频 */
  hasAudio?: boolean;
  /** 当前视频模型是否支持音频参考（max_reference_audios > 0） */
  modelSupportsAudio?: boolean;
  /** 是否只读模式 */
  disabled?: boolean;
  /** 对话列表是否全是角色对话（无旁白） */
  hasOnlyCharacterDialogue?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  hasDialogue: false,
  hasAudio: false,
  modelSupportsAudio: false,
  disabled: false,
  hasOnlyCharacterDialogue: false,
});

const emit = defineEmits<{
  (e: "update:modelValue", value: VideoMode): void;
}>();

// 模式选项定义
const modeOptions: Array<{
  value: VideoMode;
  label: string;
  description: string;
}> = [
  {
    value: "lip_sync",
    label: "对口型",
    description: "使用分镜图+音频+mask生成对口型视频",
  },
  {
    value: "audio_reference",
    label: "音频驱动",
    description: "音频驱动视频节奏/情绪",
  },
  {
    value: "video_only",
    label: "纯视频",
    description: "纯视频生成，无音频影响",
  },
];

// 计算各模式的可用状态
const lipSyncAvailable = computed(() => {
  // 对口型需要：单参考模式 + 有对话 + 全是角色对话（无旁白）
  return (
    props.referenceMode === "single_reference" &&
    props.hasDialogue &&
    props.hasOnlyCharacterDialogue
  );
});

const audioReferenceAvailable = computed(() => {
  // 音频驱动需要：多参考模式 + 模型支持音频参考
  return (
    props.referenceMode === "multi_reference" &&
    props.modelSupportsAudio
  );
});

const videoOnlyAvailable = computed(() => true); // 纯视频始终可用

// 不可用原因提示
const lipSyncUnavailableReason = computed(() => {
  if (props.referenceMode !== "single_reference") {
    return "对口型需要「分镜图生视频」模式";
  }
  if (!props.hasDialogue) {
    return "对口型需要存在对话";
  }
  if (!props.hasOnlyCharacterDialogue) {
    return "对口型模式要求对话列表中不包含旁白";
  }
  return "";
});

const audioReferenceUnavailableReason = computed(() => {
  if (props.referenceMode !== "multi_reference") {
    return "音频参考仅支持「多参考生视频」模式";
  }
  if (!props.modelSupportsAudio) {
    return "当前视频模型不支持音频参考";
  }
  return "";
});

// 当前选中模式是否可用
const currentModeAvailable = computed(() => {
  switch (props.modelValue) {
    case "lip_sync":
      return lipSyncAvailable.value;
    case "audio_reference":
      return audioReferenceAvailable.value;
    case "video_only":
      return videoOnlyAvailable.value;
    default:
      return true;
  }
});

// 当前模式不可用原因
const currentUnavailableReason = computed(() => {
  switch (props.modelValue) {
    case "lip_sync":
      return lipSyncUnavailableReason.value;
    case "audio_reference":
      return audioReferenceUnavailableReason.value;
    default:
      return "";
  }
});

// 自动切换到可用模式 - 已删除，用户决策：完全去除自动切换逻辑
// watch(...)

// 处理模式切换
function handleModeChange(value: VideoMode) {
  emit("update:modelValue", value);
}

// 获取模式的禁用状态
function isModeDisabled(mode: VideoMode): boolean {
  switch (mode) {
    case "lip_sync":
      return !lipSyncAvailable.value;
    case "audio_reference":
      return !audioReferenceAvailable.value;
    case "video_only":
      return false;
    default:
      return false;
  }
}

// 获取模式的 tooltip 提示
function getModeTooltip(mode: VideoMode): string {
  switch (mode) {
    case "lip_sync":
      if (!lipSyncAvailable.value) {
        return lipSyncUnavailableReason.value;
      }
      return "对口型：使用分镜图+音频+mask生成对口型视频";
    case "audio_reference":
      if (!audioReferenceAvailable.value) {
        return audioReferenceUnavailableReason.value;
      }
      return "音频驱动：音频驱动视频节奏/情绪";
    case "video_only":
      return "纯视频：纯视频生成，无音频影响";
    default:
      return "";
  }
}
</script>

<template>
  <div class="video-mode-selector">
    <div class="selector-header">
      <span class="selector-label">视频模式</span>
      <n-tooltip v-if="!currentModeAvailable && currentUnavailableReason">
        <template #trigger>
          <n-icon
            color="#f0a020"
            size="14"
          >
            <WarningOutline />
          </n-icon>
        </template>
        {{ currentUnavailableReason }}
      </n-tooltip>
    </div>

    <n-radio-group
      :value="modelValue"
      :disabled="disabled"
      class="mode-radio-group"
      @update:value="handleModeChange"
    >
      <template
        v-for="option in modeOptions"
        :key="option.value"
      >
        <n-tooltip
          :disabled="!isModeDisabled(option.value) || disabled"
          placement="top"
        >
          <template #trigger>
            <n-radio-button
              :value="option.value"
              :disabled="isModeDisabled(option.value) || disabled"
              class="mode-radio-button"
            >
              {{ option.label }}
            </n-radio-button>
          </template>
          {{ getModeTooltip(option.value) }}
        </n-tooltip>
      </template>
    </n-radio-group>

    <!-- 当前模式说明 -->
    <div
      v-if="!disabled"
      class="mode-description"
    >
      <n-icon
        size="12"
        color="#888"
      >
        <InformationCircleOutline />
      </n-icon>
      <span class="description-text">
        <template v-if="modelValue === 'lip_sync'">
          使用分镜图 + 音频 + mask 生成对口型视频
        </template>
        <template v-else-if="modelValue === 'audio_reference'">
          音频驱动视频节奏和情绪
        </template>
        <template v-else> 纯视频生成，无音频影响 </template>
      </span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.video-mode-selector {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.selector-header {
  display: flex;
  align-items: center;
  gap: 4px;
}

.selector-label {
  font-size: 12px;
  font-weight: 500;
  color: #666;
}

.mode-radio-group {
  display: flex;
  gap: 0;

  :deep(.n-radio-button) {
    &:first-child .n-radio-button__button {
      border-radius: 4px 0 0 4px;
    }
    &:last-child .n-radio-button__button {
      border-radius: 0 4px 4px 0;
    }
  }

  :deep(.n-radio-button__button) {
    padding: 4px 10px;
    font-size: 12px;
  }

  :deep(.n-radio-button--disabled) {
    opacity: 0.5;

    .n-radio-button__button {
      background: #f5f5f5;
    }
  }
}

.mode-description {
  display: flex;
  align-items: center;
  gap: 4px;

  .description-text {
    font-size: 11px;
    color: #888;
  }
}
</style>
