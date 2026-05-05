<script setup lang="ts">
import { ref, computed, h, watch } from "vue";
import {
  NCard,
  NInput,
  NInputGroup,
  NInputNumber,
  NButton,
  NIcon,
  NUpload,
  NDropdown,
  NSelect,
  NImage,
  NImageGroup,
  NTooltip,
  NPopover,
  useDialog,
  type UploadFileInfo,
} from "naive-ui";
import {
  Sparkles,
  EllipsisVertical,
  Pencil,
  ImageOutline,
  TrashOutline,
  CloudUploadOutline,
  CloseOutline,
  MusicalNotes,
} from "@vicons/ionicons5";
import type {
  CharacterRef,
  SceneRef,
  PropRef,
  AssetImage,
  CharacterDetailDto,
  SceneDetailDto,
  PropDetailDto,
} from "@pixaura/shared-types";
import VoiceSelector from "./storyboard/VoiceSelector.vue";
import type { TTSVoice } from "./storyboard/VoiceSelector.vue";
import { useScriptEditStore } from "../store/scriptEdit";

// 资产类型定义
type AssetType = "character" | "scene" | "prop";
type AssetData = CharacterRef | SceneRef | PropRef;
type ResolvedData = CharacterDetailDto | SceneDetailDto | PropDetailDto;

// 资产生成状态类型
export type AssetGenerationStatus =
  | "none"
  | "pending"
  | "generating"
  | "completed"
  | "failed";

// Props 定义
interface Props {
  type: AssetType;
  data: AssetData;
  loading?: boolean;
  images?: AssetImage[];
  mainImageId?: string;
  generating?: boolean;
  generationProgress?: number;
  generationStatus?: AssetGenerationStatus; // 生成状态
  // 资产状态（来自 CharacterRef/SceneRef/PropRef 的 assetStatus 字段）
  assetRefStatus?: "imported" | "will_create" | "none";
  // 图片生成错误信息
  error?: string;
  // 图片容器宽高比（1 表示 1:1，16/9 表示 16:9 等；只有 scene 类型会不为 1）
  imageAspectRatio?: number;
  // 允许的最大参考图数量，0 表示当前模型不支持参考图
  maxReferenceImages?: number;
  // TTS 音色相关（仅角色类型使用）
  voiceId?: string;
  voices?: TTSVoice[];
  voicesLoading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  images: () => [],
  generating: false,
  generationProgress: 0,
  generationStatus: "none",
  assetRefStatus: "none",
  error: "",
  imageAspectRatio: 1,
  maxReferenceImages: 3,
  voiceId: undefined,
  voices: () => [],
  voicesLoading: false,
});

// Store
const scriptEditStore = useScriptEditStore();
const dialog = useDialog();

// Emits 定义
const emit = defineEmits<{
  (e: "update", data: Partial<AssetData>): void;
  (e: "generate", id: string): void;
  (e: "delete", id: string): void;
  (e: "deleteImage", imageId: string): void;
  (e: "uploadReference", files: File[]): void;
  (e: "uploadMainImage", files: File[]): void;
  (e: "updateVoice", voiceId: string | undefined): void;
}>();

// 获取 resolvedAsset 数据（从素材库获取完整数据）
const resolvedAsset = computed<ResolvedData | undefined>(() => {
  if (props.type === "character") {
    const charRef = props.data as CharacterRef;
    if (charRef.characterId) {
      return scriptEditStore.getResolvedCharacterById(charRef.characterId);
    }
  } else if (props.type === "scene") {
    const sceneRef = props.data as SceneRef;
    if (sceneRef.sceneId) {
      return scriptEditStore.getResolvedSceneById(sceneRef.sceneId);
    }
  } else if (props.type === "prop") {
    const propRef = props.data as PropRef;
    if (propRef.propId) {
      return scriptEditStore.getResolvedPropById(propRef.propId);
    }
  }
  return undefined;
});

