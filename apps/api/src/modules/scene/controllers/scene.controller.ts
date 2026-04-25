import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  Req,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { ProjectGuard } from "../../project/guards/project.guard";
import { SceneService } from "../services/scene.service";
import { ImageStorageService } from "../../image-gen/services";
import type { FastifyRequest } from "fastify";
import {
  CreateSceneSchema,
  UpdateSceneSchema,
  QueryScenesSchema,
  BatchCreateScenesSchema,
  ImportScenesSchema,
  CreateSceneDto,
  UpdateSceneDto,
  QueryScenesDto,
  BatchCreateScenesDto,
  ImportScenesDto,
  SceneImageType,
  VariantType,
  type GenerateSceneImageDto,
} from "../dto";

@ApiTags("场景管理")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class SceneController {
  constructor(
    private readonly sceneService: SceneService,
    private readonly imageStorageService: ImageStorageService,
  ) {}

  // ==================== 场景 CRUD ====================

  @ApiOperation({ summary: "创建场景" })
  @Post("projects/:projectId/scenes")
  @UseGuards(ProjectGuard)
  async create(
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(CreateSceneSchema)) dto: CreateSceneDto,
    @Request() req: { user: { userId: string } },
  ) {
    return {
      code: 0,
      data: await this.sceneService.create(projectId, req.user.userId, dto),
      msg: "success",
      timestamp: Date.now(),
    };
  }

  @ApiOperation({ summary: "获取场景列表" })
  @Get("projects/:projectId/scenes")
  @UseGuards(ProjectGuard)
  async findAll(
    @Param("projectId") projectId: string,
    @Query(new ZodValidationPipe(QueryScenesSchema)) query: QueryScenesDto,
  ) {
    return {
      code: 0,
      data: await this.sceneService.findAll(projectId, query),
      msg: "success",
      timestamp: Date.now(),
    };
  }

  @ApiOperation({ summary: "获取场景详情" })
  @Get("scenes/:sceneId")
  async findOne(@Param("sceneId", ParseUUIDPipe) sceneId: string) {
    return {
      code: 0,
      data: await this.sceneService.findById(sceneId),
      msg: "success",
      timestamp: Date.now(),
    };
  }

  @ApiOperation({ summary: "更新场景" })
  @Patch("scenes/:sceneId")
  async update(
    @Param("sceneId", ParseUUIDPipe) sceneId: string,
    @Body(new ZodValidationPipe(UpdateSceneSchema)) dto: UpdateSceneDto,
  ) {
    return {
      code: 0,
      data: await this.sceneService.update(sceneId, dto),
      msg: "success",
      timestamp: Date.now(),
    };
  }

  @ApiOperation({ summary: "删除场景" })
  @Delete("scenes/:sceneId")
  async remove(@Param("sceneId", ParseUUIDPipe) sceneId: string) {
    await this.sceneService.remove(sceneId);
    return {
      code: 0,
      data: null,
      msg: "success",
      timestamp: Date.now(),
    };
  }

  @ApiOperation({ summary: "批量删除场景" })
  @Delete("scenes/batch")
  async batchRemove(@Body() body: { ids: string[] }) {
    const result = await this.sceneService.batchRemove(body.ids);
    return {
      code: 0,
      data: result,
      msg: "success",
      timestamp: Date.now(),
    };
  }

  // ==================== 批量创建 ====================

  @ApiOperation({ summary: "从剧本批量创建场景" })
  @Post("projects/:projectId/scenes/batch")
  @UseGuards(ProjectGuard)
  async batchCreate(
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(BatchCreateScenesSchema))
    dto: BatchCreateScenesDto,
    @Request() req: { user: { userId: string } },
  ) {
    return {
      code: 0,
      data: await this.sceneService.batchCreate(
        projectId,
        req.user.userId,
        dto,
      ),
      msg: "success",
      timestamp: Date.now(),
    };
  }

  // ==================== 图片管理 ====================

  @ApiOperation({ summary: "异步生成场景参考图" })
  @Post("scenes/:sceneId/images/generate")
  async generateImage(
    @Param("sceneId", ParseUUIDPipe) sceneId: string,
    @Body() body: Record<string, unknown>,
  ) {
    // 手动验证并应用默认值
    const allowedTypes = ["panorama", "wide_shot", "variant"] as const;
    const type = (body.type || "panorama") as string;
    if (!allowedTypes.includes(type as typeof allowedTypes[number])) {
      throw new BadRequestException(`type 必须是 ${allowedTypes.join(", ")} 之一`);
    }

    // 验证 variantType
    const allowedVariantTypes = ["time_of_day", "weather"] as const;
    let variantType: "time_of_day" | "weather" | undefined;
    if (body.variantType && allowedVariantTypes.includes(body.variantType as typeof allowedVariantTypes[number])) {
      variantType = body.variantType as "time_of_day" | "weather";
    }

    const dto: GenerateSceneImageDto = {
      type: type as "panorama" | "wide_shot" | "variant",
      variantType,
      variantValue: body.variantValue as string | undefined,
      modelId: body.modelId as string | undefined,
      customPrompt: body.customPrompt as string | undefined,
    };

    return {
      code: 0,
      data: await this.sceneService.generateImage(sceneId, dto),
      msg: "success",
      timestamp: Date.now(),
    };
  }

  @ApiOperation({ summary: "上传场景参考图" })
  @Post("scenes/:sceneId/images/upload")
  async uploadImage(
    @Req() req: FastifyRequest,
    @Param("sceneId", ParseUUIDPipe) sceneId: string,
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
      SceneImageType.PANORAMA,
      SceneImageType.WIDE_SHOT,
      SceneImageType.DETAIL,
      SceneImageType.VARIANT,
      SceneImageType.ADDITIONAL,
    ];
    const resolvedType = allowedTypes.includes(type as SceneImageType)
      ? (type as SceneImageType)
      : SceneImageType.PANORAMA;

    // 读取文件 buffer 并上传到存储
    const buffer = await file.toBuffer();
    const format = file.mimetype.split("/")[1] || "png";
    const uploaded = await this.imageStorageService.uploadImage(buffer, {
      projectId: "scene",
      taskId: sceneId,
      index: 0,
      format,
    });

    // 调用 service 创建图片记录
    const imageDto = await this.sceneService.uploadImage(
      sceneId,
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

  @ApiOperation({ summary: "删除场景参考图" })
  @Delete("scenes/:sceneId/images/:imageId")
  async deleteImage(
    @Param("sceneId", ParseUUIDPipe) sceneId: string,
    @Param("imageId", ParseUUIDPipe) imageId: string,
  ) {
    await this.sceneService.deleteImage(sceneId, imageId);
    return {
      code: 0,
      data: null,
      msg: "success",
      timestamp: Date.now(),
    };
  }

  // ==================== 跨项目导入 ====================

  @ApiOperation({ summary: "从其他项目导入场景" })
  @Post("projects/:projectId/scenes/import")
  @UseGuards(ProjectGuard)
  async importFromProject(
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(ImportScenesSchema)) dto: ImportScenesDto,
    @Request() req: { user: { userId: string } },
  ) {
    return {
      code: 0,
      data: await this.sceneService.importFromProject(
        projectId,
        req.user.userId,
        dto,
      ),
      msg: "success",
      timestamp: Date.now(),
    };
  }
}
