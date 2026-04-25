<script setup lang="ts">
import { computed, h, type VNode } from "vue";
import {
  NCard,
  NInput,
  NTooltip,
  NIcon,
  NSelect,
} from "naive-ui";
import { WarningOutline } from "@vicons/ionicons5";
import type { Shot, CharacterRegions, DetectedSubject, CharacterRegionConfig } from "@pixaura/shared-types";
import { useStoryboardCard } from "../composables/useStoryboardCard";
import type { ModelOptionWithPrice } from "@/stores/script-models";
import CardHeader from "./storyboard/CardHeader.vue";
import MediaBlock from "./storyboard/MediaBlock.vue";
import DialogueSection from "./storyboard/DialogueSection.vue";
import ModelSelectors from "./storyboard/ModelSelectors.vue";
import type {
  StoryboardMode,
  DialogueItem,
  TTSVoice,
  StoryboardRef,
} from "./storyboard/types";

// Props
interface Props {
  data: StoryboardRef;
  index: number;
  loading?: boolean;
  characterOptions?: { label: string; value: string; avatar?: string }[];
  sceneOptions?: { label: string; value: string }[];
  propOptions?: { label: string; value: string }[];
  // 模型选择相关
  imageModelOptions?: ModelOptionWithPrice[];
  videoModelOptions?: ModelOptionWithPrice[];
  lipSyncModelOptions?: ModelOptionWithPrice[];
  // 步骤级别默认模型
  defaultImageModelId?: string;
  defaultVideoModelId?: string;
  defaultLipSyncModelId?: string;
  projectId?: string;
  scriptId?: string;
  // 图片生成状态
  imageGenerating?: boolean;
  imageGenerationProgress?: number;
  imageGenerationError?: string;
  // 对话 AI 生成状态
  dialogueGenerating?: boolean;
  // 容器宽高比
  aspectRatio?: string;
  // 最大参考图数量
  maxReferenceImages?: number;
  // 视频是否正在生成中
  videoGenerating?: boolean;
  // 视频生成进度 0-100
  videoGenerationProgress?: number;
  // 音频生成状态
  audioGenerating?: string | null;
  // TTS 音色列表
  voices?: TTSVoice[];
  voicesLoading?: boolean;
  // 角色音色映射（用于对话音色继承）
  characterVoiceMap?: Record<string, { voiceId?: string; voiceName?: string }>;
  // 旁白音色
  narrationVoiceId?: string;
  narrationVoiceName?: string;
  // === shotGroups 新增字段 ===
  // 子分镜列表（shotGroups 结构）
  shots?: Shot[];
  // 主体检测状态
  detectionStatus?: "pending" | "processing" | "completed" | "failed";
  detectionError?: string;
  // 角色框选配置（用于 ShotCard 显示 mask 预览图）
  characterRegions?: CharacterRegions;
  // 检测到的主体
  detectedSubjects?: DetectedSubject[];
  // 是否正在检测主体
  isDetecting?: boolean;
  // 分镜视频生成状态映射
  shotGeneratingMap?: Record<string, boolean>;
  // 分镜视频生成进度映射
  shotProgressMap?: Record<string, number>;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  characterOptions: () => [],
  sceneOptions: () => [],
  propOptions: () => [],
  imageModelOptions: () => [],
  videoModelOptions: () => [],
  lipSyncModelOptions: () => [],
  projectId: "",
  scriptId: "",
  imageGenerating: false,
  imageGenerationProgress: 0,
  imageGenerationError: "",
  dialogueGenerating: false,
  aspectRatio: "9/16",
  maxReferenceImages: 3,
  videoGenerating: false,
  videoGenerationProgress: 0,
  audioGenerating: null,
  voices: () => [],
  voicesLoading: false,
  characterVoiceMap: () => ({}),
  narrationVoiceId: undefined,
  narrationVoiceName: undefined,
  // shotGroups 新增默认值
  shots: () => [],
  detectionStatus: "pending",
  detectionError: undefined,
  characterRegions: () => ({}),
  detectedSubjects: () => [],
  isDetecting: false,
  shotGeneratingMap: () => ({}),
  shotProgressMap: () => ({}),
});

