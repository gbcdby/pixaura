<script setup lang="ts">
/**
 * Toast 提示容器组件
 */

import type { ToastMessage } from '../types';

// Props
interface Props {
  toasts: ToastMessage[];
}

defineProps<Props>();

// Emits
const emit = defineEmits<{
  'remove': [id: string];
}>();

// 移除 Toast（带动画）
function removeToast(id: string): void {
  emit('remove', id);
}
</script>

<template>
  <div class="toast-container">
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="toast"
        @click="removeToast(toast.id)"
      >
        <i :class="'fa-solid ' + toast.icon"></i>
        {{ toast.message }}
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-container {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.toast {
  padding: 10px 16px;
  background: var(--bg-elevated, #222228);
  border: 1px solid var(--border-light, #3a3a42);
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-primary, #eaeaef);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.toast i {
  color: var(--accent, #00d4aa);
}

/* Vue Transition 动画 */
.toast-enter-active {
  animation: toastIn 0.3s ease;
}

.toast-leave-active {
  animation: toastOut 0.3s ease forwards;
}

@keyframes toastIn {
  from {
    opacity: 0;
    transform: translateX(30px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes toastOut {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(30px);
  }
}
</style>