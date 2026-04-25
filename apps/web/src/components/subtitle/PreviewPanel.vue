<template>
  <div class="preview-panel">
    <div class="preview-container">
      <video
        ref="videoRef"
        class="video-player"
        :src="videoUrl"
        @timeupdate="handleTimeUpdate"
        @play="$emit('play')"
        @pause="$emit('pause')"
        @loadedmetadata="handleLoadedMetadata"
      />
      <canvas
        ref="canvasRef"
        class="subtitle-overlay"
        :width="canvasWidth"
        :height="canvasHeight"
      />
    </div>

    <div class="preview-controls">
      <n-button-group>
        <n-button @click="togglePlay">
          <template #icon>
            <n-icon>
              <PlayOutline v-if="!isPlaying" />
              <PauseOutline v-else />
            </n-icon>
          </template>
        </n-button>
      </n-button-group>

      <div class="time-display">
        {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
      </div>

      <n-slider
        :value="currentTime"
        :min="0"
        :max="duration"
        :step="0.1"
        class="time-slider"
        @update:value="handleSeek"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { PlayOutline, PauseOutline } from "@vicons/ionicons5";
import type {
  SubtitleTrackResponse,
  SubtitleItemResponse,
} from "@pixaura/shared-types";

interface Props {
  videoUrl: string;
  tracks: SubtitleTrackResponse[];
  subtitles: Array<{
    subtitle: SubtitleItemResponse;
    track: SubtitleTrackResponse;
  }>;
  currentTime: number;
  isPlaying: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  play: [];
  pause: [];
  seek: [time: number];
}>();

const videoRef = ref<HTMLVideoElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);

const canvasWidth = 1280;
const canvasHeight = 720;

const duration = ref(0);

const currentSubtitles = computed(() => {
  return props.subtitles.filter(({ subtitle }) => {
    return (
      subtitle.startTime <= props.currentTime &&
      subtitle.endTime >= props.currentTime
    );
  });
});

watch(
  () => props.isPlaying,
  (playing) => {
    if (playing) {
      videoRef.value?.play();
    } else {
      videoRef.value?.pause();
    }
  },
);

watch(
  () => props.currentTime,
  (time) => {
    if (videoRef.value && Math.abs(videoRef.value.currentTime - time) > 0.1) {
      videoRef.value.currentTime = time;
    }
    renderSubtitles();
  },
);

watch(currentSubtitles, renderSubtitles, { deep: true });

onMounted(() => {
  renderSubtitles();
});

function handleTimeUpdate(e: Event) {
  const video = e.target as HTMLVideoElement;
  emit("seek", video.currentTime);
}

function handleLoadedMetadata(e: Event) {
  const video = e.target as HTMLVideoElement;
  duration.value = video.duration || 300;
}

function togglePlay() {
  if (props.isPlaying) {
    emit("pause");
  } else {
    emit("play");
  }
}

function handleSeek(time: number) {
  emit("seek", time);
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
}

function renderSubtitles() {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // 清空画布
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // 绘制当前字幕
  currentSubtitles.value.forEach(({ subtitle, track }) => {
    drawSubtitle(ctx, subtitle, track);
  });
}

function drawSubtitle(
  ctx: CanvasRenderingContext2D,
  subtitle: SubtitleItemResponse,
  track: SubtitleTrackResponse,
) {
  const style = track.style || {};
  const fontSize = style.fontSize || 24;
  const fontFamily = style.fontFamily || "Noto Sans SC";
  const color = style.color || "#FFFFFF";
  const outlineEnabled = style.outlineEnabled ?? true;
  const outlineColor = style.outlineColor || "#000000";
  const outlineWidth = style.outlineWidth || 2;
  const position = style.position || "bottom";
  const alignment = style.alignment || "center";
  const marginVertical = style.marginVertical || 40;

  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.textBaseline = "middle";

  // 计算文字位置
  const text = subtitle.text;
  const textMetrics = ctx.measureText(text);
  const textWidth = textMetrics.width;
  const textHeight = fontSize;

  let x: number;
  let y: number;

  // 水平对齐
  switch (alignment) {
    case "left":
      x = marginVertical;
      break;
    case "right":
      x = canvasWidth - textWidth - marginVertical;
      break;
    case "center":
    default:
      x = (canvasWidth - textWidth) / 2;
      break;
  }

  // 垂直位置
  switch (position) {
    case "top":
      y = marginVertical + textHeight / 2;
      break;
    case "middle":
      y = canvasHeight / 2;
      break;
    case "bottom":
    default:
      y = canvasHeight - marginVertical - textHeight / 2;
      break;
  }

  // 绘制描边
  if (outlineEnabled && outlineWidth > 0) {
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = outlineWidth * 2;
    ctx.lineJoin = "round";
    ctx.strokeText(text, x, y);
  }

  // 绘制阴影
  if (style.shadowEnabled) {
    ctx.shadowColor = style.shadowColor || "#000000";
    ctx.shadowBlur = style.shadowBlur || 0;
    ctx.shadowOffsetX = style.shadowOffsetX || 0;
    ctx.shadowOffsetY = style.shadowOffsetY || 0;
  }

  // 绘制文字
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);

  // 重置阴影
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}
</script>

<style scoped>
.preview-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
}

.preview-container {
  flex: 1;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
}

.video-player {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.subtitle-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.preview-controls {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-top: 16px;
}

.time-display {
  font-size: 13px;
  color: #888;
  font-family: monospace;
  white-space: nowrap;
}

.time-slider {
  flex: 1;
}
</style>
