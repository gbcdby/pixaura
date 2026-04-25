<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from "vue";
import {
  NButton,
  NIcon,
  NTooltip,
  NUpload,
  NImage,
  NImageGroup,
  NSpin,
  type UploadFileInfo,
} from "naive-ui";
import {
  Videocam,
  Sparkles,
  CloudUpload,
  CloseOutline,
  CloudUploadOutline,
  ScanOutline,
} from "@vicons/ionicons5";
import type { StoryboardCardProps } from "./types";
import type {
  DetectedSubject,
  CharacterRegions,
  CharacterRegionConfig,
} from "@pixaura/shared-types";
import InlineCharacterRegionPanel from "./InlineCharacterRegionPanel.vue";
import RegionOverlay from "./RegionOverlay.vue";
import MseVideoPlayer from "@/components/MseVideoPlayer.vue";
import { useImageOverlay } from "@/composables/useImageOverlay";
import {
  useVideoConcat,
  type VideoClip,
} from "@/composables/useVideoConcat";

// 角色信息接口
interface CharacterInfo {
  id: string;
  name: string;
  avatarUrl?: string;
}

interface Props {
  data: StoryboardCardProps["data"];
  index: number;
  aspectRatio: string;
  isReadonly: boolean;
  loading?: boolean;
  // 图片生成相关
  imageGenerating?: boolean;
  imageGenerationProgress?: number;
  imageGenerationError?: string;
  canGenerateImage: boolean;
  selectedImageModel: string;
  maxImageRefImages: number;
  // 视频生成相关
  videoGenerating?: boolean;
  videoGenerationProgress?: number; // 视频生成进度 0-100
  maxVideoRefImages: number;
  // 参考模式
  referenceMode: "multi_reference" | "single_reference";
  // 视频模式（对口型相关）
  videoMode?: "audio_reference" | "lip_sync" | "video_only";
  // 视频生成是否可用（综合检查）
  canGenerateVideo?: boolean;
  // duration 是否超出视频模型最大时长
  durationExceedsMax?: boolean;
  // duration 超限时生成视频按钮的 tooltip 提示
  durationExceedsMaxReason?: string;
  // 分镜图生视频模式下视频不可用原因
  singleReferenceVideoUnavailableReason?: string;
  // 多参考生视频模式下视频不可用原因
  multiReferenceVideoUnavailableReason?: string;
  // video_only 模式下旁白音频未生成原因
  voiceoverAudioUnavailableReason?: string;
  // 缺失素材列表（用于 Tooltip 提示）
  missingAssetImages?: string[];
  // 角色框选相关（对口型模式）
  shotGroupId?: string;
  characterInfos?: CharacterInfo[];
  detectedSubjects?: DetectedSubject[];
  characterRegions?: CharacterRegions;
  detectionStatus?: "pending" | "processing" | "completed" | "failed";
  isDetecting?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  imageGenerating: false,
  imageGenerationProgress: 0,
  imageGenerationError: "",
  videoGenerating: false,
  videoGenerationProgress: 0,
  canGenerateVideo: true,
  durationExceedsMax: false,
  durationExceedsMaxReason: "",
  videoMode: "audio_reference",
  characterInfos: () => [],
  detectedSubjects: () => [],
  characterRegions: () => ({}),
  detectionStatus: "pending",
  isDetecting: false,
  missingAssetImages: () => [],
});

const emit = defineEmits<{
  (e: "generate-image"): void;
  (e: "generate-video"): void;
  (e: "upload-reference", file: File): void;
  (e: "delete-reference", imageId: string): void;
  (e: "upload-video-reference", file: File): void;
  (e: "delete-video-reference", imageId: string): void;
  (e: "upload-main-image", file: File): void;
  // 角色框选相关事件
  (e: "trigger-detection", shotGroupId: string): void;
  (e: "update-region", shotGroupId: string, characterId: string, config: CharacterRegionConfig): void;
  // Bug-2 修复：添加 shotGroupId 参数
  (e: "open-manual-select", shotGroupId: string, characterId: string): void;
}>();

// 参考图 hover 状态
const hoveredReferenceId = ref<string | null>(null);
const hoveredVideoReferenceId = ref<string | null>(null);
// 上传组件文件列表（受控，每次上传后清空，解决第二次无法点击问题）
const mainImageUploadFileList = ref<UploadFileInfo[]>([]);
const refImageUploadFileList = ref<UploadFileInfo[]>([]);
const refVideoUploadFileList = ref<UploadFileInfo[]>([]);

// 分镜主图（type=main 的第一张图片）
const storyboardMainImage = computed(() => {
  const imgs = props.data.images || [];
  return imgs.find((img) => img.type === "main") || null;
});

// 分镜图片生成参考图（type=reference）
const storyboardReferenceImages = computed(() => {
  const imgs = props.data.images || [];
  return imgs
    .filter((img) => img.type === "reference")
    .slice(0, props.maxImageRefImages);
});

// 视频生成参考图（type=video_reference）
const storyboardVideoReferenceImages = computed(() => {
  const imgs = props.data.images || [];
  return imgs
    .filter((img) => img.type === "video_reference")
    .slice(0, props.maxVideoRefImages);
});

// 处理 n-upload 参考图上传
function handleReferenceUpload({ file }: { file: { file: File | null } }) {
  if (file?.file) {
    emit("upload-reference", file.file);
  }
  // 清空文件列表，解决第二次无法点击问题
  refImageUploadFileList.value = [];
}

// 处理参考图删除
function handleDeleteReference(imageId: string) {
  emit("delete-reference", imageId);
}

