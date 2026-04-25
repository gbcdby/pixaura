<script setup lang="ts">
/**
 * 生成进度遮罩组件
 */

import { computed } from 'vue';

// Props
interface Props {
  visible: boolean;
  text: string;
  progress: number;
}

const props = defineProps<Props>();

// 进度条宽度
const progressWidth = computed(() => props.progress + '%');
</script>

<template>
  <div v-if="visible" class="generating-overlay">
    <!-- 加载动画 -->
    <div class="gen-spinner"></div>

    <!-- 提示文本 -->
    <div class="gen-text">{{ text }}</div>

    <!-- 进度条 -->
    <div class="gen-progress-bar">
      <div class="gen-progress-fill" :style="{ width: progressWidth }"></div>
    </div>
  </div>
</template>

<style scoped>
.generating-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(8, 8, 10, 0.85);
  z-index: 10002;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 16px;
  backdrop-filter: blur(8px);
}

.gen-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border, #2a2a30);
  border-top-color: var(--accent, #00d4aa);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.gen-text {
  font-size: 14px;
  color: var(--text-secondary, #8888a0);
}

.gen-progress-bar {
  width: 200px;
  height: 3px;
  background: var(--border, #2a2a30);
  border-radius: 2px;
  overflow: hidden;
}

.gen-progress-fill {
  height: 100%;
  background: var(--accent, #00d4aa);
  border-radius: 2px;
  transition: width 0.3s ease;
}
</style>