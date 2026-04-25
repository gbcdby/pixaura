/**
 * fMP4 重封装 Composable
 * 使用 mp4box.js 将普通 MP4 转换为 fMP4 格式
 * fMP4 支持 MSE (Media Source Extensions) 动态添加视频片段
 */

import { createFile, type MP4BoxBuffer } from "mp4box";
import { videoCacheService } from "@/services/video-cache.service";

// ==================== 类型定义 ====================

/** fMP4 片段 */
export interface Fmp4Segments {
  /** 初始化片段（包含元数据） */
  initSegment: ArrayBuffer;
  /** 媒体片段列表（包含实际视频/音频数据） */
  mediaSegments: ArrayBuffer[];
}

/** 重封装选项 */
export interface RemuxOptions {
  /** 每个片段的样本数，默认 100 */
  nbSamples?: number;
}

/** 重封装进度 */
export interface RemuxProgress {
  /** 当前阶段 */
  stage: "downloading" | "parsing" | "segmenting" | "done" | "error";
  /** 进度百分比 */
  percentage: number;
  /** 错误信息 */
  error?: string;
}

/** Composable 选项 */
export interface UseFmp4RemuxOptions {
  /** 进度回调 */
  onProgress?: (progress: RemuxProgress) => void;
  /** 错误回调 */
  onError?: (error: Error) => void;
}

// ==================== Composable ====================

