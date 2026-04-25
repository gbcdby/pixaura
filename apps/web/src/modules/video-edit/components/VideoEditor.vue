<script setup lang="ts">
/**
 * 视频编辑器主组件
 * 整合预览区、控制栏、时间轴
 */

import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import PreviewArea from './PreviewArea.vue';
import ControlsBar from './ControlsBar.vue';
import TimelineArea from './TimelineArea.vue';
import AIMusicModal from './AIMusicModal.vue';
import ClipMusicModal from './ClipMusicModal.vue';
import ContextMenu from './ContextMenu.vue';
import ToastContainer from './ToastContainer.vue';
import GeneratingOverlay from './GeneratingOverlay.vue';
import { useZoom } from '../composables/useZoom';
import { useKeyboard } from '../composables/useKeyboard';
import { useFullscreen } from '../composables/useFullscreen';
import { useToast } from '../composables/useToast';
import { formatTime } from '../utils/timeFormat';
import type {
  VideoSource,
  TrackState,
  TimelineData,
  ClipInfo,
  Clip,
  SubtitleItem,
} from '../types';

// Props
interface Props {
  projectId: string;
  scriptId: string;
  videoSources: VideoSource[];
  timelineData: TimelineData;
  subtitles: SubtitleItem[];
  videoDurationCache: Map<string, number>;
  aspectRatio?: string; // 视频宽高比，如 "16/9"、"9/16"、"1/1"
}

const props = withDefaults(defineProps<Props>(), {
  aspectRatio: '9/16',
});

// Emits
const emit = defineEmits<{
  'update:status': [status: 'waiting' | 'processing' | 'completed'];
  'request-auto-fit': [containerWidth: number, totalDuration: number];
  'generate-ai-music': [style: string, duration: number, start: number];
  'generate-clip-music': [style: string, duration: number, clip: Clip];
  'fullscreen-change': [payload: { video: boolean; workspace: boolean }];
}>();

// ==================== 数据构建 ====================

// 视频源、时间轴、字幕均由父组件通过 props 传入，保证合成与导出数据源统一

// 是否有任何可播放的视频素材（非黑屏）
const hasAnyVideoSource = computed(() => {
  return props.videoSources.some((v) => !v.isBlackScreen && v.url);
});

// ==================== 轨道状态 ====================

// 轨道状态（音量、静音）
const trackStates = ref<TrackState[]>(
  props.timelineData.tracks.map(() => ({ volume: 80, muted: false })),
);

// 初始化轨道状态
watch(
  () => props.timelineData.tracks.length,
  () => {
    trackStates.value = props.timelineData.tracks.map((_, idx) => {
      // 保留已有状态或创建新状态
      return trackStates.value[idx] || { volume: 80, muted: false };
    });
  },
  { immediate: true },
);

// ==================== 播放器 ====================

// 模拟 currentTime 和 isPlaying（由于 useVideoPlayer 需要 ref）
const currentTimeRef = ref(0);
const isPlayingRef = ref(false);

// 双 video 元素（用于无缝切换）
const videoElementA = ref<HTMLVideoElement | null>(null);
const videoElementB = ref<HTMLVideoElement | null>(null);

// 旁白音频元素（用于同步播放）
const narrationAudioElements = ref<Map<string, HTMLAudioElement>>(new Map());

// 当前活跃元素索引 (0 = A, 1 = B)
const activeVideoIndex = ref(0);

// 预加载状态
const preloadState = ref<{
  index: number;       // 预加载的片段索引
  ready: boolean;      // 是否已准备好
  videoIndex: number;  // 使用哪个元素预加载
}>({ index: -1, ready: false, videoIndex: -1 });

// 计算属性：当前活跃元素和备用元素
const activeVideoElement = computed(() =>
  activeVideoIndex.value === 0 ? videoElementA.value : videoElementB.value
);
const inactiveVideoElement = computed(() =>
  activeVideoIndex.value === 0 ? videoElementB.value : videoElementA.value
);

