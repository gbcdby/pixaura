import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { ScriptStoryboardService } from "../services/script-storyboard.service";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { ProjectGuard } from "../../project/guards/project.guard";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import {
  CreateStoryboardRefSchema,
  UpdateStoryboardRefSchema,
  ReorderStoryboardsSchema,
  ContinueStoryboardsSchema,
  GenerateStoryboardVideoSchema,
  GenerateStoryboardDialogueSchema,
  GenerateAllStoryboardsSchema,
  type CreateStoryboardRefDto,
  type UpdateStoryboardRefDto,
  type ReorderStoryboardsDto,
  type ContinueStoryboardsDto,
  type GenerateStoryboardVideoDto,
  type GenerateStoryboardDialogueDto,
  type GenerateAllStoryboardsDto,
} from "../dto/script-storyboard.dto";

@ApiTags("剧本分镜")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("projects/:projectId/scripts/:scriptId/storyboards")
export class ScriptStoryboardController {
  constructor(
    private readonly scriptStoryboardService: ScriptStoryboardService,
  ) {}

  @ApiOperation({ summary: "获取分镜列表" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @Get()
  @UseGuards(ProjectGuard)
  async getStoryboards(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
  ) {
    return this.scriptStoryboardService.getStoryboards(
      req.user.userId,
      projectId,
      scriptId,
    );
  }

  @ApiOperation({ summary: "创建分镜" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @Post()
  @UseGuards(ProjectGuard)
  async createStoryboard(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Body(new ZodValidationPipe(CreateStoryboardRefSchema))
    dto: CreateStoryboardRefDto,
  ) {
    return this.scriptStoryboardService.createStoryboard(
      req.user.userId,
      projectId,
      scriptId,
      dto,
    );
  }

  @ApiOperation({ summary: "更新分镜" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @ApiParam({ name: "storyboardId", description: "分镜ID" })
  @Put(":storyboardId")
  @UseGuards(ProjectGuard)
  async updateStoryboard(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Param("storyboardId") storyboardId: string,
    @Body(new ZodValidationPipe(UpdateStoryboardRefSchema))
    dto: UpdateStoryboardRefDto,
  ) {
    return this.scriptStoryboardService.updateStoryboard(
      req.user.userId,
      projectId,
      scriptId,
      storyboardId,
      dto,
    );
  }

  @ApiOperation({ summary: "删除分镜" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @ApiParam({ name: "storyboardId", description: "分镜ID" })
  @Delete(":storyboardId")
  @UseGuards(ProjectGuard)
  async deleteStoryboard(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Param("storyboardId") storyboardId: string,
  ) {
    return this.scriptStoryboardService.deleteStoryboard(
      req.user.userId,
      projectId,
      scriptId,
      storyboardId,
    );
  }

  @ApiOperation({ summary: "重新排序分镜" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @Put("reorder")
  @UseGuards(ProjectGuard)
  async reorderStoryboards(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Body(new ZodValidationPipe(ReorderStoryboardsSchema))
    dto: ReorderStoryboardsDto,
  ) {
    return this.scriptStoryboardService.reorderStoryboards(
      req.user.userId,
      projectId,
      scriptId,
      dto,
    );
  }

  @ApiOperation({ summary: "续写分镜" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @Post("continue")
  @UseGuards(ProjectGuard)
  async continueStoryboards(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Body(new ZodValidationPipe(ContinueStoryboardsSchema))
    dto: ContinueStoryboardsDto,
  ) {
    return this.scriptStoryboardService.continueStoryboards(
      req.user.userId,
      projectId,
      scriptId,
      dto,
    );
  }

  @ApiOperation({
    summary: "生成分镜视频（异步队列，通过 WebSocket 推送进度）",
  })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @Post("generate-video")
  @UseGuards(ProjectGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async generateStoryboardVideo(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Body(new ZodValidationPipe(GenerateStoryboardVideoSchema))
    dto: GenerateStoryboardVideoDto,
  ) {
    return this.scriptStoryboardService.generateStoryboardVideo(
      req.user.userId,
      projectId,
      scriptId,
      dto,
    );
  }

  @ApiOperation({ summary: "AI 生成分镜对话台词（同步，直接返回结果）" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @Post("generate-dialogue")
  @UseGuards(ProjectGuard)
  @HttpCode(HttpStatus.OK)
  async generateStoryboardDialogue(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Body(new ZodValidationPipe(GenerateStoryboardDialogueSchema))
    dto: GenerateStoryboardDialogueDto,
  ) {
    return this.scriptStoryboardService.generateStoryboardDialogue(
      req.user.userId,
      projectId,
      scriptId,
      dto,
    );
  }

  @ApiOperation({
    summary: "一键 AI 生成所有分镜（异步，通过 WebSocket 推送进度）",
  })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @Post("generate-all")
  @UseGuards(ProjectGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async generateAllStoryboards(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Body(new ZodValidationPipe(GenerateAllStoryboardsSchema))
    dto: GenerateAllStoryboardsDto,
  ) {
    return this.scriptStoryboardService.generateAllStoryboards(
      req.user.userId,
      projectId,
      scriptId,
      dto,
    );
  }
}
