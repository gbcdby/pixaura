/**
 * 键盘快捷键绑定
 */

import { onMounted, onUnmounted } from 'vue';

/**
 * 键盘快捷键 composable
 */
export function useKeyboard(options: {
  onTogglePlay: () => void;
  onSeek: (delta: number) => void;
  onFrameStep: (direction: 'prev' | 'next') => void;
  onExitFullscreen: () => void;
  onCloseModal: () => void;
}) {
  /**
   * 键盘事件处理
   */
  function handleKeydown(event: KeyboardEvent): void {
    // 忽略输入框中的按键
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement
    ) {
      return;
    }

    switch (event.code) {
      case 'Space':
        event.preventDefault();
        options.onTogglePlay();
        break;

      case 'ArrowLeft':
        event.preventDefault();
        if (event.shiftKey) {
          options.onSeek(-5);
        } else {
          options.onFrameStep('prev');
        }
        break;

      case 'ArrowRight':
        event.preventDefault();
        if (event.shiftKey) {
          options.onSeek(5);
        } else {
          options.onFrameStep('next');
        }
        break;

      case 'Escape':
        options.onExitFullscreen();
        options.onCloseModal();
        break;

      case 'KeyJ':
        options.onSeek(-5);
        break;

      case 'KeyL':
        options.onSeek(5);
        break;

      case 'KeyK':
        options.onTogglePlay();
        break;
    }
  }

  // 绑定事件
  onMounted(() => {
    document.addEventListener('keydown', handleKeydown);
  });

  // 清理
  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown);
  });
}