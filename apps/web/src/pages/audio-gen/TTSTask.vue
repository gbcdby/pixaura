<script setup lang="ts">
import { ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  NPageHeader,
  NCard,
  NInput,
  NInputNumber,
  NSelect,
  NSlider,
  NSpace,
  NButton,
  NSpin,
  NAlert,
  NDivider,
  useMessage,
} from "naive-ui";
import { storeToRefs } from "pinia";
import { useAudioGenerationStore } from "@/stores/audioGeneration";
import { EMOTION_TYPE_DESCRIPTIONS } from "@pixaura/shared-types";
import AudioWaveform from "@/modules/audio-gen/components/AudioWaveform.vue";

const route = useRoute();
const router = useRouter();
const message = useMessage();
const audioStore = useAudioGenerationStore();

const { ttsLoading, currentTask } = storeToRefs(audioStore);

const projectId = computed(() => route.params.id as string);

// 表单数据
const text = ref("");
const speakerId = ref("");
const emotion = ref("neutral");
const speed = ref(1.0);
const targetDuration = ref<number | null>(null);

// 模拟音色列表（实际应从角色store获取）
const voiceOptions = ref([
  { label: "角色A - 温柔女声", value: "char_a" },
  { label: "角色B - 成熟男声", value: "char_b" },
  { label: "旁白 - 标准普通话", value: "narrator" },
]);

// 情绪选项
const emotionOptions = Object.entries(EMOTION_TYPE_DESCRIPTIONS).map(
  ([key, value]) => ({
    label: `${value.emoji} ${value.label}`,
    value: key,
  }),
);

// 是否可提交
const canSubmit = computed(() => {
  return (
    text.value.trim().length > 0 && text.value.length <= 500 && speakerId.value
  );
});

// 字符计数
const charCount = computed(() => text.value.length);

async function handleSubmit() {
  if (!canSubmit.value) return;

  try {
    const result = await audioStore.createTTS(projectId.value, {
      config: {
        text: text.value.trim(),
        speakerId: speakerId.value,
        emotion: emotion.value as any,
        speed: speed.value,
        targetDuration: targetDuration.value || undefined,
      },
      notifyWs: true,
    });
    message.success(`TTS任务已创建: ${result.taskId}`);
    // 清空表单
    text.value = "";
    targetDuration.value = null;
  } catch (error: any) {
    message.error(error.message || "创建任务失败");
  }
}

function handleBack() {
  router.push(`/projects/${projectId.value}/audio-gen/tasks`);
}

function handleReset() {
  text.value = "";
  speakerId.value = "";
  emotion.value = "neutral";
  speed.value = 1.0;
  targetDuration.value = null;
}
</script>

<template>
  <div class="tts-task-page">
    <NPageHeader
      title="TTS配音生成"
      subtitle="将文本转换为语音，支持情绪、语速调节"
      @back="handleBack"
    />

    <div class="content-grid">
      <!-- 左侧：配置表单 -->
      <NCard
        title="配音配置"
        class="config-card"
      >
        <NSpin :show="ttsLoading">
          <NSpace
            vertical
            size="large"
          >
            <!-- 音色选择 -->
            <div>
              <label class="form-label">选择音色 <span class="required">*</span></label>
              <NSelect
                v-model:value="speakerId"
                :options="voiceOptions"
                placeholder="请选择角色音色"
              />
            </div>

            <!-- 文本输入 -->
            <div>
              <label class="form-label">
                配音文本 <span class="required">*</span>
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
                :rows="6"
                placeholder="请输入要转换为语音的文本（最多500字符）"
                :maxlength="500"
                show-count
              />
            </div>

            <NDivider />

            <!-- 高级配置 -->
            <div class="advanced-config">
              <label class="form-label">高级配置</label>

              <div class="config-row">
                <div class="config-item">
                  <label class="sub-label">情绪</label>
                  <NSelect
                    v-model:value="emotion"
                    :options="emotionOptions"
                    style="width: 150px"
                  />
                </div>

                <div class="config-item">
                  <label class="sub-label">语速: {{ speed.toFixed(1) }}x</label>
                  <NSlider
                    v-model:value="speed"
                    :min="0.5"
                    :max="2.0"
                    :step="0.1"
                    style="width: 150px"
                  />
                </div>
              </div>

              <div class="config-row">
                <div class="config-item">
                  <label class="sub-label">目标时长（秒，可选）</label>
                  <NInputNumber
                    v-model:value="targetDuration"
                    placeholder="自动计算"
                    style="width: 150px"
                    :min="1"
                    :max="300"
                  />
                </div>
              </div>
            </div>

            <!-- 提示信息 -->
            <NAlert
              type="info"
              :show-icon="false"
            >
              设置目标时长后，系统会自动调整语速以匹配指定时长
            </NAlert>

            <!-- 操作按钮 -->
            <NSpace justify="end">
              <NButton @click="handleReset">
                重置
              </NButton>
              <NButton
                type="primary"
                :disabled="!canSubmit"
                :loading="ttsLoading"
                @click="handleSubmit"
              >
                生成配音
              </NButton>
            </NSpace>
          </NSpace>
        </NSpin>
      </NCard>

      <!-- 右侧：预览和历史 -->
      <div class="right-panel">
        <NCard
          title="生成结果"
          class="result-card"
        >
          <div
            v-if="currentTask && currentTask.type === 'tts'"
            class="result-content"
          >
            <div class="result-info">
              <div class="info-item">
                <span class="label">任务状态:</span>
                <span class="value">{{ currentTask.status }}</span>
              </div>
              <div class="info-item">
                <span class="label">进度:</span>
                <span class="value">{{ currentTask.progress.percentage }}%</span>
              </div>
            </div>

            <!-- 音频预览 -->
            <div
              v-if="currentTask.outputs && currentTask.outputs.length > 0"
              class="audio-preview"
            >
              <AudioWaveform
                v-for="output in currentTask.outputs"
                :key="output.id"
                :url="output.file.url"
                :duration="output.file.duration"
                :active="true"
              />
            </div>

            <NEmpty
              v-else
              description="暂无生成结果"
            />
          </div>
          <NEmpty
            v-else
            description="提交任务后将在此显示结果"
          />
        </NCard>

        <NCard
          title="使用提示"
          class="tips-card"
        >
          <ul class="tips-list">
            <li>单次最多输入500个字符</li>
            <li>支持中文、英文、数字</li>
            <li>不同情绪会影响语调表现</li>
            <li>语速范围0.5x-2.0x</li>
            <li>设置目标时长可自动调整语速</li>
          </ul>
        </NCard>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tts-task-page {
  padding: 24px;
}

.content-grid {
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 24px;
  margin-top: 24px;
}

.config-card {
  min-height: 500px;
}

.form-label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--text-color-base);
}

.required {
  color: #d03050;
  margin-left: 4px;
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

.advanced-config {
  background: #f8f8f8;
  padding: 16px;
  border-radius: 8px;
}

.config-row {
  display: flex;
  gap: 24px;
  margin-top: 12px;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sub-label {
  font-size: 13px;
  color: #666;
}

.right-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.result-card {
  flex: 1;
}

.result-content {
  min-height: 200px;
}

.result-info {
  margin-bottom: 16px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #eee;
}

.info-item .label {
  color: #666;
}

.info-item .value {
  font-weight: 500;
}

.audio-preview {
  margin-top: 16px;
}

.tips-card {
  background: #f0f9ff;
}

.tips-list {
  margin: 0;
  padding-left: 20px;
  color: #666;
  font-size: 13px;
  line-height: 2;
}

@media (max-width: 1024px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
}
</style>