// Emits
const emit = defineEmits<{
  (e: "update", data: StoryboardRef): void;
  (e: "delete", id: string): void;
  (e: "duplicate", id: string): void;
  (e: "move", id: string, direction: "up" | "down"): void;
  (e: "modeChange", id: string, mode: StoryboardMode): void;
  (e: "generateDialogue", id: string): void;
  (e: "generateVideo", id: string): void;
  (e: "generateImage", id: string, modelId: string): void;
  (e: "dialogueUpdate", id: string, dialogues: DialogueItem[]): void;
  (e: "imageModelChange", id: string, modelId: string): void;
  (e: "videoModelChange", id: string, modelId: string): void;
  (e: "lipSyncModelChange", id: string, modelId: string): void;
  (e: "uploadReference", id: string, file: File): void;
  (e: "deleteReference", id: string, imageId: string): void;
  (e: "uploadVideoReference", id: string, file: File): void;
  (e: "deleteVideoReference", id: string, imageId: string): void;
  (e: "uploadMainImage", id: string, file: File): void;
  (e: "generateAudio", storyboardId: string, dialogueId: string): void;
  (e: "deleteAudio", storyboardId: string, dialogueId: string): void;
  // shotGroups 新增事件
  (e: "openRegionPanel", shotGroupId: string): void;
  // 视频生成事件（options 包含前端已处理的 URL）
  (e: "generateShotVideo", shotGroupId: string, shotId: string, characterId: string, options?: { croppedImageUrl?: string; audioUrl?: string }): void;
  // 重试视频生成事件
  (e: "retryShotVideo", shotGroupId: string, shotId: string, characterId: string): void;
  (e: "startDetection", shotGroupId: string): void;
  (e: "updateRegion", shotGroupId: string, characterId: string, config: CharacterRegionConfig): void;
  // Bug-2 修复：添加 shotGroupId 参数
  (e: "openManualSelect", shotGroupId: string, characterId: string): void;
}>();

// 使用 composable
const {
  // 状态
  mode,
  localDescription,
  dialogues,
  duration,
  isExpanded,
  referenceMode,
  videoMode,
  selectedImageModel,
  selectedVideoModel,
  selectedLipSyncModel,

  // 计算属性
  isReadonly,
  isQuickMode,
  hasImageModels,
  hasVideoModels,
  hasLipSyncModels,
  isLoadingModels,
  effectiveImageModelOptions,
  effectiveVideoModelOptions,
  effectiveLipSyncModelOptions,
  maxImageRefImages,
  maxVideoRefImages,
  maxVideoRefAudios,
  characterDialogueCount,
  durationOptions,
  canGenerateImage,
  isAudioDrivenAvailable,
  isMultiReferenceModeAvailable,
  multiReferenceUnavailableReason,
  missingAssetImages,
  singleReferenceVideoUnavailableReason,
  multiReferenceVideoUnavailableReason,
  voiceoverAudioUnavailableReason,
  canGenerateVideo,
  durationExceedsMax,
  durationExceedsMaxReason,
  hasOnlyVoiceover,
  hasOnlyCharacterDialogue,

  // 选项
  modeOptions,
  referenceModeOptions,
  videoModeOptions,

  // 方法
  handleModeChange,
  handleDescriptionBlur,
  handleCharacterUpdate,
  handleSceneUpdate,
  handlePropUpdate,
  handleDurationUpdate,
  handleReferenceModeUpdate,
  handleVideoModeUpdate,
  addDialogue,
  updateDialogueLocal,
  updateDialogue,
  flushDialogueUpdate,
  removeDialogue,
  moveDialogue,
  handleGenerateDialogue,
  handleGenerateVideo,
  handleGenerateImage,
  handleImageModelChange,
  handleVideoModelChange,
  handleLipSyncModelChange,
  handleReferenceUpload,
  handleDeleteReference,
  handleVideoReferenceUpload,
  handleDeleteVideoReference,
  handleMainImageUpload,
  handleGenerateAudio,
  handleDeleteAudio,
  handleGenerateShotVideo,
  handlePlayShotVideo,
  handleRetryShotVideo,
  handleUpdateDialogueRegion,
} = useStoryboardCard(props, emit);

