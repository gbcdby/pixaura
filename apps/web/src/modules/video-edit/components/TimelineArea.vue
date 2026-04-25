<script setup lang="ts">
/**
 * 时间轴区域组件
 * 参考布局：统一滚动容器 + sticky left-0 定位轨道标签
 */

import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import TimelineRuler from './TimelineRuler.vue';
import TrackLabels from './TrackLabels.vue';
import TimelineTracks from './TimelineTracks.vue';
import TimelinePlayhead from './TimelinePlayhead.vue';
import ZoomControl from './ZoomControl.vue';
import type { Track, TrackState } from '../types';

// 轨道标签固定宽度
const LABEL_WIDTH = 160;

// Props
interface Props {
  tracks: Track[];
  trackStates: TrackState[];
  totalDuration: number;
  currentTime: number;
  zoom: number;
  pixelsPerSecond: number;
  zoomLabel: string;
  playheadPosition: number;
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  'toggle-mute': [trackIndex: number];
  'update-volume': [trackIndex: number, volume: number];
  'time-ruler-click': [event: MouseEvent];
  'progress-bar-click': [event: MouseEvent, element: HTMLElement];
  'zoom-in': [];
  'zoom-out': [];
  'auto-fit': [];
  'wheel-zoom': [event: WheelEvent];
  'clip-context-menu': [info: { trackIndex: number; clipIndex: number; clip: unknown; event: MouseEvent }];
  'request-auto-fit': [containerWidth: number, totalDuration: number];
}>();

// 滚动容器引用
const timelineScrollRef = ref<HTMLElement | null>(null);

// 容器宽度（用于计算内容宽度）
const containerWidth = ref(0);

// 时间轴内容宽度
const timelineContentWidth = computed(() => {
  const contentWidth = props.totalDuration * props.pixelsPerSecond + 40;
  const availableWidth = Math.max(0, containerWidth.value - LABEL_WIDTH);
  return Math.max(contentWidth, availableWidth);
});

// 监听容器尺寸变化
function updateContainerWidth(): void {
  if (timelineScrollRef.value) {
    containerWidth.value = timelineScrollRef.value.clientWidth;
  }
}

// 时间刻度尺点击
function handleTimeRulerClick(event: MouseEvent): void {
  emit('time-ruler-click', event);
}

// 缩放控制
function handleZoomIn(): void {
  emit('zoom-in');
}

function handleZoomOut(): void {
  emit('zoom-out');
}

function handleAutoFit(): void {
  emit('auto-fit');
}

function handleWheelZoom(event: WheelEvent): void {
  emit('wheel-zoom', event);
}

// 轨道控制
function handleToggleMute(idx: number): void {
  emit('toggle-mute', idx);
}

function handleUpdateVolume(idx: number, volume: number): void {
  emit('update-volume', idx, volume);
}

// 片段右键菜单
function handleClipContextMenu(info: { trackIndex: number; clipIndex: number; clip: unknown; event: MouseEvent }): void {
  emit('clip-context-menu', info);
}

// ResizeObserver 监听容器尺寸变化
let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  nextTick(() => {
    if (timelineScrollRef.value) {
      // 添加滚轮缩放监听
      timelineScrollRef.value.addEventListener('wheel', handleWheelZoom, { passive: false });

      // 初始化容器宽度
      updateContainerWidth();

      // 监听容器尺寸变化
      resizeObserver = new ResizeObserver(() => {
        updateContainerWidth();
        if (containerWidth.value > 0 && props.totalDuration > 0) {
          // 内容宽度 = 容器宽度 - 标签宽度
          emit('request-auto-fit', containerWidth.value - LABEL_WIDTH, props.totalDuration);
        }
      });
      resizeObserver.observe(timelineScrollRef.value);
    }
  });
});

onUnmounted(() => {
  if (timelineScrollRef.value) {
    timelineScrollRef.value.removeEventListener('wheel', handleWheelZoom);
  }
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
});

// 暴露滚动容器引用
defineExpose({
  getScrollContainer: () => timelineScrollRef.value,
  scrollToPosition: (left: number) => {
    if (timelineScrollRef.value) {
      timelineScrollRef.value.scrollLeft = left;
    }
  },
});
</script>

<template>
  <div class="timeline-area">
    <!-- 时间轴工具栏 -->
    <div class="timeline-toolbar">
      <ZoomControl
        :zoom-label="zoomLabel"
        @zoom-in="handleZoomIn"
        @zoom-out="handleZoomOut"
        @auto-fit="handleAutoFit"
      />
    </div>

    <!-- 时间轴主体 - 统一滚动容器 -->
    <div
      ref="timelineScrollRef"
      class="timeline-body"
    >
      <!-- 轨道标签 - sticky left-0 固定在左侧 -->
      <TrackLabels
        :tracks="tracks"
        :track-states="trackStates"
        :width="LABEL_WIDTH"
        @toggle-mute="handleToggleMute"
        @update-volume="handleUpdateVolume"
      />

      <!-- 时间轴内容区域 -->
      <div class="timeline-content" :style="{ width: timelineContentWidth + 'px' }">
        <!-- 时间刻度尺 - sticky top-0 固定在顶部 -->
        <TimelineRuler
          :total-duration="totalDuration"
          :pixels-per-second="pixelsPerSecond"
          :min-width="containerWidth - LABEL_WIDTH"
          @click="handleTimeRulerClick"
        />

        <!-- 轨道内容 -->
        <TimelineTracks
          :tracks="tracks"
          :track-states="trackStates"
          :pixels-per-second="pixelsPerSecond"
          @clip-context-menu="handleClipContextMenu"
        />

        <!-- 播放头 -->
        <TimelinePlayhead :position="playheadPosition" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.timeline-area {
  height: 280px;
  background: var(--bg-main, #0f0f12);
  border-top: 1px solid var(--border, #2a2a30);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.timeline-toolbar {
  height: 32px;
  background: var(--bg-surface, #18181d);
  border-bottom: 1px solid var(--border, #2a2a30);
  display: flex;
  align-items: center;
  padding: 0 14px;
  flex-shrink: 0;
}

/* 统一滚动容器 - 水平+垂直滚动 */
.timeline-body {
  flex: 1;
  overflow: auto;
  display: flex;
  align-items: flex-start; /* 让子元素不被拉伸 */
}

.timeline-content {
  flex-shrink: 0;
  position: relative;
  /* 高度由内容（刻度尺 + 轨道）自然撑开 */
}

/* 自定义滚动条样式 */
.timeline-body::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.timeline-body::-webkit-scrollbar-track {
  background: var(--bg-surface, #18181d);
  border-radius: 4px;
}

.timeline-body::-webkit-scrollbar-thumb {
  background: var(--border, #3a3a42);
  border-radius: 4px;
}

.timeline-body::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted, #55556a);
}

.timeline-body::-webkit-scrollbar-corner {
  background: var(--bg-surface, #18181d);
}

/* Firefox 滚动条 */
.timeline-body {
  scrollbar-width: thin;
  scrollbar-color: var(--border, #3a3a42) var(--bg-surface, #18181d);
}
</style>