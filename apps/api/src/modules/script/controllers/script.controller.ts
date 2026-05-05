import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { ScriptService } from "../services/script.service";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { ProjectGuard } from "../../project/guards/project.guard";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import {
  CreateScriptSchema,
  UpdateScriptSchema,
  QueryScriptsSchema,
  AIGenerateScriptSchema,
  ImportScriptSchema,
  ParseScriptSchema,
  AIContinueSchema,
  AIRewriteSchema,
  AIExpandSchema,
  AICondenseSchema,
  ImportAssetFromProjectSchema,
  QueryImportableAssetsSchema,
  ConfirmScriptSchema,
  UpdateScriptDescriptionSchema,
  RegenerateScriptSchema,
  UpdateScriptModelConfigsSchema,
  UpdateScriptCharactersSchema,
  UpdateScriptScenesSchema,
  UpdateScriptPropsSchema,
  UpdateScriptShotGroupSchema,
  UpdateScriptShotGroupsSchema,
  UpdateScriptCreationSettingsSchema,
  UpdateScriptStoryboardSettingsSchema,
} from "../dto";

@ApiTags("剧本管理")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectGuard)
@Controller("projects/:projectId/scripts")
export class ScriptController {
  constructor(private readonly scriptService: ScriptService) {}

  // ==================== 剧本 CRUD ====================

