import { api } from "@/utils/request";
import type {
  CreateProjectDto,
  UpdateProjectDto,
  QueryProjectsDto,
  InviteCollaboratorDto,
  UpdateCollaboratorRoleDto,
  CreateInviteLinkDto,
  JoinProjectDto,
  UpdateProjectModelsDto,
  TransferOwnershipDto,
  ProjectListItemDto,
  ProjectDetailDto,
  CollaboratorDto,
  InviteLinkDto,
  InviteLinkListItemDto,
  TrashProjectDto,
  ProjectStatsDto,
  RecentScriptDto,
} from "@pixaura/shared-types";

export interface ProjectsResponse {
  list: ProjectListItemDto[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export const projectApi = {
  // ==================== 项目 CRUD ====================

  // 获取项目列表
  getProjects(params: QueryProjectsDto): Promise<ProjectsResponse> {
    return api.get("/projects", { params });
  },

  // 创建项目
  createProject(data: CreateProjectDto): Promise<ProjectListItemDto> {
    return api.post("/projects", data);
  },

  // 获取项目详情
  getProjectDetail(projectId: string): Promise<ProjectDetailDto> {
    return api.get(`/projects/${projectId}`);
  },

  // 更新项目
  updateProject(
    projectId: string,
    data: UpdateProjectDto,
  ): Promise<{
    id: string;
    name: string;
    status: string;
    description: string | null;
    coverUrl: string | null;
    updatedAt: string;
  }> {
    return api.put(`/projects/${projectId}`, data);
  },

  // 删除项目（软删除）
  deleteProject(
    projectId: string,
  ): Promise<{ deletedAt: string; willPermanentlyDeleteAt: string }> {
    return api.delete(`/projects/${projectId}`);
  },

  // ==================== 回收站 ====================

  // 获取回收站列表
  getTrashProjects(
    page: number = 1,
    pageSize: number = 20,
  ): Promise<{
    list: TrashProjectDto[];
    pagination: ProjectsResponse["pagination"];
  }> {
    return api.get("/projects/trash/list", {
      params: { page, page_size: pageSize },
    });
  },

  // 恢复项目
  restoreProject(
    projectId: string,
  ): Promise<{ id: string; restoredAt: string }> {
    return api.post(`/projects/${projectId}/restore`);
  },

  // 永久删除项目
  permanentDeleteProject(projectId: string): Promise<void> {
    return api.delete(`/projects/${projectId}/permanent`);
  },

  // ==================== 协作者 ====================

  // 获取协作者列表
  getCollaborators(projectId: string): Promise<{ list: CollaboratorDto[] }> {
    return api.get(`/projects/${projectId}/collaborators`);
  },

  // 邀请协作者
  inviteCollaborator(
    projectId: string,
    data: InviteCollaboratorDto,
  ): Promise<CollaboratorDto> {
    return api.post(`/projects/${projectId}/collaborators`, data);
  },

  // 更新协作者角色
  updateCollaboratorRole(
    projectId: string,
    userId: string,
    data: UpdateCollaboratorRoleDto,
  ): Promise<{ id: string; role: string; updatedAt: string }> {
    return api.put(`/projects/${projectId}/collaborators/${userId}`, data);
  },

  // 移除协作者
  removeCollaborator(projectId: string, userId: string): Promise<void> {
    return api.delete(`/projects/${projectId}/collaborators/${userId}`);
  },

  // 转让项目所有权
  transferOwnership(
    projectId: string,
    data: TransferOwnershipDto,
  ): Promise<{ newOwnerId: string; transferredAt: string }> {
    return api.post(`/projects/${projectId}/transfer`, data);
  },

  // ==================== 邀请链接 ====================

  // 创建邀请链接
  createInviteLink(
    projectId: string,
    data: CreateInviteLinkDto,
  ): Promise<InviteLinkDto> {
    return api.post(`/projects/${projectId}/invite-link`, data);
  },

  // 获取邀请链接列表
  getInviteLinks(
    projectId: string,
  ): Promise<{ links: InviteLinkListItemDto[] }> {
    return api.get(`/projects/${projectId}/invite-links`);
  },

  // 撤销邀请链接
  revokeInviteLink(projectId: string, inviteCode: string): Promise<void> {
    return api.delete(`/projects/${projectId}/invite-links/${inviteCode}`);
  },

  // 通过链接加入项目
  joinProject(
    data: JoinProjectDto,
  ): Promise<{ projectId: string; role: string; joinedAt: string }> {
    return api.post("/projects/join", data);
  },

  // ==================== 模型配置 ====================

  // 获取项目模型配置
  async getModelConfigs(projectId: string): Promise<{
    configs: Record<
      string,
      {
        modelId: string;
        modelName: string;
        providerName: string;
        description: string;
        isDefault: boolean;
        source: "project" | "user" | "system";
      } | null
    >;
    list: Array<{
      category: string;
      modelId: string | null;
      modelName: string | null;
      providerName: string | null;
      description: string | null;
      isDefault: boolean;
      source: "project" | "user" | "system";
    }>;
  }> {
    const res = (await api.get(`/projects/${projectId}/models`)) as {
      configs: Record<
        string,
        {
          modelId: string;
          modelName: string;
          providerName: string;
          description: string;
          isDefault: boolean;
          source: "project" | "user" | "system";
        } | null
      >;
      list: Array<{
        category: string;
        modelId: string | null;
        modelName: string | null;
        providerName: string | null;
        description: string | null;
        isDefault: boolean;
        source: "project" | "user" | "system";
      }>;
    };
    return res;
  },

  // 更新项目模型配置
  updateModelConfigs(
    projectId: string,
    data: UpdateProjectModelsDto,
  ): Promise<Record<string, { modelId: string; updatedAt: string }>> {
    return api.put(`/projects/${projectId}/models`, data);
  },

  // ==================== 项目统计 ====================

  // 获取项目统计
  getProjectStats(projectId: string): Promise<ProjectStatsDto> {
    return api.get(`/projects/${projectId}/stats`);
  },

  // 获取最近剧本列表
  getRecentScripts(
    projectId: string,
    limit: number = 3,
  ): Promise<{ list: RecentScriptDto[] }> {
    return api.get(`/projects/${projectId}/scripts/recent`, {
      params: { limit },
    });
  },
};
