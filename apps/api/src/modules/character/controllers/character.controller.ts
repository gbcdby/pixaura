import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  Request,
  ParseUUIDPipe,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { FastifyRequest } from "fastify";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { ProjectGuard } from "../../project/guards/project.guard";
import { CharacterService } from "../services/character.service";
import { ImageStorageService } from "../../image-gen/services";
import {
  CreateCharacterSchema,
  UpdateCharacterSchema,
  QueryCharactersSchema,
  BatchCreateCharactersSchema,
  GenerateImageSchema,
  UploadImageSchema,
  ImportCharactersSchema,
  CreateCharacterDto,
  UpdateCharacterDto,
  QueryCharactersDto,
  BatchCreateCharactersDto,
  GenerateImageDto,
  UploadImageDto,
  ImportCharactersDto,
} from "../dto";
import {
  CharacterImageType,
  CharacterImageTypeType,
} from "../entities/character-image.entity";

@ApiTags("角色管理")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class CharacterController {
  constructor(
    private readonly characterService: CharacterService,
    private readonly imageStorageService: ImageStorageService,
  ) {}

  // ==================== 角色 CRUD ====================

  @ApiOperation({ summary: "创建角色" })
  @Post("projects/:projectId/characters")
  @UseGuards(ProjectGuard)
  async create(
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(CreateCharacterSchema)) dto: CreateCharacterDto,
    @Request() req: { user: { userId: string } },
  ) {
    return {
      code: 0,
      data: await this.characterService.create(projectId, req.user.userId, dto),
      msg: "success",
      timestamp: Date.now(),
    };
  }

  @ApiOperation({ summary: "获取角色列表" })
  @Get("projects/:projectId/characters")
  @UseGuards(ProjectGuard)
  async findAll(
    @Param("projectId") projectId: string,
    @Query(new ZodValidationPipe(QueryCharactersSchema))
    query: QueryCharactersDto,
  ) {
    return {
      code: 0,
      data: await this.characterService.findAll(projectId, query),
      msg: "success",
      timestamp: Date.now(),
    };
  }

  @ApiOperation({ summary: "获取角色详情" })
  @Get("characters/:characterId")
  async findOne(@Param("characterId", ParseUUIDPipe) characterId: string) {
    return {
      code: 0,
      data: await this.characterService.findById(characterId),
      msg: "success",
      timestamp: Date.now(),
    };
  }

  @ApiOperation({ summary: "更新角色" })
  @Patch("characters/:characterId")
  async update(
    @Param("characterId", ParseUUIDPipe) characterId: string,
    @Body(new ZodValidationPipe(UpdateCharacterSchema)) dto: UpdateCharacterDto,
  ) {
    return {
      code: 0,
      data: await this.characterService.update(characterId, dto),
      msg: "success",
      timestamp: Date.now(),
    };
  }

  @ApiOperation({ summary: "删除角色" })
  @Delete("characters/:characterId")
  async remove(@Param("characterId", ParseUUIDPipe) characterId: string) {
    await this.characterService.remove(characterId);
    return {
      code: 0,
      data: null,
      msg: "success",
      timestamp: Date.now(),
    };
  }

  @ApiOperation({ summary: "批量删除角色" })
  @Delete("characters/batch")
  async batchRemove(@Body() body: { ids: string[] }) {
    const result = await this.characterService.batchRemove(body.ids);
    return {
      code: 0,
      data: result,
      msg: "success",
      timestamp: Date.now(),
    };
  }

  // ==================== 批量创建 ====================

  @ApiOperation({ summary: "从剧本批量创建角色" })
  @Post("projects/:projectId/characters/batch")
  @UseGuards(ProjectGuard)
  async batchCreate(
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(BatchCreateCharactersSchema))
    dto: BatchCreateCharactersDto,
    @Request() req: { user: { userId: string } },
  ) {
    return {
      code: 0,
      data: await this.characterService.batchCreate(
        projectId,
        req.user.userId,
        dto,
      ),
      msg: "success",
      timestamp: Date.now(),
    };
  }

  // ==================== 图片管理 ====================

  @ApiOperation({ summary: "异步生成角色参考图" })
  @Post("characters/:characterId/images/generate")
  async generateImage(
    @Param("characterId", ParseUUIDPipe) characterId: string,
    @Body(new ZodValidationPipe(GenerateImageSchema)) dto: GenerateImageDto,
  ) {
    return {
      code: 0,
      data: await this.characterService.generateImage(characterId, dto),
      msg: "success",
      timestamp: Date.now(),
    };
  }

  @ApiOperation({ summary: "上传角色参考图" })
  @Post("characters/:characterId/images/upload")
  async uploadImage(
    @Req() req: FastifyRequest,
    @Param("characterId", ParseUUIDPipe) characterId: string,
    @Query("type") type?: string,
  ) {
    // 获取上传的文件
    const file = await req.file({ limits: { fileSize: 5 * 1024 * 1024 } });
    if (!file) {
      throw new BadRequestException("请选择要上传的文件");
    }

    // 验证文件类型
    const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException("仅支持 jpg/jpeg/png/webp 格式");
    }

    // 验证并应用 type 参数
    const allowedTypes = [
      CharacterImageType.FRONT_VIEW,
      CharacterImageType.SIDE_VIEW,
      CharacterImageType.BACK_VIEW,
      CharacterImageType.ANGLE_VIEW,
      CharacterImageType.ADDITIONAL,
    ];
    const resolvedType: CharacterImageTypeType = allowedTypes.includes(
      type as CharacterImageTypeType,
    )
      ? (type as CharacterImageTypeType)
      : CharacterImageType.FRONT_VIEW;

    // 读取文件 buffer 并上传到存储
    const buffer = await file.toBuffer();
    const format = file.mimetype.split("/")[1] || "png";
    const uploaded = await this.imageStorageService.uploadImage(buffer, {
      projectId: "character", // 角色图片使用占位 projectId
      taskId: characterId,
      index: 0,
      format,
    });

    // 调用 service 创建图片记录
    const imageDto = await this.characterService.uploadImage(
      characterId,
      resolvedType,
      uploaded.url,
      uploaded.thumbnailUrl,
      {
        originalFilename: file.filename,
        mimeType: file.mimetype,
        fileSize: buffer.length,
        uploadedAt: new Date().toISOString(),
      },
    );

    return {
      code: 0,
      data: imageDto,
      msg: "success",
      timestamp: Date.now(),
    };
  }

  @ApiOperation({ summary: "删除角色参考图" })
  @Delete("characters/:characterId/images/:imageId")
  async deleteImage(
    @Param("characterId", ParseUUIDPipe) characterId: string,
    @Param("imageId", ParseUUIDPipe) imageId: string,
  ) {
    await this.characterService.deleteImage(characterId, imageId);
    return {
      code: 0,
      data: null,
      msg: "success",
      timestamp: Date.now(),
    };
  }

  // ==================== 跨项目导入 ====================

  @ApiOperation({ summary: "从其他项目导入角色" })
  @Post("projects/:projectId/characters/import")
  @UseGuards(ProjectGuard)
  async importFromProject(
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(ImportCharactersSchema))
    dto: ImportCharactersDto,
    @Request() req: { user: { userId: string } },
  ) {
    return {
      code: 0,
      data: await this.characterService.importFromProject(
        projectId,
        req.user.userId,
        dto,
      ),
      msg: "success",
      timestamp: Date.now(),
    };
  }
}
