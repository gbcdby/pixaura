<script setup lang="ts">
import { computed, h, onMounted, onUnmounted, watch, ref, watchEffect, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  NSpin,
  NButton,
  NIcon,
  NAlert,
  NSelect,
  NPopover,
  NLayout,
  NLayoutContent,
  NSpace,
  useMessage,
  useDialog,
} from "naive-ui";
import {
  ArrowBack,
  Sparkles,
  Warning,
  ChevronForward,
  DesktopOutline,
  FilmOutline,
  MusicalNotes,
} from "@vicons/ionicons5";
import {
  useScriptEditStore,
  RESOLUTION_OPTIONS,
  FILM_GENRE_OPTIONS,
  type StepStatusType,
} from "@/modules/script-edit/store/scriptEdit";
import { useWebSocketStore } from "@/stores/websocket";
import { useScriptModelsStore, type ModelOptionWithPrice } from "@/stores/script-models";
import { useTtsStore } from "@/stores/tts";
import { ffmpegCacheService } from "@/services/ffmpeg-cache.service";
import { buildUnifiedTimelineData, type UnifiedTimelineData } from "@/modules/video-edit/composables/useTimelineBuilder";
import { useVideoDuration } from "@/modules/video-edit/composables/useVideoDuration";
import WorkflowStep from "@/modules/script-edit/components/WorkflowStep.vue";
import ScriptGenerationStep from "@/modules/script-edit/components/ScriptGenerationStep.vue";
import CharacterStep from "@/modules/script-edit/components/CharacterStep.vue";
import SceneStep from "@/modules/script-edit/components/SceneStep.vue";
import PropStep from "@/modules/script-edit/components/PropStep.vue";
import StoryboardStep from "@/modules/script-edit/components/StoryboardStep.vue";
import VoiceSelector from "@/modules/script-edit/components/storyboard/VoiceSelector.vue";
import PostProductionStep from "@/modules/script-edit/components/PostProductionStep.vue";
import ExportStep from "@/modules/script-edit/components/ExportStep.vue";

// Router & Route
const route = useRoute();
const router = useRouter();

// Message & Dialog
const message = useMessage();
const dialog = useDialog();

// Stores
const scriptEditStore = useScriptEditStore();
const wsStore = useWebSocketStore();
const scriptModelsStore = useScriptModelsStore();
const ttsStore = useTtsStore();

// ========== 统一时间轴数据 ==========
const videoDurationCache = ref<Map<string, number>>(new Map());
const { fetchDuration } = useVideoDuration();

const unifiedTimelineData = computed<UnifiedTimelineData>(() => {
  const content = scriptEditStore.buildContentForSave();
  return buildUnifiedTimelineData({
    shotGroups: content.shotGroups ?? [],
    bgmTracks: content.bgmTracks ?? [],
    videoDurationCache: videoDurationCache.value,
  });
});

async function preloadVideoDurations() {
  const content = scriptEditStore.buildContentForSave();
  const urls: string[] = [];
  for (const group of content.shotGroups ?? []) {
    const videoMode = group.videoMode || "lip_sync";
    if (videoMode === "video_only" || videoMode === "audio_reference") {
      if (group.video?.url) urls.push(group.video.url);
    } else if (videoMode === "lip_sync") {
      for (const shot of group.shots ?? []) {
        if (shot.videoUrl) urls.push(shot.videoUrl);
      }
    }
  }
  for (const url of [...new Set(urls)]) {
    if (!url || videoDurationCache.value.has(url)) continue;
    try {
      const durationMs = await fetchDuration(url);
      if (durationMs > 0) {
        videoDurationCache.value.set(url, durationMs);
      }
    } catch {
      // 失败则跳过，builder 会使用默认时长兜底
    }
  }
}

watch(
  () => scriptEditStore.steps.storyboards.items,
  () => {
    preloadVideoDurations();
  },
  { deep: true },
);

watchEffect(() => {
  const data = unifiedTimelineData.value;
  console.log(`[UnifiedTimeline] totalDuration: ${data.totalDuration}s`);
  console.log(`[UnifiedTimeline] video tracks (${data.video.length}):`);
  console.log(`[UnifiedTimeline]`, data);
});

// ========== 统一模型数据管理（使用 Pinia Store）==========

// 选中的BGM模型ID - 使用项目配置的默认值
const selectedBgmModelId = ref("");

// 模型初始化是否完成（防止初始化时触发保存）
const bgmModelInitDone = ref(false);

// 是否有可用BGM模型
const hasAvailableBgmModels = computed(
  () => scriptModelsStore.bgmModelOptions.length > 0,
);

// 渲染模型选项标签（带价格信息）
function renderModelLabel(option: ModelOptionWithPrice) {
  const model = option?.model;
  if (!model) {
    return h("span", {}, String(option?.label ?? option?.value ?? ""));
  }
  const labelText = typeof option.label === "function"
    ? String(option.value)
    : (option.label ? String(option.label) : String(option.value));
  const children: (string | ReturnType<typeof h> | null)[] = [labelText];

  if (model.pricePerCall) {
    children.push(
      h("span", { style: "color: #999; font-size: 12px;" }, `¥${model.pricePerCall}/次`),
    );
  }
  if (model.pricePerSecond) {
    children.push(
      h("span", { style: "color: #999; font-size: 12px;" }, `¥${model.pricePerSecond}/秒`),
    );
  }
  if (!model.pricePerCall && !model.pricePerSecond) {
    children.push(
      h("span", { style: "color: #999; font-size: 12px;" }, "免费"),
    );
  }

  return h(NSpace, { align: "center", size: 8 }, { default: () => children });
}

