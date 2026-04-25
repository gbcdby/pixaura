import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { scriptApi } from "../api";
import type {
  ScriptListItemDto,
  ScriptDetailDto,
  AITaskDto,
  CreateScriptDto,
  UpdateScriptDto,
  QueryScriptsDto,
  AIGenerateScriptDto,
  ImportScriptDto,
  ConfirmScriptDto,
  AIContinueDto,
  AIRewriteDto,
  AIExpandDto,
  AICondenseDto,
  ImportAssetFromProjectDto,
  QueryImportableAssetsDto,
} from "@pixaura/shared-types";

export const useScriptStore = defineStore("script", () => {
  const scripts = ref<ScriptListItemDto[]>([]);
  const currentScript = ref<ScriptDetailDto | null>(null);
  const aiTasks = ref<AITaskDto[]>([]);
  const loading = ref(false);
  const aiGenerating = ref(false);
  const aiProgress = ref(0);

  const pagination = ref({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });

  const isEditing = computed(() => currentScript.value?.status === "editing");
  const isConfirmed = computed(
    () => currentScript.value?.status === "confirmed",
  );
  const isGenerating = computed(
    () => currentScript.value?.status === "ai_generating",
  );
  const canEdit = computed(() => isEditing.value && !isGenerating.value);

  async function queryScripts(projectId: string, params: QueryScriptsDto) {
    loading.value = true;
    try {
      const response = (await scriptApi.queryScripts(
        projectId,
        params,
      )) as unknown as {
        list: ScriptListItemDto[];
        page: number;
        pageSize: number;
        total: number;
      };
      scripts.value = response.list;
      pagination.value = {
        page: response.page,
        pageSize: response.pageSize,
        total: response.total,
        totalPages: Math.ceil(response.total / response.pageSize),
      };
      return response;
    } finally {
      loading.value = false;
    }
  }

  async function getScript(projectId: string, scriptId: string) {
    loading.value = true;
    try {
      const response = (await scriptApi.getScript(
        projectId,
        scriptId,
      )) as unknown as ScriptDetailDto;
      currentScript.value = response;
      return response;
    } finally {
      loading.value = false;
    }
  }

  async function createScript(projectId: string, data: CreateScriptDto) {
    loading.value = true;
    try {
      const response = (await scriptApi.createScript(
        projectId,
        data,
      )) as unknown as ScriptDetailDto;
      return response;
    } finally {
      loading.value = false;
    }
  }

  async function generateScript(projectId: string, data: AIGenerateScriptDto) {
    aiGenerating.value = true;
    try {
      const response = await scriptApi.generateScript(projectId, data);
      return response;
    } finally {
      aiGenerating.value = false;
    }
  }

  /**
   * 导入剧本
   * @deprecated 已废弃，前端未使用。请使用手动创建后点击"一键解析"流程。
   */
  async function importScript(projectId: string, data: ImportScriptDto) {
    loading.value = true;
    try {
      const response = await scriptApi.importScript(projectId, data);
      return response;
    } finally {
      loading.value = false;
    }
  }

  async function updateScript(
    projectId: string,
    scriptId: string,
    data: UpdateScriptDto,
  ) {
    loading.value = true;
    try {
      const response = (await scriptApi.updateScript(
        projectId,
        scriptId,
        data,
      )) as unknown as ScriptDetailDto;
      currentScript.value = response;
      return response;
    } finally {
      loading.value = false;
    }
  }

  async function deleteScript(projectId: string, scriptId: string) {
    await scriptApi.deleteScript(projectId, scriptId);
  }

  // AI 辅助编辑
  async function continueWithAI(
    projectId: string,
    scriptId: string,
    data: AIContinueDto,
  ) {
    const response = await scriptApi.continueWithAI(projectId, scriptId, data);
    return response;
  }

  async function rewriteWithAI(
    projectId: string,
    scriptId: string,
    data: AIRewriteDto,
  ) {
    const response = await scriptApi.rewriteWithAI(projectId, scriptId, data);
    return response;
  }

  async function expandWithAI(
    projectId: string,
    scriptId: string,
    data: AIExpandDto,
  ) {
    const response = await scriptApi.expandWithAI(projectId, scriptId, data);
    return response;
  }

  async function condenseWithAI(
    projectId: string,
    scriptId: string,
    data: AICondenseDto,
  ) {
    const response = await scriptApi.condenseWithAI(projectId, scriptId, data);
    return response;
  }

  async function getAITask(
    projectId: string,
    scriptId: string,
    taskId: string,
  ) {
    const response = await scriptApi.getAITask(projectId, scriptId, taskId);
    return response;
  }

  async function cancelAITask(
    projectId: string,
    scriptId: string,
    taskId: string,
  ) {
    const response = await scriptApi.cancelAITask(projectId, scriptId, taskId);
    return response;
  }

  async function retryAITask(
    projectId: string,
    scriptId: string,
    taskId: string,
  ) {
    const response = await scriptApi.retryAITask(projectId, scriptId, taskId);
    return response;
  }

  // 跨项目资产导入
  async function queryImportableAssets(
    projectId: string,
    params: QueryImportableAssetsDto,
  ) {
    const response = await scriptApi.queryImportableAssets(projectId, params);
    return response;
  }

  async function importAsset(
    projectId: string,
    scriptId: string,
    data: ImportAssetFromProjectDto,
  ) {
    await scriptApi.importAsset(projectId, scriptId, data);
  }

  // 确认剧本
  async function getConfirmPreview(projectId: string, scriptId: string) {
    const response = await scriptApi.getConfirmPreview(projectId, scriptId);
    return response;
  }

  async function confirmScript(
    projectId: string,
    scriptId: string,
    data: ConfirmScriptDto,
  ) {
    const response = (await scriptApi.confirmScript(
      projectId,
      scriptId,
      data,
    )) as unknown as ScriptDetailDto;
    currentScript.value = response;
    return response;
  }

  function resetState() {
    scripts.value = [];
    currentScript.value = null;
    aiTasks.value = [];
    loading.value = false;
    aiGenerating.value = false;
    aiProgress.value = 0;
  }

  return {
    scripts,
    currentScript,
    aiTasks,
    loading,
    aiGenerating,
    aiProgress,
    pagination,
    isEditing,
    isConfirmed,
    canEdit,
    queryScripts,
    getScript,
    createScript,
    generateScript,
    importScript,
    updateScript,
    deleteScript,
    continueWithAI,
    rewriteWithAI,
    expandWithAI,
    condenseWithAI,
    getAITask,
    cancelAITask,
    retryAITask,
    queryImportableAssets,
    importAsset,
    getConfirmPreview,
    confirmScript,
    resetState,
  };
});
