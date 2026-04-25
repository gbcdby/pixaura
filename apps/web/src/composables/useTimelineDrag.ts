/**
 * 时间轴拖拽逻辑 Composable
 * 用于处理播放头拖拽、片段裁切拖拽、片段移动拖拽
 */
import { ref, computed, onUnmounted, type Ref } from "vue";
import type { Time, DragOptions } from "@/types/video-editor-temp";

export type DragMode = "none" | "playhead" | "trim-start" | "trim-end" | "move";

export interface DragState {
  mode: DragMode;
  targetId: string | null;
  startX: number;
  startTime: Time;
  currentX: number;
  currentTime: Time;
  isDragging: boolean;
}

interface UseTimelineDragOptions extends DragOptions {
  containerRef: Ref<HTMLElement | null>;
  pixelsPerSecond: number;
  scrollLeft?: number; // 当前滚动位置
  snapToGrid?: boolean; // 是否吸附到网格
  gridInterval?: Time; // 网格间隔（秒）
}

export function useTimelineDrag(options: UseTimelineDragOptions) {
  const {
    containerRef,
    pixelsPerSecond,
    scrollLeft = 0,
    onSeek,
    onTrim,
    onMove,
    snapToGrid = false,
    gridInterval = 1,
  } = options;

  const dragState = ref<DragState>({
    mode: "none",
    targetId: null,
    startX: 0,
    startTime: 0,
    currentX: 0,
    currentTime: 0,
    isDragging: false,
  });

  // 计算吸附时间
  const snapTime = (time: Time): Time => {
    if (!snapToGrid) return time;
    return Math.round(time / gridInterval) * gridInterval;
  };

  // 像素转时间
  const pxToTime = (px: number): Time => {
    return snapTime(px / pixelsPerSecond);
  };

  // 时间转像素
  const timeToPx = (time: Time): number => {
    return time * pixelsPerSecond;
  };

  // 当前拖拽偏移量（秒）
  const dragOffset = computed(() => {
    if (!dragState.value.isDragging) return 0;
    return pxToTime(dragState.value.currentX - dragState.value.startX);
  });

  // ========== 拖拽开始 ==========

  /**
   * 开始播放头拖拽
   */
  const startPlayheadDrag = (event: MouseEvent | TouchEvent) => {
    const clientX = getClientX(event);
    const rect = containerRef.value?.getBoundingClientRect();
    if (!rect) return;

    const x = clientX - rect.left + scrollLeft;
    const time = pxToTime(x);

    dragState.value = {
      mode: "playhead",
      targetId: null,
      startX: x,
      startTime: time,
      currentX: x,
      currentTime: time,
      isDragging: true,
    };

    onSeek?.(time);
    bindDragEvents();
  };

  /**
   * 开始裁切拖拽
   */
  const startTrimDrag = (
    event: MouseEvent | TouchEvent,
    clipId: string,
    edge: "start" | "end",
    currentTrimTime: Time,
  ) => {
    const clientX = getClientX(event);

    dragState.value = {
      mode: edge === "start" ? "trim-start" : "trim-end",
      targetId: clipId,
      startX: clientX,
      startTime: currentTrimTime,
      currentX: clientX,
      currentTime: currentTrimTime,
      isDragging: true,
    };

    bindDragEvents();
  };

  /**
   * 开始移动拖拽
   */
  const startMoveDrag = (
    event: MouseEvent | TouchEvent,
    clipId: string,
    currentTimelineStart: Time,
  ) => {
    const clientX = getClientX(event);

    dragState.value = {
      mode: "move",
      targetId: clipId,
      startX: clientX,
      startTime: currentTimelineStart,
      currentX: clientX,
      currentTime: currentTimelineStart,
      isDragging: true,
    };

    bindDragEvents();
  };

  // ========== 拖拽进行 ==========

  const handleDragMove = (event: MouseEvent | TouchEvent) => {
    if (!dragState.value.isDragging) return;

    const clientX = getClientX(event);

    if (dragState.value.mode === "playhead") {
      const rect = containerRef.value?.getBoundingClientRect();
      if (!rect) return;

      const x = clientX - rect.left + scrollLeft;
      const time = pxToTime(x);

      dragState.value.currentX = x;
      dragState.value.currentTime = time;
      onSeek?.(time);
    } else {
      const deltaX = clientX - dragState.value.startX;
      const deltaTime = pxToTime(deltaX);

      dragState.value.currentX = clientX;
      dragState.value.currentTime = dragState.value.startTime + deltaTime;
    }
  };

  // ========== 拖拽结束 ==========

  const handleDragEnd = () => {
    if (!dragState.value.isDragging) return;

    const { mode, targetId, currentTime, startTime } = dragState.value;

    if (mode === "trim-start" && targetId) {
      const newTrimStart = Math.max(0, currentTime);
      onTrim?.(targetId, "left", newTrimStart - startTime);
    } else if (mode === "trim-end" && targetId) {
      const newTrimEnd = currentTime;
      onTrim?.(targetId, "right", newTrimEnd - startTime);
    } else if (mode === "move" && targetId) {
      const newTimelineStart = currentTime;
      onMove?.(targetId, newTimelineStart - startTime);
    }

    // 重置状态
    dragState.value = {
      mode: "none",
      targetId: null,
      startX: 0,
      startTime: 0,
      currentX: 0,
      currentTime: 0,
      isDragging: false,
    };

    unbindDragEvents();
  };

  // ========== 事件绑定 ==========

  const bindDragEvents = () => {
    document.addEventListener("mousemove", handleDragMove);
    document.addEventListener("mouseup", handleDragEnd);
    document.addEventListener("touchmove", handleDragMove, { passive: false });
    document.addEventListener("touchend", handleDragEnd);
  };

  const unbindDragEvents = () => {
    document.removeEventListener("mousemove", handleDragMove);
    document.removeEventListener("mouseup", handleDragEnd);
    document.removeEventListener("touchmove", handleDragMove);
    document.removeEventListener("touchend", handleDragEnd);
  };

  // 清理
  onUnmounted(() => {
    unbindDragEvents();
  });

  // ========== 辅助函数 ==========

  const getClientX = (event: MouseEvent | TouchEvent): number => {
    if (event instanceof MouseEvent) {
      return event.clientX;
    }
    return event.touches[0]?.clientX || 0;
  };

  // ========== 返回 ==========

  return {
    dragState,
    dragOffset,
    startPlayheadDrag,
    startTrimDrag,
    startMoveDrag,
    pxToTime,
    timeToPx,
    snapTime,
  };
}

