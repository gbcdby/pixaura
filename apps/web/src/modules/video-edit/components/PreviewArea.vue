<script setup lang="ts">
/**
 * 预览区组件
 * 视频播放 + 全屏 Overlay + 空状态占位 + 字幕显示
 *
 * 布局结构：
 * - preview-container: 填满父容器（preview-area，固定 16:9）
 * - preview-scaler: 通过 CSS transform: scale 整体缩放，使 preview-wrapper 填满容器
 * - preview-wrapper: 固定为视频原始分辨率（如 1080×1920），与导出坐标系一致
 */

import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { wrapSubtitleText } from '@/utils/subtitleWrap';
import type { TrackState } from '../types';

// 字幕项类型
interface SubtitleItem {
  text: string; // 字幕文本
  startTime: number; // 开始时间（秒）
  endTime: number; // 结束时间（秒）
  characterName?: string; // 角色名称（可选）
}

// Props
interface Props {
  videoElementA: HTMLVideoElement | null;
  videoElementB: HTMLVideoElement | null;
  activeVideoIndex: number;
  isVideoFullscreen: boolean;
  hasBlackScreen: boolean; // 是否当前是黑屏状态
  hasAnyVideoSource: boolean; // 是否有任何可播放的视频素材
  totalClips: number; // 总片段数
  aspectRatio?: string; // 视频宽高比，如 "16/9"、"9/16"、"1/1"
  subtitles?: SubtitleItem[]; // 字幕数据列表
  currentTime?: number; // 当前播放时间（秒）
  trackStates?: TrackState[]; // 轨道状态
}

const props = withDefaults(defineProps<Props>(), {
  aspectRatio: '9/16',
  subtitles: () => [],
  currentTime: 0,
  trackStates: () => [],
});

// 视频轨道是否被禁用（索引 0：V1 视频 1）
const isVideoTrackMuted = computed(() => props.trackStates?.[0]?.muted ?? false);

// 字幕轨道是否被禁用（索引 1：T1 字幕）
const isSubtitleTrackMuted = computed(() => props.trackStates?.[1]?.muted ?? false);

// 预览容器和包装器引用
const previewContainerRef = ref<HTMLElement | null>(null);
const previewWrapperRef = ref<HTMLElement | null>(null);

// ResizeObserver 实例
let resizeObserver: ResizeObserver | null = null;

// 容器尺寸
const containerSize = ref({ width: 0, height: 0 });