// 处理视频参考图上传
function handleVideoReferenceUpload({ file }: { file: { file: File | null } }) {
  if (file?.file) {
    emit("upload-video-reference", file.file);
  }
  // 清空文件列表，解决第二次无法点击问题
  refVideoUploadFileList.value = [];
}

// 处理视频参考图删除
function handleDeleteVideoReference(imageId: string) {
  emit("delete-video-reference", imageId);
}

// 处理生成图片
function handleGenerateImage() {
  emit("generate-image");
}

// 处理生成视频
function handleGenerateVideo() {
  emit("generate-video");
}

// 处理主图上传
function handleMainImageUpload({ file }: { file: { file: File | null } }) {
  if (file?.file) {
    emit("upload-main-image", file.file);
  }
  // 清空文件列表，解决第二次无法点击问题
  mainImageUploadFileList.value = [];
}

// ========== 对口型模式相关计算属性和方法 ==========

// 判断是否为对口型模式
const isLipSyncMode = computed(() => {
  return (
    props.referenceMode === "single_reference" && props.videoMode === "lip_sync"
  );
});

// 角色框选面板显示状态
const showRegionPanel = ref(false);

// 切换角色框选面板
function toggleRegionPanel() {
  showRegionPanel.value = !showRegionPanel.value;
}

// 处理关闭面板
function handleCloseRegionPanel() {
  showRegionPanel.value = false;
}

// 处理触发检测
function handleTriggerDetection(shotGroupId: string) {
  emit("trigger-detection", shotGroupId);
}

// 处理更新框选配置
function handleUpdateRegion(shotGroupId: string, characterId: string, config: CharacterRegionConfig) {
  emit("update-region", shotGroupId, characterId, config);
}

// 处理打开手动框选
function handleOpenManualSelect(shotGroupId: string, characterId: string) {
  emit("open-manual-select", shotGroupId, characterId);
}

// ========== 旁白音频同步播放逻辑 ==========

// 视频元素引用（用于同步音频）
const videoRef = ref<HTMLVideoElement | null>(null);
const audioRef = ref<HTMLAudioElement | null>(null);

// 判断是否为 video_only 模式
const isVideoOnlyMode = computed(() => props.videoMode === "video_only");

// 获取旁白对话数据
const voiceoverDialogue = computed(() => {
  if (!props.data.dialogues) return null;
  return props.data.dialogues.find(d => d.isVoiceover === true);
});

// 是否应该播放旁白音频
const shouldPlayVoiceover = computed(() => {
  // 条件1: video_only 模式
  if (!isVideoOnlyMode.value) return false;
  // 条件2: 非对口型模式（对口型模式下旁白不播放）
  if (isLipSyncMode.value) return false;
  // 条件3: 有旁白对话且音频已生成
  if (!voiceoverDialogue.value?.audioUrl) return false;
  if (voiceoverDialogue.value.audioStatus !== "completed") return false;
  // 条件4: 有视频 URL（视频播放的前提）
  // 兼容新旧字段：shotGroup.video.url 或 videoGeneration.videoUrl
  if (!props.data.video?.url && !props.data.videoGeneration?.videoUrl) return false;
  return true;
});

// 旁白音频 URL
const voiceoverAudioUrl = computed(() => voiceoverDialogue.value?.audioUrl || null);

// 视频播放事件处理
function handleVideoPlay() {
  if (shouldPlayVoiceover.value && audioRef.value && videoRef.value) {
    audioRef.value.currentTime = videoRef.value.currentTime;
    audioRef.value.play().catch(() => {
      // 自动播放可能被浏览器阻止，忽略错误
    });
  }
}

// 视频暂停事件处理
function handleVideoPause() {
  if (audioRef.value && !audioRef.value.paused) {
    audioRef.value.pause();
  }
}

// 视频时间更新：同步音频进度
function handleVideoTimeUpdate() {
  if (!shouldPlayVoiceover.value || !videoRef.value || !audioRef.value) return;
  const videoTime = videoRef.value.currentTime;
  // 音频跟随视频进度（偏差超过 300ms 时同步）
  if (Math.abs(audioRef.value.currentTime - videoTime) > 0.3) {
    audioRef.value.currentTime = videoTime;
  }
}

// 视频跳转事件处理
function handleVideoSeeked() {
  if (shouldPlayVoiceover.value && audioRef.value && videoRef.value) {
    audioRef.value.currentTime = videoRef.value.currentTime;
  }
}

// 视频结束事件处理
function handleVideoEnded() {
  if (audioRef.value && !audioRef.value.paused) {
    audioRef.value.pause();
    audioRef.value.currentTime = 0;
  }
}

// 监听 videoMode/dialogues 变化，重置音频状态
watch([() => props.videoMode, () => props.data.dialogues], () => {
  if (audioRef.value) {
    audioRef.value.pause();
    audioRef.value.currentTime = 0;
  }
});

// 监听 videoUrl 变化，重置音频状态（兼容新旧字段）
watch([() => props.data.video?.url, () => props.data.videoGeneration?.videoUrl], () => {
  if (audioRef.value) {
    audioRef.value.pause();
    audioRef.value.currentTime = 0;
  }
});

// 组件销毁时清理音频资源
onUnmounted(() => {
  if (audioRef.value) {
    audioRef.value.pause();
    audioRef.value.src = "";
  }
});

// ========== 角色框选显示相关计算属性 ==========

// 角色颜色数组（与 InlineCharacterRegionPanel 保持一致）
const CHARACTER_COLORS = [
  "#2080f0", // 蓝色
  "#18a058", // 绿色
  "#f0a020", // 橙色
  "#d03050", // 红色
  "#8b5cf6", // 紫色
  "#06b6d4", // 青色
  "#f43f5e", // 粉红
  "#84cc16", // 黄绿
];

