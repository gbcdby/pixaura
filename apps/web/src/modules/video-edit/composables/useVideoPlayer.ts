/**
 * 视频播放逻辑
 * 支持多视频片段切换播放
 */

import { ref, computed, onUnmounted } from 'vue';
import type { VideoSource, TimelineData } from '../types';

// 常量：帧率
const FPS = 30;

/**
 * 视频播放器 composable
 */
export function useVideoPlayer(videoSources: VideoSource[], timelineData: TimelineData) {
  // 当前时间
  const currentTime = ref(0);

  // 播放状态
  const isPlaying = ref(false);

  // 当前片段索引
  const currentClipIndex = ref(0);

  // 是否正在跳转（避免跳转期间的同步冲突）
  const isSeeking = ref(false);

  // 视频切换中（避免切换期间的同步冲突）
  const videoSwitching = ref(false);

  // 播放定时器
  let playInterval: number | null = null;

  // 视频元素引用
  const videoElement = ref<HTMLVideoElement | null>(null);

  // 总时长
  const totalDuration = computed(() => timelineData.totalDuration);

  // 可播放时长（排除空轨道）
  const playableDuration = computed(() => {
    const tracks = timelineData.tracks;
    let maxEnd = timelineData.totalDuration;

    for (const track of tracks) {
      // 跳过文字轨道
      if (track.type === 'text') continue;
      // 跳过空轨道
      if (track.clips.length === 0) continue;

      for (const clip of track.clips) {
        const end = clip.start + clip.duration;
        if (end > maxEnd) maxEnd = end;
      }
    }

    return Math.max(0.1, maxEnd);
  });

  /**
   * 获取当前时间对应的视频片段索引
   */
  function getClipIndex(time: number): number {
    const clips = timelineData.tracks[0]?.clips || [];
    for (let i = 0; i < clips.length; i++) {
      if (time >= clips[i].start && time < clips[i].start + clips[i].duration) {
        return i;
      }
    }
    return clips.length - 1;
  }

  /**
   * 切换视频片段
   */
  function switchVideoClip(index: number, localTime: number): void {
    if (index === currentClipIndex.value) return;

    currentClipIndex.value = index;
    videoSwitching.value = true;

    const video = videoSources[index];
    if (!video || !videoElement.value) {
      videoSwitching.value = false;
      return;
    }

    videoElement.value.src = video.url;
    videoElement.value.currentTime = Math.max(0, localTime);

    // 等待跳转完成
    videoElement.value.onseeked = () => {
      if (videoElement.value) {
        videoElement.value.onseeked = null;
      }
      videoSwitching.value = false;
      if (isPlaying.value && videoElement.value) {
        videoElement.value.play().catch(() => {});
      }
    };

    videoElement.value.onerror = () => {
      if (videoElement.value) {
        videoElement.value.onerror = null;
      }
      videoSwitching.value = false;
    };

    videoElement.value.play().catch(() => {});

    // 安全超时
    setTimeout(() => {
      videoSwitching.value = false;
    }, 200);
  }

  /**
   * 同步视频播放
   */
  function syncVideo(time: number): void {
    if (isSeeking.value || videoSwitching.value) return;

    const idx = getClipIndex(time);
    const clips = timelineData.tracks[0]?.clips || [];
    const clip = clips[idx];
    if (!clip) return;

    const localTime = time - clip.start;

    if (idx !== currentClipIndex.value) {
      switchVideoClip(idx, localTime);
    } else if (videoElement.value && Math.abs(videoElement.value.currentTime - localTime) > 0.15) {
      videoElement.value.currentTime = localTime;
    }
  }

  /**
   * 播放
   */
  function play(): void {
    if (currentTime.value >= playableDuration.value) {
      currentTime.value = 0;
    }

    isPlaying.value = true;

    // 同步视频
    syncVideo(currentTime.value);
    if (videoElement.value) {
      videoElement.value.play().catch(() => {});
    }

    // 启动播放定时器
    playInterval = window.setInterval(() => {
      currentTime.value += 1 / FPS;

      if (currentTime.value >= playableDuration.value) {
        currentTime.value = playableDuration.value;
        pause();
      }

      syncVideo(currentTime.value);
    }, 1000 / FPS);
  }

  /**
   * 暂停
   */
  function pause(): void {
    isPlaying.value = false;

    if (videoElement.value) {
      videoElement.value.pause();
    }

    if (playInterval) {
      clearInterval(playInterval);
      playInterval = null;
    }
  }

  /**
   * 播放/暂停切换
   */
  function togglePlay(): void {
    if (isPlaying.value) {
      pause();
    } else {
      play();
    }
  }

  /**
   * 跳转到指定时间
   */
  function seek(time: number): void {
    currentTime.value = Math.max(0, Math.min(playableDuration.value, time));
    isSeeking.value = true;

    syncVideo(currentTime.value);

    isSeeking.value = false;
  }

  /**
   * 前进/后退指定秒数
   */
  function skip(delta: number): void {
    seek(currentTime.value + delta);
  }

  /**
   * 帧步进
   */
  function frameStep(direction: 'prev' | 'next'): void {
    const delta = direction === 'next' ? 1 / FPS : -1 / FPS;
    seek(currentTime.value + delta);
  }

  /**
   * 设置视频元素
   */
  function setVideoElement(el: HTMLVideoElement): void {
    videoElement.value = el;
    if (videoSources.length > 0) {
      el.src = videoSources[0].url;
    }
  }

  // 清理
  onUnmounted(() => {
    pause();
  });

  return {
    currentTime,
    isPlaying,
    currentClipIndex,
    totalDuration,
    playableDuration,
    videoElement,
    play,
    pause,
    togglePlay,
    seek,
    skip,
    frameStep,
    syncVideo,
    setVideoElement,
  };
}