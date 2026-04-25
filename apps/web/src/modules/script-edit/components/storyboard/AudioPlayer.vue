<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from "vue";
import { NIcon } from "naive-ui";
import { PlaySharp, PauseSharp } from "@vicons/ionicons5";

interface Props {
  src: string; // 音频 URL
  duration?: number; // 已知时长（可选，用于立即显示）
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "play"): void; // 播放时触发（用于互斥控制）
  (e: "pause"): void; // 暂停时触发
}>();

// 内部 Audio 对象
const audioRef = ref<HTMLAudioElement | null>(null);

// 状态
const isPlaying = ref(false);
const currentTime = ref(0);
const audioDuration = ref(props.duration ?? 0);
const isLoading = ref(true);
const isDragging = ref(false);

// 格式化时间（mm:ss）
function formatTime(seconds: number): string {
  if (!seconds || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  // 简短格式：1:30 而不是 01:30
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// 格式化时间显示（当前/总时长）
const timeDisplay = computed(() => {
  return `${formatTime(currentTime.value)} / ${formatTime(audioDuration.value)}`;
});

// 计算进度百分比
const progressPercent = computed(() => {
  if (audioDuration.value <= 0) return 0;
  return (currentTime.value / audioDuration.value) * 100;
});

// 播放/暂停切换
function togglePlay() {
  if (!audioRef.value) return;

  if (isPlaying.value) {
    audioRef.value.pause();
    isPlaying.value = false;
    emit("pause");
  } else {
    audioRef.value.play();
    isPlaying.value = true;
    emit("play");
  }
}

// 进度条点击
function handleProgressClick(event: MouseEvent) {
  if (!audioRef.value || audioDuration.value <= 0) return;

  const progressBar = event.currentTarget as HTMLElement;
  const rect = progressBar.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const percent = clickX / rect.width;
  const newTime = percent * audioDuration.value;

  audioRef.value.currentTime = newTime;
  currentTime.value = newTime;
}

// 拖拽开始
function handleDragStart(event: MouseEvent) {
  if (!audioRef.value || audioDuration.value <= 0) return;
  isDragging.value = true;
  updateProgressFromEvent(event);
}

// 拖拽移动
function handleDragMove(event: MouseEvent) {
  if (!isDragging.value || !audioRef.value) return;
  updateProgressFromEvent(event);
}

// 拖拽结束
function handleDragEnd(event: MouseEvent) {
  if (!isDragging.value) return;
  updateProgressFromEvent(event);
  isDragging.value = false;
}

// 从鼠标事件更新进度
function updateProgressFromEvent(event: MouseEvent) {
  if (!audioRef.value || audioDuration.value <= 0) return;

  const progressBar = event.currentTarget as HTMLElement;
  const rect = progressBar.getBoundingClientRect();
  const clientX = event.clientX;
  // 处理拖出进度条边界的情况
  const clickX = Math.max(0, Math.min(clientX - rect.left, rect.width));
  const percent = clickX / rect.width;
  const newTime = percent * audioDuration.value;

  audioRef.value.currentTime = newTime;
  currentTime.value = newTime;
}

// Audio 事件处理
function handleLoadedMetadata() {
  if (!audioRef.value) return;
  audioDuration.value = audioRef.value.duration;
  isLoading.value = false;
}

function handleTimeUpdate() {
  if (!audioRef.value) return;
  currentTime.value = audioRef.value.currentTime;
}

function handleEnded() {
  isPlaying.value = false;
  currentTime.value = 0;
  emit("pause");
}

function handleCanPlay() {
  isLoading.value = false;
}

// 初始化 Audio
function initAudio() {
  if (audioRef.value) {
    audioRef.value.removeEventListener("loadedmetadata", handleLoadedMetadata);
    audioRef.value.removeEventListener("timeupdate", handleTimeUpdate);
    audioRef.value.removeEventListener("ended", handleEnded);
    audioRef.value.removeEventListener("canplay", handleCanPlay);
  }

  audioRef.value = new Audio(props.src);
  audioRef.value.addEventListener("loadedmetadata", handleLoadedMetadata);
  audioRef.value.addEventListener("timeupdate", handleTimeUpdate);
  audioRef.value.addEventListener("ended", handleEnded);
  audioRef.value.addEventListener("canplay", handleCanPlay);

  // 重置状态
  isPlaying.value = false;
  currentTime.value = 0;
  isLoading.value = true;
}

// 监听 src 变化
watch(
  () => props.src,
  () => {
    initAudio();
  },
);

// 监听 duration prop 变化
watch(
  () => props.duration,
  (newDuration) => {
    if (newDuration && newDuration > 0) {
      audioDuration.value = newDuration;
    }
  },
);

onMounted(() => {
  initAudio();
});

onUnmounted(() => {
  if (audioRef.value) {
    audioRef.value.pause();
    audioRef.value.removeEventListener("loadedmetadata", handleLoadedMetadata);
    audioRef.value.removeEventListener("timeupdate", handleTimeUpdate);
    audioRef.value.removeEventListener("ended", handleEnded);
    audioRef.value.removeEventListener("canplay", handleCanPlay);
    audioRef.value = null;
  }
});

// 暴露 pause 方法供父组件调用（用于互斥控制）
function pause() {
  if (audioRef.value && isPlaying.value) {
    audioRef.value.pause();
    isPlaying.value = false;
    emit("pause");
  }
}

defineExpose({ pause });
</script>

<template>
  <div
    class="audio-player"
    :class="{ loading: isLoading }"
  >
    <!-- 播放/暂停按钮 -->
    <button
      class="play-btn"
      :disabled="isLoading"
      @click="togglePlay"
    >
      <n-icon
        size="14"
        :style="{ 'margin-right': '-2px' }"
      >
        <PlaySharp v-if="!isPlaying" />
        <PauseSharp v-else />
      </n-icon>
    </button>

    <!-- 进度条（支持点击和拖拽） -->
    <div
      class="progress-bar"
      :class="{
        disabled: isLoading || audioDuration <= 0,
        dragging: isDragging,
      }"
      @click="handleProgressClick"
      @mousedown="handleDragStart"
      @mousemove="handleDragMove"
      @mouseup="handleDragEnd"
      @mouseleave="handleDragEnd"
    >
      <div class="progress-track">
        <div
          class="progress-fill"
          :style="{ width: `${progressPercent}%` }"
        />
      </div>
    </div>

    <!-- 时间显示（当前/总时长） -->
    <span class="time-display">
      {{ timeDisplay }}
    </span>
  </div>
</template>

<style scoped lang="scss">
.audio-player {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 200px;
  height: 32px;
  padding: 0 10px;
  background: #f0f2f5;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
  transition: all 0.2s ease;

  &:not(.loading):hover {
    border-color: #c0c4cc;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
  }

  &.loading {
    .play-btn {
      background: #c0c4cc;
    }
  }

  .play-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    background: #18a058;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.15s ease;
    flex-shrink: 0;

    :deep(.n-icon) {
      color: #fff;
    }

    &:hover:not(:disabled) {
      background: #36ad6a;
      transform: scale(1.08);
    }

    &:active:not(:disabled) {
      transform: scale(0.95);
    }

    &:disabled {
      background: #c0c4cc;
      cursor: not-allowed;
    }
  }

  .progress-bar {
    flex: 1;
    min-width: 80px;
    height: 20px;
    display: flex;
    align-items: center;
    cursor: pointer;
    position: relative;

    &.disabled {
      cursor: not-allowed;
      opacity: 0.4;
    }

    .progress-track {
      width: 100%;
      height: 4px;
      background: #dcdfe6;
      border-radius: 2px;
      overflow: hidden;
      transition: height 0.15s ease;
    }

    .progress-fill {
      height: 100%;
      background: #18a058;
      border-radius: 2px;
      transition: width 0.05s linear;
    }

    &:hover:not(.disabled) .progress-track {
      height: 6px;
    }
  }

  .time-display {
    font-size: 11px;
    font-weight: 500;
    color: #606266;
    white-space: nowrap;
    min-width: 70px;
    text-align: right;
    flex-shrink: 0;
    font-family: "SF Mono", "Monaco", "Inconsolata", "Roboto Mono", monospace;
    letter-spacing: 0.3px;
  }
}
</style>
