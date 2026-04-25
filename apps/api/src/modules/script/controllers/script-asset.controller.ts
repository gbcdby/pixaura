import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { FastifyRequest } from "fastify";
import { ScriptAssetService } from "../services/script-asset.service";
import { ScriptAssetDedupService } from "../services/script-asset-dedup.service";
import { OssService } from "../../../common/oss/oss.service";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { ProjectGuard } from "../../project/guards/project.guard";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { z } from "zod";
import {
  GenerateCharactersSchema,
  GenerateScenesSchema,
  GeneratePropsSchema,
  BatchGenerateAssetsSchema,
  UpdateAssetSchema,
  GenerateAssetImageSchema,
  type GenerateCharactersDto,
  type GenerateScenesDto,
  type GeneratePropsDto,
  type BatchGenerateAssetsDto,
  type UpdateAssetDto,
  type GenerateAssetImageDto,
} from "../dto/script-asset.dto";
import {
  FileCategory,
  CreateAndLinkAssetSchema,
  LinkExistingAssetsSchema,
  ResolvedAssetResponse,
  type CreateAndLinkAssetDto,
  type LinkExistingAssetsDto,
} from "@pixaura/shared-types";

// 资产图片生成 DTO（角色/场景/道具通用）
const GenerateCharacterImageSchema = z.object({
  modelId: z.string().optional(),
  customPrompt: z.string().max(2000).optional(),
  negativePrompt: z.string().max(1000).optional(),
  // 图片比例（如 "9:16" / "16:9" / "1:1"），直接透传不做转换
  aspectRatio: z.string().optional(),
});

type GenerateCharacterImageDto = z.infer<typeof GenerateCharacterImageSchema>;

// 批量图片生成 DTO
const BatchGenerateImagesSchema = z.object({
  assetType: z.enum(["character", "scene", "prop"]).default("character"),
  modelId: z.string().optional(),
  customPrompt: z.string().max(2000).optional(),
  negativePrompt: z.string().max(1000).optional(),
  // 图片比例（如 "9:16" / "16:9" / "1:1"），直接透传不做转换
  aspectRatio: z.string().optional(),
});

type BatchGenerateImagesDto = z.infer<typeof BatchGenerateImagesSchema>;

@ApiTags("剧本资产")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("projects/:projectId/scripts/:scriptId")
export class ScriptAssetController {
  constructor(
    private readonly scriptAssetService: ScriptAssetService,
    private readonly scriptAssetDedupService: ScriptAssetDedupService,
    private readonly ossService: OssService,
  ) {}

  // ==================== 资产生成 ====================