// 手动管理播放逻辑（避免复杂的 composable 依赖）
const currentClipIndex = ref(0);
const isSeeking = ref(false);
const videoSwitching = ref(false);
let playInterval: number | null = null;

const FPS = 30;

// 可播放时长
const playableDuration = computed(() => {
  return props.timelineData.totalDuration || 0.1;
});

// 获取当前片段索引
function getClipIndex(time: number): number {
  const clips = props.timelineData.tracks[0]?.clips || [];
  for (let i = 0; i < clips.length; i++) {
    if (time >= clips[i].start && time < clips[i].start + clips[i].duration) {
      return i;
    }
  }
  return clips.length - 1;
}

/**
 * 开始预加载下一个片段
 * 使用备用 video 元素预加载，为无缝切换做准备
 */
function startPreloadNextClip(): void {
  const nextIndex = currentClipIndex.value + 1;

  if (nextIndex >= props.videoSources.length) {
    preloadState.value = { index: -1, ready: false, videoIndex: -1 };
    return;
  }

  const nextVideo = props.videoSources[nextIndex];

  // 黑屏片段标记为已准备好
  if (nextVideo.isBlackScreen || !nextVideo.url) {
    preloadState.value = { index: nextIndex, ready: true, videoIndex: -1 };
    return;
  }

  const preloadElement = inactiveVideoElement.value;
  if (!preloadElement) return;

  preloadState.value = {
    index: nextIndex,
    ready: false,
    videoIndex: activeVideoIndex.value === 0 ? 1 : 0,
  };

  preloadElement.src = nextVideo.url;
  preloadElement.currentTime = 0;
  preloadElement.muted = true;
  preloadElement.pause();

  preloadElement.onloadeddata = () => {
    preloadState.value.ready = true;
  };
}

/**
 * 清除预加载状态
 * 用于远距离跳转或暂停时清理
 */
function clearPreload(): void {
  const inactive = inactiveVideoElement.value;
  if (inactive) {
    inactive.src = '';
    inactive.onloadeddata = null;
  }
  preloadState.value = { index: -1, ready: false, videoIndex: -1 };
}

/**
 * 双 video 元素切换片段
 * 处理三种情况：
 * 1. 黑屏片段 - 隐藏当前视频
 * 2. 预加载已准备好 - 无缝切换到预加载元素
 * 3. 远距离跳转 - 直接切换 src（允许短暂跳动）
 */
function switchVideoClipDual(idx: number, localTime: number): void {
  if (idx === currentClipIndex.value) return;

  const video = props.videoSources[idx];
  if (!video) return;

  // 情况1: 黑屏片段
  if (video.isBlackScreen || !video.url) {
    if (activeVideoElement.value) {
      activeVideoElement.value.style.opacity = '0';
      activeVideoElement.value.pause();
    }
    currentClipIndex.value = idx;
    videoSwitching.value = false;
    return;
  }

  // 情况2: 预加载已准备好（连续播放）
  if (preloadState.value.index === idx && preloadState.value.ready) {
    const newActiveIndex = preloadState.value.videoIndex;

    if (activeVideoElement.value) {
      activeVideoElement.value.style.opacity = '0';
      activeVideoElement.value.pause();
    }

    const newActiveEl = newActiveIndex === 0 ? videoElementA.value : videoElementB.value;
    if (newActiveEl) {
      newActiveEl.style.opacity = '1';
      newActiveEl.muted = trackStates.value[0].muted;
      newActiveEl.volume = trackStates.value[0].volume / 100;
      newActiveEl.currentTime = Math.max(0, localTime);

      if (isPlayingRef.value) {
        newActiveEl.play().catch(() => {});
      }
    }

    activeVideoIndex.value = newActiveIndex;
    currentClipIndex.value = idx;
    videoSwitching.value = false;
    startPreloadNextClip();
    return;
  }

  // 情况3: 远距离跳转 - 直接切换 src
  clearPreload();

  const activeEl = activeVideoElement.value;
  if (!activeEl) return;

  videoSwitching.value = true;
  activeEl.style.opacity = '1'; // 恢复可见状态（黑屏片段后需要）
  activeEl.src = video.url;
  activeEl.muted = trackStates.value[0].muted;
  activeEl.volume = trackStates.value[0].muted ? 0 : trackStates.value[0].volume / 100;
  activeEl.currentTime = Math.max(0, localTime);

  if (isPlayingRef.value && !trackStates.value[0].muted) {
    activeEl.play().catch(() => {});
  }

  setTimeout(() => {
    videoSwitching.value = false;
    startPreloadNextClip();
  }, 200);

  currentClipIndex.value = idx;
}

