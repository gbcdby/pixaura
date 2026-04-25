import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  UnprocessableEntityException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  Repository,
  IsNull,
  In,
  OptimisticLockVersionMismatchError,
} from "typeorm";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { Script, ScriptStatus } from "../entities/script.entity";
import { AITask, AITaskStatus, AITaskType } from "../entities/ai-task.entity";
import {
  Collaborator,
  CollaboratorRole,
} from "../../project/entities/collaborator.entity";
import { Project } from "../../project/entities/project.entity";
import { Character } from "../../character/entities/character.entity";
import { CharacterImage, CharacterImageType, CharacterImageTypeType } from "../../character/entities/character-image.entity";
import { Scene } from "../../scene/entities/scene.entity";
import { SceneImage, SceneImageType, SceneImageTypeType } from "../../scene/entities/scene-image.entity";
import { Prop } from "../../prop/entities/prop.entity";
import { PropImage, PropImageType, PropImageTypeType } from "../../prop/entities/prop-image.entity";
import { CharacterGenderType } from "../../character/entities/character.entity";
import {
  GenerateCharactersDto,
  GenerateScenesDto,
  GeneratePropsDto,
  BatchGenerateAssetsDto,
  UpdateAssetDto,
  GenerateAssetImageDto,
  AssetResponse,
  AssetImageResponse,
  GenerateTaskResponse,
} from "../dto/script-asset.dto";
import {
  AssetStatus,
  AssetType,
  CreateAndLinkAssetDto,
  LinkExistingAssetsDto,
  CreateAndLinkAssetResponse,
  LinkExistingAssetsResponse,
  LinkedAssetRefItem,
  SkippedAssetItem,
  ResolvedAssetResponse,
  CharacterRef,
  SceneRef,
  PropRef,
} from "@pixaura/shared-types";
import { randomUUID } from "crypto";
import { WebSocketService } from "../../websocket/websocket.service";
import { OssService } from "../../../common/oss/oss.service";
import { RedlockService } from "../../../common/services/redlock.service";
import { buildScriptAssetImagePrompt } from "../../../prompts";
import { ModelService } from "../../model-config/services/model.service";
import type { ReferenceImageItem } from "../../../prompts";

/**
 * 剧本资产服务
 * 处理剧本中角色、场景、道具的生成和管理
 */
@Injectable()
export class ScriptAssetService {
  private readonly logger = new Logger(ScriptAssetService.name);

