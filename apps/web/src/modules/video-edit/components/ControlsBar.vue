<script setup lang="ts">
/**
 * 控制栏组件
 * 播放控制、进度条、时间显示、AI配乐按钮、全屏按钮
 */

import { ref, computed } from 'vue';
import { NTooltip } from 'naive-ui';
import { formatTime } from '../utils/timeFormat';

// Props
interface Props {
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
  progressPercent: number;
  isVideoFullscreen: boolean;
  isWorkspaceFullscreen: boolean;
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  'toggle-play': [];
  'skip': [delta: number];
  'frame-step': [direction: 'prev' | 'next'];
  'seek': [time: number];
  'open-ai-music': [];
  'toggle-video-fullscreen': [];
  'toggle-workspace-fullscreen': [];
}>();

// 时间显示
const currentTimeDisplay = computed(() => formatTime(props.currentTime));
const totalTimeDisplay = computed(() => formatTime(props.totalDuration));

// 进度条引用
const progressBarRef = ref<HTMLElement | null>(null);

// 拖拽状态
const isDragging = ref(false);
const dragProgress = ref(-1); // -1 表示未拖拽，否则为 0-100 的百分比

// 实际显示的进度百分比（拖拽时优先使用 dragProgress）
const effectiveProgressPercent = computed(() => {
  if (isDragging.value && dragProgress.value >= 0) {
    return dragProgress.value;
  }
  return props.progressPercent;
});

// 拖拽时的时间显示
const dragTimeDisplay = computed(() => {
  if (!isDragging.value || dragProgress.value < 0) return '';
  return formatTime((dragProgress.value / 100) * props.totalDuration);
});

// 计算鼠标位置对应的进度百分比
function getProgressFromEvent(event: MouseEvent): number {
  if (!progressBarRef.value) return 0;
  const rect = progressBarRef.value.getBoundingClientRect();
  const percent = ((event.clientX - rect.left) / rect.width) * 100;
  return Math.max(0, Math.min(100, percent));
}

// 开始拖拽
function handleMouseDown(event: MouseEvent): void {
  if (event.button !== 0) return; // 只响应左键
  isDragging.value = true;
  dragProgress.value = getProgressFromEvent(event);
  emit('seek', (dragProgress.value / 100) * props.totalDuration);

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
}

// 拖拽中
function handleMouseMove(event: MouseEvent): void {
  if (!isDragging.value) return;
  dragProgress.value = getProgressFromEvent(event);
  emit('seek', (dragProgress.value / 100) * props.totalDuration);
}

// 结束拖拽
function handleMouseUp(): void {
  if (!isDragging.value) return;
  // 延迟重置 isDragging，避免 click 事件触发
  setTimeout(() => {
    isDragging.value = false;
    dragProgress.value = -1;
  }, 0);
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
}

// 进度条点击处理
function handleProgressBarClick(event: MouseEvent): void {
  if (isDragging.value) return; // 拖拽时忽略 click
  if (!progressBarRef.value) return;

  const rect = progressBarRef.value.getBoundingClientRect();
  const percent = (event.clientX - rect.left) / rect.width;
  emit('seek', percent * props.totalDuration);
}
</script>