// 数据源：优先使用 resolvedAsset，回退到 ref 的兼容字段
const assetName = computed(() => {
  if (resolvedAsset.value) {
    return resolvedAsset.value.name || "";
  }
  // 回退到 ref 的向后兼容字段（Phase 4 后这些字段不再存在）
  return (props.data as { name?: string }).name || "";
});

const assetDescription = computed(() => {
  if (resolvedAsset.value) {
    return resolvedAsset.value.description || "";
  }
  // 回退到 ref 的向后兼容字段
  return (props.data as { description?: string }).description || "";
});

const assetGender = computed<string | null>(() => {
  if (props.type === "character" && resolvedAsset.value) {
    const char = resolvedAsset.value as CharacterDetailDto;
    return char.gender || null;
  }
  // 回退到 ref 的向后兼容字段（新解析的资产可能尚未进入 resolvedAssets）
  if (props.type === "character") {
    return (props.data as { gender?: string }).gender || null;
  }
  return null;
});

const assetAge = computed<string | null>(() => {
  if (props.type === "character" && resolvedAsset.value) {
    const char = resolvedAsset.value as CharacterDetailDto;
    return char.age || null;
  }
  // 回退到 ref 的向后兼容字段（新解析的资产可能尚未进入 resolvedAssets）
  if (props.type === "character") {
    return (props.data as { age?: string }).age || null;
  }
  return null;
});

