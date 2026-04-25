<script setup lang="ts">
import { onMounted, watch, ref, onBeforeUnmount } from "vue";
import { useRoute } from "vue-router";
import { useSceneStore } from "@/modules/scene/store";
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
import ReadOnlyAssetCard from "@/components/asset/ReadOnlyAssetCard.vue";
import AssetEditModal from "@/components/asset/AssetEditModal.vue";
import { sceneApi } from "@/modules/scene/api";
import type { SceneListItemDto, CreateSceneDto, UpdateSceneDto } from "@pixaura/shared-types";

const route = useRoute();
const message = useMessage();
const dialog = useDialog();
const sceneStore = useSceneStore();
const { scenes, loading, pagination, listFilters } = storeToRefs(sceneStore);
const scriptModelsStore = useScriptModelsStore();
const projectStore = useProjectStore();

const projectId = route.params.id as string;

// 编辑弹窗状态
const editModalVisible = ref(false);
const editingScene = ref<SceneListItemDto | { id: string; name: string } | null>(null);
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
  loadScenes();
  loadModelConfig();
});

watch(
  listFilters,
  () => {
    pagination.value.page = 1;
    loadScenes();
  },
  { deep: true }
);

async function loadScenes() {
  await sceneStore.queryScenes(projectId);
}

