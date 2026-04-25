import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { sceneApi } from "../api";
import type {
  SceneListItemDto,
  SceneDetailDto,
  CreateSceneDto,
  UpdateSceneDto,
  QueryScenesDto,
  BatchCreateScenesDto,
  GenerateSceneImageDto,
  UploadSceneImageDto,
  ImportScenesDto,
} from "@pixaura/shared-types";

export const useSceneStore = defineStore("scene", () => {
  // ==================== State ====================
  const scenes = ref<SceneListItemDto[]>([]);
  const currentScene = ref<SceneDetailDto | null>(null);
  const loading = ref(false);
  const generatingImages = ref(false);
  const generationProgress = ref(0);
  const generationTaskId = ref<string | null>(null);

  const pagination = ref({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });

  const listFilters = ref({
    search: "",
    status: null as string | null,
    type: null as string | null,
  });

  // 导入相关
  const importableScenes = ref<SceneListItemDto[]>([]);
  const selectedScenes = ref<string[]>([]);

  // ==================== Getters ====================
  const isDraft = computed(() => currentScene.value?.status === "draft");
  const isActive = computed(() => currentScene.value?.status === "active");
  const isArchived = computed(() => currentScene.value?.status === "archived");
  const canEdit = computed(() => isDraft.value || isActive.value);

  // 按类型组织的图片
  const currentImages = computed(() => {
    if (!currentScene.value) return null;
    return currentScene.value.images;
  });

  // ==================== Actions ====================

  /**
   * 查询场景列表
   */
  async function queryScenes(projectId: string, params?: QueryScenesDto) {
    loading.value = true;
    try {
      const response = await sceneApi.queryScenes(projectId, {
        page: pagination.value.page,
        pageSize: pagination.value.pageSize,
        sortBy: "createdAt",
        sortOrder: "desc",
        search: listFilters.value.search || undefined,
        status:
          (listFilters.value.status as
            | "active"
            | "draft"
            | "archived"
            | undefined) || undefined,
        type:
          (listFilters.value.type as
            | "interior"
            | "exterior"
            | "both"
            | undefined) || undefined,
        ...params,
      });
      scenes.value = (response as unknown as { list: SceneListItemDto[] }).list;
      pagination.value = (
        response as unknown as { pagination: typeof pagination.value }
      ).pagination;
      return response;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 获取场景详情
   */
  async function getScene(sceneId: string) {
    loading.value = true;
    try {
      const data = await sceneApi.getScene(sceneId);
      currentScene.value = data as unknown as SceneDetailDto;
      return data;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 创建场景
   */
  async function createScene(projectId: string, data: CreateSceneDto) {
    loading.value = true;
    try {
      const response = await sceneApi.createScene(projectId, data);
      return response;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 更新场景
   */
  async function updateScene(sceneId: string, data: UpdateSceneDto) {
    loading.value = true;
    try {
      const result = await sceneApi.updateScene(sceneId, data);
      currentScene.value = result as unknown as SceneDetailDto;
      return result;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 删除场景
   */
  async function deleteScene(sceneId: string) {
    await sceneApi.deleteScene(sceneId);
    scenes.value = scenes.value.filter((s) => s.id !== sceneId);
  }

  /**
   * 批量删除场景
   */
  async function batchDeleteScenes(ids: string[]) {
    await sceneApi.batchDeleteScenes(ids);
    scenes.value = scenes.value.filter((s) => !ids.includes(s.id));
  }

  /**
   * 批量创建场景
   */
  async function batchCreateScenes(
    projectId: string,
    data: BatchCreateScenesDto,
  ) {
    loading.value = true;
    try {
      const response = await sceneApi.batchCreateScenes(projectId, data);
      return response;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 生成场景参考图
   */
  async function generateImage(sceneId: string, data: GenerateSceneImageDto) {
    generatingImages.value = true;
    generationProgress.value = 0;
    try {
      const response = await sceneApi.generateImage(sceneId, data);
      generationTaskId.value = response.data.generationTaskId;
      return response.data;
    } finally {
      generatingImages.value = false;
    }
  }

  /**
   * 上传场景参考图
   */
  async function uploadImage(
    sceneId: string,
    data: UploadSceneImageDto,
    file: File,
  ) {
    loading.value = true;
    try {
      const response = await sceneApi.uploadImage(sceneId, data, file);
      return response;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 删除场景参考图
   */
  async function deleteImage(sceneId: string, imageId: string) {
    await sceneApi.deleteImage(sceneId, imageId);
    if (currentScene.value) {
      await getScene(sceneId);
    }
  }

  /**
   * 导入场景
   */
  async function importScenes(projectId: string, data: ImportScenesDto) {
    loading.value = true;
    try {
      const response = await sceneApi.importScenes(projectId, data);
      return response;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 获取可导入的场景列表
   */
  async function queryImportableScenes(sourceProjectId: string) {
    loading.value = true;
    try {
      const response = await sceneApi.queryImportableScenes(
        "",
        sourceProjectId,
      );
      importableScenes.value = response.data.list as SceneListItemDto[];
      return response.data;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 设置列表筛选条件
   */
  function setListFilters(filters: Partial<typeof listFilters.value>) {
    Object.assign(listFilters.value, filters);
  }

  /**
   * 重置列表筛选条件
   */
  function resetListFilters() {
    listFilters.value = {
      search: "",
      status: null,
      type: null,
    };
  }

  /**
   * 重置状态
   */
  function resetState() {
    scenes.value = [];
    currentScene.value = null;
    loading.value = false;
    generatingImages.value = false;
    generationProgress.value = 0;
    generationTaskId.value = null;
    importableScenes.value = [];
    selectedScenes.value = [];
    pagination.value = {
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    };
  }

  return {
    // State
    scenes,
    currentScene,
    loading,
    generatingImages,
    generationProgress,
    generationTaskId,
    pagination,
    listFilters,
    importableScenes,
    selectedScenes,

    // Getters
    isDraft,
    isActive,
    isArchived,
    canEdit,
    currentImages,

    // Actions
    queryScenes,
    getScene,
    createScene,
    updateScene,
    deleteScene,
    batchDeleteScenes,
    batchCreateScenes,
    generateImage,
    uploadImage,
    deleteImage,
    importScenes,
    queryImportableScenes,
    setListFilters,
    resetListFilters,
    resetState,
  };
});
