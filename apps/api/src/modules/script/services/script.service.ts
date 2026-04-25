import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  Repository,
  DataSource,
  IsNull,
  In,
  OptimisticLockVersionMismatchError,
} from "typeorm";
import { Script, ScriptStatus } from "../entities/script.entity";
import { AITask, AITaskStatus, AITaskType } from "../entities/ai-task.entity";
import {
  AssetCrossProjectRef,
  type AssetTypeType,
} from "../entities/asset-cross-project-ref.entity";
import {
  Collaborator,
  CollaboratorRole,
} from "../../project/entities/collaborator.entity";
import { Project } from "../../project/entities/project.entity";
import { ProjectModelConfig } from "../../project/entities/project-model-config.entity";
import { User } from "../../user/entities/user.entity";
import { Character } from "../../character/entities/character.entity";
import { Scene } from "../../scene/entities/scene.entity";
import { Prop } from "../../prop/entities/prop.entity";
import {
  CreateScriptDto,
  UpdateScriptDto,
  QueryScriptsDto,
  AIGenerateScriptDto,
  ImportScriptDto,
  ParseScriptDto,
  AIContinueDto,
  AIRewriteDto,
  AIExpandDto,
  AICondenseDto,
  ImportAssetFromProjectDto,
  QueryImportableAssetsDto,
  ConfirmScriptDto,
} from "../dto";
import { calculateScriptStats } from "../utils/script-content.util";
import { OpenAICompatibleProvider } from "../../ai/providers/openai-compatible.provider";
import { safeJsonParse } from "../../../common/utils/json.util";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { RedlockService } from "../../../common/services/redlock.service";
import { OssService } from "../../../common/oss/oss.service";
import { CharacterService } from "../../character/services/character.service";
import { SceneService } from "../../scene/services/scene.service";
import { PropService } from "../../prop/services/prop.service";
import { ModelService } from "../../model-config/services/model.service";
import { ScriptContentSchema } from "@pixaura/shared-types";

/**
 * 剧本服务
 */
@Injectable()
export class ScriptService {
  private readonly logger = new Logger(ScriptService.name);

