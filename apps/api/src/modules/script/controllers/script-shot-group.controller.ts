import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Req,
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
} from "@nestjs/swagger";
import { FastifyRequest } from "fastify";
import { ScriptShotGroupService } from "../services/script-shot-group.service";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { ProjectGuard } from "../../project/guards/project.guard";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import {
  DetectSubjectsSchema,
  GenerateLipSyncVideoSchema,
  UploadManualRegionSchema,
  UpdateCharacterRegionsSchema,
  CopyDialogueAudioSchema,
  type DetectSubjectsDto,
  type GenerateLipSyncVideoDto,
  type UploadManualRegionDto,
  type UpdateCharacterRegionsDto,
  type CopyDialogueAudioDto,
} from "../dto/script-shot-group.dto";

@ApiTags("分镜组")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("projects/:projectId/scripts/:scriptId/shotGroups")
export class ScriptShotGroupController {
  constructor(private readonly shotGroupService: ScriptShotGroupService) {}

  // ========== 主体检测 ==========

  @ApiOperation({ summary: "触发主体检测" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @ApiParam({ name: "shotGroupId", description: "分镜组ID" })
  @Post(":shotGroupId/detect-subjects")
  @UseGuards(ProjectGuard)
  @HttpCode(HttpStatus.OK)
  async detectSubjects(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Param("shotGroupId") shotGroupId: string,
    @Body(new ZodValidationPipe(DetectSubjectsSchema))
    _dto: DetectSubjectsDto,
  ) {
    return this.shotGroupService.detectSubjects(
      req.user.userId,
      projectId,
      scriptId,
      shotGroupId,
    );
  }

  // ========== 对口型视频生成 ==========

  @ApiOperation({ summary: "生成对口型视频" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @ApiParam({ name: "shotGroupId", description: "分镜组ID" })
  @ApiParam({ name: "shotId", description: "分镜ID" })
  @Post(":shotGroupId/shots/:shotId/lipsync")
  @UseGuards(ProjectGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async generateLipSyncVideo(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Param("shotGroupId") shotGroupId: string,
    @Param("shotId") shotId: string,
    @Body(new ZodValidationPipe(GenerateLipSyncVideoSchema))
    dto: GenerateLipSyncVideoDto,
  ) {
    return this.shotGroupService.generateLipSyncVideo(
      req.user.userId,
      projectId,
      scriptId,
      shotGroupId,
      shotId,
      dto,
    );
  }

  @ApiOperation({ summary: "查询对口型视频生成状态" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @ApiParam({ name: "shotGroupId", description: "分镜组ID" })
  @ApiParam({ name: "shotId", description: "分镜ID" })
  @Get(":shotGroupId/shots/:shotId/lipsync/status")
  @UseGuards(ProjectGuard)
  async getLipSyncVideoStatus(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Param("shotGroupId") shotGroupId: string,
    @Param("shotId") shotId: string,
  ) {
    return this.shotGroupService.getLipSyncVideoStatus(
      req.user.userId,
      projectId,
      scriptId,
      shotGroupId,
      shotId,
    );
  }

  // ========== 手动框选 ==========

  @ApiOperation({ summary: "保存手动框选坐标" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @ApiParam({ name: "shotGroupId", description: "分镜组ID" })
  @Post(":shotGroupId/regions/manual")
  @UseGuards(ProjectGuard)
  @HttpCode(HttpStatus.OK)
  async uploadManualRegion(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Param("shotGroupId") shotGroupId: string,
    @Body(new ZodValidationPipe(UploadManualRegionSchema))
    dto: UploadManualRegionDto,
  ) {
    return this.shotGroupService.uploadManualRegion(
      req.user.userId,
      projectId,
      scriptId,
      shotGroupId,
      dto,
    );
  }

  @ApiOperation({ summary: "更新角色框选配置" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @ApiParam({ name: "shotGroupId", description: "分镜组ID" })
  @Post(":shotGroupId/regions")
  @UseGuards(ProjectGuard)
  @HttpCode(HttpStatus.OK)
  async updateCharacterRegions(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Param("shotGroupId") shotGroupId: string,
    @Body(new ZodValidationPipe(UpdateCharacterRegionsSchema))
    dto: UpdateCharacterRegionsDto,
  ) {
    return this.shotGroupService.updateCharacterRegions(
      req.user.userId,
      projectId,
      scriptId,
      shotGroupId,
      dto,
    );
  }

  // ========== 临时文件接口 ==========

  @ApiOperation({ summary: "上传裁切后的图片" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @ApiParam({ name: "shotGroupId", description: "分镜组ID" })
  @Post(":shotGroupId/upload-cropped-image")
  @UseGuards(ProjectGuard)
  @HttpCode(HttpStatus.OK)
  async uploadCroppedImage(
    @Req() req: FastifyRequest & { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Param("shotGroupId") shotGroupId: string,
    @Query("characterId") characterId: string,
  ) {
    if (!characterId) {
      throw new BadRequestException("characterId 不能为空");
    }

    const file = await req.file({ limits: { fileSize: 50 * 1024 * 1024 } });
    if (!file) {
      throw new BadRequestException("请选择要上传的图片");
    }

    const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException("仅支持 jpg/jpeg/png/webp 格式");
    }

    const buffer = await file.toBuffer();

    return this.shotGroupService.uploadCroppedImage(
      req.user.userId,
      projectId,
      scriptId,
      shotGroupId,
      characterId,
      buffer,
    );
  }

  @ApiOperation({ summary: "复制对话音频到临时目录" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @ApiParam({ name: "shotGroupId", description: "分镜组ID" })
  @Post(":shotGroupId/copy-dialogue-audio")
  @UseGuards(ProjectGuard)
  @HttpCode(HttpStatus.OK)
  async copyDialogueAudioToTemp(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Param("shotGroupId") shotGroupId: string,
    @Body(new ZodValidationPipe(CopyDialogueAudioSchema))
    dto: CopyDialogueAudioDto,
  ) {
    return this.shotGroupService.copyDialogueAudioToTemp(
      req.user.userId,
      projectId,
      scriptId,
      shotGroupId,
      dto,
    );
  }

  // ========== 分镜组图片上传/删除 ==========

  @ApiOperation({ summary: "上传分镜组图片" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @ApiParam({ name: "shotGroupId", description: "分镜组ID" })
  @Post(":shotGroupId/images/upload")
  @UseGuards(ProjectGuard)
  @HttpCode(HttpStatus.OK)
  async uploadShotGroupImage(
    @Req() req: FastifyRequest & { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Param("shotGroupId") shotGroupId: string,
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
    return this.shotGroupService.uploadShotGroupImage(
      req.user.userId,
      projectId,
      scriptId,
      shotGroupId,
      buffer,
      file.filename || "upload.jpg",
      file.mimetype,
      imageType,
    );
  }

  @ApiOperation({ summary: "删除分镜组图片" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @ApiParam({ name: "shotGroupId", description: "分镜组ID" })
  @ApiParam({ name: "imageId", description: "图片ID" })
  @Delete(":shotGroupId/images/:imageId")
  @UseGuards(ProjectGuard)
  @HttpCode(HttpStatus.OK)
  async deleteShotGroupImage(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Param("shotGroupId") shotGroupId: string,
    @Param("imageId") imageId: string,
  ) {
    return this.shotGroupService.deleteShotGroupImage(
      req.user.userId,
      projectId,
      scriptId,
      shotGroupId,
      imageId,
    );
  }
}