<template>
  <div class="controls-bar">
    <!-- 播放控制按钮 -->
    <NTooltip trigger="hover" :delay="300">
      <template #trigger>
        <button class="ctrl-btn" @click="emit('skip', -5)">
          <i class="fa-solid fa-backward"></i>
        </button>
      </template>
      后退 5 秒
    </NTooltip>

    <NTooltip trigger="hover" :delay="300">
      <template #trigger>
        <button class="ctrl-btn" @click="emit('frame-step', 'prev')">
          <i class="fa-solid fa-backward-step"></i>
        </button>
      </template>
      上一帧
    </NTooltip>

    <NTooltip trigger="hover" :delay="300">
      <template #trigger>
        <button
          class="ctrl-btn play-btn"
          :class="{ active: isPlaying }"
          @click="emit('toggle-play')"
        >
          <i :class="isPlaying ? 'fa-solid fa-pause' : 'fa-solid fa-play'"></i>
        </button>
      </template>
      {{ isPlaying ? '暂停' : '播放' }}
    </NTooltip>

    <NTooltip trigger="hover" :delay="300">
      <template #trigger>
        <button class="ctrl-btn" @click="emit('frame-step', 'next')">
          <i class="fa-solid fa-forward-step"></i>
        </button>
      </template>
      下一帧
    </NTooltip>

    <NTooltip trigger="hover" :delay="300">
      <template #trigger>
        <button class="ctrl-btn" @click="emit('skip', 5)">
          <i class="fa-solid fa-forward"></i>
        </button>
      </template>
      前进 5 秒
    </NTooltip>

    <!-- 时间显示 -->
    <div class="time-display">
      <span class="current mono">{{ currentTimeDisplay }}</span>
      <span>/</span>
      <span class="mono">{{ totalTimeDisplay }}</span>
    </div>

    <!-- 进度条 -->
    <div
      ref="progressBarRef"
      class="progress-bar-container"
      :class="{ dragging: isDragging }"
      @click="handleProgressBarClick"
      @mousedown="handleMouseDown"
    >
      <div class="progress-track">
        <div
          class="progress-fill"
          :class="{ 'no-transition': isDragging }"
          :style="{ width: effectiveProgressPercent + '%' }"
        ></div>
        <!-- 拖拽手柄 -->
        <div
          class="progress-thumb"
          :class="{ visible: isDragging }"
          :style="{ left: effectiveProgressPercent + '%' }"
        ></div>
      </div>
      <!-- 拖拽时的时间提示 -->
      <div v-if="isDragging" class="drag-tooltip">
        {{ dragTimeDisplay }}
      </div>
    </div>

    <!-- 占位 -->
    <div class="controls-spacer"></div>

    <!-- AI 配乐按钮 - 视频全屏时隐藏 -->
    <NTooltip v-if="!isVideoFullscreen" trigger="hover" :delay="300">
      <template #trigger>
        <button class="ai-music-btn" @click="emit('open-ai-music')">
          <i class="fa-solid fa-wand-magic-sparkles"></i>
          <span>AI 配乐</span>
        </button>
      </template>
      AI 智能配乐
    </NTooltip>

    <!-- 视频全屏按钮 -->
    <NTooltip trigger="hover" :delay="300">
      <template #trigger>
        <button
          class="fullscreen-btn"
          :class="{ active: isVideoFullscreen }"
          @click="emit('toggle-video-fullscreen')"
        >
          <i :class="isVideoFullscreen ? 'fa-solid fa-compress' : 'fa-solid fa-expand'"></i>
        </button>
      </template>
      {{ isVideoFullscreen ? '退出视频全屏' : '视频全屏（视频区域填充满屏幕）' }}
    </NTooltip>

    <!-- 工作区全屏按钮 - 视频全屏时隐藏 -->
    <NTooltip v-if="!isVideoFullscreen" trigger="hover" :delay="300">
      <template #trigger>
        <button
          class="fullscreen-btn"
          :class="{ active: isWorkspaceFullscreen }"
          @click="emit('toggle-workspace-fullscreen')"
        >
          <i :class="isWorkspaceFullscreen ? 'fa-solid fa-down-left-and-up-right-to-center' : 'fa-solid fa-up-right-and-down-left-from-center'"></i>
        </button>
      </template>
      {{ isWorkspaceFullscreen ? '退出工作区全屏' : '工作区全屏（编辑器填充满屏幕）' }}
    </NTooltip>
  </div>
</template>

