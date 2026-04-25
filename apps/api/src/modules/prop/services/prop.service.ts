import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Like, Not, IsNull } from "typeorm";
import {
  Prop,
  PropStatus,
  PropImportance,
  PropImportanceType,
} from "../entities/prop.entity";
import {
  PropImage,
  PropImageType,
  PropImageTypeType,
  GenerationInfo,
  UploadInfo,
} from "../entities/prop-image.entity";
import { Script } from "../../script/entities/script.entity";
import type {
  CreatePropDto,
  UpdatePropDto,
  QueryPropsDto,
  BatchCreatePropsDto,
  GeneratePropImageDto,
  ImportPropsDto,
} from "../dto";
import type {
  PropListItemDto,
  PropDetailDto,
  PropImageDto,
  BatchCreatePropsResultDto,
  GeneratePropImageTaskDto,
  ImportPropsResultDto,
} from "@pixaura/shared-types";
import { ImageGenerationService } from "../../image-gen/services";
import { ImageStorageService } from "../../image-gen/services";
import { buildScriptAssetImagePrompt } from "../../../prompts";

@Injectable()
export class PropService {
  constructor(
    @InjectRepository(Prop)
    private readonly propRepository: Repository<Prop>,
    @InjectRepository(PropImage)
    private readonly propImageRepository: Repository<PropImage>,
    @InjectRepository(Script)
    private readonly scriptRepository: Repository<Script>,
    private readonly imageGenerationService: ImageGenerationService,
    private readonly imageStorageService: ImageStorageService,
  ) {}

  // ==================== 基础 CRUD ====================

  /**
   * 创建道具
   */
  async create(
    projectId: string,
    userId: string,
    dto: CreatePropDto,
  ): Promise<PropDetailDto> {
    // 检查名称是否已存在
    const existing = await this.propRepository.findOne({
      where: { projectId, name: dto.name, deletedAt: IsNull() },
    });
    if (existing) {
      throw new ConflictException({
        code: 10001,
        message: "道具名称已存在",
      });
    }

    const prop = this.propRepository.create({
      projectId,
      name: dto.name,
      description: dto.description ?? null,
      appearance: dto.appearance ?? null,
      function: dto.function ?? null,
      importance: dto.importance ?? PropImportance.BACKGROUND,
      status: PropStatus.DRAFT,
      createdBy: userId,
    });

    await this.propRepository.save(prop);

    return this.findById(prop.id);
  }

  /**
   * 获取道具列表
   * 直接返回项目资源库中的道具数据
   */
  async findAll(
    projectId: string,
    query: QueryPropsDto,
  ): Promise<{
    list: PropListItemDto[];
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
      importance,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = query;

    const where: Record<string, unknown> = { projectId, deletedAt: IsNull() };
    if (status) where.status = status;
    if (importance) where.importance = importance;
    if (search) where.name = Like(`%${search}%`);

    const order: Record<string, "ASC" | "DESC"> = {};
    order[
      sortBy === "name"
        ? "name"
        : sortBy === "updatedAt"
          ? "updatedAt"
          : "createdAt"
    ] = sortOrder === "asc" ? "ASC" : "DESC";

    const [props, total] = await this.propRepository.findAndCount({
      where,
      order,
      skip: (page - 1) * pageSize,
      take: pageSize,
      relations: ["images"],
    });

    const list: PropListItemDto[] = props.map((prop) =>
      this.toListItemDto(prop),
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
   * 获取道具详情
   */
  async findById(id: string): Promise<PropDetailDto> {
    const prop = await this.propRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ["images"],
    });

    if (!prop) {
      throw new NotFoundException({
        code: 10000,
        message: "道具不存在",
      });
    }

    return this.toDetailDto(prop);
  }

  /**
   * 批量获取道具详情
   * @param ids 道具 ID 列表
   * @returns ID -> 道具详情映射
   */
  async findByIds(ids: string[]): Promise<Map<string, PropDetailDto>> {
    const result = new Map<string, PropDetailDto>();

    if (!ids.length) return result;

    const props = await this.propRepository.find({
      where: ids.map((id) => ({ id, deletedAt: IsNull() })),
      relations: ["images"],
    });

    for (const prop of props) {
      result.set(prop.id, this.toDetailDto(prop));
    }

    return result;
  }

