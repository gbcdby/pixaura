<script setup lang="ts">
import { onMounted, watch, ref, onBeforeUnmount } from "vue";
import { useRoute } from "vue-router";
import { useCharacterStore } from "@/modules/character/store";
import { characterApi } from "@/modules/character/api";
import { CharacterImageType } from "@pixaura/shared-types";
import { storeToRefs } from "pinia";
import {
  NButton,
  NInput,
  NPagination,
  NEmpty,
  NSpin,
  NCard,
  NIcon,
  useMessage,
  useDialog,
} from "naive-ui";
import { Search, Plus, Trash2 } from "lucide-vue-next";
import {
  useWebSocketStore,
  type GenerationProgressData,
  type GenerationFailedData,
} from "@/stores/websocket";
import { useScriptModelsStore } from "@/stores/script-models";
import { useProjectStore } from "@/stores/project";
import CrossProjectImport from "@/modules/character/components/CrossProjectImport.vue";
import ReadOnlyAssetCard from "@/components/asset/ReadOnlyAssetCard.vue";
import AssetEditModal from "@/components/asset/AssetEditModal.vue";
import type { CharacterListItemDto, CreateCharacterDto, UpdateCharacterDto } from "@pixaura/shared-types";

const route = useRoute();
const message = useMessage();
const dialog = useDialog();
const characterStore = useCharacterStore();
const { characters, loading, pagination, listFilters } = storeToRefs(characterStore);
const scriptModelsStore = useScriptModelsStore();
const projectStore = useProjectStore();

const projectId = route.params.id as string;

// 导入弹窗状态
const showImportModal = ref(false);

// 编辑弹窗状态
const editModalVisible = ref(false);
// 编辑数据：可以是现有角色（CharacterListItemDto）或新建状态（部分字段）
const editingCharacter = ref<CharacterListItemDto | { id: string; name: string } | null>(null);
const editLoading = ref(false);

// 图片模型配置
const imageModelId = ref<string>("");
const maxReferenceImages = ref<number>(3);

// 图片生成进度
const generatingTaskId = ref("");
const generatingProgress = ref(0);
const generatingStatus = ref<"idle" | "processing" | "completed" | "failed">("idle");

// 批量删除
const isBatchMode = ref(false);
const selectedIds = ref<string[]>([]);

onMounted(() => {
  loadCharacters();
  loadModelConfig();
});

watch(
  listFilters,
  () => {
    pagination.value.page = 1;
    loadCharacters();
  },
  { deep: true }
);

async function loadCharacters() {
  await characterStore.queryCharacters(projectId);
}

// 加载图片模型配置
async function loadModelConfig() {
  try {
    // 加载可用模型列表（不需要 projectId/scriptId，只获取全局模型列表）
    await scriptModelsStore.loadModels(projectId);

    // 获取项目模型配置
    const { configs } = await projectStore.fetchModelConfigs(projectId);

    // 获取 IMAGE_GENERATION 类别的 modelId
    const imageConfig = configs["IMAGE_GENERATION"];
    if (imageConfig?.modelId) {
      imageModelId.value = imageConfig.modelId;

      // 获取模型的 defaultParams
      const params = scriptModelsStore.getModelDefaultParams(imageConfig.modelId);
      // DB 存储格式可能为驼峰或下划线，均需兼容
      const maxRef =
        params.max_references ?? params.maxReferences ?? params.max_references_images ?? params.maxReferencesImages;
      maxReferenceImages.value = typeof maxRef === "number" ? maxRef : 3;
    } else {
      // 如果没有项目配置，使用第一个可用模型
      const imageModels = scriptModelsStore.imageGenerationModels;
      if (imageModels.length > 0) {
        // ModelOptionWithPrice 类型中 modelId 存储在 value 属性
        imageModelId.value = imageModels[0].value as string;
        const params = scriptModelsStore.getModelDefaultParams(imageModels[0].value as string);
        const maxRef =
          params.max_references ?? params.maxReferences ?? params.max_references_images ?? params.maxReferencesImages;
        maxReferenceImages.value = typeof maxRef === "number" ? maxRef : 3;
      }
    }
  } catch (error) {
    console.error("加载模型配置失败:", error);
    // 使用默认值
    imageModelId.value = "default";
    maxReferenceImages.value = 3;
  }
}

