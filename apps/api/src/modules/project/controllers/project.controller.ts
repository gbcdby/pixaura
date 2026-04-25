import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from "@nestjs/common";
import { FastifyRequest } from "fastify";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { ProjectService, ProjectTemplateService } from "../services";
import { ProjectGuard, OwnerGuard, EditorGuard } from "../guards";
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  QueryProjectsSchema,
  InviteCollaboratorSchema,
  UpdateCollaboratorRoleSchema,
  CreateInviteLinkSchema,
  JoinProjectSchema,
  UpdateProjectModelsSchema,
  TransferOwnershipSchema,
  SaveAsTemplateSchema,
  CreateFromTemplateSchema,
  QueryTemplatesSchema,
  type CreateProjectDto,
  type UpdateProjectDto,
  type QueryProjectsDto,
  type InviteCollaboratorDto,
  type UpdateCollaboratorRoleDto,
  type CreateInviteLinkDto,
  type JoinProjectDto,
  type UpdateProjectModelsDto,
  type TransferOwnershipDto,
  type SaveAsTemplateDto,
  type CreateFromTemplateDto,
  type QueryTemplatesDto,
} from "../dto";

type RequestWithUser = FastifyRequest & { user: { userId: string } };

@Controller("projects")
@UseGuards(JwtAuthGuard)
export class ProjectController {
  constructor(
    private readonly projectService: ProjectService,
    private readonly projectTemplateService: ProjectTemplateService,
  ) {}

  // ==================== 项目 CRUD ====================

