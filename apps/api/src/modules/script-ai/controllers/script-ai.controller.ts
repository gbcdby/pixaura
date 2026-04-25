import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  ParseUUIDPipe,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ScriptService } from "../../script/services/script.service";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { ProjectGuard } from "../../project/guards/project.guard";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import {
  AIGenerateScriptSchema,
  AIContinueSchema,
  AIRewriteSchema,
  AIExpandSchema,
  AICondenseSchema,
  ImportScriptSchema,
} from "../../script/dto";
import {
  AITask,
  AITaskStatus,
  AITaskType,
  type AITaskTypeType,
} from "../../script/entities/ai-task.entity";
import { Script, ScriptStatus } from "../../script/entities/script.entity";
import { ProjectModelConfig } from "../../project/entities/project-model-config.entity";

/**
 * 剧本 AI 控制器
 * 提供剧本生成、解析、编辑等 AI 相关 API
 */
@ApiTags("剧本 AI 生成")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectGuard)
@Controller("projects/:projectId/ai-scripts")
export class ScriptAIController {
  constructor(
    private readonly scriptService: ScriptService,
    @InjectRepository(AITask)
    private readonly aiTaskRepository: Repository<AITask>,
    @InjectRepository(Script)
    private readonly scriptRepository: Repository<Script>,
    @InjectRepository(ProjectModelConfig)
    private readonly projectModelConfigRepository: Repository<ProjectModelConfig>,
    @InjectQueue("script-ai-generate")
    private readonly scriptAIGenerateQueue: Queue,
    @InjectQueue("script-ai-parse")
    private readonly scriptAIParseQueue: Queue,
    @InjectQueue("ai-text-stream")
    private readonly streamQueue: Queue,
  ) {}

  // ==================== AI 生成剧本 ====================

