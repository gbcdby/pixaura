<script setup lang="ts">
import { computed } from "vue";
import { useMessage } from "naive-ui";
import AssetStep from "./AssetStep.vue";
import { useScriptEditStore } from "../store/scriptEdit";
import type { PropRef, AssetImage } from "@pixaura/shared-types";

// Props
defineProps<{
  projectId: string;
  scriptId: string;
  // 计算后的状态（考虑依赖链），优先使用此状态
  computedStatus?: import("../store/types").StepStatusType;
}>();

// Emits
defineEmits<{
  generated: [];
  error: [message: string];
}>();

// Store
const scriptEditStore = useScriptEditStore();
const message = useMessage();

// 计算属性
const stepState = computed(() => scriptEditStore.steps.props);

// 剧本步骤是否正在解析
const isParsingScript = computed(
  () => scriptEditStore.steps.script.status === "parsing",
);

const propList = computed(() => stepState.value.items as PropRef[]);

// PropRef 运行时可能带有 images 字段（图片生成后通过 Object.assign 追加）
type PropRefRuntime = PropRef & {
  images?: AssetImage[];
};

// 道具图片映射（从 props items 中提取，图片是运行时动态追加的字段）
const propImages = computed(() => {
  const images: Record<string, AssetImage[]> = {};
  for (const prop of propList.value as PropRefRuntime[]) {
    if (prop.images && prop.images.length > 0) {
      images[prop.id] = prop.images;
    }
  }
  return images;
});

// 主图ID映射（取第一张非参考图作为主图）
const mainImageIds = computed(() => {
  const ids: Record<string, string> = {};
  for (const prop of propList.value as PropRefRuntime[]) {
    if (prop.images && prop.images.length > 0) {
      const mainImg = prop.images.find((img) => img.type !== "reference");
      if (mainImg) ids[prop.id] = mainImg.id;
    }
  }
  return ids;
});

// 生成中的道具ID列表（从 store 的 imageGeneratingIds 获取）
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

// 处理生成单个道具图片
async function handleGenerate(propId: string) {
  const prop = propList.value.find((p) => p.id === propId);
  if (!prop) return;

  // 从 resolvedAssets 获取描述（Phase 4 后 ref 中无 description）
  const description = prop.propId
    ? scriptEditStore.getResolvedPropById(prop.propId)?.description
    : undefined;

  // 描述为空时提示
  if (!description?.trim()) {
    message.warning("请先填写道具描述后再生成图片");
    return;
  }

  if (stepState.value.imageGeneratingIds.has(propId)) {
    message.warning("已有进行中的生成任务，请等待完成");
    return;
  }

  try {
    await scriptEditStore.generateAssetImage(propId, "prop", {
      modelId: stepState.value.modelId || undefined,
    });
  } catch (error: unknown) {
    const err = error as { code?: number; message?: string };
    if (err?.code === 1351) {
      message.warning("已有进行中的生成任务，请等待完成");
    } else if (err?.code === 1352) {
      message.warning("请先填写道具描述后再生成图片");
    } else if (err?.code === 1101) {
      message.error("额度不足，请充值后再试");
    } else {
      message.error("图片生成失败，请稍后重试");
    }
    console.error("生成道具图片失败:", error);
  }
}

// 处理批量生成
async function handleGenerateBatch(propIds: string[]) {
  if (propIds.length === 0) return;

  // 检查是否所有待生成道具都有描述（从 resolvedAssets 获取）
  const noDescriptionProps = propIds
    .map((id) => propList.value.find((p) => p.id === id))
    .filter((p) => {
      if (!p) return true;
      const desc = p.propId
        ? scriptEditStore.getResolvedPropById(p.propId)?.description
        : undefined;
      return !desc?.trim();
    });

  if (noDescriptionProps.length > 0) {
    message.warning(`有 ${noDescriptionProps.length} 个道具缺少描述，将跳过`);
  }

  try {
    await scriptEditStore.batchGenerateAssetImages("prop", {
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
    console.error("批量生成道具图片失败:", error);
  }
}

// 处理道具更新
async function handleUpdateAsset(propId: string, data: Partial<PropRef>) {
  try {
    await scriptEditStore.updateAssetRef("prop", propId, data);
  } catch (error) {
    message.error("保存道具信息失败，请稍后重试");
    console.error("保存道具信息失败:", error);
  }
}

// 处理道具删除
async function handleDeleteAsset(propId: string) {
  try {
    await scriptEditStore.deleteAsset("prop", propId);
    message.success("道具已删除");
  } catch (error) {
    message.error("删除道具失败，请稍后重试");
    console.error("删除道具失败:", error);
  }
}

// 处理图片删除
async function handleDeleteImage(propId: string, imageId: string) {
  try {
    await scriptEditStore.deleteAssetImage(propId, imageId);
  } catch (error) {
    message.error("删除图片失败，请稍后重试");
    console.error("删除图片失败:", error);
  }
}

// 处理参考图片上传
async function handleUploadReference(propId: string, files: File[]) {
  for (const file of files) {
    try {
      await scriptEditStore.uploadReferenceImage(propId, file);
      message.success("参考图上传成功");
    } catch (error) {
      message.error("上传道具参考图失败，请稍后重试");
      console.error("上传道具参考图失败:", propId, error);
    }
  }
}

// 处理主图上传
async function handleUploadMainImage(propId: string, files: File[]) {
  for (const file of files) {
    try {
      await scriptEditStore.uploadMainImage(propId, file);
      message.success("主图上传成功");
    } catch (error) {
      message.error("上传道具主图失败，请稍后重试");
      console.error("上传道具主图失败:", propId, error);
    }
  }
}

// 处理模型变更
function handleModelChange(modelId: string) {
  // ISSUE-07 修复：使用 store 的统一方法切换模型，同时清理生成状态
  scriptEditStore.switchAssetStepModel("props", modelId);
}
</script>

<template>
  <asset-step
    step-id="prop"
    title="道具生成"
    description="生成剧本所需的道具清单和形象"
    :step-number="4"
    :assets="propList"
    :images="propImages"
    :main-image-ids="mainImageIds"
    :status="stepState.status"
    :computed-status="computedStatus"
    :model-id="stepState.modelId"
    :progress="stepState.progress"
    :loading="scriptEditStore.isLoading"
    :generating-ids="generatingIds"
    :generation-progress="generationProgress"
    :generation-errors="generationErrors"
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