// 同步视频（使用双元素切换）
function syncVideo(time: number): void {
  if (isSeeking.value || videoSwitching.value) return;

  const idx = getClipIndex(time);
  const clips = props.timelineData.tracks[0]?.clips || [];
  const clip = clips[idx];
  if (!clip) return;

  const localTime = time - clip.start;

  if (idx !== currentClipIndex.value) {
    switchVideoClipDual(idx, localTime);
  } else if (activeVideoElement.value) {
    if (Math.abs(activeVideoElement.value.currentTime - localTime) > 0.15) {
      activeVideoElement.value.currentTime = localTime;
    }
  }
}

// ==================== 缩放 ====================

const {
  zoom,
  pixelsPerSecond,
  zoomLabel,
  zoomIn: _zoomIn,
  zoomOut: _zoomOut,
  autoFit,
  setZoom: _setZoom,
  zoomAtPoint,
  triggerAutoFit,
} = useZoom();

// ==================== 全屏 ====================

const {
  isVideoFullscreen,
  isWorkspaceFullscreen,
  toggleVideoFullscreen,
  toggleWorkspaceFullscreen,
  exitFullscreen,
} = useFullscreen();

// 处理退出全屏（Escape 键）- 视频全屏时智能恢复之前状态
function handleExitFullscreen(): void {
  if (isVideoFullscreen.value) {
    toggleVideoFullscreen();
  } else {
    exitFullscreen();
  }
}

// 监听全屏状态变化并通知父组件
watch(
  [isVideoFullscreen, isWorkspaceFullscreen],
  ([video, workspace]) => {
    emit('fullscreen-change', { video, workspace });
  },
);

// ==================== Toast ====================

const { toasts, showToast } = useToast();

// ==================== AI 配乐弹窗 ====================

const showAIModal = ref(false);
const showClipModal = ref(false);
const clipModalData = ref<{ clipName: string; clipDuration: number; clip: Clip }>({
  clipName: '',
  clipDuration: 0,
  clip: {} as Clip,
});

// 右键菜单选中的片段信息
const rightClickClipInfo = ref<ClipInfo | null>(null);

// 右键菜单状态

const generatingState = ref({
  visible: false,
  text: '正在生成配乐...',
  progress: 0,
});

// ==================== 加载状态 ====================

const isLoading = ref(true);
const loadingProgress = ref(0);
const loadingText = ref('正在加载素材...');

// 视频时长缓存由父组件通过 props 传入

// ==================== 播放控制 ====================

function play(): void {
  if (currentTimeRef.value >= playableDuration.value) {
    currentTimeRef.value = 0;
  }

  isPlayingRef.value = true;

  syncVideo(currentTimeRef.value);
  syncNarrationAudio(currentTimeRef.value, true); // 同步旁白音频
  startPreloadNextClip(); // 新增：触发预加载

  // 视频轨道未禁用时才播放视频
  if (activeVideoElement.value && !trackStates.value[0]?.muted) {
    activeVideoElement.value.play().catch(() => {});
  }

  playInterval = window.setInterval(() => {
    currentTimeRef.value += 1 / FPS;

    if (currentTimeRef.value >= playableDuration.value) {
      currentTimeRef.value = playableDuration.value;
      pause();
    }

    syncVideo(currentTimeRef.value);
    syncNarrationAudio(currentTimeRef.value, true); // 同步旁白音频
  }, 1000 / FPS);
}

