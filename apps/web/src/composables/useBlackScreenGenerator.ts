/**
 * 黑屏视频生成器
 * 用于无视频片段时生成黑屏填充，时长使用分镜组的 duration
 * 使用 Canvas + MediaRecorder 生成视频，转换为 fMP4 格式供 MSE 使用
 */

import { ref } from "vue";

// ==================== 类型定义 ====================

/** 黑屏生成选项 */
export interface BlackScreenOptions {
  /** 视频宽度，默认 720 */
  width?: number;
  /** 视频高度，默认 1280（竖屏 9:16） */
  height?: number;
  /** 视频时长（秒），默认 5 */
  duration?: number;
  /** 帧率，默认 30 */
  fps?: number;
}

/** 生成进度 */
export interface BlackScreenProgress {
  /** 当前阶段 */
  stage: "creating" | "encoding" | "converting" | "done" | "error";
  /** 进度百分比 */
  percentage: number;
}

/** Composable 选项 */
export interface UseBlackScreenGeneratorOptions {
  /** 进度回调 */
  onProgress?: (progress: BlackScreenProgress) => void;
  /** 错误回调 */
  onError?: (error: Error) => void;
}

// ==================== Composable ====================

export function useBlackScreenGenerator(options: UseBlackScreenGeneratorOptions = {}) {
  const { onProgress, onError } = options;

  const isGenerating = ref(false);

  /**
   * 生成黑屏视频 Blob
   * @param opts 生成选项
   * @returns WebM 格式的视频 Blob
   */
  async function generateBlackScreenBlob(
    opts: BlackScreenOptions = {},
  ): Promise<Blob> {
    const {
      width = 720,
      height = 1280,
      duration = 5,
      fps = 30,
    } = opts;

    isGenerating.value = true;
    onProgress?.({ stage: "creating", percentage: 0 });

    // 1. 创建 Canvas
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      const error = new Error("无法创建 Canvas 上下文");
      onError?.(error);
      isGenerating.value = false;
      throw error;
    }

    // 2. 绘制黑屏
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);

    onProgress?.({ stage: "encoding", percentage: 10 });

    // 3. 使用 MediaRecorder 录制 Canvas 流
    const stream = canvas.captureStream(fps);

    // 检查支持的 MIME 类型
    const mimeTypes = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ];

    let supportedMimeType = "";
    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        supportedMimeType = mimeType;
        break;
      }
    }

    if (!supportedMimeType) {
      const error = new Error("浏览器不支持 WebM 视频编码");
      onError?.(error);
      isGenerating.value = false;
      throw error;
    }

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: supportedMimeType,
      videoBitsPerSecond: 1000000, // 1 Mbps，足够黑屏
    });

    const chunks: Blob[] = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    // 开始录制
    mediaRecorder.start();

    // 计算需要录制的时间
    const totalFrames = Math.ceil(duration * fps);
    const frameInterval = 1000 / fps;

    // 录制帧（黑屏不需要变化，只需维持一段时间）
    let recordedFrames = 0;

    const updateProgress = () => {
      const progress = Math.round((recordedFrames / totalFrames) * 80) + 10;
      onProgress?.({ stage: "encoding", percentage: Math.min(progress, 90) });
    };

    // 使用定时器推进帧
    const frameTimer = setInterval(() => {
      recordedFrames++;
      updateProgress();

      if (recordedFrames >= totalFrames) {
        clearInterval(frameTimer);
        mediaRecorder.stop();
      }
    }, frameInterval);

    // 等待录制完成
    await new Promise<void>((resolve) => {
      mediaRecorder.onstop = () => {
        resolve();
      };
    });

    onProgress?.({ stage: "done", percentage: 100 });
    isGenerating.value = false;

    // 合并所有 chunk 为 Blob
    const blob = new Blob(chunks, { type: supportedMimeType });
    return blob;
  }

  /**
   * 将 Blob 转换为 ArrayBuffer
   */
  async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
        } else {
          reject(new Error("无法将 Blob 转换为 ArrayBuffer"));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });
  }

  /**
   * 生成黑屏视频并返回 ArrayBuffer（供 fMP4 转换使用）
   */
  async function generateBlackScreenBuffer(
    opts: BlackScreenOptions = {},
  ): Promise<ArrayBuffer> {
    const blob = await generateBlackScreenBlob(opts);
    return blobToArrayBuffer(blob);
  }

  return {
    isGenerating,
    generateBlackScreenBlob,
    generateBlackScreenBuffer,
  };
}