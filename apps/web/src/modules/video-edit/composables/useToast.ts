/**
 * Toast 提示管理
 */

import { ref } from 'vue';
import type { ToastMessage, ToastType } from '../types';

// Toast 最大显示数量
const MAX_TOASTS = 5;

// Toast 显示时长（毫秒）
const TOAST_DURATION = 2500;

/**
 * Toast 管理 composable
 */
export function useToast() {
  // Toast 列表
  const toasts = ref<ToastMessage[]>([]);

  /**
   * 显示 Toast
   */
  function showToast(message: string, type: ToastType = 'success'): void {
    const iconMap: Record<ToastType, string> = {
      success: 'fa-circle-check',
      error: 'fa-exclamation-triangle',
      info: 'fa-info-circle',
    };

    const toast: ToastMessage = {
      id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      message,
      icon: iconMap[type],
      type,
    };

    toasts.value.push(toast);

    // 限制数量
    if (toasts.value.length > MAX_TOASTS) {
      toasts.value.shift();
    }

    // 自动移除
    setTimeout(() => {
      removeToast(toast.id);
    }, TOAST_DURATION);
  }

  /**
   * 移除 Toast
   */
  function removeToast(id: string): void {
    const index = toasts.value.findIndex((t) => t.id === id);
    if (index !== -1) {
      toasts.value.splice(index, 1);
    }
  }

  return {
    toasts,
    showToast,
    removeToast,
  };
}