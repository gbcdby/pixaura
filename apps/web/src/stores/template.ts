import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { templateApi } from "@/api/template";
import type {
  TemplateListItem,
  TemplateDetail,
  SaveTemplateOptions,
  CreateFromTemplateOptions,
} from "@/api/template";
import type { QueryTemplatesDto } from "@pixaura/shared-types";

export const useTemplateStore = defineStore("template", () => {
  // State
  const systemTemplates = ref<TemplateListItem[]>([]);
  const myTemplates = ref<TemplateListItem[]>([]);
  const currentTemplate = ref<TemplateDetail | null>(null);
  const loading = ref(false);
  const saving = ref(false);
  const creating = ref(false);
  const pagination = ref({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });

  // Getters
  const allTemplates = computed(() => [
    ...systemTemplates.value,
    ...myTemplates.value,
  ]);

  const canDeleteCurrentTemplate = computed(() => {
    return currentTemplate.value?.type === "user";
  });

  // Actions
  async function fetchSystemTemplates(limit: number = 10) {
    loading.value = true;
    try {
      const res = await templateApi.getSystemTemplates(limit);
      systemTemplates.value = res.list;
      return res;
    } finally {
      loading.value = false;
    }
  }

  async function fetchMyTemplates(page: number = 1, pageSize: number = 20) {
    loading.value = true;
    try {
      const params: QueryTemplatesDto = {
        type: "user",
        page,
        pageSize,
      };
      const res = await templateApi.getTemplates(params);
      myTemplates.value = res.list;
      pagination.value = res.pagination;
      return res;
    } finally {
      loading.value = false;
    }
  }

  async function fetchAllTemplates(
    params: QueryTemplatesDto = { page: 1, pageSize: 20 },
  ) {
    loading.value = true;
    try {
      const res = await templateApi.getTemplates(params);
      if (params.type === "system") {
        systemTemplates.value = res.list;
      } else if (params.type === "user") {
        myTemplates.value = res.list;
      } else {
        // type === 'all' or undefined
        systemTemplates.value = res.list.filter((t) => t.type === "system");
        myTemplates.value = res.list.filter((t) => t.type === "user");
      }
      pagination.value = res.pagination;
      return res;
    } finally {
      loading.value = false;
    }
  }

  async function fetchTemplateDetail(templateId: string) {
    loading.value = true;
    try {
      const res = await templateApi.getTemplateDetail(templateId);
      currentTemplate.value = res;
      return res;
    } finally {
      loading.value = false;
    }
  }

  async function saveProjectAsTemplate(
    projectId: string,
    data: {
      name: string;
      description?: string;
      tags: string[];
      options: SaveTemplateOptions;
    },
  ) {
    saving.value = true;
    try {
      const res = await templateApi.saveProjectAsTemplate(projectId, data);
      // 添加到我的模板列表
      const newTemplate: TemplateListItem = {
        id: res.id,
        name: res.name,
        description: data.description || null,
        type: res.type,
        creator: null, // 当前用户
        tags: data.tags,
        usageCount: 0,
        preview: {
          characterCount: 0,
          sceneCount: 0,
          actCount: 0,
        },
        createdAt: res.createdAt,
        updatedAt: res.createdAt,
      };
      myTemplates.value.unshift(newTemplate);
      return res;
    } finally {
      saving.value = false;
    }
  }

  async function deleteTemplate(templateId: string) {
    await templateApi.deleteTemplate(templateId);
    // 从列表中移除
    myTemplates.value = myTemplates.value.filter((t) => t.id !== templateId);
    if (currentTemplate.value?.id === templateId) {
      currentTemplate.value = null;
    }
  }

  async function createProjectFromTemplate(
    templateId: string,
    data: {
      name: string;
      description?: string;
      coverUrl?: string;
      options: CreateFromTemplateOptions;
    },
  ) {
    creating.value = true;
    try {
      const res = await templateApi.createProjectFromTemplate(templateId, data);
      // 更新模板使用次数
      const template = [...systemTemplates.value, ...myTemplates.value].find(
        (t) => t.id === templateId,
      );
      if (template) {
        template.usageCount++;
      }
      return res;
    } finally {
      creating.value = false;
    }
  }

  function clearCurrentTemplate() {
    currentTemplate.value = null;
  }

  return {
    // State
    systemTemplates,
    myTemplates,
    currentTemplate,
    loading,
    saving,
    creating,
    pagination,

    // Getters
    allTemplates,
    canDeleteCurrentTemplate,

    // Actions
    fetchSystemTemplates,
    fetchMyTemplates,
    fetchAllTemplates,
    fetchTemplateDetail,
    saveProjectAsTemplate,
    deleteTemplate,
    createProjectFromTemplate,
    clearCurrentTemplate,
  };
});
