<script setup lang="ts">
import { ref, computed, watch } from "vue";
import {
  NButton,
  NIcon,
  NSelect,
  NEmpty,
  NTooltip,
  useMessage,
  useDialog,
  type SelectOption,
} from "naive-ui";
import { Sparkles, Add, ChevronForward, ChevronBack, CreateOutline, DownloadOutline } from "@vicons/ionicons5";
import WorkflowStep from "./WorkflowStep.vue";
import AssetCard from "./AssetCard.vue";
import CreateAssetModal from "./CreateAssetModal.vue";
import ImportAssetModal from "./ImportAssetModal.vue";
import { useScriptModelsStore, renderModelLabelWithPrice, type ModelOptionWithPrice } from "@/stores/script-models";
import { useScriptEditStore } from "../store/scriptEdit";
import type { StepStatusType } from "../store/scriptEdit";
import type {
  CharacterRef,
  SceneRef,
  PropRef,
  AssetImage,
} from "@pixaura/shared-types";

// 资产类型定义
type AssetType = "character" | "scene" | "prop";
type AssetData = CharacterRef | SceneRef | PropRef;

// TTS 音色类型（与 AssetCard 一致）
interface TTSVoice {
  id: string;
  voiceId: string;
  name: string;
  nameEn?: string;
  gender: "female" | "male" | "child" | "dialect";
  category?: "standard" | "dialect";
  style?: string;
  previewAudioUrl?: string;
  isActive: boolean;
}

// Props 定义
interface Props {
  stepId: AssetType;
  title: string;
  description: string;
  stepNumber: number;
  assets: AssetData[];
  images?: Record<string, AssetImage[]>;
  mainImageIds?: Record<string, string>;
  status: StepStatusType;
  // 计算后的状态（考虑依赖链），优先使用此状态
  computedStatus?: StepStatusType;
  modelId: string;
  progress?: number;
  loading?: boolean;
  generatingIds?: string[];
  generationProgress?: Record<string, number>;
  generationErrors?: Record<string, string>;
  // 图片容器宽高比（scene 类型使用剧本分辨率，其他类型为 1）
  imageAspectRatio?: number;
  projectId: string;
  scriptId: string;
  // TTS 音色相关（仅角色类型使用）
  voices?: TTSVoice[];
  voicesLoading?: boolean;
  // 是否正在解析剧本（用于显示不同的空状态提示）
  isParsingScript?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  images: () => ({}),
  mainImageIds: () => ({}),
  progress: 0,
  loading: false,
  generatingIds: () => [],
  generationProgress: () => ({}),
  generationErrors: () => ({}),
  imageAspectRatio: 1,
  voices: () => [],
  voicesLoading: false,
  isParsingScript: false,
  computedStatus: undefined,
});

// 实际使用的状态（优先使用计算后的状态）
const actualStatus = computed(() => props.computedStatus ?? props.status);

// Emits 定义
const emit = defineEmits<{
  generate: [assetId: string];
  generateBatch: [assetIds: string[]];
  updateAsset: [assetId: string, data: Partial<AssetData>];
  deleteAsset: [assetId: string];
  deleteImage: [assetId: string, imageId: string];
  uploadReference: [assetId: string, files: File[]];
  uploadMainImage: [assetId: string, files: File[]];
  modelChange: [modelId: string];
  updateVoice: [assetId: string, voiceId: string | undefined];
}>();

// Message
const message = useMessage();
const dialog = useDialog();

// 使用 Pinia Store
const scriptModelsStore = useScriptModelsStore();
const scriptEditStore = useScriptEditStore();

// 本地状态
const scrollContainerRef = ref<HTMLDivElement | null>(null);
const canScrollLeft = ref(false);
const canScrollRight = ref(false);

// 弹窗状态
const showCreateModal = ref(false);
const showImportModal = ref(false);

// 计算属性：模型选项 - 使用步骤独立的图像生成模型选项
const modelOptions = computed(() => {
  const stepMap: Record<string, string> = {
    character: "characters",
    scene: "scenes",
    prop: "props",
  };
  const stepKey = stepMap[props.stepId];
  return scriptModelsStore.getImageModelOptionsForStep(stepKey);
});

// 是否有可用模型
const hasAvailableModels = computed(() => modelOptions.value.length > 0);

// 选中的模型ID
const selectedModelId = ref("");