// 动态计算视频模式选项，当音频参考不可用或对口型不支持时标记为 disabled
const computedVideoModeOptions = computed(() => {
  return videoModeOptions.map((option) => {
    // 音频参考模式：只在多参考模式下可用
    if (option.value === "audio_reference") {
      if (referenceMode.value !== "multi_reference") {
        return {
          ...option,
          disabled: true,
          tooltipMessage: "音频参考仅支持「多参考生视频」模式",
        };
      }
      if (!isAudioDrivenAvailable.value) {
        return {
          ...option,
          disabled: true,
          tooltipMessage: "当前视频模型不支持音频参考",
        };
      }
    }
    // 对口型模式：需要单参考模式 + 有对话 + 无旁白
    if (option.value === "lip_sync") {
      if (referenceMode.value !== "single_reference") {
        return {
          ...option,
          disabled: true,
          tooltipMessage: "对口型仅支持「分镜图生视频」模式",
        };
      }
      if (!hasOnlyCharacterDialogue.value) {
        return {
          ...option,
          disabled: true,
          tooltipMessage: "对口型模式要求对话列表中不包含旁白",
        };
      }
    }
    // 无对话模式：必须全是旁白或无对话
    if (option.value === "video_only" && !hasOnlyVoiceover.value) {
      return {
        ...option,
        disabled: true,
        tooltipMessage: "无对话模式要求对话列表中没有角色对话（全是旁白或无对话）",
      };
    }
    return option;
  });
});

// 自定义渲染视频模式选项，为 disabled 选项添加 tooltip
function renderVideoModeOption({ node, option }: { node: VNode; option: { label: string; value: string; disabled?: boolean; tooltipMessage?: string } }) {
  // 只对 disabled 选项添加 tooltip 包裹
  if (option.disabled && option.tooltipMessage) {
    return h(
      NTooltip,
      {
        placement: "right",
        trigger: "hover",
        style: { maxWidth: "280px" },
      },
      {
        trigger: () => node,
        default: () => option.tooltipMessage,
      }
    );
  }
  // 正常选项直接返回原始 node（保持 n-select 的点击事件）
  return node;
}

// 当前 videoMode 是否被禁用
const currentVideoModeDisabled = computed(() => {
  if (videoMode.value === "audio_reference") {
    if (referenceMode.value !== "multi_reference") return true;
    if (!isAudioDrivenAvailable.value) return true;
  }
  if (videoMode.value === "lip_sync") {
    if (referenceMode.value !== "single_reference") return true;
    if (!hasOnlyCharacterDialogue.value) return true;
  }
  if (videoMode.value === "video_only" && !hasOnlyVoiceover.value) {
    return true;
  }
  return false;
});

// 当前 videoMode 禁用时的提示信息
const currentVideoModeTooltipMessage = computed(() => {
  if (videoMode.value === "audio_reference") {
    if (referenceMode.value !== "multi_reference") {
      return "音频参考仅支持「多参考生视频」模式";
    }
    if (!isAudioDrivenAvailable.value) {
      return "当前视频模型不支持音频参考";
    }
  }
  if (videoMode.value === "lip_sync") {
    if (referenceMode.value !== "single_reference") {
      return "对口型仅支持「分镜图生视频」模式";
    }
    if (!hasOnlyCharacterDialogue.value) {
      return "对口型模式要求对话列表中不包含旁白";
    }
  }
  if (videoMode.value === "video_only" && !hasOnlyVoiceover.value) {
    return "无对话模式要求对话列表中没有角色对话（全是旁白或无对话）";
  }
  return "";
});

