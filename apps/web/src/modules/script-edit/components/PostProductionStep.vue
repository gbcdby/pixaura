<script setup lang="ts">
/**
 * 后期合成步骤容器组件
 * 集成视频编辑器
 */
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useMessage } from "naive-ui";
import VideoEditor from "../../video-edit/components/VideoEditor.vue";
import { useScriptEditStore, RESOLUTION_OPTIONS } from "../store/scriptEdit";
import { useAudioGenerationStore } from "@/stores/audioGeneration";
import type { StoryboardRef } from "../store/types";
import type { Clip, VideoSource, TimelineData, SubtitleItem } from "../../video-edit/types";
import type { UnifiedTimelineData } from "../../video-edit/composables/useTimelineBuilder";

// Props
interface Props {
  projectId: string;
  scriptId: string;
  storyboards: StoryboardRef[];
  unifiedTimelineData: UnifiedTimelineData;
}

const props = defineProps<Props>();

// Store
const scriptEditStore = useScriptEditStore();
const audioGenerationStore = useAudioGenerationStore();
const message = useMessage();

// ==================== 编辑器占位逻辑 ====================

const editorWrapperRef = ref<HTMLElement | null>(null);
const isFullscreen = ref(false);
const placeholderHeight = ref(0);
let resizeObserver: ResizeObserver | null = null;

// 记录正常状态下编辑器的高度
function recordPlaceholderHeight(): void {
  if (editorWrapperRef.value) {
    placeholderHeight.value = editorWrapperRef.value.offsetHeight;
  }
}

// 处理全屏状态变化
function handleFullscreenChange(payload: { video: boolean; workspace: boolean }): void {
  const entering = payload.video || payload.workspace;
  if (entering && !isFullscreen.value) {
    // 进入全屏前记录高度
    recordPlaceholderHeight();
  }
  isFullscreen.value = entering;
}

onMounted(() => {
  if (editorWrapperRef.value) {
    resizeObserver = new ResizeObserver(() => {
      if (!isFullscreen.value) {
        recordPlaceholderHeight();
      }
    });
    resizeObserver.observe(editorWrapperRef.value);
  }
});

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
});

// 从统一时间轴数据转换为 VideoEditor 所需的格式
const videoSources = computed<VideoSource[]>(() => {
  return props.unifiedTimelineData.video.map((item) => ({
    url: item.sourceUrl ?? "",
    name: item.name,
    duration: item.duration,
    shotGroupId: item.shotGroupId ?? "",
    shotId: item.shotId,
    isBlackScreen: item.isBlackScreen,
  }));
});

const subtitles = computed<SubtitleItem[]>(() => {
  return props.unifiedTimelineData.subtitle.map((item) => ({
    text: item.text ?? "",
    startTime: item.start,
    endTime: item.end,
    characterName: item.characterName,
  }));
});

const timelineData = computed<TimelineData>(() => {
  const videoClips: Clip[] = props.unifiedTimelineData.video.map((item) => ({
    id: item.id,
    name: item.name,
    start: item.start,
    duration: item.duration,
    shotGroupId: item.shotGroupId,
    shotId: item.shotId,
    isBlackScreen: item.isBlackScreen,
  }));

  const textClips: Clip[] = props.unifiedTimelineData.subtitle.map((item) => ({
    id: item.id,
    name: item.name,
    start: item.start,
    duration: item.duration,
    shotGroupId: item.shotGroupId,
    shotId: item.shotId,
  }));

  const narrationClips: Clip[] = props.unifiedTimelineData.narration.map((item) => ({
    id: item.id,
    name: item.name,
    start: item.start,
    duration: item.duration,
    shotGroupId: item.shotGroupId,
    audioUrl: item.sourceUrl,
    audioActualDuration: item.audioActualDuration,
  }));

  const bgmClips: Clip[] = props.unifiedTimelineData.bgm.map((item) => ({
    id: item.id,
    name: item.name,
    start: item.start,
    duration: item.duration,
    audioUrl: item.sourceUrl,
    shotGroupId: item.shotGroupId,
  }));

  return {
    totalDuration: props.unifiedTimelineData.totalDuration,
    tracks: [
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
    ],
  };
});

// VideoEditor 仍要求传入 videoDurationCache，但内部已不再使用，传空 Map 即可
const videoDurationCache = new Map<string, number>();

