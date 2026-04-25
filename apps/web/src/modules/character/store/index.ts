import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { characterApi } from "../api";
import type {
  CharacterListItemDto,
  CharacterDetailDto,
  CreateCharacterDto,
  UpdateCharacterDto,
  QueryCharactersDto,
  BatchCreateCharactersDto,
  GenerateImageDto,
  UploadImageDto,
  ImportCharactersDto,
} from "@pixaura/shared-types";

export const useCharacterStore = defineStore("character", () => {
  // ==================== State ====================
  const characters = ref<CharacterListItemDto[]>([]);
  const currentCharacter = ref<CharacterDetailDto | null>(null);
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
  const importableCharacters = ref<CharacterListItemDto[]>([]);
  const selectedCharacters = ref<string[]>([]);

  // ==================== Getters ====================
  const isDraft = computed(() => currentCharacter.value?.status === "draft");
  const isActive = computed(() => currentCharacter.value?.status === "active");
  const isArchived = computed(
    () => currentCharacter.value?.status === "archived",
  );
  const canEdit = computed(() => isDraft.value || isActive.value);

  // 按类型组织的图片
  const currentImages = computed(() => {
    if (!currentCharacter.value) return null;
    return currentCharacter.value.images;
  });

  // ==================== Actions ====================

  /**
   * 查询角色列表
   */
  async function queryCharacters(
    projectId: string,
    params?: QueryCharactersDto,
  ) {
    loading.value = true;
    try {
      const response = await characterApi.queryCharacters(projectId, {
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
            | "protagonist"
            | "supporting"
            | "minor"
            | undefined) || undefined,
        ...params,
      });
      characters.value = (
        response as unknown as { list: CharacterListItemDto[] }
      ).list;
      pagination.value = (
        response as unknown as { pagination: typeof pagination.value }
      ).pagination;
      return response;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 获取角色详情
   */
  async function getCharacter(characterId: string) {
    loading.value = true;
    try {
      const data = await characterApi.getCharacter(characterId);
      currentCharacter.value = data as unknown as CharacterDetailDto;
      return data;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 创建角色
   */
  async function createCharacter(projectId: string, data: CreateCharacterDto) {
    loading.value = true;
    try {
      const response = await characterApi.createCharacter(projectId, data);
      return response;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 更新角色
   */
  async function updateCharacter(
    characterId: string,
    data: UpdateCharacterDto,
  ) {
    loading.value = true;
    try {
      const result = await characterApi.updateCharacter(characterId, data);
      currentCharacter.value = result as unknown as CharacterDetailDto;
      return result;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 删除角色
   */
  async function deleteCharacter(characterId: string) {
    await characterApi.deleteCharacter(characterId);
    characters.value = characters.value.filter((c) => c.id !== characterId);
  }

  /**
   * 批量删除角色
   */
  async function batchDeleteCharacters(ids: string[]) {
    await characterApi.batchDeleteCharacters(ids);
    characters.value = characters.value.filter((c) => !ids.includes(c.id));
  }

  /**
   * 批量创建角色
   */
  async function batchCreateCharacters(
    projectId: string,
    data: BatchCreateCharactersDto,
  ) {
    loading.value = true;
    try {
      const response = await characterApi.batchCreateCharacters(
        projectId,
        data,
      );
      return response;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 生成角色参考图
   */
  async function generateImage(characterId: string, data: GenerateImageDto) {
    generatingImages.value = true;
    generationProgress.value = 0;
    try {
      const response = await characterApi.generateImage(characterId, data);
      generationTaskId.value = response.data.generationTaskId;
      return response.data;
    } finally {
      generatingImages.value = false;
    }
  }

  /**
   * 上传角色参考图
   */
  async function uploadImage(
    characterId: string,
    data: UploadImageDto,
    file: File,
  ) {
    loading.value = true;
    try {
      const response = await characterApi.uploadImage(characterId, data, file);
      return response;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 删除角色参考图
   */
  async function deleteImage(characterId: string, imageId: string) {
    await characterApi.deleteImage(characterId, imageId);
    if (currentCharacter.value) {
      await getCharacter(characterId);
    }
  }

  /**
   * 导入角色
   */
  async function importCharacters(
    projectId: string,
    data: ImportCharactersDto,
  ) {
    loading.value = true;
    try {
      const response = await characterApi.importCharacters(projectId, data);
      return response;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 获取可导入的角色列表
   */
  async function queryImportableCharacters(sourceProjectId: string) {
    loading.value = true;
    try {
      const response = await characterApi.queryImportableCharacters(
        "",
        sourceProjectId,
      );
      importableCharacters.value = response.data.list as CharacterListItemDto[];
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
    characters.value = [];
    currentCharacter.value = null;
    loading.value = false;
    generatingImages.value = false;
    generationProgress.value = 0;
    generationTaskId.value = null;
    importableCharacters.value = [];
    selectedCharacters.value = [];
    pagination.value = {
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    };
  }

  return {
    // State
    characters,
    currentCharacter,
    loading,
    generatingImages,
    generationProgress,
    generationTaskId,
    pagination,
    listFilters,
    importableCharacters,
    selectedCharacters,

    // Getters
    isDraft,
    isActive,
    isArchived,
    canEdit,
    currentImages,

    // Actions
    queryCharacters,
    getCharacter,
    createCharacter,
    updateCharacter,
    deleteCharacter,
    batchDeleteCharacters,
    batchCreateCharacters,
    generateImage,
    uploadImage,
    deleteImage,
    importCharacters,
    queryImportableCharacters,
    setListFilters,
    resetListFilters,
    resetState,
  };
});