// 获取角色颜色
function getCharacterColor(index: number): string {
  return CHARACTER_COLORS[index % CHARACTER_COLORS.length];
}

// 获取角色的框选配置
function getCharacterConfig(characterId: string): CharacterRegionConfig {
  return props.characterRegions?.[characterId] || { useManual: false };
}

// 获取角色使用的框选区域（用于 RegionOverlay 显示）
function getCharacterRegion(characterId: string): { x: number; y: number; width: number; height: number } | undefined {
  const config = getCharacterConfig(characterId);
  // 手动框选优先
  if (config.useManual && config.manualRegion) {
    return config.manualRegion;
  }
  // 自动检测：根据 detectedIndex 获取对应主体的区域
  if (config.detectedIndex && props.detectedSubjects) {
    const subject = props.detectedSubjects.find(s => s.index === config.detectedIndex);
    if (subject?.region) {
      return subject.region;
    }
  }
  return undefined;
}

// 检查是否使用手动框选
function isUsingManual(characterId: string): boolean {
  return getCharacterConfig(characterId).useManual || false;
}

// ========== 任务 1: Canvas 合成图片 ==========

// 构建角色框选叠加层配置
const overlayConfigs = computed(() => {
  const configs: Array<{
    characterId: string;
    characterName: string;
    region: { x: number; y: number; width: number; height: number };
    isManual: boolean;
    color: string;
  }> = [];

  // 添加已配置的角色框选区域
  if (props.characterInfos) {
    props.characterInfos.forEach((character, idx) => {
      const region = getCharacterRegion(character.id);
      if (region) {
        configs.push({
          characterId: character.id,
          characterName: character.name,
          region,
          isManual: isUsingManual(character.id),
          color: getCharacterColor(idx),
        });
      }
    });
  }

  // 添加检测到的主体（如果有）
  if (props.detectedSubjects && props.detectedSubjects.length > 0) {
    props.detectedSubjects.forEach((subject) => {
      // 检查是否已经有角色使用了这个主体
      const isUsed = configs.some(
        (c) =>
          !c.isManual &&
          c.region.x === subject.region.x &&
          c.region.y === subject.region.y
      );
      if (!isUsed) {
        configs.push({
          characterId: `subject-${subject.index}`,
          characterName: `主体 ${subject.index}`,
          region: subject.region,
          isManual: false,
          color: "#18a058",
        });
      }
    });
  }

  return configs;
});

// 主图 URL（用于合成）
const mainImageUrlRef = computed(() => storyboardMainImage.value?.url);

// 使用 useImageOverlay 合成图片
const { composedImageUrl, isComposing } = useImageOverlay({
  imageUrl: mainImageUrlRef,
  overlays: overlayConfigs,
});

// ========== 对口型模式视频相关计算属性 ==========

// 获取已完成的 shot 视频 URL 列表（用于 MSE 播放器）
const shotVideoUrls = computed(() => {
  if (!isLipSyncMode.value || !props.data.shots) return [];
  return props.data.shots
    .filter((shot) => shot.status === "completed" && shot.videoUrl)
    .map((shot) => shot.videoUrl!);
});

// ========== 视频拼接相关 ==========

// 拼接后的视频 URL
const concatenatedVideoUrl = ref<string | null>(null);
const isConcatenating = ref(false);
const concatProgress = ref(0);
const concatStage = ref("");
const concatError = ref<string | null>(null);

// useVideoConcat
const {
  concatVideos,
} = useVideoConcat({
  onProgress: (progress) => {
    concatProgress.value = progress.percentage;
    concatStage.value = progress.stage;
    if (progress.error) {
      concatError.value = progress.error;
    }
  },
  onComplete: (blob) => {
    concatenatedVideoUrl.value = URL.createObjectURL(blob);
    isConcatenating.value = false;
  },
  onError: (error) => {
    concatError.value = error.message;
    isConcatenating.value = false;
  },
});

// 构建 VideoClip 列表
function buildVideoClips(): VideoClip[] {
  if (!props.data.shots) return [];
  return props.data.shots
    .filter((shot) => shot.videoUrl && shot.status === "completed")
    .map((shot, index) => ({
      id: shot.id,
      url: shot.videoUrl!,
      // Shot 类型已简化，duration 使用固定值
      duration: 3,
      order: index,
    }));
}

// 下载拼接后的视频（用于下载功能，需要先用 FFmpeg 拼接）
// @ts-expect-error 未来功能预留，暂未在 UI 中使用
async function handleDownloadConcatVideo() {
  // 如果已经有拼接的视频，直接下载
  if (concatenatedVideoUrl.value) {
    const a = document.createElement("a");
    a.href = concatenatedVideoUrl.value;
    a.download = `shotgroup_${props.shotGroupId}_preview.mp4`;
    a.click();
    return;
  }

  // 否则先拼接然后下载
  if (isConcatenating.value) return;

  const clips = buildVideoClips();
  if (clips.length === 0) {
    concatError.value = "没有可拼接的视频片段";
    return;
  }

  isConcatenating.value = true;
  concatError.value = null;

  try {
    const blob = await concatVideos(clips, {
      format: "mp4",
      useCache: true,
    });

    if (blob) {
      concatenatedVideoUrl.value = URL.createObjectURL(blob);
      // 立即下载
      const a = document.createElement("a");
      a.href = concatenatedVideoUrl.value;
      a.download = `shotgroup_${props.shotGroupId}_preview.mp4`;
      a.click();
    }
    isConcatenating.value = false;
  } catch (error) {
    concatError.value = (error as Error).message;
    isConcatenating.value = false;
  }
}