// 步骤映射
const stepMap: Record<string, string> = {
  character: "characters",
  scene: "scenes",
  prop: "props",
};

// 计算属性：应该使用的模型ID
const effectiveModelId = computed<string>(() => {
  const stepKey = stepMap[props.stepId];

  // 优先级：
  // 1. props.modelId（父组件传递，来自 initializeStepsFromScript）
  // 2. scriptModelsStore 保存的配置（API 返回）
  // 3. 第一个可用模型

  // 如果 props.modelId 有值，直接使用（优先级最高）
  if (props.modelId) return props.modelId;

  // 从 store 获取保存的配置
  const defaultFromScript = stepKey
    ? scriptModelsStore.getDefaultModelId(stepKey)
    : "";
  if (defaultFromScript) return defaultFromScript;

  // 最后使用第一个可用模型（模型ID始终为字符串）
  const firstAvailable = modelOptions.value[0]?.value;
  return typeof firstAvailable === "string" ? firstAvailable : "";
});

// 当 effectiveModelId 变化时，更新本地值并通知父组件
watch(
  effectiveModelId,
  (newId) => {
    if (newId && newId !== selectedModelId.value) {
      selectedModelId.value = newId;
      emit("modelChange", newId);
    }
  },
  { immediate: true },
);

// 计算属性
const hasAssets = computed(() => props.assets.length > 0);

const hasGeneratingAssets = computed(() => props.generatingIds!.length > 0);

// 空状态描述文本
const emptyStateDescription = computed(() => {
  // 如果正在解析剧本，显示解析中的提示
  if (props.isParsingScript) {
    return "正在解析剧本，请稍候...";
  }
  if (props.stepNumber === 2) return '暂无角色，请在剧本步骤点击"一键解析"';
  if (props.stepNumber === 3) return '暂无场景，请在剧本步骤点击"一键解析"';
  return '暂无道具，请在剧本步骤点击"一键解析"';
});

// 是否正在加载模型
const isLoadingModels = computed(() => scriptModelsStore.isLoading);

// 类型标签映射
const typeLabelMap: Record<AssetType, string> = {
  character: "角色",
  scene: "场景",
  prop: "道具",
};

// 已关联的资产 ID 列表（用于 ImportAssetModal 标记已关联状态）
const linkedAssetIds = computed(() => {
  return props.assets
    .map((a) => {
      const asset = a as { characterId?: string; sceneId?: string; propId?: string };
      if (props.stepId === "character") return asset.characterId;
      if (props.stepId === "scene") return asset.sceneId;
      if (props.stepId === "prop") return asset.propId;
      return undefined;
    })
    .filter((id): id is string => !!id);
});

// 当前选中模型允许的最大参考图数量（来自 defaultParams）
// DB 存储格式可能为驼峰（maxReferences）或下划线（max_references），均需兼容
const maxReferenceImages = computed(() => {
  const params = scriptModelsStore.getModelDefaultParams(
    effectiveModelId.value,
  );
  const val =
    params.max_references ??
    params.maxReferences ??
    params.max_references_images ??
    params.maxReferencesImages;
  return typeof val === "number" ? val : 3;
});

// 操作按钮
const actionButtons = computed(() => {
  const buttons: Array<{
    key: string;
    label: string;
    type: "primary" | "default" | "error";
    icon?: unknown;
    disabled?: boolean;
  }> = [];

  // 批量生成按钮（有待生成项时显示）
  if (hasAssets.value && !hasGeneratingAssets.value) {
    // 与后端判断逻辑一致：未导入 + 没有图片
    const pendingAssets = props.assets.filter((a) => {
      const asset = a as { assetStatus?: string };
      return asset.assetStatus !== "imported" && !props.images![a.id]?.length;
    });
    if (pendingAssets.length > 0) {
      buttons.push({
        key: "generateBatch",
        label: `批量生成 (${pendingAssets.length})`,
        type: "primary",
        icon: Sparkles,
        disabled: !effectiveModelId.value,
      });
    }
  }

  return buttons;
});

// 检查滚动位置
function checkScrollPosition() {
  const container = scrollContainerRef.value;
  if (!container) return;

  canScrollLeft.value = container.scrollLeft > 0;
  canScrollRight.value =
    container.scrollLeft < container.scrollWidth - container.clientWidth - 10;
}

