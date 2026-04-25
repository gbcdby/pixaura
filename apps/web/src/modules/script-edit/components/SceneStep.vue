<script setup lang="ts">
import { computed } from "vue";
import { useMessage } from "naive-ui";
import AssetStep from "./AssetStep.vue";
import { useScriptEditStore, RESOLUTION_OPTIONS } from "../store/scriptEdit";
import type { SceneRef, AssetImage } from "@pixaura/shared-types";

// Props
interface Props {
  projectId: string;
  scriptId: string;
  // 计算后的状态（考虑依赖链），优先使用此状态
  computedStatus?: import("../store/types").StepStatusType;
}

defineProps<Props>();

// Emits
defineEmits<{
  generated: [];
  error: [message: string];
}>();

// Store
const scriptEditStore = useScriptEditStore();
const message = useMessage();

// 计算属性
const stepState = computed(() => scriptEditStore.steps.scenes);

// 剧本步骤是否正在解析
const isParsingScript = computed(
  () => scriptEditStore.steps.script.status === "parsing",
);

const scenes = computed(() => stepState.value.items as SceneRef[]);

// SceneRef 运行时可能带有 images 字段（图片生成后通过 Object.assign 追加）
type SceneRefRuntime = SceneRef & {
  images?: AssetImage[];
};

// 场景图片映射（从 scenes items 中提取，图片是运行时动态追加的字段）
const sceneImages = computed(() => {
  const images: Record<string, AssetImage[]> = {};
  for (const scene of scenes.value as SceneRefRuntime[]) {
    if (scene.images && scene.images.length > 0) {
      images[scene.id] = scene.images;
    }
  }
  return images;
});

// 主图ID映射（取第一张非参考图作为主图）
const mainImageIds = computed(() => {
  const ids: Record<string, string> = {};
  for (const scene of scenes.value as SceneRefRuntime[]) {
    if (scene.images && scene.images.length > 0) {
      const mainImg = scene.images.find((img) => img.type !== "reference");
      if (mainImg) ids[scene.id] = mainImg.id;
    }
  }
  return ids;
});

// 生成中的场景ID列表（从 store 的 imageGeneratingIds 获取）
const generatingIds = computed(() => {
  return Array.from(stepState.value.imageGeneratingIds);
});

// 生成进度映射
const generationProgress = computed(() => {
  return stepState.value.imageGenerationProgress;
});

// 生成错误映射
const generationErrors = computed(() => {
  return stepState.value.imageGenerationErrors || {};
});

// 当前剧本分辨率对应的图片宽高比（用于场景图片容器）
const sceneImageAspectRatio = computed(() => {
  const resolution = scriptEditStore.creationSettings.resolution;
  const opt = RESOLUTION_OPTIONS.find((r) => r.value === resolution);
  if (!opt) return 1;
  return opt.width / opt.height;
});

// 处理生成单个场景图片
async function handleGenerate(sceneId: string) {
  const scene = scenes.value.find((s) => s.id === sceneId);
  if (!scene) return;

  // 从 resolvedAssets 获取描述（Phase 4 后 ref 中无 description）
  const description = scene.sceneId
    ? scriptEditStore.getResolvedSceneById(scene.sceneId)?.description
    : undefined;

  // 描述为空时提示
  if (!description?.trim()) {
    message.warning("请先填写场景描述后再生成图片");
    return;
  }

  if (stepState.value.imageGeneratingIds.has(sceneId)) {
    message.warning("已有进行中的生成任务，请等待完成");
    return;
  }

  try {
    await scriptEditStore.generateAssetImage(sceneId, "scene", {
      modelId: stepState.value.modelId || undefined,
    });
  } catch (error: unknown) {
    const err = error as { code?: number; message?: string };
    if (err?.code === 1351) {
      message.warning("已有进行中的生成任务，请等待完成");
    } else if (err?.code === 1352) {
      message.warning("请先填写场景描述后再生成图片");
    } else if (err?.code === 1101) {
      message.error("额度不足，请充值后再试");
    } else {
      message.error("图片生成失败，请稍后重试");
    }
    console.error("生成场景图片失败:", error);
  }
}

