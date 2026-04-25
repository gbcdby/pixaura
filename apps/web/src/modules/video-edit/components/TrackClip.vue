<script setup lang="ts">
/**
 * 单个片段组件
 * 显示片段名称和波形（音频片段）
 */

import { computed, ref, onMounted } from 'vue';
import { drawWaveform } from '../utils/waveform';
import type { Clip } from '../types';

// Props
interface Props {
  clip: Clip;
  trackType: 'video' | 'audio' | 'text';
  pixelsPerSecond: number;
  trackIndex: number;
  clipIndex: number;
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  'context-menu': [event: MouseEvent];
}>();

// 片段位置和宽度
const clipLeft = computed(() => {
  return props.clip.start * props.pixelsPerSecond + 20;
});

const clipWidth = computed(() => {
  return Math.max(2, props.clip.duration * props.pixelsPerSecond);
});

// 波形 Canvas 引用
const waveformCanvasRef = ref<HTMLCanvasElement | null>(null);

// 绘制波形（音频片段）
onMounted(() => {
  if (props.trackType === 'audio' && waveformCanvasRef.value) {
    waveformCanvasRef.value.width = clipWidth.value;
    waveformCanvasRef.value.height = 42;
    drawWaveform(waveformCanvasRef.value, props.clip.start, props.clip.duration);
  }
});

// 右键菜单处理
function handleContextMenu(event: MouseEvent): void {
  event.preventDefault();
  event.stopPropagation();
  emit('context-menu', event);
}
</script>

<template>
  <div
    class="track-clip"
    :class="{
      'video-clip': trackType === 'video',
      'audio-clip': trackType === 'audio',
      'text-clip': trackType === 'text',
      'black-screen-clip': clip.isBlackScreen,
    }"
    :style="{
      left: clipLeft + 'px',
      width: clipWidth + 'px',
    }"
    :data-track-idx="trackIndex"
    :data-clip-idx="clipIndex"
    @contextmenu="trackType === 'video' ? handleContextMenu($event) : null"
  >
    <!-- 波形（音频片段） -->
    <canvas
      v-if="trackType === 'audio'"
      ref="waveformCanvasRef"
      class="clip-waveform"
    ></canvas>

    <!-- 黑屏标识 -->
    <span v-if="clip.isBlackScreen" class="black-screen-icon">
      <i class="fa-solid fa-ban"></i>
    </span>

    <!-- 片段名称 -->
    <span class="clip-name">{{ clip.name }}</span>
  </div>
</template>

<style scoped>
.track-clip {
  position: absolute;
  top: 5px;
  height: 42px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  padding: 0 10px;
  font-size: 11px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  overflow: hidden;
  cursor: default;
  transition: filter 0.15s;
  border: 1px solid transparent;
}

.track-clip:hover {
  filter: brightness(1.15);
}

.track-clip.video-clip {
  background: linear-gradient(135deg, var(--track-video, #2e6b5a), #245a4a);
  border-color: var(--track-video-border, #3d8b74);
}

/* 黑屏片段样式（灰色条纹） */
.track-clip.black-screen-clip {
  background: linear-gradient(135deg, #333, #222);
  border-color: #444;
  opacity: 0.85;
}

.black-screen-icon {
  margin-right: 4px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 10px;
}

.track-clip.audio-clip {
  background: linear-gradient(135deg, var(--track-audio, #5a3d8b), #4a2d7a);
  border-color: var(--track-audio-border, #7b5aaf);
}

.track-clip.text-clip {
  background: linear-gradient(135deg, var(--track-text, #8b6d3d), #7a5a2d);
  border-color: var(--track-text-border, #af8c52);
}

.clip-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  position: relative;
  z-index: 2;
}

.clip-waveform {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  opacity: 0.3;
  pointer-events: none;
}
</style>