function handleCreate() {
  // 新建角色时设置空状态
  editingCharacter.value = {
    id: "",
    name: "",
  };
  editModalVisible.value = true;
}

function handleCardClick(character: CharacterListItemDto) {
  editingCharacter.value = character;
  editModalVisible.value = true;
}

async function handleSave(data: { name?: string; description?: string | null; gender?: string; age?: string }) {
  if (!editingCharacter.value) return;

  editLoading.value = true;
  try {
    if (editingCharacter.value.id) {
      // 更新现有角色
      const updateData: UpdateCharacterDto = {
        name: data.name,
        description: data.description === null ? undefined : data.description,
        gender: data.gender as "male" | "female" | "other" | "unknown" | undefined,
        age: data.age,
      };
      await characterStore.updateCharacter(editingCharacter.value.id, updateData);
      message.success("保存成功");
    } else {
      // 创建新角色
      const createData: CreateCharacterDto = {
        name: data.name || "新角色",
        description: data.description === null ? undefined : data.description,
        gender: data.gender as "male" | "female" | "other" | "unknown" | undefined,
        age: data.age,
        importance: "minor", // 默认次要角色
      };
      await characterStore.createCharacter(projectId, createData);
      message.success("创建成功");
    }
    await loadCharacters();
    editModalVisible.value = false;
  } catch (error) {
    message.error("保存失败");
  } finally {
    editLoading.value = false;
  }
}

async function handleDelete(id: string) {
  try {
    await characterStore.deleteCharacter(id);
    message.success("删除成功");
    await loadCharacters();
    editModalVisible.value = false;
  } catch (error) {
    message.error("删除失败");
  }
}

function enterBatchMode() {
  isBatchMode.value = true;
  selectedIds.value = [];
}

function exitBatchMode() {
  isBatchMode.value = false;
  selectedIds.value = [];
}

function toggleSelection(id: string) {
  const idx = selectedIds.value.indexOf(id);
  if (idx > -1) {
    selectedIds.value.splice(idx, 1);
  } else {
    selectedIds.value.push(id);
  }
}

function selectAll() {
  if (selectedIds.value.length === characters.value.length) {
    selectedIds.value = [];
  } else {
    selectedIds.value = characters.value.map((c) => c.id);
  }
}

function handleBatchDelete() {
  if (selectedIds.value.length === 0) return;

  dialog.warning({
    title: "确认删除",
    content: `确定要删除已选的 ${selectedIds.value.length} 个角色吗？此操作不可恢复。`,
    positiveText: "删除",
    negativeText: "取消",
    onPositiveClick: async () => {
      try {
        await characterStore.batchDeleteCharacters(selectedIds.value);
        message.success("批量删除成功");
        exitBatchMode();
        await loadCharacters();
      } catch (error) {
        message.error("批量删除失败");
      }
    },
  });
}

async function handleGenerateImage(id: string) {
  if (!id) {
    message.warning("请先保存角色后再生成图片");
    return;
  }
  try {
    editLoading.value = true;
    generatingStatus.value = "processing";
    generatingProgress.value = 0;

    // 收集当前角色的参考图 URL
    const currentChar = characters.value.find((c) => c.id === id);
    const referenceImages = currentChar?.images?.referenceImages
      ?.map((img) => img.url)
      .filter((url): url is string => !!url);

    const result = await characterApi.generateImage(id, {
      modelId: imageModelId.value || "default",
      type: CharacterImageType.FRONT_VIEW,
      useAppearance: true,
      referenceImages: referenceImages && referenceImages.length > 0 ? referenceImages : undefined,
    });
    const taskId = result.data.generationTaskId;
    generatingTaskId.value = taskId;

    // 确保 WebSocket 已连接
    const wsStore = useWebSocketStore();
    if (!wsStore.isConnected) {
      await wsStore.connect().catch(console.error);
    }

    // 立即订阅 - handler 会在消息到达时立即处理
    wsStore.subscribe(taskId, {
      onProgress: (data: GenerationProgressData) => {
        if (data.taskId === taskId) {
          generatingProgress.value = data.progress;
        }
      },
      onComplete: () => {
        generatingStatus.value = "completed";
        generatingProgress.value = 100;
        message.success("图片生成完成");
        loadCharacters().then(() => {
          // 同步更新编辑弹窗中的数据
          const updatedChar = characters.value.find((c) => c.id === editingCharacter.value?.id);
          if (updatedChar) {
            editingCharacter.value = updatedChar as CharacterListItemDto;
          }
        });
        // 延迟重置状态让用户看到完成效果
        setTimeout(() => {
          generatingStatus.value = "idle";
          generatingTaskId.value = "";
        }, 1000);
      },
      onFailed: (data: GenerationFailedData) => {
        generatingStatus.value = "failed";
        message.error("图片生成失败: " + data.errorMessage);
        setTimeout(() => {
          generatingStatus.value = "idle";
          generatingTaskId.value = "";
        }, 3000);
      },
    });
  } catch (error) {
    generatingStatus.value = "idle";
    message.error("图片生成请求失败");
  } finally {
    editLoading.value = false;
  }
}

