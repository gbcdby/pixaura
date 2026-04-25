<script setup lang="ts">
import { ref, computed } from "vue";
import {
  NInput,
  NInputNumber,
  NSelect,
  NSlider,
  NSpace,
  NButton,
  NSpin,
  NAlert,
  NCard,
} from "naive-ui";
import { useAudioGenerationStore } from "@/stores/audioGeneration";
import { EMOTION_TYPE_DESCRIPTIONS } from "@pixaura/shared-types";

const props = defineProps<{
  projectId: string;
  speakerId: string;
  speakerName?: string;
  defaultText?: string;
  compact?: boolean;
}>();

const emit = defineEmits<{
  success: [taskId: string];
  error: [error: Error];
}>();

const audioStore = useAudioGenerationStore();

const text = ref(props.defaultText || "");
const emotion = ref("neutral");
const speed = ref(1.0);
const targetDuration = ref<number | null>(null);

const loading = computed(() => audioStore.ttsLoading);

const emotionOptions = Object.entries(EMOTION_TYPE_DESCRIPTIONS).map(
  ([key, value]) => ({
    label: `${value.emoji} ${value.label}`,
    value: key,
  }),
);

const canSubmit = computed(() => {
  return text.value.trim().length > 0 && text.value.length <= 500;
});

const charCount = computed(() => text.value.length);

async function handleSubmit() {
  if (!canSubmit.value) return;

  try {
    const result = await audioStore.createTTS(props.projectId, {
      config: {
        text: text.value.trim(),
        speakerId: props.speakerId,
        emotion: emotion.value as any,
        speed: speed.value,
        targetDuration: targetDuration.value || undefined,
      },
      notifyWs: true,
    });
    emit("success", result.taskId);
    text.value = "";
    targetDuration.value = null;
  } catch (error) {
    emit("error", error as Error);
  }
}

function handleReset() {
  text.value = "";
  emotion.value = "neutral";
  speed.value = 1.0;
  targetDuration.value = null;
}
</script>

<template>
  <NCard
    :title="compact ? undefined : 'TTS配音'"
    :bordered="!compact"
    :embedded="compact"
    size="small"
  >
    <NSpin :show="loading">
      <NSpace
        vertical
        :size="compact ? 'small' : 'medium'"
      >
        <!-- 文本输入 -->
        <div>
          <label
            class="label"
            :class="{ compact }"
          >
            配音文本
            <span
              class="char-count"
              :class="{ warning: charCount > 450 }"
            >
              {{ charCount }}/500
            </span>
          </label>
          <NInput
            v-model:value="text"
            type="textarea"
            :rows="compact ? 3 : 4"
            placeholder="请输入要转换为语音的文本"
            :maxlength="500"
            size="small"
          />
        </div>

        <!-- 配置行 -->
        <div
          class="config-row"
          :class="{ compact }"
        >
          <div class="field">
            <label
              class="label"
              :class="{ compact }"
            >情绪</label>
            <NSelect
              v-model:value="emotion"
              :options="emotionOptions"
              size="small"
              style="width: 130px"
            />
          </div>

          <div class="field">
            <label
              class="label"
              :class="{ compact }"
            >语速 {{ speed.toFixed(1) }}x</label>
            <NSlider
              v-model:value="speed"
              :min="0.5"
              :max="2.0"
              :step="0.1"
              style="width: 120px"
            />
          </div>

          <div
            v-if="!compact"
            class="field"
          >
            <label class="label">目标时长</label>
            <NInputNumber
              v-model:value="targetDuration"
              placeholder="可选"
              size="small"
              style="width: 80px"
              :min="1"
            />
          </div>
        </div>

        <!-- 音色提示 -->
        <NAlert
          v-if="speakerName"
          type="info"
          :show-icon="false"
          size="small"
        >
          使用音色: {{ speakerName }}
        </NAlert>

        <!-- 操作按钮 -->
        <NSpace
          justify="end"
          :size="compact ? 'small' : 'medium'"
        >
          <NButton
            size="small"
            @click="handleReset"
          >
            重置
          </NButton>
          <NButton
            type="primary"
            size="small"
            :disabled="!canSubmit"
            :loading="loading"
            @click="handleSubmit"
          >
            生成
          </NButton>
        </NSpace>
      </NSpace>
    </NSpin>
  </NCard>
</template>

<style scoped>
.label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  font-size: 14px;
  color: var(--text-color-base);
}

.label.compact {
  font-size: 12px;
  margin-bottom: 4px;
}

.char-count {
  float: right;
  font-size: 12px;
  color: #999;
  font-weight: normal;
}

.char-count.warning {
  color: #f0a020;
}

.config-row {
  display: flex;
  gap: 16px;
}

.config-row.compact {
  gap: 12px;
}

.field {
  display: flex;
  flex-direction: column;
}
</style>
