/**
 * 音频引擎 Composable
 * 使用 Web Audio API 实现音频混音和播放控制
 * 支持主动播放模式和被动视频同步模式
 */
import { ref, shallowRef, onUnmounted } from "vue";
import type { Time, TrackId, AudioTrack } from "@/types/video-editor-temp";

export interface AudioEngineOptions {
  masterVolume?: number;
  onTimeUpdate?: (time: Time) => void;
  onEnded?: () => void;
  onError?: (error: Error) => void;
}

export interface AudioTrackNode {
  id: TrackId;
  source: AudioBufferSourceNode | null;
  gainNode: GainNode;
  audioBuffer: AudioBuffer | null;
  isPlaying: boolean;
  startTime: number;
  offset: number;
}

// 视频同步状态
interface VideoSyncState {
  videoElement: HTMLVideoElement | null;
  activeSources: Map<TrackId, AudioBufferSourceNode>;
  trackBuffers: Map<TrackId, { buffer: AudioBuffer; track: AudioTrack }>;
  eventHandlers: Map<string, () => void>;
  // 记录每个轨道音频自然结束时的视频时间点
  // 用于防止 timeupdate 事件重复创建已自然结束的音频源
  trackEndedAt: Map<TrackId, number>;
}

export function useAudioEngine(options: AudioEngineOptions = {}) {
  const { masterVolume = 1, onTimeUpdate, onEnded, onError } = options;

  // AudioContext
  const audioContext = shallowRef<AudioContext | null>(null);
  const masterGainNode = shallowRef<GainNode | null>(null);
  const analyserNode = shallowRef<AnalyserNode | null>(null);

  // 状态
  const isInitialized = ref(false);
  const isPlaying = ref(false);
  const currentTime = ref<Time>(0);
  const duration = ref<Time>(0);

  // 轨道节点映射
  const trackNodes = new Map<TrackId, AudioTrackNode>();

  // 视频同步状态
  const videoSyncState: VideoSyncState = {
    videoElement: null,
    activeSources: new Map(),
    trackBuffers: new Map(),
    eventHandlers: new Map(),
    trackEndedAt: new Map(),
  };

  // 是否处于视频同步模式
  const isVideoSyncMode = ref(false);

  // 频率数据
  const frequencyData = ref<Uint8Array | null>(null);

  // 初始化音频引擎
  const init = async (): Promise<void> => {
    if (isInitialized.value) return;

    try {
      const ctx = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      )();
      audioContext.value = ctx;

      const masterGain = ctx.createGain();
      masterGain.gain.value = masterVolume;
      masterGain.connect(ctx.destination);
      masterGainNode.value = masterGain;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.connect(masterGain);
      analyserNode.value = analyser;

      frequencyData.value = new Uint8Array(analyser.frequencyBinCount);
      isInitialized.value = true;
    } catch (error) {
      console.error("[useAudioEngine] 初始化失败:", error);
      onError?.(error as Error);
    }
  };

  // 加载音频文件
  const loadAudioBuffer = async (url: string): Promise<AudioBuffer> => {
    if (!audioContext.value) {
      throw new Error("AudioContext 未初始化");
    }
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return audioContext.value.decodeAudioData(arrayBuffer);
  };

  // 添加音频轨道
  const addTrack = async (track: {
    id: TrackId;
    audioUrl: string;
    volume?: number;
    muted?: boolean;
    timelineStart?: number;
    trim?: { start: number; end: number };
  }): Promise<void> => {
    if (!audioContext.value || !analyserNode.value) {
      await init();
    }

    if (!audioContext.value || !analyserNode.value) {
      throw new Error("AudioContext 初始化失败");
    }

    const gainNode = audioContext.value.createGain();
    gainNode.gain.value = track.muted ? 0 : (track.volume ?? 1);
    gainNode.connect(analyserNode.value);

    let audioBuffer: AudioBuffer;
    try {
      audioBuffer = await loadAudioBuffer(track.audioUrl);
    } catch (error) {
      console.error(`[useAudioEngine] 加载音频失败: ${track.audioUrl}`, error);
      onError?.(error as Error);
      return;
    }

    trackNodes.set(track.id, {
      id: track.id,
      source: null,
      gainNode,
      audioBuffer,
      isPlaying: false,
      startTime: 0,
      offset: 0,
    });

    if (audioBuffer) {
      const trackDuration = track.trim
        ? track.trim.end - track.trim.start
        : audioBuffer.duration;
      const trackEnd = (track.timelineStart ?? 0) + trackDuration;
      if (trackEnd > duration.value) {
        duration.value = trackEnd;
      }
    }
  };

  // 移除音频轨道
  const removeTrack = (id: TrackId): void => {
    const trackNode = trackNodes.get(id);
    if (trackNode) {
      if (trackNode.source) {
        try {
          trackNode.source.stop();
        } catch {
          // 忽略已停止的源
        }
        trackNode.source.disconnect();
      }
      trackNode.gainNode.disconnect();
      trackNodes.delete(id);
    }
  };

  // 更新轨道音量
  const setTrackVolume = (id: TrackId, volume: number): void => {
    const trackNode = trackNodes.get(id);
    if (trackNode) {
      trackNode.gainNode.gain.value = volume;
    }
  };

  // 播放
  const play = async (startTime: Time = 0): Promise<void> => {
    if (!audioContext.value || !isInitialized.value) {
      await init();
    }

    if (!audioContext.value) return;

    if (audioContext.value.state === "suspended") {
      await audioContext.value.resume();
    }

    isPlaying.value = true;
    currentTime.value = startTime;

    for (const trackNode of trackNodes.values()) {
      if (trackNode.audioBuffer) {
        const source = audioContext.value.createBufferSource();
        source.buffer = trackNode.audioBuffer;
        source.connect(trackNode.gainNode);

        trackNode.source = source;
        trackNode.startTime = audioContext.value.currentTime;
        trackNode.offset = Math.max(0, startTime);

        source.start(0, trackNode.offset);
        trackNode.isPlaying = true;

        source.onended = () => {
          trackNode.isPlaying = false;
        };
      }
    }

    startUpdateLoop();
  };

  // 暂停
  const pause = (): void => {
    isPlaying.value = false;

    for (const trackNode of trackNodes.values()) {
      if (trackNode.source) {
        try {
          trackNode.source.stop();
        } catch {
          // 忽略
        }
        trackNode.source.disconnect();
        trackNode.source = null;
        trackNode.isPlaying = false;
      }
    }

    stopUpdateLoop();
  };

  // 跳转
  const seek = async (time: Time): Promise<void> => {
    const wasPlaying = isPlaying.value;
    if (wasPlaying) {
      pause();
    }
    currentTime.value = time;
    if (wasPlaying) {
      await play(time);
    }
  };

  // 停止
  const stop = (): void => {
    pause();
    currentTime.value = 0;
  };

  // 更新循环
  let animationFrameId: number | null = null;

  const startUpdateLoop = (): void => {
    const update = () => {
      if (!isPlaying.value) return;

      currentTime.value += 1 / 60;

      if (currentTime.value >= duration.value) {
        onEnded?.();
        stop();
        return;
      }

      onTimeUpdate?.(currentTime.value);

      if (analyserNode.value && frequencyData.value) {
        // @ts-expect-error TypeScript 严格模式下 Uint8Array 类型不兼容
        analyserNode.value.getByteFrequencyData(frequencyData.value);
      }

      animationFrameId = requestAnimationFrame(update);
    };

    update();
  };

  const stopUpdateLoop = (): void => {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  };

  // 设置主音量
  const setMasterVolume = (volume: number): void => {
    if (masterGainNode.value) {
      masterGainNode.value.gain.value = volume;
    }
  };

  // 获取频率数据
  const getFrequencyData = (): Uint8Array | null => {
    if (analyserNode.value && frequencyData.value) {
      // @ts-expect-error TypeScript 严格模式下 Uint8Array 类型不兼容
      analyserNode.value.getByteFrequencyData(frequencyData.value);
      return frequencyData.value;
    }
    return null;
  };

  // 获取波形数据
  const getWaveformData = (id: TrackId, width: number): number[] => {
    const trackNode = trackNodes.get(id);
    if (!trackNode?.audioBuffer) {
      return [];
    }

    const buffer = trackNode.audioBuffer;
    const channelData = buffer.getChannelData(0);
    const samples: number[] = [];
    const step = Math.floor(channelData.length / width);

    for (let i = 0; i < width; i++) {
      const index = i * step;
      samples.push(Math.abs(channelData[index] || 0));
    }

    return samples;
  };

  // ==================== 视频同步模式 ====================

  /**
   * 停止所有活跃的 AudioBufferSourceNode
   */
  const stopAllSources = (): void => {
    for (const [trackId, source] of videoSyncState.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // 忽略已停止的源
      }
      videoSyncState.activeSources.delete(trackId);
    }
  };

  /**
   * 检查轨道是否覆盖指定时间点
   */
  const isTrackActiveAtTime = (track: AudioTrack, time: Time): boolean => {
    const trackStart = track.timelineStart + track.trim.start;
    const trackEnd = track.timelineStart + track.trim.end;
    return time >= trackStart && time < trackEnd;
  };

  /**
   * 计算轨道内的偏移时间
   */
  const getTrackOffset = (track: AudioTrack, videoTime: Time): number => {
    return videoTime - track.timelineStart - track.trim.start;
  };

  /**
   * 为轨道创建并启动 AudioBufferSourceNode
   */
  const createSourceForTrack = (
    track: AudioTrack,
    buffer: AudioBuffer,
    videoTime: Time,
  ): AudioBufferSourceNode | null => {
    if (!audioContext.value || !analyserNode.value) return null;

    // 创建 GainNode 用于音量控制
    const gainNode = audioContext.value.createGain();
    gainNode.gain.value = track.muted ? 0 : track.volume;
    gainNode.connect(analyserNode.value);

    // 创建 BufferSource
    const source = audioContext.value.createBufferSource();
    source.buffer = buffer;
    source.connect(gainNode);

    // 计算偏移（从轨道起始位置开始的相对偏移）
    const offset = getTrackOffset(track, videoTime);

    // 计算剩余时长（从当前位置到轨道结束）
    const remainingDuration = track.trim.end - track.trim.start - offset;

    // 计算该轨道预期结束时的视频时间点
    const expectedEndTime = videoTime + remainingDuration;

    // 启动播放
    source.start(0, offset, remainingDuration);

    // 播放结束时清理并记录结束时间点
    source.onended = () => {
      videoSyncState.activeSources.delete(track.id);
      // 记录音频自然结束时的预期视频时间点
      videoSyncState.trackEndedAt.set(track.id, expectedEndTime);
      gainNode.disconnect();
    };

    // 创建新源时，清除之前的结束记录（表示是被中断后恢复的）
    videoSyncState.trackEndedAt.delete(track.id);
    videoSyncState.activeSources.set(track.id, source);
    return source;
  };

  /**
   * 根据 video 当前时间同步音频轨道
   *
   * 修复逻辑：
   * - 只有当视频时间在轨道的播放范围内时，才创建新的 source
   * - 音频自然结束后（超出轨道时间范围），不应重新创建
   * - 只有在轨道范围内但 source 被中断（seek/pause）后，才需要恢复
   * - **关键修复**：只有视频正在播放时才创建音频源，避免 paused 状态下音频自动播放
   * - **防叠加修复**：检查 trackEndedAt 记录，防止 timeupdate 事件重复创建已自然结束的音频源
   */
  const syncAudioToVideoTime = (videoTime: Time): void => {
    if (!audioContext.value) return;

    // 关键修复：视频 paused 时不应创建音频源，避免音频自动播放
    // 只有视频正在播放时才同步音频
    if (videoSyncState.videoElement && videoSyncState.videoElement.paused) {
      // 视频暂停时，确保所有音频源都已停止
      if (videoSyncState.activeSources.size > 0) {
        stopAllSources();
      }
      return;
    }

    // 遍历所有已加载的轨道
    for (const [trackId, { track, buffer }] of videoSyncState.trackBuffers) {
      const shouldPlay = isTrackActiveAtTime(track, videoTime);
      const isCurrentlyPlaying = videoSyncState.activeSources.has(trackId);
      const endedAt = videoSyncState.trackEndedAt.get(trackId);

      if (shouldPlay && !isCurrentlyPlaying) {
        // 视频时间在轨道范围内，但当前没有播放
        // 需要判断是否应该创建新的 source：

        // 1. 如果没有结束记录（首次播放或中断后恢复） → 创建
        // 2. 如果有结束记录但视频时间已超过结束点 → 视频已经跳过了，不需要创建
        // 3. 如果有结束记录但视频时间在结束点之前 → 可能是 seek 回来的，需要创建

        // 计算轨道的结束时间点
        const trackEndTime = track.timelineStart + track.trim.end;

        // 如果音频自然结束，且视频时间仍在该轨道范围内（未超过轨道结束点）
        // 则不应该重复创建（防止叠加）
        if (endedAt !== undefined && videoTime < endedAt && videoTime < trackEndTime) {
          // 音频在 endedAt 时间点自然结束，视频时间还没超过结束点
          // 这说明音频刚结束，不应该重复创建
          console.log(`[useAudioEngine] 轨道 ${trackId} 音频已自然结束，跳过重复创建`);
          continue;
        }

        // 其他情况：创建新的 source
        createSourceForTrack(track, buffer, videoTime);
      } else if (!shouldPlay && isCurrentlyPlaying) {
        // 视频时间不在轨道范围内，但音频还在播放 -> 停止
        const source = videoSyncState.activeSources.get(trackId);
        if (source) {
          try {
            source.stop();
            source.disconnect();
          } catch {
            // 忽略
          }
          videoSyncState.activeSources.delete(trackId);
          // 视频跳出轨道范围时清除结束记录（下次进入时需要重新创建）
          videoSyncState.trackEndedAt.delete(trackId);
        }
      }
      // 如果 !shouldPlay && !isCurrentlyPlaying：轨道不在范围内且未播放 -> 无需操作
      // 如果 shouldPlay && isCurrentlyPlaying：轨道在范围内且正在播放 -> 无需操作
    }
  };

  /**
   * 同步到视频 - 被动同步模式
   * 监听 video 事件，动态创建/销毁 AudioBufferSourceNode
   * @param videoElement 视频元素
   * @param tracks 音频轨道列表
   */
  const syncToVideo = async (
    videoElement: HTMLVideoElement,
    tracks: AudioTrack[],
  ): Promise<void> => {
    if (!audioContext.value || !isInitialized.value) {
      await init();
    }

    if (!audioContext.value || !analyserNode.value) {
      throw new Error("AudioContext 初始化失败");
    }

    // 清理之前的同步状态
    detachFromVideo();

    // 设置视频元素
    videoSyncState.videoElement = videoElement;
    isVideoSyncMode.value = true;

    // 加载所有轨道的音频 buffer
    for (const track of tracks) {
      try {
        const buffer = await loadAudioBuffer(track.audioUrl);
        videoSyncState.trackBuffers.set(track.id, { buffer, track });
      } catch (error) {
        console.error(`[useAudioEngine] 加载音频失败: ${track.audioUrl}`, error);
        onError?.(error as Error);
      }
    }

    // 设置事件监听器
    const handleTimeUpdate = (): void => {
      if (!videoSyncState.videoElement) return;
      const videoTime = videoSyncState.videoElement.currentTime;
      currentTime.value = videoTime;
      syncAudioToVideoTime(videoTime);
      onTimeUpdate?.(videoTime);
    };

    const handlePause = (): void => {
      isPlaying.value = false;
      stopAllSources();
      // 暂停时清除所有结束记录，以便恢复时重新创建
      videoSyncState.trackEndedAt.clear();
    };

    const handleSeeked = (): void => {
      if (!videoSyncState.videoElement) return;
      // 先停止所有源并清除结束记录（seek 后需要重新创建）
      stopAllSources();
      videoSyncState.trackEndedAt.clear();
      // 只有视频正在播放时才重新启动音频
      // paused 状态下不应启动音频
      if (!videoSyncState.videoElement.paused) {
        const videoTime = videoSyncState.videoElement.currentTime;
        syncAudioToVideoTime(videoTime);
      }
    };

    const handlePlaying = (): void => {
      isPlaying.value = true;
      // 视频开始播放时，同步音频到当前时间
      if (videoSyncState.videoElement) {
        syncAudioToVideoTime(videoSyncState.videoElement.currentTime);
      }
    };

    const handleEnded = (): void => {
      isPlaying.value = false;
      stopAllSources();
      onEnded?.();
    };

    // 注册事件处理器
    videoSyncState.eventHandlers.set("timeupdate", handleTimeUpdate);
    videoSyncState.eventHandlers.set("pause", handlePause);
    videoSyncState.eventHandlers.set("seeked", handleSeeked);
    videoSyncState.eventHandlers.set("playing", handlePlaying);
    videoSyncState.eventHandlers.set("ended", handleEnded);

    // 添加事件监听
    videoElement.addEventListener("timeupdate", handleTimeUpdate);
    videoElement.addEventListener("pause", handlePause);
    videoElement.addEventListener("seeked", handleSeeked);
    videoElement.addEventListener("playing", handlePlaying);
    videoElement.addEventListener("ended", handleEnded);

    // 初始同步
    if (!videoElement.paused) {
      isPlaying.value = true;
      syncAudioToVideoTime(videoElement.currentTime);
    }
  };

  /**
   * 断开视频同步
   */
  const detachFromVideo = (): void => {
    // 停止所有音频源
    stopAllSources();

    // 移除事件监听
    if (videoSyncState.videoElement) {
      for (const [eventName, handler] of videoSyncState.eventHandlers) {
        videoSyncState.videoElement.removeEventListener(eventName, handler);
      }
      videoSyncState.videoElement = null;
    }

    // 清理状态
    videoSyncState.eventHandlers.clear();
    videoSyncState.trackBuffers.clear();
    videoSyncState.trackEndedAt.clear();
    isVideoSyncMode.value = false;
    isPlaying.value = false;
  };

  /**
   * 更新视频同步模式下轨道的音量
   */
  const setSyncTrackVolume = (trackId: TrackId, volume: number): void => {
    const trackData = videoSyncState.trackBuffers.get(trackId);
    if (trackData) {
      trackData.track.volume = volume;
    }
    // GainNode 是动态创建的，需要在下次播放时生效
  };

  // 清理资源
  const dispose = (): void => {
    // 清理视频同步模式
    detachFromVideo();

    // 清理主动播放模式
    pause();

    for (const trackNode of trackNodes.values()) {
      trackNode.gainNode.disconnect();
    }
    trackNodes.clear();

    if (masterGainNode.value) {
      masterGainNode.value.disconnect();
    }

    if (analyserNode.value) {
      analyserNode.value.disconnect();
    }

    if (audioContext.value) {
      audioContext.value.close();
    }

    audioContext.value = null;
    masterGainNode.value = null;
    analyserNode.value = null;
    isInitialized.value = false;
    isVideoSyncMode.value = false;
  };

  onUnmounted(() => {
    dispose();
  });

  return {
    isInitialized,
    isPlaying,
    currentTime,
    duration,
    frequencyData,
    isVideoSyncMode,
    init,
    addTrack,
    removeTrack,
    setTrackVolume,
    play,
    pause,
    seek,
    stop,
    setMasterVolume,
    getFrequencyData,
    getWaveformData,
    // 视频同步模式方法
    syncToVideo,
    detachFromVideo,
    stopAllSources,
    setSyncTrackVolume,
    dispose,
  };
}

