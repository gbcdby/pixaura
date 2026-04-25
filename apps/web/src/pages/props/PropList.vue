<script setup lang="ts">
import { onMounted, watch, ref, onBeforeUnmount } from "vue";
import { useRoute } from "vue-router";
import { usePropStore } from "@/modules/prop/store";
import { propApi } from "@/modules/prop/api";
import { PropImageType } from "@pixaura/shared-types";
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
import PropCrossProjectImport from "@/modules/prop/components/PropCrossProjectImport.vue";
import ReadOnlyAssetCard from "@/components/asset/ReadOnlyAssetCard.vue";
import AssetEditModal from "@/components/asset/AssetEditModal.vue";
import type { PropListItemDto, CreatePropDto, UpdatePropDto } from "@pixaura/shared-types";

const route = useRoute();
const message = useMessage();
const dialog = useDialog();
const propStore = usePropStore();
const { props, loading, pagination, listFilters } = storeToRefs(propStore);
const scriptModelsStore = useScriptModelsStore();
const projectStore = useProjectStore();

const projectId = route.params.id as string;
const showImportModal = ref(false);

// 编辑弹窗状态
const editModalVisible = ref(false);
const editingProp = ref<PropListItemDto | { id: string; name: string } | null>(null);
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
  loadProps();
  loadModelConfig();
});

watch(
  listFilters,
  () => {
    pagination.value.page = 1;
    loadProps();
  },
  { deep: true }
);

async function loadProps() {
  await propStore.queryProps(projectId);
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
  // 新建道具时设置空状态
  editingProp.value = {
    id: "",
    name: "",
  };
  editModalVisible.value = true;
}

function handleCardClick(prop: PropListItemDto) {
  editingProp.value = prop;
  editModalVisible.value = true;
}

async function handleSave(data: { name?: string; description?: string | null }) {
  if (!editingProp.value) return;

  editLoading.value = true;
  try {
    if (editingProp.value.id) {
      // 更新现有道具
      const updateData: UpdatePropDto = {
        name: data.name,
        description: data.description === null ? undefined : data.description,
      };
      await propStore.updateProp(editingProp.value.id, updateData);
      message.success("保存成功");
    } else {
      // 创建新道具
      const createData: CreatePropDto = {
        name: data.name || "新道具",
        description: data.description === null ? undefined : data.description,
        importance: "background", // 默认背景道具
      };
      await propStore.createProp(projectId, createData);
      message.success("创建成功");
    }
    await loadProps();
    editModalVisible.value = false;
  } catch (error) {
    message.error("保存失败");
  } finally {
    editLoading.value = false;
  }
}

