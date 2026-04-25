<script setup lang="ts">
/**
 * 时间刻度尺组件
 * Canvas 绘制时间刻度
 */

import { ref, watch, onMounted } from 'vue';
import { formatTime } from '../utils/timeFormat';

// Props
interface Props {
  totalDuration: number;
  pixelsPerSecond: number;
  minWidth?: number; // 最小宽度，确保刻度尺填满区域
}

const props = withDefaults(defineProps<Props>(), {
  minWidth: 0,
});

// Emits
const emit = defineEmits<{
  'click': [event: MouseEvent];
}>();

// Canvas 引用
const canvasRef = ref<HTMLCanvasElement | null>(null);

/**
 * 绘制时间刻度尺
 */
function drawRuler(): void {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const context = canvas.getContext('2d');
  if (!context) return;

  // 宽度至少等于 minWidth，确保刻度尺填满区域
  const contentWidth = props.totalDuration * props.pixelsPerSecond + 40;
  const width = Math.max(contentWidth, props.minWidth);
  canvas.width = width;
  canvas.height = 24;

  // 清空画布
  context.clearRect(0, 0, canvas.width, canvas.height);

  // 根据缩放级别调整刻度密度
  const pps = props.pixelsPerSecond;
  let majorInterval = 5;
  let minorInterval = 1;

  if (pps > 40) {
    majorInterval = 2;
    minorInterval = 0.5;
  }
  if (pps > 80) {
    majorInterval = 1;
    minorInterval = 0.25;
  }
  if (pps < 15) {
    majorInterval = 10;
    minorInterval = 2;
  }

  // 计算需要绘制的最大时间（确保填满整个宽度）
  const maxTime = Math.max(props.totalDuration, (width - 40) / pps);

  // 绘制次刻度线
  context.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  context.lineWidth = 1;

  for (let t = 0; t <= maxTime; t += minorInterval) {
    const x = t * pps + 20;
    if (x > width) break;
    context.beginPath();
    context.moveTo(x, 18);
    context.lineTo(x, 24);
    context.stroke();
  }

  // 绘制主刻度线 + 时间文本
  for (let t = 0; t <= maxTime; t += majorInterval) {
    const x = t * pps + 20;
    if (x > width) break;

    // 主刻度线
    context.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    context.beginPath();
    context.moveTo(x, 10);
    context.lineTo(x, 24);
    context.stroke();

    // 时间文本
    context.fillStyle = 'rgba(255, 255, 255, 0.4)';
    context.font = '10px "JetBrains Mono", monospace';
    context.textAlign = 'center';
    context.fillText(formatTime(t), x, 9);
  }
}

// 监听变化重绘
watch(
  () => [props.totalDuration, props.pixelsPerSecond, props.minWidth],
  () => {
    drawRuler();
  },
  { immediate: true },
);

onMounted(() => {
  drawRuler();
});
</script>

<template>
  <div class="time-ruler" @click="emit('click', $event)">
    <canvas ref="canvasRef" height="24"></canvas>
  </div>
</template>

<style scoped>
.time-ruler {
  height: 24px;
  background: var(--bg-surface, #18181d);
  border-bottom: 1px solid var(--border, #2a2a30);
  position: sticky;
  top: 0;
  z-index: 15;
  cursor: pointer;
}

/* 覆盖左侧轨道标签头部区域 */
.time-ruler::before {
  content: '';
  position: absolute;
  left: -160px; /* 覆盖轨道标签宽度 */
  top: 0;
  width: 160px;
  height: 100%;
  background: var(--bg-surface, #18181d);
  z-index: -1;
}

.time-ruler canvas {
  display: block;
}
</style>