// 是否正在加载模型
const isLoadingModels = computed(() => scriptModelsStore.isLoading);

// 监听项目和剧本 ID 变化，重置BGM模型状态
// 模型配置从 content 读取，不再调用 /models API
watch(
  [() => scriptEditStore.projectId, () => scriptEditStore.scriptId],
  ([projectId, scriptId]) => {
    if (projectId && scriptId) {
      bgmModelInitDone.value = false;
      selectedBgmModelId.value = "";
    }
  },
  { immediate: true },
);

// 监听模型加载完成，初始化选中值
watch(
  () => ({
    len: scriptModelsStore.bgmModelOptions.length,
    hasLoaded: scriptModelsStore.hasLoaded,
    configured: scriptModelsStore.getDefaultModelId("bgm"),
  }),
  async ({ len, hasLoaded, configured }) => {
    if (len > 0 && hasLoaded && !selectedBgmModelId.value) {
      // 优先使用已配置的模型，否则使用第一个可用模型
      if (configured) {
        selectedBgmModelId.value = configured;
      } else {
        selectedBgmModelId.value = scriptModelsStore.bgmModelOptions[0].value as string;
      }
      // 注意：不在这里设置 bgmModelInitDone
      // 由 selectedBgmModelId 的 watch 在检测到初始化阶段时自行标记
    }
  },
  { immediate: true, deep: true },
);

// 监听BGM模型选择变化并保存（初始化完成后才保存）
watch(selectedBgmModelId, async (modelId) => {
  if (!modelId) return;
  if (!bgmModelInitDone.value) {
    // 初始化阶段的赋值，只标记完成不保存
    bgmModelInitDone.value = true;
    return;
  }
  const pid = scriptEditStore.projectId;
  const sid = scriptEditStore.scriptId;
  if (pid && sid) {
    await scriptModelsStore.updateScriptModelConfig(pid, sid, "bgm", modelId);
  }
});

// ========== TTS 音色管理 ==========

// 旁白音色选择
const narrationVoiceId = ref<string | undefined>(undefined);

// 旁白音色选择器 popover 状态
const narrationVoicePopoverVisible = ref(false);

// 旁白音色选择器组件 ref
const narrationVoiceSelectorRef = ref<{ stopAudio: () => void } | null>(null);

// 选中的旁白音色（computed）
const selectedNarrationVoice = computed(() => {
  if (!narrationVoiceId.value) return undefined;
  return ttsStore.voices.find((v) => v.voiceId === narrationVoiceId.value);
});

// 更新旁白音色
function handleNarrationVoiceChange(voiceId: string | undefined) {
  narrationVoiceId.value = voiceId;
  saveNarrationVoice();
}

// 旁白音色选择器 popover 关闭处理
function handleNarrationVoicePopoverClose(visible: boolean) {
  narrationVoicePopoverVisible.value = visible;
  if (!visible && narrationVoiceSelectorRef.value) {
    narrationVoiceSelectorRef.value.stopAudio();
  }
}

// 保存旁白音色到后端
async function saveNarrationVoice() {
  if (!scriptEditStore.projectId || !scriptEditStore.scriptId) return;

  try {
    const content = scriptEditStore.buildContentForSave();
    // 添加旁白音色配置
    const updatedContent = {
      ...content,
      narrationVoiceId: narrationVoiceId.value,
    } as unknown as typeof content;

    await fetch(
      `/api/projects/${scriptEditStore.projectId}/scripts/${scriptEditStore.scriptId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: updatedContent }),
      },
    );

    // 同步更新本地 store，确保下游组件响应式更新
    if (scriptEditStore.script) {
      scriptEditStore.script.content = {
        ...scriptEditStore.script.content,
        narrationVoiceId: narrationVoiceId.value,
      } as typeof scriptEditStore.script.content;
    }
  } catch (error) {
    console.error("保存旁白音色失败:", error);
  }
}

// 保存创作设置（分辨率、类型）到后端
async function saveCreationSettings() {
  if (!scriptEditStore.projectId || !scriptEditStore.scriptId) return;

  try {
    const content = scriptEditStore.buildContentForSave();
    // 添加创作设置
    const updatedContent = {
      ...content,
      resolution: scriptEditStore.creationSettings.resolution,
      genre: scriptEditStore.creationSettings.genre,
    } as unknown as typeof content;

    await fetch(
      `/api/projects/${scriptEditStore.projectId}/scripts/${scriptEditStore.scriptId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: updatedContent }),
      },
    );
  } catch (error) {
    console.error("保存创作设置失败:", error);
  }
}

// 初始化完成标志（避免初始化期间触发不必要的保存）
const isInitialized = ref(false);

// 监听创作设置变化并保存
watch(
  () => scriptEditStore.creationSettings,
  () => {
    // 跳过初始化期间的变更
    if (!isInitialized.value) {
      return;
    }
    if (scriptEditStore.script) {
      saveCreationSettings();
    }
  },
  { deep: true },
);