function pause(): void {
  isPlayingRef.value = false;

  clearPreload(); // 新增：清除预加载
  pauseNarrationAudios(); // 暂停旁白音频

  if (activeVideoElement.value) {
    activeVideoElement.value.pause();
  }

  if (playInterval) {
    clearInterval(playInterval);
    playInterval = null;
  }
}

function togglePlay(): void {
  if (isPlayingRef.value) {
    pause();
  } else {
    play();
  }
}

function seek(time: number): void {
  currentTimeRef.value = Math.max(0, Math.min(playableDuration.value, time));

  clearPreload(); // 跳转前清除预加载
  syncVideo(currentTimeRef.value); // 先同步视频，再设置 isSeeking 防止播放循环重复调用
  syncNarrationAudio(currentTimeRef.value, isPlayingRef.value); // 同步旁白音频

  isSeeking.value = true; // 防止播放循环中的 syncVideo 调用

  if (isPlayingRef.value) {
    startPreloadNextClip(); // 重新预加载
  }

  isSeeking.value = false;
}

function skip(delta: number): void {
  seek(currentTimeRef.value + delta);
}

function frameStep(direction: 'prev' | 'next'): void {
  const delta = direction === 'next' ? 1 / FPS : -1 / FPS;
  seek(currentTimeRef.value + delta);
}

// ==================== 轨道控制 ====================

function toggleTrackMute(idx: number): void {
  trackStates.value[idx].muted = !trackStates.value[idx].muted;
  applyTrackVolumes();
}

function updateTrackVolume(idx: number, val: number): void {
  trackStates.value[idx].volume = val;
  applyTrackVolumes();
}

function applyTrackVolumes(): void {
  const activeEl = activeVideoElement.value;
  if (activeEl) {
    const videoState = trackStates.value[0];
    activeEl.muted = videoState.muted;
    activeEl.volume = videoState.muted ? 0 : videoState.volume / 100;
  }

  // 同步旁白音频音量
  const narrationTrackState = trackStates.value[2]; // A1 旁白轨道
  if (narrationTrackState) {
    narrationAudioElements.value.forEach((audio) => {
      audio.volume = narrationTrackState.muted ? 0 : narrationTrackState.volume / 100;
    });
  }
}

// ==================== 旁白音频同步 ====================

/**
 * 加载所有旁白音频
 */
async function loadNarrationAudios(): Promise<void> {
  const narrationTrack = props.timelineData.tracks[2]; // A1 旁白
  if (!narrationTrack) return;

  for (const clip of narrationTrack.clips) {
    if (clip.audioUrl && !narrationAudioElements.value.has(clip.audioUrl)) {
      const audio = document.createElement('audio');
      audio.preload = 'auto';
      audio.src = clip.audioUrl;

      await new Promise<void>((resolve) => {
        audio.onloadedmetadata = () => resolve();
        audio.onerror = () => resolve();
      });

      narrationAudioElements.value.set(clip.audioUrl, audio);
    }
  }
}

/**
 * 同步旁白音频播放
 * 音频时长与视频片段对齐，超出部分在播放时裁切
 */
function syncNarrationAudio(time: number, playing: boolean): void {
  const narrationTrack = props.timelineData.tracks[2]; // A1 旁白
  const narrationState = trackStates.value[2];

  if (!narrationTrack || narrationState?.muted) {
    // 轨道静音时暂停所有旁白音频
    narrationAudioElements.value.forEach((audio) => audio.pause());
    return;
  }

  narrationTrack.clips.forEach((clip) => {
    if (!clip.audioUrl) return;
    const audio = narrationAudioElements.value.get(clip.audioUrl);
    if (!audio) return;

    const localTime = time - clip.start;
    // 获取音频实际时长（用于裁切判断）
    const audioActualDuration = clip.audioActualDuration || clip.duration;

    // 在片段范围内且未超出音频实际时长
    if (localTime >= 0 && localTime < clip.duration) {
      // 如果超出音频实际时长，暂停播放（裁切末尾）
      if (localTime >= audioActualDuration) {
        audio.pause();
        return;
      }

      // 同步播放位置
      if (Math.abs(audio.currentTime - localTime) > 0.2) {
        audio.currentTime = localTime;
      }
      if (playing && audio.paused) {
        audio.play().catch(() => {});
      }
    } else {
      // 超出片段范围，暂停
      audio.pause();
    }
  });
}