  @Post("generate")
  @ApiOperation({ summary: "AI 生成剧本" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  async generateScript(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(AIGenerateScriptSchema))
    dto: {
      idea: string;
      genre?: string;
      tone?: string;
      targetDuration?: number;
      characterCount?: number;
      modelId?: string;
    },
  ) {
    // 检查项目权限
    await this.scriptService.checkProjectAccess(
      req.user.userId,
      projectId,
      "editor",
    );

    // 创建空白剧本
    const script = await this.scriptService.createScript(
      req.user.userId,
      projectId,
      {
        title: "AI生成中...",
        content: {
          characters: [],
          scenes: [],
          props: [],
          shotGroups: [],
          bgmTracks: [],
        },
        metadata: {
          genre: dto.genre,
          tone: dto.tone,
          targetDuration: dto.targetDuration,
          source: "ai" as const,
          aiGenerated: true,
          totalScenes: 0,
          totalParagraphs: 0,
          wordCount: 0,
        },
      },
    );

    // 更新剧本状态为生成中
    script.status = ScriptStatus.AI_GENERATING;
    await this.scriptRepository.save(script);

    // 创建 AI 任务
    const task = this.aiTaskRepository.create({
      scriptId: script.id,
      type: AITaskType.GENERATE,
      status: AITaskStatus.PENDING,
      config: dto,
      createdBy: req.user.userId,
    });

    const savedTask = await this.aiTaskRepository.save(task);

    // 添加到剧本AI生成队列
    await this.scriptAIGenerateQueue.add(
      savedTask.id,
      {
        taskId: savedTask.id,
        type: "generate",
        requestData: dto,
        modelId: dto.modelId || null, // 使用传入的模型ID或默认模型
      },
      {
        jobId: savedTask.id,
        priority: 40, // 剧本生成优先级较高
      },
    );

    return {
      code: 0,
      data: {
        scriptId: script.id,
        taskId: savedTask.id,
        status: "pending",
        streamEndpoint: `/api/scripts/${script.id}/ai-tasks/${savedTask.id}/stream`,
        estimatedTime: 60, // 预估60秒
      },
      msg: "success",
      timestamp: Date.now(),
    };
  }

  // ==================== 剧本导入解析 ====================

  /**
   * 导入剧本（AI解析）
   * @deprecated 已废弃，前端未使用。如需导入剧本，请使用手动创建后点击"一键解析"流程。
   */
  @Post("import")
  @ApiOperation({
    summary: "导入剧本（AI解析）- 已废弃",
    description: "此接口已废弃，请使用手动创建剧本后点击一键解析",
  })
  @ApiParam({ name: "projectId", description: "项目ID" })
  async importScript(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(ImportScriptSchema))
    dto: {
      content: string;
    },
  ) {
    // 检查项目权限
    await this.scriptService.checkProjectAccess(
      req.user.userId,
      projectId,
      "editor",
    );

    // 检查内容长度
    if (dto.content.length > 5 * 1024 * 1024) {
      throw new BadRequestException("导入文件过大，最大支持 5MB");
    }

    // 获取项目配置的文本模型
    const textModelConfig = await this.projectModelConfigRepository.findOne({
      where: { projectId, category: "TEXT_GENERATION" },
    });
    const textModelId = textModelConfig?.modelId;

    if (!textModelId) {
      throw new BadRequestException(
        "项目未配置文本生成模型，请先在项目设置中配置",
      );
    }

    // 创建空白剧本
    const script = await this.scriptService.createScript(
      req.user.userId,
      projectId,
      {
        title: "解析中...",
        content: {
          characters: [],
          scenes: [],
          props: [],
          shotGroups: [],
          bgmTracks: [],
        },
        metadata: {
          source: "import" as const,
          aiGenerated: false,
          totalScenes: 0,
          totalParagraphs: 0,
          wordCount: 0,
        },
      },
    );

    // 更新剧本状态为生成中（使用 AI 解析）
    script.status = ScriptStatus.AI_GENERATING;
    await this.scriptRepository.save(script);

    // 创建 AI 解析任务
    const task = this.aiTaskRepository.create({
      scriptId: script.id,
      type: AITaskType.PARSE,
      status: AITaskStatus.PENDING,
      config: {
        content: dto.content,
        isImport: true,
        modelId: textModelId,
      },
      createdBy: req.user.userId,
    });

    const savedTask = await this.aiTaskRepository.save(task);

    // 添加到剧本AI解析队列
    await this.scriptAIParseQueue.add(
      savedTask.id,
      {
        taskId: savedTask.id,
        type: "parse",
        requestData: {
          content: dto.content,
          filename: "imported.txt",
        },
        modelId: textModelId, // 使用项目配置的文本模型
      },
      {
        jobId: savedTask.id,
        priority: 40,
      },
    );

    return {
      code: 0,
      data: {
        scriptId: script.id,
        taskId: savedTask.id,
        status: "pending",
        streamEndpoint: `/api/scripts/${script.id}/ai-tasks/${savedTask.id}/stream`,
        estimatedTime: 30,
      },
      msg: "success",
      timestamp: Date.now(),
    };
  }

  // ==================== AI 任务查询 ====================