// 角色信息列表（只包含当前分镜组出镜的角色）
const characterInfos = computed(() => {
  const allCharacters = (props.characterOptions || []).map((opt) => ({
    id: opt.value,
    name: opt.label,
    avatarUrl: opt.avatar,
  }));

  // 根据出镜角色 ID 过滤
  const appearingIds = props.data.characterIds || [];
  if (appearingIds.length === 0) {
    return allCharacters;
  }

  return allCharacters.filter((char) => appearingIds.includes(char.id));
});

// ========== 对口型模式相关计算属性 ==========

// 是否为对口型模式
const isLipSyncMode = computed(() => {
  return referenceMode.value === "single_reference" && videoMode.value === "lip_sync";
});

// 角色框选配置（使用 props 中的值或 data 中的值）
const characterRegionsValue = computed(() => {
  return props.characterRegions || props.data.characterRegions || {};
});

// 检测到的主体
const detectedSubjectsValue = computed(() => {
  return props.detectedSubjects || props.data.detectedSubjects || [];
});

// 检测状态
const detectionStatusValue = computed(() => {
  return props.detectionStatus || props.data.detectionStatus || "pending";
});

// 分镜图主图 URL（用于角色框选预览）
const storyboardMainImageUrl = computed(() => {
  const images = props.data.images || [];
  const mainImage = images.find((img) => img.type === "main");
  return mainImage?.url || "";
});
</script>