/**
 * 暂停所有旁白音频
 */
function pauseNarrationAudios(): void {
  narrationAudioElements.value.forEach((audio) => audio.pause());
}

// ==================== AI 配乐 ====================

function openAIMusicModal(): void {
  showAIModal.value = true;
}

function closeAIModal(): void {
  showAIModal.value = false;
  showClipModal.value = false;
}

function generateAIMusic(style: string, duration: number): void {
  generatingState.value.visible = true;
  generatingState.value.text = `正在生成配乐...`;
  generatingState.value.progress = 0;

  // 模拟生成进度
  const progressInterval = setInterval(() => {
    generatingState.value.progress += 10;
    if (generatingState.value.progress >= 100) {
      clearInterval(progressInterval);
      generatingState.value.visible = false;

      // 通知父组件持久化 BGM
      emit('generate-ai-music', style, duration, 0);

      showToast(`已生成配乐 (${formatTime(duration)})`, 'success');
    }
  }, 300);
}

function handleClipContextMenu(info: { trackIndex: number; clipIndex: number; clip: unknown; event: MouseEvent }): void {
  const clip = info.clip as Clip;
  rightClickClipInfo.value = { trackIndex: info.trackIndex, clipIndex: info.clipIndex, clip };
  clipModalData.value = {
    clipName: clip.name,
    clipDuration: clip.duration,
    clip,
  };

  // 显示右键菜单
  contextMenuState.value = {
    visible: true,
    x: info.event.clientX,
    y: info.event.clientY,
    clipHasVideo: !clip.isBlackScreen && clip.shotGroupId != null,
  };
}

// 右键菜单状态
const contextMenuState = ref({
  visible: false,
  x: 0,
  y: 0,
  clipHasVideo: false,
});

// 从右键菜单打开配乐弹窗
function openClipMusicModalFromContextMenu(): void {
  contextMenuState.value.visible = false;
  showClipModal.value = true;
}

// 关闭右键菜单
function closeContextMenu(): void {
  contextMenuState.value.visible = false;
}

function generateClipMusic(style: string, duration: number): void {
  if (!rightClickClipInfo.value) return;

  generatingState.value.visible = true;
  generatingState.value.text = `正在为「${rightClickClipInfo.value.clip.name}」生成配乐...`;
  generatingState.value.progress = 0;

  const progressInterval = setInterval(() => {
    generatingState.value.progress += 10;
    if (generatingState.value.progress >= 100) {
      clearInterval(progressInterval);
      generatingState.value.visible = false;

      // 通知父组件持久化片段 BGM
      if (rightClickClipInfo.value) {
        emit('generate-clip-music', style, duration, rightClickClipInfo.value.clip);
      }

      showToast(`已为「${rightClickClipInfo.value?.clip?.name ?? '片段'}」生成配乐`, 'success');
    }
  }, 300);
}

// ==================== 键盘快捷键 ====================

useKeyboard({
  onTogglePlay: togglePlay,
  onSeek: skip,
  onFrameStep: frameStep,
  onExitFullscreen: handleExitFullscreen,
  onCloseModal: closeAIModal,
});

// ==================== 时间轴滚动 ====================

const timelineAreaRef = ref<InstanceType<typeof TimelineArea> | null>(null);

function handleTimeRulerClick(event: MouseEvent): void {
  const scrollContainer = timelineAreaRef.value?.getScrollContainer();
  if (!scrollContainer) return;

  const rect = scrollContainer.getBoundingClientRect();
  const scrollLeft = scrollContainer.scrollLeft;
  // 减去左侧标签宽度 (160px) 和刻度偏移 (20px)
  const x = event.clientX - rect.left + scrollLeft - LABEL_WIDTH - 20;

  const time = Math.max(0, Math.min(playableDuration.value, x / pixelsPerSecond.value));
  seek(time);
}

