/**
 * 视频时长读取 composable
 * 使用 mp4box 读取视频实际时长
 */

import { ref, onUnmounted } from 'vue';
import { createFile, MP4BoxBuffer } from 'mp4box';

/**
 * 读取视频实际时长（毫秒）
 * @param url 视频 URL
 * @returns 时长（毫秒）和加载状态
 */
export function useVideoDuration() {
  const duration = ref<number>(0);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  /**
   * 从视频 URL 读取实际时长
   */
  async function fetchDuration(url: string): Promise<number> {
    if (!url) {
      return 0;
    }

    isLoading.value = true;
    error.value = null;
    duration.value = 0; // 重置，避免上一次解析结果影响本次

    try {
      // 通过 fetch 获取视频数据
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      // 使用 MP4BoxBuffer.fromArrayBuffer 创建正确格式的 buffer
      const mp4Buffer = MP4BoxBuffer.fromArrayBuffer(arrayBuffer, 0);

      // 创建 MP4Box 解析器
      const mp4boxFile = createFile();

      // 设置 ready 回调
      mp4boxFile.onReady = (info: { duration: number; timescale: number }) => {
        // duration 是以 timescale 为单位的，转换为毫秒
        duration.value = info.duration / info.timescale * 1000;
        mp4boxFile.stop();
      };

      // 设置错误回调
      mp4boxFile.onError = (e: string) => {
        error.value = e;
        isLoading.value = false;
      };

      // 解析视频数据
      mp4boxFile.appendBuffer(mp4Buffer);
      mp4boxFile.flush();

      // 等待解析完成（通过 Promise）
      return await new Promise<number>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout while parsing video'));
          mp4boxFile.stop();
        }, 5000);

        // 检查是否已经获取到时长
        const checkInterval = setInterval(() => {
          if (duration.value > 0) {
            clearTimeout(timeout);
            clearInterval(checkInterval);
            isLoading.value = false;
            resolve(duration.value);
          } else if (error.value) {
            clearTimeout(timeout);
            clearInterval(checkInterval);
            isLoading.value = false;
            reject(new Error(error.value));
          }
        }, 50);
      });
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error';
      isLoading.value = false;
      return 0;
    }
  }

  /**
   * 批量读取多个视频的时长
   */
  async function fetchDurations(urls: string[]): Promise<number[]> {
    const durations: number[] = [];
    for (const url of urls) {
      if (!url) {
        durations.push(0);
        continue;
      }
      const dur = await fetchDuration(url);
      durations.push(dur);
    }
    return durations;
  }

  onUnmounted(() => {
    isLoading.value = false;
    error.value = null;
  });

  return {
    duration,
    isLoading,
    error,
    fetchDuration,
    fetchDurations,
  };
}