async function handleDelete(id: string) {
  try {
    await propStore.deleteProp(id);
    message.success("删除成功");
    await loadProps();
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
  if (selectedIds.value.length === props.value.length) {
    selectedIds.value = [];
  } else {
    selectedIds.value = props.value.map((p) => p.id);
  }
}

function handleBatchDelete() {
  if (selectedIds.value.length === 0) return;

  dialog.warning({
    title: "确认删除",
    content: `确定要删除已选的 ${selectedIds.value.length} 个道具吗？此操作不可恢复。`,
    positiveText: "删除",
    negativeText: "取消",
    onPositiveClick: async () => {
      try {
        await propStore.batchDeleteProps(selectedIds.value);
        message.success("批量删除成功");
        exitBatchMode();
        await loadProps();
      } catch (error) {
        message.error("批量删除失败");
      }
    },
  });
}

async function handleGenerateImage(id: string) {
  if (!id) {
    message.warning("请先保存道具后再生成图片");
    return;
  }
  try {
    editLoading.value = true;
    generatingStatus.value = "processing";
    generatingProgress.value = 0;

    // 收集当前道具的参考图 URL
    const currentProp = props.value.find((p) => p.id === id);
    const referenceImages = currentProp?.images?.referenceImages
      ?.map((img) => img.url)
      .filter((url): url is string => !!url);

    const result = await propApi.generateImage(id, {
      modelId: imageModelId.value || "default",
      type: PropImageType.FRONT_VIEW,
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
        loadProps().then(() => {
          // 同步更新编辑弹窗中的数据
          const updatedProp = props.value.find((p) => p.id === editingProp.value?.id);
          if (updatedProp) {
            editingProp.value = updatedProp;
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
  if (!editingProp.value?.id) {
    message.warning("请先保存道具后再上传图片");
    return;
  }
  if (files.length === 0) return;

  editLoading.value = true;
  try {
    const file = files[0];
    await propApi.uploadImage(editingProp.value.id, { type: PropImageType.FRONT_VIEW }, file);
    message.success("图片上传成功");
    // 刷新列表
    await loadProps();
    // 同步更新编辑弹窗中的数据
    const updatedProp = props.value.find((p) => p.id === editingProp.value?.id);
    if (updatedProp) {
      editingProp.value = updatedProp;
    }
  } catch (error) {
    message.error("图片上传失败");
  } finally {
    editLoading.value = false;
  }
}

async function handleDeleteImage(imageId: string) {
  if (!editingProp.value?.id) return;

  try {
    await propApi.deleteImage(editingProp.value.id, imageId);
    message.success("图片删除成功");
    await loadProps();
    // 同步更新编辑弹窗中的数据
    const updatedProp = props.value.find((p) => p.id === editingProp.value?.id);
    if (updatedProp) {
      editingProp.value = updatedProp;
    }
  } catch (error) {
    message.error("图片删除失败");
  }
}

// 参考图上传
async function handleUploadReference(files: File[]) {
  if (!editingProp.value?.id) {
    message.warning("请先保存道具后再上传参考图");
    return;
  }
  if (files.length === 0) return;

  editLoading.value = true;
  try {
    const file = files[0];
    await propApi.uploadImage(editingProp.value.id, { type: PropImageType.ADDITIONAL }, file);
    message.success("参考图上传成功");
    // 刷新列表
    await loadProps();
    // 同步更新编辑弹窗中的数据
    const updatedProp = props.value.find((p) => p.id === editingProp.value?.id);
    if (updatedProp) {
      editingProp.value = updatedProp;
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
  if (!editingProp.value) return null;
  if (!editingProp.value.id) {
    // 新建状态
    return {
      id: "",
      name: "",
      description: "",
      status: "draft",
      images: undefined,
    };
  }
  // 现有道具
  const prop = editingProp.value as PropListItemDto;
  return {
    id: prop.id,
    name: prop.name,
    description: prop.description,
    status: prop.status,
    images: prop.images,
  };
}
</script>

<template>
  <div class="prop-list">
    <!-- 页面标题栏 -->
    <n-card :bordered="false" class="header-card">
      <div class="header-content">
        <div class="header-title">
          <h1>道具库</h1>
          <p class="subtitle">管理剧本中的道具元素与外观图片</p>
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
            新建道具
          </n-button>
        </div>
      </div>
    </n-card>

    <!-- 筛选栏 -->
    <n-card :bordered="false" class="filter-card">
      <n-input
        v-model:value="listFilters.search"
        placeholder="搜索道具名称"
        clearable
        style="width: 240px"
      >
        <template #prefix>
          <n-icon><Search /></n-icon>
        </template>
      </n-input>
    </n-card>

    <!-- 道具列表 -->
    <NSpin :show="loading">
      <NEmpty
        v-if="props.length === 0 && !loading"
        description="暂无道具"
      />

      <!-- Grid 卡片布局 -->
      <div
        v-else
        class="asset-grid-container"
      >
        <ReadOnlyAssetCard
          v-for="prop in props"
          :key="prop.id"
          type="prop"
          :data="{
            id: prop.id,
            name: prop.name,
            description: prop.description,
            status: prop.status,
            images: prop.images,
          }"
          :selectable="isBatchMode"
          :selected="selectedIds.includes(prop.id)"
          @click="handleCardClick(prop)"
          @select="toggleSelection(prop.id)"
        />
      </div>
    </NSpin>

    <!-- 批量操作栏 -->
    <div v-if="isBatchMode" class="batch-action-bar">
      <div class="batch-info">
        <span>已选择 {{ selectedIds.length }} 项</span>
        <n-button text @click="selectAll">
          {{ selectedIds.length === props.length ? '取消全选' : '全选' }}
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
        @update:page="loadProps"
      />
    </div>

    <!-- 跨项目导入弹窗 -->
    <PropCrossProjectImport
      v-model:show="showImportModal"
      :project-id="projectId"
      @success="loadProps"
    />

    <!-- 编辑弹窗 -->
    <AssetEditModal
      v-model:show="editModalVisible"
      type="prop"
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
.prop-list {
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
  .prop-list {
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