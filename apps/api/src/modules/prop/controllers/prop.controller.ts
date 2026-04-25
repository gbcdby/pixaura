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
  BadRequestException,
  Req,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { FastifyRequest } from "fastify";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { ProjectGuard } from "../../project/guards/project.guard";
import { PropService } from "../services/prop.service";
import { ImageStorageService } from "../../image-gen/services";
import {
  CreatePropSchema,
  UpdatePropSchema,
  QueryPropsSchema,
  BatchCreatePropsSchema,
  GeneratePropImageSchema,
  UploadPropImageSchema,
  ImportPropsSchema,
  CreatePropDto,
  UpdatePropDto,
  QueryPropsDto,
  BatchCreatePropsDto,
  GeneratePropImageDto,
  UploadPropImageDto,
  ImportPropsDto,
} from "../dto";
import {
  PropImageType,
  PropImageTypeType,
} from "../entities/prop-image.entity";

@ApiTags("道具管理")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class PropController {
  constructor(
    private readonly propService: PropService,
    private readonly imageStorageService: ImageStorageService,
  ) {}

  // ==================== 道具 CRUD ====================

  @ApiOperation({ summary: "创建道具" })
  @Post("projects/:projectId/props")
  @UseGuards(ProjectGuard)
  async create(
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(CreatePropSchema)) dto: CreatePropDto,
    @Request() req: { user: { userId: string } },
  ) {
    return {
      code: 0,
      data: await this.propService.create(projectId, req.user.userId, dto),
      msg: "success",
      timestamp: Date.now(),
    };
  }

  @ApiOperation({ summary: "获取道具列表" })
  @Get("projects/:projectId/props")
  @UseGuards(ProjectGuard)
  async findAll(
    @Param("projectId") projectId: string,
    @Query(new ZodValidationPipe(QueryPropsSchema)) query: QueryPropsDto,
  ) {
    return {
      code: 0,
      data: await this.propService.findAll(projectId, query),
      msg: "success",
      timestamp: Date.now(),
    };
  }

  @ApiOperation({ summary: "获取道具详情" })
  @Get("props/:propId")
  async findOne(@Param("propId", ParseUUIDPipe) propId: string) {
    return {
      code: 0,
      data: await this.propService.findById(propId),
      msg: "success",
      timestamp: Date.now(),
    };
  }

  @ApiOperation({ summary: "更新道具" })
  @Patch("props/:propId")
  async update(
    @Param("propId", ParseUUIDPipe) propId: string,
    @Body(new ZodValidationPipe(UpdatePropSchema)) dto: UpdatePropDto,
  ) {
    return {
      code: 0,
      data: await this.propService.update(propId, dto),
      msg: "success",
      timestamp: Date.now(),
    };
  }

  @ApiOperation({ summary: "删除道具" })
  @Delete("props/:propId")
  async remove(@Param("propId", ParseUUIDPipe) propId: string) {
    await this.propService.remove(propId);
    return {
      code: 0,
      data: null,
      msg: "success",
      timestamp: Date.now(),
    };
  }

  @ApiOperation({ summary: "批量删除道具" })
  @Delete("props/batch")
  async batchRemove(@Body() body: { ids: string[] }) {
    const result = await this.propService.batchRemove(body.ids);
    return {
      code: 0,
      data: result,
      msg: "success",
      timestamp: Date.now(),
    };
  }

  // ==================== 批量创建 ====================

  @ApiOperation({ summary: "从剧本批量创建道具" })
  @Post("projects/:projectId/props/batch")
  @UseGuards(ProjectGuard)
  async batchCreate(
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(BatchCreatePropsSchema))
    dto: BatchCreatePropsDto,
    @Request() req: { user: { userId: string } },
  ) {
    return {
      code: 0,
      data: await this.propService.batchCreate(projectId, req.user.userId, dto),
      msg: "success",
      timestamp: Date.now(),
    };
  }

  // ==================== 图片管理 ====================

  @ApiOperation({ summary: "异步生成道具参考图" })
  @Post("props/:propId/images/generate")
  async generateImage(
    @Param("propId", ParseUUIDPipe) propId: string,
    @Body(new ZodValidationPipe(GeneratePropImageSchema))
    dto: GeneratePropImageDto,
  ) {
    return {
      code: 0,
      data: await this.propService.generateImage(propId, dto),
      msg: "success",
      timestamp: Date.now(),
    };
  }

  @ApiOperation({ summary: "上传道具参考图" })
  @Post("props/:propId/images/upload")
  async uploadImage(
    @Req() req: FastifyRequest,
    @Param("propId", ParseUUIDPipe) propId: string,
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
      PropImageType.FRONT_VIEW,
      PropImageType.SIDE_VIEW,
      PropImageType.TOP_VIEW,
      PropImageType.ADDITIONAL,
    ];
    const resolvedType: PropImageTypeType = allowedTypes.includes(
      type as PropImageTypeType,
    )
      ? (type as PropImageTypeType)
      : PropImageType.FRONT_VIEW;

    // 读取文件 buffer 并上传到存储
    const buffer = await file.toBuffer();
    const format = file.mimetype.split("/")[1] || "png";
    const uploaded = await this.imageStorageService.uploadImage(buffer, {
      projectId: "prop",
      taskId: propId,
      index: 0,
      format,
    });

    // 调用 service 创建图片记录
    const imageDto = await this.propService.uploadImage(
      propId,
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

  @ApiOperation({ summary: "删除道具参考图" })
  @Delete("props/:propId/images/:imageId")
  async deleteImage(
    @Param("propId", ParseUUIDPipe) propId: string,
    @Param("imageId", ParseUUIDPipe) imageId: string,
  ) {
    await this.propService.deleteImage(propId, imageId);
    return {
      code: 0,
      data: null,
      msg: "success",
      timestamp: Date.now(),
    };
  }

  // ==================== 跨项目导入 ====================

  @ApiOperation({ summary: "从其他项目导入道具" })
  @Post("projects/:projectId/props/import")
  @UseGuards(ProjectGuard)
  async importFromProject(
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(ImportPropsSchema)) dto: ImportPropsDto,
    @Request() req: { user: { userId: string } },
  ) {
    return {
      code: 0,
      data: await this.propService.importFromProject(
        projectId,
        req.user.userId,
        dto,
      ),
      msg: "success",
      timestamp: Date.now(),
    };
  }
}