// 解析年龄字符串（支持 "25"、"25岁" 等格式）
function parseAgeString(ageStr: string | null): number | null {
  if (!ageStr) return null;
  const parsed = parseInt(String(ageStr), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

// 本地状态（用于输入框）
const name = ref(assetName.value);
const description = ref(assetDescription.value);
const gender = ref<string | null>(assetGender.value);
const ageNum = ref<number | null>(parseAgeString(assetAge.value));

// 同步外部数据变化到本地 ref（确保数据一致性）
// 只在外部数据变化且输入框未聚焦时同步，避免打断用户输入
watch(
  assetName,
  (newVal) => {
    const input = document.activeElement;
    // 只在当前输入框未聚焦时同步，避免打断用户输入
    if (newVal !== name.value && input?.tagName !== "INPUT") {
      name.value = newVal || "";
    }
  },
);

watch(
  assetDescription,
  (newVal) => {
    const textarea = document.activeElement;
    // 只在当前文本域未聚焦时同步，避免打断用户输入
    if (newVal !== description.value && textarea?.tagName !== "TEXTAREA") {
      description.value = newVal || "";
    }
  },
);

// 同步性别字段（仅角色类型）
watch(
  assetGender,
  (newVal) => {
    gender.value = newVal || null;
  },
);

// 同步年龄字段（仅角色类型）
watch(
  assetAge,
  (newVal) => {
    // 解析年龄字符串（支持 "25"、"25岁" 等格式）
    if (newVal) {
      const parsed = parseInt(String(newVal), 10);
      ageNum.value = Number.isFinite(parsed) ? parsed : null;
    } else {
      ageNum.value = null;
    }
  },
);

// 性别选项（value 使用英文，与后端数据格式一致）
const genderOptions = [
  { label: "男", value: "male" },
  { label: "女", value: "female" },
  { label: "未知", value: "unknown" },
];

// 图片分类
// 主图区域只显示 type="main" 或 type="angle" 的图片（不含参考图）
const generatedImages = computed(() =>
  props.images.filter((img) => img.type !== "reference"),
);

const mainImage = computed(() => {
  const pool = generatedImages.value;
  return pool.find((img) => img.id === props.mainImageId) || pool[0];
});

const angleImages = computed(() => {
  return generatedImages.value.filter(
    (img) =>
      img.type === "angle" ||
      (img.angleIndex !== undefined && img.id !== props.mainImageId),
  );
});

const referenceImages = computed(() => {
  return props.images.filter((img) => img.type === "reference");
});

// 是否有主图（不计入参考图）
const hasImages = computed(() => generatedImages.value.length > 0);

// 图片区域内联样式（用 padding-top 百分比实现比例容器，兼容性优于 aspect-ratio）
// padding-top 相对于元素自身宽度，公式：(1 / ratio) * 100%
const imageSectionStyle = computed(() => ({
  paddingTop: `${(1 / props.imageAspectRatio) * 100}%`,
}));

// 是否待生成（无图片且未开始生成）
const isPendingGeneration = computed(() => {
  return (
    !hasImages.value &&
    !props.generating &&
    props.generationStatus !== "generating"
  );
});

// 更多菜单选项
const moreMenuOptions = [
  {
    label: "编辑信息",
    key: "edit",
    icon: () => h(NIcon, null, { default: () => h(Pencil) }),
  },
  {
    type: "divider",
    key: "d1",
  },
  {
    label: "删除资产",
    key: "delete",
    icon: () => h(NIcon, null, { default: () => h(TrashOutline) }),
    props: {
      style: { color: "#d03050" },
    },
  },
];

// hoveredImageId 和上传文件列表
const hoveredImageId = ref<string | null>(null);
const mainUploadFileList = ref<UploadFileInfo[]>([]);
const refUploadFileList = ref<UploadFileInfo[]>([]);

// 获取资产真实 ID（characterId / sceneId / propId）
const assetId = computed(() => {
  if (props.type === "character") {
    return (props.data as CharacterRef).characterId;
  } else if (props.type === "scene") {
    return (props.data as SceneRef).sceneId;
  } else {
    return (props.data as PropRef).propId;
  }
});

// 处理名称更新（Phase 4：通过素材库 API 更新）
async function handleNameUpdate() {
  if (!assetId.value) return;
  try {
    await scriptEditStore.updateAssetBaseInfo(props.type, assetId.value, {
      name: name.value,
    });
  } catch {
    // 失败时回滚到 resolvedAsset 的最新值
    name.value = assetName.value;
  }
}

// 处理描述更新（Phase 4：通过素材库 API 更新）
async function handleDescriptionUpdate() {
  if (!assetId.value) return;
  try {
    await scriptEditStore.updateAssetBaseInfo(props.type, assetId.value, {
      description: description.value,
    });
  } catch {
    description.value = assetDescription.value;
  }
}

// 处理性别更新（Phase 4：通过素材库 API 更新）
async function handleGenderUpdate(val: string | null) {
  gender.value = val;
  if (!assetId.value || props.type !== "character") return;
  try {
    await scriptEditStore.updateAssetBaseInfo("character", assetId.value, {
      gender: val || undefined,
    });
  } catch {
    gender.value = assetGender.value;
  }
}

// 处理年龄更新（Phase 4：通过素材库 API 更新）
async function handleAgeUpdate() {
  if (!assetId.value || props.type !== "character") return;
  try {
    await scriptEditStore.updateAssetBaseInfo("character", assetId.value, {
      age: ageNum.value ? String(ageNum.value) : undefined,
    });
  } catch {
    ageNum.value = parseAgeString(assetAge.value);
  }
}

// 处理生成按钮点击
function handleGenerate() {
  emit("generate", props.data.id);
}

// 处理更多菜单选择
function handleMoreMenuSelect(key: string) {
  switch (key) {
    case "edit":
      // 聚焦到名称输入框
      break;
    case "delete":
      emit("delete", props.data.id);
      break;
  }
}

// 处理参考图片上传（参考图区域下方上传按钮）
function handleReferenceUpload(data: { fileList: UploadFileInfo[] }) {
  const files = data.fileList
    .map((f) => f.file)
    .filter((f): f is File => f !== null);
  if (files.length > 0) {
    emit("uploadReference", files);
  }
  // 清空文件列表，解决第二次无法点击问题
  refUploadFileList.value = [];
}

// 处理主图区域右下角上传按钮（上传为主图，type="main"）
function handleMainUpload(data: { fileList: UploadFileInfo[] }) {
  const files = data.fileList
    .map((f) => f.file)
    .filter((f): f is File => f !== null);
  if (files.length > 0) {
    emit("uploadMainImage", files);
  }
  // 清空文件列表，解决第二次无法点击问题
  mainUploadFileList.value = [];
}

// 处理图片删除
function handleDeleteImage(imageId: string) {
  dialog.warning({
    title: "确认删除",
    content: "确定要删除这张参考图片吗？此操作不可恢复。",
    positiveText: "删除",
    negativeText: "取消",
    onPositiveClick: () => {
      emit("deleteImage", imageId);
    },
  });
}

// 上传按钮提示文本（保留 assetTypeLabel 用于此处）
const uploadTooltip = computed(() => {
  const labels: Record<AssetType, string> = {
    character: "角色",
    scene: "场景",
    prop: "道具",
  };
  return `上传${labels[props.type]}主图`;
});

// 获取当前选中的音色信息
const selectedVoice = computed(() => {
  if (!props.voiceId) return undefined;
  return props.voices.find((v) => v.voiceId === props.voiceId);
});

// 音色选择器 popover 状态
const voicePopoverVisible = ref(false);

// 音色选择器组件 ref
const voiceSelectorRef = ref<{ stopAudio: () => void } | null>(null);

// 关闭 popover 时停止音频播放
function handleVoicePopoverClose(visible: boolean) {
  voicePopoverVisible.value = visible;
  if (!visible && voiceSelectorRef.value) {
    voiceSelectorRef.value.stopAudio();
  }
}
</script>

<template>
  <n-card
    class="asset-card"
    :class="{
      [`type-${type}`]: true,
      'is-generating': generating || generationStatus === 'generating',
    }"
    :bordered="false"
    hoverable
  >
    <!-- 生成失败提示遮罩 -->
    <div
      v-if="error && !generating"
      class="error-overlay"
    >
      <div class="error-content">
        <n-icon
          size="32"
          color="#d03050"
        >
          <CloseOutline />
        </n-icon>
        <p class="error-text">
          生成失败
        </p>
        <p class="error-hint">
          {{ error }}
        </p>
        <n-button
          size="small"
          type="error"
          ghost
          style="margin-top: 8px"
          @click="handleGenerate"
        >
          重试
        </n-button>
      </div>
    </div>

    <!-- 生成中遮罩（含进度条） -->
    <div
      v-if="generating || generationStatus === 'generating'"
      class="generating-overlay"
    >
      <div class="generating-content">
        <n-icon
          size="40"
          class="generating-icon"
        >
          <Sparkles />
        </n-icon>
        <p class="generating-text">
          图片生成中...
        </p>
        <p
          v-if="generationProgress > 0"
          class="generating-progress"
        >
          {{ generationProgress }}%
        </p>
      </div>
    </div>

    <!-- 图片区域 -->
    <div
      class="image-section"
      :style="imageSectionStyle"
    >
      <!-- 主图 + 视角图布局（n-image-group 支持分组预览） -->
      <n-image-group v-if="hasImages">
        <div class="image-layout">
          <!-- 主图 -->
          <div class="main-image-wrapper">
            <n-image
              v-if="mainImage"
              :src="mainImage.url"
              :alt="assetName"
              class="main-image"
              object-fit="cover"
            />
          </div>

          <!-- 右侧视角图 (40%，最多2张) -->
          <div
            v-if="angleImages.length > 0"
            class="angle-images-wrapper"
          >
            <div
              v-for="img in angleImages.slice(0, 2)"
              :key="img.id"
              class="angle-image-item"
            >
              <n-image
                :src="img.url"
                :alt="`${assetName} - 视角`"
                class="angle-image"
                object-fit="cover"
              />
            </div>
          </div>
        </div>
      </n-image-group>
      <!-- 无图片时的占位 -->
      <div
        v-else
        class="image-placeholder"
        :class="{ 'is-pending': isPendingGeneration }"
      >
        <div class="placeholder-content">
          <n-icon
            size="48"
            color="#99999940"
          >
            <ImageOutline />
          </n-icon>
          <span class="placeholder-text">
            {{ isPendingGeneration ? "待生成" : "暂无图片" }}
          </span>
          <span class="placeholder-hint">
            {{
              isPendingGeneration ? "点击生成按钮开始生成" : "点击生成按钮创建"
            }}
          </span>
        </div>
        <!-- 待生成状态指示器 -->
        <div
          v-if="isPendingGeneration"
          class="pending-indicator"
        >
          <div class="pending-dot" />
          <div class="pending-dot" />
          <div class="pending-dot" />
        </div>
      </div>

      <!-- 右下角上传主图按钮（始终显示，生成中时隐藏） -->
      <n-tooltip
        v-if="!generating && generationStatus !== 'generating'"
        placement="top"
        :delay="300"
      >
        <template #trigger>
          <n-upload
            accept="image/*"
            :max="1"
            :file-list="mainUploadFileList"
            :show-file-list="false"
            :custom-request="() => {}"
            class="main-upload-btn-wrapper"
            @change="handleMainUpload"
          >
            <div class="main-upload-btn">
              <n-icon size="14">
                <CloudUploadOutline />
              </n-icon>
            </div>
          </n-upload>
        </template>
        {{ uploadTooltip }}
      </n-tooltip>
    </div>

    <!-- 参考图片区域 -->
    <div class="reference-section">
      <div class="reference-label">
        参考图片
      </div>
      <!-- 当前模型不支持参考图时显示提示 -->
      <n-tooltip
        v-if="maxReferenceImages === 0"
        placement="top"
      >
        <template #trigger>
          <div class="reference-disabled-hint">
            当前模型不支持参考图
          </div>
        </template>
        请在上方切换支持参考图的模型后上传
      </n-tooltip>
      <div
        v-else
        class="reference-list"
      >
        <n-image-group>
          <div
            v-for="img in referenceImages.slice(0, maxReferenceImages)"
            :key="img.id"
            class="reference-item"
            @mouseenter="hoveredImageId = img.id"
            @mouseleave="hoveredImageId = null"
          >
            <n-image
              :src="img.thumbnailUrl || img.url"
              :preview-src="img.url"
              alt="参考图"
              class="reference-image"
              object-fit="cover"
            />
            <div
              v-if="hoveredImageId === img.id"
              class="reference-delete-btn-wrapper"
            >
              <n-button
                size="tiny"
                circle
                type="error"
                quaternary
                class="reference-delete-btn"
                @click="handleDeleteImage(img.id)"
              >
                <template #icon>
                  <n-icon><TrashOutline /></n-icon>
                </template>
              </n-button>
            </div>
          </div>
        </n-image-group>

        <!-- 上传按钮 -->
        <n-upload
          v-if="referenceImages.length < maxReferenceImages"
          accept="image/*"
          :max="maxReferenceImages - referenceImages.length"
          :file-list="refUploadFileList"
          :show-file-list="false"
          :custom-request="() => {}"
          @change="handleReferenceUpload"
        >
          <div class="reference-upload-btn">
            <n-icon size="18">
              <CloudUploadOutline />
            </n-icon>
          </div>
        </n-upload>
      </div>
    </div>

    <!-- 信息区域 -->
    <div class="info-section">
      <n-input-group>
        <n-input
          v-model:value="name"
          placeholder="输入名称"
          size="small"
          :maxlength="100"
          show-count
          aria-label="名称"
          @blur="handleNameUpdate"
        />
      </n-input-group>

      <!-- 角色专属：性别和年龄 -->
      <div
        v-if="type === 'character'"
        class="character-meta"
      >
        <n-select
          v-model:value="gender"
          :options="genderOptions"
          placeholder="性别"
          size="small"
          clearable
          aria-label="性别"
          @update:value="handleGenderUpdate"
        />
        <n-input-number
          v-model:value="ageNum"
          placeholder="年龄"
          size="small"
          :min="1"
          :max="150"
          :precision="0"
          :show-button="false"
          aria-label="年龄"
          @blur="handleAgeUpdate"
        />
      </div>

      <!-- 角色专属：音色选择 -->
      <div
        v-if="type === 'character'"
        class="voice-section"
      >
        <n-popover
          trigger="click"
          placement="bottom"
          @update:show="handleVoicePopoverClose"
        >
          <template #trigger>
            <div class="voice-trigger">
              <n-icon
                size="14"
                :color="selectedVoice ? '#18a058' : '#999'"
              >
                <MusicalNotes />
              </n-icon>
              <span
                v-if="selectedVoice"
                class="voice-name-selected"
              >
                {{ selectedVoice.name }}
              </span>
              <span
                v-else
                class="voice-name-placeholder"
              > 选择音色 </span>
            </div>
          </template>

          <!-- 使用 VoiceSelector 组件 -->
          <div class="voice-popover">
            <VoiceSelector
              ref="voiceSelectorRef"
              :model-value="voiceId"
              :voices="voices"
              :loading="voicesLoading"
              :popover-visible="voicePopoverVisible"
              @update:model-value="(id) => emit('updateVoice', id)"
            />
          </div>
        </n-popover>
      </div>

      <n-input
        v-model:value="description"
        type="textarea"
        placeholder="输入描述（可选）"
        size="small"
        :rows="2"
        :maxlength="500"
        show-count
        aria-label="描述"
        class="description-input"
        @blur="handleDescriptionUpdate"
      />
    </div>

    <!-- 操作区域 -->
    <div class="action-section">
      <n-button
        type="primary"
        size="small"
        :loading="generating"
        @click="handleGenerate"
      >
        <template #icon>
          <n-icon><Sparkles /></n-icon>
        </template>
        {{ generating ? "生成中" : hasImages ? "重新生成" : "生成" }}
      </n-button>

      <!-- 更多菜单 -->
      <n-dropdown
        :options="moreMenuOptions"
        placement="bottom-end"
        trigger="click"
        @select="handleMoreMenuSelect"
      >
        <n-button
          size="small"
          circle
          class="more-btn"
        >
          <template #icon>
            <n-icon><EllipsisVertical /></n-icon>
          </template>
        </n-button>
      </n-dropdown>
    </div>
  </n-card>
</template>

<style scoped lang="scss">
.asset-card {
  width: 340px;
  flex-shrink: 0;
  scroll-snap-align: start;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  transition: all 0.3s ease;
  overflow: hidden;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  }

  &.is-loading {
    opacity: 0.7;
    pointer-events: none;
  }

  &.is-generating {
    .image-section,
    .reference-section,
    .info-section,
    .action-section {
      filter: blur(2px);
    }
  }

  :deep(.n-card__content) {
    padding: 0;
    display: flex;
    flex-direction: column;
  }
}

