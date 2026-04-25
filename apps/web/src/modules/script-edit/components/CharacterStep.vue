<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useMessage } from "naive-ui";
import AssetStep from "./AssetStep.vue";
import { useScriptEditStore } from "../store/scriptEdit";
import type { CharacterRef, AssetImage } from "@pixaura/shared-types";
import { useTtsStore } from "@/stores/tts";

// Props
const props = defineProps<{
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
const ttsStore = useTtsStore();
const message = useMessage();

// 组件挂载时加载音色数据
onMounted(() => {
  ttsStore.loadVoices();
});

// 计算属性
const stepState = computed(() => scriptEditStore.steps.characters);

// 剧本步骤是否正在解析
const isParsingScript = computed(
  () => scriptEditStore.steps.script.status === "parsing",
);

const characters = computed(() => stepState.value.items as CharacterRef[]);

// CharacterRef 运行时可能带有 images 字段（图片生成后通过 Object.assign 追加）
type CharacterRefRuntime = CharacterRef & {
  images?: AssetImage[];
};

// 角色图片映射（从 characters items 中提取，图片是运行时动态追加的字段）
const characterImages = computed(() => {
  const images: Record<string, AssetImage[]> = {};
  for (const char of characters.value as CharacterRefRuntime[]) {
    if (char.images && char.images.length > 0) {
      images[char.id] = char.images;
    }
  }
  return images;
});

// 主图ID映射（取第一张非参考图作为主图）
const mainImageIds = computed(() => {
  const ids: Record<string, string> = {};
  for (const char of characters.value as CharacterRefRuntime[]) {
    if (char.images && char.images.length > 0) {
      const mainImg = char.images.find((img) => img.type !== "reference");
      if (mainImg) ids[char.id] = mainImg.id;
    }
  }
  return ids;
});

// 生成中的角色ID列表（从 store 的 imageGeneratingIds 获取）
const generatingIds = computed(() => {
  return Array.from(stepState.value.imageGeneratingIds);
});

// 生成进度映射
const generationProgress = computed(() => {
  return stepState.value.imageGenerationProgress;
});

// 生成错误映射
const generationErrors = computed(() => {
  return stepState.value.imageGenerationErrors;
});

// 处理生成单个角色图片
async function handleGenerate(characterId: string) {
  const character = characters.value.find((c) => c.id === characterId);
  if (!character) return;

  // 从 resolvedAssets 获取描述，无数据时回退到 character 本身的 description
  const resolvedDesc = character.characterId
    ? scriptEditStore.getResolvedCharacterById(character.characterId)?.description
    : undefined;
  const characterDesc = (character as { description?: string }).description;
  const description = resolvedDesc?.trim() ? resolvedDesc : characterDesc;

  // 错误码 1352：描述为空
  if (!description?.trim()) {
    message.warning("请先填写角色描述后再生成图片");
    return;
  }

  // 已有进行中任务
  if (stepState.value.imageGeneratingIds.has(characterId)) {
    message.warning("已有进行中的生成任务，请等待完成");
    return;
  }

  try {
    await scriptEditStore.generateAssetImage(characterId, "character", {
      modelId: stepState.value.modelId || undefined,
    });
  } catch (error: unknown) {
    const err = error as { code?: number; message?: string };
    if (err?.code === 1351) {
      message.warning("已有进行中的生成任务，请等待完成");
    } else if (err?.code === 1352) {
      message.warning("请先填写角色描述后再生成图片");
    } else if (err?.code === 1101) {
      message.error("额度不足，请充值后再试");
    } else {
      message.error("图片生成失败，请稍后重试");
    }
    console.error("生成角色图片失败:", error);
  }
}

// 处理批量生成图片
async function handleGenerateBatch(characterIds: string[]) {
  if (characterIds.length === 0) return;

  // 检查是否所有待生成角色都有描述（从 resolvedAssets 获取，无数据时回退到 character 本身）
  const noDescriptionChars = characterIds
    .map((id) => characters.value.find((c) => c.id === id))
    .filter((c) => {
      if (!c) return true;
      const resolvedDesc = c.characterId
        ? scriptEditStore.getResolvedCharacterById(c.characterId)?.description
        : undefined;
      const characterDesc = (c as { description?: string }).description;
      const desc = resolvedDesc?.trim() ? resolvedDesc : characterDesc;
      return !desc?.trim();
    });

  if (noDescriptionChars.length > 0) {
    message.warning(`有 ${noDescriptionChars.length} 个角色缺少描述，将跳过`);
  }

  try {
    await scriptEditStore.batchGenerateAssetImages("character", {
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
    console.error("批量生成角色图片失败:", error);
  }
}

// 处理角色更新
async function handleUpdateAsset(
  characterId: string,
  data: Partial<CharacterRef>,
) {
  try {
    await scriptEditStore.updateAssetRef("character", characterId, data);
  } catch (error) {
    message.error("保存角色信息失败，请稍后重试");
    console.error("保存角色信息失败:", error);
  }
}

// 处理角色删除
async function handleDeleteAsset(characterId: string) {
  try {
    await scriptEditStore.deleteAsset("character", characterId);
    message.success("角色已删除");
  } catch (error) {
    message.error("删除角色失败，请稍后重试");
    console.error("删除角色失败:", error);
  }
}

// 处理图片删除
async function handleDeleteImage(characterId: string, imageId: string) {
  try {
    await scriptEditStore.deleteAssetImage(characterId, imageId);
  } catch (error) {
    message.error("删除图片失败，请稍后重试");
    console.error("删除图片失败:", error);
  }
}

// 处理参考图片上传
async function handleUploadReference(characterId: string, files: File[]) {
  for (const file of files) {
    try {
      await scriptEditStore.uploadReferenceImage(characterId, file);
      message.success("参考图上传成功");
    } catch (error) {
      message.error("上传角色参考图失败，请稍后重试");
      console.error("上传角色参考图失败:", characterId, error);
    }
  }
}

// 处理主图上传
async function handleUploadMainImage(characterId: string, files: File[]) {
  for (const file of files) {
    try {
      await scriptEditStore.uploadMainImage(characterId, file);
      message.success("主图上传成功");
    } catch (error) {
      message.error("上传角色主图失败，请稍后重试");
      console.error("上传角色主图失败:", characterId, error);
    }
  }
}

// 处理模型变更
function handleModelChange(modelId: string) {
  // ISSUE-07 修复：使用 store 的统一方法切换模型，同时清理生成状态
  scriptEditStore.switchAssetStepModel("characters", modelId);
}

// 处理角色音色更新
async function handleUpdateVoice(
  characterId: string,
  voiceId: string | undefined,
) {
  try {
    await scriptEditStore.updateAssetRef("character", characterId, {
      voiceId,
    } as Partial<CharacterRef>);
  } catch (error) {
    message.error("保存角色音色失败，请稍后重试");
    console.error("保存角色音色失败:", error);
  }
}
</script>

<template>
  <asset-step
    step-id="character"
    title="角色生成"
    description="基于剧本内容生成角色设定和形象"
    :step-number="2"
    :assets="characters"
    :images="characterImages"
    :main-image-ids="mainImageIds"
    :status="stepState.status"
    :computed-status="props.computedStatus"
    :model-id="stepState.modelId"
    :progress="stepState.progress"
    :loading="scriptEditStore.isLoading"
    :generating-ids="generatingIds"
    :generation-progress="generationProgress"
    :generation-errors="generationErrors"
    :project-id="props.projectId"
    :script-id="props.scriptId"
    :voices="ttsStore.voices"
    :voices-loading="ttsStore.voicesLoading"
    :is-parsing-script="isParsingScript"
    @generate="handleGenerate"
    @generate-batch="handleGenerateBatch"
    @update-asset="handleUpdateAsset"
    @delete-asset="handleDeleteAsset"
    @delete-image="handleDeleteImage"
    @upload-reference="handleUploadReference"
    @upload-main-image="handleUploadMainImage"
    @model-change="handleModelChange"
    @update-voice="handleUpdateVoice"
  />
</template>