async function handleUploadImage(files: File[]) {
  if (!editingCharacter.value?.id) {
    message.warning("请先保存角色后再上传图片");
    return;
  }
  if (files.length === 0) return;

  editLoading.value = true;
  try {
    const file = files[0];
    await characterApi.uploadImage(editingCharacter.value.id, { type: CharacterImageType.FRONT_VIEW }, file);
    message.success("图片上传成功");
    // 刷新列表
    await loadCharacters();
    // 同步更新编辑弹窗中的数据
    const updatedChar = characters.value.find((c) => c.id === editingCharacter.value?.id);
    if (updatedChar) {
      editingCharacter.value = updatedChar as CharacterListItemDto;
    }
  } catch (error) {
    message.error("图片上传失败");
  } finally {
    editLoading.value = false;
  }
}

async function handleDeleteImage(imageId: string) {
  if (!editingCharacter.value?.id) return;

  try {
    await characterApi.deleteImage(editingCharacter.value.id, imageId);
    message.success("图片删除成功");
    await loadCharacters();
    // 同步更新编辑弹窗中的数据
    const updatedCharacter = characters.value.find((c) => c.id === editingCharacter.value?.id);
    if (updatedCharacter) {
      editingCharacter.value = updatedCharacter;
    }
  } catch (error) {
    message.error("图片删除失败");
  }
}

// 参考图上传
async function handleUploadReference(files: File[]) {
  if (!editingCharacter.value?.id) {
    message.warning("请先保存角色后再上传参考图");
    return;
  }
  if (files.length === 0) return;

  editLoading.value = true;
  try {
    const file = files[0];
    await characterApi.uploadImage(editingCharacter.value.id, { type: CharacterImageType.ADDITIONAL }, file);
    message.success("参考图上传成功");
    // 刷新列表
    await loadCharacters();
    // 同步更新编辑弹窗中的数据
    const updatedChar = characters.value.find((c) => c.id === editingCharacter.value?.id);
    if (updatedChar) {
      editingCharacter.value = updatedChar as CharacterListItemDto;
    }
  } catch (error) {
    message.error("参考图上传失败");
  } finally {
    editLoading.value = false;
  }
}

// 组件卸载时取消订阅
onBeforeUnmount(() => {
  if (generatingTaskId.value) {
    useWebSocketStore().unsubscribe(generatingTaskId.value);
  }
});

// 将编辑数据转换为 AssetEditModal 期望的格式
function getEditData() {
  if (!editingCharacter.value) return null;
  if (!editingCharacter.value.id) {
    // 新建状态
    return {
      id: "",
      name: "",
      description: "",
      status: "draft",
      gender: undefined,
      age: undefined,
      images: undefined,
    };
  }
  // 现有角色
  const char = editingCharacter.value as CharacterListItemDto;
  return {
    id: char.id,
    name: char.name,
    description: char.description,
    status: char.status,
    gender: char.gender ?? undefined,
    age: char.age ?? undefined,
    images: char.images,
  };
}
</script>

