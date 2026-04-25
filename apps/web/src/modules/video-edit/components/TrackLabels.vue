<script setup lang="ts">
/**
 * 轨道标签组件
 * sticky left-0 定位，水平滚动时固定在左侧
 */

import { getTrackIcon } from '../utils/trackColors';
import type { Track, TrackState } from '../types';

// Props
interface Props {
  tracks: Track[];
  trackStates: TrackState[];
  width: number;
}

defineProps<Props>();

// Emits
const emit = defineEmits<{
  'toggle-mute': [trackIndex: number];
  'update-volume': [trackIndex: number, volume: number];
}>();
</script>

<template>
  <!-- 轨道标签 - sticky left-0 固定左侧，不随水平滚动 -->
  <div
    class="track-labels"
    :style="{ minWidth: width + 'px' }"
  >
    <!-- 标签头部（与时间刻度尺高度对齐） -->
    <div class="track-label-header"></div>

    <!-- 轨道标签列表 -->
    <div
      v-for="(track, idx) in tracks"
      :key="idx"
      class="track-label"
      :class="{ muted: trackStates[idx]?.muted }"
    >
      <!-- 上部：图标 + 名称 + 静音按钮 -->
      <div class="track-label-top">
        <div class="track-label-icon" :class="track.iconClass">
          <i :class="'fa-solid ' + getTrackIcon(track.type, idx)"></i>
        </div>
        <!-- 名称：溢出省略号 + tooltip -->
        <div class="track-label-name" :title="track.name">
          {{ track.name }}
        </div>
        <button
          class="mute-btn"
          :class="{ 'is-muted': trackStates[idx]?.muted }"
          @click.stop="emit('toggle-mute', idx)"
        >
          <i :class="trackStates[idx]?.muted ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'"></i>
        </button>
      </div>

      <!-- 下部：音量控制 -->
      <div class="track-label-bot">
        <template v-if="track.type === 'video' || track.type === 'audio'">
          <input
            type="range"
            class="track-vol-slider"
            :class="{ muted: trackStates[idx]?.muted }"
            min="0"
            max="100"
            :value="trackStates[idx]?.volume || 80"
            @input.stop="(e) => emit('update-volume', idx, parseInt((e.target as HTMLInputElement).value))"
            @click.stop
          />
          <span class="track-vol-val">{{ trackStates[idx]?.volume || 80 }}%</span>
        </template>
        <template v-else>
          <span style="font-size: 9px; color: var(--text-muted, #55556a)">可见性控制</span>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* sticky left-0 - 水平滚动时固定在左侧 */
.track-labels {
  position: sticky;
  left: 0;
  z-index: 20;
  flex-shrink: 0;
  background: var(--bg-surface, #18181d);
  border-right: 1px solid var(--border, #2a2a30);
  /* 确保 sticky 元素高度跟随内容 */
  align-self: flex-start;
  min-height: 100%;
}

.track-label-header {
  height: 24px;
  border-bottom: 1px solid var(--border, #2a2a30);
  background: var(--bg-surface, #18181d);
  flex-shrink: 0;
}

.track-label {
  height: 52px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 8px;
  gap: 3px;
  border-bottom: 1px solid var(--border, #2a2a30);
  transition: opacity 0.2s;
}

.track-label.muted {
  opacity: 0.35;
}

.track-label-top {
  display: flex;
  align-items: center;
  gap: 6px;
}

.track-label-icon {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  flex-shrink: 0;
}

.track-label-icon.video { background: var(--track-video, #2e6b5a); color: #b8ede0; }
.track-label-icon.audio { background: var(--track-audio, #5a3d8b); color: #d4b8f0; }
.track-label-icon.text { background: var(--track-text, #8b6d3d); color: #f0ddb8; }

.track-label-name {
  font-weight: 500;
  font-size: 11.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.mute-btn {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-muted, #55556a);
  cursor: pointer;
  font-size: 9px;
  border-radius: 3px;
  transition: all 0.15s;
  flex-shrink: 0;
  padding: 0;
}

.mute-btn:hover { color: var(--text-secondary, #8888a0); background: var(--bg-hover, #2a2a32); }
.mute-btn.is-muted { color: var(--danger, #ff5c5c); }

.track-label-bot {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-left: 28px;
}

.track-vol-slider {
  -webkit-appearance: none;
  width: 52px;
  height: 2px;
  background: var(--bg-elevated, #222228);
  border-radius: 1px;
  outline: none;
  cursor: pointer;
  flex-shrink: 0;
}

.track-vol-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-secondary, #8888a0);
  cursor: pointer;
}

.track-vol-slider::-webkit-slider-thumb:hover { background: var(--text-primary, #eaeaef); }
.track-vol-slider.muted::-webkit-slider-thumb { background: var(--danger, #ff5c5c); }

.track-vol-val {
  font-size: 9px;
  color: var(--text-muted, #55556a);
  font-family: 'JetBrains Mono', monospace;
  width: 24px;
  text-align: right;
  flex-shrink: 0;
}
</style>