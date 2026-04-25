import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Like, Not, IsNull } from "typeorm";
import {
  Scene,
  SceneStatus,
  SceneType,
  SceneTypeType,
} from "../entities/scene.entity";
import {
  SceneImage,
  SceneImageType,
  SceneImageTypeType,
  VariantType,
  VariantTypeType,
  GenerationInfo,
  UploadInfo,
} from "../entities/scene-image.entity";
import { Script } from "../../script/entities/script.entity";
import type {
  CreateSceneDto,
  UpdateSceneDto,
  QueryScenesDto,
  BatchCreateScenesDto,
  GenerateSceneImageDto,
  ImportScenesDto,
} from "../dto";
import type {
  SceneListItemDto,
  SceneDetailDto,
  SceneImageDto,
  BatchCreateScenesResultDto,
  GenerateSceneImageTaskDto,
  ImportScenesResultDto,
} from "@pixaura/shared-types";
import { ImageGenerationService } from "../../image-gen/services";
import { ImageStorageService } from "../../image-gen/services";
import { buildScriptAssetImagePrompt } from "../../../prompts";

@Injectable()
export class SceneService {
  constructor(
    @InjectRepository(Scene)
    private readonly sceneRepository: Repository<Scene>,
    @InjectRepository(SceneImage)
    private readonly sceneImageRepository: Repository<SceneImage>,
    @InjectRepository(Script)
    private readonly scriptRepository: Repository<Script>,
    private readonly imageGenerationService: ImageGenerationService,
    private readonly imageStorageService: ImageStorageService,
  ) {}

  // ==================== 基础 CRUD ====================

  /**
   * 创建场景
   */
  async create(
    projectId: string,
    userId: string,
    dto: CreateSceneDto,
  ): Promise<SceneDetailDto> {
    // 检查名称是否已存在
    const existing = await this.sceneRepository.findOne({
      where: { projectId, name: dto.name, deletedAt: IsNull() },
    });
    if (existing) {
      throw new ConflictException({
        code: 9001,
        message: "场景名称已存在",
      });
    }

    const scene = this.sceneRepository.create({
      projectId,
      name: dto.name,
      description: dto.description ?? null,
      type: dto.type ?? SceneType.INTERIOR,
      space: dto.space ?? null,
      visuals: dto.visuals ?? null,
      atmosphere: dto.atmosphere ?? null,
      status: SceneStatus.DRAFT,
      createdBy: userId,
    });

    await this.sceneRepository.save(scene);

    return this.findById(scene.id);
  }