// 生成失败遮罩
.error-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  border-radius: 16px;
  backdrop-filter: blur(8px);

  .error-content {
    text-align: center;
    padding: 0 16px;
  }

  .error-text {
    margin-top: 8px;
    font-size: 14px;
    color: #d03050;
    font-weight: 600;
  }

  .error-hint {
    margin-top: 4px;
    font-size: 12px;
    color: #999;
    word-break: break-all;
    max-width: 200px;
  }
}

// 生成中遮罩
.generating-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  border-radius: 16px;
  backdrop-filter: blur(8px);

  .generating-content {
    text-align: center;
  }

  .generating-icon {
    color: #2080f0;
    animation: pulse 1.5s ease-in-out infinite;
  }

  .generating-text {
    margin-top: 12px;
    font-size: 14px;
    color: #666;
    font-weight: 500;
  }

  .generating-progress {
    margin-top: 4px;
    font-size: 20px;
    font-weight: 700;
    color: #2080f0;
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.1);
  }
}

// 图片区域：padding-top 由内联样式注入，实现比例容器
// 内部元素用 position:absolute; inset:0 填满，overflow:hidden 裁切超出部分
.image-section {
  position: relative;
  margin: 12px 12px 0;
  overflow: hidden;
  border-radius: 12px;
}