// 处理批量生成
async function handleGenerateBatch(sceneIds: string[]) {
  if (sceneIds.length === 0) return;

  // 检查是否所有待生成场景都有描述（从 resolvedAssets 获取）
  const noDescriptionScenes = sceneIds
    .map((id) => scenes.value.find((s) => s.id === id))
    .filter((s) => {
      if (!s) return true;
      const desc = s.sceneId
        ? scriptEditStore.getResolvedSceneById(s.sceneId)?.description
        : undefined;
      return !desc?.trim();
    });

  if (noDescriptionScenes.length > 0) {
    message.warning(`有 ${noDescriptionScenes.length} 个场景缺少描述，将跳过`);
  }

  try {
    await scriptEditStore.batchGenerateAssetImages("scene", {
      modelId: stepState.value.modelId || undefined,
    });
    message.success("批量图片生成任务已创建");
  } catch (error: unknown) {
    const err = error as { code?: number };
    if (err?.code === 1101) {
      message.error("额度不足，请充值后再试");
    } else {
      message.error("批量生成失败，请稍后重试");
    }
    console.error("批量生成场景图片失败:", error);
  }
}

// 处理场景更新
async function handleUpdateAsset(sceneId: string, data: Partial<SceneRef>) {
  try {
    await scriptEditStore.updateAssetRef("scene", sceneId, data);
  } catch (error) {
    message.error("保存场景信息失败，请稍后重试");
    console.error("保存场景信息失败:", error);
  }
}

// 处理场景删除
async function handleDeleteAsset(sceneId: string) {
  try {
    await scriptEditStore.deleteAsset("scene", sceneId);
    message.success("场景已删除");
  } catch (error) {
    message.error("删除场景失败，请稍后重试");
    console.error("删除场景失败:", error);
  }
}

// 处理图片删除
async function handleDeleteImage(sceneId: string, imageId: string) {
  try {
    await scriptEditStore.deleteAssetImage(sceneId, imageId);
  } catch (error) {
    message.error("删除图片失败，请稍后重试");
    console.error("删除图片失败:", error);
  }
}

// 处理参考图片上传
async function handleUploadReference(sceneId: string, files: File[]) {
  for (const file of files) {
    try {
      await scriptEditStore.uploadReferenceImage(sceneId, file);
      message.success("参考图上传成功");
    } catch (error) {
      message.error("上传场景参考图失败，请稍后重试");
      console.error("上传场景参考图失败:", sceneId, error);
    }
  }
}

// 处理主图上传
async function handleUploadMainImage(sceneId: string, files: File[]) {
  for (const file of files) {
    try {
      await scriptEditStore.uploadMainImage(sceneId, file);
      message.success("主图上传成功");
    } catch (error) {
      message.error("上传场景主图失败，请稍后重试");
      console.error("上传场景主图失败:", sceneId, error);
    }
  }
}

// 处理模型变更
function handleModelChange(modelId: string) {
  // ISSUE-07 修复：使用 store 的统一方法切换模型，同时清理生成状态
  scriptEditStore.switchAssetStepModel("scenes", modelId);
}
</script>

<template>
  <asset-step
    step-id="scene"
    title="场景生成"
    description="生成剧本所需的场景设定和环境"
    :step-number="3"
    :assets="scenes"
    :images="sceneImages"
    :main-image-ids="mainImageIds"
    :status="stepState.status"
    :computed-status="computedStatus"
    :model-id="stepState.modelId"
    :progress="stepState.progress"
    :loading="scriptEditStore.isLoading"
    :generating-ids="generatingIds"
    :generation-progress="generationProgress"
    :generation-errors="generationErrors"
    :image-aspect-ratio="sceneImageAspectRatio"
    :project-id="projectId"
    :script-id="scriptId"
    :is-parsing-script="isParsingScript"
    @generate="handleGenerate"
    @generate-batch="handleGenerateBatch"
    @update-asset="handleUpdateAsset"
    @delete-asset="handleDeleteAsset"
    @delete-image="handleDeleteImage"
    @upload-reference="handleUploadReference"
    @upload-main-image="handleUploadMainImage"
    @model-change="handleModelChange"
  />
</template>