const LABEL_WIDTH = 160; // 标签宽度常量

// ==================== 进度条点击 ====================

function handleProgressBarClick(event: MouseEvent, progressBar: HTMLElement): void {
  const rect = progressBar.getBoundingClientRect();
  const percent = (event.clientX - rect.left) / rect.width;
  seek(percent * playableDuration.value);
}

// ==================== 缩放控制 ====================

// 缩放限制
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 8;

// +/- 按钮缩放（以播放头为中心）
function handleZoomIn(): void {
  const newZoom = zoom.value * 1.25;
  if (newZoom > MAX_ZOOM) return; // 达到上限，不执行

  const scrollContainer = timelineAreaRef.value?.getScrollContainer();
  if (!scrollContainer) return;
  const centerTime = currentTimeRef.value; // 以播放头（当前时间）为中心
  zoomAtPoint(newZoom, centerTime, scrollContainer);
}

function handleZoomOut(): void {
  const newZoom = zoom.value / 1.25;
  if (newZoom < MIN_ZOOM) return; // 达到下限，不执行

  const scrollContainer = timelineAreaRef.value?.getScrollContainer();
  if (!scrollContainer) return;
  const centerTime = currentTimeRef.value; // 以播放头（当前时间）为中心
  zoomAtPoint(newZoom, centerTime, scrollContainer);
}

// 滚轮缩放（以鼠标为中心）
function handleWheelZoom(event: WheelEvent): void {
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault();

    const scrollContainer = timelineAreaRef.value?.getScrollContainer();
    if (!scrollContainer) return;

    // 计算新的缩放级别
    const delta = event.deltaY > 0 ? -0.15 : 0.15;
    const newZoom = zoom.value + delta;

    // 检查是否超出缩放范围，超出则不执行
    if (newZoom < MIN_ZOOM || newZoom > MAX_ZOOM) return;

    // 计算鼠标位置对应的时间点
    const rect = scrollContainer.getBoundingClientRect();
    const scrollLeft = scrollContainer.scrollLeft;
    // 减去左侧标签宽度 (160px) 和刻度偏移 (20px)
    const mouseX = event.clientX - rect.left + scrollLeft - LABEL_WIDTH - 20;

    const centerTime = mouseX / pixelsPerSecond.value;

    // 以鼠标位置为中心缩放
    zoomAtPoint(newZoom, centerTime, scrollContainer);
  }
}

// 处理自适应缩放请求
function handleRequestAutoFit(containerWidth: number, totalDuration: number): void {
  autoFit(containerWidth, totalDuration);
}

// 处理显式自适应按钮点击
function handleAutoFit(): void {
  const scrollContainer = timelineAreaRef.value?.getScrollContainer();
  if (scrollContainer) {
    triggerAutoFit(scrollContainer.clientWidth - LABEL_WIDTH, props.timelineData.totalDuration);
  }
}

// ==================== 初始化 ====================

onMounted(async () => {
  // 模拟加载进度
  loadingText.value = '正在初始化播放器...';
  for (let i = 0; i <= 100; i += 10) {
    loadingProgress.value = i;
    await new Promise((r) => setTimeout(r, 50));
  }

  isLoading.value = false;

  // 初始化视频（使用 videoElementA 作为初始活跃元素）
  if (props.videoSources.length > 0 && videoElementA.value) {
    const firstSource = props.videoSources[0];
    if (firstSource.url) {
      videoElementA.value.src = firstSource.url;
    }
    currentClipIndex.value = 0;
    activeVideoIndex.value = 0; // 初始化为 A 元素活跃
  }

  applyTrackVolumes();

  // 加载旁白音频
  loadNarrationAudios();

  // 自适应缩放
  setTimeout(() => {
    const scrollContainer = timelineAreaRef.value?.getScrollContainer();
    if (scrollContainer) {
      // 内容宽度 = 容器宽度 - 标签宽度 (160px)
      autoFit(scrollContainer.clientWidth - 160, props.timelineData.totalDuration);
    }
  }, 100);

  showToast(`${props.videoSources.length} 段视频已就绪`, 'success');

  // 发送状态更新（基于是否有真实视频素材，而非黑屏占位）
  emit('update:status', hasAnyVideoSource.value ? 'completed' : 'waiting');
});