// 加载图片模型配置
async function loadModelConfig() {
  try {
    // 加载可用模型列表
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
  // 新建场景时设置空状态
  editingScene.value = {
    id: "",
    name: "",
  };
  editModalVisible.value = true;
}

function handleCardClick(scene: SceneListItemDto) {
  editingScene.value = scene;
  editModalVisible.value = true;
}

async function handleSave(data: { name?: string; description?: string | null }) {
  if (!editingScene.value) return;

  editLoading.value = true;
  try {
    if (editingScene.value.id) {
      // 更新现有场景
      const updateData: UpdateSceneDto = {
        name: data.name,
        description: data.description === null ? undefined : data.description,
      };
      await sceneStore.updateScene(editingScene.value.id, updateData);
      message.success("保存成功");
    } else {
      // 创建新场景
      const createData: CreateSceneDto = {
        name: data.name || "新场景",
        description: data.description === null ? undefined : data.description,
        type: "interior", // 默认室内场景
      };
      await sceneStore.createScene(projectId, createData);
      message.success("创建成功");
    }
    await loadScenes();
    editModalVisible.value = false;
  } catch (error) {
    message.error("保存失败");
  } finally {
    editLoading.value = false;
  }
}

async function handleDelete(id: string) {
  try {
    await sceneStore.deleteScene(id);
    message.success("删除成功");
    await loadScenes();
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
  if (selectedIds.value.length === scenes.value.length) {
    selectedIds.value = [];
  } else {
    selectedIds.value = scenes.value.map((s) => s.id);
  }
}

function handleBatchDelete() {
  if (selectedIds.value.length === 0) return;

  dialog.warning({
    title: "确认删除",
    content: `确定要删除已选的 ${selectedIds.value.length} 个场景吗？此操作不可恢复。`,
    positiveText: "删除",
    negativeText: "取消",
    onPositiveClick: async () => {
      try {
        await sceneStore.batchDeleteScenes(selectedIds.value);
        message.success("批量删除成功");
        exitBatchMode();
        await loadScenes();
      } catch (error) {
        message.error("批量删除失败");
      }
    },
  });
}

async function handleGenerateImage(id: string) {
  if (!id) {
    message.warning("请先保存场景后再生成图片");
    return;
  }
  try {
    editLoading.value = true;
    generatingStatus.value = "processing";
    generatingProgress.value = 0;

    // 收集当前场景的参考图 URL
    const currentScene = scenes.value.find((s) => s.id === id);
    const referenceImages = currentScene?.images?.referenceImages
      ?.map((img) => img.url)
      .filter((url): url is string => !!url);

    const result = await sceneApi.generateImage(id, {
      modelId: imageModelId.value || "default",
      type: "panorama",
      referenceImages: referenceImages && referenceImages.length > 0 ? referenceImages : undefined,
    });
    const taskId = result.data.generationTaskId;
    generatingTaskId.value = taskId;

    const wsStore = useWebSocketStore();
    if (!wsStore.isConnected) {
      await wsStore.connect().catch(console.error);
    }

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
        loadScenes().then(() => {
          // 同步更新编辑弹窗中的数据
          const updatedScene = scenes.value.find((s) => s.id === editingScene.value?.id);
          if (updatedScene) {
            editingScene.value = updatedScene;
          }
        });
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
  if (!editingScene.value?.id) {
    message.warning("请先保存场景后再上传图片");
    return;
  }
  if (files.length === 0) return;

  editLoading.value = true;
  try {
    const file = files[0];
    await sceneApi.uploadImage(editingScene.value.id, { type: "panorama" }, file);
    message.success("图片上传成功");
    // 刷新列表
    await loadScenes();
    // 同步更新编辑弹窗中的数据
    const updatedScene = scenes.value.find((s) => s.id === editingScene.value?.id);
    if (updatedScene) {
      editingScene.value = updatedScene;
    }
  } catch (error) {
    message.error("图片上传失败");
  } finally {
    editLoading.value = false;
  }
}

async function handleDeleteImage(imageId: string) {
  if (!editingScene.value?.id) return;

  try {
    await sceneApi.deleteImage(editingScene.value.id, imageId);
    message.success("图片删除成功");
    await loadScenes();
    // 同步更新编辑弹窗中的数据
    const updatedScene = scenes.value.find((s) => s.id === editingScene.value?.id);
    if (updatedScene) {
      editingScene.value = updatedScene;
    }
  } catch (error) {
    message.error("图片删除失败");
  }
}

// 参考图上传
async function handleUploadReference(files: File[]) {
  if (!editingScene.value?.id) {
    message.warning("请先保存场景后再上传参考图");
    return;
  }
  if (files.length === 0) return;

  editLoading.value = true;
  try {
    const file = files[0];
    await sceneApi.uploadImage(editingScene.value.id, { type: "additional" }, file);
    message.success("参考图上传成功");
    // 刷新列表
    await loadScenes();
    // 同步更新编辑弹窗中的数据
    const updatedScene = scenes.value.find((s) => s.id === editingScene.value?.id);
    if (updatedScene) {
      editingScene.value = updatedScene;
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
  if (!editingScene.value) return null;
  if (!editingScene.value.id) {
    // 新建状态
    return {
      id: "",
      name: "",
      description: "",
      status: "draft",
      images: undefined,
    };
  }
  // 现有场景
  const scene = editingScene.value as SceneListItemDto;
  return {
    id: scene.id,
    name: scene.name,
    description: scene.description,
    status: scene.status,
    images: scene.images,
  };
}
</script>

<template>
  <div class="scene-list">
    <!-- 页面标题栏 -->
    <n-card :bordered="false" class="header-card">
      <div class="header-content">
        <div class="header-title">
          <h1>场景库</h1>
          <p class="subtitle">管理剧本中的场景设定与背景图片</p>
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
            新建场景
          </n-button>
        </div>
      </div>
    </n-card>

    <!-- 筛选栏 -->
    <n-card :bordered="false" class="filter-card">
      <n-input
        v-model:value="listFilters.search"
        placeholder="搜索场景名称"
        clearable
        style="width: 240px"
      >
        <template #prefix>
          <n-icon><Search /></n-icon>
        </template>
      </n-input>
    </n-card>

    <!-- 场景列表 -->
    <NSpin :show="loading">
      <NEmpty
        v-if="scenes.length === 0 && !loading"
        description="暂无场景"
      />

      <!-- Grid 卡片布局 -->
      <div
        v-else
        class="asset-grid-container"
      >
        <ReadOnlyAssetCard
          v-for="scene in scenes"
          :key="scene.id"
          type="scene"
          :data="{
            id: scene.id,
            name: scene.name,
            description: scene.description,
            status: scene.status,
            images: scene.images,
          }"
          :selectable="isBatchMode"
          :selected="selectedIds.includes(scene.id)"
          @click="handleCardClick(scene)"
          @select="toggleSelection(scene.id)"
        />
      </div>
    </NSpin>

    <!-- 批量操作栏 -->
    <div v-if="isBatchMode" class="batch-action-bar">
      <div class="batch-info">
        <span>已选择 {{ selectedIds.length }} 项</span>
        <n-button text @click="selectAll">
          {{ selectedIds.length === scenes.length ? '取消全选' : '全选' }}
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
        @update:page="loadScenes"
      />
    </div>

    <!-- 编辑弹窗 -->
    <AssetEditModal
      v-model:show="editModalVisible"
      type="scene"
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
.scene-list {
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
    display: flex;
    justify-content: center;
    margin-top: 24px;
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
  .scene-list {
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