// 滚动处理
function scrollToLeft() {
  const container = scrollContainerRef.value;
  if (!container) return;
  container.scrollBy({ left: -340, behavior: "smooth" });
}

function scrollToRight() {
  const container = scrollContainerRef.value;
  if (!container) return;
  container.scrollBy({ left: 340, behavior: "smooth" });
}

// 处理生成单个资产
function handleGenerate(assetId: string) {
  if (!effectiveModelId.value) {
    message.warning("请先选择生成模型");
    return;
  }
  emit("generate", assetId);
}

// 处理批量生成
function handleGenerateBatch() {
  if (!effectiveModelId.value) {
    message.warning("请先选择生成模型");
    return;
  }
  // 与后端判断逻辑一致：未导入 + 没有图片
  const pendingAssets = props.assets.filter((a) => {
    const asset = a as { assetStatus?: string };
    return asset.assetStatus !== "imported" && !props.images![a.id]?.length;
  });
  if (pendingAssets.length > 0) {
    emit(
      "generateBatch",
      pendingAssets.map((a) => a.id),
    );
  }
}

// 打开新建资产弹窗
function handleOpenCreateModal() {
  showCreateModal.value = true;
}

// 打开导入资产弹窗
function handleOpenImportModal() {
  showImportModal.value = true;
}

// 新建/导入成功后刷新资产列表
function handleAssetModalSuccess() {
  // 弹窗组件内部已通过 store 更新了数据
  // 无需额外操作，Vue 响应式会自动更新 UI
}

// 处理资产更新
function handleAssetUpdate(assetId: string, data: Partial<AssetData>) {
  emit("updateAsset", assetId, data);
}

// 处理资产删除（带确认弹窗）
function handleAssetDelete(assetId: string) {
  const asset = props.assets.find((a) => a.id === assetId);
  // 从 resolvedAssets 获取名称（Phase 4 后 ref 中无 name 字段）
  let assetName = "未命名资产";
  if (props.stepId === "character") {
    const charRef = asset as CharacterRef | undefined;
    if (charRef?.characterId) {
      const resolvedChar = scriptEditStore.getResolvedCharacterById(charRef.characterId);
      assetName = resolvedChar?.name || assetName;
    }
  } else if (props.stepId === "scene") {
    const sceneRef = asset as SceneRef | undefined;
    if (sceneRef?.sceneId) {
      const resolvedScene = scriptEditStore.getResolvedSceneById(sceneRef.sceneId);
      assetName = resolvedScene?.name || assetName;
    }
  } else if (props.stepId === "prop") {
    const propRef = asset as PropRef | undefined;
    if (propRef?.propId) {
      const resolvedProp = scriptEditStore.getResolvedPropById(propRef.propId);
      assetName = resolvedProp?.name || assetName;
    }
  }
  const typeLabel = typeLabelMap[props.stepId];

  dialog.warning({
    title: `确认删除${typeLabel}`,
    content: `确定要删除${typeLabel}「${assetName}」吗？删除后无法恢复。`,
    positiveText: "删除",
    negativeText: "取消",
    onPositiveClick: () => {
      emit("deleteAsset", assetId);
    },
  });
}

// 处理图片删除
function handleDeleteImage(assetId: string, imageId: string) {
  emit("deleteImage", assetId, imageId);
}

// 处理参考图片上传
function handleUploadReference(assetId: string, files: File[]) {
  emit("uploadReference", assetId, files);
}

// 处理主图上传
function handleUploadMainImage(assetId: string, files: File[]) {
  emit("uploadMainImage", assetId, files);
}

// 处理角色音色更新
function handleUpdateVoice(assetId: string, voiceId: string | undefined) {
  emit("updateVoice", assetId, voiceId);
}

// 获取角色的音色ID
function getCharacterVoiceId(asset: AssetData): string | undefined {
  const char = asset as CharacterRef;
  return char.voiceId;
}

// 资产生成状态类型
type AssetGenerationStatus =
  | "none"
  | "pending"
  | "generating"
  | "completed"
  | "failed";

// 获取资产生成状态
function getAssetGenerationStatus(assetId: string): AssetGenerationStatus {
  if (props.generatingIds?.includes(assetId)) {
    return "generating";
  }
  const hasImages = props.images?.[assetId]?.length > 0;
  if (hasImages) {
    return "completed";
  }
  return "none";
}