// 注意：使用 MSE 播放器后，预览不需要自动拼接
// 自动拼接的 watch 已移除，下载时才需要拼接

// 清理 blob URL
watch(concatenatedVideoUrl, (_newUrl, oldUrl) => {
  if (oldUrl) {
    URL.revokeObjectURL(oldUrl);
  }
});
</script>

<template>
  <div class="left-section">
    <!-- 多参考生视频模式：只显示视频区块 -->
    <template v-if="referenceMode === 'multi_reference'">
      <!-- 视频区块 -->
      <div class="media-block video-block">
        <div class="media-block-label">
          分镜组视频预览
        </div>
        <!-- 视频占位容器 -->
        <div
          class="video-placeholder"
          :style="{ aspectRatio: aspectRatio }"
        >
          <!-- video_only / audio_reference 模式：显示分镜组级别视频 -->
          <video
            v-if="!isLipSyncMode && (data.video?.url || data.videoGeneration?.videoUrl)"
            ref="videoRef"
            :src="data.video?.url || data.videoGeneration?.videoUrl"
            controls
            controlslist="nodownload noremoteplayback"
            class="video-preview"
            @play="handleVideoPlay"
            @pause="handleVideoPause"
            @timeupdate="handleVideoTimeUpdate"
            @seeked="handleVideoSeeked"
            @ended="handleVideoEnded"
          />
          <!-- 隐藏的旁白音频元素（video_only 模式下同步播放） -->
          <audio
            v-if="shouldPlayVoiceover && voiceoverAudioUrl"
            ref="audioRef"
            :src="voiceoverAudioUrl"
            preload="auto"
            style="display: none"
          />
          <!-- 视频生成失败状态（检查新旧字段） -->
          <div
            v-else-if="(data.video?.status === 'failed') || (data.videoGeneration?.status === 'failed')"
            class="video-error-overlay"
          >
            <div class="video-error-content">
              <span class="video-error-text">视频生成失败</span>
              <n-button
                type="error"
                size="small"
                ghost
                :disabled="isReadonly || loading || videoGenerating"
                :loading="videoGenerating"
                @click="handleGenerateVideo"
              >
                <template #icon>
                  <n-icon><Videocam /></n-icon>
                </template>
                重试
              </n-button>
            </div>
          </div>
          <div
            v-else
            class="video-empty"
          >
            <!-- 占位提示 -->
            <span style="font-size: 12px; color: #888">暂无分镜视频</span>
          </div>
        </div>
        <!-- 视频参考图 -->
        <div
          v-if="maxVideoRefImages > 0"
          class="reference-section"
        >
          <div class="reference-list">
            <n-image-group>
              <div
                v-for="refImg in storyboardVideoReferenceImages"
                :key="refImg.id"
                class="reference-item"
                @mouseenter="hoveredVideoReferenceId = refImg.id"
                @mouseleave="hoveredVideoReferenceId = null"
              >
                <n-image
                  :src="refImg.thumbnailUrl || refImg.url"
                  :preview-src="refImg.url"
                  alt="视频参考图"
                  class="reference-image"
                  object-fit="cover"
                />
                <div
                  v-if="hoveredVideoReferenceId === refImg.id && !isReadonly"
                  class="reference-hover-actions"
                >
                  <n-button
                    size="tiny"
                    circle
                    type="error"
                    @click="handleDeleteVideoReference(refImg.id)"
                  >
                    <template #icon>
                      <n-icon><CloseOutline /></n-icon>
                    </template>
                  </n-button>
                </div>
              </div>
            </n-image-group>
            <n-upload
              v-if="
                storyboardVideoReferenceImages.length < maxVideoRefImages &&
                  !isReadonly
              "
              accept="image/*"
              :max="maxVideoRefImages - storyboardVideoReferenceImages.length"
              :file-list="refVideoUploadFileList"
              :show-file-list="false"
              :custom-request="() => {}"
              @change="handleVideoReferenceUpload"
            >
              <div class="reference-upload-btn">
                <n-icon size="18">
                  <CloudUpload />
                </n-icon>
              </div>
            </n-upload>
          </div>
        </div>
        <!-- 生成/重新生成视频按钮 -->
        <n-tooltip
          v-if="!isReadonly"
          :disabled="canGenerateVideo && !durationExceedsMax"
        >
          <template #trigger>
            <n-button
              type="default"
              size="small"
              block
              style="margin-top: 6px"
              :disabled="loading || videoGenerating || !canGenerateVideo || durationExceedsMax"
              :loading="videoGenerating"
              @click="handleGenerateVideo"
            >
              <template #icon>
                <n-icon><Videocam /></n-icon>
              </template>
              {{
                videoGenerating
                  ? videoGenerationProgress
                    ? `生成中 ${videoGenerationProgress}%`
                    : "生成中..."
                  : (data.video?.url || data.videoGeneration?.videoUrl)
                    ? "重新生成视频"
                    : "生成视频"
              }}
            </n-button>
          </template>
          <template v-if="durationExceedsMax">
            {{ durationExceedsMaxReason }}
          </template>
          <template v-else-if="missingAssetImages && missingAssetImages.length > 0">
            {{ missingAssetImages.join('、') }}尚未生成图片，无法作为视频参考
          </template>
          <template v-else-if="voiceoverAudioUnavailableReason">
            {{ voiceoverAudioUnavailableReason }}
          </template>
          <template v-else-if="multiReferenceVideoUnavailableReason">
            {{ multiReferenceVideoUnavailableReason }}
          </template>
          <template v-else>
            当前视频模型不支持「多参考生视频」模式，请选择支持多参考的视频模型或切换为「分镜图生视频」模式
          </template>
        </n-tooltip>
        <span
          v-if="videoGenerating && videoGenerationProgress && isReadonly"
          class="progress-text"
        >
          {{ videoGenerationProgress }}%
        </span>
      </div>
    </template>

    <!-- 分镜图生视频模式：图片区块 + 视频区块各自独立 -->
    <template v-else>
      <!-- 分镜图区块 + 角色框选面板（横向排列） -->
      <div class="image-section-row">
        <!-- 分镜图区块 -->
        <div class="media-block image-block">
        <div class="media-block-label">
          分镜组参考图
        </div>
        <div
          class="image-area"
          :style="{ aspectRatio: aspectRatio }"
        >
          <div
            v-if="storyboardMainImage"
            class="image-preview"
          >
            <!-- 任务 1: 使用 Canvas 合成后的图片，支持 n-image 自带预览 -->
            <n-image
              :src="composedImageUrl || storyboardMainImage.url"
              :preview-src="composedImageUrl || storyboardMainImage.url"
              :alt="`分镜${index + 1}图片`"
              object-fit="cover"
              class="generated-img"
            />

            <!-- 检测到的主体框选区域（对口型模式下且面板打开时显示） -->
            <template v-if="isLipSyncMode && showRegionPanel">
              <RegionOverlay
                v-for="subject in detectedSubjects"
                :key="subject.index"
                :region="subject.region"
                :is-manual="false"
                :label="`主体 ${subject.index}`"
                :show-label="true"
              />
              <!-- 已配置的角色框选区域 -->
              <template v-for="(character, idx) in characterInfos" :key="character.id">
                <RegionOverlay
                  v-if="getCharacterRegion(character.id)"
                  :region="getCharacterRegion(character.id)!"
                  :is-manual="isUsingManual(character.id)"
                  :label="character.name"
                  :show-label="true"
                  :color="getCharacterColor(idx)"
                />
              </template>
            </template>

            <!-- 合成中状态提示 -->
            <div
              v-if="isComposing"
              class="composing-overlay"
            >
              <n-spin size="small" />
            </div>

            <!-- 检测中遮罩 -->
            <div
              v-if="showRegionPanel && isDetecting"
              class="detecting-overlay"
            >
              <n-spin size="medium" />
              <span>正在检测主体...</span>
            </div>

            <!-- 右下角按钮组：上传主图 + 角色框选 -->
            <div
              v-if="!isReadonly"
              class="image-actions-wrapper"
            >
              <!-- 角色框选按钮（对口型模式下显示） -->
              <n-tooltip
                v-if="isLipSyncMode"
                placement="top"
                :delay="300"
              >
                <template #trigger>
                  <n-button
                    size="small"
                    circle
                    class="region-select-btn"
                    :disabled="loading"
                    :type="showRegionPanel ? 'primary' : 'default'"
                    @click="toggleRegionPanel"
                  >
                    <n-icon size="14">
                      <ScanOutline />
                    </n-icon>
                  </n-button>
                </template>
                {{ showRegionPanel ? '关闭框选' : '角色框选' }}
              </n-tooltip>
              <!-- 上传主图按钮 -->
              <n-tooltip
                placement="top"
                :delay="300"
              >
                <template #trigger>
                  <n-upload
                    accept="image/*"
                    :max="1"
                    :file-list="mainImageUploadFileList"
                    :show-file-list="false"
                    :custom-request="() => {}"
                    class="upload-btn-wrapper"
                    @change="handleMainImageUpload"
                  >
                    <div class="upload-btn">
                      <n-icon size="14">
                        <CloudUpload />
                      </n-icon>
                    </div>
                  </n-upload>
                </template>
                上传分镜图
              </n-tooltip>
            </div>
          </div>
          <div
            v-else-if="imageGenerating"
            class="image-generating"
          >
            <div class="generating-text">
              <n-icon
                size="20"
                color="#2080f0"
              >
                <Sparkles />
              </n-icon>
              <span>生成中 {{ imageGenerationProgress }}%</span>
            </div>
          </div>
          <div
            v-else
            class="image-upload"
          >
            <!-- 占位提示 -->
            <span style="font-size: 12px; color: #888">暂无分镜组参考图</span>
            <!-- 无图片时显示上传按钮和角色框选按钮 -->
            <div class="upload-actions">
              <!-- 角色框选按钮（对口型模式下始终显示） -->
              <n-tooltip
                v-if="isLipSyncMode"
                placement="top"
                :delay="300"
              >
                <template #trigger>
                  <n-button
                    size="small"
                    circle
                    class="region-select-btn-upload"
                    :disabled="loading || !storyboardMainImage"
                    :type="showRegionPanel ? 'primary' : 'default'"
                    @click="toggleRegionPanel"
                  >
                    <n-icon size="14">
                      <ScanOutline />
                    </n-icon>
                  </n-button>
                </template>
                <template v-if="!storyboardMainImage">
                  请先生成分镜图
                </template>
                <template v-else>
                  {{ showRegionPanel ? '关闭框选' : '角色框选' }}
                </template>
              </n-tooltip>
              <!-- 上传按钮 -->
              <n-tooltip
                placement="top"
                :delay="300"
              >
                <template #trigger>
                  <n-upload
                    accept="image/*"
                    :max="1"
                    :file-list="mainImageUploadFileList"
                    :show-file-list="false"
                    :custom-request="() => {}"
                    class="main-upload-btn-wrapper"
                    @change="handleMainImageUpload"
                  >
                    <div class="main-upload-btn">
                      <n-icon size="14">
                        <CloudUploadOutline />
                      </n-icon>
                    </div>
                  </n-upload>
                </template>
                上传分镜图
              </n-tooltip>
            </div>
          </div>
        </div>
        <!-- 图片参考图 -->
        <div
          v-if="maxImageRefImages > 0"
          class="reference-section"
        >
          <div class="reference-list">
            <n-image-group>
              <div
                v-for="refImg in storyboardReferenceImages"
                :key="refImg.id"
                class="reference-item"
                @mouseenter="hoveredReferenceId = refImg.id"
                @mouseleave="hoveredReferenceId = null"
              >
                <n-image
                  :src="refImg.thumbnailUrl || refImg.url"
                  :preview-src="refImg.url"
                  alt="参考图"
                  class="reference-image"
                  object-fit="cover"
                />
                <div
                  v-if="hoveredReferenceId === refImg.id && !isReadonly"
                  class="reference-hover-actions"
                >
                  <n-button
                    size="tiny"
                    circle
                    type="error"
                    @click="handleDeleteReference(refImg.id)"
                  >
                    <template #icon>
                      <n-icon><CloseOutline /></n-icon>
                    </template>
                  </n-button>
                </div>
              </div>
            </n-image-group>
            <n-upload
              v-if="
                storyboardReferenceImages.length < maxImageRefImages &&
                  !isReadonly
              "
              accept="image/*"
              :max="maxImageRefImages - storyboardReferenceImages.length"
              :file-list="refImageUploadFileList"
              :show-file-list="false"
              :custom-request="() => {}"
              @change="handleReferenceUpload"
            >
              <div class="reference-upload-btn">
                <n-icon size="18">
                  <CloudUpload />
                </n-icon>
              </div>
            </n-upload>
          </div>
        </div>
        <div
          v-else-if="!isReadonly"
          class="no-ref-hint"
        >
          <n-tooltip>
            <template #trigger>
              <span>该模型不支持参考图</span>
            </template>
            当前选择的图片生成模型不支持使用参考图
          </n-tooltip>
        </div>
        <div
          v-if="imageGenerationError"
          class="image-error-tip"
        >
          {{ imageGenerationError }}
        </div>

        <!-- 生成/重新生成按钮（移到卡片底部） -->
        <!-- Bug 修复：在 single_reference 模式下，检查出镜资源图片是否存在 -->
        <!-- Bug 修复：v-if 移到外层 n-tooltip，避免 slot[trigger] 空内容错误 -->
        <n-tooltip
          v-if="!isReadonly"
          :disabled="canGenerateImage"
        >
          <template #trigger>
            <n-button
              type="default"
              size="small"
              block
              style="margin-top: 6px"
              :disabled="
                loading ||
                  imageGenerating ||
                  !canGenerateImage ||
                  !!singleReferenceVideoUnavailableReason
              "
              :loading="imageGenerating"
              @click="handleGenerateImage"
            >
              <template #icon>
                <n-icon><Sparkles /></n-icon>
              </template>
              {{
                imageGenerating
                  ? `生成中 ${imageGenerationProgress}%`
                  : storyboardMainImage
                    ? "重新生成图片"
                    : "生成图片"
              }}
            </n-button>
          </template>
          <template v-if="missingAssetImages && missingAssetImages.length > 0">
            {{ missingAssetImages.join('、') }}尚未生成图片，请先生成素材图片
          </template>
          <template v-else-if="!selectedImageModel">
            请先在下方模型选择中选择图像生成模型
          </template>
          <template v-else-if="!canGenerateImage">
            当前模型不支持参考图，请切换到支持参考图的模型
          </template>
        </n-tooltip>
      </div>

      <!-- 内联角色框选面板（放在 image-block 右侧） -->
      <inline-character-region-panel
        v-if="isLipSyncMode && showRegionPanel && !!shotGroupId"
        :show="true"
        :shot-group-id="shotGroupId"
        :characters="characterInfos || []"
        :detected-subjects="detectedSubjects"
        :character-regions="characterRegions || {}"
        :detection-status="detectionStatus"
        :is-detecting="isDetecting"
        :is-readonly="isReadonly"
        :main-image-exists="!!storyboardMainImage"
        @close="handleCloseRegionPanel"
        @trigger-detection="handleTriggerDetection"
        @update-region="handleUpdateRegion"
        @open-manual-select="handleOpenManualSelect"
      />
      </div>

      <!-- 视频区块 -->
      <div class="media-block video-block">
        <div class="media-block-label">
          分镜组视频预览
        </div>
        <!-- 视频占位容器 -->
        <div
          class="video-placeholder"
          :style="{ aspectRatio: aspectRatio }"
        >
          <!-- 非对口型模式：显示分镜组级别视频（优先使用新字段 shotGroup.video） -->
          <video
            v-if="!isLipSyncMode && (data.video?.url || data.videoGeneration?.videoUrl)"
            ref="videoRef"
            :src="data.video?.url || data.videoGeneration?.videoUrl"
            controls
            controlslist="nodownload noremoteplayback"
            class="video-preview"
            @play="handleVideoPlay"
            @pause="handleVideoPause"
            @timeupdate="handleVideoTimeUpdate"
            @seeked="handleVideoSeeked"
            @ended="handleVideoEnded"
          />
          <!-- 隐藏的旁白音频元素（video_only 模式下同步播放） -->
          <audio
            v-if="shouldPlayVoiceover && voiceoverAudioUrl"
            ref="audioRef"
            :src="voiceoverAudioUrl"
            preload="auto"
            style="display: none"
          />
          <!-- 对口型模式：使用 MSE 播放器无缝播放多个视频片段 -->
          <MseVideoPlayer
            v-else-if="isLipSyncMode && shotVideoUrls.length >= 1"
            :video-urls="shotVideoUrls"
            :aspect-ratio="aspectRatio"
            :controls="true"
            :muted="false"
          />
          <!-- 视频生成失败状态（检查新旧字段） -->
          <div
            v-else-if="(data.video?.status === 'failed') || (data.videoGeneration?.status === 'failed')"
            class="video-error-overlay"
          >
            <!-- 对口型模式：只显示失败提示，不显示重试按钮 -->
            <template v-if="isLipSyncMode">
              <span class="video-error-text">视频生成失败，请在对话列表中重新生成</span>
            </template>
            <template v-else>
              <div class="video-error-content">
                <span class="video-error-text">视频生成失败</span>
                <n-button
                  type="error"
                  size="small"
                  ghost
                  :disabled="isReadonly || loading || videoGenerating"
                  :loading="videoGenerating"
                  @click="handleGenerateVideo"
                >
                  <template #icon>
                    <n-icon><Videocam /></n-icon>
                  </template>
                  重试
                </n-button>
              </div>
            </template>
          </div>
          <!-- 对口型模式：对话视频生成中 -->
          <div
            v-else-if="isLipSyncMode && data.shots?.some(shot => shot.status === 'processing')"
            class="video-empty"
          >
            <span style="font-size: 12px; color: #2080f0">对话视频生成中...</span>
          </div>
          <!-- 对口型模式：无对话视频 -->
          <div
            v-else-if="isLipSyncMode"
            class="video-empty"
          >
            <span style="font-size: 12px; color: #888">请先在对话列表中生成对口型视频</span>
          </div>
          <!-- 非对口型模式：无分镜视频 -->
          <div
            v-else
            class="video-empty"
          >
            <!-- 占位提示 -->
            <span style="font-size: 12px; color: #888">暂无分镜视频</span>
          </div>
        </div>
        <!-- 视频参考图（对口型模式下隐藏） -->
        <div
          v-if="maxVideoRefImages > 0 && !isLipSyncMode"
          class="reference-section"
        >
          <div class="reference-list">
            <n-image-group>
              <div
                v-for="refImg in storyboardVideoReferenceImages"
                :key="refImg.id"
                class="reference-item"
                @mouseenter="hoveredVideoReferenceId = refImg.id"
                @mouseleave="hoveredVideoReferenceId = null"
              >
                <n-image
                  :src="refImg.thumbnailUrl || refImg.url"
                  :preview-src="refImg.url"
                  alt="视频参考图"
                  class="reference-image"
                  object-fit="cover"
                />
                <div
                  v-if="hoveredVideoReferenceId === refImg.id && !isReadonly"
                  class="reference-hover-actions"
                >
                  <n-button
                    size="tiny"
                    circle
                    type="error"
                    @click="handleDeleteVideoReference(refImg.id)"
                  >
                    <template #icon>
                      <n-icon><CloseOutline /></n-icon>
                    </template>
                  </n-button>
                </div>
              </div>
            </n-image-group>
            <n-upload
              v-if="
                storyboardVideoReferenceImages.length < maxVideoRefImages &&
                  !isReadonly
              "
              accept="image/*"
              :max="maxVideoRefImages - storyboardVideoReferenceImages.length"
              :file-list="refVideoUploadFileList"
              :show-file-list="false"
              :custom-request="() => {}"
              @change="handleVideoReferenceUpload"
            >
              <div class="reference-upload-btn">
                <n-icon size="18">
                  <CloudUpload />
                </n-icon>
              </div>
            </n-upload>
          </div>
        </div>
        <!-- 生成/重新生成视频按钮（对口型模式下隐藏） -->
        <!-- 分镜图生视频模式：需要先有分镜图才能生成视频 -->
        <n-tooltip
          v-if="!isReadonly && !isLipSyncMode"
          :disabled="!!storyboardMainImage && canGenerateVideo && !durationExceedsMax"
        >
          <template #trigger>
            <n-button
              type="default"
              size="small"
              block
              style="margin-top: 6px"
              :disabled="
                loading ||
                  videoGenerating ||
                  !storyboardMainImage ||
                  !canGenerateVideo ||
                  durationExceedsMax
              "
              :loading="videoGenerating"
              @click="handleGenerateVideo"
            >
              <template #icon>
                <n-icon><Videocam /></n-icon>
              </template>
              {{
                videoGenerating
                  ? videoGenerationProgress
                    ? `生成中 ${videoGenerationProgress}%`
                    : "生成中..."
                  : (data.video?.url || data.videoGeneration?.videoUrl)
                    ? "重新生成视频"
                    : "生成视频"
              }}
            </n-button>
          </template>
          <template v-if="!storyboardMainImage">
            请先生成分镜图片，再生成视频
          </template>
          <template v-else-if="durationExceedsMax">
            {{ durationExceedsMaxReason }}
          </template>
          <template v-else-if="missingAssetImages && missingAssetImages.length > 0">
            {{ missingAssetImages.join('、') }}尚未生成图片，无法生成视频
          </template>
          <template v-else-if="singleReferenceVideoUnavailableReason">
            {{ singleReferenceVideoUnavailableReason }}
          </template>
          <template v-else-if="voiceoverAudioUnavailableReason">
            {{ voiceoverAudioUnavailableReason }}
          </template>
          <template v-else-if="!canGenerateVideo">
            当前配置不支持视频生成，请检查音频参考或多参考模式设置
          </template>
        </n-tooltip>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.left-section {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

// 分镜图区块 + 角色框选面板横向排列容器
.image-section-row {
  display: flex;
  flex-direction: row;
  gap: 8px;
  align-items: flex-start;
}

// 分镜图/视频区块容器
.media-block {
  border: 1px solid #f0f0f0;
  border-radius: 10px;
  padding: 10px;
  background: #fafafa;
  display: flex;
  flex-direction: column;
  gap: 8px;

  &.image-block {
    border-color: #e8f4ff;
    background: #f8fbff;
    // 固定宽度，防止被角色框选面板压缩
    flex-shrink: 0;
    width: 280px;
  }

  &.video-block {
    border-color: #f0e8ff;
    background: #fdf8ff;
  }
}

.media-block-label {
  font-size: 11px;
  font-weight: 600;
  color: #888;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.no-ref-hint {
  font-size: 11px;
  color: #bbb;
  text-align: center;
  padding: 4px 0;
}

.image-area {
  position: relative;
  // aspect-ratio 由内联 style 动态注入（根据剧本分辨率）
  border-radius: 8px;
  overflow: hidden;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);

  // 生成的图片占满容器
  :deep(.generated-img) {
    width: 100%;
    height: 100%;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }
}