// 从 aspectRatio 解析视频原始分辨率，兼容比例值（如 "9/16"）与像素值（如 "1080/1920"）
function parseVideoResolution(ratio: string): { width: number; height: number } {
  const parts = ratio.split('/');
  if (parts.length !== 2) {
    return { width: 1080, height: 1920 };
  }
  let width = parseFloat(parts[0]) || 1080;
  let height = parseFloat(parts[1]) || 1920;

  // 如果值看起来是比例而非像素（< 100），按 1080p 基准推算
  if (width < 100 && height < 100) {
    const baseHeight = 1920;
    const scale = baseHeight / height;
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  return { width, height };
}

// 视频原始分辨率（固定，与导出坐标系一致）
const videoResolution = computed(() => parseVideoResolution(props.aspectRatio));

// preview-wrapper 固定为视频原始分辨率
const wrapperSize = computed(() => videoResolution.value);

// preview-scaler 的整体缩放比例：使固定分辨率的 preview-wrapper 填满 preview-container
const previewScale = computed(() => {
  const { width: cw, height: ch } = containerSize.value;
  const { width: vw, height: vh } = videoResolution.value;
  const padding = 8;

  if (cw <= 0 || ch <= 0) {
    return 1;
  }

  const maxW = cw - padding * 2;
  const maxH = ch - padding * 2;

  return Math.min(maxW / vw, maxH / vh);
});

// 当前播放时间对应的字幕
const currentSubtitle = computed(() => {
  const time = props.currentTime;
  if (!props.subtitles || props.subtitles.length === 0) return null;

  // 找到当前时间范围内的字幕
  for (const subtitle of props.subtitles) {
    if (time >= subtitle.startTime && time < subtitle.endTime) {
      return subtitle;
    }
  }
  return null;
});

// 字幕文本按容器宽度智能换行（Canvas 测量）
const FONT_FAMILY = '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';

// 基准视频对角线：1080×1920（竖屏标准分辨率）
const BASE_VIDEO_DIAGONAL = Math.sqrt(1080 * 1080 + 1920 * 1920);

// 分辨率缩放：只与视频原始分辨率有关，与容器大小无关
const resolutionScale = computed(() => {
  const { width, height } = videoResolution.value;
  const videoDiagonal = Math.sqrt(width * width + height * height);
  return videoDiagonal / BASE_VIDEO_DIAGONAL;
});

// 字幕在 preview-wrapper（固定视频分辨率画布）上的绝对像素尺寸
// 基准值 48px 对应 1080×1920 标准竖屏分辨率，与导出侧 defaultStyle 保持一致
const subtitleFontSize = computed(() => Math.round(48 * resolutionScale.value));
const subtitleYOffset = computed(() => Math.round(55 * resolutionScale.value));

const wrappedSubtitleText = computed(() => {
  if (!currentSubtitle.value) return '';

  const { width } = wrapperSize.value;
  if (width <= 0) return currentSubtitle.value.text;

  const containerWidth = width * 0.9 * 0.92;
  return wrapSubtitleText(currentSubtitle.value.text, containerWidth, subtitleFontSize.value, 500, FONT_FAMILY);
});

// 将双视频元素移动到预览包装器
function moveVideosToWrapper(): void {
  if (!previewWrapperRef.value) return;

  [props.videoElementA, props.videoElementB].forEach((videoEl, index) => {
    if (!videoEl) return;

    // 设置视频元素样式
    videoEl.style.display = 'block';
    videoEl.style.width = '100%';
    videoEl.style.height = '100%';
    videoEl.style.objectFit = 'contain';
    videoEl.style.background = '#000';
    videoEl.style.position = 'absolute';
    videoEl.style.top = '0';
    videoEl.style.left = '0';
    videoEl.style.opacity = index === props.activeVideoIndex ? '1' : '0';
    videoEl.style.zIndex = index === props.activeVideoIndex ? '1' : '0';

    // 移动到预览包装器（如果不在其中）
    if (previewWrapperRef.value && videoEl.parentElement !== previewWrapperRef.value) {
      previewWrapperRef.value.appendChild(videoEl);
    }
  });
}

// 更新容器尺寸
function updateContainerSize(): void {
  if (previewContainerRef.value) {
    containerSize.value = {
      width: previewContainerRef.value.clientWidth,
      height: previewContainerRef.value.clientHeight,
    };
  }
}

// 监听双视频元素和活跃索引变化
watch(
  () => [props.videoElementA, props.videoElementB, props.activeVideoIndex],
  () => {
    nextTick(() => {
      moveVideosToWrapper();
    });
  },
  { immediate: true },
);

// 监听全屏状态变化
watch(
  () => props.isVideoFullscreen,
  () => {
    nextTick(() => {
      moveVideosToWrapper();
      updateContainerSize();
    });
  },
);

// 监听 aspectRatio 变化
watch(
  () => props.aspectRatio,
  () => {
    nextTick(() => {
      updateContainerSize();
    });
  },
);

onMounted(() => {
  updateContainerSize();
  moveVideosToWrapper();

  // ResizeObserver 监听容器尺寸变化
  if (previewContainerRef.value) {
    resizeObserver = new ResizeObserver(() => {
      updateContainerSize();
    });
    resizeObserver.observe(previewContainerRef.value);
  }
});

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
});
</script>

