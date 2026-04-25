import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { storyboardApi } from "@/api/storyboard";
import type {
  StoryboardListItemDto,
  StoryboardDetailDto,
  CreateStoryboardDto,
  UpdateStoryboardDto,
  QueryStoryboardsDto,
  BatchUpdateStatusDto,
  GenerateStoryboardImageDto,
  StoryboardStatus,
} from "@pixaura/shared-types";

export const useStoryboardStore = defineStore("storyboard", () => {
  // State
  const storyboards = ref<StoryboardListItemDto[]>([]);
  const total = ref(0);
  const loading = ref(false);
  const currentId = ref<string | null>(null);
  const currentDetail = ref<StoryboardDetailDto | null>(null);
  const editorVisible = ref(false);
  const editorLoading = ref(false);
  const generatingImages = ref(false);
  const viewMode = ref<"grid" | "timeline">("grid");
  const groupBy = ref<"none" | "scene">("none");
  const filters = ref<{
    sceneId?: string;
    status?: StoryboardStatus;
  }>({});
  const generatingJobs = ref<
    Map<string, { status: string; progress?: number }>
  >(new Map());

  // Getters
  const totalDuration = computed(() => {
    return storyboards.value.reduce((sum, sb) => sum + (sb.duration || 3), 0);
  });

  const groupedStoryboards = computed(() => {
    if (groupBy.value === "none") {
      return [{ sceneId: null, sceneName: null, items: storyboards.value }];
    }
    // 按场景分组
    const groups = new Map<
      string | null,
      {
        sceneId: string | null;
        sceneName: string | null;
        items: StoryboardListItemDto[];
      }
    >();
    storyboards.value.forEach((sb) => {
      const key = sb.sceneId || "none";
      if (!groups.has(key)) {
        groups.set(key, {
          sceneId: sb.sceneId,
          sceneName: sb.sceneName,
          items: [],
        });
      }
      groups.get(key)!.items.push(sb);
    });
    return Array.from(groups.values());
  });

  // Actions
  async function fetchStoryboards(
    projectId: string,
    params: QueryStoryboardsDto = { page: 1, pageSize: 50 },
  ) {
    loading.value = true;
    try {
      const res = await storyboardApi.getStoryboards(projectId, {
        ...filters.value,
        ...params,
      });
      storyboards.value = res.items;
      total.value = res.total;
      return res;
    } finally {
      loading.value = false;
    }
  }

  async function fetchStoryboardDetail(storyboardId: string) {
    editorLoading.value = true;
    try {
      const res = await storyboardApi.getStoryboardDetail(storyboardId);
      currentDetail.value = res;
      currentId.value = storyboardId;
      return res;
    } finally {
      editorLoading.value = false;
    }
  }

  async function createStoryboard(
    projectId: string,
    data: CreateStoryboardDto,
  ) {
    const res = await storyboardApi.createStoryboard(projectId, data);
    // 重新获取列表以更新顺序
    await fetchStoryboards(projectId);
    return res;
  }

  async function updateStoryboard(
    storyboardId: string,
    data: UpdateStoryboardDto,
  ) {
    const res = await storyboardApi.updateStoryboard(storyboardId, data);
    // 更新当前详情
    if (currentDetail.value?.id === storyboardId) {
      currentDetail.value = res;
    }
    // 更新列表中的数据 - 完全替换以确保数据一致性
    const index = storyboards.value.findIndex((sb) => sb.id === storyboardId);
    if (index !== -1) {
      // 直接替换整个对象，避免属性合并
      storyboards.value[index] = {
        id: res.id,
        sequenceNumber: res.sequenceNumber,
        sceneId: res.sceneId,
        sceneName: res.sceneName,
        description: res.description,
        status: res.status,
        thumbnailUrl: storyboards.value[index].thumbnailUrl, // 保留列表中的缩略图
        duration: res.timing?.duration ?? 3,
        shotType: res.shot?.shotType ?? "medium",
        characterCount: res.characters?.length ?? 0,
        updatedAt: res.updatedAt,
      };
    }
    return res;
  }

  async function deleteStoryboard(storyboardId: string, projectId: string) {
    await storyboardApi.deleteStoryboard(storyboardId);
    storyboards.value = storyboards.value.filter(
      (sb) => sb.id !== storyboardId,
    );
    if (currentId.value === storyboardId) {
      currentId.value = null;
      currentDetail.value = null;
      editorVisible.value = false;
    }
    // 重新获取列表以更新顺序
    await fetchStoryboards(projectId);
  }

  async function reorderStoryboards(
    projectId: string,
    storyboardIds: string[],
  ) {
    await storyboardApi.reorderStoryboards(projectId, { storyboardIds });
    // 更新本地顺序
    const ordered: StoryboardListItemDto[] = [];
    storyboardIds.forEach((id) => {
      const sb = storyboards.value.find((s) => s.id === id);
      if (sb) ordered.push(sb);
    });
    storyboards.value = ordered;
  }

  async function batchUpdateStatus(
    projectId: string,
    data: BatchUpdateStatusDto,
  ) {
    const res = await storyboardApi.batchUpdateStatus(projectId, data);
    // 更新本地状态
    storyboards.value.forEach((sb) => {
      if (data.storyboardIds.includes(sb.id)) {
        sb.status = data.status;
      }
    });
    return res;
  }

  async function submitRoughCut(projectId: string) {
    const res = await storyboardApi.submitRoughCut(projectId);
    await fetchStoryboards(projectId);
    return res;
  }

  async function submitAudio(projectId: string) {
    const res = await storyboardApi.submitAudio(projectId);
    await fetchStoryboards(projectId);
    return res;
  }

  async function submitFinalCut(projectId: string) {
    const res = await storyboardApi.submitFinalCut(projectId);
    await fetchStoryboards(projectId);
    return res;
  }

  async function exportToVideo(projectId: string) {
    const res = await storyboardApi.exportToVideo(projectId);
    await fetchStoryboards(projectId);
    return res;
  }

  async function generateImage(
    storyboardId: string,
    data: GenerateStoryboardImageDto,
  ) {
    generatingImages.value = true;
    try {
      const res = await storyboardApi.generateImage(storyboardId, data);
      generatingJobs.value.set(res.jobId, { status: "pending" });
      return res;
    } finally {
      generatingImages.value = false;
    }
  }

  async function deleteImage(storyboardId: string, imageId: string) {
    await storyboardApi.deleteImage(storyboardId, imageId);
    if (currentDetail.value?.id === storyboardId) {
      currentDetail.value.images = currentDetail.value.images.filter(
        (img) => img.id !== imageId,
      );
    }
  }

  async function setPrimaryImage(storyboardId: string, imageId: string) {
    await storyboardApi.setPrimaryImage(storyboardId, imageId);
    if (currentDetail.value?.id === storyboardId) {
      currentDetail.value.images.forEach((img) => {
        img.isCurrent = img.id === imageId;
      });
    }
  }

  function openEditor(storyboardId?: string) {
    // 先清除旧数据，避免编辑器显示脏数据
    currentDetail.value = null;
    currentId.value = storyboardId || null;
    editorVisible.value = true;
    if (storyboardId) {
      fetchStoryboardDetail(storyboardId);
    }
  }

  function closeEditor() {
    editorVisible.value = false;
    currentId.value = null;
    currentDetail.value = null;
  }

  function setFilters(newFilters: {
    sceneId?: string;
    status?: StoryboardStatus;
  }) {
    filters.value = newFilters;
  }

  function setViewMode(mode: "grid" | "timeline") {
    viewMode.value = mode;
  }

  function setGroupBy(group: "none" | "scene") {
    groupBy.value = group;
  }

  return {
    // State
    storyboards,
    total,
    loading,
    currentId,
    currentDetail,
    editorVisible,
    editorLoading,
    generatingImages,
    viewMode,
    groupBy,
    filters,
    generatingJobs,

    // Getters
    totalDuration,
    groupedStoryboards,

    // Actions
    fetchStoryboards,
    fetchStoryboardDetail,
    createStoryboard,
    updateStoryboard,
    deleteStoryboard,
    reorderStoryboards,
    batchUpdateStatus,
    submitRoughCut,
    submitAudio,
    submitFinalCut,
    exportToVideo,
    generateImage,
    deleteImage,
    setPrimaryImage,
    openEditor,
    closeEditor,
    setFilters,
    setViewMode,
    setGroupBy,
  };
});
