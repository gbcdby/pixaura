/**
 * FFmpeg 导出数据提取器
 * 从 ScriptContent 提取 ExportInputData 格式数据
 * 以合成侧时间轴 builder 为唯一真相源，确保合成与导出数据一致
 */
import type {
  ScriptContent,
} from "@pixaura/shared-types";
import type {
  ExportInputData,
  ExportVideoTrack,
  ExportVideoClip,
  ExportAudioTrack,
  ExportAudioClip,
  ExportSubtitleTrack,
  ExportSubtitleItem,
  ExportResolution,
  ExportAspectRatio,
} from "@pixaura/shared-types";
import type { UnifiedTimelineData } from "@/modules/video-edit/composables/useTimelineBuilder";

/**
 * 获取视频实际时长
 * 通过创建 video 元素加载元数据获取，带 10 秒超时
 */
export async function getVideoDuration(url: string): Promise<number> {
  const video = document.createElement("video");
  video.src = url;
  video.preload = "metadata";

  return Promise.race([
    new Promise<number>((resolve, reject) => {
      video.onloadedmetadata = () => resolve(video.duration);
      video.onerror = () => reject(new Error(`加载视频失败: ${url}`));
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`获取视频时长超时: ${url}`)), 10000),
    ),
  ]).finally(() => {
    video.src = "";
    video.load();
  });
}

/**
 * 获取音频实际时长
 * 通过创建 audio 元素加载元数据获取，带 10 秒超时
 */
export async function getAudioDuration(url: string): Promise<number> {
  const audio = new Audio();
  audio.src = url;
  audio.preload = "metadata";

  return Promise.race([
    new Promise<number>((resolve, reject) => {
      audio.onloadedmetadata = () => resolve(audio.duration);
      audio.onerror = () => reject(new Error(`加载音频失败: ${url}`));
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`获取音频时长超时: ${url}`)), 10000),
    ),
  ]).finally(() => {
    audio.src = "";
    audio.load();
  });
}

/**
 * 解析分辨率字符串
 * 将分辨率比例（如 9:16）转换为导出格式
 */
function parseResolution(
  resolutionStr: string,
): {
  resolution: ExportResolution;
  aspectRatio: ExportAspectRatio;
} {
  const aspectRatioMap: Record<string, ExportAspectRatio> = {
    "9:16": "9:16",
    "16:9": "16:9",
    "1:1": "1:1",
  };

  const aspectRatio = aspectRatioMap[resolutionStr] || "9:16";
  const resolution: ExportResolution = "1080p";

  return { resolution, aspectRatio };
}

/**
 * 主提取函数：从统一时间轴数据提取 ExportInputData
 * 合成与导出共用统一结构，确保两边完全一致
 */
export function extractExportData(
  content: ScriptContent,
  projectId: string,
  scriptId: string,
  unifiedTimelineData: UnifiedTimelineData,
): ExportInputData {
  const { video, subtitle, narration, bgm, totalDuration } = unifiedTimelineData;

  console.log(`[extractExportData] 统一时间轴: video=${video.length}, subtitle=${subtitle.length}, narration=${narration.length}, bgm=${bgm.length}, totalDuration=${totalDuration.toFixed(3)}s`);
  video.forEach((v, i) => {
    console.log(`[extractExportData] video[${i}]: name=${v.name}, sourceUrl=${v.sourceUrl ? "有" : "无"}, start=${v.start.toFixed(3)}, end=${v.end.toFixed(3)}, duration=${v.duration.toFixed(3)}, isBlackScreen=${v.isBlackScreen}`);
  });

  // 视频轨道
  const videoClips: ExportVideoClip[] = video.map((item) => ({
    id: item.shotId ?? item.shotGroupId ?? item.id,
    sourceUrl: item.sourceUrl ?? "",
    timelineStart: item.start,
    timelineEnd: item.end,
    trimIn: 0,
    trimOut: item.duration,
  }));
  const videoTracks: ExportVideoTrack[] =
    videoClips.length > 0 ? [{ id: "main-video", index: 0, clips: videoClips }] : [];

  // 音频轨道
  const audioTracks: ExportAudioTrack[] = [];

  // 旁白轨道
  const narrationClips: ExportAudioClip[] = narration
    .filter((item) => item.sourceUrl)
    .map((item) => ({
      id: item.id,
      sourceUrl: item.sourceUrl ?? "",
      timelineStart: item.start,
      timelineEnd: item.end,
      volume: item.volume ?? 1,
    }));
  if (narrationClips.length > 0) {
    audioTracks.push({
      id: "voiceover",
      type: "voiceover",
      index: 0,
      muted: false,
      clips: narrationClips,
    });
  }

  // BGM 轨道（按 source / mode 分类）
  const bgmOverallClips: ExportAudioClip[] = [];
  const bgmIndividualClips: ExportAudioClip[] = [];
  const bgmUserClips: ExportAudioClip[] = [];

  for (const item of bgm) {
    if (!item.sourceUrl) continue;
    const exportClip: ExportAudioClip = {
      id: item.id,
      sourceUrl: item.sourceUrl,
      timelineStart: item.start,
      timelineEnd: item.end,
      volume: item.volume ?? 0.3,
    };
    if (item.source === "user") {
      bgmUserClips.push(exportClip);
    } else if (item.mode === "overall") {
      bgmOverallClips.push(exportClip);
    } else {
      bgmIndividualClips.push(exportClip);
    }
  }

  if (bgmOverallClips.length > 0) {
    audioTracks.push({ id: "bgm-overall", type: "bgm_overall", index: 1, muted: false, clips: bgmOverallClips });
  }
  if (bgmIndividualClips.length > 0) {
    audioTracks.push({ id: "bgm-individual", type: "bgm_individual", index: 2, muted: false, clips: bgmIndividualClips });
  }
  if (bgmUserClips.length > 0) {
    audioTracks.push({ id: "bgm-user", type: "bgm_user", index: 3, muted: false, clips: bgmUserClips });
  }

  // 字幕轨道
  const subtitleItems: ExportSubtitleItem[] = subtitle.map((item) => ({
    id: item.id,
    startTime: item.start,
    endTime: item.end,
    text: item.text ?? "",
  }));
  const subtitleTracks: ExportSubtitleTrack[] =
    subtitleItems.length > 0
      ? [{
          id: "main-subtitle",
          index: 0,
          visible: true,
          isDefault: true,
          defaultStyle: { fontFamily: "Noto Sans SC", fontSize: 48, color: "#FFFFFF", position: "bottom" },
          items: subtitleItems,
        }]
      : [];

  const { resolution, aspectRatio } = parseResolution(content.resolution ?? "9:16");

  return {
    scriptId,
    projectId,
    timeline: { duration: totalDuration, resolution, aspectRatio, frameRate: 30 },
    videoTracks,
    audioTracks,
    subtitleTracks,
    audioVolumeConfig: content.audioVolumeConfig,
  };
}
