import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { propApi } from "../api";
import type {
  PropListItemDto,
  PropDetailDto,
  CreatePropDto,
  UpdatePropDto,
  QueryPropsDto,
  BatchCreatePropsDto,
  GeneratePropImageDto,
  UploadPropImageDto,
  ImportPropsDto,
} from "@pixaura/shared-types";

export const usePropStore = defineStore("prop", () => {
  // ==================== State ====================
  const props = ref<PropListItemDto[]>([]);
  const currentProp = ref<PropDetailDto | null>(null);
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
    importance: null as string | null,
  });

  // 导入相关
  const importableProps = ref<PropListItemDto[]>([]);
  const selectedProps = ref<string[]>([]);

  // ==================== Getters ====================
  const isDraft = computed(() => currentProp.value?.status === "draft");
  const isActive = computed(() => currentProp.value?.status === "active");
  const isArchived = computed(() => currentProp.value?.status === "archived");
  const canEdit = computed(() => isDraft.value || isActive.value);

  // 按类型组织的图片
  const currentImages = computed(() => {
    if (!currentProp.value) return null;
    return currentProp.value.images;
  });

  // ==================== Actions ====================

  /**
   * 查询道具列表
   */
  async function queryProps(projectId: string, params?: QueryPropsDto) {
    loading.value = true;
    try {
      const response = await propApi.queryProps(projectId, {
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
        importance:
          (listFilters.value.importance as
            | "key"
            | "secondary"
            | "background"
            | undefined) || undefined,
        ...params,
      });
      props.value = (response as unknown as { list: PropListItemDto[] }).list;
      pagination.value = (
        response as unknown as { pagination: typeof pagination.value }
      ).pagination;
      return response;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 获取道具详情
   */
  async function getProp(propId: string) {
    loading.value = true;
    try {
      const data = await propApi.getProp(propId);
      currentProp.value = data as unknown as PropDetailDto;
      return data;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 创建道具
   */
  async function createProp(projectId: string, data: CreatePropDto) {
    loading.value = true;
    try {
      const response = await propApi.createProp(projectId, data);
      return response;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 更新道具
   */
  async function updateProp(propId: string, data: UpdatePropDto) {
    loading.value = true;
    try {
      const result = await propApi.updateProp(propId, data);
      currentProp.value = result as unknown as PropDetailDto;
      return result;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 删除道具
   */
  async function deleteProp(propId: string) {
    await propApi.deleteProp(propId);
    props.value = props.value.filter((p) => p.id !== propId);
  }

  /**
   * 批量删除道具
   */
  async function batchDeleteProps(ids: string[]) {
    await propApi.batchDeleteProps(ids);
    props.value = props.value.filter((p) => !ids.includes(p.id));
  }

  /**
   * 批量创建道具
   */
  async function batchCreateProps(
    projectId: string,
    data: BatchCreatePropsDto,
  ) {
    loading.value = true;
    try {
      const response = await propApi.batchCreateProps(projectId, data);
      return response;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 生成道具参考图
   */
  async function generateImage(propId: string, data: GeneratePropImageDto) {
    generatingImages.value = true;
    generationProgress.value = 0;
    try {
      const response = await propApi.generateImage(propId, data);
      generationTaskId.value = response.data.generationTaskId;
      return response.data;
    } finally {
      generatingImages.value = false;
    }
  }

  /**
   * 上传道具参考图
   */
  async function uploadImage(
    propId: string,
    data: UploadPropImageDto,
    file: File,
  ) {
    loading.value = true;
    try {
      const response = await propApi.uploadImage(propId, data, file);
      return response;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 删除道具参考图
   */
  async function deleteImage(propId: string, imageId: string) {
    await propApi.deleteImage(propId, imageId);
    if (currentProp.value) {
      await getProp(propId);
    }
  }

  /**
   * 导入道具
   */
  async function importProps(projectId: string, data: ImportPropsDto) {
    loading.value = true;
    try {
      const response = await propApi.importProps(projectId, data);
      return response;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 获取可导入的道具列表
   */
  async function queryImportableProps(sourceProjectId: string) {
    loading.value = true;
    try {
      const response = await propApi.queryImportableProps("", sourceProjectId);
      importableProps.value = response.data.list as PropListItemDto[];
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
      importance: null,
    };
  }

  /**
   * 重置状态
   */
  function resetState() {
    props.value = [];
    currentProp.value = null;
    loading.value = false;
    generatingImages.value = false;
    generationProgress.value = 0;
    generationTaskId.value = null;
    importableProps.value = [];
    selectedProps.value = [];
    pagination.value = {
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    };
  }

  return {
    // State
    props,
    currentProp,
    loading,
    generatingImages,
    generationProgress,
    generationTaskId,
    pagination,
    listFilters,
    importableProps,
    selectedProps,

    // Getters
    isDraft,
    isActive,
    isArchived,
    canEdit,
    currentImages,

    // Actions
    queryProps,
    getProp,
    createProp,
    updateProp,
    deleteProp,
    batchDeleteProps,
    batchCreateProps,
    generateImage,
    uploadImage,
    deleteImage,
    importProps,
    queryImportableProps,
    setListFilters,
    resetListFilters,
    resetState,
  };
});
