<script setup lang="ts">
import { ref, computed } from "vue";
import {
  NInput,
  NSelect,
  NSlider,
  NSpace,
  NButton,
  NSpin,
  NAlert,
} from "naive-ui";
import { useAudioGenerationStore } from "@/stores/audioGeneration";
import { EMOTION_TYPE_DESCRIPTIONS } from "@pixaura/shared-types";

const props = defineProps({
  projectId: { type: String, required: true },
  speakerId: { type: String, required: true },
  speakerName: { type: String, default: "" },
});

const emit = defineEmits({
  success: (_taskId: string) => true,
  error: (_error: Error) => true,
});

const audioStore = useAudioGenerationStore();

const text = ref("");
const emotion = ref("neutral");
const speed = ref(1.0);
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

async function handleSubmit() {
  if (!canSubmit.value) return;

  try {
    const result = await audioStore.createTTS(props.projectId, {
      config: {
        text: text.value.trim(),
        speakerId: props.speakerId,
        emotion: emotion.value as any,
        speed: speed.value,
      },
      notifyWs: true,
    });
    emit("success", result.taskId);
    text.value = "";
  } catch (error) {
    emit("error", error as Error);
  }
}
</script>

<template>
  <div class="tts-panel">
    <NSpin :show="loading">
      <NSpace
        vertical
        size="large"
      >
        <div>
          <label class="label">配音文本</label>
          <NInput
            v-model:value="text"
            type="textarea"
            :rows="4"
            placeholder="请输入要转换为语音的文本（最多500字符）"
            :maxlength="500"
            show-count
          />
        </div>

        <div class="row">
          <div class="field">
            <label class="label">情绪</label>
            <NSelect
              v-model:value="emotion"
              :options="emotionOptions"
            />
          </div>

          <div class="field">
            <label class="label">语速: {{ speed.toFixed(1) }}x</label>
            <NSlider
              v-model:value="speed"
              :min="0.5"
              :max="2.0"
              :step="0.1"
            />
          </div>
        </div>

        <NAlert
          v-if="speakerName"
          type="info"
          :show-icon="false"
        >
          使用音色: {{ speakerName }}
        </NAlert>

        <NButton
          type="primary"
          block
          :disabled="!canSubmit"
          :loading="loading"
          @click="handleSubmit"
        >
          生成配音
        </NButton>
      </NSpace>
    </NSpin>
  </div>
</template>

<style scoped>
.tts-panel {
  padding: 16px;
}

.label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--text-color-base);
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.field {
  flex: 1;
}
</style>
