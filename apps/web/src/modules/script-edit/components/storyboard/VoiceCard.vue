<script setup lang="ts">
/**
 * 音色卡片组件
 * 用于展示单个音色信息，支持试听和选择
 */
import { NCard, NButton, NIcon, NTag, NSpin } from "naive-ui";
import { PlayCircle, StopCircle, CheckmarkCircle } from "@vicons/ionicons5";
import type { VoiceCardProps, TTSVoice } from "./tts-voice.types";

const props = withDefaults(defineProps<VoiceCardProps>(), {
  disabled: false,
  playing: false,
});

const emit = defineEmits<{
  (e: "select", voice: TTSVoice): void;
  (e: "preview", voice: TTSVoice): void;
}>();

// 获取性别标签颜色
function getGenderColor(
  gender: string,
): "error" | "info" | "warning" | "success" | "default" {
  const colorMap: Record<
    string,
    "error" | "info" | "warning" | "success" | "default"
  > = {
    female: "error",
    male: "info",
    child: "warning",
    dialect: "success",
  };
  return colorMap[gender] || "default";
}

// 获取性别标签文本
function getGenderLabel(gender: string): string {
  const labelMap: Record<string, string> = {
    female: "女声",
    male: "男声",
    child: "童声",
    dialect: "方言",
  };
  return labelMap[gender] || gender;
}

// 点击卡片选择
function handleClick() {
  if (!props.disabled) {
    emit("select", props.voice);
  }
}

// 点击试听按钮
function handlePreview(e: Event) {
  e.stopPropagation();
  if (!props.disabled) {
    emit("preview", props.voice);
  }
}
</script>

<template>
  <div
    class="voice-card"
    :class="{
      'voice-card--selected': selected,
      'voice-card--disabled': disabled,
    }"
    @click="handleClick"
  >
    <n-card
      size="small"
      hoverable
      :bordered="true"
      class="voice-card-inner"
    >
      <div class="voice-card-content">
        <!-- 音色名称 -->
        <div class="voice-name">
          <span class="name-cn">{{ voice.name }}</span>
          <span
            v-if="voice.nameEn"
            class="name-en"
          >{{ voice.nameEn }}</span>
        </div>

        <!-- 标签区域 -->
        <div class="voice-tags">
          <n-tag
            :type="getGenderColor(voice.gender)"
            size="small"
            bordered
          >
            {{ getGenderLabel(voice.gender) }}
          </n-tag>
          <n-tag
            v-if="voice.style"
            type="default"
            size="small"
            bordered
          >
            {{ voice.style }}
          </n-tag>
        </div>

        <!-- 操作区域 -->
        <div class="voice-actions">
          <!-- 试听按钮 -->
          <n-button
            v-if="voice.previewAudioUrl"
            text
            size="small"
            :disabled="disabled"
            @click="handlePreview"
          >
            <template #icon>
              <n-spin
                v-if="playing"
                size="small"
              />
              <n-icon v-else>
                <StopCircle v-if="playing" />
                <PlayCircle v-else />
              </n-icon>
            </template>
            {{ playing ? "停止" : "试听" }}
          </n-button>

          <!-- 选中标记 -->
          <div
            v-if="selected"
            class="selected-mark"
          >
            <n-icon
              size="20"
              color="#18a058"
            >
              <CheckmarkCircle />
            </n-icon>
          </div>
        </div>
      </div>
    </n-card>
  </div>
</template>

<style scoped lang="scss">
.voice-card {
  cursor: pointer;
  transition: all 0.2s ease;

  &--disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  &--selected {
    .voice-card-inner {
      border-color: #18a058;
      box-shadow: 0 0 0 2px rgba(24, 160, 88, 0.2);
    }
  }

  .voice-card-inner {
    height: 100%;
  }

  .voice-card-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .voice-name {
    display: flex;
    flex-direction: column;
    gap: 2px;

    .name-cn {
      font-size: 14px;
      font-weight: 500;
      color: #333;
    }

    .name-en {
      font-size: 12px;
      color: #999;
    }
  }

  .voice-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .voice-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: auto;
    padding-top: 8px;
    border-top: 1px solid #f0f0f0;
  }

  .selected-mark {
    display: flex;
    align-items: center;
  }
}
</style>