  @Post()
  @ApiOperation({ summary: "创建空白剧本" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  async createScript(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(CreateScriptSchema)) dto: unknown,
  ) {
    return this.scriptService.createScript(
      req.user.userId,
      projectId,
      dto as any,
    );
  }

  @Post("generate")
  @ApiOperation({ summary: "AI 生成剧本" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  async generateScriptWithAI(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(AIGenerateScriptSchema)) dto: unknown,
  ) {
    return this.scriptService.generateScriptWithAI(
      req.user.userId,
      projectId,
      dto as any,
    );
  }

  @Post("import")
  @ApiOperation({ summary: "导入剧本" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  async importScript(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(ImportScriptSchema)) dto: unknown,
  ) {
    return this.scriptService.importScript(
      req.user.userId,
      projectId,
      dto as any,
    );
  }

  @Get()
  @ApiOperation({ summary: "查询剧本列表" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  async queryScripts(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Query(new ZodValidationPipe(QueryScriptsSchema)) dto: unknown,
  ) {
    return this.scriptService.queryScripts(
      req.user.userId,
      projectId,
      dto as any,
    );
  }

  @Get(":scriptId")
  @ApiOperation({ summary: "获取剧本详情" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  async getScript(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
  ) {
    return this.scriptService.getScript(req.user.userId, projectId, scriptId);
  }

  @Put(":scriptId")
  @ApiOperation({ summary: "更新剧本" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  async updateScript(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Body(new ZodValidationPipe(UpdateScriptSchema)) dto: unknown,
  ) {
    return this.scriptService.updateScript(
      req.user.userId,
      projectId,
      scriptId,
      dto as any,
    );
  }

  @Delete(":scriptId")
  @ApiOperation({ summary: "删除剧本" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  async deleteScript(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
  ) {
    await this.scriptService.deleteScript(req.user.userId, projectId, scriptId);
    return { success: true };
  }

  // ==================== AI 辅助编辑 ====================

  @Post(":scriptId/ai/continue")
  @ApiOperation({ summary: "AI 续写" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  async continueWithAI(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Body(new ZodValidationPipe(AIContinueSchema)) dto: unknown,
  ) {
    return this.scriptService.continueWithAI(
      req.user.userId,
      projectId,
      scriptId,
      dto as any,
    );
  }

  @Post(":scriptId/ai/rewrite")
  @ApiOperation({ summary: "AI 改写" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  async rewriteWithAI(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Body(new ZodValidationPipe(AIRewriteSchema)) dto: unknown,
  ) {
    return this.scriptService.rewriteWithAI(
      req.user.userId,
      projectId,
      scriptId,
      dto as any,
    );
  }

  @Post(":scriptId/ai/expand")
  @ApiOperation({ summary: "AI 扩写" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  async expandWithAI(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Body(new ZodValidationPipe(AIExpandSchema)) dto: unknown,
  ) {
    return this.scriptService.expandWithAI(
      req.user.userId,
      projectId,
      scriptId,
      dto as any,
    );
  }

  @Post(":scriptId/ai/condense")
  @ApiOperation({ summary: "AI 缩写" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  async condenseWithAI(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Body(new ZodValidationPipe(AICondenseSchema)) dto: unknown,
  ) {
    return this.scriptService.condenseWithAI(
      req.user.userId,
      projectId,
      scriptId,
      dto as any,
    );
  }

  @Get(":scriptId/ai-tasks/:taskId")
  @ApiOperation({ summary: "获取 AI 任务状态" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @ApiParam({ name: "taskId", description: "任务ID" })
  async getAITask(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Param("taskId", ParseUUIDPipe) taskId: string,
  ) {
    return this.scriptService.getAITask(
      req.user.userId,
      projectId,
      scriptId,
      taskId,
    );
  }

  @Post(":scriptId/ai-tasks/:taskId/cancel")
  @ApiOperation({ summary: "取消 AI 任务" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @ApiParam({ name: "taskId", description: "任务ID" })
  async cancelAITask(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Param("taskId", ParseUUIDPipe) taskId: string,
  ) {
    return this.scriptService.cancelAITask(
      req.user.userId,
      projectId,
      scriptId,
      taskId,
    );
  }

  // ==================== 跨项目资产导入 ====================

  @Get("importable-assets")
  @ApiOperation({ summary: "查询可导入的资产列表" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  async queryImportableAssets(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Query(new ZodValidationPipe(QueryImportableAssetsSchema)) dto: unknown,
  ) {
    return this.scriptService.queryImportableAssets(
      req.user.userId,
      projectId,
      dto as any,
    );
  }

  @Post(":scriptId/import-asset")
  @ApiOperation({ summary: "从其他项目导入资产" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  async importAssetFromProject(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Body(new ZodValidationPipe(ImportAssetFromProjectSchema)) dto: unknown,
  ) {
    return this.scriptService.importAssetFromProject(
      req.user.userId,
      projectId,
      scriptId,
      dto as any,
    );
  }

  // ==================== 剧本确认 ====================

  @Get(":scriptId/confirm-preview")
  @ApiOperation({ summary: "获取确认预览" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  async getConfirmPreview(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
  ) {
    return this.scriptService.getConfirmPreview(
      req.user.userId,
      projectId,
      scriptId,
    );
  }

  @Post(":scriptId/confirm")
  @ApiOperation({ summary: "确认剧本" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  async confirmScript(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Body(new ZodValidationPipe(ConfirmScriptSchema)) dto: unknown,
  ) {
    return this.scriptService.confirmScript(
      req.user.userId,
      projectId,
      scriptId,
      dto as any,
    );
  }

  // ==================== 剧本编辑页面重构 - 新API ====================

  @Get(":scriptId/edit")
  @ApiOperation({ summary: "获取剧本编辑详情" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  async getScriptEditDetail(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
  ) {
    return this.scriptService.getScriptEditDetail(
      req.user.userId,
      projectId,
      scriptId,
    );
  }

  @Put(":scriptId/description")
  @ApiOperation({ summary: "更新剧本描述" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  async updateScriptDescription(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Body(new ZodValidationPipe(UpdateScriptDescriptionSchema)) dto: unknown,
  ) {
    return this.scriptService.updateScriptDescription(
      req.user.userId,
      projectId,
      scriptId,
      dto as any,
    );
  }

  @Post(":scriptId/regenerate")
  @ApiOperation({ summary: "重新生成剧本" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  async regenerateScript(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Body(new ZodValidationPipe(RegenerateScriptSchema)) dto: unknown,
  ) {
    return this.scriptService.regenerateScript(
      req.user.userId,
      projectId,
      scriptId,
      dto as any,
    );
  }

  @Get(":scriptId/tasks/:taskId")
  @ApiOperation({ summary: "获取任务状态" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @ApiParam({ name: "taskId", description: "任务ID" })
  async getTaskStatus(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Param("taskId", ParseUUIDPipe) taskId: string,
  ) {
    return this.scriptService.getTaskStatus(
      req.user.userId,
      projectId,
      scriptId,
      taskId,
    );
  }

  @Delete(":scriptId/tasks/:taskId")
  @ApiOperation({ summary: "取消任务" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @ApiParam({ name: "taskId", description: "任务ID" })
  async cancelTask(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Param("taskId", ParseUUIDPipe) taskId: string,
  ) {
    return this.scriptService.cancelTask(
      req.user.userId,
      projectId,
      scriptId,
      taskId,
    );
  }

  // ==================== 剧本模型配置 ====================

  @Get(":scriptId/models")
  @ApiOperation({ summary: "获取剧本模型配置" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  async getScriptModelConfigs(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
  ) {
    return this.scriptService.getScriptModelConfigs(
      req.user.userId,
      projectId,
      scriptId,
    );
  }

  @Put(":scriptId/models")
  @ApiOperation({ summary: "更新剧本模型配置" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  async updateScriptModelConfigs(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Body(new ZodValidationPipe(UpdateScriptModelConfigsSchema)) dto: unknown,
  ) {
    return this.scriptService.updateScriptModelConfigs(
      req.user.userId,
      projectId,
      scriptId,
      dto as any,
    );
  }

  // ==================== 剧本资源解析 ====================

  @Post(":scriptId/parse-resources")
  @ApiOperation({ summary: "解析剧本资源" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  async parseScriptResources(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Query("force") force?: string,
  ) {
    return this.scriptService.parseScriptResources(
      req.user.userId,
      projectId,
      scriptId,
      force === "true",
    );
  }

  @Get(":scriptId/parse-resources/status")
  @ApiOperation({ summary: "获取剧本资源解析任务状态" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  async getParseTaskStatus(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
  ) {
    return this.scriptService.getParseTaskStatus(
      req.user.userId,
      projectId,
      scriptId,
    );
  }

  // ==================== 分镜解析 ====================

  @Post(":scriptId/parse-storyboards")
  @ApiOperation({ summary: "解析剧本分镜" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  async parseStoryboards(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Query("force") force?: string,
  ) {
    return this.scriptService.parseStoryboards(
      req.user.userId,
      projectId,
      scriptId,
      force === "true",
    );
  }

  // ==================== 剧本解析（一键解析）====================

  /**
   * @deprecated 已废弃，前端未使用。新版请使用 parseScriptResources 接口。
   */
  @Post(":scriptId/parse")
  @ApiOperation({
    summary: "解析剧本内容为结构化数据 - 已废弃",
    description: "此接口已废弃，请使用 parse-resources 接口",
  })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  async parseScript(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Body(new ZodValidationPipe(ParseScriptSchema)) dto: unknown,
  ) {
    return this.scriptService.parseScript(
      req.user.userId,
      projectId,
      scriptId,
      dto as any,
    );
  }

  // ==================== 细粒度更新接口（竞态问题改造）====================

  @Put(":scriptId/characters")
  @ApiOperation({ summary: "更新剧本角色引用（字段级合并）" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  async updateScriptCharacters(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Body(new ZodValidationPipe(UpdateScriptCharactersSchema))
    dto: unknown,
  ) {
    return this.scriptService.updateScript(
      req.user.userId,
      projectId,
      scriptId,
      { content: { characters: (dto as { characters: unknown[] }).characters } } as any,
    );
  }

  @Put(":scriptId/scenes")
  @ApiOperation({ summary: "更新剧本场景引用（字段级合并）" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  async updateScriptScenes(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Body(new ZodValidationPipe(UpdateScriptScenesSchema))
    dto: unknown,
  ) {
    return this.scriptService.updateScript(
      req.user.userId,
      projectId,
      scriptId,
      { content: { scenes: (dto as { scenes: unknown[] }).scenes } } as any,
    );
  }

  @Put(":scriptId/props")
  @ApiOperation({ summary: "更新剧本道具引用（字段级合并）" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  async updateScriptProps(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Body(new ZodValidationPipe(UpdateScriptPropsSchema))
    dto: unknown,
  ) {
    return this.scriptService.updateScript(
      req.user.userId,
      projectId,
      scriptId,
      { content: { props: (dto as { props: unknown[] }).props } } as any,
    );
  }

  @Patch(":scriptId/shot-groups/:groupId")
  @ApiOperation({ summary: "部分更新分镜组（字段级合并）" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @ApiParam({ name: "groupId", description: "分镜组ID" })
  async updateScriptShotGroup(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Param("groupId") groupId: string,
    @Body(new ZodValidationPipe(UpdateScriptShotGroupSchema))
    dto: unknown,
  ) {
    return this.scriptService.updateScriptShotGroup(
      req.user.userId,
      projectId,
      scriptId,
      groupId,
      dto as Record<string, unknown>,
    );
  }

  @Put(":scriptId/shot-groups")
  @ApiOperation({ summary: "整段替换分镜组（字段级合并）" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  async updateScriptShotGroups(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Body(new ZodValidationPipe(UpdateScriptShotGroupsSchema))
    dto: unknown,
  ) {
    return this.scriptService.updateScript(
      req.user.userId,
      projectId,
      scriptId,
      {
        content: {
          shotGroups: (dto as { shotGroups: unknown[] }).shotGroups,
        },
      } as any,
    );
  }

  @Put(":scriptId/creation-settings")
  @ApiOperation({ summary: "更新剧本创作设置（字段级合并）" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  async updateScriptCreationSettings(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Body(new ZodValidationPipe(UpdateScriptCreationSettingsSchema))
    dto: unknown,
  ) {
    const body = dto as {
      resolution?: string;
      genre?: string;
      narrationVoiceId?: string;
      narrationInstructions?: string;
    };
    return this.scriptService.updateScript(
      req.user.userId,
      projectId,
      scriptId,
      {
        content: {
          resolution: body.resolution,
          genre: body.genre,
          narrationVoiceId: body.narrationVoiceId,
          narrationInstructions: body.narrationInstructions,
        },
      } as any,
    );
  }

  @Put(":scriptId/storyboard-settings")
  @ApiOperation({ summary: "更新分镜步骤默认配置（字段级合并）" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  async updateScriptStoryboardSettings(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Body(new ZodValidationPipe(UpdateScriptStoryboardSettingsSchema))
    dto: unknown,
  ) {
    return this.scriptService.updateScript(
      req.user.userId,
      projectId,
      scriptId,
      {
        content: {
          shotGroupSettings: (dto as { shotGroupSettings?: unknown })
            .shotGroupSettings,
        },
      } as any,
    );
  }
}