<template>
  <n-card
    :class="[
      'storyboard-card',
      `mode-${mode}`,
      { 'is-collapsed': !isExpanded },
    ]"
    :bordered="false"
  >
    <!-- 头部区域 -->
    <CardHeader
      :data="data"
      :index="index"
      :is-expanded="isExpanded"
      :is-readonly="isReadonly"
      :loading="loading"
      :character-options="characterOptions"
      :scene-options="sceneOptions"
      @toggle-expand="isExpanded = !isExpanded"
      @delete="(id) => $emit('delete', id)"
      @duplicate="(id) => $emit('duplicate', id)"
      @move="(id, dir) => $emit('move', id, dir)"
    />

    <!-- 展开内容 -->
    <div
      v-if="isExpanded"
      class="card-body"
    >
      <!-- 左侧区域 -->
      <div class="left-area">
        <!-- 图片/视频区域 -->
        <MediaBlock
          :data="data"
          :index="index"
          :aspect-ratio="aspectRatio"
          :is-readonly="isReadonly"
          :loading="loading"
          :image-generating="imageGenerating"
          :image-generation-progress="imageGenerationProgress"
          :image-generation-error="imageGenerationError"
          :can-generate-image="canGenerateImage"
          :selected-image-model="selectedImageModel"
          :max-image-ref-images="maxImageRefImages"
          :video-generating="videoGenerating"
          :video-generation-progress="videoGenerationProgress"
          :max-video-ref-images="maxVideoRefImages"
          :reference-mode="referenceMode"
          :video-mode="videoMode"
          :can-generate-video="canGenerateVideo"
          :duration-exceeds-max="durationExceedsMax"
          :duration-exceeds-max-reason="durationExceedsMaxReason"
          :single-reference-video-unavailable-reason="
            singleReferenceVideoUnavailableReason
          "
          :multi-reference-video-unavailable-reason="
            multiReferenceVideoUnavailableReason
          "
          :voiceover-audio-unavailable-reason="
            voiceoverAudioUnavailableReason
          "
          :missing-asset-images="missingAssetImages"
          :shot-group-id="data.id"
          :character-infos="characterInfos"
          :detected-subjects="detectedSubjectsValue"
          :character-regions="characterRegionsValue"
          :detection-status="detectionStatusValue"
          :is-detecting="detectionStatusValue === 'processing'"
          @generate-image="handleGenerateImage"
          @generate-video="handleGenerateVideo"
          @upload-reference="handleReferenceUpload"
          @delete-reference="handleDeleteReference"
          @upload-video-reference="handleVideoReferenceUpload"
          @delete-video-reference="handleDeleteVideoReference"
          @upload-main-image="handleMainImageUpload"
          @trigger-detection="(id: string) => $emit('startDetection', id)"
          @update-region="(shotGroupId: string, charId: string, config: CharacterRegionConfig) => $emit('updateRegion', shotGroupId, charId, config)"
          @open-manual-select="(shotGroupId: string, charId: string) => $emit('openManualSelect', shotGroupId, charId)"
        />

        </div>

      <!-- 右侧：内容区域 -->
      <div class="right-section">
        <!-- 分镜描述 -->
        <div class="section">
          <label class="section-label">描述</label>
          <n-input
            v-model:value="localDescription"
            type="textarea"
            :rows="2"
            placeholder="描述这个分镜的画面内容..."
            aria-label="画面描述"
            :maxlength="2000"
            show-count
            :disabled="isReadonly || loading"
            @blur="handleDescriptionBlur"
          />
        </div>

        <!-- 资源引用 -->
        <div
          v-if="!isQuickMode"
          class="section resources-section"
        >
          <label class="section-label">出镜</label>
          <div class="resource-row">
            <n-select
              :value="data.characterIds"
              :options="characterOptions"
              placeholder="选择角色"
              aria-label="角色"
              multiple
              clearable
              size="small"
              :disabled="isReadonly || loading"
              :consistent-menu-width="false"
              :max-tag-count="2"
              @update:value="handleCharacterUpdate"
            />
            <n-select
              :value="data.sceneId"
              :options="sceneOptions"
              placeholder="选择场景"
              aria-label="场景"
              clearable
              size="small"
              :disabled="isReadonly || loading"
              :consistent-menu-width="false"
              label-field="label"
              value-field="value"
              @update:value="handleSceneUpdate"
            />
            <n-select
              :value="data.propIds"
              :options="propOptions"
              placeholder="选择道具"
              aria-label="道具"
              multiple
              clearable
              size="small"
              :disabled="isReadonly || loading"
              :consistent-menu-width="false"
              label-field="label"
              value-field="value"
              :max-tag-count="2"
              @update:value="handlePropUpdate"
            />
          </div>
        </div>

        <!-- 对话区 -->
        <DialogueSection
          v-if="!isQuickMode"
          :dialogues="dialogues"
          :is-readonly="isReadonly"
          :loading="loading"
          :dialogue-generating="dialogueGenerating"
          :character-options="characterOptions"
          :has-description="!!data.description"
          :audio-generating="audioGenerating"
          :script-id="scriptId"
          :storyboard-id="data.id"
          :voices="voices"
          :voices-loading="voicesLoading"
          :character-voice-map="characterVoiceMap"
          :narration-voice-id="narrationVoiceId"
          :narration-voice-name="narrationVoiceName"
          :is-lip-sync-mode="isLipSyncMode"
          :aspect-ratio="aspectRatio"
          :shot-group-id="data.id"
          :shots="shots"
          :character-regions="characterRegionsValue"
          :detected-subjects="detectedSubjectsValue"
          :storyboard-main-image-url="storyboardMainImageUrl"
          :project-id="projectId"
          :shot-generating-map="shotGeneratingMap"
          :shot-progress-map="shotProgressMap"
          :max-audio-refs="maxVideoRefAudios"
          :character-dialogue-count="characterDialogueCount"
          :is-audio-ref-mode="videoMode === 'audio_reference' && referenceMode === 'multi_reference'"
          @add-dialogue="addDialogue"
          @update-dialogue="updateDialogue"
          @update-dialogue-local="updateDialogueLocal"
          @flush-dialogue-update="flushDialogueUpdate"
          @remove-dialogue="removeDialogue"
          @move-dialogue="moveDialogue"
          @generate-dialogue="handleGenerateDialogue"
          @generate-audio="handleGenerateAudio"
          @delete-audio="handleDeleteAudio"
          @generate-shot-video="handleGenerateShotVideo"
          @play-shot-video="handlePlayShotVideo"
          @retry-shot-video="handleRetryShotVideo"
          @open-region-modal="(characterId) => $emit('openManualSelect', data.id, characterId)"
          @update-region="(shotGroupId: string, characterId: string, config: CharacterRegionConfig) => $emit('updateRegion', shotGroupId, characterId, config)"
          @update-dialogue-region="handleUpdateDialogueRegion"
        />

        <!-- 模型选择区域 -->
        <ModelSelectors
          :selected-image-model="selectedImageModel"
          :selected-video-model="selectedVideoModel"
          :selected-lip-sync-model="selectedLipSyncModel"
          :image-model-options="effectiveImageModelOptions"
          :video-model-options="effectiveVideoModelOptions"
          :lip-sync-model-options="effectiveLipSyncModelOptions"
          :has-image-models="hasImageModels"
          :has-video-models="hasVideoModels"
          :has-lip-sync-models="hasLipSyncModels"
          :is-loading-models="isLoadingModels"
          :image-generating="imageGenerating"
          :video-model-warning="
            !isMultiReferenceModeAvailable &&
              referenceMode === 'multi_reference'
          "
          @update:image-model="handleImageModelChange"
          @update:video-model="handleVideoModelChange"
          @update:lipsync-model="handleLipSyncModelChange"
        />

        <!-- 底部工具栏 -->
        <div class="section toolbar-section">
          <div class="toolbar-left">
            <n-select
              v-model:value="mode"
              :options="modeOptions"
              aria-label="分镜模式"
              size="small"
              style="min-width: 70px"
              :consistent-menu-width="false"
              :disabled="loading"
              @update:value="handleModeChange"
            />
            <div class="toolbar-divider" />
            <n-tooltip
              :disabled="
                isMultiReferenceModeAvailable ||
                  referenceMode !== 'multi_reference'
              "
            >
              <template #trigger>
                <div
                  class="reference-mode-wrapper"
                  :class="{
                    'mode-warning':
                      !isMultiReferenceModeAvailable &&
                      referenceMode === 'multi_reference',
                  }"
                >
                  <n-select
                    :value="referenceMode"
                    :options="referenceModeOptions"
                    aria-label="参考模式"
                    size="small"
                    style="min-width: 130px"
                    :consistent-menu-width="false"
                    :disabled="isReadonly || loading"
                    @update:value="handleReferenceModeUpdate"
                  />
                  <n-icon
                    v-if="
                      !isMultiReferenceModeAvailable &&
                        referenceMode === 'multi_reference'
                    "
                    class="mode-warning-icon"
                    color="#f0a020"
                    size="14"
                  >
                    <WarningOutline />
                  </n-icon>
                </div>
              </template>
              {{ multiReferenceUnavailableReason }}
            </n-tooltip>
            <n-tooltip
              :disabled="!currentVideoModeDisabled"
            >
              <template #trigger>
                <div
                  class="video-mode-wrapper"
                  :class="{
                    'mode-warning': currentVideoModeDisabled,
                  }"
                >
                  <n-select
                    :value="videoMode"
                    :options="computedVideoModeOptions"
                    :render-option="renderVideoModeOption"
                    aria-label="视频模式"
                    size="small"
                    style="min-width: 100px"
                    :consistent-menu-width="false"
                    :disabled="isReadonly || loading"
                    @update:value="handleVideoModeUpdate"
                  />
                  <n-icon
                    v-if="currentVideoModeDisabled"
                    class="mode-warning-icon"
                    color="#f0a020"
                    size="14"
                  >
                    <WarningOutline />
                  </n-icon>
                </div>
              </template>
              {{ currentVideoModeTooltipMessage }}
            </n-tooltip>
          </div>
          <div class="toolbar-right">
            <span class="duration-label">单次生成时长</span>
            <n-select
              :value="duration"
              :options="durationOptions"
              :disabled="isReadonly || loading"
              size="tiny"
              style="width: 80px"
              @update:value="handleDurationUpdate"
            />
            <span class="duration-unit">秒</span>
          </div>
        </div>
      </div>
    </div>
  </n-card>