// 清理
onUnmounted(() => {
  pause();
});

// ==================== 状态计算 ====================

// 当前是否是黑屏片段
const isBlackScreen = computed(() => {
  const video = props.videoSources[currentClipIndex.value];
  return video?.isBlackScreen || !video?.url;
});

// 监听视频素材变化，实时通知父组件状态
watch(
  () => hasAnyVideoSource.value,
  (hasSource) => {
    // 加载完成后才通知状态变化（避免初始化阶段重复通知）
    if (!isLoading.value) {
      emit('update:status', hasSource ? 'completed' : 'waiting');
    }
  },
);

// 进度百分比
const progressPercent = computed(() => {
  if (playableDuration.value <= 0) return 0;
  return (currentTimeRef.value / playableDuration.value) * 100;
});

// 播放头位置
const playheadPosition = computed(() => {
  return currentTimeRef.value * pixelsPerSecond.value + 20;
});
</script>

<template>
  <div
    class="video-editor"
    :class="{
      'video-fullscreen': isVideoFullscreen,
      'workspace-fullscreen': isWorkspaceFullscreen,
    }"
  >
    <!-- 加载遮罩 -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-title">视频编辑器</div>
      <div class="loading-text">{{ loadingText }}</div>
      <div class="loading-bar">
        <div class="loading-fill" :style="{ width: loadingProgress + '%' }"></div>
      </div>
    </div>

    <!-- 预览区 -->
    <section class="preview-area">
      <PreviewArea
        :video-element-a="videoElementA"
        :video-element-b="videoElementB"
        :active-video-index="activeVideoIndex"
        :is-video-fullscreen="isVideoFullscreen"
        :has-black-screen="isBlackScreen"
        :has-any-video-source="hasAnyVideoSource"
        :total-clips="props.videoSources.length"
        :aspect-ratio="aspectRatio"
        :subtitles="props.subtitles"
        :current-time="currentTimeRef"
        :track-states="trackStates"
        @toggle-play="togglePlay"
      />

      <!-- 控制栏 -->
      <ControlsBar
        :current-time="currentTimeRef"
        :total-duration="playableDuration"
        :is-playing="isPlayingRef"
        :progress-percent="progressPercent"
        :is-video-fullscreen="isVideoFullscreen"
        :is-workspace-fullscreen="isWorkspaceFullscreen"
        @toggle-play="togglePlay"
        @skip="skip"
        @frame-step="frameStep"
        @seek="seek"
        @open-ai-music="openAIMusicModal"
        @toggle-video-fullscreen="toggleVideoFullscreen"
        @toggle-workspace-fullscreen="toggleWorkspaceFullscreen"
      />
    </section>

    <!-- 时间轴区域 -->
    <section class="timeline-area">
      <TimelineArea
        ref="timelineAreaRef"
        :tracks="props.timelineData.tracks"
        :track-states="trackStates"
        :total-duration="props.timelineData.totalDuration"
        :current-time="currentTimeRef"
        :zoom="zoom"
        :pixels-per-second="pixelsPerSecond"
        :zoom-label="zoomLabel"
        :playhead-position="playheadPosition"
        @toggle-mute="toggleTrackMute"
        @update-volume="updateTrackVolume"
        @time-ruler-click="handleTimeRulerClick"
        @progress-bar-click="handleProgressBarClick"
        @zoom-in="handleZoomIn"
        @zoom-out="handleZoomOut"
        @auto-fit="handleAutoFit"
        @wheel-zoom="handleWheelZoom"
        @clip-context-menu="handleClipContextMenu"
        @request-auto-fit="handleRequestAutoFit"
      />

      <!-- 双 video 元素（隐藏，用于无缝切换） -->
      <video ref="videoElementA" playsinline style="display: none"></video>
      <video ref="videoElementB" playsinline style="display: none"></video>
    </section>

    <!-- AI 配乐弹窗 -->
    <AIMusicModal
      v-model:visible="showAIModal"
      :total-duration="props.timelineData.totalDuration"
      @generate="generateAIMusic"
      @close="closeAIModal"
    />

    <!-- 片段配乐弹窗 -->
    <ClipMusicModal
      v-model:visible="showClipModal"
      :clip-name="clipModalData.clipName"
      :clip-duration="clipModalData.clipDuration"
      @generate="generateClipMusic"
      @close="closeAIModal"
    />

    <!-- 右键菜单 -->
    <ContextMenu
      :visible="contextMenuState.visible"
      :x="contextMenuState.x"
      :y="contextMenuState.y"
      :clip-has-video="contextMenuState.clipHasVideo"
      @close="closeContextMenu"
      @generate-music="openClipMusicModalFromContextMenu"
    />

    <!-- Toast 提示 -->
    <ToastContainer :toasts="toasts" />

    <!-- 生成进度遮罩 -->
    <GeneratingOverlay
      :visible="generatingState.visible"
      :text="generatingState.text"
      :progress="generatingState.progress"
    />
  </div>