  constructor(
    @InjectRepository(Script)
    private readonly scriptRepository: Repository<Script>,
    @InjectRepository(AITask)
    private readonly aiTaskRepository: Repository<AITask>,
    @InjectRepository(Collaborator)
    private readonly collaboratorRepository: Repository<Collaborator>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Character)
    private readonly characterRepository: Repository<Character>,
    @InjectRepository(CharacterImage)
    private readonly characterImageRepository: Repository<CharacterImage>,
    @InjectRepository(Scene)
    private readonly sceneRepository: Repository<Scene>,
    @InjectRepository(SceneImage)
    private readonly sceneImageRepository: Repository<SceneImage>,
    @InjectRepository(Prop)
    private readonly propRepository: Repository<Prop>,
    @InjectRepository(PropImage)
    private readonly propImageRepository: Repository<PropImage>,
    @InjectQueue("script-ai-generate")
    private readonly scriptAIGenerateQueue: Queue,
    private readonly webSocketService: WebSocketService,
    private readonly ossService: OssService,
    private readonly modelService: ModelService,
    private readonly redlockService: RedlockService,
  ) {}

  /**
   * 检查用户是否有项目访问权限
   */
  private async checkProjectAccess(
    userId: string,
    projectId: string,
    requireRole?: (typeof CollaboratorRole)[keyof typeof CollaboratorRole],
  ): Promise<string> {
    const project = await this.projectRepository.findOne({
      where: { projectId, isDeleted: false },
    });

    if (!project) {
      throw new NotFoundException("项目不存在");
    }

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
  private async checkScriptEditable(
    scriptId: string,
    userId: string,
  ): Promise<Script> {
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

  /**
   * 更新剧本的生成状态
   */
  /**
   * 更新步骤状态（已废弃，generationState 已移除）
   * @deprecated 前端通过 WebSocket 实时获取状态，无需持久化
   */
  private updateGenerationState(
    _script: Script,
    _step: string,
    _state: Record<string, unknown>,
  ): void {
    // 空操作 - generationState 已移除
  }

  // ==================== 资产生成 ====================

  /**
   * 生成角色
   */
  async generateCharacters(
    userId: string,
    projectId: string,
    scriptId: string,
    dto: GenerateCharactersDto,
  ): Promise<GenerateTaskResponse> {
    const script = await this.checkScriptEditable(scriptId, userId);

    if (script.projectId !== projectId) {
      throw new NotFoundException("剧本不存在");
    }

    // 检查是否有进行中的任务
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

    // 更新生成状态
    this.updateGenerationState(script, "characters", {
      status: "processing",
      modelId: dto.modelId,
    });
    await this.scriptRepository.save(script);

    // 创建AI任务
    const task = this.aiTaskRepository.create({
      scriptId,
      type: AITaskType.GENERATE,
      status: AITaskStatus.PENDING,
      config: {
        assetType: "characters",
        modelId: dto.modelId,
        options: dto.options,
        scriptDescription: script.description,
      },
      createdBy: userId,
    });

    const savedTask = await this.aiTaskRepository.save(task);

    // 更新当前任务ID
    this.updateGenerationState(script, "characters", {
      currentTaskId: savedTask.id,
    });
    await this.scriptRepository.save(script);

    return {
      taskId: savedTask.id,
      status: "pending",
      type: "character_generate",
      estimatedTime: 30,
    };
  }

  /**
   * 生成场景
   */
  async generateScenes(
    userId: string,
    projectId: string,
    scriptId: string,
    dto: GenerateScenesDto,
  ): Promise<GenerateTaskResponse> {
    const script = await this.checkScriptEditable(scriptId, userId);

    if (script.projectId !== projectId) {
      throw new NotFoundException("剧本不存在");
    }

    // 检查是否有进行中的任务
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

    // 更新生成状态
    this.updateGenerationState(script, "scenes", {
      status: "processing",
      modelId: dto.modelId,
    });
    await this.scriptRepository.save(script);

    // 创建AI任务
    const task = this.aiTaskRepository.create({
      scriptId,
      type: AITaskType.GENERATE,
      status: AITaskStatus.PENDING,
      config: {
        assetType: "scenes",
        modelId: dto.modelId,
        options: dto.options,
        scriptDescription: script.description,
      },
      createdBy: userId,
    });

    const savedTask = await this.aiTaskRepository.save(task);

    // 更新当前任务ID
    this.updateGenerationState(script, "scenes", {
      currentTaskId: savedTask.id,
    });
    await this.scriptRepository.save(script);

    return {
      taskId: savedTask.id,
      status: "pending",
      type: "scene_generate",
      estimatedTime: 30,
    };
  }

  /**
   * 生成道具
   */
  async generateProps(
    userId: string,
    projectId: string,
    scriptId: string,
    dto: GeneratePropsDto,
  ): Promise<GenerateTaskResponse> {
    const script = await this.checkScriptEditable(scriptId, userId);

    if (script.projectId !== projectId) {
      throw new NotFoundException("剧本不存在");
    }

    // 检查是否有进行中的任务
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

    // 更新生成状态
    this.updateGenerationState(script, "props", {
      status: "processing",
      modelId: dto.modelId,
    });
    await this.scriptRepository.save(script);

    // 创建AI任务
    const task = this.aiTaskRepository.create({
      scriptId,
      type: AITaskType.GENERATE,
      status: AITaskStatus.PENDING,
      config: {
        assetType: "props",
        modelId: dto.modelId,
        options: dto.options,
        scriptDescription: script.description,
      },
      createdBy: userId,
    });

    const savedTask = await this.aiTaskRepository.save(task);

    // 更新当前任务ID
    this.updateGenerationState(script, "props", {
      currentTaskId: savedTask.id,
    });
    await this.scriptRepository.save(script);

    return {
      taskId: savedTask.id,
      status: "pending",
      type: "prop_generate",
      estimatedTime: 30,
    };
  }

  /**
   * 批量生成资产
   */
  async batchGenerateAssets(
    userId: string,
    projectId: string,
    scriptId: string,
    dto: BatchGenerateAssetsDto,
  ): Promise<GenerateTaskResponse> {
    const script = await this.checkScriptEditable(scriptId, userId);

    if (script.projectId !== projectId) {
      throw new NotFoundException("剧本不存在");
    }

    // 检查是否有进行中的任务
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

    // 更新各步骤的生成状态
    for (const step of dto.steps) {
      this.updateGenerationState(script, step, {
        status: "processing",
        modelId: dto.modelId,
      });
    }
    await this.scriptRepository.save(script);

    // 创建AI任务
    const task = this.aiTaskRepository.create({
      scriptId,
      type: AITaskType.GENERATE,
      status: AITaskStatus.PENDING,
      config: {
        assetType: "batch",
        steps: dto.steps,
        modelId: dto.modelId,
        options: dto.options,
        scriptDescription: script.description,
      },
      createdBy: userId,
    });

    const savedTask = await this.aiTaskRepository.save(task);

    // 更新当前任务ID到所有步骤
    for (const step of dto.steps) {
      this.updateGenerationState(script, step, {
        currentTaskId: savedTask.id,
      });
    }
    await this.scriptRepository.save(script);

    return {
      taskId: savedTask.id,
      status: "pending",
      type: "batch_generate",
      estimatedTime: 60,
    };
  }

  // ==================== 资产CRUD ====================

  /**
   * 更新资产
   * 使用分布式锁防止并发覆盖
   */
  async updateAsset(
    userId: string,
    projectId: string,
    scriptId: string,
    assetId: string,
    dto: UpdateAssetDto,
  ): Promise<AssetResponse> {
    const lockKey = `script:content:${scriptId}`;

    return this.redlockService.withLock(lockKey, 10000, async () => {
      const script = await this.checkScriptEditable(scriptId, userId);

      if (script.projectId !== projectId) {
        throw new NotFoundException("剧本不存在");
      }

      const content = script.content as Record<string, unknown>;
      const assetType = dto.assetType;

      // 根据资产类型获取对应的数组
      const assetsKey = this.getAssetsKey(assetType);
      const assets =
        (content[assetsKey] as Array<Record<string, unknown>>) || [];

      // 查找资产
      const assetIndex = assets.findIndex((a) => a.id === assetId);
      if (assetIndex === -1) {
        throw new NotFoundException("资产不存在");
      }

      // 更新资产字段
      const asset = assets[assetIndex];
      const updatedAsset: Record<string, unknown> = {
        ...asset,
        id: asset.id,
        name: dto.name ?? asset.name,
        description: dto.description ?? asset.description,
      };

      // 根据资产类型更新特定字段
      if (assetType === "character") {
        if (dto.personality !== undefined)
          updatedAsset.personality = dto.personality;
        if (dto.age !== undefined) updatedAsset.age = dto.age;
        if (dto.gender !== undefined) updatedAsset.gender = dto.gender;
        if (dto.importance !== undefined)
          updatedAsset.importance = dto.importance;
      } else if (assetType === "scene") {
        if (dto.location !== undefined) updatedAsset.location = dto.location;
        if (dto.time !== undefined) updatedAsset.time = dto.time;
        if (dto.atmosphere !== undefined)
          updatedAsset.atmosphere = dto.atmosphere;
      }

      // 保存更新
      assets[assetIndex] = updatedAsset;
      content[assetsKey] = assets;
      script.content = content;

      try {
        await this.scriptRepository.save(script);
      } catch (error) {
        if (error instanceof OptimisticLockVersionMismatchError) {
          throw new ConflictException("资产已被其他操作修改，请刷新后重试");
        }
        throw error;
      }

      return this.mapToAssetResponse(updatedAsset, assetType);
    });
  }

  /**
   * 删除资产
   * 使用分布式锁防止并发操作
   */
  async deleteAsset(
    userId: string,
    projectId: string,
    scriptId: string,
    assetId: string,
  ): Promise<{ success: boolean }> {
    const lockKey = `script:content:${scriptId}`;

    return this.redlockService.withLock(lockKey, 10000, async () => {
      const script = await this.checkScriptEditable(scriptId, userId);

      if (script.projectId !== projectId) {
        throw new NotFoundException("剧本不存在");
      }

      const content = script.content as Record<string, unknown>;

      // 尝试从所有资产类型中删除
      const assetTypes: Array<"characters" | "scenes" | "props"> = [
        "characters",
        "scenes",
        "props",
      ];
      let deleted = false;

      for (const assetType of assetTypes) {
        const assets =
          (content[assetType] as Array<Record<string, unknown>>) || [];
        const assetIndex = assets.findIndex((a) => a.id === assetId);

        if (assetIndex !== -1) {
          assets.splice(assetIndex, 1);
          content[assetType] = assets;
          deleted = true;
          break;
        }
      }

      if (!deleted) {
        throw new NotFoundException("资产不存在");
      }

      script.content = content;

      try {
        await this.scriptRepository.save(script);
      } catch (error) {
        if (error instanceof OptimisticLockVersionMismatchError) {
          throw new ConflictException("资产删除冲突，请刷新后重试");
        }
        throw error;
      }

      return { success: true };
    });
  }

  // ==================== 图片管理 ====================

  /**
   * 生成资产图片（角色/场景/道具，基于描述自动构造 prompt）
   * 支持传入 aspectRatio 控制图片比例（如 "9:16"），直接透传不做转换
   */
  async generateCharacterImage(
    userId: string,
    projectId: string,
    scriptId: string,
    refId: string,
    dto: {
      modelId?: string;
      customPrompt?: string;
      negativePrompt?: string;
      aspectRatio?: string;
    },
  ): Promise<{
    taskId: string;
    status: string;
    refId: string;
    estimatedTime: number;
  }> {
    const script = await this.checkScriptEditable(scriptId, userId);

    if (script.projectId !== projectId) {
      throw new NotFoundException("剧本不存在");
    }

    const content = script.content as Record<string, unknown>;

    // 在 characters/scenes/props 中查找 refId
    const assetArrayKeys: Array<{
      key: "characters" | "scenes" | "props";
      type: string;
    }> = [
      { key: "characters", type: "character" },
      { key: "scenes", type: "scene" },
      { key: "props", type: "prop" },
    ];

    let asset: Record<string, unknown> | undefined;
    let assetKind = "character";
    let assetLibraryData: {
      name: string;
      description: string | null;
      gender?: string | null;
      age?: string | null;
    } | null = null;

    for (const { key, type } of assetArrayKeys) {
      const arr = (content[key] as Array<Record<string, unknown>>) ?? [];
      const found = arr.find((item) => item.id === refId);
      if (found) {
        asset = found;
        assetKind = type;

        // 从素材库获取完整数据（Phase 4：Ref 不再存储兼容字段）
        const assetId =
          type === "character"
            ? (found.characterId as string)
            : type === "scene"
              ? (found.sceneId as string)
              : (found.propId as string);

        if (assetId) {
          if (type === "character") {
            const char = await this.characterRepository.findOne({
              where: { id: assetId, projectId },
            });
            if (char) {
              assetLibraryData = {
                name: char.name,
                description: char.description,
                gender: char.gender,
                age: char.age,
              };
            }
          } else if (type === "scene") {
            const scene = await this.sceneRepository.findOne({
              where: { id: assetId, projectId },
            });
            if (scene) {
              assetLibraryData = {
                name: scene.name,
                description: scene.description,
              };
            }
          } else if (type === "prop") {
            const prop = await this.propRepository.findOne({
              where: { id: assetId, projectId },
            });
            if (prop) {
              assetLibraryData = {
                name: prop.name,
                description: prop.description,
              };
            }
          }
        }
        break;
      }
    }

    // 若在角色/场景/道具中未找到，再尝试在分镜组中查找
    // 注意：分镜组数据可能存储在 storyboards 或 shotGroups 字段（迁移过渡期）
    const storyboards =
      (content.storyboards as Array<Record<string, unknown>>) ?? [];
    const shotGroups =
      (content.shotGroups as Array<Record<string, unknown>>) ?? [];
    const storyboard = !asset
      ? storyboards.find((sb) => sb.id === refId) ??
        shotGroups.find((sg) => sg.id === refId)
      : undefined;

    // 1354: refId 不存在
    if (!asset && !storyboard) {
      throw new UnprocessableEntityException({
        code: 1354,
        message: "refId 在剧本中不存在",
      });
    }

    let prompt: string;
    let referenceImages: string[];
    let assetRefImages: ReferenceImageItem[] = []; // 带类型的参考图（支持多模态参考图生成的图像模型）
    let aspectRatio: string | undefined = dto.aspectRatio;

    if (storyboard) {
      // ---- 分镜图片生成 ----
      const description = (
        storyboard.description as string | undefined
      )?.trim();
      if (!description) {
        throw new UnprocessableEntityException({
          code: 1352,
          message: "分镜描述为空，无法生成提示词",
        });
      }

      // 使用自定义 prompt 或分镜描述
      prompt = dto.customPrompt?.trim() || description;

      // 从剧本设置中读取分辨率比例，直接透传不做转换
      const settings = content.settings as Record<string, unknown> | undefined;
      const resolution =
        (settings?.resolution as string) ||
        (content.resolution as string) ||
        "9:16";
      aspectRatio = resolution;
      this.logger.log(
        `分镜图片生成使用剧本比例: ${aspectRatio}`,
      );

      // 从关联的角色、场景、道具中收集主图 URL 作为参考图
      // Phase 4：Ref 不再存储 name 和 images，需要从素材库获取
      const characters =
        (content.characters as Array<Record<string, unknown>>) ?? [];
      const scenes = (content.scenes as Array<Record<string, unknown>>) ?? [];
      const props = (content.props as Array<Record<string, unknown>>) ?? [];
      const characterIds = (storyboard.characterIds as string[]) || [];
      const sceneId = storyboard.sceneId as string | undefined;
      const propIds = (storyboard.propIds as string[]) || [];

      // Phase 4：批量查询素材库数据和图片
      const charAssetIds = characters
        .map((c) => c.characterId as string)
        .filter(Boolean);
      const sceneAssetIds = scenes
        .map((s) => s.sceneId as string)
        .filter(Boolean);
      const propAssetIds = props
        .map((p) => p.propId as string)
        .filter(Boolean);

      // 查询角色素材库数据（含图片）
      const charLibrary = charAssetIds.length > 0
        ? await this.characterRepository.find({
            where: { id: In(charAssetIds), projectId },
            relations: ["images"],
          })
        : [];
      const charLibraryMap = new Map(charLibrary.map((c) => [c.id, c]));

      // 查询场景素材库数据（含图片）
      const sceneLibrary = sceneAssetIds.length > 0
        ? await this.sceneRepository.find({
            where: { id: In(sceneAssetIds), projectId },
            relations: ["images"],
          })
        : [];
      const sceneLibraryMap = new Map(sceneLibrary.map((s) => [s.id, s]));

      // 查询道具素材库数据（含图片）
      const propLibrary = propAssetIds.length > 0
        ? await this.propRepository.find({
            where: { id: In(propAssetIds), projectId },
            relations: ["images"],
          })
        : [];
      const propLibraryMap = new Map(propLibrary.map((p) => [p.id, p]));

      // 调试日志：显示分镜关联的资产 ID
      this.logger.log(
        `分镜图片生成调试: storyboardId=${refId}, characterIds=${JSON.stringify(characterIds)}, sceneId=${sceneId}, propIds=${JSON.stringify(propIds)}`,
      );

      // 收集关联资产的主图作为参考图（带类型信息）
      // 顺序：场景 → 角色 → 道具（场景作为背景优先，便于 AI 理解构图）
      // 每个素材只取一张主图，不收集参考图
      assetRefImages = [];

      // 1. 收集关联场景的主图（优先放置）
      if (sceneId) {
        // Phase 4：从素材库获取场景数据和图片
        const sceneRef = scenes.find(
          (s) => s.sceneId === sceneId || s.id === sceneId,
        );
        const assetId = sceneRef?.sceneId as string;
        const sceneData = assetId ? sceneLibraryMap.get(assetId) : null;

        if (sceneData) {
          const images = sceneData.images || [];
          const mainImg = images.find((img) => img.type === "panorama" && img.isCurrent);
          this.logger.log(
            `场景 ${sceneData.name}(${sceneId}): 总图片=${images.length}, 主图=${mainImg ? "有" : "无"}`,
          );
          if (mainImg?.url) {
            assetRefImages.push({
              url: mainImg.url,
              type: "scene",
              name: sceneData.name,
            });
          }
        } else {
          this.logger.warn(`场景未找到: sceneId=${sceneId}`);
        }
      } else {
        this.logger.log(`分镜未关联场景`);
      }

      // 2. 收集关联角色的主图
      for (const charId of characterIds) {
        // Phase 4：从素材库获取角色数据和图片
        const charRef = characters.find(
          (c) => c.characterId === charId || c.id === charId,
        );
        const assetId = charRef?.characterId as string;
        const charData = assetId ? charLibraryMap.get(assetId) : null;

        if (charData) {
          const images = charData.images || [];
          const mainImg = images.find((img) => img.type === "front_view" && img.isCurrent);
          this.logger.log(
            `角色 ${charData.name}(${charId}): 总图片=${images.length}, 主图=${mainImg ? "有" : "无"}`,
          );
          if (mainImg?.url) {
            assetRefImages.push({
              url: mainImg.url,
              type: "character",
              name: charData.name,
            });
          }
        } else {
          this.logger.warn(`角色未找到: charId=${charId}`);
        }
      }

      // 3. 收集关联道具的主图
      for (const propId of propIds) {
        // Phase 4：从素材库获取道具数据和图片
        const propRef = props.find(
          (p) => p.propId === propId || p.id === propId,
        );
        const assetId = propRef?.propId as string;
        const propData = assetId ? propLibraryMap.get(assetId) : null;

        if (propData) {
          const images = propData.images || [];
          const mainImg = images.find((img) => img.type === "front_view" && img.isCurrent);
          this.logger.log(
            `道具 ${propData.name}(${propId}): 总图片=${images.length}, 主图=${mainImg ? "有" : "无"}`,
          );
          if (mainImg?.url) {
            assetRefImages.push({
              url: mainImg.url,
              type: "prop",
              name: propData.name,
            });
          }
        } else {
          this.logger.warn(`道具未找到: propId=${propId}`);
        }
      }

      this.logger.log(
        `分镜图片生成: 收集到的带类型参考图数量=${assetRefImages.length}, 详情=${JSON.stringify(assetRefImages.map((i) => ({ type: i.type, name: i.name })))}`,
      );

      referenceImages = assetRefImages.map((item) => item.url);
      this.logger.log(
        `分镜图片生成: storyboardId=${refId}, 关联资产参考图数量=${referenceImages.length}`,
      );

      // 注意：referenceMode (分镜图生视频/多参考生视频) 是针对视频生成的，图片生成始终使用所有参考图
      // 分镜图片生成时会将所有角色、场景、道具的主图作为参考图传递

      // 参考图数量限制统一由 Provider 处理
    } else {
      // ---- 角色/场景/道具图片生成 ----
      // 允许所有状态的资产重新生成图片（包括 imported）
      if (asset!.assetStatus === undefined) {
        asset!.assetStatus = "will_create";
      }

      // Phase 4：从素材库获取数据
      if (!assetLibraryData) {
        throw new UnprocessableEntityException({
          code: 1352,
          message: "资产未关联素材库，无法获取描述信息",
        });
      }

      // 1352: description 为空
      const description = assetLibraryData.description?.trim();
      if (!description) {
        throw new UnprocessableEntityException({
          code: 1352,
          message: "资产描述为空，无法生成提示词",
        });
      }

      prompt = buildScriptAssetImagePrompt(
        assetLibraryData.name,
        description,
        assetKind as "character" | "scene" | "prop",
        dto.customPrompt,
        {
          gender: assetLibraryData.gender ?? undefined,
          age: assetLibraryData.age ?? undefined,
        },
      );

      // Phase 4：从素材库图片表获取参考图（Ref 不再存储 images）
      referenceImages = await this.getAssetReferenceImages(assetKind as "character" | "scene" | "prop", asset!);
    }

    // 检查模型是否支持参考图（适用于所有图片生成：角色/场景/道具/分镜）
    // 参考图数量限制统一由 Provider 处理

    // 1351: 已有进行中的图片生成任务（同一 refId）
    const existingImageTask = await this.aiTaskRepository.findOne({
      where: {
        scriptId,
        status: In([AITaskStatus.PENDING, AITaskStatus.PROCESSING]),
      },
    });
    const hasSameRefTask =
      existingImageTask &&
      (existingImageTask.config as Record<string, unknown>)?.assetType ===
        "image" &&
      (existingImageTask.config as Record<string, unknown>)?.assetId === refId;

    if (hasSameRefTask) {
      throw new ConflictException({
        code: 1351,
        message: "该资产已有进行中的图片生成任务",
      });
    }

    // 使用分布式锁保存清理结果，避免并发写入覆盖其他资产数据（如分镜图）
    const lockKey = `script:content:${scriptId}`;
    await this.redlockService.withLock(lockKey, 10000, async () => {
      // 重新获取剧本最新数据（避免脏读）
      const freshScript = await this.scriptRepository.findOne({
        where: { id: scriptId },
      });
      if (!freshScript) {
        throw new NotFoundException("剧本不存在");
      }
      const freshContent = freshScript.content as Record<string, unknown>;

      // 清理旧的图片生成任务和旧图片（同一 refId 的历史任务）
      await this.cleanupOldImageTasks(
        scriptId,
        refId,
        freshContent,
        storyboard,
      );

      // 使用 update 只更新 content 字段
      await this.scriptRepository.update(
        { id: scriptId },

        { content: freshContent as any },
      );
    });

    const logKind = storyboard ? "storyboard" : assetKind;
    this.logger.log(
      `创建${logKind}图片生成任务: scriptId=${scriptId}, refId=${refId}, aspectRatio=${aspectRatio || "1:1"}, refImages=${referenceImages.length}, prompt="${prompt.substring(0, 80)}..."`,
    );

    // 从模型配置中读取图片质量参数
    const model = dto.modelId ? await this.modelService.findById(dto.modelId) : null;
    const quality = (model?.defaultParams as Record<string, unknown> | undefined)?.quality as string | undefined;

    const task = this.aiTaskRepository.create({
      scriptId,
      type: AITaskType.GENERATE,
      status: AITaskStatus.PENDING,
      config: {
        assetType: "image",
        assetId: refId,
        scriptId,
        modelId: dto.modelId,
        prompt,
        negativePrompt: dto.negativePrompt,
        aspectRatio,
        type: "main",
        referenceImages,
        // 分镜生成时包含带类型的参考图（支持多模态参考图生成的图像模型）
        ...(storyboard && assetRefImages.length > 0
          ? { typedReferenceImages: assetRefImages }
          : {}),
        ...(quality ? { quality } : {}),
      },
      createdBy: userId,
    });

    const savedTask = await this.aiTaskRepository.save(task);

    // 预先存储订阅关系，确保 Worker 推送消息时前端已订阅
    // 这样即使前端 WebSocket 订阅消息稍晚到达，消息也不会丢失
    await this.webSocketService.subscribeToTask(userId, savedTask.id);

    // 添加到队列执行
    await this.scriptAIGenerateQueue.add(
      savedTask.id,
      {
        taskId: savedTask.id,
        type: AITaskType.GENERATE,
        requestData: {
          assetType: "image",
          assetId: refId,
          scriptId,
          modelId: dto.modelId,
          prompt,
          negativePrompt: dto.negativePrompt,
          aspectRatio,
          type: "main",
          referenceImages,
          // 分镜生成时包含带类型的参考图（支持多模态参考图生成的图像模型）
          ...(storyboard && assetRefImages.length > 0
            ? { typedReferenceImages: assetRefImages }
            : {}),
          ...(quality ? { quality } : {}),
        },
        modelId: dto.modelId,
      },
      {
        jobId: savedTask.id,
        priority: 30, // 图片生成优先级稍低
      },
    );

    // 发送 WebSocket 通知
    await this.webSocketService.broadcastTaskProgress(savedTask.id, {
      type: "asset:image-progress",
      taskId: savedTask.id,
      scriptId,
      refId,
      status: "pending",
      progress: 0,
      timestamp: new Date().toISOString(),
    });

    return {
      taskId: savedTask.id,
      status: "pending",
      refId,
      estimatedTime: 30,
    };
  }

  /**
   * 批量资产图片生成（角色/场景/道具）
   * 对指定类型中所有 assetStatus!=imported 且有 description 的资产触发图片生成
   * 支持传入 aspectRatio 控制图片比例（如 "9:16"），直接透传不做转换
   */
  async batchGenerateCharacterImages(
    userId: string,
    projectId: string,
    scriptId: string,
    dto: {
      assetType?: "character" | "scene" | "prop";
      modelId?: string;
      negativePrompt?: string;
      aspectRatio?: string;
    },
  ): Promise<{
    tasks: Array<{ refId: string; taskId: string; status: string }>;
    skipped: Array<{ refId: string; reason: string }>;
    fallbackDescriptions: Array<{ refId: string; name: string }>;
    total: number;
    started: number;
  }> {
    const script = await this.checkScriptEditable(scriptId, userId);

    if (script.projectId !== projectId) {
      throw new NotFoundException("剧本不存在");
    }

    const content = script.content as Record<string, unknown>;

    // 根据 assetType 选择对应的资产数组和 prompt 后缀
    const assetKind = dto.assetType || "character";
    const assetArrayKey = this.getAssetsKey(assetKind);
    const assets =
      (content[assetArrayKey] as Array<Record<string, unknown>>) ?? [];

    // 查询当前正在进行的图片任务（包括 PENDING 和 PROCESSING 状态）
    const processingTasks = await this.aiTaskRepository.find({
      where: {
        scriptId,
        status: In([AITaskStatus.PENDING, AITaskStatus.PROCESSING]),
      },
    });
    const processingRefIds = new Set(
      processingTasks
        .filter(
          (t) => (t.config as Record<string, unknown>)?.assetType === "image",
        )
        .map((t) => (t.config as Record<string, unknown>)?.assetId as string)
        .filter(Boolean),
    );

    const tasks: Array<{ refId: string; taskId: string; status: string }> = [];
    const skipped: Array<{ refId: string; reason: string }> = [];
    const fallbackDescriptions: Array<{ refId: string; name: string }> = [];

    // Phase 4：批量查询素材库数据
    const assetIds = assets
      .map((a) =>
        assetKind === "character"
          ? (a.characterId as string)
          : assetKind === "scene"
            ? (a.sceneId as string)
            : (a.propId as string),
      )
      .filter(Boolean);

    let assetLibraryMap: Map<string, { name: string; description: string | null; gender?: string | null; age?: string | null }> = new Map();
    if (assetIds.length > 0) {
      if (assetKind === "character") {
        const chars = await this.characterRepository.find({
          where: { id: In(assetIds), projectId },
        });
        for (const c of chars) {
          assetLibraryMap.set(c.id, { name: c.name, description: c.description, gender: c.gender, age: c.age });
        }
      } else if (assetKind === "scene") {
        const scenes = await this.sceneRepository.find({
          where: { id: In(assetIds), projectId },
        });
        for (const s of scenes) {
          assetLibraryMap.set(s.id, { name: s.name, description: s.description });
        }
      } else if (assetKind === "prop") {
        const props = await this.propRepository.find({
          where: { id: In(assetIds), projectId },
        });
        for (const p of props) {
          assetLibraryMap.set(p.id, { name: p.name, description: p.description });
        }
      }
    }

    for (const asset of assets) {
      const refId = asset.id as string;
      const assetStatus = asset.assetStatus as string | undefined;

      if (assetStatus === "imported") {
        skipped.push({ refId, reason: "already_imported" });
        continue;
      }

      if (processingRefIds.has(refId)) {
        skipped.push({ refId, reason: "already_generating" });
        continue;
      }

      // Phase 4：从素材库获取数据
      const libraryAssetId =
        assetKind === "character"
          ? (asset.characterId as string)
          : assetKind === "scene"
            ? (asset.sceneId as string)
            : (asset.propId as string);

      const libraryData = libraryAssetId ? assetLibraryMap.get(libraryAssetId) : null;

      if (!libraryData) {
        skipped.push({ refId, reason: "not_linked_to_library" });
        continue;
      }

      // 如果 description 为空，使用资产名称作为基础描述
      let description = libraryData.description?.trim();
      if (!description) {
        const assetName = libraryData.name.trim();
        if (assetName) {
          description = assetName;
          fallbackDescriptions.push({ refId, name: assetName });
          this.logger.log(
            `资产 ${refId} 描述为空，使用名称 "${assetName}" 作为基础描述`,
          );
        } else {
          skipped.push({ refId, reason: "description_empty" });
          continue;
        }
      }

      const prompt = buildScriptAssetImagePrompt(
        libraryData.name,
        description,
        assetKind,
        undefined,
        {
          gender: libraryData.gender ?? undefined,
          age: libraryData.age ?? undefined,
        },
      );

      // Phase 4：从素材库图片表获取参考图
      const referenceImages = await this.getAssetReferenceImages(
        assetKind,
        asset,
      );

      const task = this.aiTaskRepository.create({
        scriptId,
        type: AITaskType.GENERATE,
        status: AITaskStatus.PENDING,
        config: {
          assetType: "image",
          assetId: refId,
          scriptId,
          modelId: dto.modelId,
          prompt,
          negativePrompt: dto.negativePrompt,
          aspectRatio: dto.aspectRatio,
          type: "main",
          referenceImages,
        },
        createdBy: userId,
      });

      const savedTask = await this.aiTaskRepository.save(task);
      tasks.push({ refId, taskId: savedTask.id, status: "pending" });

      // 预先存储订阅关系，确保 Worker 推送消息时前端已订阅
      await this.webSocketService.subscribeToTask(userId, savedTask.id);

      // 添加到队列执行
      await this.scriptAIGenerateQueue.add(
        savedTask.id,
        {
          taskId: savedTask.id,
          type: AITaskType.GENERATE,
          requestData: {
            assetType: "image",
            assetId: refId,
            scriptId,
            modelId: dto.modelId,
            prompt,
            negativePrompt: dto.negativePrompt,
            aspectRatio: dto.aspectRatio,
            type: "main",
            referenceImages,
          },
          modelId: dto.modelId,
        },
        {
          jobId: savedTask.id,
          priority: 30,
        },
      );

      // 发送 WebSocket 通知
      await this.webSocketService.broadcastTaskProgress(savedTask.id, {
        type: "asset:image-progress",
        taskId: savedTask.id,
        scriptId,
        refId,
        status: "pending",
        progress: 0,
        timestamp: new Date().toISOString(),
      });
    }

    this.logger.log(
      `批量${assetKind}图片生成任务创建: scriptId=${scriptId}, started=${tasks.length}, skipped=${skipped.length}, fallbackDescriptions=${fallbackDescriptions.length}`,
    );

    return {
      tasks,
      skipped,
      fallbackDescriptions,
      total: assets.length,
      started: tasks.length,
    };
  }

  /**
   * 查询资产最新图片生成任务状态（WebSocket 断线降级轮询）
   */
  async getLatestImageTask(
    userId: string,
    projectId: string,
    scriptId: string,
    refId: string,
    assetType: "character" | "scene" | "prop",
  ): Promise<{
    taskId: string;
    refId: string;
    status: string;
    progress: number | null;
    createdAt: string;
    updatedAt: string;
    result: {
      imageId: string;
      url: string;
      thumbnailUrl: string | null;
    } | null;
  } | null> {
    const script = await this.scriptRepository.findOne({
      where: { id: scriptId, projectId, deletedAt: IsNull() },
    });
    if (!script) throw new NotFoundException("剧本不存在");

    // 验证 refId 存在于剧本（支持角色/场景/道具/分镜）
    const content = script.content as Record<string, unknown>;
    const keyMap: Record<string, string> = {
      character: "characters",
      scene: "scenes",
      prop: "props",
    };
    const arr =
      (content[keyMap[assetType]] as Array<Record<string, unknown>>) ?? [];
    const foundInAsset = arr.find((item) => item.id === refId);
    if (!foundInAsset) {
      // 也检查分镜组（storyboard/shotGroup ID 可能被传入）
      // 注意：分镜组数据可能存储在 storyboards 或 shotGroups 字段（迁移过渡期）
      const storyboardArr =
        (content.storyboards as Array<Record<string, unknown>>) ?? [];
      const shotGroupArr =
        (content.shotGroups as Array<Record<string, unknown>>) ?? [];
      const foundInStoryboard =
        storyboardArr.find((item) => item.id === refId) ??
        shotGroupArr.find((item) => item.id === refId);
      if (!foundInStoryboard) {
        throw new UnprocessableEntityException({
          code: 1354,
          message: "refId 在剧本中不存在",
        });
      }
    }

    // 查找最新的图片任务（使用 JSONB 操作符按 refId 和 assetType 筛选）
    const task = await this.aiTaskRepository
      .createQueryBuilder("task")
      .where("task.scriptId = :scriptId", { scriptId })
      .andWhere("task.config->>'assetId' = :refId", { refId })
      .andWhere("task.config->>'assetType' = 'image'")
      .orderBy("task.createdAt", "DESC")
      .getOne();

    if (!task) return null;

    const taskResult = task.result as Record<string, unknown> | null;
    return {
      taskId: task.id,
      refId,
      status: task.status,
      progress: task.progress ?? null,
      createdAt: task.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt:
        (task.completedAt ?? task.startedAt ?? task.createdAt)?.toISOString() ??
        new Date().toISOString(),
      result: taskResult
        ? {
            imageId: taskResult.imageId as string,
            url: taskResult.url as string,
            thumbnailUrl: (taskResult.thumbnailUrl as string | null) ?? null,
          }
        : null,
    };
  }

  /**
   * 生成资产图片（旧接口保留，内部调用角色图片生成）
   * @deprecated 使用 generateCharacterImage 替代
   */
  async generateAssetImage(
    userId: string,
    projectId: string,
    scriptId: string,
    assetId: string,
    dto: GenerateAssetImageDto,
  ): Promise<{ taskId: string; status: string; estimatedTime: number }> {
    const script = await this.checkScriptEditable(scriptId, userId);

    if (script.projectId !== projectId) {
      throw new NotFoundException("剧本不存在");
    }

    // 查找资产
    const content = script.content as Record<string, unknown>;
    const asset = this.findAsset(content, assetId);

    if (!asset) {
      throw new NotFoundException("资产不存在");
    }

    // 创建图片生成任务
    const task = this.aiTaskRepository.create({
      scriptId,
      type: AITaskType.GENERATE,
      status: AITaskStatus.PENDING,
      config: {
        assetType: "image",
        assetId,
        modelId: dto.modelId,
        prompt: dto.prompt,
        negativePrompt: dto.negativePrompt,
        type: dto.type,
        angleIndex: dto.angleIndex,
      },
      createdBy: userId,
    });

    const savedTask = await this.aiTaskRepository.save(task);

    return {
      taskId: savedTask.id,
      status: "pending",
      estimatedTime: 20,
    };
  }

  /**
   * 上传资产图片
   * Phase 4：不再写入 script.content，只同步到素材库图片表
   */
  async uploadAssetImage(
    userId: string,
    projectId: string,
    scriptId: string,
    assetId: string,
    dto: { url: string; thumbnailUrl?: string; type?: string },
  ): Promise<AssetImageResponse> {
    const script = await this.checkScriptEditable(scriptId, userId);

    if (script.projectId !== projectId) {
      throw new NotFoundException("剧本不存在");
    }

    // 查找资产，提取素材库 ID
    const content = script.content as Record<string, unknown>;
    const asset = this.findAsset(content, assetId);

    if (!asset) {
      throw new NotFoundException("资产不存在");
    }

    const characterId = asset.characterId as string | undefined;
    const sceneId = asset.sceneId as string | undefined;
    const propId = asset.propId as string | undefined;

    if (!characterId && !sceneId && !propId) {
      throw new NotFoundException("资产未关联到素材库，无法上传图片");
    }

    // 创建图片记录
    const imageId = randomUUID();
    const image: AssetImageResponse = {
      id: imageId,
      url: dto.url,
      thumbnailUrl: dto.thumbnailUrl,
      type: (dto.type as "main" | "angle" | "reference") || "reference",
      createdAt: new Date().toISOString(),
    };

    // 同步到素材库图片表（唯一持久化位置）
    await this.syncImageToLibrary(projectId, asset, image, dto);

    return image;
  }

  /**
   * 同步图片到素材库图片表
   * Phase 4 修复：剧本编辑上传的图片同步到素材库，确保刷新后可见
   */
  private async syncImageToLibrary(
    projectId: string,
    asset: Record<string, unknown>,
    image: AssetImageResponse,
    dto: { url: string; thumbnailUrl?: string; type?: string },
  ): Promise<void> {
    // 确定资产类型和素材库 ID
    const characterId = asset.characterId as string | undefined;
    const sceneId = asset.sceneId as string | undefined;
    const propId = asset.propId as string | undefined;

    // 构建上传信息
    const uploadInfo = {
      originalFilename: `uploaded_${image.id}`,
      fileSize: 0,
      mimeType: "image/jpeg",
      uploadedAt: image.createdAt,
    };

    if (characterId) {
      // 角色图片同步
      const imageType = this.mapImageTypeToCharacterType(dto.type);
      await this.saveCharacterImage(characterId, projectId, image, imageType, uploadInfo);
      this.logger.log(`同步角色图片到素材库: characterId=${characterId}, type=${imageType}`);
    } else if (sceneId) {
      // 场景图片同步
      const imageType = this.mapImageTypeToSceneType(dto.type);
      await this.saveSceneImage(sceneId, projectId, image, imageType, uploadInfo);
      this.logger.log(`同步场景图片到素材库: sceneId=${sceneId}, type=${imageType}`);
    } else if (propId) {
      // 道具图片同步
      const imageType = this.mapImageTypeToPropType(dto.type);
      await this.savePropImage(propId, projectId, image, imageType, uploadInfo);
      this.logger.log(`同步道具图片到素材库: propId=${propId}, type=${imageType}`);
    } else {
      throw new NotFoundException("资产未关联到素材库，无法同步图片");
    }
  }

  /**
   * 映射图片类型到角色图片类型
   */
  private mapImageTypeToCharacterType(type: string | undefined): CharacterImageTypeType {
    switch (type) {
      case "main":
        return CharacterImageType.FRONT_VIEW;
      case "reference":
        return CharacterImageType.ADDITIONAL;
      default:
        return CharacterImageType.ADDITIONAL;
    }
  }

  /**
   * 映射图片类型到场景图片类型
   * SceneImage 没有 additional 类型，使用 detail 作为参考图存储
   */
  private mapImageTypeToSceneType(type: string | undefined): SceneImageTypeType {
    switch (type) {
      case "main":
        return SceneImageType.PANORAMA;
      case "reference":
        return SceneImageType.DETAIL;
      default:
        return SceneImageType.DETAIL;
    }
  }

  /**
   * 映射图片类型到道具图片类型
   */
  private mapImageTypeToPropType(type: string | undefined): PropImageTypeType {
    switch (type) {
      case "main":
        return PropImageType.FRONT_VIEW;
      case "reference":
        return PropImageType.ADDITIONAL;
      default:
        return PropImageType.ADDITIONAL;
    }
  }

  /**
   * 保存角色图片到素材库
   */
  private async saveCharacterImage(
    characterId: string,
    projectId: string,
    image: AssetImageResponse,
    type: CharacterImageTypeType,
    uploadInfo: { originalFilename: string; fileSize: number; mimeType: string; uploadedAt: string },
  ): Promise<void> {
    // 验证角色存在
    const character = await this.characterRepository.findOne({
      where: { id: characterId, projectId, deletedAt: IsNull() },
    });
    if (!character) {
      throw new NotFoundException(`角色不存在: ${characterId}`);
    }

    // 非 additional 类型时，清理旧版本的物理文件和数据库记录
    if (type !== CharacterImageType.ADDITIONAL) {
      const oldImages = await this.characterImageRepository.find({
        where: { characterId, type, isCurrent: true },
      });
      for (const oldImage of oldImages) {
        const key = this.extractStorageKey(oldImage.url);
        if (key) {
          try {
            await this.ossService.deleteFile(key);
          } catch (e) {
            this.logger.warn(`删除旧图片失败: ${(e as Error).message}`);
          }
        }
        await this.characterImageRepository.remove(oldImage);
      }
    }

    // 计算版本号
    const lastImage = await this.characterImageRepository.findOne({
      where: { characterId, type },
      order: { version: "DESC" },
    });
    const newVersion = (lastImage?.version ?? 0) + 1;

    // 创建图片记录
    const characterImage = this.characterImageRepository.create({
      id: image.id,
      characterId,
      type,
      url: image.url,
      thumbnailUrl: image.thumbnailUrl ?? null,
      uploadInfo,
      version: newVersion,
      isCurrent: true,
    });

    await this.characterImageRepository.save(characterImage);
  }

  /**
   * 保存场景图片到素材库
   */
  private async saveSceneImage(
    sceneId: string,
    projectId: string,
    image: AssetImageResponse,
    type: SceneImageTypeType,
    uploadInfo: { originalFilename: string; fileSize: number; mimeType: string; uploadedAt: string },
  ): Promise<void> {
    // 验证场景存在
    const scene = await this.sceneRepository.findOne({
      where: { id: sceneId, projectId, deletedAt: IsNull() },
    });
    if (!scene) {
      throw new NotFoundException(`场景不存在: ${sceneId}`);
    }

    // PANORAMA/WIDE_SHOT 类型时，清理旧版本的物理文件和数据库记录
    // DETAIL 类型可以有多个，不需要清除旧版本
    if (type === SceneImageType.PANORAMA || type === SceneImageType.WIDE_SHOT) {
      const oldImages = await this.sceneImageRepository.find({
        where: { sceneId, type, isCurrent: true },
      });
      for (const oldImage of oldImages) {
        const key = this.extractStorageKey(oldImage.url);
        if (key) {
          try {
            await this.ossService.deleteFile(key);
          } catch (e) {
            this.logger.warn(`删除旧图片失败: ${(e as Error).message}`);
          }
        }
        await this.sceneImageRepository.remove(oldImage);
      }
    }

    // 计算版本号
    const lastImage = await this.sceneImageRepository.findOne({
      where: { sceneId, type },
      order: { version: "DESC" },
    });
    const newVersion = (lastImage?.version ?? 0) + 1;

    // 创建图片记录
    const sceneImage = this.sceneImageRepository.create({
      id: image.id,
      sceneId,
      type,
      url: image.url,
      thumbnailUrl: image.thumbnailUrl ?? null,
      uploadInfo,
      version: newVersion,
      isCurrent: true,
    });

    await this.sceneImageRepository.save(sceneImage);
  }

  /**
   * 保存道具图片到素材库
   */
  private async savePropImage(
    propId: string,
    projectId: string,
    image: AssetImageResponse,
    type: PropImageTypeType,
    uploadInfo: { originalFilename: string; fileSize: number; mimeType: string; uploadedAt: string },
  ): Promise<void> {
    // 验证道具存在
    const prop = await this.propRepository.findOne({
      where: { id: propId, projectId, deletedAt: IsNull() },
    });
    if (!prop) {
      throw new NotFoundException(`道具不存在: ${propId}`);
    }

    // 非 additional 类型时，清理旧版本的物理文件和数据库记录
    if (type !== PropImageType.ADDITIONAL) {
      const oldImages = await this.propImageRepository.find({
        where: { propId, type, isCurrent: true },
      });
      for (const oldImage of oldImages) {
        const key = this.extractStorageKey(oldImage.url);
        if (key) {
          try {
            await this.ossService.deleteFile(key);
          } catch (e) {
            this.logger.warn(`删除旧图片失败: ${(e as Error).message}`);
          }
        }
        await this.propImageRepository.remove(oldImage);
      }
    }

    // 计算版本号
    const lastImage = await this.propImageRepository.findOne({
      where: { propId, type },
      order: { version: "DESC" },
    });
    const newVersion = (lastImage?.version ?? 0) + 1;

    // 创建图片记录
    const propImage = this.propImageRepository.create({
      id: image.id,
      propId,
      type,
      url: image.url,
      thumbnailUrl: image.thumbnailUrl ?? null,
      uploadInfo,
      version: newVersion,
      isCurrent: true,
    });

    await this.propImageRepository.save(propImage);
  }

  /**
   * 从 URL 提取 storage key
   * 支持 /static/image/xxx.jpg → image/xxx.jpg
   */
  private extractStorageKey(url: string): string | null {
    if (!url) return null;
    if (url.startsWith("/static/")) {
      return url.slice(8); // 去掉 /static/ 前缀
    }
    // 兜底：如果是完整 URL，取 pathname 后再处理
    try {
      const parsed = new URL(url);
      const pathname = parsed.pathname;
      return pathname.startsWith("/static/")
        ? pathname.slice(8)
        : pathname.startsWith("/")
          ? pathname.slice(1)
          : pathname;
    } catch {
      return null;
    }
  }

  /**
   * 删除资产图片
   * Phase 4：不再读写 content 中的 images，直接从素材库表查询并删除
   */
  async deleteAssetImage(
    userId: string,
    projectId: string,
    scriptId: string,
    assetId: string,
    imageId: string,
  ): Promise<{ success: boolean }> {
    const lockKey = `script:content:${scriptId}`;

    return this.redlockService.withLock(lockKey, 10000, async () => {
      const script = await this.checkScriptEditable(scriptId, userId);

      if (script.projectId !== projectId) {
        throw new NotFoundException("剧本不存在");
      }

      // 查找资产，提取素材库 ID
      const content = script.content as Record<string, unknown>;
      const asset = this.findAsset(content, assetId);

      if (!asset) {
        throw new NotFoundException("资产不存在");
      }

      const characterId = asset.characterId as string | undefined;
      const sceneId = asset.sceneId as string | undefined;
      const propId = asset.propId as string | undefined;

      // 根据类型从素材库表查询图片
      let imageRecord: CharacterImage | SceneImage | PropImage | null = null;

      if (characterId) {
        imageRecord = await this.characterImageRepository.findOne({
          where: { id: imageId, characterId },
        });
      } else if (sceneId) {
        imageRecord = await this.sceneImageRepository.findOne({
          where: { id: imageId, sceneId },
        });
      } else if (propId) {
        imageRecord = await this.propImageRepository.findOne({
          where: { id: imageId, propId },
        });
      }

      if (!imageRecord) {
        throw new NotFoundException("图片不存在");
      }

      // 删除文件
      const key = this.extractStorageKey(imageRecord.url);
      if (key) {
        try {
          await this.ossService.deleteFile(key);
        } catch (e) {
          this.logger.warn(`删除文件失败: ${(e as Error).message}`);
        }
      }

      // 删除 DB 记录
      if (characterId) {
        await this.characterImageRepository.remove(
          imageRecord as CharacterImage,
        );
      } else if (sceneId) {
        await this.sceneImageRepository.remove(imageRecord as SceneImage);
      } else if (propId) {
        await this.propImageRepository.remove(imageRecord as PropImage);
      }

      return { success: true };
    });
  }

  /**
   * 清理旧的图片生成任务和关联的图片资源
   * 在重新生成图片前调用，避免数据库和 OSS 垃圾数据
   */
  private async cleanupOldImageTasks(
    scriptId: string,
    refId: string,
    content: Record<string, unknown>,
    storyboard: Record<string, unknown> | undefined,
  ): Promise<void> {
    try {
      // 1. 查找该 refId 的所有历史图片生成任务
      const oldTasks = await this.aiTaskRepository
        .createQueryBuilder("task")
        .where("task.scriptId = :scriptId", { scriptId })
        .andWhere("task.config->>'assetId' = :refId", { refId })
        .andWhere("task.config->>'assetType' = 'image'")
        .getMany();

      if (oldTasks.length === 0) {
        return;
      }

      this.logger.log(`清理 ${refId} 的 ${oldTasks.length} 个历史图片生成任务`);

      // 2. 处理每个旧任务
      for (const oldTask of oldTasks) {
        // 如果任务还在进行中（pending/processing），尝试从队列中移除
        if (
          oldTask.status === AITaskStatus.PENDING ||
          oldTask.status === AITaskStatus.PROCESSING
        ) {
          try {
            const job = await this.scriptAIGenerateQueue.getJob(oldTask.id);
            if (job) {
              await job.remove();
              this.logger.log(`已从队列移除旧任务: ${oldTask.id}`);
            }
          } catch (e) {
            this.logger.warn(`移除队列任务失败: ${(e as Error).message}`);
          }
        }

        // 3. 删除任务关联的旧图片（支持本地存储相对路径和 OSS 完整 URL）
        const taskResult = oldTask.result as Record<string, unknown> | null;
        if (taskResult?.url) {
          try {
            const urlStr = taskResult.url as string;
            let ossKey: string;
            if (urlStr.startsWith("/")) {
              // 本地存储相对路径，去掉前导斜杠
              ossKey = urlStr.slice(1);
            } else {
              // OSS 完整 URL
              const url = new URL(urlStr);
              ossKey = url.pathname.startsWith("/")
                ? url.pathname.slice(1)
                : url.pathname;
            }
            if (ossKey) {
              await this.ossService.deleteFile(ossKey);
              this.logger.log(`已删除旧图片: ${ossKey}`);
            }
          } catch (e) {
            this.logger.warn(`删除旧图片失败: ${(e as Error).message}`);
          }
        }
      }

      // 4. 删除旧任务记录
      const oldTaskIds = oldTasks.map((t) => t.id);
      await this.aiTaskRepository.delete(oldTaskIds);
      this.logger.log(`已删除 ${oldTaskIds.length} 个旧任务记录`);

      // 5. 清理剧本 content 中的旧图片记录（只保留参考图）
      if (storyboard) {
        // 分镜图片清理
        // 注意：分镜组数据可能存储在 storyboards 或 shotGroups 字段（迁移过渡期）
        const storyboards =
          (content.storyboards as Array<Record<string, unknown>>) || [];
        const shotGroups =
          (content.shotGroups as Array<Record<string, unknown>>) || [];

        // 先尝试在 storyboards 中查找
        let sbIdx = storyboards.findIndex((sb) => sb.id === refId);
        if (sbIdx !== -1) {
          const existingImgs =
            (storyboards[sbIdx].images as Array<Record<string, unknown>>) || [];
          const keepRefImgs = existingImgs.filter(
            (img) => (img as { type?: string }).type === "reference",
          );
          if (existingImgs.length !== keepRefImgs.length) {
            storyboards[sbIdx].images = keepRefImgs;
            storyboards[sbIdx].mainImageId = undefined;
            content.storyboards = storyboards;
            this.logger.log(`已清理分镜 ${refId} 的旧图片记录`);
          }
        }

        // 再尝试在 shotGroups 中查找
        const sgIdx = shotGroups.findIndex((sg) => sg.id === refId);
        if (sgIdx !== -1) {
          const existingImgs =
            (shotGroups[sgIdx].images as Array<Record<string, unknown>>) || [];
          const keepRefImgs = existingImgs.filter(
            (img) => (img as { type?: string }).type === "reference",
          );
          if (existingImgs.length !== keepRefImgs.length) {
            shotGroups[sgIdx].images = keepRefImgs;
            shotGroups[sgIdx].mainImageId = undefined;
            content.shotGroups = shotGroups;
            this.logger.log(`已清理分镜组 ${refId} 的旧图片记录`);
          }

          // Bug-5 修复：重新生成图片时清除框选数据
          // 因为新图片中人物位置可能变化，旧的框选配置不再有效
          shotGroups[sgIdx].characterRegions = {};
          shotGroups[sgIdx].detectedSubjects = [];
          shotGroups[sgIdx].detectionStatus = "pending";
          shotGroups[sgIdx].mainImageKey = undefined;
          content.shotGroups = shotGroups;
          this.logger.log(`已清除分镜组 ${refId} 的框选数据（characterRegions, detectedSubjects, detectionStatus）`);
        }
      } else {
        // 角色/场景/道具图片清理
        const assetArrayKeys: Array<"characters" | "scenes" | "props"> = [
          "characters",
          "scenes",
          "props",
        ];
        for (const key of assetArrayKeys) {
          const arr = (content[key] as Array<Record<string, unknown>>) || [];
          const idx = arr.findIndex((item) => item.id === refId);
          if (idx !== -1) {
            const existingImgs =
              (arr[idx].images as Array<Record<string, unknown>>) || [];
            const keepRefImgs = existingImgs.filter(
              (img) => (img as { type?: string }).type === "reference",
            );
            if (existingImgs.length !== keepRefImgs.length) {
              arr[idx].images = keepRefImgs;
              arr[idx].mainImageId = undefined;
              arr[idx].assetStatus = "will_create";
              content[key] = arr;
              this.logger.log(`已清理资产 ${refId} 的旧图片记录`);
            }
            break;
          }
        }
      }
    } catch (error) {
      // 清理失败不应阻断主流程，只记录日志
      this.logger.warn(`清理旧图片任务失败: ${(error as Error).message}`);
    }
  }

  // ==================== 辅助方法 ====================

  /**
   * 获取资产数组的key
   */
  private getAssetsKey(assetType: string): "characters" | "scenes" | "props" {
    switch (assetType) {
      case "character":
        return "characters";
      case "scene":
        return "scenes";
      case "prop":
        return "props";
      default:
        throw new BadRequestException("无效的资产类型");
    }
  }

  /**
   * 从素材库图片表获取资产的参考图 URL 列表
   * 角色/道具取 additional 类型，场景取 detail 类型
   */
  private async getAssetReferenceImages(
    assetKind: "character" | "scene" | "prop",
    asset: Record<string, unknown>,
  ): Promise<string[]> {
    if (assetKind === "character") {
      const characterId = asset.characterId as string | undefined;
      if (characterId) {
        const images = await this.characterImageRepository.find({
          where: { characterId, type: "additional", isCurrent: true },
        });
        return images.map((img) => img.url).filter(Boolean);
      }
    } else if (assetKind === "scene") {
      const sceneId = asset.sceneId as string | undefined;
      if (sceneId) {
        const images = await this.sceneImageRepository.find({
          where: { sceneId, type: "detail", isCurrent: true },
        });
        return images.map((img) => img.url).filter(Boolean);
      }
    } else if (assetKind === "prop") {
      const propId = asset.propId as string | undefined;
      if (propId) {
        const images = await this.propImageRepository.find({
          where: { propId, type: "additional", isCurrent: true },
        });
        return images.map((img) => img.url).filter(Boolean);
      }
    }
    return [];
  }

  /**
   * 在content中查找资产（支持角色/场景/道具/分镜/分镜组）
   */
  private findAsset(
    content: Record<string, unknown>,
    assetId: string,
  ): Record<string, unknown> | null {
    const assetTypes: Array<
      "characters" | "scenes" | "props" | "storyboards" | "shotGroups"
    > = ["characters", "scenes", "props", "storyboards", "shotGroups"];

    for (const assetType of assetTypes) {
      const assets =
        (content[assetType] as Array<Record<string, unknown>>) || [];
      const asset = assets.find((a) => a.id === assetId);
      if (asset) return asset;
    }

    return null;
  }

  /**
   * 更新content中的资产（支持角色/场景/道具/分镜/分镜组）
   */
  private updateAssetInContent(
    content: Record<string, unknown>,
    assetId: string,
    updatedAsset: Record<string, unknown>,
  ): void {
    const assetTypes: Array<
      "characters" | "scenes" | "props" | "storyboards" | "shotGroups"
    > = ["characters", "scenes", "props", "storyboards", "shotGroups"];

    for (const assetType of assetTypes) {
      const assets =
        (content[assetType] as Array<Record<string, unknown>>) || [];
      const index = assets.findIndex((a) => a.id === assetId);
      if (index !== -1) {
        assets[index] = updatedAsset;
        content[assetType] = assets;
        return;
      }
    }
  }

  /**
   * 映射资产到响应格式
   */
  private mapToAssetResponse(
    asset: Record<string, unknown>,
    assetType: string,
  ): AssetResponse {
    return {
      id: asset.id as string,
      name: asset.name as string,
      description: asset.description as string | undefined,
      assetType: assetType as "character" | "scene" | "prop",
      assetStatus: (asset.assetStatus as AssetStatus) || "none",
      images: (asset.images as AssetImageResponse[]) || [],
      mainImageId: asset.mainImageId as string | undefined,
      updatedAt: new Date().toISOString(),
    };
  }

  // ==================== 资产导入关联 ====================

  /**
   * 创建资产到资产库并关联到剧本
   * 用于"新建资产"功能：先创建资产到项目资产库，再关联引用到剧本
   */
  async createAndLinkAsset(
    userId: string,
    projectId: string,
    scriptId: string,
    dto: CreateAndLinkAssetDto,
  ): Promise<CreateAndLinkAssetResponse> {
    const lockKey = `script:content:${scriptId}`;

    return this.redlockService.withLock(lockKey, 10000, async () => {
      const script = await this.checkScriptEditable(scriptId, userId);

      if (script.projectId !== projectId) {
        throw new NotFoundException("剧本不存在");
      }

      const content = script.content as Record<string, unknown>;
      const refId = randomUUID();
      const assetId = randomUUID();

      // 根据资产类型创建资产并关联
      let assetName: string;
      let assetDescription: string | null;

      if (dto.assetType === AssetType.CHARACTER) {
        // 创建角色资产
        const character = this.characterRepository.create({
          id: assetId,
          projectId,
          name: dto.name,
          description: dto.description || null,
          gender: (dto.gender as CharacterGenderType) || null,
          age: dto.age || null,
          importance: "minor", // 默认为次要角色
          status: "draft",
          createdBy: userId,
        });
        await this.characterRepository.save(character);
        assetName = character.name;
        assetDescription = character.description;

        // Phase 4：创建角色引用（不再存储兼容字段和图片）
        const characterRef = {
          id: refId,
          characterId: assetId,
          importance: "minor",
          assetStatus: AssetStatus.IMPORTED,
        };

        const characters =
          (content.characters as Array<Record<string, unknown>>) || [];
        characters.push(characterRef);
        content.characters = characters;
      } else if (dto.assetType === AssetType.SCENE) {
        // 创建场景资产
        const scene = this.sceneRepository.create({
          id: assetId,
          projectId,
          name: dto.name,
          description: dto.description || null,
          type: "interior", // 默认为内景
          status: "draft",
          createdBy: userId,
        });
        await this.sceneRepository.save(scene);
        assetName = scene.name;
        assetDescription = scene.description;

        // Phase 4：创建场景引用（不再存储兼容字段和图片）
        const sceneRef = {
          id: refId,
          sceneId: assetId,
          assetStatus: AssetStatus.IMPORTED,
        };

        const scenes = (content.scenes as Array<Record<string, unknown>>) || [];
        scenes.push(sceneRef);
        content.scenes = scenes;
      } else if (dto.assetType === AssetType.PROP) {
        // 创建道具资产
        const prop = this.propRepository.create({
          id: assetId,
          projectId,
          name: dto.name,
          description: dto.description || null,
          importance: "background", // 默认为背景道具
          status: "draft",
          createdBy: userId,
        });
        await this.propRepository.save(prop);
        assetName = prop.name;
        assetDescription = prop.description;

        // Phase 4：创建道具引用（不再存储兼容字段和图片）
        const propRef = {
          id: refId,
          propId: assetId,
          assetStatus: AssetStatus.IMPORTED,
        };

        const props = (content.props as Array<Record<string, unknown>>) || [];
        props.push(propRef);
        content.props = props;
      } else {
        throw new BadRequestException("无效的资产类型");
      }

      // 保存剧本更新
      script.content = content;
      try {
        await this.scriptRepository.save(script);
      } catch (error) {
        if (error instanceof OptimisticLockVersionMismatchError) {
          throw new ConflictException("资产关联冲突，请刷新后重试");
        }
        throw error;
      }

      this.logger.log(
        `创建资产并关联: assetType=${dto.assetType}, assetId=${assetId}, refId=${refId}`,
      );

      return {
        refId,
        assetId,
        name: assetName,
        assetStatus: AssetStatus.IMPORTED,
      };
    });
  }

  /**
   * 批量关联已有资产到剧本
   * 用于"从项目导入"功能：从项目资产库选择已有资产，批量关联引用到剧本
   */
  async linkExistingAssets(
    userId: string,
    projectId: string,
    scriptId: string,
    dto: LinkExistingAssetsDto,
  ): Promise<LinkExistingAssetsResponse> {
    const lockKey = `script:content:${scriptId}`;

    return this.redlockService.withLock(lockKey, 10000, async () => {
      const script = await this.checkScriptEditable(scriptId, userId);

      if (script.projectId !== projectId) {
        throw new NotFoundException("剧本不存在");
      }

      const content = script.content as Record<string, unknown>;
      const refs: LinkedAssetRefItem[] = [];
      const skipped: SkippedAssetItem[] = [];

      if (dto.assetType === AssetType.CHARACTER) {
        // 获取当前剧本中已关联的角色 ID
        const characters =
          (content.characters as Array<Record<string, unknown>>) || [];
        const linkedCharacterIds = new Set(
          characters
            .map((c) => c.characterId as string)
            .filter(Boolean),
        );

        // 查询要关联的角色资产
        const assetsToLink = await this.characterRepository.find({
          where: {
            id: In(dto.assetIds),
            projectId,
            deletedAt: IsNull(),
          },
        });

        for (const assetId of dto.assetIds) {
          // 检查资产是否存在
          const asset = assetsToLink.find((a) => a.id === assetId);
          if (!asset) {
            continue; // 资产不存在，跳过
          }

          // 检查是否已关联
          if (linkedCharacterIds.has(assetId)) {
            skipped.push({
              assetId,
              name: asset.name,
              reason: "already_linked",
            });
            continue;
          }

          // Phase 4：创建角色引用（不再存储兼容字段和图片）
          const refId = randomUUID();
          const characterRef = {
            id: refId,
            characterId: assetId,
            importance: asset.importance || "minor",
            assetStatus: AssetStatus.IMPORTED,
          };

          characters.push(characterRef);
          refs.push({
            refId,
            assetId,
            name: asset.name,
            assetStatus: AssetStatus.IMPORTED,
          });
        }

        content.characters = characters;
      } else if (dto.assetType === AssetType.SCENE) {
        // 获取当前剧本中已关联的场景 ID
        const scenes = (content.scenes as Array<Record<string, unknown>>) || [];
        const linkedSceneIds = new Set(
          scenes
            .map((s) => s.sceneId as string)
            .filter(Boolean),
        );

        // 查询要关联的场景资产
        const assetsToLink = await this.sceneRepository.find({
          where: {
            id: In(dto.assetIds),
            projectId,
            deletedAt: IsNull(),
          },
        });

        for (const assetId of dto.assetIds) {
          // 检查资产是否存在
          const asset = assetsToLink.find((a) => a.id === assetId);
          if (!asset) {
            continue; // 资产不存在，跳过
          }

          // 检查是否已关联
          if (linkedSceneIds.has(assetId)) {
            skipped.push({
              assetId,
              name: asset.name,
              reason: "already_linked",
            });
            continue;
          }

          // Phase 4：创建场景引用（不再存储兼容字段和图片）
          const refId = randomUUID();
          const sceneRef = {
            id: refId,
            sceneId: assetId,
            assetStatus: AssetStatus.IMPORTED,
          };

          scenes.push(sceneRef);
          refs.push({
            refId,
            assetId,
            name: asset.name,
            assetStatus: AssetStatus.IMPORTED,
          });
        }

        content.scenes = scenes;
      } else if (dto.assetType === AssetType.PROP) {
        // 获取当前剧本中已关联的道具 ID
        const props = (content.props as Array<Record<string, unknown>>) || [];
        const linkedPropIds = new Set(
          props
            .map((p) => p.propId as string)
            .filter(Boolean),
        );

        // 查询要关联的道具资产
        const assetsToLink = await this.propRepository.find({
          where: {
            id: In(dto.assetIds),
            projectId,
            deletedAt: IsNull(),
          },
        });

        for (const assetId of dto.assetIds) {
          // 检查资产是否存在
          const asset = assetsToLink.find((a) => a.id === assetId);
          if (!asset) {
            continue; // 资产不存在，跳过
          }

          // 检查是否已关联
          if (linkedPropIds.has(assetId)) {
            skipped.push({
              assetId,
              name: asset.name,
              reason: "already_linked",
            });
            continue;
          }

          // Phase 4：创建道具引用（不再存储兼容字段和图片）
          const refId = randomUUID();
          const propRef = {
            id: refId,
            propId: assetId,
            assetStatus: AssetStatus.IMPORTED,
          };

          props.push(propRef);
          refs.push({
            refId,
            assetId,
            name: asset.name,
            assetStatus: AssetStatus.IMPORTED,
          });
        }

        content.props = props;
      } else {
        throw new BadRequestException("无效的资产类型");
      }

      // 保存剧本更新
      script.content = content;
      try {
        await this.scriptRepository.save(script);
      } catch (error) {
        if (error instanceof OptimisticLockVersionMismatchError) {
          throw new ConflictException("资产关联冲突，请刷新后重试");
        }
        throw error;
      }

      this.logger.log(
        `批量关联资产: assetType=${dto.assetType}, linked=${refs.length}, skipped=${skipped.length}`,
      );

      return {
        refs,
        skipped,
      };
    });
  }

  // ==================== 统一数据源：Resolved Assets ====================

  /**
   * 获取剧本关联资产的完整数据（Ref + 素材库 Asset 组合）
   * 用于统一数据源，前端直接从素材库获取完整资产数据
   */
  async resolveAssets(
    userId: string,
    projectId: string,
    scriptId: string,
  ): Promise<ResolvedAssetResponse> {
    // 验证项目访问权限
    await this.checkProjectAccess(userId, projectId);

    // 获取剧本
    const script = await this.scriptRepository.findOne({
      where: { id: scriptId, projectId, deletedAt: IsNull() },
    });

    if (!script) {
      throw new NotFoundException("剧本不存在");
    }

    const content = script.content as Record<string, unknown>;

    // 获取 Ref 数组
    const characterRefs = (content.characters as CharacterRef[]) || [];
    const sceneRefs = (content.scenes as SceneRef[]) || [];
    const propRefs = (content.props as PropRef[]) || [];

    // 收集所有资产 ID
    const characterIds = characterRefs
      .map((ref) => ref.characterId)
      .filter((id): id is string => id !== undefined);
    const sceneIds = sceneRefs
      .map((ref) => ref.sceneId)
      .filter((id): id is string => id !== undefined);
    const propIds = propRefs
      .map((ref) => ref.propId)
      .filter((id): id is string => id !== undefined);

    // 批量查询素材库
    const characters = characterIds.length > 0
      ? await this.characterRepository.find({
          where: { id: In(characterIds), projectId, deletedAt: IsNull() },
          relations: ["images"],
        })
      : [];
    const scenes = sceneIds.length > 0
      ? await this.sceneRepository.find({
          where: { id: In(sceneIds), projectId, deletedAt: IsNull() },
          relations: ["images"],
        })
      : [];
    const props = propIds.length > 0
      ? await this.propRepository.find({
          where: { id: In(propIds), projectId, deletedAt: IsNull() },
          relations: ["images"],
        })
      : [];

    // 构建资产 ID 到资产实体的映射
    const characterMap = new Map(characters.map((c) => [c.id, c]));
    const sceneMap = new Map(scenes.map((s) => [s.id, s]));
    const propMap = new Map(props.map((p) => [p.id, p]));

    // 组合返回
    const resolvedCharacters = characterRefs.map((ref) => ({
      ref,
      asset: ref.characterId ? this.mapCharacterToDto(characterMap.get(ref.characterId)) : null,
    }));

    const resolvedScenes = sceneRefs.map((ref) => ({
      ref,
      asset: ref.sceneId ? this.mapSceneToDto(sceneMap.get(ref.sceneId)) : null,
    }));

    const resolvedProps = propRefs.map((ref) => ({
      ref,
      asset: ref.propId ? this.mapPropToDto(propMap.get(ref.propId)) : null,
    }));

    this.logger.log(
      `获取 resolved assets: scriptId=${scriptId}, characters=${resolvedCharacters.length}, scenes=${resolvedScenes.length}, props=${resolvedProps.length}`,
    );

    return {
      characters: resolvedCharacters,
      scenes: resolvedScenes,
      props: resolvedProps,
    };
  }

  /**
   * 将 Character 实体映射为简化对象（用于 ResolvedAssetResponse）
   */
  private mapCharacterToDto(
    character: Character | undefined,
  ): Record<string, unknown> | null {
    if (!character) return null;

    const images = character.images || [];
    return {
      id: character.id,
      projectId: character.projectId,
      name: character.name,
      description: character.description,
      personality: character.personality,
      age: character.age,
      gender: character.gender,
      occupation: character.occupation,
      background: character.background,
      appearance: character.appearance,
      importance: character.importance,
      status: character.status,
      images: {
        frontView: this.mapCharacterImageToDto(
          images.find((img) => img.type === "front_view" && img.isCurrent),
        ),
        sideView: this.mapCharacterImageToDto(
          images.find((img) => img.type === "side_view" && img.isCurrent),
        ),
        backView: this.mapCharacterImageToDto(
          images.find((img) => img.type === "back_view" && img.isCurrent),
        ),
        angleView: this.mapCharacterImageToDto(
          images.find((img) => img.type === "angle_view" && img.isCurrent),
        ),
        additional: images
          .filter((img) => img.type === "additional" && img.isCurrent)
          .map((img) => this.mapCharacterImageToDto(img)!),
      },
      scriptRef: character.scriptRef,
      importInfo: character.importInfo,
      createdAt: character.createdAt.toISOString(),
      updatedAt: character.updatedAt.toISOString(),
      createdBy: character.createdBy,
    };
  }

  /**
   * 将 CharacterImage 实体映射为简化对象
   */
  private mapCharacterImageToDto(
    image:
      | {
          id: string;
          type: string;
          url: string;
          thumbnailUrl: string | null;
          generationInfo:
            | {
                generationId: string;
                prompt: string;
                negativePrompt?: string;
                modelId: string;
                seed?: number;
                createdAt: string;
              }
            | null;
          uploadInfo:
            | {
                originalFilename: string;
                fileSize: number;
                mimeType: string;
                uploadedAt: string;
              }
            | null;
          version: number;
          isCurrent: boolean;
          createdAt: Date;
          updatedAt: Date;
        }
      | undefined,
  ): Record<string, unknown> | undefined {
    if (!image) return undefined;
    return {
      id: image.id,
      type: image.type,
      url: image.url,
      thumbnailUrl: image.thumbnailUrl,
      generation: image.generationInfo,
      uploadInfo: image.uploadInfo,
      version: image.version,
      isCurrent: image.isCurrent,
      createdAt: image.createdAt.toISOString(),
      updatedAt: image.updatedAt.toISOString(),
    };
  }

  /**
   * 将 Scene 实体映射为简化对象（用于 ResolvedAssetResponse）
   */
  private mapSceneToDto(scene: Scene | undefined): Record<string, unknown> | null {
    if (!scene) return null;

    const images = scene.images || [];
    return {
      id: scene.id,
      projectId: scene.projectId,
      name: scene.name,
      description: scene.description,
      type: scene.type,
      space: scene.space,
      visuals: scene.visuals,
      atmosphere: scene.atmosphere,
      status: scene.status,
      images: {
        panorama: this.mapSceneImageToDto(
          images.find((img) => img.type === "panorama" && img.isCurrent),
        ),
        wideShot: this.mapSceneImageToDto(
          images.find((img) => img.type === "wide_shot" && img.isCurrent),
        ),
        detailShots: images
          .filter((img) => img.type === "detail" && img.isCurrent)
          .map((img) => this.mapSceneImageToDto(img)!),
        variants: {
          timeOfDay: this.groupSceneImagesByVariant(
            images.filter((img) => img.variantType === "time_of_day" && img.isCurrent),
          ),
          weather: this.groupSceneImagesByVariant(
            images.filter((img) => img.variantType === "weather" && img.isCurrent),
          ),
        },
      },
      scriptRef: scene.scriptRef,
      importInfo: scene.importInfo,
      createdAt: scene.createdAt.toISOString(),
      updatedAt: scene.updatedAt.toISOString(),
      createdBy: scene.createdBy,
    };
  }

  /**
   * 将 SceneImage 实体映射为简化对象
   */
  private mapSceneImageToDto(
    image:
      | {
          id: string;
          type: string;
          variantType: string | null;
          variantValue: string | null;
          url: string;
          thumbnailUrl: string | null;
          generationInfo:
            | {
                generationId: string;
                prompt: string;
                negativePrompt?: string;
                modelId: string;
                seed?: number;
                createdAt: string;
              }
            | null;
          uploadInfo:
            | {
                originalFilename: string;
                fileSize: number;
                mimeType: string;
                uploadedAt: string;
              }
            | null;
          version: number;
          isCurrent: boolean;
          createdAt: Date;
          updatedAt: Date;
        }
      | undefined,
  ): Record<string, unknown> | undefined {
    if (!image) return undefined;
    return {
      id: image.id,
      type: image.type,
      variantType: image.variantType,
      variantValue: image.variantValue,
      url: image.url,
      thumbnailUrl: image.thumbnailUrl,
      generation: image.generationInfo,
      uploadInfo: image.uploadInfo,
      version: image.version,
      isCurrent: image.isCurrent,
      createdAt: image.createdAt.toISOString(),
      updatedAt: image.updatedAt.toISOString(),
    };
  }

  /**
   * 将场景图片按变体值分组
   */
  private groupSceneImagesByVariant(
    images: Array<{
      id: string;
      type: string;
      variantType: string | null;
      variantValue: string | null;
      url: string;
      thumbnailUrl: string | null;
      generationInfo:
        | {
            generationId: string;
            prompt: string;
            negativePrompt?: string;
            modelId: string;
            seed?: number;
            createdAt: string;
          }
        | null;
      uploadInfo:
        | {
            originalFilename: string;
            fileSize: number;
            mimeType: string;
            uploadedAt: string;
          }
        | null;
      version: number;
      isCurrent: boolean;
      createdAt: Date;
      updatedAt: Date;
    }>,
  ): Record<string, Record<string, unknown>> {
    const result: Record<string, Record<string, unknown>> = {};
    for (const img of images) {
      if (img.variantValue) {
        result[img.variantValue] = this.mapSceneImageToDto(img)!;
      }
    }
    return result;
  }

  /**
   * 将 Prop 实体映射为简化对象（用于 ResolvedAssetResponse）
   */
  private mapPropToDto(prop: Prop | undefined): Record<string, unknown> | null {
    if (!prop) return null;

    const images = prop.images || [];
    return {
      id: prop.id,
      projectId: prop.projectId,
      name: prop.name,
      description: prop.description,
      appearance: prop.appearance,
      function: prop.function,
      importance: prop.importance,
      status: prop.status,
      images: {
        frontView: this.mapPropImageToDto(
          images.find((img) => img.type === "front_view" && img.isCurrent),
        ),
        sideView: this.mapPropImageToDto(
          images.find((img) => img.type === "side_view" && img.isCurrent),
        ),
        topView: this.mapPropImageToDto(
          images.find((img) => img.type === "top_view" && img.isCurrent),
        ),
        additional: images
          .filter((img) => img.type === "additional" && img.isCurrent)
          .map((img) => this.mapPropImageToDto(img)!),
      },
      scriptRef: prop.scriptRef,
      importInfo: prop.importInfo,
      createdAt: prop.createdAt.toISOString(),
      updatedAt: prop.updatedAt.toISOString(),
      createdBy: prop.createdBy,
    };
  }

  /**
   * 将 PropImage 实体映射为简化对象
   */
  private mapPropImageToDto(
    image:
      | {
          id: string;
          type: string;
          url: string;
          thumbnailUrl: string | null;
          generationInfo:
            | {
                generationId: string;
                prompt: string;
                negativePrompt?: string;
                modelId: string;
                seed?: number;
                createdAt: string;
              }
            | null;
          uploadInfo:
            | {
                originalFilename: string;
                fileSize: number;
                mimeType: string;
                uploadedAt: string;
              }
            | null;
          version: number;
          isCurrent: boolean;
          createdAt: Date;
          updatedAt: Date;
        }
      | undefined,
  ): Record<string, unknown> | undefined {
    if (!image) return undefined;
    return {
      id: image.id,
      type: image.type,
      url: image.url,
      thumbnailUrl: image.thumbnailUrl,
      generation: image.generationInfo,
      uploadInfo: image.uploadInfo,
      version: image.version,
      isCurrent: image.isCurrent,
      createdAt: image.createdAt.toISOString(),
      updatedAt: image.updatedAt.toISOString(),
    };
  }
}
