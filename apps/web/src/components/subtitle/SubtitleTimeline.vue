<template>
  <div
    class="subtitle-timeline"
    @wheel="handleWheel"
  >
    <!-- 时间轴标尺 -->
    <div
      class="timeline-ruler"
      :style="{ width: `${totalWidth}px` }"
    >
      <div
        v-for="tick in timeTicks"
        :key="tick.time"
        class="time-tick"
        :style="{ left: `${tick.position}px` }"
      >
        <div class="tick-line" />
        <span class="tick-label">{{ formatTime(tick.time) }}</span>
      </div>
    </div>

    <!-- 字幕轨道区域 -->
    <div
      class="timeline-tracks"
      :style="{ width: `${totalWidth}px` }"
    >
      <div
        v-for="subtitle in subtitles"
        :key="subtitle.id"
        class="subtitle-item"
        :class="{ selected: subtitle.id === selectedSubtitleId }"
        :style="{
          left: `${getPosition(subtitle.startTime)}px`,
          width: `${getWidth(subtitle.startTime, subtitle.endTime)}px`,
        }"
        @click.stop="$emit('select', subtitle.id)"
        @mousedown="(e) => handleMouseDown(e, subtitle, 'move')"
      >
        <!-- 左调整手柄 -->
        <div
          class="resize-handle resize-handle-left"
          @mousedown.stop="(e) => handleMouseDown(e, subtitle, 'resize-left')"
        />

        <!-- 字幕内容 -->
        <div
          class="subtitle-content"
          :title="subtitle.text"
        >
          {{ subtitle.text }}
        </div>

        <!-- 右调整手柄 -->
        <div
          class="resize-handle resize-handle-right"
          @mousedown.stop="(e) => handleMouseDown(e, subtitle, 'resize-right')"
        />
      </div>
    </div>

    <!-- 播放头 -->
    <div
      class="playhead"
      :style="{ left: `${getPosition(currentTime)}px` }"
      @mousedown="handlePlayheadDrag"
    >
      <div class="playhead-line" />
      <div class="playhead-triangle" />
    </div>

    <!-- 缩放控制 -->
    <div class="zoom-controls">
      <n-button-group size="tiny">
        <n-button @click="decreaseZoom">
          <template #icon>
            <n-icon><RemoveOutline /></n-icon>
          </template>
        </n-button>
        <n-button disabled>
          {{ Math.round(zoomLevel * 100) }}%
        </n-button>
        <n-button @click="increaseZoom">
          <template #icon>
            <n-icon><AddOutline /></n-icon>
          </template>
        </n-button>
      </n-button-group>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { AddOutline, RemoveOutline } from "@vicons/ionicons5";
import type { SubtitleItemResponse } from "@pixaura/shared-types";

interface Props {
  subtitles: SubtitleItemResponse[];
  duration: number;
  currentTime: number;
  zoomLevel: number;
  selectedSubtitleId: string | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  select: [subtitleId: string | null];
  move: [subtitleId: string, newStartTime: number];
  resize: [subtitleId: string, startTime: number, endTime: number];
  split: [subtitleId: string, splitTime: number];
  "time-change": [time: number];
  "zoom-change": [zoom: number];
}>();

const PIXELS_PER_SECOND = 50;

const totalWidth = computed(() => {
  return props.duration * PIXELS_PER_SECOND * props.zoomLevel + 200;
});

const timeTicks = computed(() => {
  const ticks: Array<{ time: number; position: number }> = [];
  const interval = Math.max(1, Math.floor(5 / props.zoomLevel));
  for (let time = 0; time <= props.duration; time += interval) {
    ticks.push({
      time,
      position: getPosition(time),
    });
  }
  return ticks;
});

function getPosition(time: number): number {
  return time * PIXELS_PER_SECOND * props.zoomLevel;
}

function getWidth(startTime: number, endTime: number): number {
  return (endTime - startTime) * PIXELS_PER_SECOND * props.zoomLevel;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function increaseZoom() {
  emit("zoom-change", props.zoomLevel * 1.2);
}

function decreaseZoom() {
  emit("zoom-change", props.zoomLevel / 1.2);
}

function handleWheel(e: WheelEvent) {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    emit("zoom-change", Math.max(0.1, Math.min(5, props.zoomLevel + delta)));
  }
}

// 拖拽处理
const isDragging = ref(false);
const dragSubtitle = ref<SubtitleItemResponse | null>(null);
const dragAction = ref<"move" | "resize-left" | "resize-right" | null>(null);
const dragStartX = ref(0);
const dragStartTime = ref(0);
const dragStartEndTime = ref(0);