// 参考图区域（与 AssetCard.vue 保持一致的样式）
.reference-section {
  .reference-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: flex-start;
  }

  .reference-item {
    position: relative;
    width: 48px;
    height: 48px;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #f0f0f0;
    flex-shrink: 0;

    :deep(.reference-image) {
      display: block;
      width: 100%;
      height: 100%;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }
  }

  .reference-hover-actions {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .reference-upload-btn {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    border: 2px dashed #e0e0e0;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    color: #ccc;
    background: #fafafa;
    transition: all 0.2s;

    &:hover {
      border-color: #2080f0;
      color: #2080f0;
      background: #e6f4ff;
    }
  }
}

.image-preview {
  position: relative;
  width: 100%;
  height: 100%;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .remove-image {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 28px;
    height: 28px;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }
}

.image-upload {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;

  .upload-btn {
    flex-direction: column;
    height: auto;
    padding: 16px;
    gap: 8px;
    border-radius: 12px;

    span {
      font-size: 12px;
      color: #999;
    }
  }

  .gen-image-btn {
    font-size: 12px;
  }

  .upload-icon-btn {
    opacity: 0.5;
    transition: opacity 0.2s;

    &:hover {
      opacity: 1;
    }
  }

  // 主图右下角按钮组
  .upload-actions {
    position: absolute;
    bottom: 8px;
    right: 8px;
    z-index: 3;
    display: flex;
    gap: 4px;
  }

  .main-upload-btn-wrapper {
    width: auto;

    :deep(.n-upload-trigger) {
      display: block;
    }
  }

  .main-upload-btn {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #555;
    cursor: pointer;
    transition: background 0.2s;
    backdrop-filter: blur(4px);

    &:hover {
      background: rgba(255, 255, 255, 0.95);
      color: #2080f0;
    }
  }

  .region-select-btn-upload {
    width: 28px;
    height: 28px;
    padding: 0;
    background: rgba(255, 255, 255, 0.75);
    backdrop-filter: blur(4px);
    border: 1px solid rgba(0, 0, 0, 0.1);

    &:hover:not(:disabled) {
      background: #fff;
      border-color: #2080f0;
    }
  }
}