<template>
  <div ref="previewContainerRef" class="preview-container">
    <!-- 背景装饰 -->
    <div class="preview-glow"></div>

    <!-- 整体缩放层：将固定分辨率的 preview-wrapper 缩放到容器大小 -->
    <div class="preview-scaler" :style="{ transform: `scale(${previewScale})` }">
      <!-- 视频包装器：固定为视频原始分辨率，与导出坐标系一致 -->
      <div
        ref="previewWrapperRef"
        class="preview-wrapper"
        :class="{ 'video-track-muted': isVideoTrackMuted }"
        :style="{
          width: wrapperSize.width + 'px',
          height: wrapperSize.height + 'px',
        }"
      >
        <!-- 无任何视频素材时的占位 -->
        <div v-if="!hasAnyVideoSource" class="video-empty-placeholder" :style="{ transform: `scale(${subtitleFontSize / 24})` }">
          <div class="empty-icon-wrapper">
            <i class="fa-solid fa-video-slash"></i>
          </div>
          <div class="empty-title">暂无视频素材</div>
          <div class="empty-desc">请先完成分镜视频生成，再进行合成预览</div>
          <div class="empty-hint">
            <i class="fa-solid fa-lightbulb"></i>
            <span>在分镜步骤中点击"生成视频"按钮</span>
          </div>
        </div>

        <!-- 黑屏片段占位（有其他视频素材但当前片段无视频） -->
        <div v-else-if="hasBlackScreen" class="video-black-placeholder">
          <div class="black-icon-wrapper">
            <i class="fa-solid fa-hourglass-half"></i>
          </div>
          <div class="black-title">等待生成</div>
          <div class="black-desc">当前片段视频尚未生成完成</div>
        </div>

        <!-- 字幕显示层（固定在底部） -->
        <div
          v-if="currentSubtitle && !isSubtitleTrackMuted"
          class="subtitle-layer"
          :style="{ bottom: subtitleYOffset + 'px' }"
        >
          <div class="subtitle-text" :style="{ fontSize: subtitleFontSize + 'px' }">
            {{ wrappedSubtitleText }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.preview-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.preview-glow {
  position: absolute;
  width: 400px;
  height: 400px;
  background: radial-gradient(
    circle,
    rgba(0, 212, 170, 0.03) 0%,
    transparent 70%
  );
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.preview-scaler {
  transform-origin: center center;
  will-change: transform;
}

.preview-wrapper {
  position: relative;
  background: #000;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
}

/* 视频元素样式（通过 JS 设置） */
.preview-wrapper video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
}

/* 视频轨道禁用时隐藏视频画面（通过 CSS 覆盖 VideoEditor 的 opacity 控制） */
/* 使用 :deep() 匹配通过 JS 动态移入的 video 元素 */
.preview-wrapper.video-track-muted :deep(video) {
  opacity: 0 !important;
}

/* 无任何视频素材的空状态 */
.video-empty-placeholder {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: linear-gradient(135deg, #0f0f12 0%, #18181b 100%);
  padding: 40px;
}

.empty-icon-wrapper {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.1);
}

.empty-icon-wrapper i {
  font-size: 32px;
  color: var(--text-muted, #55556a);
}

.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-secondary, #9999a3);
  letter-spacing: 0.5px;
}

.empty-desc {
  font-size: 13px;
  color: var(--text-muted, #55556a);
  max-width: 280px;
  text-align: center;
  line-height: 1.6;
}

.empty-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--accent, #00d4aa);
  background: rgba(0, 212, 170, 0.1);
  padding: 8px 16px;
  border-radius: 8px;
  margin-top: 8px;
}

.empty-hint i {
  font-size: 14px;
}

/* 黑屏片段占位 */
.video-black-placeholder {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: rgba(0, 0, 0, 0.8);
}

.black-icon-wrapper {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 50%;
}

.black-icon-wrapper i {
  font-size: 20px;
  color: rgba(255, 255, 255, 0.4);
  animation: pulse 1.5s ease-in-out infinite;
}

.black-title {
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.5);
}

.black-desc {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.3);
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.4;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.05);
  }
}

/* 字幕显示层 */
.subtitle-layer {
  position: absolute;
  left: 0;
  width: 100%;
  padding: 0 8px;
  display: flex;
  justify-content: center;
  z-index: 5;
}

.subtitle-text {
  font-family: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
  font-weight: 500;
  color: #fff;
  text-align: center;
  max-width: 90%;
  line-height: 1.6;
  white-space: pre-line;
  overflow-wrap: break-word;
  /* 白字黑边效果：多层阴影模拟描边 */
  text-shadow:
    -2px -2px 0 #000,
    2px -2px 0 #000,
    -2px 2px 0 #000,
    2px 2px 0 #000,
    0 0 8px #000;
}
</style>