  constructor(
    @InjectRepository(Script)
    private readonly scriptRepository: Repository<Script>,
    @InjectRepository(AITask)
    private readonly aiTaskRepository: Repository<AITask>,
    @InjectRepository(AssetCrossProjectRef)
    private readonly crossProjectRefRepository: Repository<AssetCrossProjectRef>,
    @InjectRepository(Collaborator)
    private readonly collaboratorRepository: Repository<Collaborator>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(ProjectModelConfig)
    private readonly projectModelConfigRepository: Repository<ProjectModelConfig>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Character)
    private readonly characterRepository: Repository<Character>,
    @InjectRepository(Scene)
    private readonly sceneRepository: Repository<Scene>,
    @InjectRepository(Prop)
    private readonly propRepository: Repository<Prop>,
    private readonly dataSource: DataSource,
    private readonly aiProvider: OpenAICompatibleProvider,
    @InjectQueue("script-ai-parse")
    private readonly scriptAIParseQueue: Queue,
    @InjectQueue("script-ai-generate")
    private readonly scriptAIGenerateQueue: Queue,
    private readonly redlockService: RedlockService,
    private readonly ossService: OssService,
    private readonly characterService: CharacterService,
    private readonly sceneService: SceneService,
    private readonly propService: PropService,
    private readonly modelService: ModelService,
  ) {}

  // ==================== 权限检查 ====================

  /**
   * 检查用户是否有项目访问权限
   */
  async checkProjectAccess(
    userId: string,
    projectId: string,
    requireRole?: (typeof CollaboratorRole)[keyof typeof CollaboratorRole],
  ): Promise<string> {
    // 检查项目是否存在
    const project = await this.projectRepository.findOne({
      where: { projectId, isDeleted: false },
    });

    if (!project) {
      throw new NotFoundException("项目不存在");
    }

    // 获取用户在项目中的角色
    const collaborator = await this.collaboratorRepository.findOne({
      where: { projectId, userId },
    });

    const userRole = collaborator?.role || null;

    if (!userRole) {
      throw new ForbiddenException("您不是该项目成员");
    }

    if (
      requireRole === CollaboratorRole.OWNER &&
      userRole !== CollaboratorRole.OWNER
    ) {
      throw new ForbiddenException("需要所有者权限");
    }

    if (
      requireRole === CollaboratorRole.EDITOR &&
      userRole !== CollaboratorRole.OWNER &&
      userRole !== CollaboratorRole.EDITOR
    ) {
      throw new ForbiddenException("需要编辑权限");
    }

    return userRole;
  }

  /**
   * 检查剧本是否存在且可编辑
   */
  async checkScriptEditable(scriptId: string, userId: string): Promise<Script> {
    const script = await this.scriptRepository.findOne({
      where: { id: scriptId, deletedAt: IsNull() },
    });

    if (!script) {
      throw new NotFoundException("剧本不存在");
    }

    await this.checkProjectAccess(
      userId,
      script.projectId,
      CollaboratorRole.EDITOR,
    );

    if (script.status === ScriptStatus.CONFIRMED) {
      throw new ConflictException("剧本已确认，无法编辑");
    }

    if (script.status === ScriptStatus.AI_GENERATING) {
      throw new ConflictException("剧本正在生成中，请稍后再试");
    }

    return script;
  }

  // ==================== 剧本 CRUD ====================

  /**
   * 创建剧本（空白）
   * 从项目配置和用户配置继承初始模型配置
   */
  async createScript(
    userId: string,
    projectId: string,
    dto: CreateScriptDto,
  ): Promise<Script> {
    await this.checkProjectAccess(userId, projectId, CollaboratorRole.EDITOR);

    // 获取项目配置和用户配置用于初始化模型配置
    const [projectConfigs, user] = await Promise.all([
      this.projectModelConfigRepository.find({ where: { projectId } }),
      this.userRepository.findOne({ where: { id: userId } }),
    ]);

    // 构建项目配置映射
    const projectConfigMap = new Map<string, string>();
    for (const config of projectConfigs) {
      if (config.modelId) {
        projectConfigMap.set(config.category, config.modelId);
      }
    }

    // 获取用户默认配置
    const userDefaultModels =
      (user?.defaultModels as Record<string, string>) || {};

    // 步骤到 settings 字段的映射（用于存储模型配置）
    const stepToSettingsMap: Record<string, string> = {
      characters: "characterSettings",
      scenes: "sceneSettings",
      props: "propSettings",
    };

    // 步骤到模型类别的映射
    const stepToCategoryMap: Record<string, string> = {
      characters: "IMAGE_GENERATION",
      scenes: "IMAGE_GENERATION",
      props: "IMAGE_GENERATION",
    };

    // 初始化各步骤的模型配置（写入对应的 Settings 字段）
    const settingsInit: Record<string, unknown> = {};
    for (const [step, category] of Object.entries(stepToCategoryMap)) {
      // 优先级：项目配置 > 用户配置
      const modelId =
        projectConfigMap.get(category) ||
        userDefaultModels[category.toLowerCase()] ||
        "";
      const settingsKey = stepToSettingsMap[step];
      if (settingsKey) {
        settingsInit[settingsKey] = { modelId };
      }
    }

    const script = this.scriptRepository.create({
      projectId,
      title: dto.title,
      description: dto.description || null,
      status: ScriptStatus.EDITING,
      content: {
        ...(dto.content || {
          characters: [],
          scenes: [],
          props: [],
          storyboards: [],
          shotGroups: [],
        }),
        ...settingsInit,
      },
      metadata: {
        ...(dto.metadata || {}),
        source: dto.metadata?.source || "manual",
        totalScenes: 0,
        totalParagraphs: 0,
        wordCount: 0,
      } as Record<string, unknown>,
      createdBy: userId,
    });

    return this.scriptRepository.save(script);
  }

  /**
   * AI 生成剧本
   */
  async generateScriptWithAI(
    userId: string,
    projectId: string,
    dto: AIGenerateScriptDto,
  ): Promise<{ script: Script; task: AITask }> {
    await this.checkProjectAccess(userId, projectId, CollaboratorRole.EDITOR);

    // 创建空白剧本
    const script = await this.createScript(userId, projectId, {
      title: "AI生成中...",
      content: {
        characters: [],
        scenes: [],
        props: [],
        shotGroups: [],
        bgmTracks: [],
      },
      metadata: {
        genre: dto.genre,
        tone: dto.tone,
        targetDuration: dto.targetDuration,
        source: "ai" as const,
        totalScenes: 0,
        totalParagraphs: 0,
        wordCount: 0,
        aiGenerated: true,
      },
    });

    // 更新状态为生成中
    script.status = ScriptStatus.AI_GENERATING;
    await this.scriptRepository.save(script);

    // 创建 AI 任务
    const task = this.aiTaskRepository.create({
      scriptId: script.id,
      type: AITaskType.GENERATE,
      status: AITaskStatus.PENDING,
      config: dto,
      createdBy: userId,
    });

    const savedTask = await this.aiTaskRepository.save(task);

    // TODO: 触发 AI 生成任务（通过消息队列或 WebSocket）

    return { script, task: savedTask };
  }

  /**
   * 导入剧本
   */
  async importScript(
    userId: string,
    projectId: string,
    dto: ImportScriptDto,
  ): Promise<{ script: Script; task: AITask }> {
    await this.checkProjectAccess(userId, projectId, CollaboratorRole.EDITOR);

    // 检查内容长度
    if (dto.content.length > 5 * 1024 * 1024) {
      throw new BadRequestException("导入文件过大，最大支持 5MB");
    }

    if (!dto.content.trim()) {
      throw new BadRequestException("导入内容不能为空");
    }

    // 创建空白剧本
    const script = await this.createScript(userId, projectId, {
      title: "解析中...",
      content: {
        characters: [],
        scenes: [],
        props: [],
        shotGroups: [],
        bgmTracks: [],
      },
      metadata: {
        source: "import" as const,
        totalScenes: 0,
        totalParagraphs: 0,
        wordCount: 0,
        aiGenerated: false,
        importInfo: {
          filename: "imported.txt",
          format: "txt",
        },
      },
    });

    // 更新状态为生成中（使用 AI 解析）
    script.status = ScriptStatus.AI_GENERATING;
    await this.scriptRepository.save(script);

    // 创建 AI 解析任务
    const task = this.aiTaskRepository.create({
      scriptId: script.id,
      type: AITaskType.GENERATE,
      status: AITaskStatus.PENDING,
      config: {
        content: dto.content,
        isImport: true,
      },
      createdBy: userId,
    });

    const savedTask = await this.aiTaskRepository.save(task);

    return { script, task: savedTask };
  }

  /**
   * 查询剧本列表
   * 列表接口不返回 content 字段，减少数据传输量
   */
  async queryScripts(
    userId: string,
    projectId: string,
    dto: QueryScriptsDto,
  ): Promise<{
    list: Script[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    await this.checkProjectAccess(userId, projectId);

    const { page = 1, pageSize = 20, status, keyword } = dto;

    // 列表接口只查询基本字段，排除 content（编辑页面通过详情接口获取）
    const queryBuilder = this.scriptRepository
      .createQueryBuilder("script")
      .select([
        "script.id",
        "script.projectId",
        "script.title",
        "script.description",
        "script.status",
        "script.metadata",
        "script.version",
        "script.createdAt",
        "script.updatedAt",
        "script.createdBy",
        "script.confirmedAt",
        "script.deletedAt",
      ])
      .where("script.projectId = :projectId", { projectId })
      .andWhere("script.deletedAt IS NULL");

    if (status) {
      queryBuilder.andWhere("script.status = :status", { status });
    }

    if (keyword) {
      queryBuilder.andWhere(
        "(script.title ILIKE :keyword OR script.description ILIKE :keyword)",
        { keyword: `%${keyword}%` },
      );
    }

    const [list, total] = await queryBuilder
      .orderBy("script.updatedAt", "DESC")
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      list,
      total,
      page,
      pageSize,
    };
  }

  /**
   * 获取剧本详情
   */
  async getScript(
    userId: string,
    projectId: string,
    scriptId: string,
  ): Promise<Script> {
    await this.checkProjectAccess(userId, projectId);

    const script = await this.scriptRepository.findOne({
      where: { id: scriptId, projectId, deletedAt: IsNull() },
    });

    if (!script) {
      throw new NotFoundException("剧本不存在");
    }

    return script;
  }

  /**
   * 更新剧本
   * 使用分布式锁和乐观锁防止并发覆盖
   */
  async updateScript(
    userId: string,
    projectId: string,
    scriptId: string,
    dto: UpdateScriptDto,
  ): Promise<Script> {
    // 使用分布式锁保护剧本更新操作
    const lockKey = `script:update:${scriptId}`;

    return this.redlockService.withLock(lockKey, 10000, async () => {
      const script = await this.checkScriptEditable(scriptId, userId);

      // 确保剧本属于指定项目
      if (script.projectId !== projectId) {
        throw new NotFoundException("剧本不存在");
      }

      // 更新字段
      if (dto.title !== undefined) {
        script.title = dto.title;
      }
      if (dto.description !== undefined) {
        script.description = dto.description;
      }
      if (dto.content !== undefined) {
        // Zod 校验 content 字段类型
        const parseResult = ScriptContentSchema.safeParse(dto.content);
        if (!parseResult.success) {
          this.logger.warn(
            `Content 校验失败: ${parseResult.error.message}`,
          );
          throw new BadRequestException(
            `剧本内容格式错误: ${parseResult.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`,
          );
        }
        script.content = parseResult.data;
        // 更新字数统计（使用共享工具函数单次遍历计算）
        const { wordCount, totalScenes, totalParagraphs } =
          calculateScriptStats(
            dto.content as Parameters<typeof calculateScriptStats>[0],
          );
        script.metadata = {
          ...script.metadata,
          wordCount,
          totalScenes,
          totalParagraphs,
        };
      }
      if (dto.metadata !== undefined) {
        script.metadata = { ...script.metadata, ...dto.metadata };
      }

      try {
        return await this.scriptRepository.save(script);
      } catch (error) {
        // 处理乐观锁版本冲突
        if (error instanceof OptimisticLockVersionMismatchError) {
          throw new ConflictException("剧本已被其他操作修改，请刷新后重试");
        }
        throw error;
      }
    });
  }

  /**
   * 删除剧本（软删除）
   * 资源库资源保留，只清理剧本 content 图片副本
   */
  async deleteScript(
    userId: string,
    projectId: string,
    scriptId: string,
  ): Promise<void> {
    await this.checkProjectAccess(userId, projectId, CollaboratorRole.EDITOR);

    const script = await this.scriptRepository.findOne({
      where: { id: scriptId, projectId, deletedAt: IsNull() },
    });

    if (!script) {
      throw new NotFoundException("剧本不存在");
    }

    // 清理剧本 content 图片副本（资源库资源保留）
    const content = script.content as Record<string, unknown> | null;
    if (content) {
      await this._cleanupScriptContentImages(content);
    }

    // 按前缀批量清理该剧本的分镜素材（新路径：嵌套在项目下）
    const prefixes = [
      `image/projects/${projectId}/scripts/${scriptId}/`,
      `video/projects/${projectId}/scripts/${scriptId}/`,
      `audio/projects/${projectId}/scripts/${scriptId}/`,
      `mask/projects/${projectId}/scripts/${scriptId}/`,
    ];
    for (const prefix of prefixes) {
      try {
        const result = await this.ossService.deleteFilesByPrefix(prefix);
        if (result.deleted > 0) {
          this.logger.log(
            `剧本素材清理: ${prefix}, 删除 ${result.deleted} 个文件`,
          );
        }
      } catch (e) {
        this.logger.warn(
          `剧本素材清理失败: ${prefix}, ${(e as Error).message}`,
        );
      }
    }

    await this.scriptRepository.softRemove(script);
  }

  /**
   * 清理剧本 content 中的资源副本（图片、视频、音频）
   * 仅删除 OSS 文件，保留参考图（type=reference）
   */
  private async _cleanupScriptContentImages(
    content: Record<string, unknown>,
  ): Promise<void> {
    const assetKeys: Array<"characters" | "scenes" | "props"> = [
      "characters",
      "scenes",
      "props",
    ];

    for (const key of assetKeys) {
      const assets = (content[key] as Array<Record<string, unknown>>) || [];
      for (const asset of assets) {
        const images = (asset.images as Array<Record<string, unknown>>) || [];
        // 删除非参考图
        for (const img of images) {
          const imgType = (img as { type?: string }).type;
          const imgUrl = (img as { url?: string }).url;
          if (imgType !== "reference" && imgUrl) {
            try {
              await this._deleteOssImage(imgUrl);
            } catch (e) {
              this.logger.warn(
                `删除剧本图片失败: ${imgUrl}, ${(e as Error).message}`,
              );
            }
          }
        }
      }
    }

    // 处理分镜组（shotGroups）中的图片、视频、音频
    const shotGroups =
      (content.shotGroups as Array<Record<string, unknown>>) || [];
    for (const sg of shotGroups) {
      // 分镜组图片
      const images = (sg.images as Array<Record<string, unknown>>) || [];
      for (const img of images) {
        const imgUrl = (img as { url?: string }).url;
        if (imgUrl) {
          try {
            await this._deleteOssImage(imgUrl);
          } catch (e) {
            this.logger.warn(
              `删除分镜组图片失败: ${imgUrl}, ${(e as Error).message}`,
            );
          }
        }
      }

      // 分镜组视频
      const shots = (sg.shots as Array<Record<string, unknown>>) || [];
      for (const shot of shots) {
        const videoUrl = (shot as { videoUrl?: string }).videoUrl;
        if (videoUrl) {
          try {
            const key = this.extractOssKey(videoUrl);
            if (key) await this.ossService.deleteFile(key);
          } catch (e) {
            this.logger.warn(
              `删除分镜视频失败: ${videoUrl}, ${(e as Error).message}`,
            );
          }
        }
      }

      // 分镜组对话音频
      const dialogues = (sg.dialogues as Array<Record<string, unknown>>) || [];
      for (const dlg of dialogues) {
        const audioUrl = (dlg as { audioUrl?: string }).audioUrl;
        if (audioUrl) {
          try {
            const key = this.extractOssKey(audioUrl);
            if (key) await this.ossService.deleteFile(key);
          } catch (e) {
            this.logger.warn(
              `删除对话音频失败: ${audioUrl}, ${(e as Error).message}`,
            );
          }
        }
      }
    }

    // 兼容旧版 storyboards
    const storyboards =
      (content.storyboards as Array<Record<string, unknown>>) || [];
    for (const sb of storyboards) {
      const images = (sb.images as Array<Record<string, unknown>>) || [];
      for (const img of images) {
        const imgUrl = (img as { url?: string }).url;
        if (imgUrl) {
          try {
            await this._deleteOssImage(imgUrl);
          } catch (e) {
            this.logger.warn(
              `删除分镜图片失败: ${imgUrl}, ${(e as Error).message}`,
            );
          }
        }
      }
    }
  }

  /**
   * 删除 OSS 图片
   */
  private async _deleteOssImage(url: string): Promise<void> {
    if (!this.ossService.isConfigured()) {
      return;
    }
    let key: string;
    if (url.startsWith("/")) {
      key = url.slice(1);
    } else {
      const urlObj = new URL(url);
      key = urlObj.pathname.startsWith("/")
        ? urlObj.pathname.slice(1)
        : urlObj.pathname;
    }
    if (key) {
      await this.ossService.deleteFile(key);
    }
  }

  // ==================== AI 辅助编辑 ====================

  /**
   * 创建 AI 编辑任务
   */
  private async createAIEditTask(
    userId: string,
    scriptId: string,
    type: (typeof AITaskType)[keyof typeof AITaskType],
    config: Record<string, unknown>,
  ): Promise<AITask> {
    const task = this.aiTaskRepository.create({
      scriptId,
      type,
      status: AITaskStatus.PENDING,
      config,
      createdBy: userId,
    });

    return this.aiTaskRepository.save(task);
  }

  /**
   * AI 续写
   */
  async continueWithAI(
    userId: string,
    projectId: string,
    scriptId: string,
    dto: AIContinueDto,
  ): Promise<AITask> {
    const script = await this.checkScriptEditable(scriptId, userId);

    if (script.projectId !== projectId) {
      throw new NotFoundException("剧本不存在");
    }

    return this.createAIEditTask(userId, scriptId, AITaskType.CONTINUE, dto);
  }

  /**
   * AI 改写
   */
  async rewriteWithAI(
    userId: string,
    projectId: string,
    scriptId: string,
    dto: AIRewriteDto,
  ): Promise<AITask> {
    const script = await this.checkScriptEditable(scriptId, userId);

    if (script.projectId !== projectId) {
      throw new NotFoundException("剧本不存在");
    }

    return this.createAIEditTask(userId, scriptId, AITaskType.REWRITE, dto);
  }

  /**
   * AI 扩写
   */
  async expandWithAI(
    userId: string,
    projectId: string,
    scriptId: string,
    dto: AIExpandDto,
  ): Promise<AITask> {
    const script = await this.checkScriptEditable(scriptId, userId);

    if (script.projectId !== projectId) {
      throw new NotFoundException("剧本不存在");
    }

    return this.createAIEditTask(userId, scriptId, AITaskType.EXPAND, dto);
  }

  /**
   * AI 缩写
   */
  async condenseWithAI(
    userId: string,
    projectId: string,
    scriptId: string,
    dto: AICondenseDto,
  ): Promise<AITask> {
    const script = await this.checkScriptEditable(scriptId, userId);

    if (script.projectId !== projectId) {
      throw new NotFoundException("剧本不存在");
    }

    return this.createAIEditTask(userId, scriptId, AITaskType.CONDENSE, dto);
  }

  /**
   * 获取 AI 任务状态
   */
  async getAITask(
    userId: string,
    projectId: string,
    scriptId: string,
    taskId: string,
  ): Promise<AITask> {
    await this.checkProjectAccess(userId, projectId);

    const task = await this.aiTaskRepository.findOne({
      where: { id: taskId, scriptId },
    });

    if (!task) {
      throw new NotFoundException("AI 任务不存在");
    }

    return task;
  }

  /**
   * 取消 AI 任务
   */
  async cancelAITask(
    userId: string,
    projectId: string,
    scriptId: string,
    taskId: string,
  ): Promise<AITask> {
    await this.checkProjectAccess(userId, projectId, CollaboratorRole.EDITOR);

    const task = await this.aiTaskRepository.findOne({
      where: { id: taskId, scriptId },
    });

    if (!task) {
      throw new NotFoundException("AI 任务不存在");
    }

    if (
      task.status !== AITaskStatus.PENDING &&
      task.status !== AITaskStatus.PROCESSING
    ) {
      throw new ConflictException("任务已结束，无法取消");
    }

    task.status = AITaskStatus.CANCELLED;
    return this.aiTaskRepository.save(task);
  }

  // ==================== 跨项目资产导入 ====================

  /**
   * 查询可导入的资产列表
   */
  async queryImportableAssets(
    userId: string,
    projectId: string,
    dto: QueryImportableAssetsDto,
  ): Promise<{ list: unknown[]; total: number }> {
    // 检查源项目访问权限
    await this.checkProjectAccess(userId, dto.sourceProjectId);

    // TODO: 查询源项目的资产列表
    // 这里需要依赖 asset 模块，暂时返回空列表
    return { list: [], total: 0 };
  }

  /**
   * 从其他项目导入资产
   */
  async importAssetFromProject(
    userId: string,
    projectId: string,
    scriptId: string,
    dto: ImportAssetFromProjectDto,
  ): Promise<AssetCrossProjectRef> {
    const script = await this.checkScriptEditable(scriptId, userId);

    if (script.projectId !== projectId) {
      throw new NotFoundException("剧本不存在");
    }

    // 检查源项目访问权限
    await this.checkProjectAccess(userId, dto.sourceProjectId);

    // TODO: 复制资产到当前项目
    // 这里需要依赖 asset 模块来实际复制资产

    // 创建跨项目引用记录
    const ref = this.crossProjectRefRepository.create({
      sourceProjectId: dto.sourceProjectId,
      sourceAssetId: dto.sourceAssetId,
      sourceAssetType: dto.assetType as AssetTypeType,
      targetProjectId: projectId,
      targetAssetId: "temp_" + Date.now(), // 临时ID，实际需要 asset 模块返回
      targetAssetType: dto.assetType as AssetTypeType,
      scriptId,
      copiedBy: userId,
    });

    return this.crossProjectRefRepository.save(ref);
  }

  // ==================== 剧本确认 ====================

  /**
   * 获取确认预览
   */
  async getConfirmPreview(
    userId: string,
    projectId: string,
    scriptId: string,
  ): Promise<Record<string, unknown>> {
    const script = await this.getScript(userId, projectId, scriptId);

    if (script.status === ScriptStatus.CONFIRMED) {
      throw new ConflictException("剧本已确认");
    }

    const content = script.content as Record<string, unknown>;
    const characters =
      (content.characters as Array<Record<string, unknown>>) || [];
    const scenes = (content.scenes as Array<Record<string, unknown>>) || [];
    const props = (content.props as Array<Record<string, unknown>>) || [];

    // 统计资产状态
    const characterStats = this.calculateAssetStats(characters);
    const sceneStats = this.calculateAssetStats(scenes);
    const propStats = this.calculateAssetStats(props);

    // Phase 4：从素材库获取 name 和 description
    const charAssetIds = characters
      .map((c) => c.characterId as string)
      .filter(Boolean);
    const sceneAssetIds = scenes
      .map((s) => s.sceneId as string)
      .filter(Boolean);
    const propAssetIds = props
      .map((p) => p.propId as string)
      .filter(Boolean);

    const charLibrary = charAssetIds.length > 0
      ? await this.characterRepository.find({
          where: { id: In(charAssetIds), projectId },
        })
      : [];
    const charLibraryMap = new Map(charLibrary.map((c) => [c.id, c]));

    const sceneLibrary = sceneAssetIds.length > 0
      ? await this.sceneRepository.find({
          where: { id: In(sceneAssetIds), projectId },
        })
      : [];
    const sceneLibraryMap = new Map(sceneLibrary.map((s) => [s.id, s]));

    const propLibrary = propAssetIds.length > 0
      ? await this.propRepository.find({
          where: { id: In(propAssetIds), projectId },
        })
      : [];
    const propLibraryMap = new Map(propLibrary.map((p) => [p.id, p]));

    return {
      characters: characters.map((c) => {
        const assetId = c.characterId as string;
        const libData = assetId ? charLibraryMap.get(assetId) : null;
        return {
          id: c.id,
          name: libData?.name || "",
          description: libData?.description || "",
          assetStatus: c.assetStatus || "none",
          importedFrom: c.importedAsset
            ? (c.importedAsset as Record<string, string>).sourceProjectId
            : undefined,
        };
      }),
      scenes: scenes.map((s) => {
        const assetId = s.sceneId as string;
        const libData = assetId ? sceneLibraryMap.get(assetId) : null;
        return {
          id: s.id,
          name: libData?.name || "",
          description: libData?.description || "",
          assetStatus: s.assetStatus || "none",
        };
      }),
      props: props.map((p) => {
        const assetId = p.propId as string;
        const libData = assetId ? propLibraryMap.get(assetId) : null;
        return {
          id: p.id,
          name: libData?.name || "",
          description: libData?.description || "",
          assetStatus: p.assetStatus || "none",
        };
      }),
      summary: {
        totalCharacters: characters.length,
        importedCharacters: characterStats.imported,
        willCreateCharacters: characterStats.willCreate,
        unprocessedCharacters: characterStats.unprocessed,
        totalScenes: scenes.length,
        importedScenes: sceneStats.imported,
        willCreateScenes: sceneStats.willCreate,
        unprocessedScenes: sceneStats.unprocessed,
        totalProps: props.length,
        importedProps: propStats.imported,
        willCreateProps: propStats.willCreate,
        unprocessedProps: propStats.unprocessed,
      },
    };
  }

  /**
   * 计算资产统计
   */
  private calculateAssetStats(assets: Array<Record<string, unknown>>): {
    imported: number;
    willCreate: number;
    unprocessed: number;
  } {
    return {
      imported: assets.filter((a) => a.assetStatus === "imported").length,
      willCreate: assets.filter((a) => a.assetStatus === "will_create").length,
      unprocessed: assets.filter(
        (a) => !a.assetStatus || a.assetStatus === "none",
      ).length,
    };
  }

  /**
   * 获取项目剧本（用于分镜生成）
   */
  async getProjectScript(projectId: string): Promise<Script | null> {
    return this.scriptRepository.findOne({
      where: { projectId, deletedAt: IsNull() },
      order: { createdAt: "DESC" },
    });
  }

  /**
   * 确认剧本
   */
  async confirmScript(
    userId: string,
    projectId: string,
    scriptId: string,
    _dto: ConfirmScriptDto,
  ): Promise<Script> {
    const script = await this.checkScriptEditable(scriptId, userId);

    if (script.projectId !== projectId) {
      throw new NotFoundException("剧本不存在");
    }

    // 检查是否有未处理的资产
    const preview = await this.getConfirmPreview(userId, projectId, scriptId);
    const summary = preview.summary as Record<string, number>;

    if (
      summary.unprocessedCharacters > 0 ||
      summary.unprocessedScenes > 0 ||
      summary.unprocessedProps > 0
    ) {
      throw new ConflictException("存在未处理的资产，请先处理");
    }

    // 更新剧本状态
    script.status = ScriptStatus.CONFIRMED;
    script.confirmedAt = new Date();
    script.metadata = {
      ...script.metadata,
      assetSummary: {
        characters: {
          total: summary.totalCharacters,
          imported: summary.importedCharacters,
          willCreate: summary.willCreateCharacters,
        },
        scenes: {
          total: summary.totalScenes,
          imported: summary.importedScenes,
          willCreate: summary.willCreateScenes,
        },
        props: {
          total: summary.totalProps,
          imported: summary.importedProps,
          willCreate: summary.willCreateProps,
        },
      },
    };

    // TODO: 触发下游模块（分镜、角色、场景、道具）的处理

    return this.scriptRepository.save(script);
  }

  // ==================== 剧本编辑页面重构 - 新API ====================

  /**
   * 获取剧本编辑详情
   * 返回完整的剧本编辑数据，包含所有步骤的状态和内容
   * 从资源库获取角色/场景/道具完整信息并合并剧本引用数据
   */
  async getScriptEditDetail(
    userId: string,
    projectId: string,
    scriptId: string,
  ): Promise<Record<string, unknown>> {
    await this.checkProjectAccess(userId, projectId);

    const script = await this.scriptRepository.findOne({
      where: { id: scriptId, projectId, deletedAt: IsNull() },
    });

    if (!script) {
      throw new NotFoundException("剧本不存在");
    }

    const content = script.content as Record<string, unknown>;
    const metadata = script.metadata as Record<string, unknown>;

    // 获取角色、场景、道具引用列表（包含 characterId/sceneId/propId）
    const characterRefs =
      (content?.characters as Array<Record<string, unknown>>) || [];
    const sceneRefs = (content?.scenes as Array<Record<string, unknown>>) || [];
    const propRefs = (content?.props as Array<Record<string, unknown>>) || [];
    const storyboards =
      (content?.storyboards as Array<Record<string, unknown>>) || [];
    // 新版分镜组（包含 characterRegions 框选配置）
    const shotGroups =
      (content?.shotGroups as Array<Record<string, unknown>>) || [];

    // 收集资源库 ID
    const characterIds = characterRefs
      .map((c) => c.characterId as string)
      .filter(Boolean);
    const sceneIds = sceneRefs.map((s) => s.sceneId as string).filter(Boolean);
    const propIds = propRefs.map((p) => p.propId as string).filter(Boolean);

    // 批量查询资源库获取完整信息
    const [characterMap, sceneMap, propMap] = await Promise.all([
      this.characterService.findByIds(characterIds),
      this.sceneService.findByIds(sceneIds),
      this.propService.findByIds(propIds),
    ]);

    // 合并引用信息和资源库完整信息
    const characters = characterRefs.map((ref) => {
      const characterId = ref.characterId as string;
      const libraryData = characterId ? characterMap.get(characterId) : null;
      return {
        // 引用信息
        id: ref.id,
        characterId: ref.characterId,
        importance: ref.importance,
        mainImageId: ref.mainImageId,
        // 资源库完整信息
        ...(libraryData
          ? {
              name: libraryData.name,
              description: libraryData.description,
              personality: libraryData.personality,
              age: libraryData.age,
              gender: libraryData.gender,
              occupation: libraryData.occupation,
              background: libraryData.background,
              appearance: libraryData.appearance,
              images: libraryData.images || [],
            }
          : {
              // 如果资源库没有数据，使用引用中的基本信息（兼容旧数据）
              name: ref.name,
              description: ref.description,
              personality: ref.personality,
              age: ref.age,
              gender: ref.gender,
              images: (ref.images as Array<Record<string, unknown>>) || [],
            }),
      };
    });

    const scenes = sceneRefs.map((ref) => {
      const sceneId = ref.sceneId as string;
      const libraryData = sceneId ? sceneMap.get(sceneId) : null;
      return {
        id: ref.id,
        sceneId: ref.sceneId,
        dialogues: ref.dialogues,
        mainImageId: ref.mainImageId,
        ...(libraryData
          ? {
              name: libraryData.name,
              description: libraryData.description,
              type: libraryData.type,
              space: libraryData.space,
              visuals: libraryData.visuals,
              atmosphere: libraryData.atmosphere,
              images: libraryData.images || [],
            }
          : {
              name: ref.name,
              description: ref.description,
              images: (ref.images as Array<Record<string, unknown>>) || [],
            }),
      };
    });

    const props = propRefs.map((ref) => {
      const propId = ref.propId as string;
      const libraryData = propId ? propMap.get(propId) : null;
      return {
        id: ref.id,
        propId: ref.propId,
        mainImageId: ref.mainImageId,
        ...(libraryData
          ? {
              name: libraryData.name,
              description: libraryData.description,
              appearance: libraryData.appearance,
              function: libraryData.function,
              importance: libraryData.importance,
              images: libraryData.images || [],
            }
          : {
              name: ref.name,
              description: ref.description,
              images: (ref.images as Array<Record<string, unknown>>) || [],
            }),
      };
    });

    // 从 {character/scene/prop}Settings 读取模型配置
    const characterSettings =
      (content?.characterSettings as Record<string, unknown>) || {};
    const sceneSettings =
      (content?.sceneSettings as Record<string, unknown>) || {};
    const propSettings =
      (content?.propSettings as Record<string, unknown>) || {};

    // 步骤状态默认为 pending，前端通过 WebSocket 实时获取状态
    // modelId 从 settings 字段读取

    return {
      id: script.id,
      title: script.title,
      description: script.description,
      status: script.status,
      createdAt: script.createdAt.toISOString(),
      updatedAt: script.updatedAt.toISOString(),

      steps: {
        settings: {
          aspectRatio: (metadata?.aspectRatio as string) || "16:9",
          genre: (metadata?.genre as string) || "",
          tone: (metadata?.tone as string) || "",
        },

        script: {
          status: "pending",
          content: script.description || "",
          modelId: "",
          currentTaskId: undefined,
          lastGeneratedAt: undefined,
        },

        characters: {
          status: "pending",
          items: characters.map((c) => this.enrichAssetWithImages(c)),
          modelId: (characterSettings.modelId as string) || "",
          currentTaskId: undefined,
          totalCount: characters.length,
          // 已关联资源库的角色数量
          completedCount: characters.filter((c) => c.characterId).length,
        },

        scenes: {
          status: "pending",
          items: scenes.map((s) => this.enrichAssetWithImages(s)),
          modelId: (sceneSettings.modelId as string) || "",
          currentTaskId: undefined,
          totalCount: scenes.length,
          // 已关联资源库的场景数量
          completedCount: scenes.filter((s) => s.sceneId).length,
        },

        props: {
          status: "pending",
          items: props.map((p) => this.enrichAssetWithImages(p)),
          modelId: (propSettings.modelId as string) || "",
          currentTaskId: undefined,
          totalCount: props.length,
          // 已关联资源库的道具数量
          completedCount: props.filter((p) => p.propId).length,
        },

        storyboards: {
          status: "pending",
          // 优先返回 shotGroups（新版分镜组，包含 characterRegions），兼容旧版 storyboards
          items: shotGroups.length > 0 ? shotGroups : storyboards,
          modelId: "",
          currentTaskId: (metadata?.storyboardParseTaskId as string) || undefined,
          totalCount: shotGroups.length > 0 ? shotGroups.length : storyboards.length,
          // 分镜解析状态持久化（从 metadata 读取）
          storyboardParseStatus: (metadata?.storyboardParseStatus as string) || "pending",
          storyboardParseError: (metadata?.storyboardParseError as string) || undefined,
        },

        audio: {
          status: "pending",
          bgm: content?.bgm as Record<string, unknown> | undefined,
          soundEffects:
            (content?.soundEffects as Array<Record<string, unknown>>) || [],
          modelId: "",
          currentTaskId: undefined,
        },

        export: {
          status: "pending",
          availableFormats: ["mp4", "mov", "webm"],
        },
      },

      modelConfigs: [],
    };
  }

  /**
   * 为资产添加图片字段（如果不存在）
   */
  private enrichAssetWithImages(
    asset: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      ...asset,
      images: (asset.images as Array<Record<string, unknown>>) || [],
      mainImageId: asset.mainImageId as string | undefined,
      assetId: asset.assetId as string | undefined,
    };
  }

  /**
   * 更新剧本描述
   * 使用分布式锁防止并发更新
   * 注意：更新描述是轻量操作，不检查 AI 生成状态，允许在生成中更新
   */
  async updateScriptDescription(
    userId: string,
    projectId: string,
    scriptId: string,
    dto: { content: string; autoSave?: boolean },
  ): Promise<Record<string, unknown>> {
    const lockKey = `script:update:${scriptId}`;

    return this.redlockService.withLock(lockKey, 10000, async () => {
      // 检查项目访问权限（仅需要编辑权限）
      await this.checkProjectAccess(userId, projectId, CollaboratorRole.EDITOR);

      // 获取剧本
      const script = await this.scriptRepository.findOne({
        where: { id: scriptId, projectId, deletedAt: IsNull() },
      });

      if (!script) {
        throw new NotFoundException("剧本不存在");
      }

      // 验证内容长度
      if (dto.content.length < 10 || dto.content.length > 5000) {
        throw new BadRequestException("剧本描述长度必须在10-5000字符之间");
      }

      // 更新描述
      script.description = dto.content;

      try {
        await this.scriptRepository.save(script);
      } catch (error) {
        if (error instanceof OptimisticLockVersionMismatchError) {
          throw new ConflictException("剧本已被其他操作修改，请刷新后重试");
        }
        throw error;
      }

      return {
        id: script.id,
        content: script.description,
        updatedAt: script.updatedAt.toISOString(),
        hasUnsavedChanges: !dto.autoSave,
      };
    });
  }

  /**
   * 重新生成剧本
   * 基于当前描述创建AI生成任务
   */
  async regenerateScript(
    userId: string,
    projectId: string,
    scriptId: string,
    dto: {
      modelId?: string;
      description?: string;
      preserveExisting?: boolean;
      options?: Record<string, unknown>;
    },
  ): Promise<Record<string, unknown>> {
    // 获取剧本
    const script = await this.scriptRepository.findOne({
      where: { id: scriptId, deletedAt: IsNull() },
    });

    if (!script) {
      throw new NotFoundException("剧本不存在");
    }

    // 检查项目权限
    await this.checkProjectAccess(userId, script.projectId, "editor");

    if (script.projectId !== projectId) {
      throw new NotFoundException("剧本不存在");
    }

    // 检查剧本是否已确认
    if (script.status === ScriptStatus.CONFIRMED) {
      throw new ConflictException("剧本已确认，无法编辑");
    }

    // 检查是否有进行中的生成任务
    const existingTask = await this.aiTaskRepository.findOne({
      where: {
        scriptId,
        type: AITaskType.GENERATE,
        status: AITaskStatus.PROCESSING,
      },
    });

    if (existingTask) {
      throw new ConflictException("已有进行中的生成任务");
    }

    // 更新剧本状态
    script.status = ScriptStatus.AI_GENERATING;

    await this.scriptRepository.save(script);

    // 获取剧本描述：优先使用 DTO 传入的 description，其次使用剧本已有描述，最后从 content.storyboards 构建
    let scriptDescription = dto.description?.trim() || script.description;
    if (!scriptDescription?.trim()) {
      // 从 content.storyboards 构建描述文本
      const content = script.content as {
        storyboards?: Array<{
          description?: string;
          dialogues?: Array<{
            characterName?: string;
            text?: string;
          }>;
        }>;
      };
      if (content?.storyboards && content.storyboards.length > 0) {
        const lines: string[] = [];
        for (const storyboard of content.storyboards) {
          if (storyboard.description) {
            lines.push(`[场景] ${storyboard.description}`);
          }
          for (const dialogue of storyboard.dialogues || []) {
            if (dialogue.characterName && dialogue.text) {
              lines.push(`${dialogue.characterName}：${dialogue.text}`);
            }
          }
        }
        scriptDescription = lines.join("\n\n");
      }
    }

    if (!scriptDescription?.trim()) {
      throw new BadRequestException("剧本内容为空，无法重新生成");
    }

    // 创建AI任务
    const task = this.aiTaskRepository.create({
      scriptId: script.id,
      type: AITaskType.GENERATE,
      status: AITaskStatus.PENDING,
      config: {
        description: scriptDescription,
        preserveExisting: dto.preserveExisting ?? true,
        options: dto.options,
        modelId: dto.modelId,
        isRegenerate: true,
      },
      createdBy: userId,
    });

    const savedTask = await this.aiTaskRepository.save(task);

    // 将任务添加到剧本AI生成队列
    await this.scriptAIGenerateQueue.add(
      savedTask.id,
      {
        taskId: savedTask.id,
        type: "generate",
        requestData: {
          idea: scriptDescription,
          preserveExisting: dto.preserveExisting ?? true,
          options: dto.options,
          isRegenerate: true,
        },
        modelId: dto.modelId || null,
      },
      {
        jobId: savedTask.id,
        priority: 40,
      },
    );

    // 保存任务 ID 到剧本（可选：前端可通过 AITask 表查询）
    await this.scriptRepository.save(script);

    return {
      taskId: savedTask.id,
      status: "pending",
      estimatedTime: 60,
    };
  }

  /**
   * 获取任务状态（扩展版）
   */
  async getTaskStatus(
    userId: string,
    projectId: string,
    scriptId: string,
    taskId: string,
  ): Promise<Record<string, unknown>> {
    await this.checkProjectAccess(userId, projectId);

    const task = await this.aiTaskRepository.findOne({
      where: { id: taskId, scriptId },
    });

    if (!task) {
      throw new NotFoundException("任务不存在");
    }

    // 映射任务类型
    const typeMap: Record<string, string> = {
      generate: "script_generate",
      parse: "script_generate",
      continue: "script_generate",
      rewrite: "script_generate",
      expand: "script_generate",
      condense: "script_generate",
    };

    return {
      taskId: task.id,
      type: typeMap[task.type] || task.type,
      status: task.status,
      progress: task.progress || 0,
      result: task.result,
      error: task.error
        ? {
            code: "GENERATION_FAILED",
            message: task.error,
            recoverable: true,
          }
        : undefined,
      createdAt: task.createdAt.toISOString(),
      startedAt: task.startedAt?.toISOString(),
      completedAt: task.completedAt?.toISOString(),
    };
  }

  /**
   * 取消任务
   */
  async cancelTask(
    userId: string,
    projectId: string,
    scriptId: string,
    taskId: string,
  ): Promise<Record<string, unknown>> {
    await this.checkProjectAccess(userId, projectId, CollaboratorRole.EDITOR);

    const task = await this.aiTaskRepository.findOne({
      where: { id: taskId, scriptId },
    });

    if (!task) {
      throw new NotFoundException("任务不存在");
    }

    if (
      task.status !== AITaskStatus.PENDING &&
      task.status !== AITaskStatus.PROCESSING
    ) {
      throw new ConflictException("任务已结束，无法取消");
    }

    task.status = AITaskStatus.CANCELLED;
    await this.aiTaskRepository.save(task);

    // 任务取消后，前端通过 WebSocket 获取最新状态

    return {
      taskId: task.id,
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
    };
  }

  // ==================== 剧本模型配置 ====================

  /**
   * 获取剧本模型配置
   * 级联链（优先级 低→高）：
   *   管理后台模型配置 → 用户默认配置 → 项目配置 → 剧本配置
   * 对于分镜步骤（storyboards），额外支持 shotGroupSettings 中的独立配置：
   *   管理后台 → 用户 → 项目 → shotGroupSettings.defaultXxxModelId
   */
  async getScriptModelConfigs(
    userId: string,
    projectId: string,
    scriptId: string,
  ): Promise<Record<string, unknown>> {
    await this.checkProjectAccess(userId, projectId);

    const script = await this.scriptRepository.findOne({
      where: { id: scriptId, projectId, deletedAt: IsNull() },
    });

    if (!script) {
      throw new NotFoundException("剧本不存在");
    }

    // 并行获取项目配置和用户配置
    const content = script.content as Record<string, unknown>;
    const [projectConfigs, user] = await Promise.all([
      this.projectModelConfigRepository.find({ where: { projectId } }),
      this.userRepository.findOne({ where: { id: userId } }),
    ]);

    // 从 content 中读取各步骤的 settings
    const characterSettings =
      (content?.characterSettings as Record<string, unknown>) || {};
    const sceneSettings =
      (content?.sceneSettings as Record<string, unknown>) || {};
    const propSettings =
      (content?.propSettings as Record<string, unknown>) || {};
    const bgmSettings =
      (content?.bgmSettings as Record<string, unknown>) || {};

    // 步骤到 settings 字段的映射
    const stepToSettingsMap: Record<string, Record<string, unknown>> = {
      script: (content?.scriptSettings as Record<string, unknown>) || {},
      characters: characterSettings,
      scenes: sceneSettings,
      props: propSettings,
      bgm: bgmSettings,
    };

    // 构建项目配置映射（category -> modelId）
    const projectConfigMap = new Map<string, string>();
    for (const config of projectConfigs) {
      if (config.modelId) {
        projectConfigMap.set(config.category, config.modelId);
      }
    }

    // 获取用户默认配置（大写 key，如 TEXT_GENERATION）
    const userDefaultModels =
      (user?.defaultModels as Record<string, string | null>) || {};

    // 步骤到模型类别的映射
    const stepToCategoryMap: Record<string, string> = {
      script: "TEXT_GENERATION",
      characters: "IMAGE_GENERATION",
      scenes: "IMAGE_GENERATION",
      props: "IMAGE_GENERATION",
      storyboards: "IMAGE_GENERATION",
      bgm: "AUDIO_GENERATION",
    };

    // 分镜步骤：shotGroupSettings 中的独立模型配置
    const shotGroupSettings =
      (content?.shotGroupSettings as Record<string, string | undefined>) || {};

    // 解析完整级联链（项目 → 用户 → 系统）
    const resolveModelId = (category: string): string => {
      // 1. 项目配置
      const projectModelId = projectConfigMap.get(category);
      if (projectModelId) return projectModelId;

      // 2. 用户默认配置（大写 key）
      const userModelId = userDefaultModels[category];
      if (userModelId) return userModelId;

      // 3. 系统默认（管理后台 isDefault 模型）
      return ""; // 系统默认由前端从 available models 中找 isDefault 的补充
    };

    // 提取各步骤的模型配置（带完整级联）
    const steps = [
      "script",
      "characters",
      "scenes",
      "props",
      "storyboards",
      "audio",
    ];
    const configs = steps.map((step) => {
      const category = stepToCategoryMap[step];

      // 分镜步骤：shotGroupSettings 优先级高于剧本 settings
      if (step === "storyboards") {
        const shotGroupImageModelId = shotGroupSettings.defaultImageModelId;
        const shotGroupVideoModelId = shotGroupSettings.defaultVideoModelId;
        const shotGroupLipSyncModelId = shotGroupSettings.defaultLipSyncModelId;

        return {
          step,
          modelId: "", // 分镜步骤使用多模型，不由此接口返回单一 modelId
          defaultImageModelId:
            shotGroupImageModelId || resolveModelId(category),
          defaultVideoModelId:
            shotGroupVideoModelId || resolveModelId("VIDEO_GENERATION"),
          defaultLipSyncModelId:
            shotGroupLipSyncModelId || resolveModelId("LIP_SYNC"),
        };
      }

      // 其他步骤：从对应的 settings 字段读取 modelId
      const settings = stepToSettingsMap[step];
      const scriptModelId = settings?.modelId as string | undefined;

      let modelId = "";
      if (scriptModelId) {
        // 1. 使用剧本自身配置
        modelId = scriptModelId;
      } else if (category) {
        // 2-4. 项目 → 用户 → 系统
        modelId = resolveModelId(category);
      }

      return {
        step,
        modelId,
      };
    });

    return {
      configs,
    };
  }

  /**
   * 更新剧本模型配置
   * 使用分布式锁防止并发更新
   */
  async updateScriptModelConfigs(
    userId: string,
    projectId: string,
    scriptId: string,
    dto: { configs: Record<string, string> },
  ): Promise<Record<string, unknown>> {
    const lockKey = `script:update:${scriptId}`;

    return this.redlockService.withLock(lockKey, 10000, async () => {
      const script = await this.checkScriptEditable(scriptId, userId);

      if (script.projectId !== projectId) {
        throw new NotFoundException("剧本不存在");
      }

      // 从 content 获取各步骤的 settings（创建新对象以触发 TypeORM 变更检测）
      const content = {
        ...(script.content as Record<string, unknown>),
      };

      // 步骤到 settings 字段的映射
      const stepToSettings: Record<string, string> = {
        script: "scriptSettings",
        characters: "characterSettings",
        scenes: "sceneSettings",
        props: "propSettings",
        bgm: "bgmSettings",
      };

      // 更新各步骤的模型配置（写入对应的 Settings 字段）
      for (const [step, modelId] of Object.entries(dto.configs)) {
        const settingsKey = stepToSettings[step];
        if (settingsKey) {
          const existingSettings =
            (content[settingsKey] as Record<string, unknown>) || {};
          content[settingsKey] = {
            ...existingSettings,
            modelId,
          };
        }
      }

      // 赋值新对象以触发 TypeORM 变更检测
      script.content = content;

      try {
        await this.scriptRepository.save(script);
      } catch (error) {
        if (error instanceof OptimisticLockVersionMismatchError) {
          throw new ConflictException("剧本已被其他操作修改，请刷新后重试");
        }
        throw error;
      }

      // 返回更新后的配置（从 settings 字段读取）
      const configs = Object.keys(stepToSettings).map((step) => {
        const settingsKey = stepToSettings[step];
        const settings =
          (content[settingsKey] as Record<string, unknown>) || {};
        return {
          step,
          modelId: (settings.modelId as string) || "",
        };
      });

      return {
        configs,
        updatedAt: new Date().toISOString(),
      };
    });
  }

  // ==================== 剧本资源解析 ====================

  /**
   * 解析剧本资源（角色/场景/道具）
   * 创建异步任务，通过队列处理，支持 WebSocket 实时推送进度
   * @param force 是否强制重新解析（会清理已有素材）
   */
  async parseScriptResources(
    userId: string,
    projectId: string,
    scriptId: string,
    force: boolean = false,
  ): Promise<{
    taskId: string;
    status: string;
    message: string;
  }> {
    // 1. 检查权限
    await this.checkProjectAccess(userId, projectId, CollaboratorRole.EDITOR);

    // 2. 获取剧本
    const script = await this.scriptRepository.findOne({
      where: { id: scriptId, projectId, deletedAt: IsNull() },
    });

    if (!script) {
      throw new NotFoundException("剧本不存在");
    }

    // 3. 检查是否已有正在进行的解析任务
    const content = script.content as Record<string, unknown> | undefined;
    const metadata = script.metadata as Record<string, unknown> | undefined;
    const existingParseTaskId = metadata?.parseTaskId as string | undefined;

    if (existingParseTaskId) {
      const existingTask = await this.aiTaskRepository.findOne({
        where: { id: existingParseTaskId },
      });
      if (
        existingTask &&
        (existingTask.status === AITaskStatus.PENDING ||
          existingTask.status === AITaskStatus.PROCESSING)
      ) {
        this.logger.log(
          `剧本 ${scriptId} 已有进行中的解析任务: ${existingParseTaskId}`,
        );
        return {
          taskId: existingParseTaskId,
          status: existingTask.status,
          message: "解析任务已在进行中",
        };
      }
    }

    // 4. 检查是否已有资源数据
    if (content) {
      const existingCharacters = (content.characters as unknown[]) || [];
      const existingScenes = (content.scenes as unknown[]) || [];
      const existingProps = (content.props as unknown[]) || [];

      const hasExistingResources =
        existingCharacters.length > 0 ||
        existingScenes.length > 0 ||
        existingProps.length > 0;

      if (hasExistingResources && !force) {
        // 有资源但未强制重新解析，直接返回
        this.logger.log(`剧本 ${scriptId} 已有资源数据，直接返回`);
        return {
          taskId: "",
          status: "completed",
          message: "资源已解析完成",
        };
      }

      // 强制重新解析时，清理已有素材
      if (hasExistingResources && force) {
        this.logger.log(`剧本 ${scriptId} 强制重新解析，清理已有素材...`);
        await this.cleanupScriptAssets(script);
      }
    }

    // 5. 构建剧本文本用于 AI 解析（支持 V2 description 或旧版 content.acts）
    let scriptText = "";

    // 优先使用 description（V2 流程）
    if (script.description?.trim()) {
      scriptText = script.description.trim();
      this.logger.log(`使用 description 字段解析剧本资源: ${scriptId}`);
    }
    // 注意：已移除 content.acts 遍历逻辑

    if (!scriptText) {
      throw new BadRequestException("剧本内容为空，无法解析资源");
    }

    // 6. 获取文本模型（优先级：剧本配置 > 项目配置 > 用户配置）
    let textModelId: string | undefined;

    // 6.1 优先从剧本配置获取（scriptSettings.modelId）
    const scriptSettings = (
      script.content as Record<string, unknown> | undefined
    )?.scriptSettings as Record<string, unknown> | undefined;
    if (scriptSettings?.modelId) {
      textModelId = scriptSettings.modelId as string;
      this.logger.log(
        `剧本 ${scriptId} 使用剧本配置的文本模型: ${textModelId}`,
      );
    }

    // 6.1b 从 metadata.aiModel 获取（AI 生成剧本时存储）
    if (!textModelId) {
      const metadata = script.metadata as Record<string, unknown> | undefined;
      if (metadata?.aiModel && typeof metadata.aiModel === "string") {
        textModelId = metadata.aiModel;
        this.logger.log(
          `剧本 ${scriptId} 使用 metadata.aiModel 文本模型: ${textModelId}`,
        );
      }
    }

    // 6.2 如果剧本没有配置，从项目配置获取
    if (!textModelId) {
      const projectModelConfig = await this.projectModelConfigRepository.findOne(
        {
          where: { projectId, category: "TEXT_GENERATION" as any },
        },
      );
      if (projectModelConfig?.modelId) {
        textModelId = projectModelConfig.modelId;
        this.logger.log(
          `剧本 ${scriptId} 使用项目默认文本模型: ${textModelId}`,
        );
      }
    }

    // 6.3 如果项目没有配置，从用户默认配置获取
    if (!textModelId) {
      const user = await this.userRepository.findOne({
        where: { id: userId },
      });
      const userDefaultModels =
        (user?.defaultModels as Record<string, string>) || {};
      textModelId = userDefaultModels["text_generation"]; // 用户配置使用小写类别名
      if (textModelId) {
        this.logger.log(
          `剧本 ${scriptId} 使用用户默认文本模型: ${textModelId}`,
        );
      }
    }

    // 验证文本模型配置
    if (!textModelId) {
      throw new BadRequestException(
        "剧本未配置文本模型，请在剧本步骤设置模型后再解析",
      );
    }

    // 7. 创建 AI 解析任务（使用 GENERATE 类型避免数据库约束问题）
    const task = this.aiTaskRepository.create({
      scriptId: script.id,
      type: AITaskType.GENERATE,
      status: AITaskStatus.PENDING,
      config: {
        content: scriptText,
        projectId,
        taskSubtype: "parse-resources", // 标记为资源解析任务
        modelId: textModelId,
      },
      createdBy: userId,
    });

    const savedTask = await this.aiTaskRepository.save(task);

    // 8. 更新剧本元数据，记录解析任务ID
    script.metadata = {
      ...script.metadata,
      parseTaskId: savedTask.id,
      parseStatus: "pending",
    };
    await this.scriptRepository.save(script);

    // 9. 添加到处理队列
    await this.scriptAIParseQueue.add(
      "parse-resources",
      {
        taskId: savedTask.id,
        type: "parse-resources",
        modelId: textModelId, // 传入文本模型 ID
        requestData: {
          content: scriptText,
          scriptId: script.id,
          projectId,
        },
      },
      {
        priority: 5,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
      },
    );

    this.logger.log(
      `剧本资源解析任务已创建: ${savedTask.id}, 剧本: ${scriptId}, 模型: ${textModelId}`,
    );

    return {
      taskId: savedTask.id,
      status: "pending",
      message: "解析任务已启动",
    };
  }

  /**
   * 清理剧本的所有素材（图片、音频、视频）
   * 在强制重新解析前调用，避免资源浪费
   */
  private async cleanupScriptAssets(script: Script): Promise<void> {
    const content = script.content as Record<string, unknown>;
    if (!content) return;

    const filesToDelete: string[] = [];

    // 1. 收集角色图片
    const characters =
      (content.characters as Array<Record<string, unknown>>) || [];
    for (const char of characters) {
      const images = (char.images as Array<Record<string, unknown>>) || [];
      for (const img of images) {
        if (img.url) filesToDelete.push(img.url as string);
      }
    }

    // 2. 收集场景图片
    const scenes = (content.scenes as Array<Record<string, unknown>>) || [];
    for (const scene of scenes) {
      const images = (scene.images as Array<Record<string, unknown>>) || [];
      for (const img of images) {
        if (img.url) filesToDelete.push(img.url as string);
      }
    }

    // 3. 收集道具图片
    const props = (content.props as Array<Record<string, unknown>>) || [];
    for (const prop of props) {
      const images = (prop.images as Array<Record<string, unknown>>) || [];
      for (const img of images) {
        if (img.url) filesToDelete.push(img.url as string);
      }
    }

    // 4. 收集分镜组（shotGroups）图片、视频、音频
    const shotGroups =
      (content.shotGroups as Array<Record<string, unknown>>) || [];
    for (const sg of shotGroups) {
      // 分镜组图片
      const sgImages = (sg.images as Array<Record<string, unknown>>) || [];
      for (const img of sgImages) {
        if (img.url) filesToDelete.push(img.url as string);
      }

      // 参考图
      const refImages =
        (sg.referenceImages as Array<Record<string, unknown>>) || [];
      for (const img of refImages) {
        if (img.url) filesToDelete.push(img.url as string);
      }

      // 分镜视频
      const shots = (sg.shots as Array<Record<string, unknown>>) || [];
      for (const shot of shots) {
        if (shot.videoUrl) filesToDelete.push(shot.videoUrl as string);
      }

      // 对话音频
      const dialogues = (sg.dialogues as Array<Record<string, unknown>>) || [];
      for (const dlg of dialogues) {
        if (dlg.audioUrl) filesToDelete.push(dlg.audioUrl as string);
      }
    }

    // 兼容旧版 storyboards
    const storyboards =
      (content.storyboards as Array<Record<string, unknown>>) || [];
    for (const sb of storyboards) {
      const sbImages = (sb.images as Array<Record<string, unknown>>) || [];
      for (const img of sbImages) {
        if (img.url) filesToDelete.push(img.url as string);
      }
      const refImages =
        (sb.referenceImages as Array<Record<string, unknown>>) || [];
      for (const img of refImages) {
        if (img.url) filesToDelete.push(img.url as string);
      }
      const videoGen = sb.videoGeneration as
        | Record<string, unknown>
        | undefined;
      if (videoGen?.videoUrl) {
        filesToDelete.push(videoGen.videoUrl as string);
      }
      const dialogues = (sb.dialogues as Array<Record<string, unknown>>) || [];
      for (const dlg of dialogues) {
        if (dlg.audioUrl) filesToDelete.push(dlg.audioUrl as string);
      }
    }

    // 5. 删除文件
    let deletedCount = 0;
    for (const url of filesToDelete) {
      try {
        const key = this.extractOssKey(url);
        if (key) {
          await this.ossService.deleteFile(key);
          deletedCount++;
        }
      } catch (e) {
        this.logger.warn(`删除文件失败: ${url}, 错误: ${(e as Error).message}`);
      }
    }

    this.logger.log(`已清理 ${deletedCount} 个素材文件`);

    // 6. 清理 AI 任务记录
    await this.aiTaskRepository.delete({ scriptId: script.id });

    // 7. 重置剧本内容（保留角色/场景/道具名称，清除图片等）
    content.characters = characters.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      importance: c.importance,
      gender: c.gender,
      age: c.age,
      personality: c.personality,
      // 清除图片相关字段
      images: [],
      mainImageId: undefined,
      assetStatus: undefined,
      importedAsset: undefined,
      creationPlan: undefined,
    }));

    content.scenes = scenes.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      dialogues: s.dialogues, // 保留对话数据
      // 清除图片相关字段
      images: [],
      mainImageId: undefined,
      assetStatus: undefined,
      importedAsset: undefined,
      creationPlan: undefined,
    }));

    content.props = props.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      // 清除图片相关字段
      images: [],
      mainImageId: undefined,
      assetStatus: undefined,
      importedAsset: undefined,
      creationPlan: undefined,
    }));

    // 清空分镜
    content.storyboards = [];

    // 保存清理后的内容
    script.content = content;
    await this.scriptRepository.save(script);
  }

  /**
   * 从 URL 提取 OSS Key
   */
  private extractOssKey(url: string): string | null {
    if (!url) return null;

    try {
      if (url.startsWith("/static/")) {
        // 本地存储相对路径，去掉 /static/ 前缀
        return url.slice(7);
      } else if (url.startsWith("http")) {
        // OSS 完整 URL
        const urlObj = new URL(url);
        return urlObj.pathname.startsWith("/")
          ? urlObj.pathname.slice(1)
          : urlObj.pathname;
      }
      // 已经是 key 格式
      return url;
    } catch {
      return null;
    }
  }

  /**
   * 获取剧本资源解析任务状态
   */
  async getParseTaskStatus(
    userId: string,
    projectId: string,
    scriptId: string,
  ): Promise<{
    hasTask: boolean;
    taskId?: string;
    status?: string;
    progress?: number;
    result?: {
      characters?: unknown[];
      scenes?: unknown[];
      props?: unknown[];
      dialogues?: unknown[];
    };
    error?: string;
  }> {
    // 1. 检查权限
    await this.checkProjectAccess(userId, projectId, CollaboratorRole.EDITOR);

    // 2. 获取剧本
    const script = await this.scriptRepository.findOne({
      where: { id: scriptId, projectId, deletedAt: IsNull() },
    });

    if (!script) {
      throw new NotFoundException("剧本不存在");
    }

    // 3. 优先检查最新的解析任务状态（避免因 content 短路导致进行中任务被漏报）
    const metadata = script.metadata as Record<string, unknown> | undefined;
    const parseTaskId = metadata?.parseTaskId as string | undefined;

    if (parseTaskId) {
      const task = await this.aiTaskRepository.findOne({
        where: { id: parseTaskId },
      });

      if (task) {
        // 任务仍在进行中，返回任务状态
        if (
          task.status === AITaskStatus.PENDING ||
          task.status === AITaskStatus.PROCESSING
        ) {
          return {
            hasTask: true,
            taskId: task.id,
            status: task.status,
            progress: task.progress || 0,
          };
        }

        // 任务已完成或失败，返回任务结果
        if (task.status === AITaskStatus.COMPLETED && task.result) {
          return {
            hasTask: true,
            taskId: task.id,
            status: task.status,
            result: task.result as {
              characters?: unknown[];
              scenes?: unknown[];
              props?: unknown[];
              dialogues?: unknown[];
            },
          };
        }

        if (task.status === AITaskStatus.FAILED) {
          return {
            hasTask: true,
            taskId: task.id,
            status: task.status,
            error: task.error || undefined,
          };
        }
      }
    }

    // 4. 没有任务记录时，降级为读取 content 中已有的资源数据
    const content = script.content as Record<string, unknown> | undefined;
    if (content) {
      const existingCharacters = (content.characters as unknown[]) || [];
      const existingScenes = (content.scenes as unknown[]) || [];
      const existingProps = (content.props as unknown[]) || [];

      if (
        existingCharacters.length > 0 ||
        existingScenes.length > 0 ||
        existingProps.length > 0
      ) {
        // 检测数据格式：迁移后为字符串数组（ID），需从资产表查询完整数据
        const isCharactersIdArray =
          existingCharacters.length > 0 &&
          typeof existingCharacters[0] === "string";
        const isScenesIdArray =
          existingScenes.length > 0 && typeof existingScenes[0] === "string";
        const isPropsIdArray =
          existingProps.length > 0 && typeof existingProps[0] === "string";

        // 从资产表查询完整数据
        let charactersResult: unknown[] = existingCharacters;
        let scenesResult: unknown[] = existingScenes;
        let propsResult: unknown[] = existingProps;

        if (isCharactersIdArray) {
          const charIds = existingCharacters as string[];
          const charMap = await this.characterService.findByIds(charIds);
          charactersResult = charIds
            .map((id) => charMap.get(id))
            .filter((c) => c !== undefined);
        }

        if (isScenesIdArray) {
          const sceneIds = existingScenes as string[];
          const sceneMap = await this.sceneService.findByIds(sceneIds);
          scenesResult = sceneIds
            .map((id) => sceneMap.get(id))
            .filter((s) => s !== undefined);
        }

        if (isPropsIdArray) {
          const propIds = existingProps as string[];
          const propMap = await this.propService.findByIds(propIds);
          propsResult = propIds
            .map((id) => propMap.get(id))
            .filter((p) => p !== undefined);
        }

        return {
          hasTask: true,
          status: "completed",
          result: {
            characters: charactersResult,
            scenes: scenesResult,
            props: propsResult,
          },
        };
      }
    }

    return { hasTask: false };
  }

  // ==================== 分镜解析 ====================

  /**
   * 解析剧本分镜（独立于资源解析）
   * 前置条件：必须已有角色或场景数据
   * 从数据库读取资源数据构建 name->id 映射
   */
  async parseStoryboards(
    userId: string,
    projectId: string,
    scriptId: string,
    force: boolean = false,
  ): Promise<{
    taskId: string;
    status: string;
    message: string;
  }> {
    // 1. 检查权限
    await this.checkProjectAccess(userId, projectId, CollaboratorRole.EDITOR);

    // 2. 获取剧本
    const script = await this.scriptRepository.findOne({
      where: { id: scriptId, projectId, deletedAt: IsNull() },
    });

    if (!script) {
      throw new NotFoundException("剧本不存在");
    }

    const content = script.content as Record<string, unknown> | undefined;

    // 3. 检查前置条件：必须有角色或场景数据
    const characters = (content?.characters as unknown[]) || [];
    const scenes = (content?.scenes as unknown[]) || [];

    if (characters.length === 0 && scenes.length === 0) {
      throw new BadRequestException("请先解析资源");
    }

    // 4. 检查是否已有分镜数据
    const existingShotGroups = (content?.shotGroups as unknown[]) || [];
    const existingStoryboards = (content?.storyboards as unknown[]) || [];

    if (
      (existingShotGroups.length > 0 || existingStoryboards.length > 0) &&
      !force
    ) {
      return {
        taskId: "",
        status: "completed",
        message: "分镜已解析完成",
      };
    }

    // 5. 获取文本模型
    let textModelId: string | undefined;

    // 5.1 从剧本配置获取
    const scriptSettings = content?.scriptSettings as
      | Record<string, unknown>
      | undefined;
    if (scriptSettings?.modelId) {
      textModelId = scriptSettings.modelId as string;
    }

    // 5.2 从 metadata.aiModel 获取
    if (!textModelId) {
      const metadata = script.metadata as Record<string, unknown> | undefined;
      if (metadata?.aiModel && typeof metadata.aiModel === "string") {
        textModelId = metadata.aiModel;
      }
    }

    // 5.3 从项目配置获取
    if (!textModelId) {
      const projectModelConfig = await this.projectModelConfigRepository.findOne(
        {
          where: { projectId, category: "TEXT_GENERATION" as any },
        },
      );
      if (projectModelConfig?.modelId) {
        textModelId = projectModelConfig.modelId;
      }
    }

    // 5.4 从用户默认配置获取
    if (!textModelId) {
      const user = await this.userRepository.findOne({
        where: { id: userId },
      });
      const userDefaultModels =
        (user?.defaultModels as Record<string, string>) || {};
      textModelId = userDefaultModels["text_generation"];
    }

    if (!textModelId) {
      throw new BadRequestException(
        "剧本未配置文本模型，请先设置模型后再解析",
      );
    }

    // 6. 从数据库构建 name->id 映射
    const characterMap = new Map<string, string>();
    const characterAssetMap = new Map<string, string>();
    const sceneMap = new Map<string, string>();
    const sceneAssetMap = new Map<string, string>();
    const propMap = new Map<string, string>();
    const propAssetMap = new Map<string, string>();

    // 从 content.characters 构建 name -> refId 映射
    // 当 content.characters 中没有 name 时（Phase 4 后 name 不再存入 content），从资产表查询补充
    for (const char of characters as Array<{ id: string; name?: string; characterId?: string }>) {
      let name = char.name;
      if (!name && char.characterId) {
        const characterAsset = await this.characterRepository.findOne({
          where: { id: char.characterId, projectId, deletedAt: IsNull() },
        });
        name = characterAsset?.name;
      }
      if (name) {
        characterMap.set(name, char.id);
        if (char.characterId) {
          characterAssetMap.set(name, char.characterId);
        }
      }
    }

    // 从 content.scenes 构建 name -> refId 映射
    for (const scene of scenes as Array<{ id: string; name?: string; sceneId?: string }>) {
      let name = scene.name;
      if (!name && scene.sceneId) {
        const sceneAsset = await this.sceneRepository.findOne({
          where: { id: scene.sceneId, projectId, deletedAt: IsNull() },
        });
        name = sceneAsset?.name;
      }
      if (name) {
        sceneMap.set(name, scene.id);
        if (scene.sceneId) {
          sceneAssetMap.set(name, scene.sceneId);
        }
      }
    }

    // 从 content.props 构建 name -> refId 映射
    const props = (content?.props as unknown[]) || [];
    for (const prop of props as Array<{ id: string; name?: string; propId?: string }>) {
      let name = prop.name;
      if (!name && prop.propId) {
        const propAsset = await this.propRepository.findOne({
          where: { id: prop.propId, projectId, deletedAt: IsNull() },
        });
        name = propAsset?.name;
      }
      if (name) {
        propMap.set(name, prop.id);
        if (prop.propId) {
          propAssetMap.set(name, prop.propId);
        }
      }
    }

    // 7. 构建剧本文本
    let scriptText = "";
    if (script.description?.trim()) {
      scriptText = script.description.trim();
    }

    if (!scriptText) {
      throw new BadRequestException("剧本内容为空，无法解析分镜");
    }

    // 8. 创建 AI 任务
    const task = this.aiTaskRepository.create({
      scriptId: script.id,
      type: AITaskType.GENERATE,
      status: AITaskStatus.PENDING,
      config: {
        content: scriptText,
        projectId,
        taskSubtype: "parse-storyboards",
        modelId: textModelId,
        // 传递映射数据给 Worker
        characterMap: Object.fromEntries(characterMap),
        sceneMap: Object.fromEntries(sceneMap),
        propMap: Object.fromEntries(propMap),
        characterAssetMap: Object.fromEntries(characterAssetMap),
        sceneAssetMap: Object.fromEntries(sceneAssetMap),
        propAssetMap: Object.fromEntries(propAssetMap),
      },
      createdBy: userId,
    });

    const savedTask = await this.aiTaskRepository.save(task);

    // 9. 更新剧本元数据
    script.metadata = {
      ...script.metadata,
      storyboardParseTaskId: savedTask.id,
      storyboardParseStatus: "pending",
    };
    await this.scriptRepository.save(script);

    // 10. 添加到处理队列
    await this.scriptAIParseQueue.add(
      "parse-storyboards",
      {
        taskId: savedTask.id,
        type: "parse-storyboards",
        modelId: textModelId,
        requestData: {
          content: scriptText,
          scriptId: script.id,
          projectId,
          characterMap: Object.fromEntries(characterMap),
          sceneMap: Object.fromEntries(sceneMap),
          propMap: Object.fromEntries(propMap),
          characterAssetMap: Object.fromEntries(characterAssetMap),
          sceneAssetMap: Object.fromEntries(sceneAssetMap),
          propAssetMap: Object.fromEntries(propAssetMap),
        },
      },
      {
        priority: 5,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
      },
    );

    this.logger.log(
      `分镜解析任务已创建: ${savedTask.id}, 剧本: ${scriptId}, 模型: ${textModelId}`,
    );

    return {
      taskId: savedTask.id,
      status: "pending",
      message: "分镜解析任务已启动",
    };
  }

  /**
   * 解析剧本（异步任务）
   * 将人工可读剧本解析为结构化数据，通过 WebSocket 推送进度
   * @deprecated 已废弃，前端未使用。新版请使用 parseScriptResources 方法。
   */
  async parseScript(
    userId: string,
    projectId: string,
    scriptId: string,
    dto: ParseScriptDto,
  ): Promise<{
    scriptId: string;
    taskId: string;
    status: string;
  }> {
    // 1. 检查权限
    await this.checkProjectAccess(userId, projectId, CollaboratorRole.EDITOR);

    // 2. 获取剧本
    const script = await this.scriptRepository.findOne({
      where: { id: scriptId, projectId, deletedAt: IsNull() },
    });

    if (!script) {
      throw new NotFoundException("剧本不存在");
    }

    // 3. 检查剧本状态
    if (script.status === ScriptStatus.AI_GENERATING) {
      throw new ConflictException("剧本正在处理中，请稍后再试");
    }

    // 4. 更新剧本状态为生成中
    script.status = ScriptStatus.AI_GENERATING;
    await this.scriptRepository.save(script);

    // 5. 创建 AI 解析任务
    const task = this.aiTaskRepository.create({
      scriptId: script.id,
      type: AITaskType.PARSE,
      status: AITaskStatus.PENDING,
      config: {
        content: dto.content,
        modelId: dto.modelId,
      },
      createdBy: userId,
    });

    const savedTask = await this.aiTaskRepository.save(task);

    // 6. 添加到剧本AI解析队列
    await this.scriptAIParseQueue.add(
      savedTask.id,
      {
        taskId: savedTask.id,
        type: "parse",
        requestData: {
          content: dto.content,
          filename: "script_parse.txt",
        },
        modelId: dto.modelId || null,
      },
      {
        jobId: savedTask.id,
        priority: 40,
      },
    );

    this.logger.log(`剧本解析任务已创建: ${savedTask.id}, 剧本: ${scriptId}`);

    return {
      scriptId: script.id,
      taskId: savedTask.id,
      status: "pending",
    };
  }
}