.image-generating {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #e6f4ff 0%, #f0f5ff 100%);

  .generating-text {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #2080f0;
  }
}

// 右下角按钮组（上传按钮 + 角色框选按钮）
.image-actions-wrapper {
  position: absolute;
  bottom: 6px;
  right: 6px;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 6px;

  .region-select-btn {
    width: 28px;
    height: 28px;
    padding: 0;
    background: rgba(255, 255, 255, 0.9);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);

    &:hover:not(:disabled) {
      background: rgba(255, 255, 255, 1);
      color: #2080f0;
    }
  }

  .upload-btn-wrapper {
    width: auto;

    :deep(.n-upload-trigger) {
      display: block;
    }
  }

  .upload-btn {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #555;
    cursor: pointer;
    transition: background 0.2s;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);

    &:hover {
      background: rgba(255, 255, 255, 1);
      color: #2080f0;
    }
  }
}

.image-error-tip {
  font-size: 11px;
  color: #d03050;
  text-align: center;
  padding: 2px 4px;
  line-height: 1.4;
}

.video-placeholder {
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  background: linear-gradient(135deg, #f0e8ff 0%, #ede0ff 100%);
  display: flex;
  align-items: center;
  justify-content: center;

  .video-generating {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #2080f0;
  }

  .video-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  .video-error-overlay {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background: rgba(255, 77, 79, 0.08);

    .video-error-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;

      .video-error-text {
        font-size: 12px;
        color: #d03050;
        font-weight: 500;
      }
    }
  }
}

.video-preview-wrap {
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 6px;
  background: #000;
}

.video-preview {
  width: 100%;
  height: 100%;
  display: block;
  border-radius: 8px;
  background: #000;
}

.progress-text {
  font-size: 12px;
  color: #2080f0;
  font-weight: 500;
  margin-top: 4px;
}

// 检测中遮罩
// 合成中遮罩
.composing-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.5);
  z-index: 15;
}

// 检测中遮罩
.detecting-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  font-size: 14px;
  z-index: 20;
}

// 视频拼接进度
.video-concat-progress {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px;
  width: 100%;
}

.concat-stage {
  font-size: 11px;
  color: #2080f0;
}

// 视频拼接操作按钮
.video-concat-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 6px;
}

// 下载时的小型进度条
.concat-progress-mini {
  width: 100%;
  padding: 4px 0;
}

</style>