// 从剧本加载旁白音色
watch(
  () => scriptEditStore.script?.content,
  (content) => {
    if (content && typeof content === "object") {
      const c = content as Record<string, unknown>;
      narrationVoiceId.value = c.narrationVoiceId as string | undefined;
    }
  },
);

// 组件挂载时加载音色
onMounted(() => {
  ttsStore.loadVoices();

  // 预加载 ffmpeg wasm（后台静默执行）
  ffmpegCacheService.preloadFfmpeg().catch((error) => {
    console.warn("[ScriptEdit] ffmpeg 预加载失败:", error);
    // 预加载失败不影响页面正常使用，会在实际使用时重新加载
  });
});

// 滚动吸顶状态
const isStepNavSticky = ref(false);
const stepFlowRef = ref<HTMLElement | null>(null);
const stepFlowPlaceholderRef = ref<HTMLElement | null>(null);

// 滚动监听 - 监听所有滚动容器
function handleScroll() {
  // 找到实际滚动的容器（scrollTop 最大的那个）
  const containers = document.querySelectorAll(".n-layout-scroll-container");
  let maxScrollTop = 0;

  containers.forEach((container) => {
    const scrollTop = (container as HTMLElement).scrollTop;
    if (scrollTop > maxScrollTop) {
      maxScrollTop = scrollTop;
    }
  });

  const threshold = 80; // 滚动超过 80px 时触发状态变化
  const shouldBeSticky = maxScrollTop > threshold;

  if (shouldBeSticky !== isStepNavSticky.value) {
    isStepNavSticky.value = shouldBeSticky;
  }
}

// 计算属性
const projectId = computed(() => route.params.id as string);
const scriptId = computed(() => route.params.scriptId as string);

const isLoading = computed(() => scriptEditStore.isLoading);
const script = computed(() => scriptEditStore.script);
const canEdit = computed(() => scriptEditStore.canEdit);

// 剧本是否正在AI生成中
const isGenerating = computed(() => {
  // 优先检查 steps 状态（WebSocket 实时更新）
  if (scriptEditStore.steps.script.status === "completed") {
    return false;
  }
  return script.value?.status === "ai_generating";
});

// 创作设置选项
const resolutionOptions = RESOLUTION_OPTIONS.map((opt) => ({
  label: opt.label,
  value: opt.value,
}));

const filmGenreOptions = FILM_GENRE_OPTIONS.map((opt) => ({
  label: opt.label,
  value: opt.value,
}));

// ========== 步骤状态计算逻辑（按业务规则） ==========

/**
 * 剧本生成状态判断：
 * - 无剧本描述 -> waiting（未开始）
 * - 有剧本描述 -> completed（完成）
 */
function computeScriptStatus(): StepStatusType {
  const backendStatus = scriptEditStore.steps.script.status;
  // 优先处理 processing/failed/parsing 状态
  if (backendStatus === "processing") return "processing";
  if (backendStatus === "failed") return "failed";
  if (backendStatus === "parsing") return "parsing";

  // 有剧本描述 -> 完成；无剧本描述 -> 未开始
  return scriptEditStore.script?.description?.trim() ? "completed" : "waiting";
}

/**
 * 资产步骤（角色/场景/道具）状态判断：
 * - 还没有解析出来基础信息 -> waiting（未开始）
 * - 已经解析出来基础信息 ->
 *   - 有任意资源图片未生成 -> pending（待生成）
 *   - 所有资源图片都已生成 -> completed（完成）
 */
function computeAssetStepStatus(
  stepKey: "characters" | "scenes" | "props",
): StepStatusType {
  const stepState = scriptEditStore.steps[stepKey];
  const backendStatus = stepState.status;

  // 优先处理 processing/failed/parsing 状态
  if (backendStatus === "processing") return "processing";
  if (backendStatus === "failed") return "failed";
  if (backendStatus === "parsing") return "parsing";

  // 还没有解析出来基础信息 -> 未开始
  if (stepState.items.length === 0) return "waiting";

  // 检查所有资产是否有图片（非 reference 类型）
  const items = stepState.items as Array<{ images?: { type: string }[] }>;
  const allHaveImages = items.every((item) => {
    const images = item.images;
    return images && images.some((img) => img.type !== "reference");
  });

  return allHaveImages ? "completed" : "pending";
}

/**
 * 分镜步骤状态判断：
 * - 有 shot 处于待生成状态（视频未生成） -> pending（待生成）
 * - 所有 shot 视频都生成完毕 -> completed（完成）
 */
function computeStoryboardStatus(): StepStatusType {
  const stepState = scriptEditStore.steps.storyboards;
  const backendStatus = stepState.status;

  // 优先处理 processing/failed/parsing 状态
  if (backendStatus === "processing") return "processing";
  if (backendStatus === "failed") return "failed";
  if (backendStatus === "parsing") return "parsing";

  // 还没有生成分镜 -> 未开始
  if (stepState.items.length === 0) return "waiting";

  // 检查所有分镜是否有视频成品
  const allHaveVideo = stepState.items.every((item) => {
    // 视频生成状态为 completed 表示视频已生成
    return (
      item.videoGeneration?.status === "completed" &&
      item.videoGeneration?.videoUrl
    );
  });

  return allHaveVideo ? "completed" : "pending";
}