</template>

<style scoped>
.video-editor {
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--bg-deep, #08080a);
  color: var(--text-primary, #eaeaef);
}

/* 加载遮罩 - 显示在编辑器容器内 */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--bg-deep, #08080a);
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  transition: opacity 0.4s ease;
}

.loading-title {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.3px;
}

.loading-text {
  font-size: 12px;
  color: var(--text-muted, #55556a);
}

.loading-bar {
  width: 240px;
  height: 3px;
  background: var(--border, #2a2a30);
  border-radius: 2px;
  overflow: hidden;
}

.loading-fill {
  height: 100%;
  background: var(--accent, #00d4aa);
  border-radius: 2px;
  transition: width 0.3s ease;
}

/* 预览区：固定 16:9 比例，宽度 100%，高度由宽度计算 */
.preview-area {
  width: 100%;
  aspect-ratio: 16 / 9;
  display: flex;
  flex-direction: column;
  background: var(--bg-deep, #08080a);
  position: relative;
  padding-bottom: 56px;
  min-height: 0; /* 防止内部固定像素尺寸元素撑破 aspect-ratio */

  .controls-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
  }
}

/* 时间轴区域 */
.timeline-area {
  height: 280px;
  background: var(--bg-main, #0f0f12);
  border-top: 1px solid var(--border, #2a2a30);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: height 0.3s ease;
}

/* 全屏模式 */
/* 视频全屏：编辑器和预览区域都使用 fixed 布局填充满屏幕 */
.video-editor.video-fullscreen {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  z-index: 9998;
}

.video-editor.video-fullscreen .preview-area {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  aspect-ratio: unset !important; /* 全屏时取消固定比例 */
  z-index: 9999;
  background: var(--bg-deep, #08080a);
}

.video-editor.video-fullscreen .timeline-area {
  display: none !important;
}

.video-editor.video-fullscreen .preview-scaler {
  position: absolute;
  top: 50%;
  left: 50%;
}

.video-editor.video-fullscreen .preview-wrapper {
  /* 保持固定分辨率，不再覆盖 width/height/transform */
}

.video-editor.video-fullscreen .controls-bar {
  position: fixed !important;
  bottom: 0 !important;
  left: 0 !important;
  width: 100vw !important;
  z-index: 10000;
  background: rgba(24, 24, 29, 0.95) !important;
  backdrop-filter: blur(8px) !important;
}

/* 工作区全屏：整个编辑器使用 fixed 布局填充满屏幕 */
.video-editor.workspace-fullscreen {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  z-index: 100;
}

.video-editor.workspace-fullscreen .timeline-area {
}

.video-editor.workspace-fullscreen .preview-area {
  flex: 1;
  aspect-ratio: unset !important; /* 全屏时取消固定比例 */
  min-height: 0; /* 确保 flex 收缩生效 */
}

.video-editor.workspace-fullscreen .preview-container {
  padding: 10px;
}
</style>