.image-layout {
  position: absolute;
  inset: 0;
  display: flex;
  gap: 4px;
}

.main-image-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 12px;
  overflow: hidden;
  background: #f5f5f5;

  // n-image 需要铺满容器
  :deep(.main-image) {
    display: block;
    width: 100%;
    height: 100%;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s ease;
    }
  }

  &:hover :deep(.main-image img) {
    transform: scale(1.03);
  }
}

.angle-images-wrapper {
  width: 40%;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.angle-image-item {
  position: relative;
  flex: 1;
  border-radius: 12px;
  overflow: hidden;
  background: #f5f5f5;

  // n-image 需要铺满容器
  :deep(.angle-image) {
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

.image-placeholder {
  // 绝对定位填满 .image-section（.image-section 已负责 margin 和 border-radius）
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  display: flex;
  align-items: center;
  justify-content: center;

  &.is-pending {
    background: linear-gradient(135deg, #fff8f0 0%, #fff0e0 100%);
    border: 2px dashed #f0a02040;

    .placeholder-content {
      .placeholder-text {
        color: #f0a020;
        font-weight: 500;
      }

      .placeholder-hint {
        color: #f0a02080;
      }
    }
  }

  .placeholder-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;

    .placeholder-text {
      font-size: 14px;
      color: #999;
    }

    .placeholder-hint {
      font-size: 12px;
      color: #bbb;
    }
  }

  // 待生成状态指示器
  .pending-indicator {
    position: absolute;
    bottom: 16px;
    display: flex;
    gap: 6px;

    .pending-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #f0a020;
      animation: pendingPulse 1.4s ease-in-out infinite;

      &:nth-child(2) {
        animation-delay: 0.2s;
      }

      &:nth-child(3) {
        animation-delay: 0.4s;
      }
    }
  }
}

@keyframes pendingPulse {
  0%,
  100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  50% {
    opacity: 1;
    transform: scale(1);
  }
}

// 主图右下角上传按钮
.main-upload-btn-wrapper {
  position: absolute;
  bottom: 8px;
  right: 8px;
  z-index: 3;
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

// 参考图片区域
.reference-section {
  padding: 12px;
  border-bottom: 1px solid #f5f5f5;

  .reference-label {
    font-size: 12px;
    color: #999;
    margin-bottom: 10px;
    font-weight: 500;
  }

  .reference-disabled-hint {
    font-size: 11px;
    color: #bbb;
    padding: 6px 0;
    cursor: default;
    text-decoration: underline dotted;
  }

  .reference-list {
    display: flex;
    gap: 8px;
  }

  .reference-item {
    position: relative;
    width: 56px;
    height: 56px;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid #f0f0f0;
    flex-shrink: 0;

    // n-image 铺满容器
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

  .reference-delete-btn-wrapper {
    position: absolute;
    top: -4px;
    right: -4px;
    z-index: 2;
  }

  .reference-delete-btn {
    background: #fff;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
  }

  .reference-upload-btn {
    width: 56px;
    height: 56px;
    border-radius: 10px;
    border: 2px dashed #e0e0e0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #bbb;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      border-color: #2080f0;
      color: #2080f0;
      background: #f0f7ff;
    }
  }
}

// 信息区域
.info-section {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;

  .character-meta {
    display: flex;
    gap: 8px;

    > * {
      flex: 1;
      min-width: 0;
    }
  }

  .voice-section {
    .voice-trigger {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      background: #f5f5f5;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        background: #e8e8e8;
      }

      .voice-name-selected {
        font-size: 13px;
        color: #18a058;
        font-weight: 500;
      }

      .voice-name-placeholder {
        font-size: 13px;
        color: #999;
      }
    }
  }

  .description-input {
    :deep(.n-input__textarea-el) {
      resize: none;
    }
  }
}

// 操作区域
.action-section {
  padding: 0 12px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;

  .more-btn {
    opacity: 0.5;
    transition: opacity 0.2s;

    &:hover {
      opacity: 1;
    }
  }
}

// 音色选择弹窗样式
.voice-popover {
  width: 340px;
}
</style>