</template>

<style scoped lang="scss">
.storyboard-card {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  transition: all 0.3s ease;
  overflow: hidden;

  &:hover {
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
  }

  &.mode-locked {
    background: #fafafa;
    opacity: 0.9;
  }

  &.mode-quick {
    border-left: 4px solid #f0a020;
  }

  :deep(.n-card__content) {
    padding: 0;
  }
}

// 卡片主体
.card-body {
  display: flex;
  gap: 20px;
  padding: 0 20px 20px;
}

// 左侧区域（包含 MediaBlock 和预览播放器）
.left-area {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.right-section {
  flex: 1;
  min-width: 0;
}

.section {
  margin-bottom: 16px;

  &:last-child {
    margin-bottom: 0;
  }
}

.section-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #666;
  margin-bottom: 8px;
}

.resources-section {
  .resource-row {
    display: flex;
    gap: 8px;

    :deep(.n-select) {
      flex: 1;
      min-width: 120px;
    }

    // 角色选择器允许更大空间，但限制最大宽度
    :deep(.n-select:first-child) {
      flex: 1.5;
      max-width: 40%;
    }
  }
}

.toolbar-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
  margin-top: 14px;
  border-top: 1px solid #f0f0f0;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.video-mode-wrapper {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px;
  border-radius: 6px;
  transition: all 0.2s ease;

  &.mode-warning {
    background: rgba(240, 160, 32, 0.1);
    border: 1px solid rgba(240, 160, 32, 0.4);

    :deep(.n-base-selection) {
      border-color: rgba(240, 160, 32, 0.6) !important;
    }
  }
}