// 处理模型变更
async function handleModelChange(modelId: string) {
  selectedModelId.value = modelId;
  emit("modelChange", modelId);

  // 同步更新剧本模型配置
  if (props.projectId && props.scriptId && modelId) {
    try {
      // 使用已定义的 stepMap 获取步骤 key
      const stepKey = stepMap[props.stepId];
      if (stepKey) {
        await scriptModelsStore.updateScriptModelConfig(
          props.projectId,
          props.scriptId,
          stepKey,
          modelId,
        );
      }
    } catch (error) {
      console.error("更新剧本模型配置失败:", error);
      // 不显示错误提示，避免打扰用户
    }
  }
}

// 处理操作按钮点击
function handleAction(actionKey: string) {
  if (actionKey === "generateBatch") {
    handleGenerateBatch();
  }
}

// 获取资产的 assetStatus 字段（用于模板中避免类型断言）
function getAssetRefStatus(
  asset: AssetData,
): "imported" | "will_create" | "none" {
  const a = asset as {
    assetStatus?: "imported" | "will_create" | "none";
  };
  return a.assetStatus || "none";
}

// 渲染模型选项标签（带价格信息）
function handleRenderModelLabel(option: SelectOption) {
  return renderModelLabelWithPrice(option, modelOptions.value as ModelOptionWithPrice[]);
}
</script>

<template>
  <workflow-step
    :step-id="stepId"
    :title="title"
    :step-number="stepNumber"
    :description="description"
    :status="actualStatus"
    :progress="progress"
    :action-buttons="actionButtons"
    :loading="loading"
    show-model-selector
    @action="handleAction"
  >
    <!-- 模型选择器（通过 slot 传入 header） -->
    <template #modelSelector>
      <div class="model-selector-wrapper">
        <n-select
          v-if="hasAvailableModels"
          v-model:value="selectedModelId"
          :options="modelOptions"
          placeholder="选择模型"
          :consistent-menu-width="false"
          size="small"
          :loading="isLoadingModels"
          :render-label="handleRenderModelLabel"
          @update:value="handleModelChange"
        />
        <n-tooltip
          v-else
          placement="top"
        >
          <template #trigger>
            <span class="no-model-hint">
              {{ isLoadingModels ? "加载中..." : "暂无可用模型" }}
            </span>
          </template>
          {{
            isLoadingModels
              ? "正在加载模型列表，请稍候..."
              : "当前没有可用的图像生成模型，请联系管理员配置"
          }}
        </n-tooltip>
      </div>
    </template>

    <!-- 资产卡片列表 -->
    <div class="asset-step-content">
      <!-- 空状态 -->
      <n-empty
        v-if="!hasAssets && !loading"
        :description="emptyStateDescription"
        class="empty-state"
      >
        <template #extra>
          <n-button
            type="primary"
            size="small"
            @click="handleOpenCreateModal"
          >
            <template #icon>
              <n-icon><Add /></n-icon>
            </template>
            手动添加
          </n-button>
        </template>
      </n-empty>

      <!-- 横向滚动容器 -->
      <div
        v-else
        class="scroll-container-wrapper"
      >
        <!-- 左滚动按钮 -->
        <n-button
          v-if="canScrollLeft"
          class="scroll-btn scroll-left"
          circle
          size="small"
          @click="scrollToLeft"
        >
          <template #icon>
            <n-icon><ChevronBack /></n-icon>
          </template>
        </n-button>

        <!-- 滚动容器 -->
        <div
          ref="scrollContainerRef"
          class="scroll-container"
          @scroll="checkScrollPosition"
        >
          <!-- 资产卡片列表 -->
          <asset-card
            v-for="asset in assets"
            :key="asset.id"
            :type="stepId"
            :data="asset"
            :images="images![asset.id] || []"
            :main-image-id="mainImageIds![asset.id]"
            :loading="loading"
            :generating="generatingIds!.includes(asset.id)"
            :generation-progress="generationProgress![asset.id] || 0"
            :generation-status="getAssetGenerationStatus(asset.id)"
            :asset-ref-status="getAssetRefStatus(asset)"
            :error="generationErrors![asset.id] || ''"
            :image-aspect-ratio="imageAspectRatio"
            :max-reference-images="maxReferenceImages"
            :voice-id="
              stepId === 'character' ? getCharacterVoiceId(asset) : undefined
            "
            :voices="voices"
            :voices-loading="voicesLoading"
            @update="
              (data: Partial<AssetData>) => handleAssetUpdate(asset.id, data)
            "
            @generate="() => handleGenerate(asset.id)"
            @delete="() => handleAssetDelete(asset.id)"
            @delete-image="
              (imageId: string) => handleDeleteImage(asset.id, imageId)
            "
            @upload-reference="
              (files: File[]) => handleUploadReference(asset.id, files)
            "
            @upload-main-image="
              (files: File[]) => handleUploadMainImage(asset.id, files)
            "
            @update-voice="
              (voiceId: string | undefined) =>
                handleUpdateVoice(asset.id, voiceId)
            "
          />

          <!-- 添加资产按钮（上下分割：新建 + 导入） -->
          <div class="add-asset-card">
            <!-- 上半部分：新建资产 -->
            <div
              class="add-section create-section"
              @click="handleOpenCreateModal"
            >
              <n-icon size="24">
                <CreateOutline />
              </n-icon>
              <span>新建{{ typeLabelMap[stepId] }}</span>
            </div>
            <!-- 分割线 -->
            <div class="divider-line" />
            <!-- 下半部分：从项目导入 -->
            <div
              class="add-section import-section"
              @click="handleOpenImportModal"
            >
              <n-icon size="24">
                <DownloadOutline />
              </n-icon>
              <span>从项目导入</span>
            </div>
          </div>
        </div>

        <!-- 右滚动按钮 -->
        <n-button
          v-if="canScrollRight"
          class="scroll-btn scroll-right"
          circle
          size="small"
          @click="scrollToRight"
        >
          <template #icon>
            <n-icon><ChevronForward /></n-icon>
          </template>
        </n-button>
      </div>
    </div>

    <!-- 新建资产弹窗 -->
    <CreateAssetModal
      v-model:show="showCreateModal"
      :project-id="projectId"
      :script-id="scriptId"
      :asset-type="stepId"
      @success="handleAssetModalSuccess"
    />

    <!-- 导入资产弹窗 -->
    <ImportAssetModal
      v-model:show="showImportModal"
      :project-id="projectId"
      :script-id="scriptId"
      :asset-type="stepId"
      :linked-asset-ids="linkedAssetIds"
      @success="handleAssetModalSuccess"
    />
  </workflow-step>