export function useFmp4Remux(options: UseFmp4RemuxOptions = {}) {
  const { onProgress, onError } = options;

  /**
   * 将普通 MP4 转换为 fMP4
   * @param videoUrl 视频 URL
   * @param remuxOptions 重封装选项
   */
  async function remuxToFmp4(
    videoUrl: string,
    remuxOptions: RemuxOptions = {},
  ): Promise<Fmp4Segments> {
    const { nbSamples = 100 } = remuxOptions;

    // 1. 获取视频数据（优先缓存）
    onProgress?.({
      stage: "downloading",
      percentage: 0,
    });

    // 先尝试从缓存获取
    let arrayBuffer = await videoCacheService.getVideo(videoUrl);

    if (!arrayBuffer) {
      // 缓存不存在，从远程下载并存入缓存
      const response = await fetch(videoUrl);
      if (!response.ok) {
        const error = new Error(`下载视频失败: ${response.status}`);
        onProgress?.({ stage: "error", percentage: 0, error: error.message });
        onError?.(error);
        throw error;
      }
      arrayBuffer = await response.arrayBuffer();
      // 存入缓存供后续使用
      await videoCacheService.setVideo(videoUrl, arrayBuffer);
    }

    onProgress?.({
      stage: "downloading",
      percentage: 30,
    });

    // 2. 解析 MP4
    onProgress?.({
      stage: "parsing",
      percentage: 40,
    });

    // 创建 MP4Box 文件实例
    const mp4boxfile = createFile();

    // 使用 Promise 来等待异步回调完成
    return new Promise<Fmp4Segments>((resolve, reject) => {
      // 初始化结果
      const segments: Fmp4Segments = {
        initSegment: new ArrayBuffer(0),
        mediaSegments: [],
      };

      let isCompleted = false;

      // 设置错误处理
      mp4boxfile.onError = (e: string) => {
        if (!isCompleted) {
          isCompleted = true;
          const error = new Error(`MP4Box 解析错误: ${e}`);
          onProgress?.({ stage: "error", percentage: 50, error: error.message });
          onError?.(error);
          reject(error);
        }
      };

      // 设置准备回调 - 视频解析完成后的处理
      mp4boxfile.onReady = (info) => {
        // 打印视频元信息（用于调试 MSE 兼容性问题）
        console.log("[useFmp4Remux] 视频 URL:", videoUrl);
        console.log("[useFmp4Remux] 视频元信息:", {
          duration: info.duration,
          isFragmented: info.isFragmented,
          isProgressive: info.isProgressive,
          tracks: info.tracks.map((track: any) => ({
            id: track.id,
            type: track.type,
            codec: track.codec,
            // 视频轨道信息
            video: track.video ? {
              width: track.video.width,
              height: track.video.height,
              frame_rate: track.video.frame_rate,
              duration: track.video.duration,
            } : null,
            // 音频轨道信息
            audio: track.audio ? {
              sample_rate: track.audio.sample_rate,
              channel_count: track.audio.channel_count,
              duration: track.audio.duration,
            } : null,
          })),
        });

        // 为每个轨道设置分片选项
        for (const track of info.tracks) {
          if (track.id !== undefined && track.type !== undefined) {
            mp4boxfile.setSegmentOptions(track.id, null, {
              nbSamples,
            });
          }
        }

        // 调用 initializeSegmentation 获取初始化片段
        // mp4box.js 2.3.0 返回对象 { tracks: [...], buffer: ArrayBuffer }
        const initSegmentResult = mp4boxfile.initializeSegmentation();

        // 直接从返回对象中获取 buffer
        if (initSegmentResult?.buffer && initSegmentResult.buffer.byteLength > 0) {
          segments.initSegment = initSegmentResult.buffer;
        }

        onProgress?.({
          stage: "segmenting",
          percentage: 60,
        });

        // 开始分片 - 这会触发 onSegment 回调
        mp4boxfile.start();
      };

      // 检查完成状态
      const checkCompletion = () => {
        if (segments.initSegment.byteLength > 0 && !isCompleted) {
          // 给一点时间让所有 onSegment 回调完成
          setTimeout(() => {
            if (!isCompleted) {
              isCompleted = true;
              onProgress?.({
                stage: "done",
                percentage: 100,
              });
              resolve(segments);
            }
          }, 50);
        }
      };

      // 设置片段回调 - 每个片段生成后触发
      mp4boxfile.onSegment = (
        _id: number,
        _user: unknown,
        buffer: ArrayBuffer,
        _sampleNumber: number,
        isLast: boolean,
      ) => {
        // 添加到媒体片段列表
        segments.mediaSegments.push(buffer);

        const progress = Math.min(95, 60 + segments.mediaSegments.length * 3);
        onProgress?.({
          stage: "segmenting",
          percentage: progress,
        });

        // 如果这是最后一个片段，检查完成
        if (isLast) {
          checkCompletion();
        }
      };

      // 解析视频数据
      const mp4boxBuffer = Object.assign(arrayBuffer, { fileStart: 0 }) as MP4BoxBuffer;
      mp4boxfile.appendBuffer(mp4boxBuffer);
      mp4boxfile.flush();

      // 设置超时保护（10秒，给视频转换足够时间）
      setTimeout(() => {
        if (!isCompleted) {
          if (segments.initSegment.byteLength > 0) {
            // 有初始化片段，认为成功
            isCompleted = true;
            onProgress?.({
              stage: "done",
              percentage: 100,
            });
            resolve(segments);
          } else {
            isCompleted = true;
            const error = new Error("转换超时：未能生成初始化片段（10秒）");
            onProgress?.({ stage: "error", percentage: 100, error: error.message });
            onError?.(error);
            reject(error);
          }
        }
      }, 10000);
    });
  }

  /**
   * 获取视频实际时长（只解析，不转换）
   * @param videoUrl 视频 URL
   * @returns 视频时长（秒）
   */
  async function getVideoDuration(videoUrl: string): Promise<number> {
    // 下载视频数据
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`下载视频失败: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();

    // 创建 MP4Box 文件实例
    const mp4boxfile = createFile();

    return new Promise<number>((resolve, reject) => {
      mp4boxfile.onError = (e: string) => {
        reject(new Error(`MP4Box 解析错误: ${e}`));
      };

      mp4boxfile.onReady = (info) => {
        // info.duration 是毫秒，转换为秒
        const durationInSeconds = info.duration / info.timescale;
        resolve(durationInSeconds);
      };

      // 解析视频数据
      const mp4boxBuffer = Object.assign(arrayBuffer, { fileStart: 0 }) as MP4BoxBuffer;
      mp4boxfile.appendBuffer(mp4boxBuffer);
      mp4boxfile.flush();

      // 超时保护（5秒）
      setTimeout(() => {
        reject(new Error("获取视频时长超时"));
      }, 5000);
    });
  }

  /**
   * 批量转换多个视频
   * @param videoUrls 视频 URL 列表
   * @param remuxOptions 重封装选项
   */
  async function remuxMultipleToFmp4(
    videoUrls: string[],
    remuxOptions: RemuxOptions = {},
  ): Promise<Fmp4Segments[]> {
    const results: Fmp4Segments[] = [];

    for (let i = 0; i < videoUrls.length; i++) {
      onProgress?.({
        stage: "parsing",
        percentage: Math.round((i / videoUrls.length) * 100),
      });

      const segments = await remuxToFmp4(videoUrls[i], remuxOptions);
      results.push(segments);
    }

    onProgress?.({
      stage: "done",
      percentage: 100,
    });

    return results;
  }

  return {
    remuxToFmp4,
    remuxMultipleToFmp4,
    getVideoDuration,
  };
}