/**
 * 合成/导出步骤状态判断（共用逻辑）
 * - 分镜没有任何数据 -> waiting
 * - 分镜有数据，但不是所有视频都已完成 -> processing
 * - 所有分镜的视频都已完成 -> completed
 */
function computeAudioExportStatus(): StepStatusType {
  const items = scriptEditStore.steps.storyboards.items;

  // 待开始：分镜步骤中没有任何数据
  if (items.length === 0) return "waiting";

  // 检查所有分镜是否都有 completed 视频（无黑屏）
  const allCompleted = items.every((item) => {
    const videoMode = item.videoMode || "lip_sync";
    const shots = item.shots || [];

    // video_only / audio_reference：检查分镜组级别视频
    if (videoMode === "video_only" || videoMode === "audio_reference") {
      if (item.video?.url && item.video?.status === "completed") return true;
      // 兼容旧数据：videoGeneration
      const vg = (item as unknown as { videoGeneration?: { videoUrl?: string; status?: string } }).videoGeneration;
      return vg?.videoUrl && vg?.status === "completed";
    }

    // lip_sync：检查 shots
    if (videoMode === "lip_sync") {
      if (shots.length > 0) {
        return shots.some((shot) => shot.status === "completed" && shot.videoUrl);
      }
      // 没有 shots，检查 videoGeneration 兜底
      const vg = item.videoGeneration;
      return vg?.videoUrl && vg?.status === "completed";
    }

    return false;
  });

  if (allCompleted) return "completed";

  // 进行中：分镜有数据，但不是所有视频都已完成
  return "processing";
}

// 各步骤实际状态
const stepStatuses = computed(() => {
  const scriptStatus = computeScriptStatus();
  const charactersStatus = computeAssetStepStatus("characters");
  const scenesStatus = computeAssetStepStatus("scenes");
  const propsStatus = computeAssetStepStatus("props");
  const storyboardsStatus = computeStoryboardStatus();

  // 后期合成状态：直接基于分镜视频实际生成状态计算
  const audioStatus: StepStatusType = computeAudioExportStatus();

  // 导出步骤状态：与合成逻辑一致
  const exportStatus: StepStatusType = computeAudioExportStatus();

  return {
    script: scriptStatus,
    characters: charactersStatus,
    scenes: scenesStatus,
    props: propsStatus,
    storyboards: storyboardsStatus,
    audio: audioStatus,
    export: exportStatus,
  };
});

// 步骤定义（使用计算后的状态）
const steps = computed(() => [
  { id: "script", label: "剧本", status: stepStatuses.value.script },
  { id: "characters", label: "角色", status: stepStatuses.value.characters },
  { id: "scenes", label: "场景", status: stepStatuses.value.scenes },
  { id: "props", label: "道具", status: stepStatuses.value.props },
  { id: "storyboards", label: "分镜", status: stepStatuses.value.storyboards },
  { id: "audio", label: "合成", status: stepStatuses.value.audio },
  { id: "export", label: "导出", status: stepStatuses.value.export },
]);

// 返回列表
function goBack() {
  router.push(`/projects/${projectId.value}/scripts`);
}

