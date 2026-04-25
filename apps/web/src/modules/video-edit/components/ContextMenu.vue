<script setup lang="ts">
/**
 * 右键菜单组件
 * 显示视频片段的操作选项
 */

import { computed, onMounted, onUnmounted } from 'vue';

// Props
interface Props {
  visible: boolean;
  x: number;
  y: number;
  clipHasVideo: boolean; // 是否有实际视频（非黑屏）
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  'close': [];
  'generate-music': []; // 为视频生成配乐
}>();

// 菜单位置（确保不超出屏幕）
const menuStyle = computed(() => {
  const menuWidth = 180;
  const menuHeight = 120;

  let x = props.x;
  let y = props.y;

  // 确保不超出右边界
  if (x + menuWidth > window.innerWidth) {
    x = window.innerWidth - menuWidth - 10;
  }

  // 确保不超出下边界
  if (y + menuHeight > window.innerHeight) {
    y = window.innerHeight - menuHeight - 10;
  }

  return {
    left: x + 'px',
    top: y + 'px',
  };
});

// 关闭菜单
function handleClose(): void {
  emit('close');
}

// 点击菜单项
function handleGenerateMusic(): void {
  if (!props.clipHasVideo) return; // 无视频时禁止点击
  emit('generate-music');
  handleClose();
}

// 点击外部关闭菜单
function handleClickOutside(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  if (!target.closest('.context-menu')) {
    handleClose();
  }
}

// ESC 关闭菜单
function handleKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    handleClose();
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  document.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  document.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <div
    v-if="visible"
    class="context-menu"
    :style="menuStyle"
  >
    <!-- 为视频生成配乐 -->
    <div
      class="menu-item"
      :class="{ disabled: !clipHasVideo }"
      @click="handleGenerateMusic"
    >
      <i class="fa-solid fa-wand-magic-sparkles"></i>
      <span>为视频生成配乐</span>
      <span v-if="!clipHasVideo" class="disabled-hint">(无视频)</span>
    </div>
  </div>
</template>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 10000;
  background: var(--bg-surface, #18181d);
  border: 1px solid var(--border, #2a2a30);
  border-radius: 8px;
  padding: 6px 0;
  min-width: 180px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  cursor: pointer;
  transition: all 0.15s;
  color: var(--text-secondary, #8888a0);
  font-size: 13px;
}

.menu-item:hover {
  background: var(--bg-hover, #2a2a32);
  color: var(--text-primary, #eaeaef);
}

.menu-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.menu-item.disabled:hover {
  background: transparent;
  color: var(--text-secondary, #8888a0);
}

.menu-item i {
  font-size: 14px;
  width: 16px;
  text-align: center;
}

.menu-item.disabled-hint {
  font-size: 11px;
  color: var(--text-muted, #55556a);
  margin-left: auto;
}
</style>