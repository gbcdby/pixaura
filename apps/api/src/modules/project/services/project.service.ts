import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource, In, Not } from "typeorm";
import { Project, ProjectStatus } from "../entities/project.entity";
import {
  Collaborator,
  CollaboratorRole,
  type CollaboratorRoleType,
} from "../entities/collaborator.entity";
import { UserService } from "../../user/user.service";
import { OssService } from "../../../common/oss/oss.service";
import { ProjectModelConfig } from "../entities/project-model-config.entity";
import { ProjectInviteLink } from "../entities/project-invite-link.entity";
import { CleanupQueue } from "../entities/cleanup-queue.entity";
import { ModelService } from "../../model-config/services/model.service";
import type {
  CreateProjectDto,
  UpdateProjectDto,
  QueryProjectsDto,
  InviteCollaboratorDto,
  UpdateCollaboratorRoleDto,
  CreateInviteLinkDto,
  UpdateProjectModelsDto,
  TransferOwnershipDto,
} from "../dto";

/**
 * 生成项目ID
 */
function generateProjectId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "proj_";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 生成邀请码
 */
function generateInviteCode(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 从剧本内容中提取封面图URL
 * 优先级：metadata.coverUrl > 分镜组主图 > 场景参考图
 */
function extractCoverFromScriptContent(
  content: Record<string, unknown> | null,
  metadata: Record<string, unknown> | null,
): string | null {
  const safeContent = content || {};
  const metadataCoverUrl = (metadata?.coverUrl as string) || null;
  if (metadataCoverUrl) return metadataCoverUrl;

  // 从分镜组获取第一张参考图
  const shotGroups =
    (safeContent.shotGroups as Array<Record<string, unknown>>) || [];
  if (shotGroups.length > 0) {
    const firstShotGroup = shotGroups[0];
    const images =
      (firstShotGroup.images as Array<Record<string, unknown>>) || [];
    if (images.length > 0) {
      const mainImageId = firstShotGroup.mainImageId as string;
      const mainImage = mainImageId
        ? images.find((img) => img.id === mainImageId)
        : images[0];
      const url =
        (mainImage?.url as string) ||
        (mainImage?.thumbnailUrl as string) ||
        null;
      if (url) return url;
    }
  }

  // 从场景获取第一张参考图
  const scenes =
    (safeContent.scenes as Array<Record<string, unknown>>) || [];
  if (scenes.length > 0) {
    const firstScene = scenes[0];
    const images =
      (firstScene.images as Array<Record<string, unknown>>) || [];
    if (images.length > 0) {
      const mainImageId = firstScene.mainImageId as string;
      const mainImage = mainImageId
        ? images.find((img) => img.id === mainImageId)
        : images[0];
      const url =
        (mainImage?.url as string) ||
        (mainImage?.thumbnailUrl as string) ||
        null;
      if (url) return url;
    }
  }

  return null;
}

/**
 * 判断分镜组是否已完成视频生成
 * 与前端 ExportStep.vue / ShotGroupPreviewPlayer.vue 逻辑保持一致
 */
function isShotGroupCompleted(sg: Record<string, unknown>): boolean {
  const videoMode = sg.videoMode as string | undefined;
  const video = sg.video as Record<string, unknown> | undefined;
  const shots = (sg.shots as Array<Record<string, unknown>>) || [];

  if (videoMode === "lip_sync") {
    if (shots.length === 0) return false;
    return shots.every(
      (s) => s.status === "completed" && !!s.videoUrl,
    );
  }

  // video_only / audio_reference / 未指定模式
  return video?.status === "completed" && !!video.videoUrl;
}

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);

  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Collaborator)
    private readonly collaboratorRepository: Repository<Collaborator>,
    @InjectRepository(ProjectModelConfig)
    private readonly modelConfigRepository: Repository<ProjectModelConfig>,
    @InjectRepository(ProjectInviteLink)
    private readonly inviteLinkRepository: Repository<ProjectInviteLink>,
    @InjectRepository(CleanupQueue)
    private readonly cleanupQueueRepository: Repository<CleanupQueue>,
    private readonly userService: UserService,
    private readonly modelService: ModelService,
    private readonly dataSource: DataSource,
    private readonly ossService: OssService,
  ) {}

  // ==================== 项目 CRUD ====================

  /**
   * 创建项目
   */
  async createProject(userId: string, dto: CreateProjectDto): Promise<Project> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 创建项目
      const project = this.projectRepository.create({
        projectId: generateProjectId(),
        name: dto.name,
        description: dto.description || null,
        coverUrl: dto.coverUrl || null,
        ownerId: userId,
        status: ProjectStatus.DRAFT,
        isDeleted: false,
      });

      const savedProject = await queryRunner.manager.save(project);

      // 创建 owner 协作者记录
      const collaborator = this.collaboratorRepository.create({
        projectId: savedProject.projectId,
        userId,
        role: CollaboratorRole.OWNER,
        invitedBy: userId,
      });
      await queryRunner.manager.save(collaborator);

      // 创建默认模型配置
      // 优先使用传入的配置，否则从用户默认配置继承
      let modelsToUse = dto.defaultModels;
      if (!modelsToUse || Object.keys(modelsToUse).length === 0) {
        modelsToUse = await this.userService.getDefaultModels(userId);
      }

      if (modelsToUse) {
        const configs = Object.entries(modelsToUse)
          .filter(([, modelId]) => modelId !== null && modelId !== "")
          .map(([category, modelId]) =>
            this.modelConfigRepository.create({
              projectId: savedProject.projectId,
              category: category as any,
              modelId: modelId as string,
            }),
          );
        if (configs.length > 0) {
          await queryRunner.manager.save(configs);
        }
      }

      await queryRunner.commitTransaction();
      return savedProject;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 获取项目列表
   */
  async getProjects(
    userId: string,
    query: QueryProjectsDto,
  ): Promise<{
    list: Array<
      Project & {
        role: CollaboratorRoleType;
        scriptCount: number;
        collaboratorCount: number;
      }
    >;
    total: number;
  }> {
    const { status, role, keyword, page, pageSize } = query;

    // 先查询用户参与的项目ID列表和角色
    const collaboratorQuery = this.collaboratorRepository
      .createQueryBuilder("c")
      .select("c.project_id", "project_id")
      .addSelect("c.role", "role")
      .where("c.user_id = :userId", { userId });

    if (role) {
      collaboratorQuery.andWhere("c.role = :role", { role });
    }

    const collaboratorResults = await collaboratorQuery.getRawMany();
    const projectIds = collaboratorResults.map((r) => r.project_id);
    const roleMap = new Map<string, CollaboratorRoleType>(
      collaboratorResults.map((r) => [r.project_id, r.role]),
    );

    if (projectIds.length === 0) {
      return { list: [], total: 0 };
    }

    // 再查询项目详情（带所有者）
    const qb = this.projectRepository
      .createQueryBuilder("p")
      .leftJoinAndSelect("p.owner", "owner")
      .where("p.project_id IN (:...projectIds)", { projectIds })
      .andWhere("p.is_deleted = false");

    if (status) {
      qb.andWhere("p.status = :status", { status });
    }

    if (keyword) {
      qb.andWhere("p.name ILIKE :keyword", { keyword: `%${keyword}%` });
    }

    const [list, total] = await qb
      .orderBy("p.updatedAt", "DESC")
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    if (list.length === 0) {
      return { list: [], total };
    }

    // 批量统计剧本数量
    const scriptCountResult = await this.dataSource.query(
      `SELECT project_id, COUNT(*) as count FROM scripts WHERE project_id = ANY($1) AND deleted_at IS NULL GROUP BY project_id`,
      [projectIds],
    );
    const scriptCountMap = new Map<string, number>(
      scriptCountResult.map(
        (r: { project_id: string; count: string }) => [
          r.project_id,
          parseInt(r.count, 10),
        ],
      ),
    );

    // 批量统计协作者数量
    const collaboratorCountResult = await this.dataSource.query(
      `SELECT project_id, COUNT(*) as count FROM collaborator WHERE project_id = ANY($1) GROUP BY project_id`,
      [projectIds],
    );
    const collaboratorCountMap = new Map<string, number>(
      collaboratorCountResult.map(
        (r: { project_id: string; count: string }) => [
          r.project_id,
          parseInt(r.count, 10),
        ],
      ),
    );

    // 批量查询每个项目最新剧本（用于提取封面图）
    const latestScripts = await this.dataSource.query(
      `SELECT DISTINCT ON (project_id) project_id, content, metadata
       FROM scripts
       WHERE project_id = ANY($1) AND deleted_at IS NULL
       ORDER BY project_id, updated_at DESC`,
      [projectIds],
    );
    const latestScriptMap = new Map<
      string,
      {
        content: Record<string, unknown> | null;
        metadata: Record<string, unknown> | null;
      }
    >(
      latestScripts.map(
        (s: {
          project_id: string;
          content: Record<string, unknown> | null;
          metadata: Record<string, unknown> | null;
        }) => [s.project_id, { content: s.content, metadata: s.metadata }],
      ),
    );

    const enrichedList = list.map((project) => {
      let coverUrl = project.coverUrl;
      if (!coverUrl) {
        const latestScript = latestScriptMap.get(project.projectId);
        if (latestScript) {
          coverUrl = extractCoverFromScriptContent(
            latestScript.content,
            latestScript.metadata,
          );
        }
      }
      return {
        ...project,
        coverUrl,
        role: roleMap.get(project.projectId) || CollaboratorRole.VIEWER,
        scriptCount: scriptCountMap.get(project.projectId) || 0,
        collaboratorCount:
          collaboratorCountMap.get(project.projectId) || 0,
      };
    });

    return { list: enrichedList, total };
  }

  /**
   * 获取项目详情
   */
  async getProjectDetail(projectId: string, userId: string): Promise<Project> {
    const project = await this.projectRepository.findOne({
      where: { projectId, isDeleted: false },
      relations: ["owner", "collaborators", "collaborators.user"],
    });

    if (!project) {
      throw new NotFoundException("项目不存在");
    }

    // 验证用户是否为项目成员
    const isMember = await this.collaboratorRepository.exists({
      where: { projectId, userId },
    });

    if (!isMember) {
      throw new ForbiddenException("无访问权限");
    }

    // 回填封面图（从最新剧本提取）
    if (!project.coverUrl) {
      const latestScript = await this.dataSource.query(
        `SELECT content, metadata FROM scripts
         WHERE project_id = $1 AND deleted_at IS NULL
         ORDER BY updated_at DESC LIMIT 1`,
        [projectId],
      );
      if (latestScript.length > 0) {
        project.coverUrl = extractCoverFromScriptContent(
          latestScript[0].content,
          latestScript[0].metadata,
        );
      }
    }

    return project;
  }

  /**
   * 更新项目
   */
  async updateProject(
    projectId: string,
    userId: string,
    dto: UpdateProjectDto,
  ): Promise<Project> {
    const project = await this.projectRepository.findOne({
      where: { projectId, isDeleted: false },
    });

    if (!project) {
      throw new NotFoundException("项目不存在");
    }

    // 检查权限
    const role = await this.getUserRole(projectId, userId);
    if (!role || (role !== "owner" && role !== "editor")) {
      throw new ForbiddenException("无编辑权限");
    }

    // 状态变更只允许 owner
    if (dto.status && role !== "owner") {
      throw new ForbiddenException("仅所有者可修改项目状态");
    }

    // 更新字段
    if (dto.name !== undefined) project.name = dto.name;
    if (dto.description !== undefined) {
      // 空字符串转为 null 以清空描述
      project.description = dto.description || null;
    }
    if (dto.coverUrl !== undefined) project.coverUrl = dto.coverUrl;

    // 状态流转逻辑
    if (dto.status) {
      const validTransitions: Record<string, string[]> = {
        [ProjectStatus.DRAFT]: [ProjectStatus.ACTIVE, ProjectStatus.ARCHIVED],
        [ProjectStatus.ACTIVE]: [
          ProjectStatus.DRAFT,
          ProjectStatus.COMPLETED,
          ProjectStatus.ARCHIVED,
        ],
        [ProjectStatus.COMPLETED]: [
          ProjectStatus.ACTIVE,
          ProjectStatus.ARCHIVED,
        ],
        [ProjectStatus.ARCHIVED]: [], // 从归档恢复需要特殊处理
      };

      if (
        project.status === ProjectStatus.ARCHIVED &&
        dto.status !== ProjectStatus.ARCHIVED
      ) {
        // 从归档恢复
        project.status = dto.status;
        project.previousStatus = null;
      } else if (validTransitions[project.status]?.includes(dto.status)) {
        if (dto.status === ProjectStatus.ARCHIVED) {
          project.previousStatus = project.status;
        }
        project.status = dto.status;
      } else {
        throw new BadRequestException("无效的状态流转");
      }
    }

    return this.projectRepository.save(project);
  }

  /**
   * 删除项目（软删除）
   */
  async deleteProject(projectId: string, userId: string): Promise<void> {
    const project = await this.projectRepository.findOne({
      where: { projectId, isDeleted: false },
    });

    if (!project) {
      throw new NotFoundException("项目不存在");
    }

    const role = await this.getUserRole(projectId, userId);
    if (role !== "owner") {
      throw new ForbiddenException("仅所有者可删除项目");
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 软删除项目
      project.isDeleted = true;
      project.deletedAt = new Date();
      project.deletedBy = userId;
      await queryRunner.manager.save(project);

      // 添加到清理队列（30天后清理）
      const scheduledAt = new Date();
      scheduledAt.setDate(scheduledAt.getDate() + 30);

      const cleanupTask = this.cleanupQueueRepository.create({
        resourceType: "project",
        resourceId: projectId,
        projectId,
        action: "delete",
        status: "pending",
        scheduledAt,
      });
      await queryRunner.manager.save(cleanupTask);

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 获取回收站项目列表
   */
  async getTrashProjects(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{ list: Project[]; total: number }> {
    const qb = this.projectRepository
      .createQueryBuilder("p")
      .where("p.owner_id = :userId", { userId })
      .andWhere("p.is_deleted = true");

    const [list, total] = await qb
      .orderBy("p.deleted_at", "DESC")
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    // 批量查询每个项目最新剧本（用于提取封面图）
    const projectIds = list.map((p) => p.projectId);
    if (projectIds.length > 0) {
      const latestScripts = await this.dataSource.query(
        `SELECT DISTINCT ON (project_id) project_id, content, metadata
         FROM scripts
         WHERE project_id = ANY($1) AND deleted_at IS NULL
         ORDER BY project_id, updated_at DESC`,
        [projectIds],
      );
      const latestScriptMap = new Map<
        string,
        {
          content: Record<string, unknown> | null;
          metadata: Record<string, unknown> | null;
        }
      >(
        latestScripts.map(
          (s: {
            project_id: string;
            content: Record<string, unknown> | null;
            metadata: Record<string, unknown> | null;
          }) => [s.project_id, { content: s.content, metadata: s.metadata }],
        ),
      );

      for (const project of list) {
        if (!project.coverUrl) {
          const latestScript = latestScriptMap.get(project.projectId);
          if (latestScript) {
            project.coverUrl = extractCoverFromScriptContent(
              latestScript.content,
              latestScript.metadata,
            );
          }
        }
      }
    }

    return { list, total };
  }

  /**
   * 恢复项目
   */
  async restoreProject(projectId: string, userId: string): Promise<void> {
    const project = await this.projectRepository.findOne({
      where: { projectId, isDeleted: true },
    });

    if (!project) {
      throw new NotFoundException("项目不在回收站中");
    }

    if (project.ownerId !== userId) {
      throw new ForbiddenException("仅所有者可恢复项目");
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 恢复项目
      project.isDeleted = false;
      project.deletedAt = null;
      project.deletedBy = null;
      await queryRunner.manager.save(project);

      // 删除清理队列任务
      await queryRunner.manager.delete(CleanupQueue, {
        resourceType: "project",
        resourceId: projectId,
        status: "pending",
      });

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 永久删除项目
   */
  async permanentDeleteProject(
    projectId: string,
    userId: string,
  ): Promise<void> {
    const project = await this.projectRepository.findOne({
      where: { projectId, isDeleted: true },
    });

    if (!project) {
      throw new NotFoundException("项目不在回收站中");
    }

    if (project.ownerId !== userId) {
      throw new ForbiddenException("仅所有者可永久删除项目");
    }

    // 物理删除（级联删除由数据库外键处理）
    await this.projectRepository.remove(project);

    // 清理该项目下所有文件（包括素材库和剧本素材）
    // 新路径结构：projects/{projectId}/ 和 projects/{projectId}/scripts/{scriptId}/
    const prefixes = [
      `image/projects/${projectId}/`,
      `video/projects/${projectId}/`,
      `audio/projects/${projectId}/`,
      `mask/projects/${projectId}/`,
    ];

    for (const prefix of prefixes) {
      try {
        const result = await this.ossService.deleteFilesByPrefix(prefix);
        if (result.deleted > 0) {
          this.logger.log(
            `项目文件清理: ${prefix}, 删除 ${result.deleted} 个文件`,
          );
        }
      } catch (e) {
        this.logger.warn(
          `项目文件清理失败: ${prefix}, ${(e as Error).message}`,
        );
      }
    }
  }

  // ==================== 协作者管理 ====================

  /**
   * 获取协作者列表
   */
  async getCollaborators(projectId: string): Promise<Collaborator[]> {
    return this.collaboratorRepository.find({
      where: { projectId },
      relations: ["user"],
      order: { joinedAt: "ASC" },
    });
  }

  /**
   * 邀请协作者
   * 支持通过 userId 或 username 邀请
   */
  async inviteCollaborator(
    projectId: string,
    invitedBy: string,
    dto: InviteCollaboratorDto,
  ): Promise<{
    user: { id: string; username: string; avatar: string | null };
    role: string;
    joinedAt: Date;
  }> {
    // 检查项目是否存在
    const project = await this.projectRepository.findOne({
      where: { projectId, isDeleted: false },
    });
    if (!project) {
      throw new NotFoundException("项目不存在");
    }

    // 查找被邀请用户（支持 userId 或 username）
    let user: { id: string; username: string; avatar: string | null } | null =
      null;

    if ("userId" in dto && dto.userId) {
      // 通过 userId 查找
      const foundUser = await this.userService.findById(dto.userId);
      if (foundUser) {
        user = {
          id: foundUser.id,
          username: foundUser.username,
          avatar: foundUser.avatar,
        };
      }
    } else if ("username" in dto && dto.username) {
      // 通过 username 查找
      const foundUser = await this.userService.findByUsername(dto.username);
      if (foundUser) {
        user = {
          id: foundUser.id,
          username: foundUser.username,
          avatar: foundUser.avatar,
        };
      }
    }

    if (!user) {
      throw new NotFoundException("用户不存在");
    }

    const userId = user.id;

    // 不能邀请自己
    if (userId === invitedBy) {
      throw new BadRequestException("不能邀请自己");
    }

    // 检查是否已经是协作者
    const exists = await this.collaboratorRepository.exists({
      where: { projectId, userId },
    });
    if (exists) {
      throw new ConflictException("用户已是项目成员");
    }

    const collaborator = this.collaboratorRepository.create({
      projectId,
      userId,
      role: dto.role as CollaboratorRoleType,
      invitedBy,
    });

    const saved = await this.collaboratorRepository.save(collaborator);

    // 返回包含用户信息的完整数据
    return { user, role: saved.role, joinedAt: saved.joinedAt };
  }

  /**
   * 更新协作者角色
   */
  async updateCollaboratorRole(
    projectId: string,
    userId: string,
    dto: UpdateCollaboratorRoleDto,
  ): Promise<Collaborator> {
    const collaborator = await this.collaboratorRepository.findOne({
      where: { projectId, userId },
    });

    if (!collaborator) {
      throw new NotFoundException("协作者不存在");
    }

    if (collaborator.role === "owner") {
      throw new ForbiddenException("不能修改所有者角色");
    }

    collaborator.role = dto.role as CollaboratorRoleType;
    return this.collaboratorRepository.save(collaborator);
  }

  /**
   * 移除协作者
   */
  async removeCollaborator(projectId: string, userId: string): Promise<void> {
    const collaborator = await this.collaboratorRepository.findOne({
      where: { projectId, userId },
    });

    if (!collaborator) {
      throw new NotFoundException("协作者不存在");
    }

    if (collaborator.role === "owner") {
      throw new ForbiddenException("不能移除所有者");
    }

    await this.collaboratorRepository.remove(collaborator);
  }

  /**
   * 转让项目所有权
   */
  async transferOwnership(
    projectId: string,
    ownerId: string,
    dto: TransferOwnershipDto,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 检查新所有者是否已经是协作者
      const newOwnerCollab = await this.collaboratorRepository.findOne({
        where: { projectId, userId: dto.userId },
      });

      if (!newOwnerCollab) {
        throw new BadRequestException("目标用户不是项目成员");
      }

      // 更新原所有者为 editor
      await queryRunner.manager.update(
        Collaborator,
        { projectId, userId: ownerId },
        { role: CollaboratorRole.EDITOR },
      );

      // 更新新所有者为 owner
      await queryRunner.manager.update(
        Collaborator,
        { projectId, userId: dto.userId },
        { role: CollaboratorRole.OWNER },
      );

      // 更新项目 owner_id
      await queryRunner.manager.update(
        Project,
        { projectId },
        { ownerId: dto.userId },
      );

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ==================== 邀请链接 ====================

  /**
   * 创建邀请链接
   */
  async createInviteLink(
    projectId: string,
    createdBy: string,
    dto: CreateInviteLinkDto,
  ): Promise<ProjectInviteLink> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + dto.expireDays);

    const inviteLink = this.inviteLinkRepository.create({
      projectId,
      inviteCode: generateInviteCode(),
      role: dto.role as any,
      maxUses: 1,
      usedCount: 0,
      expiresAt,
      createdBy,
    });

    return this.inviteLinkRepository.save(inviteLink);
  }

  /**
   * 获取邀请链接列表
   */
  async getInviteLinks(projectId: string): Promise<ProjectInviteLink[]> {
    return this.inviteLinkRepository.find({
      where: { projectId },
      order: { createdAt: "DESC" },
    });
  }

  /**
   * 撤销邀请链接
   */
  async revokeInviteLink(projectId: string, inviteCode: string): Promise<void> {
    const link = await this.inviteLinkRepository.findOne({
      where: { projectId, inviteCode },
    });

    if (!link) {
      throw new NotFoundException("邀请链接不存在");
    }

    link.revokedAt = new Date();
    await this.inviteLinkRepository.save(link);
  }

  /**
   * 通过邀请链接加入项目
   */
  async joinByInviteCode(
    inviteCode: string,
    userId: string,
  ): Promise<{ projectId: string; role: string }> {
    const link = await this.inviteLinkRepository.findOne({
      where: { inviteCode },
    });

    if (!link) {
      throw new NotFoundException("邀请链接不存在");
    }

    if (link.revokedAt) {
      throw new ForbiddenException("邀请链接已被撤销");
    }

    if (link.expiresAt < new Date()) {
      throw new ForbiddenException("邀请链接已过期");
    }

    if (link.usedCount >= link.maxUses) {
      throw new ForbiddenException("邀请链接已达使用次数上限");
    }

    // 检查是否已经是成员
    const exists = await this.collaboratorRepository.exists({
      where: { projectId: link.projectId, userId },
    });
    if (exists) {
      throw new ConflictException("你已是项目成员");
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 添加协作者
      const collaborator = this.collaboratorRepository.create({
        projectId: link.projectId,
        userId,
        role: link.role,
        invitedBy: link.createdBy,
      });
      await queryRunner.manager.save(collaborator);

      // 更新邀请链接使用次数
      link.usedCount += 1;
      await queryRunner.manager.save(link);

      await queryRunner.commitTransaction();

      return { projectId: link.projectId, role: link.role };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ==================== 模型配置 ====================

  /**
   * 获取项目模型配置（带级联解析）
   * 返回完整的模型信息，包括模型名称、供应商等，供前端模型选择器使用
   * 级联链：项目配置 → 用户默认配置 → 系统默认模型
   * @param projectId 项目ID
   * @param userId 用户ID（用于获取用户默认模型配置）
   */
  async getModelConfigs(projectId: string, userId: string): Promise<
    Array<{
      category: string;
      modelId: string | null;
      modelName: string | null;
      providerName: string | null;
      description: string | null;
      isDefault: boolean;
      source: "project" | "user" | "system";
    }>
  > {
    // 获取项目的模型配置
    const configs = await this.modelConfigRepository.find({
      where: { projectId },
      relations: ["model"],
    });

    // 构建配置映射（使用 string 作为 key）
    const configMap = new Map<string, ProjectModelConfig>(
      configs.map((config) => [config.category, config]),
    );

    // 获取用户默认模型配置
    const userDefaultModels = await this.userService.getDefaultModels(userId);

    // 定义所有支持的模型类别
    const allCategories = [
      "TEXT_GENERATION",
      "IMAGE_GENERATION",
      "VIDEO_GENERATION",
      "AUDIO_GENERATION",
      "LIP_SYNC",
    ];

    // 构建结果
    const result = await Promise.all(
      allCategories.map(async (category) => {
        const config = configMap.get(category);

        // 优先级 1: 项目级别配置
        if (config?.modelId) {
          const modelDetail = await this.modelService.findByIdWithProvider(
            config.modelId,
          );

          if (modelDetail && modelDetail.status === "enabled") {
            return {
              category,
              modelId: config.modelId,
              modelName: modelDetail.modelName,
              providerName: modelDetail.provider?.providerName || null,
              description: modelDetail.description,
              isDefault: modelDetail.isDefault,
              source: "project" as const,
            };
          }
        }

        // 优先级 2: 用户默认配置
        const userModelId = userDefaultModels[category];
        if (userModelId) {
          const modelDetail = await this.modelService.findByIdWithProvider(
            userModelId,
          );

          if (modelDetail && modelDetail.status === "enabled") {
            return {
              category,
              modelId: userModelId,
              modelName: modelDetail.modelName,
              providerName: modelDetail.provider?.providerName || null,
              description: modelDetail.description,
              isDefault: modelDetail.isDefault,
              source: "user" as const,
            };
          }
        }

        // 优先级 3: 系统默认模型
        const systemDefaultModel = await this.modelService.getDefaultModelForCategory(
          category,
        );

        if (systemDefaultModel) {
          const modelDetail = await this.modelService.findByIdWithProvider(
            systemDefaultModel.modelId,
          );

          return {
            category,
            modelId: systemDefaultModel.modelId,
            modelName: modelDetail?.modelName || systemDefaultModel.modelName,
            providerName: modelDetail?.provider?.providerName || null,
            description: modelDetail?.description || null,
            isDefault: true,
            source: "system" as const,
          };
        }

        // 无任何配置
        return {
          category,
          modelId: null,
          modelName: null,
          providerName: null,
          description: null,
          isDefault: false,
          source: "system" as const,
        };
      }),
    );

    return result;
  }

  /**
   * 更新项目模型配置
   */
  async updateModelConfigs(
    projectId: string,
    configs: UpdateProjectModelsDto,
  ): Promise<ProjectModelConfig[]> {
    const results: ProjectModelConfig[] = [];

    for (const [category, modelId] of Object.entries(configs)) {
      const existing = await this.modelConfigRepository.findOne({
        where: { projectId, category: category as any },
      });

      if (existing) {
        existing.modelId = modelId;
        results.push(await this.modelConfigRepository.save(existing));
      } else if (modelId !== null) {
        const config = this.modelConfigRepository.create({
          projectId,
          category: category as any,
          modelId,
        });
        results.push(await this.modelConfigRepository.save(config));
      }
    }

    return results;
  }

  // ==================== 工具方法 ====================

  /**
   * 获取用户在项目中的角色
   */
  async getUserRole(projectId: string, userId: string): Promise<string | null> {
    const collaborator = await this.collaboratorRepository.findOne({
      where: { projectId, userId },
    });
    return collaborator?.role || null;
  }

  // ==================== 项目统计 ====================

  /**
   * 获取项目统计
   */
  async getProjectStats(projectId: string): Promise<{
    scriptCount: number;
    characterCount: number;
    sceneCount: number;
    propCount: number;
  }> {
    // 检查项目是否存在
    const project = await this.projectRepository.findOne({
      where: { projectId, isDeleted: false },
    });

    if (!project) {
      throw new NotFoundException("项目不存在");
    }

    // 使用 DataSource 直接查询，避免循环依赖
    const [scriptResult, characterResult, sceneResult, propResult] =
      await Promise.all([
        this.dataSource.query(
          `SELECT COUNT(*) as count FROM scripts WHERE project_id = $1 AND deleted_at IS NULL`,
          [projectId],
        ),
        this.dataSource.query(
          `SELECT COUNT(*) as count FROM characters WHERE project_id = $1 AND deleted_at IS NULL`,
          [projectId],
        ),
        this.dataSource.query(
          `SELECT COUNT(*) as count FROM scenes WHERE project_id = $1 AND deleted_at IS NULL`,
          [projectId],
        ),
        this.dataSource.query(
          `SELECT COUNT(*) as count FROM props WHERE project_id = $1 AND deleted_at IS NULL`,
          [projectId],
        ),
      ]);

    return {
      scriptCount: parseInt(scriptResult[0]?.count || "0", 10),
      characterCount: parseInt(characterResult[0]?.count || "0", 10),
      sceneCount: parseInt(sceneResult[0]?.count || "0", 10),
      propCount: parseInt(propResult[0]?.count || "0", 10),
    };
  }

  /**
   * 获取最近剧本列表
   */
  async getRecentScripts(
    projectId: string,
    limit: number = 3,
  ): Promise<
    Array<{
      scriptId: string;
      title: string;
      description: string | null;
      coverUrl: string | null;
      shotGroupReferenceImage: string | null;
      sceneReferenceImage: string | null;
      status: string;
      progress: number;
      updatedAt: Date;
    }>
  > {
    // 检查项目是否存在
    const project = await this.projectRepository.findOne({
      where: { projectId, isDeleted: false },
    });

    if (!project) {
      throw new NotFoundException("项目不存在");
    }

    // 限制最大返回数量
    const safeLimit = Math.min(Math.max(limit, 1), 10);

    // 查询最近更新的剧本
    const scripts = await this.dataSource.query(
      `SELECT id, title, description, status, content, metadata, updated_at
       FROM scripts
       WHERE project_id = $1 AND deleted_at IS NULL
       ORDER BY updated_at DESC
       LIMIT $2`,
      [projectId, safeLimit],
    );

    // 计算每个剧本的进度和封面图
    const result = await Promise.all(
      scripts.map(
        async (script: {
          id: string;
          title: string;
          description: string | null;
          status: string;
          content: Record<string, unknown> | null;
          metadata: Record<string, unknown> | null;
          updated_at: Date;
        }) => {
          // 从 content.shotGroups 计算分镜进度
          const shotGroups =
            (script.content?.shotGroups as Array<Record<string, unknown>>) ||
            [];
          const totalShots = shotGroups.length;
          const completedShots = shotGroups.filter(
            isShotGroupCompleted,
          ).length;

          const progress =
            totalShots > 0
              ? Math.round((completedShots / totalShots) * 100)
              : 0;

          // 计算封面图
          const coverUrl = extractCoverFromScriptContent(
            script.content,
            script.metadata,
          );

          // 获取 description（优先数据库字段，其次 content.description）
          const description =
            script.description ||
            ((script.content?.description as string) || null);

          return {
            scriptId: script.id,
            title: script.title,
            description,
            coverUrl,
            shotGroupReferenceImage: null,
            sceneReferenceImage: null,
            status: script.status,
            progress,
            updatedAt: script.updated_at,
          };
        },
      ),
    );

    return result;
  }
}