  /**
   * 更新道具
   */
  async update(id: string, dto: UpdatePropDto): Promise<PropDetailDto> {
    const prop = await this.propRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!prop) {
      throw new NotFoundException({
        code: 10000,
        message: "道具不存在",
      });
    }

    // 如果更新名称，检查是否冲突
    if (dto.name && dto.name !== prop.name) {
      const existing = await this.propRepository.findOne({
        where: {
          projectId: prop.projectId,
          name: dto.name,
          deletedAt: IsNull(),
          id: Not(id),
        },
      });
      if (existing) {
        throw new ConflictException({
          code: 10001,
          message: "道具名称已存在",
        });
      }
    }

    // 更新字段
    if (dto.name !== undefined) prop.name = dto.name;
    if (dto.description !== undefined)
      prop.description = dto.description ?? null;
    if (dto.appearance !== undefined) prop.appearance = dto.appearance ?? null;
    if (dto.function !== undefined) prop.function = dto.function ?? null;
    if (dto.importance !== undefined) prop.importance = dto.importance;
    if (dto.status !== undefined) prop.status = dto.status;

    await this.propRepository.save(prop);

    return this.findById(id);
  }

  /**
   * 删除道具（物理删除），同时清理关联图片文件
   */
  async remove(id: string): Promise<void> {
    const prop = await this.propRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ["images"],
    });

    if (!prop) {
      throw new NotFoundException({
        code: 10000,
        message: "道具不存在",
      });
    }

    // 删除关联图片的物理文件
    for (const image of prop.images ?? []) {
      if (image.url) {
        await this.imageStorageService.deleteImage(image.url);
      }
      if (image.thumbnailUrl && image.thumbnailUrl !== image.url) {
        await this.imageStorageService.deleteImage(image.thumbnailUrl);
      }
    }

    await this.propRepository.remove(prop);
  }

  async batchRemove(ids: string[]): Promise<{ deleted: number }> {
    let deleted = 0;
    for (const id of ids) {
      try {
        await this.remove(id);
        deleted++;
      } catch {
        // 忽略不存在的道具
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
  ): Promise<Prop | null> {
    const props = await this.propRepository
      .createQueryBuilder("prop")
      .where("prop.project_id = :projectId", { projectId })
      .andWhere("LOWER(prop.name) = LOWER(:name)", { name })
      .andWhere("prop.deleted_at IS NULL")
      .getMany();
    return props[0] ?? null;
  }

  // ==================== 批量创建 ====================

  /**
   * 从剧本批量创建道具
   */
  async batchCreate(
    projectId: string,
    userId: string,
    dto: BatchCreatePropsDto,
  ): Promise<BatchCreatePropsResultDto> {
    const result: BatchCreatePropsResultDto = {
      created: 0,
      props: [],
      errors: [],
    };

    for (const propData of dto.props) {
      try {
        // 检查名称是否已存在
        const existing = await this.propRepository.findOne({
          where: { projectId, name: propData.name, deletedAt: IsNull() },
        });

        if (existing) {
          result.errors?.push({
            name: propData.name,
            error: "道具名称已存在",
            errorCode: 10001,
          });
          continue;
        }

        const prop = this.propRepository.create({
          projectId,
          name: propData.name,
          description: propData.description ?? null,
          importance:
            (propData.importance as PropImportanceType) ??
            PropImportance.BACKGROUND,
          status: PropStatus.DRAFT,
          scriptRef: {
            scriptId: dto.scriptId,
            extractedAt: new Date().toISOString(),
            sceneIds: [],
          },
          createdBy: userId,
        });

        await this.propRepository.save(prop);

        result.created++;
        result.props.push({
          id: prop.id,
          name: prop.name,
          status: prop.status,
          createdAt: prop.createdAt.toISOString(),
        });
      } catch (error) {
        result.errors?.push({
          name: propData.name,
          error: error instanceof Error ? error.message : "创建失败",
          errorCode: 10000,
        });
      }
    }

    return result;
  }

  // ==================== 图片管理 ====================

  /**
   * 异步生成道具参考图
   * 使用 ImageGenerationService 创建生成任务
   */
  async generateImage(
    propId: string,
    dto: GeneratePropImageDto,
  ): Promise<GeneratePropImageTaskDto> {
    const prop = await this.propRepository.findOne({
      where: { id: propId, deletedAt: IsNull() },
    });

    if (!prop) {
      throw new NotFoundException({
        code: 10000,
        message: "道具不存在",
      });
    }

    // 构建提示词
    const prompt = buildScriptAssetImagePrompt(
      prop.name,
      prop.description || "",
      "prop",
      dto.customPrompt,
    );

    // 获取默认模型 ID
    const modelId = dto.modelId || "z-image-turbo";

    // 查询道具的参考图（ADDITIONAL 类型）
    const referenceImages = await this.propImageRepository.find({
      where: { propId, type: PropImageType.ADDITIONAL, isCurrent: true },
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
      // 资产上下文：图片生成完成后自动回链到道具
      parameters: {
        assetType: "prop",
        assetId: propId,
        imageType: dto.type || "front_view",
        referenceImages: referenceImageUrls.length > 0 ? referenceImageUrls : undefined,
      },
    };

    // 如果有参考图，第一张用于启用 image_to_image 模式
    if (referenceImageUrls.length > 0) {
      taskConfig.referenceImageUrl = referenceImageUrls[0];
    }

    const task = await this.imageGenerationService.createImageGenerationTask(
      prop.createdBy,
      {
        projectId: prop.projectId,
        sceneType: "prop_views",
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
   * 上传道具参考图
   */
  async uploadImage(
    propId: string,
    type: PropImageTypeType,
    fileUrl: string,
    thumbnailUrl: string,
    uploadInfo: UploadInfo,
  ): Promise<PropImageDto> {
    const prop = await this.propRepository.findOne({
      where: { id: propId, deletedAt: IsNull() },
    });

    if (!prop) {
      throw new NotFoundException({
        code: 10000,
        message: "道具不存在",
      });
    }

    // 如果是三视图类型，清理旧版本的物理文件和数据库记录
    if (type !== PropImageType.ADDITIONAL) {
      const oldImages = await this.propImageRepository.find({
        where: { propId, type, isCurrent: true },
      });
      for (const oldImage of oldImages) {
        if (oldImage.url) {
          await this.imageStorageService.deleteImage(oldImage.url);
        }
        if (oldImage.thumbnailUrl && oldImage.thumbnailUrl !== oldImage.url) {
          await this.imageStorageService.deleteImage(oldImage.thumbnailUrl);
        }
        await this.propImageRepository.remove(oldImage);
      }
    }

    // 计算新版本号
    const lastImage = await this.propImageRepository.findOne({
      where: { propId, type },
      order: { version: "DESC" },
    });
    const newVersion = (lastImage?.version ?? 0) + 1;

    const image = this.propImageRepository.create({
      propId,
      type,
      url: fileUrl,
      thumbnailUrl,
      uploadInfo,
      version: newVersion,
      isCurrent: true,
    });

    await this.propImageRepository.save(image);

    // 如果道具是 draft 状态，且上传了第一张图片，自动设为 active
    if (prop.status === PropStatus.DRAFT) {
      const imageCount = await this.propImageRepository.count({
        where: { propId },
      });
      if (imageCount === 1) {
        prop.status = PropStatus.ACTIVE;
        await this.propRepository.save(prop);
      }
    }

    return this.toImageDto(image);
  }

  /**
   * 删除道具参考图
   */
  async deleteImage(propId: string, imageId: string): Promise<void> {
    const image = await this.propImageRepository.findOne({
      where: { id: imageId, propId },
    });

    if (!image) {
      throw new NotFoundException({
        code: 10004,
        message: "道具图片不存在",
      });
    }

    if (image.url) {
      await this.imageStorageService.deleteImage(image.url);
    }
    if (image.thumbnailUrl && image.thumbnailUrl !== image.url) {
      await this.imageStorageService.deleteImage(image.thumbnailUrl);
    }

    await this.propImageRepository.remove(image);
  }

  // ==================== 跨项目导入 ====================

  /**
   * 从其他项目导入道具
   */
  async importFromProject(
    targetProjectId: string,
    userId: string,
    dto: ImportPropsDto,
  ): Promise<ImportPropsResultDto> {
    const result: ImportPropsResultDto = {
      imported: 0,
      props: [],
      errors: [],
    };

    for (const sourcePropId of dto.sourcePropIds) {
      try {
        // 查找源道具
        const sourceProp = await this.propRepository.findOne({
          where: {
            id: sourcePropId,
            projectId: dto.sourceProjectId,
            deletedAt: IsNull(),
          },
          relations: ["images"],
        });

        if (!sourceProp) {
          result.errors?.push({
            sourcePropId,
            error: "源道具不存在",
            errorCode: 10007,
          });
          continue;
        }

        // 检查名称是否冲突
        let newName = sourceProp.name;
        const existing = await this.propRepository.findOne({
          where: {
            projectId: targetProjectId,
            name: newName,
            deletedAt: IsNull(),
          },
        });

        if (existing) {
          newName = `${newName}_导入`;
          // 再次检查
          const stillExisting = await this.propRepository.findOne({
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

        // 创建新道具
        const newProp = this.propRepository.create({
          projectId: targetProjectId,
          name: newName,
          description: sourceProp.description,
          appearance: sourceProp.appearance,
          function: sourceProp.function,
          importance: sourceProp.importance,
          status: PropStatus.ACTIVE,
          importInfo: {
            sourceProjectId: dto.sourceProjectId,
            sourcePropId,
            importedAt: new Date().toISOString(),
          },
          createdBy: userId,
        });

        await this.propRepository.save(newProp);

        // 复制图片引用
        for (const sourceImage of sourceProp.images ?? []) {
          if (sourceImage.isCurrent) {
            await this.propImageRepository.save({
              propId: newProp.id,
              type: sourceImage.type,
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
        result.props.push({
          id: newProp.id,
          name: newProp.name,
          sourcePropId,
          importedAt:
            newProp.importInfo?.importedAt ?? new Date().toISOString(),
        });
      } catch (error) {
        result.errors?.push({
          sourcePropId,
          error: error instanceof Error ? error.message : "导入失败",
          errorCode: 10007,
        });
      }
    }

    return result;
  }

  // ==================== DTO 转换 ====================

  private toListItemDto(prop: Prop): PropListItemDto {
    const images: PropListItemDto["images"] = {};
    const referenceImages: Array<{ id?: string; url?: string; thumbnailUrl?: string | null }> = [];

    // 按创建时间排序，确保图片顺序一致
    const sortedImages = [...(prop.images ?? [])].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );

    for (const image of sortedImages) {
      if (image.isCurrent) {
        if (image.type === PropImageType.FRONT_VIEW) {
          const imageData = {
            url: image.url,
            thumbnailUrl: image.thumbnailUrl || "",
          };
          images.frontView = imageData;
        } else if (image.type === PropImageType.ADDITIONAL) {
          referenceImages.push({
            id: image.id,
            url: image.url,
            thumbnailUrl: image.thumbnailUrl,
          });
        }
      }
    }

    if (referenceImages.length > 0) {
      images.referenceImages = referenceImages;
    }

    return {
      id: prop.id,
      name: prop.name,
      description: prop.description,
      importance: prop.importance,
      status: prop.status,
      images,
      createdAt: prop.createdAt.toISOString(),
      updatedAt: prop.updatedAt.toISOString(),
    };
  }

  private toDetailDto(prop: Prop): PropDetailDto {
    const images: PropDetailDto["images"] = {
      additional: [],
    };

    for (const image of prop.images ?? []) {
      const imageDto = this.toImageDto(image);
      if (image.isCurrent) {
        switch (image.type) {
          case PropImageType.FRONT_VIEW:
            images.frontView = imageDto;
            break;
          case PropImageType.SIDE_VIEW:
            images.sideView = imageDto;
            break;
          case PropImageType.TOP_VIEW:
            images.topView = imageDto;
            break;
          case PropImageType.ADDITIONAL:
            images.additional.push(imageDto);
            break;
        }
      }
    }

    return {
      id: prop.id,
      projectId: prop.projectId,
      name: prop.name,
      description: prop.description,
      appearance: prop.appearance,
      function: prop.function,
      importance: prop.importance,
      status: prop.status,
      images,
      scriptRef: prop.scriptRef,
      importInfo: prop.importInfo,
      createdAt: prop.createdAt.toISOString(),
      updatedAt: prop.updatedAt.toISOString(),
      createdBy: prop.createdBy,
    };
  }

  private toImageDto(image: PropImage): PropImageDto {
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