<template>
  <div class="character-list">
    <!-- 页面标题栏 -->
    <n-card :bordered="false" class="header-card">
      <div class="header-content">
        <div class="header-title">
          <h1>角色库</h1>
          <p class="subtitle">管理剧本中的角色设定与外观图片</p>
        </div>
        <div class="header-actions">
          <n-button v-if="!isBatchMode" quaternary @click="enterBatchMode">
            <template #icon>
              <n-icon><Trash2 /></n-icon>
            </template>
            批量删除
          </n-button>
          <n-button type="primary" @click="handleCreate">
            <template #icon>
              <n-icon><Plus /></n-icon>
            </template>
            新建角色
          </n-button>
        </div>
      </div>
    </n-card>

    <!-- 筛选栏 -->
    <n-card :bordered="false" class="filter-card">
      <n-input
        v-model:value="listFilters.search"
        placeholder="搜索角色名称"
        clearable
        style="width: 240px"
      >
        <template #prefix>
          <n-icon><Search /></n-icon>
        </template>
      </n-input>
    </n-card>

    <!-- 角色列表 -->
    <NSpin :show="loading">
      <NEmpty
        v-if="characters.length === 0 && !loading"
        description="暂无角色"
      />

      <!-- Grid 卡片布局 -->
      <div
        v-else
        class="asset-grid-container"
      >
        <ReadOnlyAssetCard
          v-for="character in characters"
          :key="character.id"
          type="character"
          :data="{
            id: character.id,
            name: character.name,
            description: character.description,
            status: character.status,
            gender: character.gender ?? undefined,
            age: character.age ?? undefined,
            images: character.images,
          }"
          :selectable="isBatchMode"
          :selected="selectedIds.includes(character.id)"
          @click="handleCardClick(character)"
          @select="toggleSelection(character.id)"
        />
      </div>
    </NSpin>

    <!-- 批量操作栏 -->
    <div v-if="isBatchMode" class="batch-action-bar">
      <div class="batch-info">
        <span>已选择 {{ selectedIds.length }} 项</span>
        <n-button text @click="selectAll">
          {{ selectedIds.length === characters.length ? '取消全选' : '全选' }}
        </n-button>
      </div>
      <div class="batch-actions">
        <n-button @click="exitBatchMode">取消</n-button>
        <n-button type="error" :disabled="selectedIds.length === 0" @click="handleBatchDelete">
          删除
        </n-button>
      </div>
    </div>

    <!-- 分页 -->
    <div
      v-if="pagination.totalPages > 1 && !isBatchMode"
      class="pagination"
    >
      <NPagination
        v-model:page="pagination.page"
        :page-count="pagination.totalPages"
        :page-size="pagination.pageSize"
        @update:page="loadCharacters"
      />
    </div>

    <!-- 跨项目导入弹窗 -->
    <CrossProjectImport
      v-model:show="showImportModal"
      :project-id="projectId"
      @success="loadCharacters"
    />

    <!-- 编辑弹窗 -->
    <AssetEditModal
      v-model:show="editModalVisible"
      type="character"
      :data="getEditData()"
      :loading="editLoading"
      :progress="generatingStatus === 'processing' ? generatingProgress : generatingStatus === 'completed' ? 100 : 0"
      :generating="generatingStatus === 'processing'"
      :max-reference-images="maxReferenceImages"
      @save="handleSave"
      @delete="handleDelete"
      @generate-image="handleGenerateImage"
      @upload-image="handleUploadImage"
      @delete-image="handleDeleteImage"
      @upload-reference="handleUploadReference"
    />
  </div>
</template>

<style scoped lang="scss">
.character-list {
  .header-card {
    margin-bottom: 16px;

    :deep(.n-card__content) {
      padding: 20px 24px;
    }

    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .header-actions {
        display: flex;
        gap: 8px;
      }

      .header-title {
        h1 {
          font-size: 20px;
          font-weight: 600;
          color: #1a1a1a;
          margin: 0 0 4px;
        }

        .subtitle {
          font-size: 13px;
          color: #666;
          margin: 0;
        }
      }
    }
  }

  .filter-card {
    margin-bottom: 16px;

    :deep(.n-card__content) {
      padding: 16px 24px;
    }
  }

  // 布局改为 grid 一行四个，上下滚动
  .asset-grid-container {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    padding: 16px 24px;
  }

  .pagination {
    margin-top: 24px;
    display: flex;
    justify-content: center;
  }

  .batch-action-bar {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 24px;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
    border: 1px solid #f0f0f5;
    z-index: 100;

    .batch-info {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 14px;
      color: #666;
    }

    .batch-actions {
      display: flex;
      gap: 8px;
    }
  }
}

// 暗黑模式适配
[data-theme="dark"] {
  .character-list {
    .header-card .header-title h1 {
      color: #e0e0e0;
    }

    .batch-action-bar {
      background: rgba(24, 24, 40, 0.95);
      border-color: #3a3a5a;

      .batch-info {
        color: #a0a0b8;
      }
    }
  }
}
</style>