// 处理步骤导航
function handleNavigate(stepId: string) {
  scriptEditStore.setCurrentStep(stepId);
  const element = document.getElementById(`step-${stepId}`);
  if (element) {
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

// 处理剧本生成完成
function handleScriptGenerated() {
  message.success("剧本生成任务已启动，请稍候...");
}

// 处理错误
function handleError(errorMessage: string) {
  dialog.error({
    title: "操作失败",
    content: errorMessage,
    positiveText: "确定",
  });
}

// 处理音频生成
function handleGenerateAudio() {
  message.info("音频生成功能开发中...");
}

// 初始化页面
async function initPage() {
  if (!projectId.value || !scriptId.value) {
    message.error("页面参数错误");
    router.push(`/projects/${projectId.value}/scripts`);
    return;
  }

  // 设置IDs
  scriptEditStore.setIds(projectId.value, scriptId.value);

  try {
    // 加载剧本详情
    await scriptEditStore.loadScript();

    // 从 content 读取模型配置并设置到 scriptModelsStore
    // 不再调用 /models API，避免重复请求和级联解析
    const content = scriptEditStore.script?.content;
    if (content) {
      const configs: Record<string, string> = {};
      if (content.characterSettings?.modelId) configs.characters = content.characterSettings.modelId as string;
      if (content.sceneSettings?.modelId) configs.scenes = content.sceneSettings.modelId as string;
      if (content.propSettings?.modelId) configs.props = content.propSettings.modelId as string;
      if (content.scriptSettings?.modelId) configs.script = content.scriptSettings.modelId as string;
      if (content.bgmSettings?.modelId) configs.bgm = content.bgmSettings.modelId as string;

      for (const [step, modelId] of Object.entries(configs)) {
        scriptModelsStore.scriptModelConfigs[step] = modelId;
      }
    }

    // 加载可用模型列表（不传 scriptId，避免调用 /models API）
    await scriptModelsStore.loadModels(projectId.value, undefined, true);

    // 确保WebSocket连接
    if (!wsStore.isConnected) {
      await wsStore.connect();
    }

    // 如果URL中有taskId参数，订阅该任务进度
    const taskIdFromQuery = route.query.taskId as string;
    if (taskIdFromQuery) {
      // 检查剧本状态：如果已经完成，则不需要订阅
      // loadScript 已经加载了剧本数据，可以直接检查状态
      const scriptStatus = scriptEditStore.script?.status;
      if (scriptStatus === "ai_generating") {
        // 剧本还在生成中，需要订阅任务进度
        scriptEditStore.steps.script.status = "processing";
        scriptEditStore.steps.script.currentTaskId = taskIdFromQuery;
        // 立即订阅，不再延迟（WebSocket 已在 loadScript 中连接）
        scriptEditStore.subscribeToTask(taskIdFromQuery, "script");
      }

      // 清除URL中的taskId参数，避免重复订阅
      router.replace({
        path: route.path,
        query: undefined,
      });
    }

    // 等待所有排队的 watch 回调先执行完（此时 isInitialized 还是 false，会跳过保存）
    await nextTick();

    // 标记初始化完成，允许后续变更触发保存
    isInitialized.value = true;
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "加载失败";
    message.error(`加载失败: ${errMsg}`);
    router.push(`/projects/${projectId.value}/scripts`);
  }
}

// 监听路由参数变化
watch(
  () => [route.params.id, route.params.scriptId],
  () => {
    if (projectId.value && scriptId.value) {
      initPage();
    }
  },
  { immediate: true },
);

// 生命周期
let scrollContainers: Element[] = [];

onMounted(() => {
  // 注意：initPage 已由 watch({ immediate: true }) 在 setup 阶段调用，
  // 此处不再重复调用，避免并发 loadScript 竞态覆盖 storyboard 状态。

  // 预加载视频时长（使用 mp4box 解析）
  preloadVideoDurations();

  // 延迟初始化滚动监听
  setTimeout(() => {
    // 监听所有滚动容器，找到实际可滚动的那个
    const containers = document.querySelectorAll(".n-layout-scroll-container");
    scrollContainers = Array.from(containers);

    scrollContainers.forEach((container) => {
      container.addEventListener("scroll", handleScroll, { passive: true });
    });

    // 初始检查
    handleScroll();
  }, 200);
});

onUnmounted(() => {
  scriptEditStore.resetState();
  scrollContainers.forEach((container) => {
    container.removeEventListener("scroll", handleScroll);
  });
  scrollContainers = [];

  // 关闭缓存服务数据库连接
  ffmpegCacheService.close();
});
</script>

<template>
  <n-layout class="script-edit-layout">
    <n-spin
      :show="isLoading"
      description="加载中..."
    >
      <template v-if="script">
        <!-- AI生成中状态覆盖层 -->
        <div
          v-if="isGenerating"
          class="generating-overlay"
        >
          <div class="generating-content">
            <n-icon
              size="80"
              class="generating-icon"
            >
              <Sparkles />
            </n-icon>
            <h2 class="generating-title">
              AI正在绘梦中...
            </h2>
            <p class="generating-desc">
              剧本生成中，请稍候。这个过程通常需要1-3分钟。
            </p>
            <div class="generating-actions">
              <n-button
                type="primary"
                ghost
                @click="goBack"
              >
                <template #icon>
                  <n-icon><ArrowBack /></n-icon>
                </template>
                返回列表
              </n-button>
            </div>
          </div>
        </div>

        <!-- 页面头部 - 优化版：两行布局 -->
        <div
          v-else
          class="page-header"
        >
          <!-- 第一行：标题栏 -->
          <div class="header-row header-top">
            <div class="header-left">
              <n-button
                text
                class="back-btn"
                @click="goBack"
              >
                <template #icon>
                  <n-icon><ArrowBack /></n-icon>
                </template>
                返回列表
              </n-button>

              <div class="title-section">
                <h1 class="page-title">
                  {{ script.title }}
                </h1>
                <span class="page-subtitle">
                  进度 {{ scriptEditStore.completedStepsCount }}/{{
                    scriptEditStore.totalStepsCount
                  }}
                </span>
              </div>
            </div>

            <div class="header-right">
              <!-- 创作设置 -->
              <div class="creation-settings">
                <div class="setting-item">
                  <n-icon
                    size="14"
                    class="setting-icon"
                  >
                    <DesktopOutline />
                  </n-icon>
                  <n-select
                    v-model:value="scriptEditStore.creationSettings.resolution"
                    :options="resolutionOptions"
                    :consistent-menu-width="false"
                    aria-label="分辨率"
                    size="small"
                    class="resolution-select"
                  />
                </div>
                <div class="setting-item">
                  <n-icon
                    size="14"
                    class="setting-icon"
                  >
                    <FilmOutline />
                  </n-icon>
                  <n-select
                    v-model:value="scriptEditStore.creationSettings.genre"
                    :options="filmGenreOptions"
                    aria-label="影片类型"
                    size="small"
                    class="genre-select"
                  />
                </div>
                <!-- 旁白音色选择 -->
                <div class="setting-item">
                  <n-popover
                    trigger="click"
                    placement="bottom"
                    @update:show="handleNarrationVoicePopoverClose"
                  >
                    <template #trigger>
                      <div class="narration-voice-trigger">
                        <n-icon
                          size="14"
                          :color="selectedNarrationVoice ? '#18a058' : '#666'"
                        >
                          <MusicalNotes />
                        </n-icon>
                        <span
                          v-if="selectedNarrationVoice"
                          class="narration-voice-name"
                        >
                          {{ selectedNarrationVoice.name }}
                        </span>
                        <span
                          v-else
                          class="narration-voice-placeholder"
                        >
                          旁白音色
                        </span>
                      </div>
                    </template>

                    <!-- 使用 VoiceSelector 组件 -->
                    <div class="narration-voice-popover">
                      <VoiceSelector
                        ref="narrationVoiceSelectorRef"
                        :model-value="narrationVoiceId"
                        :voices="ttsStore.voices"
                        :loading="ttsStore.voicesLoading"
                        :popover-visible="narrationVoicePopoverVisible"
                        @update:model-value="handleNarrationVoiceChange"
                      />
                    </div>
                  </n-popover>
                </div>
              </div>

              <!-- 整体进度 -->
              <div class="overall-progress">
                <div
                  class="progress-ring"
                  :style="{
                    background: `conic-gradient(#2080f0 ${scriptEditStore.overallProgress}%, #e8e8e8 ${scriptEditStore.overallProgress}%)`,
                  }"
                >
                  <span class="progress-text">{{ scriptEditStore.overallProgress }}%</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 第二行：步骤流程 -->
          <div
            v-show="!isStepNavSticky"
            ref="stepFlowRef"
            class="header-row header-bottom"
          >
            <div class="step-flow">
              <div
                v-for="(step, index) in steps"
                :key="step.id"
                :class="[
                  'step-flow-item',
                  `status-${step.status}`,
                  { active: scriptEditStore.currentStepId === step.id },
                ]"
                @click="handleNavigate(step.id)"
              >
                <div class="step-flow-number">
                  {{ index + 1 }}
                </div>
                <span class="step-flow-label">{{ step.label }}</span>
                <n-icon
                  v-if="index < steps.length - 1"
                  class="step-flow-arrow"
                >
                  <ChevronForward />
                </n-icon>
              </div>
            </div>
          </div>
        </div>

        <!-- 占位符（吸顶时保持布局） -->
        <div
          v-if="isStepNavSticky"
          class="step-flow-placeholder"
        />

        <!-- 吸顶步骤流程（滚动后显示） -->
        <div
          v-show="isStepNavSticky"
          ref="stepFlowPlaceholderRef"
          class="step-flow-sticky"
        >
          <div class="step-flow-sticky-inner">
            <div
              v-for="(step, index) in steps"
              :key="step.id"
              :class="[
                'step-flow-item',
                `status-${step.status}`,
                { active: scriptEditStore.currentStepId === step.id },
              ]"
              @click="handleNavigate(step.id)"
            >
              <div class="step-flow-number">
                {{ index + 1 }}
              </div>
              <span class="step-flow-label">{{ step.label }}</span>
              <n-icon
                v-if="index < steps.length - 1"
                class="step-flow-arrow"
              >
                <ChevronForward />
              </n-icon>
            </div>
          </div>
        </div>

        <!-- 提示信息 -->
        <div
          v-if="!canEdit"
          class="alert-section"
        >
          <n-alert
            type="warning"
            :show-icon="true"
          >
            <template #icon>
              <n-icon><Warning /></n-icon>
            </template>
            剧本已确认，如需编辑请先解锁
          </n-alert>
        </div>

        <!-- 7步骤流程区域 -->
        <n-layout-content class="main-content">
          <div class="steps-container">
            <!-- 步骤1: 剧本生成 -->
            <section
              id="step-script"
              class="step-section"
            >
              <script-generation-step
                :project-id="projectId"
                :script-id="scriptId"
                @generated="handleScriptGenerated"
                @error="handleError"
              />
            </section>

            <!-- 步骤2: 角色生成 -->
            <section
              id="step-characters"
              class="step-section"
            >
              <character-step
                :project-id="projectId"
                :script-id="scriptId"
                :computed-status="stepStatuses.characters"
                @generated="handleScriptGenerated"
                @error="handleError"
              />
            </section>

            <!-- 步骤3: 场景生成 -->
            <section
              id="step-scenes"
              class="step-section"
            >
              <scene-step
                :project-id="projectId"
                :script-id="scriptId"
                :computed-status="stepStatuses.scenes"
                @generated="handleScriptGenerated"
                @error="handleError"
              />
            </section>

            <!-- 步骤4: 道具生成 -->
            <section
              id="step-props"
              class="step-section"
            >
              <prop-step
                :project-id="projectId"
                :script-id="scriptId"
                :computed-status="stepStatuses.props"
                @generated="handleScriptGenerated"
                @error="handleError"
              />
            </section>

            <!-- 步骤5: 分镜生成 -->
            <section
              id="step-storyboards"
              class="step-section"
            >
              <storyboard-step
                :project-id="projectId"
                :script-id="scriptId"
                :computed-status="stepStatuses.storyboards"
                @generated="handleScriptGenerated"
                @error="handleError"
              />
            </section>

            <!-- 步骤6: 后期合成 -->
            <section
              id="step-audio"
              class="step-section"
            >
              <workflow-step
                step-id="audio"
                title="后期合成"
                :step-number="6"
                description="时间轴编排和音频混音"
                :status="stepStatuses.audio"
                show-model-selector
              >
                <template #modelSelector>
                  <div class="model-selector-wrapper">
                    <n-select
                      v-if="hasAvailableBgmModels"
                      v-model:value="selectedBgmModelId"
                      :options="scriptModelsStore.bgmModelOptions"
                      :render-label="renderModelLabel"
                      placeholder="选择模型"
                      aria-label="BGM 模型"
                      style="width: 200px"
                      size="small"
                      :disabled="isLoadingModels"
                      :loading="isLoadingModels"
                    />
                    <span
                      v-else
                      class="no-model-hint"
                    >
                      {{ isLoadingModels ? "加载中..." : "暂无可用模型" }}
                    </span>
                  </div>
                </template>
                <PostProductionStep
                  :project-id="projectId"
                  :script-id="scriptId"
                  :storyboards="scriptEditStore.steps.storyboards.items"
                  :unified-timeline-data="unifiedTimelineData"
                  @generate-audio="handleGenerateAudio"
                />
              </workflow-step>
            </section>

            <!-- 步骤7: 导出设置 -->
            <section
              id="step-export"
              class="step-section"
            >
              <workflow-step
                step-id="export"
                title="导出设置"
                :step-number="7"
                description="配置导出格式和质量"
                :status="stepStatuses.export"
              >
                <ExportStep
                  :project-id="projectId"
                  :script-id="scriptId"
                  :storyboards="scriptEditStore.steps.storyboards.items"
                  :unified-timeline-data="unifiedTimelineData"
                />
              </workflow-step>
            </section>
          </div>
        </n-layout-content>
      </template>
    </n-spin>
  </n-layout>