  /**
   * 获取场景列表
   * 直接返回项目资源库中的场景数据
   */
  async findAll(
    projectId: string,
    query: QueryScenesDto,
  ): Promise<{
    list: SceneListItemDto[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  }> {
    const {
      page = 1,
      pageSize = 20,
      status,
      type,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = query;

    const where: Record<string, unknown> = { projectId, deletedAt: IsNull() };
    if (status) where.status = status;
    if (type) where.type = type;
    if (search) where.name = Like(`%${search}%`);

    const order: Record<string, "ASC" | "DESC"> = {};
    order[
      sortBy === "name"
        ? "name"
        : sortBy === "updatedAt"
          ? "updatedAt"
          : "createdAt"
    ] = sortOrder === "asc" ? "ASC" : "DESC";

    const [scenes, total] = await this.sceneRepository.findAndCount({
      where,
      order,
      skip: (page - 1) * pageSize,
      take: pageSize,
      relations: ["images"],
    });

    const list: SceneListItemDto[] = scenes.map((scene) =>
      this.toListItemDto(scene),
    );

    return {
      list,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 获取场景详情
   */
  async findById(id: string): Promise<SceneDetailDto> {
    const scene = await this.sceneRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ["images"],
    });

    if (!scene) {
      throw new NotFoundException({
        code: 9000,
        message: "场景不存在",
      });
    }

    return this.toDetailDto(scene);
  }

  /**
   * 批量获取场景详情
   * @param ids 场景 ID 列表
   * @returns ID -> 场景详情映射
   */
  async findByIds(ids: string[]): Promise<Map<string, SceneDetailDto>> {
    const result = new Map<string, SceneDetailDto>();

    if (!ids.length) return result;

    const scenes = await this.sceneRepository.find({
      where: ids.map((id) => ({ id, deletedAt: IsNull() })),
      relations: ["images"],
    });

    for (const scene of scenes) {
      result.set(scene.id, this.toDetailDto(scene));
    }

    return result;
  }

  /**
   * 更新场景
   */
  async update(id: string, dto: UpdateSceneDto): Promise<SceneDetailDto> {
    const scene = await this.sceneRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!scene) {
      throw new NotFoundException({
        code: 9000,
        message: "场景不存在",
      });
    }

    // 如果更新名称，检查是否冲突
    if (dto.name && dto.name !== scene.name) {
      const existing = await this.sceneRepository.findOne({
        where: {
          projectId: scene.projectId,
          name: dto.name,
          deletedAt: IsNull(),
          id: Not(id),
        },
      });
      if (existing) {
        throw new ConflictException({
          code: 9001,
          message: "场景名称已存在",
        });
      }
    }

    // 更新字段
    if (dto.name !== undefined) scene.name = dto.name;
    if (dto.description !== undefined)
      scene.description = dto.description ?? null;
    if (dto.type !== undefined) scene.type = dto.type;
    if (dto.space !== undefined) scene.space = dto.space ?? null;
    if (dto.visuals !== undefined) scene.visuals = dto.visuals ?? null;
    if (dto.atmosphere !== undefined) scene.atmosphere = dto.atmosphere ?? null;
    if (dto.status !== undefined) scene.status = dto.status;

    await this.sceneRepository.save(scene);

    return this.findById(id);
  }

  /**
   * 删除场景（物理删除），同时清理关联图片文件
   */
  async remove(id: string): Promise<void> {
    const scene = await this.sceneRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ["images"],
    });

    if (!scene) {
      throw new NotFoundException({
        code: 9000,
        message: "场景不存在",
      });
    }

    // 删除关联图片的物理文件
    for (const image of scene.images ?? []) {
      if (image.url) {
        await this.imageStorageService.deleteImage(image.url);
      }
      if (image.thumbnailUrl && image.thumbnailUrl !== image.url) {
        await this.imageStorageService.deleteImage(image.thumbnailUrl);
      }
    }

