/**
 * 时间轴构建器 Composable
 * 从 ScriptContent 提取 VideoEditor 所需的时间轴数据
 * 作为合成与导出的统一数据源
 */

import { computed, type ComputedRef } from "vue";
import type { ShotGroup, BgmTrack } from "@pixaura/shared-types";
import type { VideoSource, TimelineData, Track, Clip } from "../types";

export interface SubtitleItem {
  text: string;
  startTime: number;
  endTime: number;
  characterName?: string;
}

export interface TimelineBuilderResult {
  videoSources: VideoSource[];
  timelineData: TimelineData;
  subtitles: SubtitleItem[];
  totalDuration: number;
  hasAnyVideoSource: boolean;
}

export interface UnifiedTimelineItem {
  id: string;
  name: string;
  start: number;
  end: number;
  duration: number;
  sourceUrl?: string;
  text?: string;
  shotGroupId?: string;
  shotId?: string;
  isBlackScreen?: boolean;
  volume?: number;
  source?: string;
  mode?: string;
  characterName?: string;
  audioActualDuration?: number;
}

export interface UnifiedTimelineData {
  video: UnifiedTimelineItem[];
  subtitle: UnifiedTimelineItem[];
  narration: UnifiedTimelineItem[];
  bgm: UnifiedTimelineItem[];
  totalDuration: number;
}

export interface UseTimelineBuilderOptions {
  shotGroups: ShotGroup[];
  bgmTracks: BgmTrack[];
  videoDurationCache: Map<string, number>;
}

/**
 * 构建时间轴数据
 * 核心逻辑完全移植自 VideoEditor.vue 的 videoSources / timelineData / subtitles computed
 */
