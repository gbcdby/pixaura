<script setup lang="ts">
import { ref, computed } from "vue";
import { NCard, NButton, NTag, NSpace, NIcon } from "naive-ui";
import {
  PlayCircleOutline,
  PauseCircleOutline,
  CheckmarkCircle,
  TimeOutline,
  MusicalNoteOutline,
} from "@vicons/ionicons5";
import { EMOTION_TYPE_DESCRIPTIONS } from "@pixaura/shared-types";

interface BGMItem {
  id: string;
  title: string;
  artist: string;
  duration: number;
  emotion: string;
  style: string;
  tempo: number;
  url: string;
  cover?: string;
}

const props = defineProps<{
  bgm: BGMItem;
  selected?: boolean;
}>();

const emit = defineEmits<{
  select: [bgmId: string];
  play: [bgmId: string];
}>();

const isPlaying = ref(false);

const emotionDesc = computed(() => {
  return EMOTION_TYPE_DESCRIPTIONS[
    props.bgm.emotion as keyof typeof EMOTION_TYPE_DESCRIPTIONS
  ];
});

const formattedDuration = computed(() => {
  const minutes = Math.floor(props.bgm.duration / 60);
  const seconds = props.bgm.duration % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
});

function handleClick() {
  emit("select", props.bgm.id);
}

function togglePlay(event: Event) {
  event.stopPropagation();
  isPlaying.value = !isPlaying.value;
  if (isPlaying.value) {
    emit("play", props.bgm.id);
    // 模拟播放3秒后停止
    setTimeout(() => {
      isPlaying.value = false;
    }, 3000);
  }
}
</script>

<template>
  <NCard
    :class="['bgm-card', { selected }]"
    size="small"
    hoverable
    @click="handleClick"
  >
    <div class="bgm-content">
      <!-- 封面/图标区域 -->
      <div class="bgm-cover">
        <div class="cover-placeholder">
          <NIcon
            :component="MusicalNoteOutline"
            size="32"
          />
        </div>
        <div
          v-if="selected"
          class="selected-badge"
        >
          <NIcon
            :component="CheckmarkCircle"
            size="24"
            color="#18a058"
          />
        </div>
      </div>

      <!-- 信息区域 -->
      <div class="bgm-info">
        <div class="bgm-title-row">
          <span class="bgm-title">{{ bgm.title }}</span>
        </div>
        <div class="bgm-artist">
          {{ bgm.artist }}
        </div>

        <div class="bgm-meta">
          <NSpace
            size="small"
            wrap
          >
            <NTag
              v-if="emotionDesc"
              size="tiny"
              type="info"
            >
              {{ emotionDesc.emoji }} {{ emotionDesc.label }}
            </NTag>
            <NTag size="tiny">
              {{ bgm.style }}
            </NTag>
            <NTag size="tiny">
              <NIcon
                :component="TimeOutline"
                size="12"
                style="margin-right: 4px"
              />
              {{ formattedDuration }}
            </NTag>
            <NTag size="tiny">
              {{ bgm.tempo }} BPM
            </NTag>
          </NSpace>
        </div>
      </div>

      <!-- 播放按钮 -->
      <div class="bgm-actions">
        <NButton
          circle
          :type="isPlaying ? 'primary' : 'default'"
          size="small"
          @click="togglePlay"
        >
          <template #icon>
            <NIcon
              :component="isPlaying ? PauseCircleOutline : PlayCircleOutline"
            />
          </template>
        </NButton>
      </div>
    </div>
  </NCard>
</template>

<style scoped>
.bgm-card {
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.bgm-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.bgm-card.selected {
  border-color: #18a058;
  background: #f6ffed;
}

.bgm-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.bgm-cover {
  position: relative;
  width: 60px;
  height: 60px;
  flex-shrink: 0;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.selected-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  background: white;
  border-radius: 50%;
  padding: 2px;
}

.bgm-info {
  flex: 1;
  min-width: 0;
}

.bgm-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.bgm-title {
  font-weight: 500;
  font-size: 14px;
  color: var(--text-color-base);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bgm-artist {
  font-size: 12px;
  color: #999;
  margin-bottom: 8px;
}

.bgm-meta {
  margin-top: 4px;
}

.bgm-actions {
  flex-shrink: 0;
}
</style>