/**
 * 简化的音频播放器 Composable
 */
export function useAudioPlayer(url?: string) {
  const audioElement = shallowRef<HTMLAudioElement | null>(null);
  const isPlaying = ref(false);
  const currentTime = ref<Time>(0);
  const duration = ref<Time>(0);
  const volume = ref(1);

  const init = (audioUrl?: string): void => {
    if (audioElement.value) {
      audioElement.value.pause();
      audioElement.value = null;
    }

    const audio = new Audio(audioUrl || url);
    audioElement.value = audio;

    audio.addEventListener("loadedmetadata", () => {
      duration.value = audio.duration;
    });

    audio.addEventListener("timeupdate", () => {
      currentTime.value = audio.currentTime;
    });

    audio.addEventListener("ended", () => {
      isPlaying.value = false;
    });

    audio.addEventListener("play", () => {
      isPlaying.value = true;
    });

    audio.addEventListener("pause", () => {
      isPlaying.value = false;
    });
  };

  const play = async (): Promise<void> => {
    if (audioElement.value) {
      try {
        await audioElement.value.play();
      } catch (error) {
        console.error("[useAudioPlayer] 播放失败:", error);
      }
    }
  };

  const pause = (): void => {
    if (audioElement.value) {
      audioElement.value.pause();
    }
  };

  const seek = (time: Time): void => {
    if (audioElement.value) {
      audioElement.value.currentTime = time;
    }
  };

  const setVolume = (v: number): void => {
    volume.value = v;
    if (audioElement.value) {
      audioElement.value.volume = v;
    }
  };

  const toggle = (): void => {
    if (isPlaying.value) {
      pause();
    } else {
      play();
    }
  };

  const dispose = (): void => {
    if (audioElement.value) {
      audioElement.value.pause();
      audioElement.value.src = "";
      audioElement.value = null;
    }
  };

  onUnmounted(() => {
    dispose();
  });

  return {
    isPlaying,
    currentTime,
    duration,
    volume,
    init,
    play,
    pause,
    seek,
    setVolume,
    toggle,
    dispose,
  };
}