<style scoped>
.controls-bar {
  height: 56px;
  background: var(--bg-surface, #18181d);
  border-top: 1px solid var(--border, #2a2a30);
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 4px;
  flex-shrink: 0;
  user-select: none;
  -moz-user-select: none;
  -webkit-user-select: none;
  -ms-user-select: none;
  -o-user-select: none;
}

.ctrl-btn {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-secondary, #8888a0);
  cursor: pointer;
  transition: all 0.15s;
  font-size: 13px;
  flex-shrink: 0;
}

.ctrl-btn:hover {
  color: var(--text-primary, #eaeaef);
  background: var(--bg-hover, #2a2a32);
}

.ctrl-btn.play-btn {
  width: 38px;
  height: 38px;
  font-size: 14px;
  color: var(--text-primary, #eaeaef);
  background: var(--bg-elevated, #222228);
}

.ctrl-btn.play-btn:hover {
  background: var(--accent, #00d4aa);
  color: var(--bg-deep, #08080a);
}

.ctrl-btn.play-btn.active {
  background: var(--accent, #00d4aa);
  color: var(--bg-deep, #08080a);
}

.time-display {
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--text-secondary, #8888a0);
  padding: 0 8px;
  flex-shrink: 0;
}

.time-display .current {
  color: var(--text-primary, #eaeaef);
}

.progress-bar-container {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: center;
  position: relative;
  cursor: pointer;
  padding: 0 4px;
}

.progress-track {
  width: 100%;
  height: 4px;
  background: var(--bg-elevated, #222228);
  border-radius: 2px;
  position: relative;
  overflow: hidden;
  transition: height 0.1s;
}

.progress-fill {
  height: 100%;
  background: var(--accent, #00d4aa);
  border-radius: 2px;
  transition: width 0.05s linear;
}

.progress-bar-container:hover .progress-track,
.progress-bar-container.dragging .progress-track {
  height: 6px;
}

.progress-fill.no-transition {
  transition: none;
}

.progress-thumb {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  background: var(--text-primary, #eaeaef);
  border-radius: 50%;
  transform: translate(-50%, -50%) scale(0);
  transition: transform 0.15s ease;
  pointer-events: none;
  z-index: 2;
  box-shadow: 0 0 6px rgba(0, 0, 0, 0.4);
}

.progress-bar-container:hover .progress-thumb,
.progress-thumb.visible {
  transform: translate(-50%, -50%) scale(1);
}

.drag-tooltip {
  position: absolute;
  top: -28px;
  left: v-bind('effectiveProgressPercent + "%"');
  transform: translateX(-50%);
  background: var(--bg-elevated, #222228);
  color: var(--text-primary, #eaeaef);
  font-size: 11px;
  font-family: 'JetBrains Mono', monospace;
  padding: 3px 8px;
  border-radius: 4px;
  white-space: nowrap;
  pointer-events: none;
  z-index: 3;
  border: 1px solid var(--border, #2a2a30);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.controls-spacer {
  flex: 1;
}

.ai-music-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 7px;
  border: 1px solid var(--border, #2a2a30);
  background: transparent;
  color: var(--text-secondary, #8888a0);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 12px;
  font-family: inherit;
  flex-shrink: 0;
}

.ai-music-btn:hover {
  border-color: var(--accent-dim, #00a885);
  color: var(--accent, #00d4aa);
  background: var(--accent-glow, rgba(0, 212, 170, 0.15));
}

.ai-music-btn i {
  font-size: 13px;
}

.fullscreen-btn {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: 1px solid var(--border, #2a2a30);
  background: transparent;
  color: var(--text-secondary, #8888a0);
  cursor: pointer;
  transition: all 0.15s;
  font-size: 13px;
  flex-shrink: 0;
}

.fullscreen-btn:hover {
  color: var(--text-primary, #eaeaef);
  border-color: var(--border-light, #3a3a42);
  background: var(--bg-hover, #2a2a32);
}

.fullscreen-btn.active {
  color: var(--accent, #00d4aa);
  border-color: var(--accent-dim, #00a885);
  background: var(--accent-glow, rgba(0, 212, 170, 0.15));
}

.mono {
  font-family: 'JetBrains Mono', monospace;
}
</style>