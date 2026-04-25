<script setup lang="ts">
import { ref, computed } from "vue";
import {
  NCard,
  NList,
  NListItem,
  NButton,
  NTag,
  NSpace,
  NEmpty,
  NSpin,
} from "naive-ui";
import { AUDIO_TRACK_TYPE_DESCRIPTIONS } from "@pixaura/shared-types";
import type { AudioTrackType } from "@pixaura/shared-types";

// 模拟音色数据
const voiceList = ref([
  {
    id: "voice-1",
    name: "温柔女声",
    gender: "female",
    language: "zh-CN",
    previewUrl: "https://example.com/preview1.mp3",
    tags: ["温柔", "甜美"],
  },
  {
    id: "voice-2",
    name: "成熟男声",
    gender: "male",
    language: "zh-CN",
    previewUrl: "https://example.com/preview2.mp3",
    tags: ["稳重", "磁性"],
  },
  {
    id: "voice-3",
    name: "活泼女声",
    gender: "female",
    language: "zh-CN",
    previewUrl: "https://example.com/preview3.mp3",
    tags: ["活泼", "年轻"],
  },
  {
    id: "voice-4",
    name: "标准旁白",
    gender: "male",
    language: "zh-CN",
    previewUrl: "https://example.com/preview4.mp3",
    tags: ["标准", "专业"],
  },
  {
    id: "voice-5",
    name: "英文女声",
    gender: "female",
    language: "en-US",
    previewUrl: "https://example.com/preview5.mp3",
    tags: ["英语", "自然"],
  },
]);

const props = defineProps<{
  modelValue?: string;
  trackType?: AudioTrackType;
  loading?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
  select: [voiceId: string, voiceName: string];
}>();

const selectedVoiceId = computed({
  get: () => props.modelValue || "",
  set: (val) => emit("update:modelValue", val),
});

const playingVoiceId = ref<string | null>(null);

const trackTypeLabel = computed(() => {
  if (!props.trackType) return "";
  return (
    AUDIO_TRACK_TYPE_DESCRIPTIONS[props.trackType]?.label || props.trackType
  );
});

function handleSelect(voice: (typeof voiceList.value)[0]) {
  selectedVoiceId.value = voice.id;
  emit("select", voice.id, voice.name);
}

function togglePreview(voiceId: string, event: Event) {
  event.stopPropagation();
  if (playingVoiceId.value === voiceId) {
    playingVoiceId.value = null;
  } else {
    playingVoiceId.value = voiceId;
    // 3秒后停止播放状态
    setTimeout(() => {
      if (playingVoiceId.value === voiceId) {
        playingVoiceId.value = null;
      }
    }, 3000);
  }
}

function getGenderType(gender: string): "success" | "warning" | "default" {
  if (gender === "male") return "success";
  if (gender === "female") return "warning";
  return "default";
}

function getGenderLabel(gender: string): string {
  if (gender === "male") return "男声";
  if (gender === "female") return "女声";
  return "未知";
}
</script>

<template>
  <NCard
    :title="trackTypeLabel ? `${trackTypeLabel}音色选择` : '音色选择'"
    size="small"
    class="voice-selector"
  >
    <NSpin :show="loading">
      <NList
        v-if="voiceList.length > 0"
        hoverable
        clickable
        bordered
      >
        <NListItem
          v-for="voice in voiceList"
          :key="voice.id"
          :class="{ selected: selectedVoiceId === voice.id }"
          @click="handleSelect(voice)"
        >
          <div class="voice-item">
            <div class="voice-info">
              <div class="voice-header">
                <span class="voice-name">{{ voice.name }}</span>
                <NTag
                  :type="getGenderType(voice.gender)"
                  size="small"
                  round
                >
                  {{ getGenderLabel(voice.gender) }}
                </NTag>
                <NTag
                  v-if="voice.language !== 'zh-CN'"
                  type="info"
                  size="small"
                >
                  {{ voice.language }}
                </NTag>
              </div>
              <div class="voice-tags">
                <NTag
                  v-for="tag in voice.tags"
                  :key="tag"
                  size="tiny"
                  bordered
                >
                  {{ tag }}
                </NTag>
              </div>
            </div>
            <NSpace>
              <NButton
                text
                size="small"
                :type="playingVoiceId === voice.id ? 'primary' : 'default'"
                @click="togglePreview(voice.id, $event)"
              >
                {{ playingVoiceId === voice.id ? "⏸ 停止" : "▶ 试听" }}
              </NButton>
              <NButton
                v-if="selectedVoiceId === voice.id"
                type="success"
                size="small"
                disabled
              >
                已选
              </NButton>
            </NSpace>
          </div>
        </NListItem>
      </NList>
      <NEmpty
        v-else
        description="暂无可用音色"
      />
    </NSpin>
  </NCard>
</template>

<style scoped>
.voice-selector :deep(.n-list-item) {
  cursor: pointer;
  transition: all 0.2s;
}

.voice-selector :deep(.n-list-item.selected) {
  background-color: #e6f7e6;
  border-left: 3px solid #18a058;
}

.voice-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}

.voice-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.voice-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.voice-name {
  font-weight: 500;
  font-size: 14px;
  color: var(--text-color-base);
}

.voice-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

@media (max-width: 640px) {
  .voice-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
}
</style>