export function buildTimelineData(options: UseTimelineBuilderOptions): TimelineBuilderResult {
  const { shotGroups, bgmTracks, videoDurationCache } = options;

  const BLACK_SCREEN_DURATION = 3;

  // ==================== videoSources ====================
  const sources: VideoSource[] = [];
  let videoCumulativeTime = 0;

  for (const shotGroup of shotGroups) {
    const shots = shotGroup.shots || [];
    let hasVideo = false;
    const videoMode = shotGroup.videoMode || "lip_sync";

    if (videoMode === "video_only" || videoMode === "audio_reference") {
      if (shotGroup.video?.url && shotGroup.video?.status === "completed") {
        hasVideo = true;
        const cachedDuration = videoDurationCache.get(shotGroup.video.url);
        const actualDuration = cachedDuration ? cachedDuration / 1000 : BLACK_SCREEN_DURATION;
        sources.push({
          url: shotGroup.video.url,
          name: `分镜${shotGroup.sequenceNumber}`,
          duration: actualDuration,
          shotGroupId: shotGroup.id,
        });
        videoCumulativeTime += actualDuration;
      }
    } else if (videoMode === "lip_sync") {
      if (shots.length > 0) {
        for (const shot of shots) {
          const isCompleted = shot.status === "completed" && shot.videoUrl;

          if (isCompleted && shot.videoUrl) {
            hasVideo = true;
            const cachedDuration = videoDurationCache.get(shot.videoUrl);
            const actualDuration = cachedDuration ? cachedDuration / 1000 : BLACK_SCREEN_DURATION;
            sources.push({
              url: shot.videoUrl,
              name: `分镜${shotGroup.sequenceNumber}-${shot.dialogueId}`,
              duration: actualDuration,
              shotGroupId: shotGroup.id,
              shotId: shot.id,
            });
            videoCumulativeTime += actualDuration;
          } else {
            sources.push({
              url: "",
              name: `分镜${shotGroup.sequenceNumber}-${shot.dialogueId}（黑屏）`,
              duration: BLACK_SCREEN_DURATION,
              shotGroupId: shotGroup.id,
              shotId: shot.id,
              isBlackScreen: true,
            });
            videoCumulativeTime += BLACK_SCREEN_DURATION;
          }
        }
      }
    }

    // 兼容旧数据结构
    if (!hasVideo && shots.length === 0 && shotGroup.mainImageKey) {
      const videoUrl = (shotGroup as unknown as { videoGeneration?: { videoUrl?: string } }).videoGeneration?.videoUrl;
      if (videoUrl) {
        hasVideo = true;
        const cachedDuration = videoDurationCache.get(videoUrl);
        const actualDuration = cachedDuration ? cachedDuration / 1000 : BLACK_SCREEN_DURATION;
        sources.push({
          url: videoUrl,
          name: `分镜${shotGroup.sequenceNumber}`,
          duration: actualDuration,
          shotGroupId: shotGroup.id,
        });
        videoCumulativeTime += actualDuration;
      }
    }

    // 兜底黑屏占位
    if (!hasVideo && (videoMode !== "lip_sync" || shots.length === 0)) {
      sources.push({
        url: "",
        name: `分镜${shotGroup.sequenceNumber}（黑屏占位）`,
        duration: BLACK_SCREEN_DURATION,
        shotGroupId: shotGroup.id,
        isBlackScreen: true,
      });
      videoCumulativeTime += BLACK_SCREEN_DURATION;
    }
  }

  // ==================== timelineData ====================
  const videoClips: Clip[] = [];
  const textClips: Clip[] = [];
  const narrationClips: Clip[] = [];
  let timelineCumulativeTime = 0;

  for (const shotGroup of shotGroups) {
    const shots = shotGroup.shots || [];
    const dialogues = shotGroup.dialogues || [];
    const videoMode = shotGroup.videoMode || "lip_sync";

    if (videoMode === "video_only" || videoMode === "audio_reference") {
      const video = shotGroup.video;
      const hasCompletedVideo = video?.url && video?.status === "completed";
      const videoUrl = video?.url;

      let clipDuration = BLACK_SCREEN_DURATION;
      if (hasCompletedVideo && videoUrl) {
        const cachedDuration = videoDurationCache.get(videoUrl);
        clipDuration = cachedDuration ? cachedDuration / 1000 : BLACK_SCREEN_DURATION;
      }

      videoClips.push({
        name: `分镜${shotGroup.sequenceNumber}${hasCompletedVideo ? "" : "（黑屏）"}.mp4`,
        start: timelineCumulativeTime,
        duration: clipDuration,
        shotGroupId: shotGroup.id,
        isBlackScreen: !hasCompletedVideo,
      });

      dialogues.forEach((dialogue) => {
        textClips.push({
          name: `字幕: ${dialogue.characterName || "旁白"}`,
          start: timelineCumulativeTime,
          duration: clipDuration,
          shotGroupId: shotGroup.id,
        });

        if (videoMode === "video_only" && dialogue.isVoiceover === true && dialogue.audioUrl) {
          narrationClips.push({
            id: dialogue.id,
            name: `旁白: ${dialogue.characterName || "旁白"}`,
            start: timelineCumulativeTime,
            duration: clipDuration,
            shotGroupId: shotGroup.id,
            audioUrl: dialogue.audioUrl,
            audioActualDuration: dialogue.audioDuration,
          });
        }
      });

      timelineCumulativeTime += clipDuration;
    } else if (videoMode === "lip_sync") {
      if (shots.length > 0) {
        for (const shot of shots) {
          const isCompleted = shot.status === "completed" && shot.videoUrl;

          let clipDuration = BLACK_SCREEN_DURATION;
          if (isCompleted && shot.videoUrl) {
            const cachedDuration = videoDurationCache.get(shot.videoUrl);
            clipDuration = cachedDuration ? cachedDuration / 1000 : BLACK_SCREEN_DURATION;
          }

          videoClips.push({
            name: `分镜${shotGroup.sequenceNumber}-${shot.dialogueId}${isCompleted ? "" : "（黑屏）"}.mp4`,
            start: timelineCumulativeTime,
            duration: clipDuration,
            shotGroupId: shotGroup.id,
            shotId: shot.id,
            isBlackScreen: !isCompleted,
          });

          const dialogue = dialogues.find((d) => d.id === shot.dialogueId);
          if (dialogue) {
            textClips.push({
              name: `字幕: ${dialogue.characterName || "旁白"}`,
              start: timelineCumulativeTime,
              duration: clipDuration,
              shotGroupId: shotGroup.id,
              shotId: shot.id,
            });
          }

          timelineCumulativeTime += clipDuration;
        }
      } else if (dialogues.length > 0) {
        for (const dialogue of dialogues) {
          const clipDuration = BLACK_SCREEN_DURATION;

          videoClips.push({
            name: `分镜${shotGroup.sequenceNumber}-${dialogue.id}（黑屏）.mp4`,
            start: timelineCumulativeTime,
            duration: clipDuration,
            shotGroupId: shotGroup.id,
            isBlackScreen: true,
          });

          textClips.push({
            name: `字幕: ${dialogue.characterName || "旁白"}`,
            start: timelineCumulativeTime,
            duration: clipDuration,
            shotGroupId: shotGroup.id,
          });

          timelineCumulativeTime += clipDuration;
        }
      } else {
        const videoGen = (shotGroup as unknown as { videoGeneration?: { videoUrl?: string; status?: string } }).videoGeneration;
        const hasCompletedVideo = videoGen?.videoUrl && videoGen?.status === "completed";

        let clipDuration = BLACK_SCREEN_DURATION;
        if (hasCompletedVideo && videoGen.videoUrl) {
          const cachedDuration = videoDurationCache.get(videoGen.videoUrl);
          clipDuration = cachedDuration ? cachedDuration / 1000 : BLACK_SCREEN_DURATION;
        }

        videoClips.push({
          name: `分镜${shotGroup.sequenceNumber}${hasCompletedVideo ? "" : "（黑屏）"}.mp4`,
          start: timelineCumulativeTime,
          duration: clipDuration,
          shotGroupId: shotGroup.id,
          isBlackScreen: !hasCompletedVideo,
        });

        timelineCumulativeTime += clipDuration;
      }
    }
  }

  const totalDuration = timelineCumulativeTime;

  // BGM clips 从 bgmTracks 生成
  const bgmClips: Clip[] = bgmTracks.map((track) => ({
    name: track.style || "BGM",
    start: track.timelineStart ?? 0,
    duration: track.duration,
    audioUrl: track.url,
    shotGroupId: track.targetShotGroupId,
  }));

  const tracks: Track[] = [
    {
      name: "V1 视频 1",
      icon: "fa-film",
      iconClass: "video",
      type: "video",
      clips: videoClips,
    },
    {
      name: "T1 字幕",
      icon: "fa-font",
      iconClass: "text",
      type: "text",
      clips: textClips,
    },
    {
      name: "A1 旁白",
      icon: "fa-microphone",
      iconClass: "audio",
      type: "audio",
      clips: narrationClips,
    },
    {
      name: "A2 BGM",
      icon: "fa-volume-high",
      iconClass: "audio",
      type: "audio",
      clips: bgmClips,
    },
    {
      name: "A3 音效",
      icon: "fa-music",
      iconClass: "audio",
      type: "audio",
      clips: [],
    },
  ];

  const timelineData: TimelineData = {
    totalDuration,
    tracks,
  };

  // ==================== subtitles ====================
  const subtitleItems: SubtitleItem[] = [];
  let subCumulativeTime = 0;

  for (const shotGroup of shotGroups) {
    const shots = shotGroup.shots || [];
    const dialogues = shotGroup.dialogues || [];
    const videoMode = shotGroup.videoMode || "lip_sync";
    let hasVideo = false;
    let segmentStartTime = subCumulativeTime;
    let segmentDuration = BLACK_SCREEN_DURATION;

    if (videoMode === "video_only" || videoMode === "audio_reference") {
      if (shotGroup.video?.url && shotGroup.video?.status === "completed") {
        hasVideo = true;
        const cachedDuration = videoDurationCache.get(shotGroup.video.url);
        segmentDuration = cachedDuration ? cachedDuration / 1000 : BLACK_SCREEN_DURATION;
      }
    } else if (videoMode === "lip_sync") {
      for (const shot of shots) {
        let shotDuration = BLACK_SCREEN_DURATION;
        if (shot.status === "completed" && shot.videoUrl) {
          hasVideo = true;
          const cachedDuration = videoDurationCache.get(shot.videoUrl);
          shotDuration = cachedDuration ? cachedDuration / 1000 : BLACK_SCREEN_DURATION;
        } else {
          shotDuration = BLACK_SCREEN_DURATION;
        }

        const dialogue = dialogues.find((d) => d.id === shot.dialogueId);
        if (dialogue?.text) {
          subtitleItems.push({
            text: dialogue.text,
            startTime: subCumulativeTime,
            endTime: subCumulativeTime + shotDuration,
            characterName: dialogue.characterName,
          });
        }

        subCumulativeTime += shotDuration;
      }

      if (shots.length > 0) {
        continue;
      }
    }

    // 兼容旧数据
    if (!hasVideo && shots.length === 0 && shotGroup.mainImageKey) {
      const videoUrl = (shotGroup as unknown as { videoGeneration?: { videoUrl?: string } }).videoGeneration?.videoUrl;
      if (videoUrl) {
        hasVideo = true;
        const cachedDuration = videoDurationCache.get(videoUrl);
        segmentDuration = cachedDuration ? cachedDuration / 1000 : BLACK_SCREEN_DURATION;
      }
    }

    if (videoMode !== "lip_sync" || shots.length === 0) {
      if (!hasVideo) {
        segmentDuration = BLACK_SCREEN_DURATION;
      }

      dialogues.forEach((dialogue) => {
        if (dialogue.text) {
          subtitleItems.push({
            text: dialogue.text,
            startTime: segmentStartTime,
            endTime: segmentStartTime + segmentDuration,
            characterName: dialogue.characterName,
          });
        }
      });

      subCumulativeTime = segmentStartTime + segmentDuration;
    }
  }

  const hasAnyVideoSource = sources.some((v) => !v.isBlackScreen && v.url);

  return {
    videoSources: sources,
    timelineData,
    subtitles: subtitleItems,
    totalDuration,
    hasAnyVideoSource,
  };
}