</template>

<style scoped lang="scss">
.script-edit-layout {
  min-height: 100vh;
  background: #fafbfc;
}

.page-header {
  display: flex;
  flex-direction: column;
  padding: 0;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  z-index: 50;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.02);
}

// 头部行通用样式
.header-row {
  display: flex;
  align-items: center;
  padding: 0 32px;
}

// 第一行：标题栏
.header-top {
  justify-content: space-between;
  padding-top: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f5f5f5;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.back-btn {
  color: #666;
  font-size: 14px;
  flex-shrink: 0;

  &:hover {
    color: #2080f0;
  }
}

.title-section {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: nowrap;
  white-space: nowrap;
}

.page-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
  white-space: nowrap;
}

.page-subtitle {
  font-size: 13px;
  color: #999;
  padding: 2px 10px;
  background: #f5f5f5;
  border-radius: 12px;
  white-space: nowrap;
}

// 创作设置
.creation-settings {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e8e8e8;

  .setting-item {
    display: flex;
    align-items: center;
    gap: 6px;

    .setting-icon {
      color: #666;
    }
  }

  .resolution-select {
    width: auto;
    min-width: 120px;

    :deep(.n-base-selection-label) {
      white-space: nowrap !important;
    }

    :deep(.n-base-selection-label > .n-space) {
      flex-wrap: nowrap !important;
    }
  }

  .genre-select {
    width: auto;
    min-width: 90px;
  }

  :deep(.n-base-selection) {
    background: #fff;
  }
}

