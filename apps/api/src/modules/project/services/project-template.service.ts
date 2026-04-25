import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import {
  ProjectTemplate,
  TemplateContent,
  TemplateType,
  TemplateStatus,
} from "../entities/project-template.entity";
import { ProjectStatus as ProjectStatusConst } from "../entities/project.entity";
import { Project, ProjectStatus } from "../entities/project.entity";
import {
  Collaborator,
  CollaboratorRole,
} from "../entities/collaborator.entity";
import { ProjectModelConfig } from "../entities/project-model-config.entity";
import { UserService } from "../../user/user.service";
import type {
  SaveAsTemplateDto,
  CreateFromTemplateDto,
  QueryTemplatesDto,
} from "../dto";

/**
 * 生成模板ID
 */
function generateTemplateId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "tmpl_";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

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

@Injectable()
export class ProjectTemplateService {
  constructor(
    @InjectRepository(ProjectTemplate)
    private readonly templateRepository: Repository<ProjectTemplate>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Collaborator)
    private readonly collaboratorRepository: Repository<Collaborator>,
    @InjectRepository(ProjectModelConfig)
    private readonly modelConfigRepository: Repository<ProjectModelConfig>,
    private readonly userService: UserService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 获取模板列表
   */
  async findTemplates(
    userId: string,
    query: QueryTemplatesDto,
  ): Promise<{ list: ProjectTemplate[]; total: number }> {
    const { type, keyword, page, pageSize } = query;

    const qb = this.templateRepository
      .createQueryBuilder("pt")
      .leftJoinAndSelect("pt.creator", "creator")
      .where("pt.status = :status", { status: TemplateStatus.ENABLED });

    // 类型筛选
    if (type === TemplateType.SYSTEM) {
      qb.andWhere("pt.type = :type", { type: TemplateType.SYSTEM });
    } else if (type === TemplateType.USER) {
      qb.andWhere("pt.type = :type", { type: TemplateType.USER });
      qb.andWhere("pt.creator_id = :userId", { userId });
    } else {
      // 默认：系统模板 + 当前用户的模板
      qb.andWhere(
        "(pt.type = :systemType OR (pt.type = :userType AND pt.creator_id = :userId))",
        {
          systemType: TemplateType.SYSTEM,
          userType: TemplateType.USER,
          userId,
        },
      );
    }

    // 关键词搜索
    if (keyword) {
      qb.andWhere("pt.name ILIKE :keyword", { keyword: `%${keyword}%` });
    }

    // 排序：系统模板优先，然后按使用次数降序
    qb.orderBy("pt.type", "ASC")
      .addOrderBy("pt.usage_count", "DESC")
      .addOrderBy("pt.created_at", "DESC");

    const [list, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { list, total };
  }

  /**
   * 获取模板详情
   */
  async findTemplateById(
    templateId: string,
    userId: string,
  ): Promise<ProjectTemplate> {
    const template = await this.templateRepository.findOne({
      where: { templateId, status: TemplateStatus.ENABLED },
      relations: ["creator"],
    });

    if (!template) {
      throw new NotFoundException("模板不存在");
    }

    // 权限检查：用户模板只能创建者查看
    if (template.type === TemplateType.USER && template.creatorId !== userId) {
      throw new ForbiddenException("无权访问该模板");
    }

    return template;
  }

  /**
   * 保存项目为模板
   */
  async saveAsTemplate(
    projectId: string,
    userId: string,
    dto: SaveAsTemplateDto,
  ): Promise<ProjectTemplate> {
    // 检查项目是否存在
    const project = await this.projectRepository.findOne({
      where: { projectId, isDeleted: false },
    });

    if (!project) {
      throw new NotFoundException("项目不存在");
    }

    // 检查用户权限（owner 或 editor）
    const collaborator = await this.collaboratorRepository.findOne({
      where: { projectId, userId },
    });

    if (!collaborator) {
      throw new ForbiddenException("无权访问该项目");
    }

    if (
      collaborator.role !== CollaboratorRole.OWNER &&
      collaborator.role !== CollaboratorRole.EDITOR
    ) {
      throw new ForbiddenException("无权限保存该项目为模板");
    }

    // 检查用户模板数量限制
    const userTemplateCount = await this.templateRepository.count({
      where: {
        type: TemplateType.USER,
        creatorId: userId,
        status: TemplateStatus.ENABLED,
      },
    });

    if (userTemplateCount >= 50) {
      throw new BadRequestException("用户模板数量已达上限（50个）");
    }

    // 检查模板名称是否重复
    const existingTemplate = await this.templateRepository.findOne({
      where: {
        name: dto.name,
        creatorId: userId,
        type: TemplateType.USER,
        status: TemplateStatus.ENABLED,
      },
    });

    if (existingTemplate) {
      throw new ConflictException("模板名称已存在");
    }

    // 构建模板内容
    const content = await this.buildTemplateContent(projectId, dto);

    // 获取模型配置
    let modelConfigs = null;
    if (dto.includeModelConfigs) {
      const configs = await this.modelConfigRepository.find({
        where: { projectId },
      });
      modelConfigs = configs.reduce(
        (acc, config) => {
          if (config.modelId) {
            acc[config.category] = config.modelId;
          }
          return acc;
        },
        {} as Record<string, string>,
      );
    }

    // 创建模板
    const template = this.templateRepository.create({
      templateId: generateTemplateId(),
      name: dto.name,
      description: dto.description || null,
      type: TemplateType.USER,
      creatorId: userId,
      content,
      modelConfigs,
      tags: dto.tags || [],
      usageCount: 0,
      isPublic: dto.isPublic || false,
      status: TemplateStatus.ENABLED,
    });

    return this.templateRepository.save(template);
  }

  /**
   * 从模板创建项目
   */
  async createFromTemplate(
    templateId: string,
    userId: string,
    dto: CreateFromTemplateDto,
  ): Promise<{
    projectId: string;
    name: string;
    status: string;
    imported: {
      characterCount: number;
      sceneCount: number;
      propCount: number;
      scriptCreated: boolean;
    };
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 获取模板
      const template = await this.templateRepository.findOne({
        where: {
          templateId,
          status: TemplateStatus.ENABLED,
        },
      });

      if (!template) {
        throw new NotFoundException("模板不存在或不可用");
      }

      // 权限检查
      if (
        template.type === TemplateType.USER &&
        template.creatorId !== userId
      ) {
        throw new ForbiddenException("无权使用该模板");
      }

      // 检查项目名称是否重复
      const existingProject = await this.projectRepository.findOne({
        where: { name: dto.name, isDeleted: false },
      });

      if (existingProject) {
        throw new ConflictException("项目名称已存在");
      }

      // 创建项目
      const newProjectId = generateProjectId();
      const project = this.projectRepository.create({
        projectId: newProjectId,
        name: dto.name,
        description: dto.description || null,
        coverUrl: dto.coverUrl || null,
        ownerId: userId,
        status: ProjectStatusConst.DRAFT,
        isDeleted: false,
      });

      await queryRunner.manager.save(project);

      // 创建 owner 协作者记录
      const ownerCollaborator = this.collaboratorRepository.create({
        projectId: newProjectId,
        userId,
        role: CollaboratorRole.OWNER,
        invitedBy: userId,
      });
      await queryRunner.manager.save(ownerCollaborator);

      const imported = {
        characterCount: 0,
        sceneCount: 0,
        propCount: 0,
        scriptCreated: false,
      };

      const content = template.content;

      // 导入角色
      if (content.characters && content.characters.length > 0) {
        for (const char of content.characters) {
          await queryRunner.manager.query(
            `INSERT INTO characters (id, project_id, name, description, personality, age, gender, importance, reference_image_url, created_at, updated_at)
             VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
            [
              newProjectId,
              char.name,
              char.description || null,
              char.personality || null,
              char.age || null,
              char.gender || null,
              char.importance,
              char.referenceImageUrl || null,
            ],
          );
        }
        imported.characterCount = content.characters.length;
      }

      // 导入场景
      if (content.scenes && content.scenes.length > 0) {
        for (const scene of content.scenes) {
          await queryRunner.manager.query(
            `INSERT INTO scenes (id, project_id, name, description, atmosphere, time_of_day, location, reference_image_url, created_at, updated_at)
             VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
            [
              newProjectId,
              scene.name,
              scene.description || null,
              scene.atmosphere || null,
              scene.timeOfDay || null,
              scene.location || null,
              scene.referenceImageUrl || null,
            ],
          );
        }
        imported.sceneCount = content.scenes.length;
      }

      // 导入道具
      if (content.props && content.props.length > 0) {
        for (const prop of content.props) {
          await queryRunner.manager.query(
            `INSERT INTO props (id, project_id, name, description, category, reference_image_url, created_at, updated_at)
             VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, NOW(), NOW())`,
            [
              newProjectId,
              prop.name,
              prop.description || null,
              prop.category || null,
              prop.referenceImageUrl || null,
            ],
          );
        }
        imported.propCount = content.props.length;
      }

      // 创建剧本并导入大纲
      if (content.scriptOutline) {
        const scriptResult = await queryRunner.manager.query(
          `INSERT INTO scripts (id, project_id, title, status, metadata, created_at, updated_at)
           VALUES (uuid_generate_v4(), $1, $2, $3, $4, NOW(), NOW())
           RETURNING id`,
          [
            newProjectId,
            content.scriptOutline.title,
            "draft",
            JSON.stringify({
              genre: content.scriptOutline.genre,
              tone: content.scriptOutline.tone,
              targetDuration: content.scriptOutline.targetDuration,
              summary: content.scriptOutline.summary,
            }),
          ],
        );

        const scriptId = scriptResult[0]?.id;

        // 导入幕和场
        if (content.scriptOutline.acts && scriptId) {
          for (const act of content.scriptOutline.acts) {
            const actResult = await queryRunner.manager.query(
              `INSERT INTO script_acts (id, script_id, act_number, title, summary, created_at, updated_at)
               VALUES (uuid_generate_v4(), $1, $2, $3, $4, NOW(), NOW())
               RETURNING id`,
              [scriptId, act.number, act.title, act.summary],
            );

            const actId = actResult[0]?.id;

            // 导入场
            if (act.scenes && actId) {
              for (const scene of act.scenes) {
                await queryRunner.manager.query(
                  `INSERT INTO script_scenes (id, act_id, scene_number, title, setting_time, setting_location, setting_atmosphere, characters, summary, created_at, updated_at)
                   VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
                  [
                    actId,
                    scene.number,
                    scene.title,
                    scene.setting.time,
                    scene.setting.location,
                    scene.setting.atmosphere,
                    JSON.stringify(scene.characters),
                    scene.summary,
                  ],
                );
              }
            }
          }
        }

        imported.scriptCreated = true;
      }

      // 导入模型配置
      // 优先使用传入的配置，否则从用户默认配置继承
      let modelsToUse: Record<string, string | null | undefined> = {};
      if (dto.includeModelConfigs && template.modelConfigs) {
        modelsToUse = template.modelConfigs as Record<
          string,
          string | null | undefined
        >;
      }
      if (Object.keys(modelsToUse).length === 0) {
        modelsToUse = await this.userService.getDefaultModels(userId);
      }

      if (modelsToUse && Object.keys(modelsToUse).length > 0) {
        const configs = Object.entries(modelsToUse)
          .filter(
            ([, modelId]) =>
              modelId !== null && modelId !== undefined && modelId !== "",
          )
          .map(([category, modelId]) =>
            this.modelConfigRepository.create({
              projectId: newProjectId,
              category: category as any,
              modelId: modelId as string,
            }),
          );
        if (configs.length > 0) {
          await queryRunner.manager.save(configs);
        }
      }

      // 更新模板使用次数
      await queryRunner.manager.increment(
        ProjectTemplate,
        { templateId },
        "usageCount",
        1,
      );

      await queryRunner.commitTransaction();

      return {
        projectId: newProjectId,
        name: dto.name,
        status: ProjectStatusConst.DRAFT,
        imported,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 删除模板
   */
  async deleteTemplate(templateId: string, userId: string): Promise<void> {
    const template = await this.templateRepository.findOne({
      where: { templateId },
    });

    if (!template) {
      throw new NotFoundException("模板不存在");
    }

    // 系统模板不能删除
    if (template.type === TemplateType.SYSTEM) {
      throw new ForbiddenException("系统模板不能删除");
    }

    // 只能删除自己的模板
    if (template.creatorId !== userId) {
      throw new ForbiddenException("无权删除该模板");
    }

    // 软删除
    template.status = TemplateStatus.DISABLED;
    await this.templateRepository.save(template);
  }

  /**
   * 更新模板
   */
  async updateTemplate(
    templateId: string,
    userId: string,
    dto: Partial<SaveAsTemplateDto>,
  ): Promise<ProjectTemplate> {
    const template = await this.templateRepository.findOne({
      where: { templateId },
    });

    if (!template) {
      throw new NotFoundException("模板不存在");
    }

    // 系统模板不能修改
    if (template.type === TemplateType.SYSTEM) {
      throw new ForbiddenException("系统模板不能修改");
    }

    // 只能修改自己的模板
    if (template.creatorId !== userId) {
      throw new ForbiddenException("无权修改该模板");
    }

    // 检查名称重复
    if (dto.name && dto.name !== template.name) {
      const existing = await this.templateRepository.findOne({
        where: {
          name: dto.name,
          creatorId: userId,
          type: TemplateType.USER,
          status: TemplateStatus.ENABLED,
        },
      });

      if (existing) {
        throw new ConflictException("模板名称已存在");
      }

      template.name = dto.name;
    }

    // 更新字段
    if (dto.description !== undefined) {
      template.description = dto.description || null;
    }

    if (dto.tags !== undefined) {
      template.tags = dto.tags;
    }

    if (dto.isPublic !== undefined) {
      template.isPublic = dto.isPublic;
    }

    return this.templateRepository.save(template);
  }

  /**
   * 构建模板内容
   */
  private async buildTemplateContent(
    projectId: string,
    dto: SaveAsTemplateDto,
  ): Promise<TemplateContent> {
    const content: TemplateContent = {};

    // 查询角色
    const characters = await this.dataSource.query(
      `SELECT name, description, personality, age, gender, importance, reference_image_url as "referenceImageUrl"
       FROM characters
       WHERE project_id = $1 AND deleted_at IS NULL`,
      [projectId],
    );

    if (characters.length > 0) {
      content.characters = characters;
    }

    // 查询场景
    const scenes = await this.dataSource.query(
      `SELECT name, description, atmosphere, time_of_day as "timeOfDay", location, reference_image_url as "referenceImageUrl"
       FROM scenes
       WHERE project_id = $1 AND deleted_at IS NULL`,
      [projectId],
    );

    if (scenes.length > 0) {
      content.scenes = scenes;
    }

    // 查询道具
    const props = await this.dataSource.query(
      `SELECT name, description, category, reference_image_url as "referenceImageUrl"
       FROM props
       WHERE project_id = $1 AND deleted_at IS NULL`,
      [projectId],
    );

    if (props.length > 0) {
      content.props = props;
    }

    // 查询剧本大纲
    const scripts = await this.dataSource.query(
      `SELECT id, title, metadata
       FROM scripts
       WHERE project_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [projectId],
    );

    if (scripts.length > 0) {
      const script = scripts[0];
      const metadata = script.metadata || {};

      // 查询幕
      const acts = await this.dataSource.query(
        `SELECT id, act_number as "number", title, summary
         FROM script_acts
         WHERE script_id = $1
         ORDER BY act_number`,
        [script.id],
      );

      const actOutlines = [];
      for (const act of acts) {
        // 查询场
        const scenes = await this.dataSource.query(
          `SELECT scene_number as "number", title, setting_time as "time",
                  setting_location as "location", setting_atmosphere as "atmosphere",
                  characters, summary
           FROM script_scenes
           WHERE act_id = $1
           ORDER BY scene_number`,
          [act.id],
        );

        actOutlines.push({
          number: act.number,
          title: act.title,
          summary: act.summary,
          scenes: scenes.map((s: any) => ({
            number: s.number,
            title: s.title,
            setting: {
              time: s.time,
              location: s.location,
              atmosphere: s.atmosphere,
            },
            characters:
              typeof s.characters === "string"
                ? JSON.parse(s.characters)
                : s.characters,
            summary: s.summary,
          })),
        });
      }

      content.scriptOutline = {
        title: script.title,
        genre: metadata.genre,
        tone: metadata.tone,
        targetDuration: metadata.targetDuration,
        summary: metadata.summary || "",
        acts: actOutlines,
      };
    }

    return content;
  }
}
