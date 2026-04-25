import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Like, Not, IsNull } from "typeorm";
import {
  Character,
  CharacterStatus,
  CharacterImportance,
  CharacterImportanceType,
  CharacterGenderType,
  CharacterAppearance,
} from "../entities/character.entity";
import {
  CharacterImage,
  CharacterImageType,
  CharacterImageTypeType,
  GenerationInfo,
  UploadInfo,
} from "../entities/character-image.entity";
import { Script } from "../../script/entities/script.entity";
import type {
  CreateCharacterDto,
  UpdateCharacterDto,
  QueryCharactersDto,
  BatchCreateCharactersDto,
  GenerateImageDto,
  ImportCharactersDto,
} from "../dto";
import type {
  CharacterListItemDto,
  CharacterDetailDto,
  CharacterImageDto,
  BatchCreateCharactersResultDto,
  GenerateImageTaskDto,
  ImportCharactersResultDto,
} from "@pixaura/shared-types";
import { ImageGenerationService } from "../../image-gen/services";
import { ImageStorageService } from "../../image-gen/services";
import { buildScriptAssetImagePrompt } from "../../../prompts";

@Injectable()
export class CharacterService {
  constructor(
    @InjectRepository(Character)
    private readonly characterRepository: Repository<Character>,
    @InjectRepository(CharacterImage)
    private readonly characterImageRepository: Repository<CharacterImage>,
    @InjectRepository(Script)
    private readonly scriptRepository: Repository<Script>,
    private readonly imageGenerationService: ImageGenerationService,
    private readonly imageStorageService: ImageStorageService,
  ) {}

  // ==================== 基础 CRUD ====================

  /**
   * 创建角色
   */
  async create(
    projectId: string,
    userId: string,
    dto: CreateCharacterDto,
  ): Promise<CharacterDetailDto> {
    // 检查名称是否已存在
    const existing = await this.characterRepository.findOne({
      where: { projectId, name: dto.name, deletedAt: IsNull() },
    });
    if (existing) {
      throw new ConflictException({
        code: 8001,
        message: "角色名称已存在",
      });
    }

    const character = this.characterRepository.create({
      projectId,
      name: dto.name,
      description: dto.description ?? null,
      personality: dto.personality ?? null,
      age: dto.age ?? null,
      gender: dto.gender ?? null,
      occupation: dto.occupation ?? null,
      background: dto.background ?? null,
      appearance: dto.appearance ?? null,
      importance: dto.importance ?? CharacterImportance.MINOR,
      status: CharacterStatus.DRAFT,
      createdBy: userId,
    });

    await this.characterRepository.save(character);

    return this.findById(character.id);
  }

  /**
   * 获取角色列表
   * 直接返回项目资源库中的角色数据
   */
  async findAll(
    projectId: string,
    query: QueryCharactersDto,
  ): Promise<{
    list: CharacterListItemDto[];
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

    const [characters, total] = await this.characterRepository.findAndCount({
      where,
      order,
      skip: (page - 1) * pageSize,
      take: pageSize,
      relations: ["images"],
    });

    const list: CharacterListItemDto[] = characters.map((char) =>
      this.toListItemDto(char),
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
   * 获取角色详情
   */
  async findById(id: string): Promise<CharacterDetailDto> {
    const character = await this.characterRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ["images"],
    });

    if (!character) {
      throw new NotFoundException({
        code: 8000,
        message: "角色不存在",
      });
    }

    return this.toDetailDto(character);
  }

  /**
   * 批量获取角色详情
   * @param ids 角色 ID 列表
   * @returns ID -> 角色详情映射
   */
  async findByIds(ids: string[]): Promise<Map<string, CharacterDetailDto>> {
    const result = new Map<string, CharacterDetailDto>();

    if (!ids.length) return result;

    const characters = await this.characterRepository.find({
      where: ids.map((id) => ({ id, deletedAt: IsNull() })),
      relations: ["images"],
    });

    for (const character of characters) {
      result.set(character.id, this.toDetailDto(character));
    }

    return result;
  }

  /**
   * 更新角色
   */
  async update(
    id: string,
    dto: UpdateCharacterDto,
  ): Promise<CharacterDetailDto> {
    const character = await this.characterRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!character) {
      throw new NotFoundException({
        code: 8000,
        message: "角色不存在",
      });
    }