// 根据剧本分辨率计算宽高比
const storyboardAspectRatio = computed(() => {
  const resolution = scriptEditStore.creationSettings.resolution;
  const opt = RESOLUTION_OPTIONS.find((r) => r.value === resolution);
  if (opt) {
    return `${opt.width}/${opt.height}`;
  }
  return "9/16"; // 默认竖屏
});

/**
 * 轮询 BGM 任务结果
 * 轮询 BGM 任务结果
 */
async function pollBgmTask(taskId: string): Promise<string | null> {
  const maxAttempts = 30;
  const interval = 2000;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, interval));
    const task = await audioGenerationStore.fetchTaskDetail(taskId);
    if (task.status === "completed" && task.outputs && task.outputs.length > 0) {
      return task.outputs[0].file?.url || null;
    }
    if (task.status === "failed" || task.status === "cancelled") {
      return null;
    }
  }
  return null;
}

/**
 * 处理 AI 全局配乐生成
 */
async function handleGenerateAIMusic(style: string, duration: number, _start: number): Promise<void> {
  const modelId = scriptEditStore.script?.content?.bgmSettings?.modelId as string | undefined;
  try {
    const result = await audioGenerationStore.createBGM(props.projectId, {
      config: {
        emotionCurve: [{ time: 0, emotion: style, intensity: 0.5 }],
        duration,
        style,
        modelId,
        needBeatPoints: false,
      },
      notifyWs: true,
    });
    const url = await pollBgmTask(result.taskId);
    if (!url) {
      throw new Error("BGM 生成失败");
    }
    await scriptEditStore.addBgmTrack({
      id: `ai-${style}-${Date.now()}`,
      url,
      duration,
      style,
      mode: "overall",
      source: "ai",
      timelineStart: 0,
      volume: 0.3,
      muted: false,
      modelId,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("BGM 生成失败:", error);
    message.error("BGM 生成失败，请重试");
  }
}

/**
 * 处理片段配乐生成
 */
async function handleGenerateClipMusic(style: string, duration: number, clip: Clip): Promise<void> {
  const modelId = scriptEditStore.script?.content?.bgmSettings?.modelId as string | undefined;
  try {
    const result = await audioGenerationStore.createBGM(props.projectId, {
      config: {
        emotionCurve: [{ time: 0, emotion: style, intensity: 0.5 }],
        duration,
        style,
        modelId,
        needBeatPoints: false,
      },
      notifyWs: true,
    });
    const url = await pollBgmTask(result.taskId);
    if (!url) {
      throw new Error("BGM 生成失败");
    }
    await scriptEditStore.addBgmTrack({
      id: `ai-clip-${style}-${Date.now()}`,
      url,
      duration,
      style,
      mode: "individual",
      source: "ai",
      targetShotGroupId: clip.shotGroupId,
      timelineStart: clip.start ?? 0,
      volume: 0.3,
      muted: false,
      modelId,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("BGM 生成失败:", error);
    message.error("BGM 生成失败，请重试");
  }
}
</script>

<template>
  <div class="post-production-step">
    <div ref="editorWrapperRef" class="editor-wrapper">
      <!-- 全屏时占位，防止 fixed 定位导致布局塌陷 -->
      <div
        v-show="isFullscreen"
        class="editor-placeholder"
        :style="{ height: placeholderHeight + 'px' }"
      ></div>
      <!-- 视频编辑器 -->
      <VideoEditor
        :project-id="projectId"
        :script-id="scriptId"
        :video-sources="videoSources"
        :timeline-data="timelineData"
        :subtitles="subtitles"
        :video-duration-cache="videoDurationCache"
        :aspect-ratio="storyboardAspectRatio"
        @generate-ai-music="handleGenerateAIMusic"
        @generate-clip-music="handleGenerateClipMusic"
        @fullscreen-change="handleFullscreenChange"
      />
    </div>
  </div>
</template>

<style scoped>
.post-production-step {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-deep, #08080a);
  border-radius: 12px;
  overflow: hidden;
}

.editor-wrapper {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.editor-placeholder {
  flex-shrink: 0;
  background: var(--bg-deep, #08080a);
  border-radius: 12px;
  transition: height 0.1s ease;
}
</style>