/**
 * 时间轴滚动逻辑
 */
export function useTimelineScroll(
  containerRef: Ref<HTMLElement | null>,
  options: {
    onScroll?: (scrollLeft: number) => void;
    pixelsPerSecond: number;
    totalDuration: Time;
  },
) {
  const isScrolling = ref(false);
  const scrollLeft = ref(0);

  const handleScroll = () => {
    if (!containerRef.value) return;
    scrollLeft.value = containerRef.value.scrollLeft;
    isScrolling.value = true;
    options.onScroll?.(scrollLeft.value);
  };

  const handleScrollEnd = () => {
    isScrolling.value = false;
  };

  /**
   * 滚动到指定时间
   */
  const scrollToTime = (time: Time) => {
    if (!containerRef.value) return;
    const x = time * options.pixelsPerSecond;
    containerRef.value.scrollLeft = x;
  };

  /**
   * 滚动到指定时间并居中
   */
  const scrollToTimeCentered = (time: Time) => {
    if (!containerRef.value) return;
    const x = time * options.pixelsPerSecond;
    const containerWidth = containerRef.value.clientWidth;
    containerRef.value.scrollLeft = x - containerWidth / 2;
  };

  /**
   * 确保当前时间可见
   */
  const ensureTimeVisible = (time: Time) => {
    if (!containerRef.value) return;
    const x = time * options.pixelsPerSecond;
    const containerWidth = containerRef.value.clientWidth;
    const currentScrollLeft = containerRef.value.scrollLeft;

    // 如果时间点不在可视区域内，滚动使其可见
    if (x < currentScrollLeft || x > currentScrollLeft + containerWidth) {
      scrollToTimeCentered(time);
    }
  };

  return {
    isScrolling,
    scrollLeft,
    handleScroll,
    handleScrollEnd,
    scrollToTime,
    scrollToTimeCentered,
    ensureTimeVisible,
  };
}
