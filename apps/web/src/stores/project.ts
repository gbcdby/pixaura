import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { projectApi } from "@/api/project";
import type {
  ProjectListItemDto,
  ProjectDetailDto,
  CollaboratorDto,
  InviteLinkListItemDto,
  TrashProjectDto,
  CreateProjectDto,
  UpdateProjectDto,
  InviteCollaboratorDto,
  UpdateCollaboratorRoleDto,
  CreateInviteLinkDto,
  JoinProjectDto,
  UpdateProjectModelsDto,
  TransferOwnershipDto,
  QueryProjectsDto,
  ProjectStatsDto,
  RecentScriptDto,
} from "@pixaura/shared-types";

export const useProjectStore = defineStore("project", () => {
  // State
  const projects = ref<ProjectListItemDto[]>([]);
  const pagination = ref({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const loading = ref(false);
  const currentProject = ref<ProjectDetailDto | null>(null);
  const collaborators = ref<CollaboratorDto[]>([]);
  const modelConfigs = ref<
    Record<string, { modelId: string; modelName: string; source?: "project" | "user" | "system" } | null>
  >({});
  // 级联解析后的模型列表（包含所有类别的 cascade 结果）
  const modelConfigsList = ref<
    Array<{ category: string; modelId: string | null; modelName: string | null; source: "project" | "user" | "system" }>
  >([]);
  const inviteLinks = ref<InviteLinkListItemDto[]>([]);
  const trashProjects = ref<TrashProjectDto[]>([]);
  const trashPagination = ref({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const projectStats = ref<ProjectStatsDto | null>(null);
  const recentScripts = ref<RecentScriptDto[]>([]);

  // Getters
  const currentUserRole = computed(() => currentProject.value?.role || null);
  const isOwner = computed(() => currentUserRole.value === "owner");
  const isEditor = computed(
    () =>
      currentUserRole.value === "owner" || currentUserRole.value === "editor",
  );

  // Actions
  async function fetchProjects(
    params: QueryProjectsDto = { page: 1, pageSize: 20 },
  ) {
    loading.value = true;
    try {
      const res = await projectApi.getProjects(params);
      projects.value = res.list;
      pagination.value = res.pagination;
      return res;
    } finally {
      loading.value = false;
    }
  }

  async function createProject(data: CreateProjectDto) {
    const res = await projectApi.createProject(data);
    projects.value.unshift(res);
    return res;
  }

  async function fetchProjectDetail(projectId: string) {
    loading.value = true;
    try {
      const res = await projectApi.getProjectDetail(projectId);
      currentProject.value = res;
      collaborators.value = res.collaborators;
      modelConfigs.value = res.defaultModels;
      return res;
    } finally {
      loading.value = false;
    }
  }

  async function updateProject(projectId: string, data: UpdateProjectDto) {
    const res = await projectApi.updateProject(projectId, data);
    if (currentProject.value?.id === projectId) {
      Object.assign(currentProject.value, res);
    }
    return res;
  }

  async function deleteProject(projectId: string) {
    await projectApi.deleteProject(projectId);
    projects.value = projects.value.filter((p) => p.id !== projectId);
  }

  async function fetchTrashProjects(page: number = 1, pageSize: number = 20) {
    loading.value = true;
    try {
      const res = await projectApi.getTrashProjects(page, pageSize);
      trashProjects.value = res.list;
      trashPagination.value = res.pagination;
      return res;
    } finally {
      loading.value = false;
    }
  }

  async function restoreProject(projectId: string) {
    await projectApi.restoreProject(projectId);
    trashProjects.value = trashProjects.value.filter((p) => p.id !== projectId);
  }

  async function permanentDeleteProject(projectId: string) {
    await projectApi.permanentDeleteProject(projectId);
    trashProjects.value = trashProjects.value.filter((p) => p.id !== projectId);
  }

  async function fetchCollaborators(projectId: string) {
    const res = await projectApi.getCollaborators(projectId);
    collaborators.value = res.list;
    return res.list;
  }

  async function inviteCollaborator(
    projectId: string,
    data: InviteCollaboratorDto,
  ) {
    const res = await projectApi.inviteCollaborator(projectId, data);
    collaborators.value.push(res);
    return res;
  }

  async function updateCollaboratorRole(
    projectId: string,
    userId: string,
    data: UpdateCollaboratorRoleDto,
  ) {
    const res = await projectApi.updateCollaboratorRole(
      projectId,
      userId,
      data,
    );
    const index = collaborators.value.findIndex((c) => c.id === userId);
    if (index !== -1) {
      collaborators.value[index].role = res.role as any;
    }
    return res;
  }

  async function removeCollaborator(projectId: string, userId: string) {
    await projectApi.removeCollaborator(projectId, userId);
    collaborators.value = collaborators.value.filter((c) => c.id !== userId);
  }

  async function transferOwnership(
    projectId: string,
    data: TransferOwnershipDto,
  ) {
    const res = await projectApi.transferOwnership(projectId, data);
    if (currentProject.value) {
      currentProject.value.role = "editor";
    }
    return res;
  }

  async function createInviteLink(
    projectId: string,
    data: CreateInviteLinkDto,
  ) {
    return projectApi.createInviteLink(projectId, data);
  }

  async function fetchInviteLinks(projectId: string) {
    const res = await projectApi.getInviteLinks(projectId);
    inviteLinks.value = res.links;
    return res.links;
  }

  async function revokeInviteLink(projectId: string, inviteCode: string) {
    await projectApi.revokeInviteLink(projectId, inviteCode);
    inviteLinks.value = inviteLinks.value.filter(
      (l) => l.inviteCode !== inviteCode,
    );
  }

  async function joinProject(data: JoinProjectDto) {
    return projectApi.joinProject(data);
  }

  async function fetchModelConfigs(projectId: string) {
    const res = await projectApi.getModelConfigs(projectId);
    // 提取 configs 对象作为 modelConfigs
    modelConfigs.value = res.configs;
    // 保存 list 数组（包含所有类别的 cascade 结果，用于显示默认选项名称）
    modelConfigsList.value = res.list || [];
    return res;
  }

  async function updateModelConfigs(
    projectId: string,
    data: UpdateProjectModelsDto,
  ) {
    const res = await projectApi.updateModelConfigs(projectId, data);
    Object.assign(modelConfigs.value, res);
    return res;
  }

  function clearCurrentProject() {
    currentProject.value = null;
    collaborators.value = [];
    modelConfigs.value = {};
    modelConfigsList.value = [];
    inviteLinks.value = [];
    projectStats.value = null;
    recentScripts.value = [];
  }

  // 获取项目统计
  async function fetchProjectStats(projectId: string) {
    const res = await projectApi.getProjectStats(projectId);
    projectStats.value = res;
    return res;
  }

  // 获取最近剧本列表
  async function fetchRecentScripts(projectId: string, limit: number = 3) {
    const res = await projectApi.getRecentScripts(projectId, limit);
    recentScripts.value = res.list;
    return res.list;
  }

  return {
    projects,
    pagination,
    loading,
    currentProject,
    collaborators,
    modelConfigs,
    modelConfigsList,
    inviteLinks,
    trashProjects,
    trashPagination,
    projectStats,
    recentScripts,
    currentUserRole,
    isOwner,
    isEditor,
    fetchProjects,
    createProject,
    fetchProjectDetail,
    updateProject,
    deleteProject,
    fetchTrashProjects,
    restoreProject,
    permanentDeleteProject,
    fetchCollaborators,
    inviteCollaborator,
    updateCollaboratorRole,
    removeCollaborator,
    transferOwnership,
    createInviteLink,
    fetchInviteLinks,
    revokeInviteLink,
    joinProject,
    fetchModelConfigs,
    updateModelConfigs,
    fetchProjectStats,
    fetchRecentScripts,
    clearCurrentProject,
  };
});
