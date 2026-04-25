/**
 * 视频导出 Composable
 * 使用 FFmpeg.wasm 实现纯前端视频合成导出
 * 包含字幕烧录和多音轨混音功能
 */
import { ref, shallowRef, onUnmounted } from "vue";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { ffmpegCacheService } from "@/services/ffmpeg-cache.service";
import type {
  StoryboardClipData,
  AudioTrack,
  ExportConfig,
  ExportProgress,
} from "@/types/video-editor-temp";
import type {
  ExportInputData,
  ExportSubtitleItem,
  ExportAudioTrack,
  AudioVolumeConfig,
} from "@pixaura/shared-types";
import { wrapSubtitleText } from "@/utils/subtitleWrap";

export type ExportStatus = ExportProgress["status"];

/** 给 Promise 添加超时 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} 超时（${ms}ms）`)), ms);
    }),
  ]);
}

/** 字幕烧录配置
 * 以下数值为 360px 宽度基准值，导出时会根据目标视频分辨率自动缩放
 */
export interface SubtitleBurnConfig {
  /** 字体文件名（需提前加载到 FFmpeg） */
  fontFile: string;
  /** 字体大小（360px 宽度基准值） */
  fontSize: number;
  /** 字体颜色 */
  fontColor: string;
  /** 边框宽度（360px 宽度基准值） */
  borderWidth: number;
  /** 边框颜色 */
  borderColor: string;
  /** Y 轴偏移（360px 宽度基准值，正数向下） */
  yOffset: number;
}

/** 默认字幕样式
 * 基准值对应 1080×1920 标准竖屏分辨率下的样式：
 * - fontSize: 48px（与 PreviewArea / exportDataExtractor defaultStyle 对齐）
 * - yOffset: 55px（底部边距，约为 fontSize 的 1.15 倍）
 * - borderWidth: 3px（描边宽度，与字体大小比例一致）
 * 导出时会根据目标视频分辨率自动缩放
 */
const DEFAULT_SUBTITLE_STYLE: SubtitleBurnConfig = {
  fontFile: "NotoSansSC-Regular.ttf",
  fontSize: 48,
  fontColor: "white",
  borderWidth: 3,
  borderColor: "black",
  yOffset: 55,
};

export interface UseVideoExportOptions {
  onProgress?: (progress: number) => void;
  onError?: (error: Error) => void;
}

