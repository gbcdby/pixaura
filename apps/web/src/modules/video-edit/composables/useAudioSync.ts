/**
 * 音频同步控制
 */

import { ref, watch, onUnmounted } from 'vue';
import type { Track, TrackState, Clip } from '../types';

/**
 * 音频同步 composable
 */
export function useAudioSync(
  tracks: Track[],
  trackStates: TrackState[],
  currentTime: { value: number },
  isPlaying: { value: boolean },
) {
  // 加载的音频元素映射
  const loadedAudios = ref<Map<string, HTMLAudioElement>>(new Map());

  // 音频预设 URL（示例）
  const audioPresets = {
    cherry: 'https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250211/tixcef/cherry.wav',
    serena: 'https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250211/bxokea/serena.wav',
    ethan: 'https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250211/emaqdp/ethan.wav',
  };

  /**
   * 加载单个音频
   */
  async function loadAudio(url: string): Promise<HTMLAudioElement | null> {
    const audio = document.createElement('audio');
    audio.preload = 'auto';
    audio.src = url;

    return new Promise<HTMLAudioElement | null>((resolve) => {
      audio.onloadedmetadata = () => resolve(audio);
      audio.onerror = () => resolve(null);
      // 超时处理
      setTimeout(() => resolve(null), 10000);
    });
  }

  /**
   * 加载所有音频预设
   */
  async function loadAllAudios(): Promise<void> {
    for (const [key, url] of Object.entries(audioPresets)) {
      const audio = await loadAudio(url);
      if (audio) {
        loadedAudios.value.set(key, audio);
      }
    }
  }

  /**
   * 应用轨道音量
   */
  function applyTrackVolumes(): void {
    // 视频轨道（索引 0）控制主视频音量
    // 音频轨道控制各自的音频元素

    tracks.forEach((track, idx) => {
      if (track.type !== 'audio') return;

      const state = trackStates[idx];
      if (!state) return;

      track.clips.forEach((clip: Clip) => {
        if (!clip.audioKey) return;
        const audio = loadedAudios.value.get(clip.audioKey);
        if (!audio) return;

        audio.volume = state.muted ? 0 : state.volume / 100;
      });
    });
  }

  /**
   * 同步所有音频播放
   */
  function syncAllAudio(time: number, playing: boolean): void {
    tracks.forEach((track, idx) => {
      if (track.type !== 'audio') return;

      const state = trackStates[idx];
      if (state?.muted) return;

      track.clips.forEach((clip: Clip) => {
        if (!clip.audioKey) return;
        const audio = loadedAudios.value.get(clip.audioKey);
        if (!audio) return;

        const localTime = time - clip.start;

        if (localTime >= 0 && localTime < clip.duration) {
          // 在片段范围内
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
    });
  }

  /**
   * 暂停所有音频
   */
  function pauseAll(): void {
    loadedAudios.value.forEach((audio) => {
      audio.pause();
    });
  }

  /**
   * 播放所有音频（从当前时间开始）
   */
  function playAll(time: number): void {
    syncAllAudio(time, true);
  }

  // 监听播放状态变化
  watch(
    () => isPlaying.value,
    (playing) => {
      if (playing) {
        playAll(currentTime.value);
      } else {
        pauseAll();
      }
    },
  );

  // 监听时间变化
  watch(
    () => currentTime.value,
    (time) => {
      if (isPlaying.value) {
        syncAllAudio(time, true);
      }
    },
  );

  // 清理
  onUnmounted(() => {
    pauseAll();
    loadedAudios.value.clear();
  });

  return {
    loadedAudios,
    audioPresets,
    loadAllAudios,
    applyTrackVolumes,
    syncAllAudio,
    pauseAll,
    playAll,
  };
}