// 第二行：步骤流程
.header-bottom {
  justify-content: center;
  padding-top: 12px;
  padding-bottom: 12px;
  background: #fafbfc;
}

// 吸顶步骤流程
.step-flow-sticky {
  position: fixed;
  top: 56px;
  left: 0;
  right: 0;
  z-index: 100;
  background: #fff;
  padding: 10px 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border-bottom: 1px solid #f0f0f0;
  animation: slideDown 0.3s ease;

  .step-flow-sticky-inner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
    max-width: 1400px;
    margin: 0 auto;
  }
}

// 步骤流程指示器
.step-flow {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-wrap: nowrap;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

// 占位符（吸顶时保持布局）
.step-flow-placeholder {
  height: 56px; // 与步骤栏高度一致
}

@keyframes slideDown {
  from {
    transform: translateY(-100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.step-flow-item {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 20px;
  transition: all 0.2s ease;
  flex-shrink: 0;

  &:hover {
    background: #f5f5f5;
  }
}

.step-flow-number {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  background: #f0f0f0;
  color: #999;
  transition: all 0.3s ease;
  flex-shrink: 0;
}

.step-flow-label {
  font-size: 13px;
  color: #666;
  font-weight: 500;
  white-space: nowrap;
}

.step-flow-arrow {
  font-size: 14px;
  color: #d9d9d9;
  margin-left: 2px;
  flex-shrink: 0;
}

// 状态样式
.step-flow-item.status-completed {
  .step-flow-number {
    background: #18a058;
    color: #fff;
  }

  .step-flow-label {
    color: #18a058;
  }
}

// pending/processing/parsing 都显示为黄色（待操作状态）
.step-flow-item.status-pending,
.step-flow-item.status-processing,
.step-flow-item.status-parsing {
  .step-flow-number {
    background: #f0a020;
    color: #fff;
  }

  .step-flow-label {
    color: #f0a020;
    font-weight: 600;
  }
}

// waiting 显示为灰色（待开始，前置步骤未完成）
.step-flow-item.status-waiting {
  .step-flow-number {
    background: #f0f0f0;
    color: #999;
  }

  .step-flow-label {
    color: #999;
  }
}

.step-flow-item.status-failed {
  .step-flow-number {
    background: #d03050;
    color: #fff;
  }

  .step-flow-label {
    color: #d03050;
  }
}

// 进度环
.overall-progress {
  .progress-ring {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: conic-gradient(#2080f0 0%, #e8e8e8 0%);
    position: relative;
    flex-shrink: 0;

    &::before {
      content: "";
      position: absolute;
      inset: 3px;
      background: #fff;
      border-radius: 50%;
    }

    .progress-text {
      position: relative;
      font-size: 10px;
      font-weight: 600;
      color: #2080f0;
    }
  }
}

.alert-section {
  padding: 16px 32px 0;
  background: #fafbfc;
}

// 主内容区
.main-content {
  background: #fafbfc;
  padding-bottom: 48px;
}

.steps-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 32px 48px;
}

.step-section {
  margin-bottom: 24px;
  scroll-margin-top: 140px;
}

.placeholder-content {
  padding: 48px;
  text-align: center;
  color: #999;
  background: #fafafa;
  border-radius: 12px;
  border: 1px dashed #e0e0e0;

  p {
    margin: 0 0 8px;
    font-size: 14px;
  }

  .hint {
    font-size: 12px;
    color: #bbb;
  }
}

// 旁白音色选择器
.narration-voice-trigger {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: background 0.2s;

  &:hover {
    background: rgba(0, 0, 0, 0.05);
  }

  .narration-voice-name {
    font-size: 12px;
    color: #18a058;
    font-weight: 500;
    max-width: 60px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .narration-voice-placeholder {
    font-size: 12px;
    color: #666;
  }
}

.narration-voice-popover {
  width: 280px;

  .selected-voice-tag {
    margin-bottom: 8px;
  }

  .voice-search {
    margin-bottom: 8px;
  }

  .voice-tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 8px;
  }

  .voice-loading {
    display: flex;
    justify-content: center;
    padding: 20px;
  }

  .voice-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }

  .voice-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 8px;
    border: 1px solid #e8e8e8;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;

    .voice-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
    }

    &:hover {
      border-color: #18a058;
      background-color: #f6ffed;
    }

    &.selected {
      border-color: #18a058;
      background-color: #f6ffed;
    }

    .voice-name {
      font-size: 13px;
      font-weight: 500;

      .voice-name-en {
        font-size: 11px;
        color: #999;
        font-weight: 400;
        margin-left: 2px;
      }
    }
  }
}

// 响应式适配
@media (max-width: 1440px) {
  .steps-container {
    max-width: calc(100% - 64px);
    padding: 32px;
  }

  .header-row {
    padding-left: 24px;
    padding-right: 24px;
  }

  .creation-settings {
    padding: 4px 8px;

    .resolution-select {
      width: auto;
      min-width: 150px;
    }

    .genre-select {
      width: auto;
      min-width: 90px;
    }
  }
}

@media (max-width: 1200px) {
  .steps-container {
    max-width: calc(100% - 140px);
    margin-right: 120px;
    padding: 24px;
  }

  .step-flow,
  .header-bottom,
  .step-flow-sticky {
    display: none;
  }

  .creation-settings {
    display: none;
  }
}

@media (max-width: 768px) {
  .top-nav-header {
    padding: 0 16px;
  }

  .header-row {
    padding-left: 16px;
    padding-right: 16px;
  }

  .header-top {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
    padding-top: 12px;
    padding-bottom: 12px;
  }

  .header-left {
    width: 100%;
  }

  .header-right {
    width: 100%;
    justify-content: space-between;
  }

  .step-flow,
  .header-bottom,
  .step-flow-sticky {
    display: none;
  }

  .steps-container {
    max-width: 100%;
    margin: 0;
    padding: 16px;
    padding-bottom: 100px;
  }

  .step-section {
    scroll-margin-top: 100px;
  }

  .alert-section {
    padding: 12px 16px 0;
  }
}

.no-model-hint {
  font-size: 12px;
  color: #999;
  padding: 2px 8px;
  background: #f5f5f5;
  border-radius: 4px;
}

// AI生成中覆盖层
.generating-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.generating-content {
  text-align: center;
  max-width: 480px;
  padding: 48px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
}

.generating-icon {
  color: #2080f0;
  margin-bottom: 24px;
  animation: dreaming 2s ease-in-out infinite;
}

.generating-title {
  font-size: 24px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 16px;
}

.generating-desc {
  font-size: 14px;
  color: #666;
  margin: 0 0 32px;
  line-height: 1.6;
}

.generating-actions {
  display: flex;
  justify-content: center;
}

@keyframes dreaming {
  0%,
  100% {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
  25% {
    opacity: 0.8;
    transform: scale(1.1) rotate(-5deg);
  }
  50% {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
  75% {
    opacity: 0.8;
    transform: scale(1.1) rotate(5deg);
  }
}
</style>