</template>

<style scoped lang="scss">
.asset-step-content {
  min-height: 200px;
}

.empty-state {
  padding: 48px 0;
}

.scroll-container-wrapper {
  position: relative;
  padding: 8px 24px;
}

.scroll-container {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  padding: 8px 4px 16px;
  margin: -8px -4px -16px;

  // 隐藏滚动条
  scrollbar-width: none;
  -ms-overflow-style: none;
  &::-webkit-scrollbar {
    display: none;
  }
}

.scroll-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 5;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    transform: translateY(-50%) scale(1.1);
  }

  &.scroll-left {
    left: -8px;
  }

  &.scroll-right {
    right: -8px;
  }
}

.add-asset-card {
  width: 340px;
  height: auto;
  flex-shrink: 0;
  scroll-snap-align: start;
  border-radius: 12px;
  border: 2px dashed #d9d9d9;
  background: #fafafa;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;

  .divider-line {
    height: 1px;
    background: #e5e5e5;
    margin: 0 16px;
  }

  .add-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 16px;
    cursor: pointer;
    transition: all 0.2s ease;
    color: #999;

    &:hover {
      background: #f5f5f5;
      color: #2080f0;
    }

    span {
      font-size: 14px;
    }
  }

  .create-section:hover {
    background: #f0f7ff;
  }

  .import-section:hover {
    background: #f0f9f4;
    color: #18a058;
  }
}

.no-model-hint {
  font-size: 12px;
  color: #999;
  padding: 2px 8px;
  background: #f5f5f5;
  border-radius: 4px;
}

// 响应式适配
@media (max-width: 768px) {
  .model-selector-wrapper {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .scroll-container {
    gap: 12px;
  }

  .add-asset-card {
    width: 280px;
    height: auto;

    .add-section {
      padding: 12px;
      gap: 6px;

      span {
        font-size: 13px;
      }
    }
  }
}
</style>