export function useVideoExport(options: UseVideoExportOptions = {}) {
  const { onProgress, onError } = options;

  // FFmpeg 实例
  const ffmpeg = shallowRef<FFmpeg | null>(null);

  // 状态
  const status = ref<ExportStatus>("idle");
  const progress = ref(0);
  const stage = ref("");
  const estimatedTime = ref(0);
  const error = ref<string | undefined>(undefined);

  // 是否已加载
  const isLoaded = ref(false);
  const isLoading = ref(false);

  // 编码阶段总时长（用于进度计算）
  let encodingTotalDuration = 0;
  const estimatedTotalTime = ref(0);

  /**
   * 加载 FFmpeg 核心（使用 IndexedDB 缓存）
   */
  const loadFFmpeg = async (): Promise<void> => {
    if (isLoaded.value || isLoading.value) return;

    isLoading.value = true;
    status.value = "preparing";
    stage.value = "正在加载 FFmpeg 核心...";

    try {
      const ff = new FFmpeg();
      ffmpeg.value = ff;

      // 设置日志回调
      ff.on("log", ({ message }) => {
        console.log("[FFmpeg]", message);
      });

      // 设置进度回调（编码阶段 57%-87%，根据已处理秒数 / 总时长计算）
      ff.on("progress", ({ time }) => {
        const currentSeconds = time / 1000000; // 微秒转秒
        estimatedTime.value = Math.round(currentSeconds);
        // 编码阶段进度范围 57%-87%，根据已处理秒数 / 总时长计算
        if (encodingTotalDuration > 0 && status.value === "encoding") {
          const encodingProgress = Math.min(currentSeconds / encodingTotalDuration, 1);
          progress.value = Math.round(57 + encodingProgress * 30);
          onProgress?.(progress.value);
          console.log(
            `[useVideoExport] 编码进度: ${progress.value}%, 已处理: ${currentSeconds.toFixed(2)}s / ${encodingTotalDuration.toFixed(2)}s`,
          );
        }
      });

      // 核心文件始终从本地绝对路径加载，避免 Blob URL 在 Worker import() 时失败
      // 使用完整 URL 绕过 Vite 开发服务器对 /public 文件的导入拦截
      const coreUrl = new URL("/ffmpeg/ffmpeg-core.js", window.location.href).href;

      // 尝试从 IndexedDB 缓存加载 wasm
      console.log("[useVideoExport] 尝试从 IndexedDB 加载 FFmpeg wasm...");
      let cachedWasm: ArrayBuffer | null = null;
      let versionOk = false;
      try {
        cachedWasm = await ffmpegCacheService.getWasm("ffmpeg-core.wasm");
        versionOk = await ffmpegCacheService.checkVersion();
      } catch (cacheErr) {
        console.warn("[useVideoExport] IndexedDB 缓存读取失败:", cacheErr);
      }

      if (cachedWasm && versionOk) {
        // wasm 已缓存，使用 Blob URL 加载 wasm，core.js 从本地路径加载
        stage.value = "使用缓存加载 FFmpeg...";
        const wasmBlob = new Blob([cachedWasm], { type: "application/wasm" });
        const wasmUrl = URL.createObjectURL(wasmBlob);

        await withTimeout(
          ff.load({ coreURL: coreUrl, wasmURL: wasmUrl, classWorkerURL: "/ffmpeg/ffmpeg.worker.js" }),
          60000,
          "FFmpeg 加载",
        );
        URL.revokeObjectURL(wasmUrl);

        isLoaded.value = true;
        status.value = "idle";
        stage.value = "";
        console.log("[useVideoExport] 从缓存加载 FFmpeg 成功");
      } else {
        // 缓存不存在或版本不匹配，先下载到缓存
        stage.value = "下载 FFmpeg wasm...";
        try {
          await ffmpegCacheService.preloadFfmpeg((pct) => {
            progress.value = Math.round(pct * 0.8);
          });
        } catch (preloadErr) {
          console.warn("[useVideoExport] 缓存预加载失败，将直接下载:", preloadErr);
        }

        // 重新获取缓存的 wasm
        let newCachedWasm: ArrayBuffer | null = null;
        try {
          newCachedWasm = await ffmpegCacheService.getWasm("ffmpeg-core.wasm");
        } catch {
          // 忽略
        }
        if (newCachedWasm) {
          const wasmBlob = new Blob([newCachedWasm], { type: "application/wasm" });
          const wasmUrl = URL.createObjectURL(wasmBlob);
          await withTimeout(
            ff.load({ coreURL: coreUrl, wasmURL: wasmUrl, classWorkerURL: "/ffmpeg/ffmpeg.worker.js" }),
            60000,
            "FFmpeg 加载",
          );
          URL.revokeObjectURL(wasmUrl);
        } else {
          // 兜底：直接从本地目录加载（会额外下载 wasm）
          console.log("[useVideoExport] 无缓存，直接从本地加载 FFmpeg...");
          await withTimeout(
            ff.load({ coreURL: coreUrl, classWorkerURL: "/ffmpeg/ffmpeg.worker.js" }),
            60000,
            "FFmpeg 加载",
          );
        }

        isLoaded.value = true;
        status.value = "idle";
        stage.value = "";
        console.log("[useVideoExport] FFmpeg 加载成功");
      }
    } catch (err) {
      console.error("[useVideoExport] 加载 FFmpeg 失败:", err);
      status.value = "error";
      error.value = (err as Error).message;
      onError?.(err as Error);
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 加载字体文件到 FFmpeg 虚拟文件系统
   */
  const loadFont = async (
    fontUrl: string = "/fonts/NotoSansSC-Regular.ttf",
    fontName: string = "NotoSansSC-Regular.ttf",
  ): Promise<void> => {
    if (!ffmpeg.value) return;

    try {
      const fontData = await fetchFile(fontUrl);
      await ffmpeg.value.writeFile(fontName, fontData);
      console.log(`[useVideoExport] 字体加载成功: ${fontName}`);
    } catch (err) {
      console.warn(`[useVideoExport] 字体加载失败:`, err);
      throw new Error("无法加载字幕字体，请检查字体文件是否存在");
    }
  };

  /**
   * 导出视频（旧接口）
   */
  const exportVideo = async (
    clips: StoryboardClipData[],
    audioTracks: AudioTrack[],
    config: ExportConfig,
  ): Promise<Blob | null> => {
    if (!ffmpeg.value) {
      await loadFFmpeg();
    }

    if (!ffmpeg.value || !isLoaded.value) {
      error.value = "FFmpeg 未加载";
      status.value = "error";
      return null;
    }

    const ff = ffmpeg.value;
    status.value = "preparing";
    progress.value = 0;
    stage.value = "正在准备素材...";
    error.value = undefined;

    try {
      // 1. 下载视频素材
      stage.value = "正在下载视频素材...";
      for (const clip of clips) {
        if (clip.videoUrl) {
          const filename = `clip_${clip.order}.mp4`;
          await ff.writeFile(filename, await fetchFile(clip.videoUrl));
        }
      }

      // 2. 下载音频素材
      stage.value = "正在下载音频素材...";
      for (const track of audioTracks) {
        if (track.audioUrl) {
          const filename = `audio_${track.id}.mp3`;
          await ff.writeFile(filename, await fetchFile(track.audioUrl));
        }
      }

      // 3. 创建拼接文件
      stage.value = "正在创建拼接配置...";
      const concatContent = clips
        .filter((c) => c.videoUrl)
        .map((c) => `file 'clip_${c.order}.mp4'`)
        .join("\n");
      await ff.writeFile("concat.txt", concatContent);

      // 4. 构建输出文件名
      const outputFilename = `output.${config.format}`;

      // 5. 构建 FFmpeg 命令
      status.value = "encoding";
      stage.value = "正在编码视频...";

      const args = buildFFmpegArgs(clips, audioTracks, config);
      await ff.exec(args);

      // 6. 读取输出文件
      stage.value = "正在生成输出文件...";
      const data = await ff.readFile(outputFilename);

      // 7. 清理临时文件
      stage.value = "正在清理临时文件...";
      for (const clip of clips) {
        try {
          await ff.deleteFile(`clip_${clip.order}.mp4`);
        } catch {
          // 忽略删除失败
        }
      }
      for (const track of audioTracks) {
        try {
          await ff.deleteFile(`audio_${track.id}.mp3`);
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

      // 8. 返回 Blob
      status.value = "done";
      progress.value = 100;
      stage.value = "导出完成";

      const mimeType = getMimeType(config.format);
      const blobData =
        typeof data === "string"
          ? new TextEncoder().encode(data)
          : new Uint8Array(data);
      return new Blob([blobData], { type: mimeType });
    } catch (err) {
      console.error("[useVideoExport] 导出失败:", err);
      status.value = "error";
      error.value = (err as Error).message;
      onError?.(err as Error);
      return null;
    }
  };

  /**
   * 导出带字幕的视频（使用新的 ExportInputData 格式）
   */
  const exportWithSubtitles = async (
    exportData: ExportInputData,
    config: ExportConfig,
    subtitleConfig: SubtitleBurnConfig = DEFAULT_SUBTITLE_STYLE,
  ): Promise<Blob | null> => {
    if (!ffmpeg.value) {
      await loadFFmpeg();
    }

    if (!ffmpeg.value || !isLoaded.value) {
      error.value = "FFmpeg 未加载";
      status.value = "error";
      return null;
    }

    const ff = ffmpeg.value;
    status.value = "preparing";
    progress.value = 0;
    stage.value = "正在准备素材...";
    error.value = undefined;

    const includeSubtitles = config.includeSubtitles !== false;

    // 设置编码阶段总时长，用于进度计算
    encodingTotalDuration = exportData.timeline?.duration ?? 0;
    estimatedTotalTime.value = encodingTotalDuration;

    try {
      // 1. 加载字体（仅在需要字幕时）
      if (includeSubtitles) {
        stage.value = "正在加载字体...";
        await loadFont("/fonts/NotoSansSC-Regular.ttf", subtitleConfig.fontFile);
      }

      // 2. 下载/生成视频素材
      stage.value = "正在准备视频素材...";
      const videoClips = exportData.videoTracks[0]?.clips ?? [];
      const resolution = getResolutionFromTimeline(exportData.timeline);
      console.log(`[useVideoExport] 开始准备 ${videoClips.length} 个视频片段, 目标分辨率:`, resolution);

      // 打印每个片段的详细信息，便于诊断
      for (let i = 0; i < videoClips.length; i++) {
        const c = videoClips[i];
        console.log(
          `[useVideoExport] clip ${i}: sourceUrl=${c.sourceUrl ? "有" : "无"}, start=${c.timelineStart.toFixed(3)}s, end=${c.timelineEnd.toFixed(3)}s, duration=${(c.timelineEnd - c.timelineStart).toFixed(3)}s, id=${c.id}`,
        );
      }

      if (videoClips.length === 0) {
        throw new Error("没有可导出的视频片段");
      }

      // 先下载所有真实视频
      for (let i = 0; i < videoClips.length; i++) {
        const clip = videoClips[i];
        const filename = `clip_${i}.mp4`;
        if (clip.sourceUrl) {
          console.log(`[useVideoExport] 下载视频 ${i}: ${clip.sourceUrl.substring(0, 80)}...`);
          await ff.writeFile(filename, await fetchFile(clip.sourceUrl));
          console.log(`[useVideoExport] 视频 ${i} 下载完成`);
        }
        progress.value = Math.round(((i + 1) / videoClips.length) * 5);
      }

      // 探测第一个真实视频的分辨率和帧率，确保黑屏视频与真实视频完全一致
      // 避免 concat demuxer 因 fps/time-base 不一致导致时间戳错位
      let detectedVideoResolution: { width: number; height: number } | null = null;
      let detectedFps: number | null = null;
      for (let i = 0; i < videoClips.length; i++) {
        if (!videoClips[i].sourceUrl) continue;
        const logs: string[] = [];
        const handler = ({ message }: { message: string }) => logs.push(message);
        ff.on("log", handler);
        try {
          await ff.exec(["-hide_banner", "-i", `clip_${i}.mp4`]);
        } catch {
          // 探测命令预期返回非零退出码
        } finally {
          ff.off("log", handler);
        }
        const videoLine = logs.find((m) => m.includes("Stream #0:") && m.includes("Video:"));
        if (videoLine) {
          const resMatch = videoLine.match(/(\d{2,4})x(\d{2,4})/);
          if (resMatch) {
            detectedVideoResolution = {
              width: parseInt(resMatch[1], 10),
              height: parseInt(resMatch[2], 10),
            };
          }
          // 匹配 fps (如 "24 fps" 或 "30 fps")
          const fpsMatch = videoLine.match(/(\d+(?:\.\d+)?)\s+fps/);
          if (fpsMatch) {
            detectedFps = parseFloat(fpsMatch[1]);
          }
          console.log("[useVideoExport] 检测到视频规格:", { resolution: detectedVideoResolution, fps: detectedFps });
        }
        break;
      }
      // 所有 temp 文件必须保持完全一致的视频参数（分辨率、fps、像素格式），
      // 否则 concat demuxer 会因参数差异导致拼接时挂起或崩溃
      const targetResolution = resolution;
      const targetFps = config.fps;
      console.log("[useVideoExport] 使用目标分辨率:", targetResolution, "目标帧率:", targetFps);

      // 生成黑屏视频（使用统一目标帧率，输出为 MPEG-TS 流式格式，避免 concat demuxer 处理 MP4 时触发 bitstream filter 导致死锁）
      for (let i = 0; i < videoClips.length; i++) {
        const clip = videoClips[i];
        const duration = clip.timelineEnd - clip.timelineStart;
        if (!clip.sourceUrl) {
          console.log(`[useVideoExport] 生成黑屏视频 ${i}, 时长 ${duration}s, 分辨率 ${targetResolution.width}x${targetResolution.height}, fps=${targetFps}`);
          try {
            await ff.exec([
              "-f", "lavfi",
              "-i", `color=c=black:s=${targetResolution.width}x${targetResolution.height}:r=${targetFps}`,
              "-t", String(duration),
              "-c:v", "libx264",
              "-pix_fmt", "yuv420p",
              "-preset", "ultrafast",
              "-r", String(targetFps),
              "-y",
              `temp_${i}.ts`,
            ]);
            console.log(`[useVideoExport] 黑屏视频 ${i} 生成完成`);
          } catch (e) {
            console.error(`[useVideoExport] 黑屏视频 ${i} 生成失败:`, e);
            throw new Error(`黑屏视频生成失败: ${(e as Error).message}`);
          }
        }
        progress.value = 5 + Math.round(((i + 1) / videoClips.length) * 5);
      }

      // 3. 下载音频素材
      stage.value = "正在下载音频素材...";
      let audioFileCount = 0;
      for (const track of exportData.audioTracks) {
        for (let i = 0; i < track.clips.length; i++) {
          const clip = track.clips[i];
          const ext = getAudioFileExtension(clip.sourceUrl);
          const filename = `audio_${track.type}_${i}.${ext}`;
          console.log(`[useVideoExport] 下载音频: ${filename}`);
          await ff.writeFile(filename, await fetchFile(clip.sourceUrl));
          audioFileCount++;
        }
      }
      console.log(`[useVideoExport] 音频素材下载完成, 共 ${audioFileCount} 个文件`);
      progress.value = 10;

      // 4. 探测每个视频是否包含音频流
      stage.value = "正在检查视频音频...";
      const videoHasAudio: boolean[] = [];
      for (let i = 0; i < videoClips.length; i++) {
        const logs: string[] = [];
        const handler = ({ message }: { message: string }) => logs.push(message);
        ff.on("log", handler);
        try {
          await ff.exec(["-hide_banner", "-i", `clip_${i}.mp4`]);
        } catch {
          // 仅探测元数据，预期会返回非零退出码
        } finally {
          ff.off("log", handler);
        }
        const hasAudio = logs.some((m) => /Stream #\d+:\d+/.test(m) && m.includes("Audio:"));
        videoHasAudio.push(hasAudio);
        console.log(`[useVideoExport] clip_${i}.mp4 hasAudio=${hasAudio} (sourceUrl=${!!videoClips[i].sourceUrl})`);
      }
      progress.value = 15;

      // 预处理使用单线程编码，避免 wasm 多线程死锁；输出 MPEG-TS 流式格式，concat 更稳定

      // 5. 预处理：统一视频参数（分辨率、fps、像素格式）并注入/统一音频。
      //    concat demuxer 要求所有输入文件的流参数完全一致，因此必须对视频流进行重编码，
      //    不能继续使用 -c:v copy（不同片段可能存在分辨率、fps、profile 差异）。
      //    输出为 .ts（MPEG-TS）而非 .mp4，避免 wasm 环境下 MP4 切换时 h264_mp4toannexb 死锁。
      stage.value = "正在标准化视频格式...";
      for (let i = 0; i < videoClips.length; i++) {
        const clip = videoClips[i];
        const clipDuration = clip.timelineEnd - clip.timelineStart;

        // 黑屏视频已在生成阶段直接输出到 temp_i.ts，跳过预处理
        if (clip.sourceUrl) {
          // 预处理阶段直接输出目标分辨率，最终编码阶段只需 drawtext，简化滤镜链
          const videoFilter = `fps=${targetFps},scale=${resolution.width}:${resolution.height}:force_original_aspect_ratio=decrease,pad=${resolution.width}:${resolution.height}:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p`;

          if (videoHasAudio[i]) {
            // 有音频：统一视频参数 + 统一音频格式
            console.log(`[useVideoExport] 预处理视频 ${i}: 有音频, 统一参数并截断到 ${clipDuration.toFixed(6)}s`);
            await ff.exec([
              "-i", `clip_${i}.mp4`,
              "-t", String(clipDuration),
              "-vf", videoFilter,
              "-c:v", "libx264",
              "-preset", "ultrafast",
              "-threads", "1",
              "-c:a", "aac",
              "-ar", "48000",
              "-ac", "2",
              "-b:a", "128k",
              "-y",
              `temp_${i}.ts`,
            ]);
          } else {
            // 无音频：统一视频参数 + 注入静音音频
            console.log(`[useVideoExport] 预处理视频 ${i}: 无音频, 统一参数并注入静音, 截断到 ${clipDuration.toFixed(6)}s`);
            await ff.exec([
              "-f", "lavfi", "-i", "anullsrc=r=48000:cl=2c",
              "-i", `clip_${i}.mp4`,
              "-t", String(clipDuration),
              "-map", "1:v",
              "-map", "0:a",
              "-vf", videoFilter,
              "-c:v", "libx264",
              "-preset", "ultrafast",
              "-threads", "1",
              "-c:a", "aac",
              "-ar", "48000",
              "-ac", "2",
              "-b:a", "128k",
              "-y",
              `temp_${i}.ts`,
            ]);
          }

          // 预处理后立即删除原始 MP4，释放内存
          try {
            await ff.deleteFile(`clip_${i}.mp4`);
            console.log(`[useVideoExport] 已删除原始视频 clip_${i}.mp4`);
          } catch {
            // 忽略删除失败
          }
        }

        progress.value = 15 + Math.round(((i + 1) / videoClips.length) * 40);
      }

      // 6. 分批拼接：每 5 个 temp 片段拼成一个 batch TS，拼完立即删除源 temp 文件
      //    降低 FS 峰值文件数量，减少 wasm 内存压力
      const BATCH_SIZE = 5;
      const batchCount = Math.ceil(videoClips.length / BATCH_SIZE);
      stage.value = "正在分批拼接视频...";
      for (let b = 0; b < batchCount; b++) {
        const startIdx = b * BATCH_SIZE;
        const endIdx = Math.min(startIdx + BATCH_SIZE, videoClips.length);
        const batchLines: string[] = [];
        for (let i = startIdx; i < endIdx; i++) {
          batchLines.push(`file 'temp_${i}.ts'`);
        }
        const batchConcatContent = batchLines.join("\n");
        const batchConcatName = `batch_concat_${b}.txt`;
        await ff.writeFile(batchConcatName, batchConcatContent);

        console.log(`[useVideoExport] 拼接 batch_${b}.ts (${startIdx}-${endIdx - 1})`);
        await ff.exec([
          "-f", "concat", "-safe", "0", "-i", batchConcatName,
          "-c", "copy",
          "-y",
          `batch_${b}.ts`,
        ]);
        console.log(`[useVideoExport] batch_${b}.ts 拼接完成`);

        // 删除该批 temp 文件和 batch concat 配置
        for (let i = startIdx; i < endIdx; i++) {
          try {
            await ff.deleteFile(`temp_${i}.ts`);
            console.log(`[useVideoExport] 已删除 temp_${i}.ts`);
          } catch {
            // 忽略
          }
        }
        try {
          await ff.deleteFile(batchConcatName);
        } catch {
          // 忽略
        }

        progress.value = 55 + Math.round(((b + 1) / batchCount) * 2);
      }

      // 创建最终拼接文件（引用 batch TS）
      stage.value = "正在创建拼接配置...";
      const concatLines: string[] = [];
      let concatTotalDuration = 0;
      for (let i = 0; i < videoClips.length; i++) {
        const segDuration = videoClips[i].timelineEnd - videoClips[i].timelineStart;
        concatTotalDuration += segDuration;
      }
      for (let b = 0; b < batchCount; b++) {
        concatLines.push(`file 'batch_${b}.ts'`);
      }
      const concatContent = concatLines.join("\n");
      console.log("[useVideoExport] concat.txt 内容:\n", concatContent);
      console.log(`[useVideoExport] concat duration 总和=${concatTotalDuration.toFixed(6)}s, timeline.duration=${(exportData.timeline?.duration ?? 0).toFixed(6)}s`);
      await ff.writeFile("concat.txt", concatContent);
      progress.value = 57;

      // 7. 构建字幕滤镜（根据目标分辨率动态缩放字体大小，与合成侧保持比例一致）
      const subtitleTrack = includeSubtitles ? exportData.subtitleTracks[0] : undefined;
      const subtitleFilter = subtitleTrack
        ? buildDrawtextFilter(subtitleTrack.items, subtitleConfig, resolution)
        : "";
      console.log("[useVideoExport] 字幕滤镜:", subtitleFilter ? "已启用" : "已禁用");

      // 8. 音频混音滤镜
      const hasAnyVideoAudio = videoHasAudio.some((v) => v);
      const audioFilter = buildAmixFilter(exportData.audioTracks, exportData.audioVolumeConfig, hasAnyVideoAudio);
      console.log("[useVideoExport] 音频混音滤镜:", audioFilter ? "已启用" : "已禁用");

      // 9. 构建 FFmpeg 命令
      status.value = "encoding";
      stage.value = "正在编码视频...";
      progress.value = 57;

      const args = buildExportFFmpegArgs(
        batchCount,
        exportData.audioTracks,
        config,
        subtitleFilter,
        audioFilter,
        exportData.timeline,
      );
      console.log("[useVideoExport] FFmpeg 命令:", args.join(" "));
      // 编码超时设为 30 分钟（wasm 版 FFmpeg 编码高分辨率视频可能很慢）
      const ENCODING_TIMEOUT_MS = 30 * 60 * 1000;
      await ff.exec(args, ENCODING_TIMEOUT_MS);
      console.log("[useVideoExport] FFmpeg 编码完成");

      // 8. 读取输出文件
      stage.value = "正在生成输出文件...";
      progress.value = 92;
      const outputFilename = `output.${config.format}`;
      const data = await ff.readFile(outputFilename);

      // 9. 清理临时文件
      stage.value = "正在清理临时文件...";
      await cleanupExportFiles(ff, videoClips.length, exportData.audioTracks);

      // 10. 返回 Blob
      status.value = "done";
      progress.value = 100;
      stage.value = "导出完成";

      const mimeType = getMimeType(config.format);
      const blobData =
        typeof data === "string"
          ? new TextEncoder().encode(data)
          : new Uint8Array(data);
      return new Blob([blobData], { type: mimeType });
    } catch (err) {
      console.error("[useVideoExport] 导出失败:", err);
      status.value = "error";
      error.value = (err as Error).message;
      onError?.(err as Error);
      return null;
    }
  };

  /**
   * 取消导出
   */
  const cancelExport = (): void => {
    status.value = "idle";
    progress.value = 0;
    stage.value = "";
    error.value = undefined;
  };

  /**
   * 重置状态
   */
  const reset = (): void => {
    status.value = "idle";
    progress.value = 0;
    stage.value = "";
    error.value = undefined;
    estimatedTime.value = 0;
  };

  // 清理
  onUnmounted(() => {
    // FFmpeg 实例会在组件卸载时自动清理
  });

  return {
    // 状态
    status,
    progress,
    stage,
    estimatedTime,
    estimatedTotalTime,
    error,
    isLoaded,
    isLoading,

    // 方法
    loadFFmpeg,
    exportVideo,
    exportWithSubtitles,
    loadFont,
    cancelExport,
    reset,
  };
}

// ==================== 字幕烧录相关工具函数 ====================

/**
 * 构建 drawtext 滤镜字符串
 * 字体大小和偏移根据目标视频分辨率动态缩放，与合成侧（PreviewArea）保持比例一致
 *
 * 缩放逻辑：
 * - preview-wrapper 固定为视频原始分辨率，字幕按绝对像素渲染
 * - scale = videoDiagonal / BASE_VIDEO_DIAGONAL（仅分辨率差异）
 *
 * 多行居中：FFmpeg wasm 的 drawtext 不支持 text_align，因此将每行拆分为
 * 独立的 drawtext 滤镜，各自使用 x=(w-text_w)/2 实现行内居中。
 */
function buildDrawtextFilter(
  subtitles: ExportSubtitleItem[],
  config: SubtitleBurnConfig,
  resolution?: { width: number; height: number },
): string {
  if (subtitles.length === 0) {
    return "";
  }

  // 基准视频对角线：1080×1920（竖屏标准分辨率），与 PreviewArea 保持一致
  const BASE_VIDEO_DIAGONAL = Math.sqrt(1080 * 1080 + 1920 * 1920);

  // 视频分辨率对角线
  const videoDiagonal = resolution
    ? Math.sqrt(resolution.width * resolution.width + resolution.height * resolution.height)
    : BASE_VIDEO_DIAGONAL;

  // 分辨率缩放：与 PreviewArea 一致，仅与视频原始分辨率有关
  const scale = videoDiagonal / BASE_VIDEO_DIAGONAL;

  const fontSize = Math.round((config.fontSize || 14) * scale);
  const yOffset = Math.round((config.yOffset || 16) * scale);
  const borderWidth = Math.max(1, Math.round((config.borderWidth || 1) * scale));
  const lineSpacing = Math.round(fontSize * 0.3);

  // 字幕容器宽度：与 PreviewArea 的视觉宽度保持一致
  const containerWidth = resolution ? resolution.width * 0.9 * 0.92 : 360 * 0.9 * 0.92;

  // 辅助函数：转义 FFmpeg drawtext 参数中的特殊字符
  function escapeDrawtext(text: string): string {
    return text
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/:/g, "\\:");
  }

  const allFilters: string[] = [];

  for (const sub of subtitles) {
    // 用 Canvas 动态测量换行（与预览侧保持一致）
    const wrappedText = wrapSubtitleText(sub.text, containerWidth, fontSize);
    const lines = wrappedText.split("\n");

    // 每行独立生成 drawtext 滤镜，从底部向上排列
    // index 0 = 最底行（最后一行），index 最大 = 最顶行（第一行）
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineYOffset = yOffset + (lines.length - 1 - i) * (fontSize + lineSpacing);
      const escapedLine = escapeDrawtext(line);

      const params = [
        `text='${escapedLine}'`,
        `fontfile=${config.fontFile}`,
        `fontsize=${fontSize}`,
        `fontcolor=${config.fontColor}`,
        `x=(w-text_w)/2`,
        `y=h-th-${lineYOffset}`,
        `borderw=${borderWidth}`,
        `bordercolor=${config.borderColor}`,
        `enable='between(t,${sub.startTime},${sub.endTime})'`,
      ];

      allFilters.push(`drawtext=${params.join(":")}`);
    }
  }

  return allFilters.join(",");
}

/**
 * 构建音频混音滤镜
 * concat protocol 下，拼接后的视频（含音频）为输入 0，其余音频从输入 1 开始
 * @param includeVideoAudio 是否混入输入 0 的视频原声
 */
function buildAmixFilter(
  tracks: ExportAudioTrack[],
  volumeConfig?: AudioVolumeConfig,
  includeVideoAudio: boolean = false,
): string {
  const hasExtraAudio = tracks.some((t) => t.clips.length > 0);
  if (!hasExtraAudio && !includeVideoAudio) {
    return "";
  }

  const volumeMap: Record<string, number> = {
    video_embedded: volumeConfig?.videoEmbedded ?? 1.0,
    voiceover: volumeConfig?.voiceover ?? 0.8,
    bgm_overall: volumeConfig?.bgmOverall ?? 0.3,
    bgm_individual: volumeConfig?.bgmIndividual ?? 0.3,
    bgm_user: volumeConfig?.bgmUser ?? 0.3,
  };

  const chains: string[] = [];
  const inputLabels: string[] = [];

  if (includeVideoAudio) {
    const vol = volumeMap.video_embedded ?? 1.0;
    chains.push(`[0:a]volume=${vol.toFixed(2)}[a_embedded]`);
    inputLabels.push("[a_embedded]");
  }

  let globalInputIndex = 1;

  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    const baseVolume = volumeMap[track.type] ?? 0.5;

    for (let j = 0; j < track.clips.length; j++) {
      const clip = track.clips[j];
      const duration = (clip.timelineEnd ?? 0) - (clip.timelineStart ?? 0);
      const clipVolume = clip.volume * baseVolume;
      const label = `a${i}_${j}`;
      const delayMs = Math.round((clip.timelineStart ?? 0) * 1000);

      // 构建滤镜链：截断 → 重置时间戳 → 延迟 → 音量
      const filterParts: string[] = [];
      filterParts.push(`atrim=0:${duration.toFixed(6)}`);
      filterParts.push("asetpts=PTS-STARTPTS");
      if (delayMs > 0) {
        filterParts.push(`adelay=${delayMs}|${delayMs}`);
      }
      filterParts.push(`volume=${clipVolume.toFixed(2)}`);

      chains.push(`[${globalInputIndex}:a]${filterParts.join(",")}[${label}]`);
      inputLabels.push(`[${label}]`);
      globalInputIndex++;
    }
  }

  if (inputLabels.length === 1) {
    // 仅一个音频输入时，无需使用 amix，直接通过 volume 后输出
    return chains.join(";").replace(/\[a_\w+\]$/, "[aout]");
  }

  if (inputLabels.length > 1) {
    return `${chains.join(";")};${inputLabels.join("")}amix=inputs=${inputLabels.length}:duration=longest:dropout_transition=2[aout]`;
  }

  return "";
}

/**
 * 构建导出 FFmpeg 命令参数
 * 使用 concat protocol 拼接已预处理好的 temp_i.mp4，配合 -vf 字幕和 -af 混音
 */
function buildExportFFmpegArgs(
  videoClipCount: number,
  audioTracks: ExportAudioTrack[],
  config: ExportConfig,
  subtitleFilter: string,
  audioFilter: string,
  timeline?: ExportInputData["timeline"],
): string[] {
  const args: string[] = [];

  // 1. 拼接后的视频列表（通过 concat protocol）
  if (videoClipCount > 0) {
    args.push("-f", "concat", "-safe", "0", "-i", "concat.txt");
  }

  // 2. 额外音频作为输入
  for (const track of audioTracks) {
    for (let i = 0; i < track.clips.length; i++) {
      const ext = getAudioFileExtension(track.clips[i].sourceUrl);
      args.push("-i", `audio_${track.type}_${i}.${ext}`);
    }
  }

  // 3. 视频处理（字幕）
  // 预处理阶段已完成 fps/scale/pad/format 统一，此处视频流已是目标分辨率，
  // 最终编码只需叠加字幕，最大限度简化滤镜链
  const videoFilters: string[] = [];
  if (subtitleFilter) {
    videoFilters.push(subtitleFilter);
  }

  if (videoFilters.length > 0) {
    args.push("-vf", videoFilters.join(","));
  }

  // 4. 音频处理（多输入混音必须使用 -filter_complex，-af 不支持）
  if (audioFilter) {
    args.push("-filter_complex", audioFilter);
  }

  // 5. 输出映射
  if (videoClipCount > 0) {
    args.push("-map", "0:v");
    if (audioFilter) {
      args.push("-map", "[aout]");
    } else {
      args.push("-map", "0:a");
    }
  }

  args.push("-c:v", getVideoCodec(config.videoCodec));
  args.push("-preset", "ultrafast");
  args.push("-threads", "1");
  args.push("-b:v", `${config.bitrate.video}k`);
  args.push("-c:a", getAudioCodec(config.audioCodec));
  args.push("-b:a", `${config.bitrate.audio}k`);
  args.push("-r", String(config.fps));
  args.push("-pix_fmt", "yuv420p");

  // 6. 精确截断到统一时间轴总时长（兜底，防止 copy 模式下关键帧对齐导致时长偏差累积）
  if (timeline?.duration) {
    args.push("-t", String(timeline.duration));
  }

  args.push("-movflags", "+faststart");
  args.push(`output.${config.format}`);

  return args;
}

/**
 * 从时间轴信息获取分辨率
 */
function getResolutionFromTimeline(
  timeline: ExportInputData["timeline"],
): { width: number; height: number } {
  const resolutions: Record<string, { width: number; height: number }> = {
    "480p": { width: 854, height: 480 },
    "720p": { width: 1280, height: 720 },
    "1080p": { width: 1920, height: 1080 },
  };

  const base = resolutions[timeline.resolution] ?? { width: 1920, height: 1080 };

  if (timeline.aspectRatio === "9:16") {
    return { width: base.height, height: base.width };
  } else if (timeline.aspectRatio === "1:1") {
    const size = Math.min(base.width, base.height);
    return { width: size, height: size };
  }

  return base;
}

/**
 * 清理导出临时文件
 */
async function cleanupExportFiles(
  ff: FFmpeg,
  clipCount: number,
  audioTracks: ExportAudioTrack[],
): Promise<void> {
  // 原始视频（预处理阶段大部分已删除，兜底清理）
  for (let i = 0; i < clipCount; i++) {
    try {
      await ff.deleteFile(`clip_${i}.mp4`);
    } catch {
      // 忽略
    }
    try {
      await ff.deleteFile(`temp_${i}.ts`);
    } catch {
      // 忽略
    }
  }

  // 分批拼接的中间文件
  const BATCH_SIZE = 5;
  const batchCount = Math.ceil(clipCount / BATCH_SIZE);
  for (let b = 0; b < batchCount; b++) {
    try {
      await ff.deleteFile(`batch_${b}.ts`);
    } catch {
      // 忽略
    }
    try {
      await ff.deleteFile(`batch_concat_${b}.txt`);
    } catch {
      // 忽略
    }
  }

  for (const track of audioTracks) {
    for (let i = 0; i < track.clips.length; i++) {
      const ext = getAudioFileExtension(track.clips[i].sourceUrl);
      try {
        await ff.deleteFile(`audio_${track.type}_${i}.${ext}`);
      } catch {
        // 忽略
      }
    }
  }

  try {
    await ff.deleteFile("concat.txt");
    await ff.deleteFile("output.mp4");
    await ff.deleteFile("NotoSansSC-Regular.ttf");
  } catch {
    // 忽略
  }
}

// ==================== 旧接口辅助函数 ====================

function buildFFmpegArgs(
  _clips: StoryboardClipData[],
  audioTracks: AudioTrack[],
  config: ExportConfig,
): string[] {
  const args: string[] = [];

  args.push("-f", "concat", "-safe", "0", "-i", "concat.txt");

  for (const track of audioTracks) {
    if (track.audioUrl) {
      args.push("-i", `audio_${track.id}.mp3`);
    }
  }

  args.push("-s", getResolution(config.resolution));
  args.push("-c:v", getVideoCodec(config.videoCodec));
  args.push("-b:v", `${config.bitrate.video}k`);
  args.push("-r", String(config.fps));
  args.push("-c:a", getAudioCodec(config.audioCodec));
  args.push("-b:a", `${config.bitrate.audio}k`);

  if (audioTracks.length > 0) {
    args.push("-map", "0:v");
    args.push("-map", "1:a");
  }

  args.push(`output.${config.format}`);

  return args;
}

function getResolution(resolution: ExportConfig["resolution"]): string {
  const resolutions: Record<string, string> = {
    original: "1920x1080",
    "1080p": "1920x1080",
    "720p": "1280x720",
    "480p": "854x480",
  };
  return resolutions[resolution] || "1920x1080";
}

function getVideoCodec(codec: ExportConfig["videoCodec"]): string {
  const codecs: Record<string, string> = {
    h264: "libx264",
    hevc: "libx265",
    vp9: "libvpx-vp9",
  };
  return codecs[codec] || "libx264";
}

function getAudioCodec(codec: ExportConfig["audioCodec"]): string {
  const codecs: Record<string, string> = {
    aac: "aac",
    opus: "libopus",
    mp3: "libmp3lame",
  };
  return codecs[codec] || "aac";
}

/**
 * 从音频 URL 获取文件扩展名
 */
function getAudioFileExtension(url: string): string {
  const match = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  const ext = match?.[1]?.toLowerCase();
  if (ext && ["mp3", "wav", "m4a", "aac", "ogg", "flac", "opus"].includes(ext)) {
    return ext;
  }
  return "mp3";
}

function getMimeType(format: ExportConfig["format"]): string {
  const types: Record<string, string> = {
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
  };
  return types[format] || "video/mp4";
}

// ==================== 导出辅助函数 ====================

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

export function getDefaultExportConfig(): ExportConfig {
  return {
    format: "mp4",
    resolution: "1080p",
    fps: 30,
    videoCodec: "h264",
    audioCodec: "aac",
    bitrate: {
      video: 3000,
      audio: 192,
    },
    range: {
      start: 0,
      end: 0,
    },
    includeSubtitles: true,
  };
}

export const EXPORT_OPTIONS = {
  formats: [
    { label: "MP4", value: "mp4" },
    { label: "WebM", value: "webm" },
    { label: "MOV", value: "mov" },
  ],
  resolutions: [
    { label: "原画", value: "original" },
    { label: "1080p", value: "1080p" },
    { label: "720p", value: "720p" },
    { label: "480p", value: "480p" },
  ],
  frameRates: [
    { label: "24 fps", value: 24 },
    { label: "30 fps", value: 30 },
    { label: "60 fps", value: 60 },
  ],
  videoCodecs: [
    { label: "H.264", value: "h264" },
    { label: "H.265 (HEVC)", value: "hevc" },
    { label: "VP9", value: "vp9" },
  ],
  audioCodecs: [
    { label: "AAC", value: "aac" },
    { label: "Opus", value: "opus" },
    { label: "MP3", value: "mp3" },
  ],
};