.reference-mode-wrapper {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px;
  border-radius: 6px;
  transition: all 0.2s ease;

  &.mode-warning {
    background: rgba(240, 160, 32, 0.1);
    border: 1px solid rgba(240, 160, 32, 0.4);

    :deep(.n-base-selection) {
      border-color: rgba(240, 160, 32, 0.6) !important;
    }
  }
}

.mode-warning-icon {
  flex-shrink: 0;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.toolbar-divider {
  width: 1px;
  height: 20px;
  background: #e0e0e0;
  margin: 0 4px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.duration-label {
  font-size: 13px;
  color: #999;
}

.duration-unit {
  font-size: 13px;
  color: #999;
  margin-left: 4px;
}

// 资源引用区域 select 样式
.resources-section {
  :deep(.n-base-selection-label) {
    overflow: hidden;
  }

  :deep(.n-base-selection-tags) {
    flex-wrap: nowrap;
    overflow: hidden;
  }

  :deep(.n-tag) {
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

// 分镜列表区域（shotGroups 新增）
.shots-section {
  .section-label {
    margin-bottom: 12px;
  }
}

.shots-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

// 响应式适配
@media (max-width: 768px) {
  .card-body {
    flex-direction: column;
  }

  .left-section {
    width: 100%;
  }

  .resources-section {
    .resource-row {
      flex-direction: column;
    }
  }
}

// Bug-6: 角色选择带头像的样式
.select-option-with-avatar {
  display: flex;
  align-items: center;
  padding: 4px 0;
}

.select-avatar {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  margin-right: 6px;
  object-fit: cover;
}

.select-tag-with-avatar {
  display: flex;
  align-items: center;
  padding: 2px 4px;
}

.select-tag-avatar {
  width: 14px;
  height: 14px;
  border-radius: 2px;
  margin-right: 4px;
  object-fit: cover;
}

.select-tag-label {
  font-size: 12px;
}
</style>