    // 如果更新名称，检查是否冲突
    if (dto.name && dto.name !== character.name) {
      const existing = await this.characterRepository.findOne({
        where: {
          projectId: character.projectId,
          name: dto.name,
          deletedAt: IsNull(),
          id: Not(id),
        },
      });
      if (existing) {
        throw new ConflictException({
          code: 8001,
          message: "角色名称已存在",
        });
      }
    }

    // 更新字段
    if (dto.name !== undefined) character.name = dto.name;
    if (dto.description !== undefined)
      character.description = dto.description ?? null;
    if (dto.personality !== undefined)
      character.personality = dto.personality ?? null;
    if (dto.age !== undefined) character.age = dto.age ?? null;
    if (dto.gender !== undefined) character.gender = dto.gender ?? null;
    if (dto.occupation !== undefined)
      character.occupation = dto.occupation ?? null;
    if (dto.background !== undefined)
      character.background = dto.background ?? null;
    if (dto.appearance !== undefined)
      character.appearance = dto.appearance ?? null;
    if (dto.importance !== undefined) character.importance = dto.importance;
    if (dto.status !== undefined) character.status = dto.status;

    await this.characterRepository.save(character);

    return this.findById(id);
  }

  /**
   * 删除角色（物理删除），同时清理关联图片文件
   */
  async remove(id: string): Promise<void> {
    const character = await this.characterRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ["images"],
    });

    if (!character) {
      throw new NotFoundException({
        code: 8000,
        message: "角色不存在",
      });
    }

    // 删除关联图片的物理文件
    for (const image of character.images ?? []) {
      if (image.url) {
        await this.imageStorageService.deleteImage(image.url);
      }
      if (image.thumbnailUrl && image.thumbnailUrl !== image.url) {
        await this.imageStorageService.deleteImage(image.thumbnailUrl);
      }
    }

    await this.characterRepository.remove(character);
  }

  async batchRemove(ids: string[]): Promise<{ deleted: number }> {
    let deleted = 0;
    for (const id of ids) {
      try {
        await this.remove(id);
        deleted++;
      } catch {
        // 忽略不存在的角色
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
  ): Promise<Character | null> {
    const characters = await this.characterRepository
      .createQueryBuilder("character")
      .where("character.project_id = :projectId", { projectId })
      .andWhere("LOWER(character.name) = LOWER(:name)", { name })
      .andWhere("character.deleted_at IS NULL")
      .getMany();
    return characters[0] ?? null;
  }

  // ==================== 批量创建 ====================

  /**
   * 从剧本批量创建角色
   */
  async batchCreate(
    projectId: string,
    userId: string,
    dto: BatchCreateCharactersDto,
  ): Promise<BatchCreateCharactersResultDto> {
    const result: BatchCreateCharactersResultDto = {
      created: 0,
      characters: [],
      errors: [],
    };

    for (const charData of dto.characters) {
      try {
        // 检查名称是否已存在
        const existing = await this.characterRepository.findOne({
          where: { projectId, name: charData.name, deletedAt: IsNull() },
        });

        if (existing) {
          result.errors?.push({
            name: charData.name,
            error: "角色名称已存在",
            errorCode: 8001,
          });
          continue;
        }

        const character = this.characterRepository.create({
          projectId,
          name: charData.name,
          description: charData.description ?? null,
          personality: charData.personality ?? null,
          age: charData.age ?? null,
          gender: (charData.gender as CharacterGenderType) ?? null,
          importance: charData.importance ?? CharacterImportance.MINOR,
          status: CharacterStatus.DRAFT,
          scriptRef: {
            scriptId: dto.scriptId,
            extractedAt: new Date().toISOString(),
            importance: charData.importance ?? CharacterImportance.MINOR,
          },
          createdBy: userId,
        });

        await this.characterRepository.save(character);

        result.created++;
        result.characters.push({
          id: character.id,
          name: character.name,
          status: character.status,
          createdAt: character.createdAt.toISOString(),
        });
      } catch (error) {
        result.errors?.push({
          name: charData.name,
          error: error instanceof Error ? error.message : "创建失败",
          errorCode: 8000,
        });
      }
    }

    return result;
  }

  // ==================== 图片管理 ====================

  /**
   * 异步生成角色参考图
   * 使用 ImageGenerationService 创建生成任务
   */
  async generateImage(
    characterId: string,
    dto: GenerateImageDto,
  ): Promise<GenerateImageTaskDto> {
    const character = await this.characterRepository.findOne({
      where: { id: characterId, deletedAt: IsNull() },
    });

    if (!character) {
      throw new NotFoundException({
        code: 8000,
        message: "角色不存在",
      });
    }

    // 构建提示词
    const prompt = buildScriptAssetImagePrompt(
      character.name,
      character.description || "",
      "character",
      dto.customPrompt,
      {
        gender: character.gender || undefined,
        age: character.age || undefined,
      },
    );

    // 获取默认模型 ID
    const modelId = dto.modelId || "z-image-turbo";

    // 查询角色的参考图（ADDITIONAL 类型）
    const referenceImages = await this.characterImageRepository.find({
      where: { characterId, type: CharacterImageType.ADDITIONAL, isCurrent: true },
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
      // 资产上下文：图片生成完成后自动回链到角色
      parameters: {
        assetType: "character",
        assetId: characterId,
        imageType: dto.type || "front_view",
        referenceImages: referenceImageUrls.length > 0 ? referenceImageUrls : undefined,
      },
    };

    // 如果有参考图，第一张用于启用 image_to_image 模式
    if (referenceImageUrls.length > 0) {
      taskConfig.referenceImageUrl = referenceImageUrls[0];
    }

    const task = await this.imageGenerationService.createImageGenerationTask(
      character.createdBy,
      {
        projectId: character.projectId,
        sceneType: "character_views",
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
   * 上传角色参考图
   */
  async uploadImage(
    characterId: string,
    type: CharacterImageTypeType,
    fileUrl: string,
    thumbnailUrl: string,
    uploadInfo: UploadInfo,
  ): Promise<CharacterImageDto> {
    const character = await this.characterRepository.findOne({
      where: { id: characterId, deletedAt: IsNull() },
    });

    if (!character) {
      throw new NotFoundException({
        code: 8000,
        message: "角色不存在",
      });
    }

    // 如果是非 additional 类型，清理旧版本的物理文件和数据库记录
    if (type !== CharacterImageType.ADDITIONAL) {
      const oldImages = await this.characterImageRepository.find({
        where: { characterId, type, isCurrent: true },
      });
      for (const oldImage of oldImages) {
        if (oldImage.url) {
          await this.imageStorageService.deleteImage(oldImage.url);
        }
        if (oldImage.thumbnailUrl && oldImage.thumbnailUrl !== oldImage.url) {
          await this.imageStorageService.deleteImage(oldImage.thumbnailUrl);
        }
        await this.characterImageRepository.remove(oldImage);
      }
    }

    // 计算新版本号
    const lastImage = await this.characterImageRepository.findOne({
      where: { characterId, type },
      order: { version: "DESC" },
    });
    const newVersion = (lastImage?.version ?? 0) + 1;

    const image = this.characterImageRepository.create({
      characterId,
      type,
      url: fileUrl,
      thumbnailUrl,
      uploadInfo,
      version: newVersion,
      isCurrent: true,
    });

    await this.characterImageRepository.save(image);

    // 如果角色是 draft 状态，且上传了第一张图片，自动设为 active
    if (character.status === CharacterStatus.DRAFT) {
      const imageCount = await this.characterImageRepository.count({
        where: { characterId },
      });
      if (imageCount === 1) {
        character.status = CharacterStatus.ACTIVE;
        await this.characterRepository.save(character);
      }
    }

    return this.toImageDto(image);
  }

  /**
   * 删除角色参考图
   */
  async deleteImage(characterId: string, imageId: string): Promise<void> {
    const image = await this.characterImageRepository.findOne({
      where: { id: imageId, characterId },
    });

    if (!image) {
      throw new NotFoundException({
        code: 8004,
        message: "角色图片不存在",
      });
    }

    if (image.url) {
      await this.imageStorageService.deleteImage(image.url);
    }
    if (image.thumbnailUrl && image.thumbnailUrl !== image.url) {
      await this.imageStorageService.deleteImage(image.thumbnailUrl);
    }

    await this.characterImageRepository.remove(image);
  }

  // ==================== 跨项目导入 ====================

  /**
   * 从其他项目导入角色
   */
  async importFromProject(
    targetProjectId: string,
    userId: string,
    dto: ImportCharactersDto,
  ): Promise<ImportCharactersResultDto> {
    const result: ImportCharactersResultDto = {
      imported: 0,
      characters: [],
      errors: [],
    };

    for (const sourceCharacterId of dto.sourceCharacterIds) {
      try {
        // 查找源角色
        const sourceCharacter = await this.characterRepository.findOne({
          where: {
            id: sourceCharacterId,
            projectId: dto.sourceProjectId,
            deletedAt: IsNull(),
          },
          relations: ["images"],
        });

        if (!sourceCharacter) {
          result.errors?.push({
            sourceCharacterId,
            error: "源角色不存在",
            errorCode: 8008,
          });
          continue;
        }

        // 检查名称是否冲突
        let newName = sourceCharacter.name;
        const existing = await this.characterRepository.findOne({
          where: {
            projectId: targetProjectId,
            name: newName,
            deletedAt: IsNull(),
          },
        });

        if (existing) {
          newName = `${newName}_导入`;
          // 再次检查
          const stillExisting = await this.characterRepository.findOne({
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

        // 创建新角色
        const newCharacter = this.characterRepository.create({
          projectId: targetProjectId,
          name: newName,
          description: sourceCharacter.description,
          personality: sourceCharacter.personality,
          age: sourceCharacter.age,
          gender: sourceCharacter.gender,
          occupation: sourceCharacter.occupation,
          background: sourceCharacter.background,
          appearance: sourceCharacter.appearance,
          importance: sourceCharacter.importance,
          status: CharacterStatus.ACTIVE,
          importInfo: {
            sourceProjectId: dto.sourceProjectId,
            sourceCharacterId,
            importedAt: new Date().toISOString(),
          },
          createdBy: userId,
        });

        await this.characterRepository.save(newCharacter);

        // 复制图片引用
        for (const sourceImage of sourceCharacter.images ?? []) {
          if (sourceImage.isCurrent) {
            await this.characterImageRepository.save({
              characterId: newCharacter.id,
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
        result.characters.push({
          id: newCharacter.id,
          name: newCharacter.name,
          sourceCharacterId,
          importedAt:
            newCharacter.importInfo?.importedAt ?? new Date().toISOString(),
        });
      } catch (error) {
        result.errors?.push({
          sourceCharacterId,
          error: error instanceof Error ? error.message : "导入失败",
          errorCode: 8008,
        });
      }
    }

    return result;
  }

  // ==================== DTO 转换 ====================

  private toListItemDto(character: Character): CharacterListItemDto {
    const images: CharacterListItemDto["images"] = {};
    const referenceImages: Array<{ id?: string; url?: string; thumbnailUrl?: string | null }> = [];

    // 按创建时间排序，确保图片顺序一致
    const sortedImages = [...(character.images ?? [])].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );

    for (const image of sortedImages) {
      if (image.isCurrent) {
        const imageData = {
          url: image.url,
          thumbnailUrl: image.thumbnailUrl ?? undefined,
        };
        switch (image.type) {
          case CharacterImageType.FRONT_VIEW:
            images.frontView = imageData;
            break;
          case CharacterImageType.SIDE_VIEW:
            images.sideView = imageData;
            break;
          case CharacterImageType.BACK_VIEW:
            images.backView = imageData;
            break;
          case CharacterImageType.ANGLE_VIEW:
            images.angleView = imageData;
            break;
          case CharacterImageType.ADDITIONAL:
            referenceImages.push({
              id: image.id,
              url: image.url,
              thumbnailUrl: image.thumbnailUrl ?? undefined,
            });
            break;
        }
      }
    }

    if (referenceImages.length > 0) {
      images.referenceImages = referenceImages;
    }

    return {
      id: character.id,
      name: character.name,
      description: character.description,
      gender: character.gender,
      age: character.age,
      importance: character.importance,
      status: character.status,
      images,
      createdAt: character.createdAt.toISOString(),
      updatedAt: character.updatedAt.toISOString(),
    };
  }

  private toDetailDto(character: Character): CharacterDetailDto {
    const images: CharacterDetailDto["images"] = { additional: [] };

    for (const image of character.images ?? []) {
      const imageDto = this.toImageDto(image);
      if (image.isCurrent) {
        switch (image.type) {
          case CharacterImageType.FRONT_VIEW:
            images.frontView = imageDto;
            break;
          case CharacterImageType.SIDE_VIEW:
            images.sideView = imageDto;
            break;
          case CharacterImageType.BACK_VIEW:
            images.backView = imageDto;
            break;
          case CharacterImageType.ANGLE_VIEW:
            images.angleView = imageDto;
            break;
          case CharacterImageType.ADDITIONAL:
            images.additional.push(imageDto);
            break;
        }
      }
    }

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
      images,
      scriptRef: character.scriptRef,
      importInfo: character.importInfo,
      createdAt: character.createdAt.toISOString(),
      updatedAt: character.updatedAt.toISOString(),
      createdBy: character.createdBy,
    };
  }

  private toImageDto(image: CharacterImage): CharacterImageDto {
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
