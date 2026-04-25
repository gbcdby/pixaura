<script setup lang="ts">
/**
 * 轨道内容组件
 * 片段显示（video/audio/text 三种颜色）
 */

import TrackClip from './TrackClip.vue';
import type { Track, TrackState, Clip } from '../types';

// Props
interface Props {
  tracks: Track[];
  trackStates: TrackState[];
  pixelsPerSecond: number;
}

defineProps<Props>();

// Emits
const emit = defineEmits<{
  'clip-context-menu': [info: { trackIndex: number; clipIndex: number; clip: Clip; event: MouseEvent }];
}>();

// 片段右键菜单
function handleClipContextMenu(trackIndex: number, clipIndex: number, clip: Clip, event: MouseEvent): void {
  emit('clip-context-menu', { trackIndex, clipIndex, clip, event });
}
</script>

<template>
  <div class="tracks-area">
    <!-- 轨道行 -->
    <div
      v-for="(track, trackIdx) in tracks"
      :key="trackIdx"
      class="track-row"
      :class="{ muted: trackStates[trackIdx]?.muted }"
    >
      <!-- 片段 -->
      <TrackClip
        v-for="(clip, clipIdx) in track.clips"
        :key="clipIdx"
        :clip="clip"
        :track-type="track.type"
        :pixels-per-second="pixelsPerSecond"
        :track-index="trackIdx"
        :clip-index="clipIdx"
        @context-menu="(e) => handleClipContextMenu(trackIdx, clipIdx, clip, e)"
      />
    </div>
  </div>
</template>

<style scoped>
.tracks-area {
  position: relative;
}

.track-row {
  height: 52px;
  border-bottom: 1px solid var(--border, #2a2a30);
  position: relative;
  transition: opacity 0.2s;
}

.track-row.muted {
  opacity: 0.25;
}
</style>