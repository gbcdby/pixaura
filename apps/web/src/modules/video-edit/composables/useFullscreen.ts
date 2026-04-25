/**
 * 全屏模式管理
 */

import { ref, onUnmounted } from 'vue';
import type { FullscreenMode } from '../types';

/**
 * 全屏控制 composable
 */
export function useFullscreen() {
  // 当前全屏模式
  const fullscreenMode = ref<FullscreenMode>('none');

  // 记录进入视频全屏前的模式（用于退出时恢复）
  const modeBeforeVideoFullscreen = ref<FullscreenMode>('none');

  /**
   * 切换视频全屏
   */
  function toggleVideoFullscreen(): void {
    if (fullscreenMode.value === 'video') {
      // 退出视频全屏，恢复到之前的状态
      fullscreenMode.value = modeBeforeVideoFullscreen.value;
    } else {
      // 进入视频全屏，先记录当前状态
      modeBeforeVideoFullscreen.value = fullscreenMode.value;
      fullscreenMode.value = 'video';
    }
  }

  /**
   * 切换工作区全屏
   */
  function toggleWorkspaceFullscreen(): void {
    fullscreenMode.value =
      fullscreenMode.value === 'workspace' ? 'none' : 'workspace';
  }

  /**
   * 退出全屏
   */
  function exitFullscreen(): void {
    fullscreenMode.value = 'none';
  }

  /**
   * 是否为视频全屏
   */
  const isVideoFullscreen = ref(false);

  /**
   * 是否为工作区全屏
   */
  const isWorkspaceFullscreen = ref(false);

  // 监听全屏模式变化
  import('vue').then(({ watch }) => {
    watch(fullscreenMode, (mode) => {
      isVideoFullscreen.value = mode === 'video';
      isWorkspaceFullscreen.value = mode === 'workspace';
    });
  });

  // 清理
  onUnmounted(() => {
    fullscreenMode.value = 'none';
  });

  return {
    fullscreenMode,
    isVideoFullscreen,
    isWorkspaceFullscreen,
    toggleVideoFullscreen,
    toggleWorkspaceFullscreen,
    exitFullscreen,
  };
}