  @ApiOperation({ summary: "生成角色" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @Post("characters/generate")
  @UseGuards(ProjectGuard)
  async generateCharacters(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Body(new ZodValidationPipe(GenerateCharactersSchema))
    dto: GenerateCharactersDto,
  ) {
    return this.scriptAssetService.generateCharacters(
      req.user.userId,
      projectId,
      scriptId,
      dto,
    );
  }

  @ApiOperation({ summary: "生成场景" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @Post("scenes/generate")
  @UseGuards(ProjectGuard)
  async generateScenes(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Body(new ZodValidationPipe(GenerateScenesSchema)) dto: GenerateScenesDto,
  ) {
    return this.scriptAssetService.generateScenes(
      req.user.userId,
      projectId,
      scriptId,
      dto,
    );
  }

  @ApiOperation({ summary: "生成道具" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @Post("props/generate")
  @UseGuards(ProjectGuard)
  async generateProps(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Body(new ZodValidationPipe(GeneratePropsSchema)) dto: GeneratePropsDto,
  ) {
    return this.scriptAssetService.generateProps(
      req.user.userId,
      projectId,
      scriptId,
      dto,
    );
  }

  // ==================== 批量生成 ====================

  @ApiOperation({ summary: "批量生成资产" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @Post("assets/batch-generate")
  @UseGuards(ProjectGuard)
  async batchGenerateAssets(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Body(new ZodValidationPipe(BatchGenerateAssetsSchema))
    dto: BatchGenerateAssetsDto,
  ) {
    return this.scriptAssetService.batchGenerateAssets(
      req.user.userId,
      projectId,
      scriptId,
      dto,
    );
  }

  // ==================== 资产CRUD ====================

  @ApiOperation({ summary: "更新资产" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @ApiParam({ name: "assetId", description: "资产ID" })
  @Put("assets/:assetId")
  @UseGuards(ProjectGuard)
  async updateAsset(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Param("assetId") assetId: string,
    @Body(new ZodValidationPipe(UpdateAssetSchema)) dto: UpdateAssetDto,
  ) {
    return this.scriptAssetService.updateAsset(
      req.user.userId,
      projectId,
      scriptId,
      assetId,
      dto,
    );
  }

  @ApiOperation({ summary: "删除资产" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @ApiParam({ name: "assetId", description: "资产ID" })
  @Delete("assets/:assetId")
  @UseGuards(ProjectGuard)
  async deleteAsset(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Param("assetId") assetId: string,
  ) {
    return this.scriptAssetService.deleteAsset(
      req.user.userId,
      projectId,
      scriptId,
      assetId,
    );
  }

  // ==================== 图片管理 ====================

  @ApiOperation({ summary: "生成资产图片" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @ApiParam({ name: "assetId", description: "资产ID" })
  @Post("assets/:assetId/images")
  @UseGuards(ProjectGuard)
  async generateAssetImage(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Param("assetId") assetId: string,
    @Body(new ZodValidationPipe(GenerateAssetImageSchema))
    dto: GenerateAssetImageDto,
  ) {
    return this.scriptAssetService.generateAssetImage(
      req.user.userId,
      projectId,
      scriptId,
      assetId,
      dto,
    );
  }

  @ApiOperation({ summary: "上传资产图片" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @ApiParam({ name: "assetId", description: "资产ID" })
  @Post("assets/:assetId/images/upload")
  @UseGuards(ProjectGuard)
  async uploadAssetImage(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Param("assetId") assetId: string,
    @Body() dto: { url: string; thumbnailUrl?: string; type?: string },
  ) {
    return this.scriptAssetService.uploadAssetImage(
      req.user.userId,
      projectId,
      scriptId,
      assetId,
      dto,
    );
  }

  @ApiOperation({
    summary: "文件上传资产图片（multipart），imageType 可为 main 或 reference",
  })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @ApiParam({ name: "assetId", description: "资产ID" })
  @Post("assets/:assetId/images/upload-file")
  @UseGuards(ProjectGuard)
  @HttpCode(HttpStatus.OK)
  async uploadAssetImageFile(
    @Req() req: FastifyRequest & { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Param("assetId") assetId: string,
    @Query("imageType") imageType?: string,
  ) {
    const file = await req.file({ limits: { fileSize: 5 * 1024 * 1024 } });
    if (!file) {
      throw new BadRequestException("请选择要上传的文件");
    }

    // 校验文件类型
    const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException("仅支持 jpg/jpeg/png/webp 格式");
    }

    const buffer = await file.toBuffer();
    const key = this.ossService.generateKey(
      FileCategory.IMAGE,
      file.filename || "upload.jpg",
      undefined,
      projectId,
    );
    const uploaded = await this.ossService.uploadFile(key, buffer, {
      mime: file.mimetype,
    });

    if (!uploaded) {
      throw new BadRequestException("文件上传失败，请稍后重试");
    }

    const allowedTypes = ["main", "reference", "video_reference"];
    const resolvedType = allowedTypes.includes(imageType ?? "")
      ? imageType
      : "reference";
    return this.scriptAssetService.uploadAssetImage(
      req.user.userId,
      projectId,
      scriptId,
      assetId,
      { url: uploaded.url, type: resolvedType },
    );
  }

  @ApiOperation({ summary: "删除资产图片" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @ApiParam({ name: "assetId", description: "资产ID" })
  @ApiParam({ name: "imageId", description: "图片ID" })
  @Delete("assets/:assetId/images/:imageId")
  @UseGuards(ProjectGuard)
  async deleteAssetImage(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Param("assetId") assetId: string,
    @Param("imageId") imageId: string,
  ) {
    return this.scriptAssetService.deleteAssetImage(
      req.user.userId,
      projectId,
      scriptId,
      assetId,
      imageId,
    );
  }

  // ==================== 查重接口 ====================

  @ApiOperation({ summary: "单资产查重" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @ApiParam({ name: "refId", description: "剧本内资产引用ID" })
  @ApiQuery({
    name: "assetType",
    enum: ["character", "scene", "prop"],
    description: "资产类型",
  })
  @Get("assets/:refId/dedup")
  @UseGuards(ProjectGuard)
  async dedupSingleAsset(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Param("refId") refId: string,
    @Query("assetType") assetType: "character" | "scene" | "prop",
  ) {
    return this.scriptAssetDedupService.dedupSingleAsset(
      req.user.userId,
      projectId,
      scriptId,
      refId,
      assetType,
    );
  }

  @ApiOperation({ summary: "批量查重（对所有 will_create 资产）" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @Post("assets/dedup-check")
  @UseGuards(ProjectGuard)
  @HttpCode(HttpStatus.OK)
  async dedupAllAssets(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
  ) {
    return this.scriptAssetDedupService.dedupAllAssets(
      req.user.userId,
      projectId,
      scriptId,
    );
  }

  // ==================== 角色图片生成接口 ====================

  @ApiOperation({ summary: "单个资产图片生成（角色/场景/道具，基于描述）" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @ApiParam({ name: "refId", description: "剧本内资产引用ID" })
  @Post("assets/:refId/generate-image")
  @UseGuards(ProjectGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async generateCharacterImage(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Param("refId") refId: string,
    @Body(new ZodValidationPipe(GenerateCharacterImageSchema))
    dto: GenerateCharacterImageDto,
  ) {
    return this.scriptAssetService.generateCharacterImage(
      req.user.userId,
      projectId,
      scriptId,
      refId,
      dto,
    );
  }

  @ApiOperation({ summary: "批量资产图片生成（角色/场景/道具）" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @Post("assets/batch-generate-images")
  @UseGuards(ProjectGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async batchGenerateCharacterImages(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Body(new ZodValidationPipe(BatchGenerateImagesSchema))
    dto: BatchGenerateImagesDto,
  ) {
    return this.scriptAssetService.batchGenerateCharacterImages(
      req.user.userId,
      projectId,
      scriptId,
      dto,
    );
  }

  @ApiOperation({ summary: "查询资产最新图片生成任务状态（降级轮询）" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @ApiParam({ name: "refId", description: "剧本内资产引用ID" })
  @ApiQuery({
    name: "assetType",
    enum: ["character", "scene", "prop"],
    description: "资产类型",
  })
  @Get("assets/:refId/image-tasks/latest")
  @UseGuards(ProjectGuard)
  async getLatestImageTask(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Param("refId") refId: string,
    @Query("assetType") assetType: "character" | "scene" | "prop",
  ) {
    return this.scriptAssetService.getLatestImageTask(
      req.user.userId,
      projectId,
      scriptId,
      refId,
      assetType,
    );
  }

  // ==================== 资产导入关联 ====================

  @ApiOperation({ summary: "创建资产并关联到剧本" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @Post("assets/create-and-link")
  @UseGuards(ProjectGuard)
  @HttpCode(HttpStatus.OK)
  async createAndLinkAsset(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Body(new ZodValidationPipe(CreateAndLinkAssetSchema))
    dto: CreateAndLinkAssetDto,
  ) {
    return this.scriptAssetService.createAndLinkAsset(
      req.user.userId,
      projectId,
      scriptId,
      dto,
    );
  }

  @ApiOperation({ summary: "批量关联已有资产到剧本" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @Post("assets/link-existing")
  @UseGuards(ProjectGuard)
  @HttpCode(HttpStatus.OK)
  async linkExistingAssets(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Body(new ZodValidationPipe(LinkExistingAssetsSchema))
    dto: LinkExistingAssetsDto,
  ) {
    return this.scriptAssetService.linkExistingAssets(
      req.user.userId,
      projectId,
      scriptId,
      dto,
    );
  }

  // ==================== 统一数据源：Resolved Assets ====================

  @ApiOperation({ summary: "获取剧本关联资产的完整数据（Ref + 素材库 Asset 组合）" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @Get("assets/resolved")
  @UseGuards(ProjectGuard)
  async getResolvedAssets(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
  ): Promise<ResolvedAssetResponse> {
    return this.scriptAssetService.resolveAssets(
      req.user.userId,
      projectId,
      scriptId,
    );
  }
}