  @Get(":scriptId/ai-tasks/:taskId")
  @ApiOperation({ summary: "查询 AI 任务状态" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @ApiParam({ name: "taskId", description: "任务ID" })
  async getAITask(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Param("taskId", ParseUUIDPipe) taskId: string,
  ) {
    // 检查项目权限
    await this.scriptService.checkProjectAccess(req.user.userId, projectId);

    const task = await this.aiTaskRepository.findOne({
      where: { id: taskId, scriptId },
    });

    if (!task) {
      throw new NotFoundException("AI 任务不存在");
    }

    return {
      code: 0,
      data: {
        taskId: task.id,
        scriptId: task.scriptId,
        type: task.type,
        status: task.status,
        progress: task.progress,
        result: task.result,
        error: task.error
          ? {
              code: "GENERATION_ERROR",
              message: task.error,
              recoverable: task.status === AITaskStatus.FAILED,
            }
          : undefined,
        createdAt: task.createdAt,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
      },
      msg: "success",
      timestamp: Date.now(),
    };
  }

  // ==================== AI 编辑任务（流式） ====================

  @Post(":scriptId/ai-continue")
  @ApiOperation({ summary: "AI 续写" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  async continueWithAI(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Body(new ZodValidationPipe(AIContinueSchema))
    dto: {
      sceneId: string;
      afterParagraphId?: string;
      length?: "short" | "medium" | "long";
      style?: "match" | "casual" | "dramatic";
    },
  ) {
    return this.createAIEditTask(
      req.user.userId,
      projectId,
      scriptId,
      AITaskType.CONTINUE,
      dto,
    );
  }

  @Post(":scriptId/ai-rewrite")
  @ApiOperation({ summary: "AI 改写" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  async rewriteWithAI(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Body(new ZodValidationPipe(AIRewriteSchema))
    dto: {
      paragraphIds: string[];
      instruction: string;
    },
  ) {
    return this.createAIEditTask(
      req.user.userId,
      projectId,
      scriptId,
      AITaskType.REWRITE,
      dto,
    );
  }

  @Post(":scriptId/ai-expand")
  @ApiOperation({ summary: "AI 扩写" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  async expandWithAI(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Body(new ZodValidationPipe(AIExpandSchema))
    dto: {
      paragraphIds: string[];
      targetLength?: "50%" | "100%" | "200%";
    },
  ) {
    return this.createAIEditTask(
      req.user.userId,
      projectId,
      scriptId,
      AITaskType.EXPAND,
      dto,
    );
  }

  @Post(":scriptId/ai-condense")
  @ApiOperation({ summary: "AI 缩写" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  async condenseWithAI(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Body(new ZodValidationPipe(AICondenseSchema))
    dto: {
      paragraphIds: string[];
      targetLength?: "50%" | "30%";
    },
  ) {
    return this.createAIEditTask(
      req.user.userId,
      projectId,
      scriptId,
      AITaskType.CONDENSE,
      dto,
    );
  }

  /**
   * 创建 AI 编辑任务
   */
  private async createAIEditTask(
    userId: string,
    projectId: string,
    scriptId: string,
    type: AITaskTypeType,
    dto: Record<string, unknown>,
  ) {
    // 检查剧本可编辑性
    const script = await this.scriptService.checkScriptEditable(
      scriptId,
      userId,
    );

    if (script.projectId !== projectId) {
      throw new NotFoundException("剧本不存在");
    }

    // 获取剧本内容作为上下文（从 description 和 storyboards 中提取）
    const scriptContent = script.content as {
      storyboards?: Array<{
        id?: string;
        description?: string;
        dialogues?: Array<{
          characterName?: string;
          text?: string;
        }>;
      }>;
    };

    // 提取上下文内容（从 storyboards 中提取对白）
    let context = "";

    // 优先使用 description 作为上下文
    if (script.description?.trim()) {
      context = script.description.trim();
    } else if (
      scriptContent.storyboards &&
      scriptContent.storyboards.length > 0
    ) {
      // 从分镜中提取对白
      const lines: string[] = [];
      for (const storyboard of scriptContent.storyboards) {
        if (storyboard.description) {
          lines.push(`[场景] ${storyboard.description}`);
        }
        for (const dialogue of storyboard.dialogues || []) {
          if (dialogue.characterName && dialogue.text) {
            lines.push(`${dialogue.characterName}：${dialogue.text}`);
          }
        }
      }
      context = lines.join("\n\n");
    }

    // 创建 AI 任务
    const task = this.aiTaskRepository.create({
      scriptId,
      type,
      status: AITaskStatus.PENDING,
      config: {
        ...dto,
        originalContent: context,
      },
      createdBy: userId,
    });

    const savedTask = await this.aiTaskRepository.save(task);

    // 添加到流式队列
    await this.streamQueue.add(
      savedTask.id,
      {
        taskId: savedTask.id,
        type,
        requestData: {
          ...dto,
          originalContent: context,
        },
        modelId: null,
      },
      {
        jobId: savedTask.id,
        priority: 50,
      },
    );

    return {
      code: 0,
      data: {
        taskId: savedTask.id,
        status: "pending",
        streamEndpoint: `/api/scripts/${scriptId}/ai-tasks/${savedTask.id}/stream`,
      },
      msg: "success",
      timestamp: Date.now(),
    };
  }

  // ==================== AI 任务重试/取消 ====================

  @Post(":scriptId/ai-tasks/:taskId/retry")
  @ApiOperation({ summary: "重试 AI 任务" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  @ApiParam({ name: "taskId", description: "任务ID" })
  async retryAITask(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Param("taskId", ParseUUIDPipe) taskId: string,
  ) {
    // 检查项目权限
    await this.scriptService.checkProjectAccess(
      req.user.userId,
      projectId,
      "editor",
    );

    const task = await this.aiTaskRepository.findOne({
      where: { id: taskId, scriptId },
    });

    if (!task) {
      throw new NotFoundException("AI 任务不存在");
    }

    if (task.status !== AITaskStatus.FAILED) {
      throw new ConflictException("只有失败的任务可以重试");
    }

    // 创建新任务
    const newTask = this.aiTaskRepository.create({
      scriptId,
      type: task.type,
      status: AITaskStatus.PENDING,
      config: task.config,
      createdBy: req.user.userId,
    });

    const savedTask = await this.aiTaskRepository.save(newTask);

    // 根据任务类型选择队列
    const streamTaskTypes: AITaskTypeType[] = [
      AITaskType.CONTINUE,
      AITaskType.REWRITE,
      AITaskType.EXPAND,
      AITaskType.CONDENSE,
    ];
    const isStreamTask = streamTaskTypes.includes(task.type);

    let queue = this.streamQueue;
    if (task.type === AITaskType.GENERATE) {
      queue = this.scriptAIGenerateQueue;
    } else if (task.type === AITaskType.PARSE) {
      queue = this.scriptAIParseQueue;
    }

    await queue.add(
      savedTask.id,
      {
        taskId: savedTask.id,
        type: task.type,
        requestData: task.config,
        modelId: null,
      },
      {
        jobId: savedTask.id,
        priority: 40,
      },
    );

    return {
      code: 0,
      data: {
        newTaskId: savedTask.id,
        status: "pending",
        streamEndpoint: isStreamTask
          ? `/api/scripts/${scriptId}/ai-tasks/${savedTask.id}/stream`
          : undefined,
      },
      msg: "success",
      timestamp: Date.now(),
    };
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
    // 检查项目权限
    await this.scriptService.checkProjectAccess(
      req.user.userId,
      projectId,
      "editor",
    );

    const task = await this.aiTaskRepository.findOne({
      where: { id: taskId, scriptId },
    });

    if (!task) {
      throw new NotFoundException("AI 任务不存在");
    }

    if (
      task.status !== AITaskStatus.PENDING &&
      task.status !== AITaskStatus.PROCESSING
    ) {
      throw new ConflictException("任务已结束，无法取消");
    }

    // 从队列中移除
    if (task.status === AITaskStatus.PENDING) {
      let queue = this.streamQueue;
      if (task.type === AITaskType.GENERATE) {
        queue = this.scriptAIGenerateQueue;
      } else if (task.type === AITaskType.PARSE) {
        queue = this.scriptAIParseQueue;
      }

      const job = await queue.getJob(taskId);
      if (job) {
        await job.remove();
      }
    }

    // 更新任务状态
    task.status = AITaskStatus.CANCELLED;
    task.completedAt = new Date();
    await this.aiTaskRepository.save(task);

    return {
      code: 0,
      data: {
        taskId: task.id,
        status: "cancelled",
        refundAmount: 0, // 未开始或进行中取消，全额返还
      },
      msg: "success",
      timestamp: Date.now(),
    };
  }

  // ==================== 剧本重新生成 ====================

  @Post(":scriptId/regenerate")
  @ApiOperation({ summary: "重新生成剧本" })
  @ApiParam({ name: "projectId", description: "项目ID" })
  @ApiParam({ name: "scriptId", description: "剧本ID" })
  async regenerateScript(
    @Request() req: { user: { userId: string } },
    @Param("projectId") projectId: string,
    @Param("scriptId", ParseUUIDPipe) scriptId: string,
    @Body() dto: { modelId?: string; description?: string },
  ) {
    const result = await this.scriptService.regenerateScript(
      req.user.userId,
      projectId,
      scriptId,
      { modelId: dto.modelId, description: dto.description },
    );

    return {
      code: 0,
      data: {
        taskId: result.taskId,
        status: result.status,
        estimatedTime: result.estimatedTime || 60,
      },
      msg: "success",
      timestamp: Date.now(),
    };
  }
}
