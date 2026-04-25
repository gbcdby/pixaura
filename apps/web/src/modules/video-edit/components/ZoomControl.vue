<script setup lang="ts">
/**
 * 缩放控制组件
 * +/- 按钮 + 百分比/自适应显示
 */

import { NTooltip } from 'naive-ui';

// Props
interface Props {
  zoomLabel: string;
}

defineProps<Props>();

// Emits
const emit = defineEmits<{
  'zoom-in': [];
  'zoom-out': [];
  'auto-fit': [];
}>();
</script>

<template>
  <div class="zoom-control">
    <NTooltip placement="bottom" :delay="500">
      <template #trigger>
        <button class="zoom-btn" @click="emit('auto-fit')">
          <i class="fa-solid fa-compress"></i>
        </button>
      </template>
      <span>自适应</span>
    </NTooltip>
    <button class="zoom-btn" @click="emit('zoom-out')">
      <i class="fa-solid fa-minus"></i>
    </button>
    <span class="zoom-label">{{ zoomLabel }}</span>
    <button class="zoom-btn" @click="emit('zoom-in')">
      <i class="fa-solid fa-plus"></i>
    </button>
  </div>
</template>

<style scoped>
.zoom-control {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
}

.zoom-btn {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--text-muted, #55556a);
  cursor: pointer;
  font-size: 10px;
  transition: all 0.15s;
}

.zoom-btn:hover {
  color: var(--text-primary, #eaeaef);
  background: var(--bg-hover, #2a2a32);
}

.zoom-label {
  font-size: 11px;
  color: var(--text-muted, #55556a);
  font-family: 'JetBrains Mono', monospace;
  min-width: 48px;
  text-align: center;
}
</style>