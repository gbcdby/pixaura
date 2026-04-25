/**
 * 时间轴缩放控制
 * 支持以鼠标位置为中心的缩放
 */

import { ref, computed, nextTick } from 'vue';

// 基础每秒像素数
const BASE_PPS = 20;

// 缩放范围
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 8;

/**
 * 缩放控制 composable
 */
export function useZoom() {
  // 缩放级别（1 = 100%）
  const zoom = ref(1);

  // 是否为自适应模式
  const isAutoFit = ref(true);

  // 每秒像素数
  const pixelsPerSecond = computed(() => BASE_PPS * zoom.value);

  /**
   * 放大
   */
  function zoomIn(): void {
    zoom.value = Math.min(MAX_ZOOM, zoom.value * 1.25);
    isAutoFit.value = false;
  }

  /**
   * 缩小
   */
  function zoomOut(): void {
    zoom.value = Math.max(MIN_ZOOM, zoom.value / 1.25);
    isAutoFit.value = false;
  }

  /**
   * 自适应缩放（根据容器宽度自动调整）
   * 只在 isAutoFit 为 true 时执行
   */
  function autoFit(containerWidth: number, totalDuration: number): void {
    // 如果用户已手动调整缩放，不再自动适配
    if (!isAutoFit.value) return;

    if (totalDuration <= 0) return;

    const availWidth = containerWidth - 40;
    if (availWidth <= 0) return;

    zoom.value = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, availWidth / totalDuration / BASE_PPS));
    // 保持 isAutoFit 为 true
  }

  /**
   * 设置缩放级别（滚轮缩放时使用）
   */
  function setZoom(newZoom: number): void {
    zoom.value = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
    isAutoFit.value = false;
  }

  /**
   * 以指定时间点为中心进行缩放
   * @param newZoom 新的缩放级别
   * @param centerTime 缩放中心的时间（秒）
   * @param scrollContainer 滚动容器元素
   * @param labelWidth 左侧标签宽度
   */
  function zoomAtPoint(
    newZoom: number,
    centerTime: number,
    scrollContainer: HTMLElement | null,
    _labelWidth: number = 160,
  ): void {
    if (!scrollContainer) return;

    const oldZoom = zoom.value;
    const oldPPS = BASE_PPS * oldZoom;
    const newPPS = BASE_PPS * newZoom;

    // 刻度偏移（时间轴起点偏移量）
    const TIME_OFFSET = 20;

    // 计算中心点在旧缩放级别下的像素位置（相对于时间轴内容起点）
    const oldCenterPx = centerTime * oldPPS + TIME_OFFSET;

    // 计算中心点在当前视口中的相对位置（减去标签宽度，因为标签占据左侧空间）
    const oldScrollLeft = scrollContainer.scrollLeft;
    const centerInViewport = oldCenterPx - oldScrollLeft;

    // 设置新的缩放级别
    zoom.value = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
    isAutoFit.value = false;

    // 使用 nextTick 确保 DOM 更新（内容宽度变化）后再调整滚动位置
    nextTick(() => {
      // 计算中心点在新缩放级别下的像素位置
      const newCenterPx = centerTime * newPPS + TIME_OFFSET;

      // 保持中心点在视口中的相同位置
      const newScrollLeft = newCenterPx - centerInViewport;
      scrollContainer.scrollLeft = Math.max(0, newScrollLeft);
    });
  }

  /**
   * 缩放标签显示文本（永远显示百分比）
   */
  const zoomLabel = computed(() => {
    return `${Math.round(zoom.value * 100)}%`;
  });

  /**
   * 显式触发自适应缩放（点击自适应按钮时使用）
   */
  function triggerAutoFit(containerWidth: number, totalDuration: number): void {
    if (totalDuration <= 0) return;

    const availWidth = containerWidth - 40;
    if (availWidth <= 0) return;

    zoom.value = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, availWidth / totalDuration / BASE_PPS));
    isAutoFit.value = true;
  }

  return {
    zoom,
    isAutoFit,
    pixelsPerSecond,
    zoomLabel,
    zoomIn,
    zoomOut,
    autoFit,
    setZoom,
    zoomAtPoint,
    triggerAutoFit,
  };
}