function handleMouseDown(
  e: MouseEvent,
  subtitle: SubtitleItemResponse,
  action: "move" | "resize-left" | "resize-right",
) {
  e.stopPropagation();
  e.preventDefault();

  isDragging.value = true;
  dragSubtitle.value = subtitle;
  dragAction.value = action;
  dragStartX.value = e.clientX;
  dragStartTime.value = subtitle.startTime;
  dragStartEndTime.value = subtitle.endTime;

  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);
}

function handleMouseMove(e: MouseEvent) {
  if (!isDragging.value || !dragSubtitle.value) return;

  const deltaX = e.clientX - dragStartX.value;
  const deltaTime = deltaX / (PIXELS_PER_SECOND * props.zoomLevel);

  if (dragAction.value === "move") {
    Math.max(0, dragStartTime.value + deltaTime);
  } else if (dragAction.value === "resize-left") {
    Math.max(
      0,
      Math.min(dragStartEndTime.value - 0.5, dragStartTime.value + deltaTime),
    );
  } else if (dragAction.value === "resize-right") {
    Math.max(dragStartTime.value + 0.5, dragStartEndTime.value + deltaTime);
  }
}

function handleMouseUp(e: MouseEvent) {
  if (!isDragging.value || !dragSubtitle.value) return;

  const deltaX = e.clientX - dragStartX.value;
  const deltaTime = deltaX / (PIXELS_PER_SECOND * props.zoomLevel);

  if (dragAction.value === "move") {
    const newStartTime = Math.max(0, dragStartTime.value + deltaTime);
    emit("move", dragSubtitle.value.id, newStartTime);
  } else if (dragAction.value === "resize-left") {
    const newStartTime = Math.max(
      0,
      Math.min(dragStartEndTime.value - 0.5, dragStartTime.value + deltaTime),
    );
    emit("resize", dragSubtitle.value.id, newStartTime, dragStartEndTime.value);
  } else if (dragAction.value === "resize-right") {
    const newEndTime = Math.max(
      dragStartTime.value + 0.5,
      dragStartEndTime.value + deltaTime,
    );
    emit("resize", dragSubtitle.value.id, dragStartTime.value, newEndTime);
  }

  isDragging.value = false;
  dragSubtitle.value = null;
  dragAction.value = null;

  document.removeEventListener("mousemove", handleMouseMove);
  document.removeEventListener("mouseup", handleMouseUp);
}

// 播放头拖拽
function handlePlayheadDrag(e: MouseEvent) {
  e.stopPropagation();
  e.preventDefault();

  const startX = e.clientX;
  const startTime = props.currentTime;

  function onMouseMove(moveEvent: MouseEvent) {
    const deltaX = moveEvent.clientX - startX;
    const deltaTime = deltaX / (PIXELS_PER_SECOND * props.zoomLevel);
    const newTime = Math.max(0, startTime + deltaTime);
    emit("time-change", newTime);
  }

  function onMouseUp() {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  }

  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
}
</script>

<style scoped>
.subtitle-timeline {
  position: relative;
  height: 100%;
  overflow: auto;
  background: #1a1a1a;
}

.timeline-ruler {
  position: relative;
  height: 24px;
  background: #252525;
  border-bottom: 1px solid #333;
}

.time-tick {
  position: absolute;
  top: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.tick-line {
  width: 1px;
  height: 8px;
  background: #666;
}

.tick-label {
  font-size: 10px;
  color: #888;
  margin-top: 2px;
}

.timeline-tracks {
  position: relative;
  min-height: 120px;
  padding: 20px 0;
}

.subtitle-item {
  position: absolute;
  height: 40px;
  background: #2080f0;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 0 4px;
  user-select: none;
  overflow: hidden;
}

.subtitle-item:hover {
  background: #4098ff;
}

.subtitle-item.selected {
  background: #f0a020;
  box-shadow: 0 0 0 2px #f0a02040;
}

.subtitle-content {
  flex: 1;
  font-size: 12px;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0 8px;
}

.resize-handle {
  position: absolute;
  top: 0;
  width: 6px;
  height: 100%;
  cursor: col-resize;
  opacity: 0;
  transition: opacity 0.2s;
}

.resize-handle-left {
  left: 0;
}

.resize-handle-right {
  right: 0;
}

.subtitle-item:hover .resize-handle {
  opacity: 1;
  background: rgba(255, 255, 255, 0.3);
}

.playhead {
  position: absolute;
  top: 0;
  width: 2px;
  height: 100%;
  pointer-events: none;
  z-index: 100;
}

.playhead-line {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 2px;
  height: 100%;
  background: #f0a020;
}

.playhead-triangle {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 8px solid #f0a020;
}

.zoom-controls {
  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: 200;
}
</style>
