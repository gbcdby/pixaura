/// <reference types="vite/client" />
/**
 * 视频拼接 Composable
 * 使用 FFmpeg.wasm 实现前端视频拼接
 * 包含缓存策略和错误处理
 */
import { ref, onUnmounted, computed } from "vue";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { ffmpegCacheService } from "@/services/ffmpeg-cache.service";

// ==================== 类型定义 ====================

/** 视频片段信息 */
export interface VideoClip {
  id: string;
  url: string;
  duration: number; // 秒
  order: number;
}

/** 拼接配置 */
export interface ConcatConfig {
  /** 输出格式 */
  format?: "mp4" | "webm";
  /** 视频码率 (kbps) */
  videoBitrate?: number;
  /** 音频码率 (kbps) */
  audioBitrate?: number;
  /** 帧率 */
  fps?: number;
  /** 是否使用缓存 */
  useCache?: boolean;
}

/** 拼接状态 */
export type ConcatStatus =
  | "idle"
  | "loading"
  | "preparing"
  | "concatenating"
  | "done"
  | "error";

/** 缓存条目 */
interface CacheEntry {
  data: Uint8Array;
  timestamp: number;
  url: string;
}

/** 进度信息 */
export interface ConcatProgress {
  status: ConcatStatus;
  percentage: number;
  stage: string;
  currentClip: number;
  totalClips: number;
  error?: string;
}

/** Composable 选项 */
export interface UseVideoConcatOptions {
  /** 进度回调 */
  onProgress?: (progress: ConcatProgress) => void;
  /** 错误回调 */
  onError?: (error: Error) => void;
  /** 完成回调 */
  onComplete?: (blob: Blob) => void;
  /** 缓存过期时间（毫秒），默认 30 分钟 */
  cacheExpireTime?: number;
}

// ==================== 缓存管理 ====================

const globalCache = new Map<string, CacheEntry>();

/**
 * 清理过期缓存
 */
function cleanExpiredCache(expireTime: number): void {
  const now = Date.now();
  for (const [key, entry] of globalCache.entries()) {
    if (now - entry.timestamp > expireTime) {
      globalCache.delete(key);
    }
  }
}

/**
 * 获取缓存
 */
function getFromCache(url: string): Uint8Array | null {
  const entry = globalCache.get(url);
  if (entry) {
    // 更新时间戳（LRU 策略）
    entry.timestamp = Date.now();
    return entry.data;
  }
  return null;
}

/**
 * 写入缓存
 */
function setToCache(url: string, data: Uint8Array): void {
  globalCache.set(url, {
    data,
    timestamp: Date.now(),
    url,
  });
}

// ==================== FFmpeg 单例管理 ====================

let ffmpegInstance: FFmpeg | null = null;
let isLoadingFFmpeg = false;
let isFFmpegLoaded = false;

// ==================== Composable ====================