/**
 * 响应式包装：传入 ref 或普通对象，返回 ComputedRef<TimelineBuilderResult>
 */
export function useTimelineBuilder(
  options: UseTimelineBuilderOptions,
): ComputedRef<TimelineBuilderResult> {
  return computed(() => buildTimelineData(options));
}

/**
 * 构建统一时间轴数据
 * 按轨道组织（video / subtitle / narration / bgm），供合成与导出共用
 * 修复 lip_sync 无 shots 有 dialogues 时 video 与 subtitle 片段数量不一致的问题
 */
export function buildUnifiedTimelineData(
  options: UseTimelineBuilderOptions,
): UnifiedTimelineData {
  const { shotGroups, bgmTracks, videoDurationCache } = options;
  const BLACK_SCREEN_DURATION = 3;

  const video: UnifiedTimelineItem[] = [];
  const subtitle: UnifiedTimelineItem[] = [];
  const narration: UnifiedTimelineItem[] = [];
  let cumulativeTime = 0;

  for (const shotGroup of shotGroups) {
    const shots = shotGroup.shots || [];
    const dialogues = shotGroup.dialogues || [];
    const videoMode = shotGroup.videoMode || "lip_sync";

    if (videoMode === "video_only" || videoMode === "audio_reference") {
      const videoDef = shotGroup.video;
      const hasCompletedVideo = videoDef?.url && videoDef?.status === "completed";
      const videoUrl = videoDef?.url;

      let videoDuration = BLACK_SCREEN_DURATION;
      if (hasCompletedVideo && videoUrl) {
        const cachedDuration = videoDurationCache.get(videoUrl);
        videoDuration = cachedDuration ? cachedDuration / 1000 : BLACK_SCREEN_DURATION;
      }

      const start = cumulativeTime;
      const end = start + videoDuration;

      video.push({
        id: `video-${shotGroup.id}`,
        name: `分镜${shotGroup.sequenceNumber}${hasCompletedVideo ? "" : "（黑屏）"}`,
        start,
        end,
        duration: videoDuration,
        sourceUrl: hasCompletedVideo ? (videoUrl ?? "") : "",
        shotGroupId: shotGroup.id,
        isBlackScreen: !hasCompletedVideo,
      });

      const hasAnyAudioDuration = dialogues.some((d) => d.audioDuration && d.audioDuration > 0);
      const totalAudioDuration = dialogues.reduce((sum, d) => sum + (d.audioDuration || 0), 0);

      let subStart = start;
      dialogues.forEach((dialogue) => {
        const subDuration = hasAnyAudioDuration && totalAudioDuration > 0
          ? videoDuration * ((dialogue.audioDuration || 0) / totalAudioDuration)
          : videoDuration;

        if (dialogue.text) {
          subtitle.push({
            id: `subtitle-${dialogue.id}`,
            name: `字幕: ${dialogue.characterName || "旁白"}`,
            start: hasAnyAudioDuration ? subStart : start,
            end: hasAnyAudioDuration ? subStart + subDuration : end,
            duration: subDuration,
            text: dialogue.text,
            shotGroupId: shotGroup.id,
            characterName: dialogue.characterName,
          });
        }

        if (videoMode === "video_only" && dialogue.isVoiceover === true && dialogue.audioUrl) {
          narration.push({
            id: `narration-${dialogue.id}`,
            name: `旁白: ${dialogue.characterName || "旁白"}`,
            start: hasAnyAudioDuration ? subStart : start,
            end: hasAnyAudioDuration ? subStart + subDuration : end,
            duration: subDuration,
            sourceUrl: dialogue.audioUrl,
            shotGroupId: shotGroup.id,
            volume: 1,
            audioActualDuration: dialogue.audioDuration,
          });
        }

        subStart += subDuration;
      });

      cumulativeTime = end;
    } else if (videoMode === "lip_sync") {
      if (shots.length > 0) {
        for (const shot of shots) {
          const isCompleted = shot.status === "completed" && shot.videoUrl;
          const dialogue = dialogues.find((d) => d.id === shot.dialogueId);

          let clipDuration = BLACK_SCREEN_DURATION;
          if (dialogue?.audioDuration && dialogue.audioDuration > 0) {
            clipDuration = dialogue.audioDuration;
          } else if (isCompleted && shot.videoUrl) {
            const cachedDuration = videoDurationCache.get(shot.videoUrl);
            clipDuration = cachedDuration ? cachedDuration / 1000 : BLACK_SCREEN_DURATION;
          }

          const start = cumulativeTime;
          const end = start + clipDuration;

          video.push({
            id: `video-${shot.id}`,
            name: `分镜${shotGroup.sequenceNumber}-${shot.dialogueId}${isCompleted ? "" : "（黑屏）"}`,
            start,
            end,
            duration: clipDuration,
            sourceUrl: isCompleted ? (shot.videoUrl ?? "") : "",
            shotGroupId: shotGroup.id,
            shotId: shot.id,
            isBlackScreen: !isCompleted,
          });

          if (dialogue?.text) {
            subtitle.push({
              id: `subtitle-${dialogue.id}`,
              name: `字幕: ${dialogue.characterName || "旁白"}`,
              start,
              end,
              duration: clipDuration,
              text: dialogue.text,
              shotGroupId: shotGroup.id,
              shotId: shot.id,
              characterName: dialogue.characterName,
            });
          }

          cumulativeTime = end;
        }
      } else if (dialogues.length > 0) {
        // 修复：无 shots 但有 dialogues 时，video 与 subtitle 统一按 dialogue 数量生成
        for (const dialogue of dialogues) {
          const clipDuration = dialogue.audioDuration && dialogue.audioDuration > 0
            ? dialogue.audioDuration
            : BLACK_SCREEN_DURATION;
          const start = cumulativeTime;
          const end = start + clipDuration;

          video.push({
            id: `video-${dialogue.id}`,
            name: `分镜${shotGroup.sequenceNumber}-${dialogue.id}（黑屏）`,
            start,
            end,
            duration: clipDuration,
            sourceUrl: "",
            shotGroupId: shotGroup.id,
            isBlackScreen: true,
          });

          if (dialogue.text) {
            subtitle.push({
              id: `subtitle-${dialogue.id}`,
              name: `字幕: ${dialogue.characterName || "旁白"}`,
              start,
              end,
              duration: clipDuration,
              text: dialogue.text,
              shotGroupId: shotGroup.id,
              characterName: dialogue.characterName,
            });
          }

          cumulativeTime = end;
        }
      } else {
        // 无 shots 也无 dialogues：生成 1 个黑屏片段兜底
        const clipDuration = BLACK_SCREEN_DURATION;
        const start = cumulativeTime;
        const end = start + clipDuration;

        video.push({
          id: `video-${shotGroup.id}`,
          name: `分镜${shotGroup.sequenceNumber}（黑屏）`,
          start,
          end,
          duration: clipDuration,
          sourceUrl: "",
          shotGroupId: shotGroup.id,
          isBlackScreen: true,
        });

        cumulativeTime = end;
      }
    }
  }

  const bgm: UnifiedTimelineItem[] = (bgmTracks || []).map((track, index) => ({
    id: track.id || `bgm-${index}`,
    name: track.style || "BGM",
    start: track.timelineStart ?? 0,
    end: (track.timelineStart ?? 0) + track.duration,
    duration: track.duration,
    sourceUrl: track.url,
    volume: track.volume ?? 0.3,
    source: track.source,
    mode: track.mode,
  }));

  return {
    video,
    subtitle,
    narration,
    bgm,
    totalDuration: cumulativeTime,
  };
}
