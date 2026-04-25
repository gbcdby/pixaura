<script setup lang="ts">
/**
 * 播放头组件
 * 当前时间指示线
 */

// Props
interface Props {
  position: number;
}

defineProps<Props>();
</script>

<template>
  <div class="playhead" :style="{ left: position + 'px' }">
    <!-- 顶部箭头指示器 -->
    <div class="playhead-arrow"></div>
  </div>
</template>

<style scoped>
.playhead {
  position: absolute;
  top: 24px; /* 从刻度尺下方开始 */
  bottom: 0;
  width: 2px;
  background: var(--accent, #00d4aa);
  z-index: 10; /* 降低层级，低于轨道标签 (z-index: 20) */
  pointer-events: none;
}

.playhead-arrow {
  position: absolute;
  top: 0;
  left: -5px;
  width: 12px;
  height: 12px;
  background: var(--accent, #00d4aa);
  clip-path: polygon(0 0, 100% 0, 50% 80%);
}
</style>