    await this.sceneRepository.remove(scene);
  }

  async batchRemove(ids: string[]): Promise<{ deleted: number }> {
    let deleted = 0;
    for (const id of ids) {
      try {
        await this.remove(id);
        deleted++;
      } catch {
        // 忽略不存在的场景
      }
    }
    return { deleted };
  }

  // ==================== 查重 ====================

  /**
   * 按项目ID和名称查重（大小写不敏感）
   */
  async findByProjectAndName(
    projectId: string,
    name: string,
  ): Promise<Scene | null> {
    const scenes = await this.sceneRepository
      .createQueryBuilder("scene")
      .where("scene.project_id = :projectId", { projectId })
      .andWhere("LOWER(scene.name) = LOWER(:name)", { name })
      .andWhere("scene.deleted_at IS NULL")
      .getMany();
    return scenes[0] ?? null;
  }

  // ==================== 批量创建 ====================

  /**
   * 从剧本批量创建场景
   */
  async batchCreate(
    projectId: string,
    userId: string,
    dto: BatchCreateScenesDto,
  ): Promise<BatchCreateScenesResultDto> {
    const result: BatchCreateScenesResultDto = {
      created: 0,
      scenes: [],
      errors: [],
    };

    for (const sceneData of dto.scenes) {
      try {
        // 检查名称是否已存在
        const existing = await this.sceneRepository.findOne({
          where: { projectId, name: sceneData.name, deletedAt: IsNull() },
        });

        if (existing) {
          result.errors?.push({
            name: sceneData.name,
            error: "场景名称已存在",
            errorCode: 9001,
          });
          continue;
        }

        const scene = this.sceneRepository.create({
          projectId,
          name: sceneData.name,
          description: sceneData.description ?? null,
          type: (sceneData.type as SceneTypeType) ?? SceneType.INTERIOR,
          status: SceneStatus.DRAFT,
          scriptRef: {
            scriptId: dto.scriptId,
            extractedAt: new Date().toISOString(),
          },
          createdBy: userId,
        });

        await this.sceneRepository.save(scene);

        result.created++;
        result.scenes.push({
          id: scene.id,
          name: scene.name,
          status: scene.status,
          createdAt: scene.createdAt.toISOString(),
        });
      } catch (error) {
        result.errors?.push({
          name: sceneData.name,
          error: error instanceof Error ? error.message : "创建失败",
          errorCode: 9000,
        });
      }
    }

    return result;
  }

  // ==================== 图片管理 ====================

  /**
   * 异步生成场景参考图
   * 使用 ImageGenerationService 创建生成任务
   */
  async generateImage(
    sceneId: string,
    dto: GenerateSceneImageDto,
  ): Promise<GenerateSceneImageTaskDto> {
    const scene = await this.sceneRepository.findOne({
      where: { id: sceneId, deletedAt: IsNull() },
    });

    if (!scene) {
      throw new NotFoundException({
        code: 9000,
        message: "场景不存在",
      });
    }

    // 构建提示词
    const prompt = buildScriptAssetImagePrompt(
      scene.name,
      scene.description || "",
      "scene",
      dto.customPrompt,
    );

    // 获取默认模型 ID
    const modelId = dto.modelId || "z-image-turbo";

    // 查询场景的参考图（ADDITIONAL 类型）
    const referenceImages = await this.sceneImageRepository.find({
      where: { sceneId, type: SceneImageType.ADDITIONAL, isCurrent: true },
      order: { createdAt: "ASC" },
    });
    const referenceImageUrls = referenceImages.map((img) => img.url).filter(Boolean);

    // 创建图片生成任务（附带资产上下文，用于完成后回链）
    const taskConfig: Parameters<
      ImageGenerationService["createImageGenerationTask"]
    >[1]["config"] = {
      prompt,
      modelId,
      width: 1024,
      height: 1024,
      strength: 0.7,
      // 资产上下文：图片生成完成后自动回链到场景
      parameters: {
        assetType: "scene",
        assetId: sceneId,
        imageType: dto.type || "panorama",
        referenceImages: referenceImageUrls.length > 0 ? referenceImageUrls : undefined,
      },
    };

    // 如果有参考图，第一张用于启用 image_to_image 模式
    if (referenceImageUrls.length > 0) {
      taskConfig.referenceImageUrl = referenceImageUrls[0];
    }

    const task = await this.imageGenerationService.createImageGenerationTask(
      scene.createdBy,
      {
        projectId: scene.projectId,
        sceneType: "scene_views",
        config: taskConfig,
        notifyWs: true,
      },
    );

    // 转换状态为 DTO 兼容格式
    const taskStatus: "pending" | "processing" =
      task.status === "queued" || task.status === "pending"
        ? "pending"
        : "processing";

    return {
      generationTaskId: task.taskId,
      status: taskStatus,
      type: dto.type,
      estimatedTime: task.estimatedTime,
    };
  }

  /**
   * 上传场景参考图
   */
  async uploadImage(
    sceneId: string,
    type: SceneImageTypeType,
    fileUrl: string,
    thumbnailUrl: string,
    uploadInfo: UploadInfo,
    variantType?: VariantTypeType | null,
    variantValue?: string | null,
  ): Promise<SceneImageDto> {
    const scene = await this.sceneRepository.findOne({
      where: { id: sceneId, deletedAt: IsNull() },
    });

    if (!scene) {
      throw new NotFoundException({
        code: 9000,
        message: "场景不存在",
      });
    }

    // 如果是非 detail/additional 类型，清理旧版本的物理文件和数据库记录
    if (type !== SceneImageType.DETAIL && type !== SceneImageType.ADDITIONAL) {
      const where: Record<string, unknown> = { sceneId, type, isCurrent: true };
      if (variantType) {
        where.variantType = variantType;
        where.variantValue = variantValue;
      }
      const oldImages = await this.sceneImageRepository.find({ where });
      for (const oldImage of oldImages) {
        if (oldImage.url) {
          await this.imageStorageService.deleteImage(oldImage.url);
        }
        if (oldImage.thumbnailUrl && oldImage.thumbnailUrl !== oldImage.url) {
          await this.imageStorageService.deleteImage(oldImage.thumbnailUrl);
        }
        await this.sceneImageRepository.remove(oldImage);
      }
    }

    // 计算新版本号
    const whereLast: Record<string, unknown> = { sceneId, type };
    if (variantType) {
      whereLast.variantType = variantType;
      whereLast.variantValue = variantValue;
    }
    const lastImage = await this.sceneImageRepository.findOne({
      where: whereLast,
      order: { version: "DESC" },
    });
    const newVersion = (lastImage?.version ?? 0) + 1;

    const image = this.sceneImageRepository.create({
      sceneId,
      type,
      variantType: variantType ?? null,
      variantValue: variantValue ?? null,
      url: fileUrl,
      thumbnailUrl,
      uploadInfo,
      version: newVersion,
      isCurrent: true,
    });

    await this.sceneImageRepository.save(image);

    // 如果场景是 draft 状态，且上传了第一张图片，自动设为 active
    if (scene.status === SceneStatus.DRAFT) {
      const imageCount = await this.sceneImageRepository.count({
        where: { sceneId },
      });
      if (imageCount === 1) {
        scene.status = SceneStatus.ACTIVE;
        await this.sceneRepository.save(scene);
      }
    }

    return this.toImageDto(image);
  }

  /**
   * 删除场景参考图
   */
  async deleteImage(sceneId: string, imageId: string): Promise<void> {
    const image = await this.sceneImageRepository.findOne({
      where: { id: imageId, sceneId },
    });

    if (!image) {
      throw new NotFoundException({
        code: 9004,
        message: "场景图片不存在",
      });
    }

    if (image.url) {
      await this.imageStorageService.deleteImage(image.url);
    }
    if (image.thumbnailUrl && image.thumbnailUrl !== image.url) {
      await this.imageStorageService.deleteImage(image.thumbnailUrl);
    }

    await this.sceneImageRepository.remove(image);
  }

  // ==================== 跨项目导入 ====================

  /**
   * 从其他项目导入场景
   */
  async importFromProject(
    targetProjectId: string,
    userId: string,
    dto: ImportScenesDto,
  ): Promise<ImportScenesResultDto> {
    const result: ImportScenesResultDto = {
      imported: 0,
      scenes: [],
      errors: [],
    };

    for (const sourceSceneId of dto.sourceSceneIds) {
      try {
        // 查找源场景
        const sourceScene = await this.sceneRepository.findOne({
          where: {
            id: sourceSceneId,
            projectId: dto.sourceProjectId,
            deletedAt: IsNull(),
          },
          relations: ["images"],
        });

        if (!sourceScene) {
          result.errors?.push({
            sourceSceneId,
            error: "源场景不存在",
            errorCode: 9007,
          });
          continue;
        }

        // 检查名称是否冲突
        let newName = sourceScene.name;
        const existing = await this.sceneRepository.findOne({
          where: {
            projectId: targetProjectId,
            name: newName,
            deletedAt: IsNull(),
          },
        });

        if (existing) {
          newName = `${newName}_导入`;
          // 再次检查
          const stillExisting = await this.sceneRepository.findOne({
            where: {
              projectId: targetProjectId,
              name: newName,
              deletedAt: IsNull(),
            },
          });
          if (stillExisting) {
            newName = `${newName}_${Date.now()}`;
          }
        }

        // 创建新场景
        const newScene = this.sceneRepository.create({
          projectId: targetProjectId,
          name: newName,
          description: sourceScene.description,
          type: sourceScene.type,
          space: sourceScene.space,
          visuals: sourceScene.visuals,
          atmosphere: sourceScene.atmosphere,
          status: SceneStatus.ACTIVE,
          importInfo: {
            sourceProjectId: dto.sourceProjectId,
            sourceSceneId,
            importedAt: new Date().toISOString(),
          },
          createdBy: userId,
        });

        await this.sceneRepository.save(newScene);

        // 复制图片引用
        for (const sourceImage of sourceScene.images ?? []) {
          if (sourceImage.isCurrent) {
            await this.sceneImageRepository.save({
              sceneId: newScene.id,
              type: sourceImage.type,
              variantType: sourceImage.variantType,
              variantValue: sourceImage.variantValue,
              url: sourceImage.url,
              thumbnailUrl: sourceImage.thumbnailUrl,
              generationInfo: sourceImage.generationInfo,
              uploadInfo: sourceImage.uploadInfo,
              version: 1,
              isCurrent: true,
            });
          }
        }

        result.imported++;
        result.scenes.push({
          id: newScene.id,
          name: newScene.name,
          sourceSceneId,
          importedAt:
            newScene.importInfo?.importedAt ?? new Date().toISOString(),
        });
      } catch (error) {
        result.errors?.push({
          sourceSceneId,
          error: error instanceof Error ? error.message : "导入失败",
          errorCode: 9007,
        });
      }
    }

    return result;
  }

  // ==================== DTO 转换 ====================

  private toListItemDto(scene: Scene): SceneListItemDto {
    const images: SceneListItemDto["images"] = {};
    const referenceImages: Array<{ id?: string; url?: string; thumbnailUrl?: string | null }> = [];

    // 按创建时间排序，确保图片顺序一致
    const sortedImages = [...(scene.images ?? [])].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );

    for (const image of sortedImages) {
      if (image.isCurrent) {
        const imageData = {
          url: image.url,
          thumbnailUrl: image.thumbnailUrl || "",
        };
        switch (image.type) {
          case SceneImageType.PANORAMA:
            images.panorama = imageData;
            break;
          case SceneImageType.WIDE_SHOT:
            images.wideShot = imageData;
            break;
          case SceneImageType.ADDITIONAL:
            referenceImages.push({
              id: image.id,
              url: image.url,
              thumbnailUrl: image.thumbnailUrl,
            });
            break;
        }
      }
    }

    if (referenceImages.length > 0) {
      images.referenceImages = referenceImages;
    }

    return {
      id: scene.id,
      name: scene.name,
      description: scene.description,
      type: scene.type,
      status: scene.status,
      images,
      createdAt: scene.createdAt.toISOString(),
      updatedAt: scene.updatedAt.toISOString(),
    };
  }

  private toDetailDto(scene: Scene): SceneDetailDto {
    const images: SceneDetailDto["images"] = {
      detailShots: [],
      variants: {},
      additional: [],
    };

    for (const image of scene.images ?? []) {
      const imageDto = this.toImageDto(image);
      if (image.isCurrent) {
        switch (image.type) {
          case SceneImageType.PANORAMA:
            images.panorama = imageDto;
            break;
          case SceneImageType.WIDE_SHOT:
            images.wideShot = imageDto;
            break;
          case SceneImageType.DETAIL:
            images.detailShots.push(imageDto);
            break;
          case SceneImageType.VARIANT:
            if (image.variantType && image.variantValue) {
              if (image.variantType === "time_of_day") {
                if (!images.variants.timeOfDay) {
                  images.variants.timeOfDay = {};
                }
                images.variants.timeOfDay[image.variantValue] = imageDto;
              } else if (image.variantType === "weather") {
                if (!images.variants.weather) {
                  images.variants.weather = {};
                }
                images.variants.weather[image.variantValue] = imageDto;
              }
            }
            break;
          case SceneImageType.ADDITIONAL:
            images.additional.push(imageDto);
            break;
        }
      }
    }

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
      images,
      scriptRef: scene.scriptRef,
      importInfo: scene.importInfo,
      createdAt: scene.createdAt.toISOString(),
      updatedAt: scene.updatedAt.toISOString(),
      createdBy: scene.createdBy,
    };
  }

  private toImageDto(image: SceneImage): SceneImageDto {
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
}