export function useVideoConcat(options: UseVideoConcatOptions = {}) {
  const {
    onProgress,
    onError,
    onComplete,
    cacheExpireTime = 30 * 60 * 1000, // 30 分钟
  } = options;

  // 状态
  const status = ref<ConcatStatus>("idle");
  const progress = ref(0);
  const stage = ref("");
  const currentClip = ref(0);
  const totalClips = ref(0);
  const error = ref<string | undefined>(undefined);

  // 计算属性
  const isReady = computed(() => isFFmpegLoaded);
  const isLoading = computed(() => status.value === "loading");
  const isProcessing = computed(() =>
    ["preparing", "concatenating"].includes(status.value),
  );

  /**
   * 加载 FFmpeg 核心（使用 IndexedDB 缓存）
   */
  async function loadFFmpeg(): Promise<void> {
    if (isFFmpegLoaded) return;
    if (isLoadingFFmpeg) {
      // 等待加载完成
      while (isLoadingFFmpeg) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return;
    }

    isLoadingFFmpeg = true;
    status.value = "loading";
    stage.value = "正在加载 FFmpeg 核心...";
    updateProgress();

    try {
      const ff = new FFmpeg();
      ffmpegInstance = ff;

      // 设置日志回调（仅在开发环境）
      if (import.meta.env.DEV) {
        ff.on("log", ({ message }) => {
          console.log("[FFmpeg]", message);
        });
      }

      // 设置进度回调
      ff.on("progress", ({ progress: p }) => {
        progress.value = Math.round(p * 100);
        updateProgress();
      });

      // 尝试从 IndexedDB 缓存加载 ffmpeg wasm
      const cachedCore = await ffmpegCacheService.getWasm("ffmpeg-core.js");

      if (cachedCore && await ffmpegCacheService.checkVersion()) {
        // 使用缓存的 wasm 文件创建 Blob URL
        stage.value = "使用缓存加载 FFmpeg...";
        updateProgress();

        const coreBlob = new Blob([cachedCore], { type: "application/javascript" });
        const coreUrl = URL.createObjectURL(coreBlob);

        await ff.load({
          coreURL: coreUrl,
        });

        // 清理 Blob URL
        URL.revokeObjectURL(coreUrl);

        isFFmpegLoaded = true;
        status.value = "idle";
        stage.value = "";
        updateProgress();

        console.log("[useVideoConcat] 从缓存加载 FFmpeg 成功");
      } else {
        // 缓存不存在或版本不匹配， 从本地 /ffmpeg/ 目录下载
        stage.value = "下载 FFmpeg wasm...";
        updateProgress();

        // 使用单线程版本
        await ffmpegCacheService.preloadFfmpeg((pct) => {
          progress.value = Math.round(pct * 80);
          updateProgress();
        });

        // 重新获取缓存
        const newCachedCore = await ffmpegCacheService.getWasm("ffmpeg-core.js");
        if (!newCachedCore) {
          // 如果缓存仍然不存在， 直接从本地目录加载
          const coreUrl = "/ffmpeg/ffmpeg-core.js";
          await ff.load({ coreURL: coreUrl });
        } else {
          const coreBlob = new Blob([newCachedCore], { type: "application/javascript" });
          const blobUrl = URL.createObjectURL(coreBlob);
          await ff.load({ coreURL: blobUrl });
          URL.revokeObjectURL(blobUrl);
        }

        isFFmpegLoaded = true;
        status.value = "idle";
        stage.value = "";
        updateProgress();

        console.log("[useVideoConcat] FFmpeg 加载成功");
      }
    } catch (err) {
      console.error("[useVideoConcat] 加载 FFmpeg 失败:", err);
      status.value = "error";
      error.value = (err as Error).message;
      onError?.(err as Error);
      updateProgress();
    } finally {
      isLoadingFFmpeg = false;
  }
  }

  /**
   * 更新进度回调
   */
  function updateProgress(): void {
    onProgress?.({
      status: status.value,
      percentage: progress.value,
      stage: stage.value,
      currentClip: currentClip.value,
      totalClips: totalClips.value,
      error: error.value,
    });
  }

  /**
   * 拼接视频
   */
  async function concatVideos(
    clips: VideoClip[],
    config: ConcatConfig = {},
  ): Promise<Blob | null> {
    if (clips.length === 0) {
      error.value = "没有视频片段可拼接";
      status.value = "error";
      updateProgress();
      return null;
    }

    // 确保 FFmpeg 已加载
    if (!isFFmpegLoaded) {
      await loadFFmpeg();
    }

    if (!ffmpegInstance || !isFFmpegLoaded) {
      error.value = "FFmpeg 未加载";
      status.value = "error";
      updateProgress();
      return null;
    }

    const ff = ffmpegInstance;

    // 初始化状态
    status.value = "preparing";
    progress.value = 0;
    stage.value = "正在准备素材...";
    currentClip.value = 0;
    totalClips.value = clips.length;
    error.value = undefined;
    updateProgress();

    const {
      format = "mp4",
      videoBitrate = 5000,
      audioBitrate = 192,
      fps = 30,
      useCache = true,
    } = config;

    // 清理过期缓存
    cleanExpiredCache(cacheExpireTime);

    try {
      // 1. 下载视频片段（使用缓存）
      stage.value = "正在下载视频片段...";
      updateProgress();

      const clipFilenames: string[] = [];
      for (let i = 0; i < clips.length; i++) {
        const clip = clips[i];
        const filename = `clip_${clip.order}.mp4`;

        // 检查缓存
        let videoData: Uint8Array | null = null;
        if (useCache) {
          videoData = getFromCache(clip.url);
          if (videoData) {
            stage.value = `使用缓存: 片段 ${i + 1}/${clips.length}`;
            updateProgress();
          }
        }

        if (!videoData) {
          stage.value = `正在下载: 片段 ${i + 1}/${clips.length}`;
          updateProgress();
          videoData = await fetchFile(clip.url);

          // 写入缓存
          if (useCache) {
            setToCache(clip.url, videoData);
          }
        }

        await ff.writeFile(filename, videoData);
        clipFilenames.push(filename);
        currentClip.value = i + 1;
        progress.value = Math.round((currentClip.value / clips.length) * 50); // 下载占 50%
        updateProgress();
      }

      // 2. 创建拼接文件
      stage.value = "正在创建拼接配置...";
      updateProgress();

      const concatContent = clipFilenames.map((f) => `file '${f}'`).join("\n");
      await ff.writeFile("concat.txt", concatContent);

      // 3. 执行拼接
      status.value = "concatenating";
      stage.value = "正在拼接视频...";
      progress.value = 50;
      updateProgress();

      const outputFilename = `output.${format}`;

      // 构建 FFmpeg 命令
      const args: string[] = [
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        "concat.txt",
        "-c:v",
        "libx264",
        "-b:v",
        `${videoBitrate}k`,
        "-c:a",
        "aac",
        "-b:a",
        `${audioBitrate}k`,
        "-r",
        String(fps),
        "-movflags",
        "+faststart", // 优化网页播放
        outputFilename,
      ];

      await ff.exec(args);

      // 4. 读取输出文件
      stage.value = "正在生成输出文件...";
      progress.value = 90;
      updateProgress();

      const data = await ff.readFile(outputFilename);
      const blobData =
        typeof data === "string"
          ? new TextEncoder().encode(data)
          : new Uint8Array(data);

      const mimeType = format === "webm" ? "video/webm" : "video/mp4";
      const blob = new Blob([blobData], { type: mimeType });

      // 5. 清理临时文件
      stage.value = "正在清理临时文件...";
      updateProgress();

      for (const filename of clipFilenames) {
        try {
          await ff.deleteFile(filename);
        } catch {
          // 忽略删除失败
        }
      }
      try {
        await ff.deleteFile("concat.txt");
        await ff.deleteFile(outputFilename);
      } catch {
        // 忽略删除失败
      }

      // 6. 完成
      status.value = "done";
      progress.value = 100;
      stage.value = "拼接完成";
      updateProgress();

      onComplete?.(blob);
      return blob;
    } catch (err) {
      console.error("[useVideoConcat] 拼接失败:", err);
      status.value = "error";
      error.value = (err as Error).message;
      onError?.(err as Error);
      updateProgress();
      return null;
    }
  }

  /**
   * 取消拼接
   */
  function cancel(): void {
    status.value = "idle";
    progress.value = 0;
    stage.value = "";
    currentClip.value = 0;
    error.value = undefined;
    updateProgress();
  }

  /**
   * 重置状态
   */
  function reset(): void {
    status.value = "idle";
    progress.value = 0;
    stage.value = "";
    currentClip.value = 0;
    totalClips.value = 0;
    error.value = undefined;
    updateProgress();
  }

  /**
   * 清理缓存
   */
  function clearCache(): void {
    globalCache.clear();
  }

  // 清理
  onUnmounted(() => {
    // 不清理 FFmpeg 实例（全局单例），但重置状态
    if (status.value !== "idle") {
      reset();
    }
  });

  return {
    // 状态
    status,
    progress,
    stage,
    currentClip,
    totalClips,
    error,
    isReady,
    isLoading,
    isProcessing,

    // 方法
    loadFFmpeg,
    concatVideos,
    cancel,
    reset,
    clearCache,
  };
}

// ==================== 辅助函数 ====================

/**
 * 下载 Blob
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 获取默认拼接配置
 */
export function getDefaultConcatConfig(): ConcatConfig {
  return {
    format: "mp4",
    videoBitrate: 5000,
    audioBitrate: 192,
    fps: 30,
    useCache: true,
  };
}