  /**
   * 获取项目列表
   */
  @Get()
  async getProjects(
    @Req() req: RequestWithUser,
    @Query(new ZodValidationPipe(QueryProjectsSchema)) query: QueryProjectsDto,
  ) {
    const { list, total } = await this.projectService.getProjects(
      req.user.userId,
      query,
    );

    return {
      list: list.map((p) => ({
        id: p.projectId,
        name: p.name,
        description: p.description,
        coverUrl: p.coverUrl,
        status: p.status,
        role: p.role,
        owner: p.owner
          ? {
              id: p.owner.id,
              username: p.owner.username,
              avatar: p.owner.avatar,
            }
          : null,
        collaboratorCount: p.collaboratorCount,
        scriptCount: p.scriptCount,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  /**
   * 创建项目
   */
  @Post()
  async createProject(
    @Req() req: RequestWithUser,
    @Body(new ZodValidationPipe(CreateProjectSchema)) dto: CreateProjectDto,
  ) {
    const project = await this.projectService.createProject(
      req.user.userId,
      dto,
    );

    return {
      id: project.projectId,
      name: project.name,
      status: project.status,
      role: "owner",
      createdAt: project.createdAt,
    };
  }

  /**
   * 获取项目详情
   */
  @Get(":project_id")
  @UseGuards(ProjectGuard)
  async getProjectDetail(
    @Req() req: RequestWithUser,
    @Param("project_id") projectId: string,
  ) {
    const project = await this.projectService.getProjectDetail(
      projectId,
      req.user.userId,
    );

    // 获取当前用户角色
    const currentUserRole =
      project.collaborators?.find((c) => c.userId === req.user.userId)?.role ||
      "viewer";

    // 获取项目模型配置（带级联解析）
    const modelConfigs = await this.projectService.getModelConfigs(projectId, req.user.userId);
    const defaultModels: Record<string, any> = {};
    for (const config of modelConfigs) {
      defaultModels[config.category] = config.modelId
        ? {
            modelId: config.modelId,
            modelName: config.modelName,
            providerName: config.providerName,
            description: config.description,
            isDefault: config.isDefault,
            source: config.source,
          }
        : null;
    }

    return {
      id: project.projectId,
      name: project.name,
      description: project.description,
      coverUrl: project.coverUrl,
      status: project.status,
      role: currentUserRole,
      owner: {
        id: project.owner.id,
        username: project.owner.username,
        avatar: project.owner.avatar,
      },
      collaborators:
        project.collaborators?.map((c) => ({
          id: c.user.id,
          username: c.user.username,
          avatar: c.user.avatar,
          role: c.role,
          joinedAt: c.joinedAt,
        })) || [],
      defaultModels,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }

  /**
   * 更新项目
   */
  @Put(":project_id")
  @UseGuards(ProjectGuard, EditorGuard)
  async updateProject(
    @Req() req: RequestWithUser,
    @Param("project_id") projectId: string,
    @Body(new ZodValidationPipe(UpdateProjectSchema)) dto: UpdateProjectDto,
  ) {
    const project = await this.projectService.updateProject(
      projectId,
      req.user.userId,
      dto,
    );

    return {
      id: project.projectId,
      name: project.name,
      status: project.status,
      description: project.description,
      coverUrl: project.coverUrl,
      updatedAt: project.updatedAt,
    };
  }

  /**
   * 删除项目（软删除）
   */
  @Delete(":project_id")
  @UseGuards(ProjectGuard, OwnerGuard)
  async deleteProject(
    @Req() req: RequestWithUser,
    @Param("project_id") projectId: string,
  ) {
    await this.projectService.deleteProject(projectId, req.user.userId);

    const deletedAt = new Date();
    const willDeleteAt = new Date(deletedAt);
    willDeleteAt.setDate(willDeleteAt.getDate() + 30);

    return {
      deletedAt: deletedAt.toISOString(),
      willPermanentlyDeleteAt: willDeleteAt.toISOString(),
    };
  }

  // ==================== 回收站 ====================

  /**
   * 获取回收站列表
   */
  @Get("trash/list")
  async getTrashProjects(
    @Req() req: RequestWithUser,
    @Query("page") page: string = "1",
    @Query("page_size") pageSize: string = "20",
  ) {
    const { list, total } = await this.projectService.getTrashProjects(
      req.user.userId,
      parseInt(page, 10),
      parseInt(pageSize, 10),
    );

    const now = new Date();

    return {
      list: list.map((p) => {
        const deletedAt = p.deletedAt!;
        const willDeleteAt = new Date(deletedAt);
        willDeleteAt.setDate(willDeleteAt.getDate() + 30);
        const daysRemaining = Math.ceil(
          (willDeleteAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );

        return {
          id: p.projectId,
          name: p.name,
          coverUrl: p.coverUrl,
          deletedAt: deletedAt.toISOString(),
          willPermanentlyDeleteAt: willDeleteAt.toISOString(),
          daysRemaining: Math.max(0, daysRemaining),
        };
      }),
      pagination: {
        page: parseInt(page, 10),
        pageSize: parseInt(pageSize, 10),
        total,
        totalPages: Math.ceil(total / parseInt(pageSize, 10)),
      },
    };
  }

  /**
   * 恢复项目
   */
  @Post(":project_id/restore")
  @UseGuards(ProjectGuard, OwnerGuard)
  async restoreProject(
    @Req() req: RequestWithUser,
    @Param("project_id") projectId: string,
  ) {
    await this.projectService.restoreProject(projectId, req.user.userId);

    return {
      id: projectId,
      restoredAt: new Date().toISOString(),
    };
  }

  /**
   * 永久删除项目
   */
  @Delete(":project_id/permanent")
  @UseGuards(ProjectGuard, OwnerGuard)
  async permanentDeleteProject(
    @Req() req: RequestWithUser,
    @Param("project_id") projectId: string,
  ) {
    await this.projectService.permanentDeleteProject(
      projectId,
      req.user.userId,
    );

    return null;
  }

  // ==================== 协作者 ====================

  /**
   * 获取协作者列表
   */
  @Get(":project_id/collaborators")
  @UseGuards(ProjectGuard)
  async getCollaborators(@Param("project_id") projectId: string) {
    const collaborators = await this.projectService.getCollaborators(projectId);

    return {
      list: collaborators.map((c) => ({
        id: c.user.id,
        username: c.user.username,
        avatar: c.user.avatar,
        role: c.role,
        joinedAt: c.joinedAt,
      })),
    };
  }

  /**
   * 邀请协作者
   * 支持通过 userId 或 username 邀请
   */
  @Post(":project_id/collaborators")
  @UseGuards(ProjectGuard, OwnerGuard)
  async inviteCollaborator(
    @Req() req: RequestWithUser,
    @Param("project_id") projectId: string,
    @Body(new ZodValidationPipe(InviteCollaboratorSchema))
    dto: InviteCollaboratorDto,
  ) {
    const collaborator = await this.projectService.inviteCollaborator(
      projectId,
      req.user.userId,
      dto,
    );

    return {
      id: collaborator.user.id,
      username: collaborator.user.username,
      avatar: collaborator.user.avatar,
      role: collaborator.role,
      joinedAt: collaborator.joinedAt,
    };
  }

  /**
   * 更新协作者角色
   */
  @Put(":project_id/collaborators/:user_id")
  @UseGuards(ProjectGuard, OwnerGuard)
  async updateCollaboratorRole(
    @Param("project_id") projectId: string,
    @Param("user_id") userId: string,
    @Body(new ZodValidationPipe(UpdateCollaboratorRoleSchema))
    dto: UpdateCollaboratorRoleDto,
  ) {
    const collaborator = await this.projectService.updateCollaboratorRole(
      projectId,
      userId,
      dto,
    );

    return {
      id: collaborator.userId,
      role: collaborator.role,
      updatedAt: collaborator.updatedAt,
    };
  }

  /**
   * 移除协作者
   */
  @Delete(":project_id/collaborators/:user_id")
  @UseGuards(ProjectGuard, OwnerGuard)
  async removeCollaborator(
    @Param("project_id") projectId: string,
    @Param("user_id") userId: string,
  ) {
    await this.projectService.removeCollaborator(projectId, userId);

    return null;
  }

  /**
   * 转让项目所有权
   */
  @Post(":project_id/transfer")
  @UseGuards(ProjectGuard, OwnerGuard)
  async transferOwnership(
    @Req() req: RequestWithUser,
    @Param("project_id") projectId: string,
    @Body(new ZodValidationPipe(TransferOwnershipSchema))
    dto: TransferOwnershipDto,
  ) {
    await this.projectService.transferOwnership(
      projectId,
      req.user.userId,
      dto,
    );

    return {
      newOwnerId: dto.userId,
      transferredAt: new Date().toISOString(),
    };
  }

  // ==================== 邀请链接 ====================

  /**
   * 创建邀请链接
   */
  @Post(":project_id/invite-link")
  @UseGuards(ProjectGuard, OwnerGuard)
  async createInviteLink(
    @Req() req: RequestWithUser,
    @Param("project_id") projectId: string,
    @Body(new ZodValidationPipe(CreateInviteLinkSchema))
    dto: CreateInviteLinkDto,
  ) {
    const link = await this.projectService.createInviteLink(
      projectId,
      req.user.userId,
      dto,
    );

    return {
      inviteCode: link.inviteCode,
      inviteUrl: `/projects/join?code=${link.inviteCode}`,
      role: link.role,
      expiresAt: link.expiresAt,
      createdAt: link.createdAt,
    };
  }

  /**
   * 获取邀请链接列表
   */
  @Get(":project_id/invite-links")
  @UseGuards(ProjectGuard, OwnerGuard)
  async getInviteLinks(@Param("project_id") projectId: string) {
    const links = await this.projectService.getInviteLinks(projectId);

    return {
      links: links.map((l) => ({
        inviteCode: l.inviteCode,
        role: l.role,
        expiresAt: l.expiresAt,
        usedCount: l.usedCount,
        maxUses: l.maxUses,
        createdAt: l.createdAt,
      })),
    };
  }

  /**
   * 撤销邀请链接
   */
  @Delete(":project_id/invite-links/:invite_code")
  @UseGuards(ProjectGuard, OwnerGuard)
  async revokeInviteLink(
    @Param("project_id") projectId: string,
    @Param("invite_code") inviteCode: string,
  ) {
    await this.projectService.revokeInviteLink(projectId, inviteCode);

    return null;
  }

  /**
   * 通过链接加入项目
   */
  @Post("join")
  async joinProject(
    @Req() req: RequestWithUser,
    @Body(new ZodValidationPipe(JoinProjectSchema)) dto: JoinProjectDto,
  ) {
    const result = await this.projectService.joinByInviteCode(
      dto.inviteCode,
      req.user.userId,
    );

    return {
      projectId: result.projectId,
      role: result.role,
      joinedAt: new Date().toISOString(),
    };
  }

  // ==================== 模型配置 ====================

  /**
   * 获取项目模型配置
   * 返回经过级联解析（项目 → 用户 → 系统）后的最终模型结果
   */
  @Get(":project_id/models")
  @UseGuards(ProjectGuard)
  async getModelConfigs(
    @Req() req: RequestWithUser,
    @Param("project_id") projectId: string,
  ) {
    const configs = await this.projectService.getModelConfigs(projectId, req.user.userId);

    // 按类别组织返回数据
    const result: Record<string, any> = {};
    for (const config of configs) {
      result[config.category] = config.modelId
        ? {
            modelId: config.modelId,
            modelName: config.modelName,
            providerName: config.providerName,
            description: config.description,
            isDefault: config.isDefault,
            source: config.source,
          }
        : null;
    }

    return {
      configs: result,
      // 同时返回数组格式，方便前端遍历
      list: configs,
    };
  }

  /**
   * 更新项目模型配置
   */
  @Put(":project_id/models")
  @UseGuards(ProjectGuard, EditorGuard)
  async updateModelConfigs(
    @Param("project_id") projectId: string,
    @Body(new ZodValidationPipe(UpdateProjectModelsSchema))
    dto: UpdateProjectModelsDto,
  ) {
    const configs = await this.projectService.updateModelConfigs(
      projectId,
      dto,
    );

    const result: Record<string, any> = {};
    for (const config of configs) {
      result[config.category] = {
        modelId: config.modelId,
        updatedAt: config.updatedAt,
      };
    }

    return result;
  }

  // ==================== 项目统计 ====================

  /**
   * 获取项目统计
   */
  @Get(":project_id/stats")
  @UseGuards(ProjectGuard)
  async getProjectStats(@Param("project_id") projectId: string) {
    const stats = await this.projectService.getProjectStats(projectId);
    return stats;
  }

  /**
   * 获取最近剧本列表
   */
  @Get(":project_id/scripts/recent")
  @UseGuards(ProjectGuard)
  async getRecentScripts(
    @Param("project_id") projectId: string,
    @Query("limit") limit: string = "3",
  ) {
    const scripts = await this.projectService.getRecentScripts(
      projectId,
      parseInt(limit, 10),
    );

    return {
      list: scripts.map((s) => ({
        id: s.scriptId,
        name: s.title,
        description: s.description || null,
        coverUrl: s.coverUrl || null,
        shotGroupReferenceImage: s.shotGroupReferenceImage || null,
        sceneReferenceImage: s.sceneReferenceImage || null,
        status: s.status,
        progress: s.progress,
        updatedAt: s.updatedAt,
      })),
    };
  }

  // ==================== 项目模板 ====================

  /**
   * 获取模板列表
   */
  @Get("templates")
  async getTemplates(
    @Req() req: RequestWithUser,
    @Query(new ZodValidationPipe(QueryTemplatesSchema))
    query: QueryTemplatesDto,
  ) {
    const { list, total } = await this.projectTemplateService.findTemplates(
      req.user.userId,
      query,
    );

    return {
      list: list.map((t) => ({
        id: t.templateId,
        name: t.name,
        description: t.description,
        type: t.type,
        creator:
          t.type === "system"
            ? { id: null, username: "官方" }
            : t.creator
              ? { id: t.creator.id, username: t.creator.username }
              : { id: null, username: "未知" },
        tags: t.tags,
        usageCount: t.usageCount,
        preview: {
          characterCount: t.content?.characters?.length || 0,
          sceneCount: t.content?.scenes?.length || 0,
          actCount: t.content?.scriptOutline?.acts?.length || 0,
        },
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  /**
   * 获取系统模板列表（简化版）
   */
  @Get("templates/system")
  async getSystemTemplates(@Query("limit") limit: string = "10") {
    const templates = await this.projectTemplateService.findTemplates("", {
      type: "system",
      page: 1,
      pageSize: parseInt(limit, 10),
    });

    return {
      list: templates.list.map((t) => ({
        id: t.templateId,
        name: t.name,
        description: t.description,
        tags: t.tags,
        usageCount: t.usageCount,
        preview: {
          characterCount: t.content?.characters?.length || 0,
          sceneCount: t.content?.scenes?.length || 0,
          actCount: t.content?.scriptOutline?.acts?.length || 0,
        },
      })),
    };
  }

  /**
   * 获取模板详情
   */
  @Get("templates/:template_id")
  async getTemplateDetail(
    @Req() req: RequestWithUser,
    @Param("template_id") templateId: string,
  ) {
    const template = await this.projectTemplateService.findTemplateById(
      templateId,
      req.user.userId,
    );

    return {
      id: template.templateId,
      name: template.name,
      description: template.description,
      type: template.type,
      creator:
        template.type === "system"
          ? { id: null, username: "官方" }
          : template.creator
            ? { id: template.creator.id, username: template.creator.username }
            : { id: null, username: "未知" },
      content: template.content,
      modelConfigs: template.modelConfigs,
      tags: template.tags,
      usageCount: template.usageCount,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }

  /**
   * 保存项目为模板
   */
  @Post(":project_id/save-template")
  @UseGuards(ProjectGuard, EditorGuard)
  async saveProjectAsTemplate(
    @Req() req: RequestWithUser,
    @Param("project_id") projectId: string,
    @Body(new ZodValidationPipe(SaveAsTemplateSchema)) dto: SaveAsTemplateDto,
  ) {
    const template = await this.projectTemplateService.saveAsTemplate(
      projectId,
      req.user.userId,
      dto,
    );

    return {
      id: template.templateId,
      name: template.name,
      type: template.type,
      createdAt: template.createdAt,
    };
  }

  /**
   * 删除模板
   */
  @Delete("templates/:template_id")
  async deleteTemplate(
    @Req() req: RequestWithUser,
    @Param("template_id") templateId: string,
  ) {
    await this.projectTemplateService.deleteTemplate(
      templateId,
      req.user.userId,
    );

    return null;
  }

  /**
   * 从模板创建项目
   */
  @Post("templates/:template_id/create-project")
  async createProjectFromTemplate(
    @Req() req: RequestWithUser,
    @Param("template_id") templateId: string,
    @Body(new ZodValidationPipe(CreateFromTemplateSchema))
    dto: CreateFromTemplateDto,
  ) {
    const result = await this.projectTemplateService.createFromTemplate(
      templateId,
      req.user.userId,
      dto,
    );

    return {
      id: result.projectId,
      name: result.name,
      status: result.status,
      role: "owner",
      imported: result.imported,
      createdAt: new Date().toISOString(),
    };
  }
}
