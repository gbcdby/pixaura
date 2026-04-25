import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  AITask,
  AITaskStatus,
  AITaskType,
} from "../../script/entities/ai-task.entity";
import { Script } from "../../script/entities/script.entity";
import { OpenAICompatibleProvider } from "../../ai/providers/openai-compatible.provider";
import {
  SCRIPT_CONTINUE_SYSTEM_PROMPT,
  SCRIPT_REWRITE_SYSTEM_PROMPT,
  SCRIPT_EXPAND_SYSTEM_PROMPT,
  SCRIPT_CONDENSE_SYSTEM_PROMPT,
  buildScriptContinueUserPrompt,
  buildScriptRewriteUserPrompt,
  buildScriptExpandUserPrompt,
  buildScriptCondenseUserPrompt,
  generateId,
} from "../../../prompts";
import { calculateAICost } from "../../../common/utils/ai-cost.util";
import { cleanJsonText } from "../../../common/utils/json.util";
import { ErrorCode } from "../../ai/config/ai.config";
import { TextGenQuotaService } from "../../billing/services/text-gen-quota.service";

/**
 * 剧本编辑 Worker
 * 处理续写/改写/扩写/缩写任务的 AI 任务
 */
@Processor("ai-text-stream", { concurrency: 5 })
export class ScriptEditWorker extends WorkerHost {
  private readonly logger = new Logger(ScriptEditWorker.name);

  constructor(
    @InjectRepository(AITask)
    private readonly aiTaskRepository: Repository<AITask>,
    @InjectRepository(Script)
    private readonly scriptRepository: Repository<Script>,
    private readonly aiProvider: OpenAICompatibleProvider,
    private readonly textGenQuotaService: TextGenQuotaService,
  ) {
    super();
  }

  /**
   * 处理剧本编辑任务
   */
  async process(job: Job): Promise<void> {
    const { taskId, type, requestData, modelId, providerId } = job.data;

    this.logger.log(`开始处理剧本编辑任务: ${taskId}, 类型: ${type}`);

    const startTime = Date.now();
    let firstChunkReceived = false;
    let chunkCount = 0;
    let fullText = "";

    try {
      // 1. 更新任务状态为处理中
      await this.updateTaskStatus(taskId, AITaskStatus.PROCESSING);

      // 2. 获取任务信息
      const aiTask = await this.aiTaskRepository.findOne({
        where: { id: taskId },
      });

      if (!aiTask) {
        throw new Error(`AI 任务不存在: ${taskId}`);
      }

      // 3. 构建提示词
      const { systemPrompt, userPrompt } = this.buildPrompts(type, requestData);

      // 4. 额度预扣减
      const fullPrompt = `${systemPrompt}\n${userPrompt}`;
      try {
        await this.textGenQuotaService.preDeduct(
          aiTask.createdBy,
          taskId,
          fullPrompt,
          modelId || "qwen2.5-7b",
          "edit",
        );
      } catch (quotaError) {
        this.logger.error(`额度预扣减失败: taskId=${taskId}`, quotaError instanceof Error ? quotaError.message : undefined);
        await this.updateTaskStatus(taskId, AITaskStatus.FAILED, {
          error: (quotaError as Error).message || "额度不足",
          errorCode: ErrorCode.GENERATION_FAILED,
        });
        throw quotaError;
      }

      // 5. 调用流式生成
      await new Promise<void>((resolve, reject) => {
        // 设置总超时（5分钟）
        const totalTimeout = setTimeout(() => {
          reject(new Error("Stream total timeout"));
        }, 300000);

        // 首字超时检查（30秒）
        const firstChunkTimeout = setTimeout(() => {
          if (!firstChunkReceived) {
            reject(new Error("First chunk timeout"));
          }
        }, 30000);

        this.aiProvider
          .generateTextStream(
            {
              prompt: userPrompt,
              systemPrompt,
              temperature: this.getTemperature(type),
              maxTokens: 4000,
            },
            modelId || "qwen2.5-7b",
            // onChunk - 收到内容块
            async (chunk) => {
              try {
                if (!firstChunkReceived) {
                  firstChunkReceived = true;
                  clearTimeout(firstChunkTimeout);
                  this.logger.log(
                    `首字到达: ${taskId}, 耗时: ${Date.now() - startTime}ms`,
                  );
                }

                chunkCount++;
                fullText += chunk;

                // 每 5 个 chunk 更新一次进度
                if (chunkCount % 5 === 0) {
                  const progress = Math.min(
                    Math.round((fullText.length / 2000) * 100),
                    99,
                  );
                  await this.aiTaskRepository.update(
                    { id: taskId },
                    { progress },
                  );
                }
              } catch (error) {
                this.logger.error(`处理 chunk 错误: ${error}`);
              }
            },
            // onComplete - 生成完成
            async (result) => {
              clearTimeout(totalTimeout);

              try {
                // 解析生成的内容
                const parsedResult = this.parseEditResult(fullText, type);

                // 更新任务状态
                await this.updateTaskStatus(taskId, AITaskStatus.COMPLETED, {
                  result: parsedResult,
                  tokensUsed: result.usage.totalTokens,
                  cost: calculateAICost(result.usage.totalTokens),
                });

                this.logger.log(
                  `剧本编辑任务完成: ${taskId}, chunks: ${chunkCount}, tokens: ${result.usage.totalTokens}`,
                );

                // 确认额度扣减
                try {
                  await this.textGenQuotaService.confirmDeduct(taskId, result.usage.totalTokens);
                } catch (confirmError) {
                  this.logger.warn(`确认额度扣减失败: taskId=${taskId}`, confirmError instanceof Error ? confirmError.message : undefined);
                }

                resolve();
              } catch (error) {
                reject(error);
              }
            },
            // onError - 生成出错
            async (error) => {
              clearTimeout(totalTimeout);

              this.logger.error(`流式生成错误: ${taskId}`);
              this.logger.debug("详细错误信息:", error);

              // 更新任务状态
              await this.updateTaskStatus(taskId, AITaskStatus.FAILED, {
                error: "处理失败",
                errorCode: "STREAM_GENERATION_ERROR",
              });

              reject(error);
            },
            providerId,
          )
          .catch(reject);
      });
    } catch (error) {
      const errorMessage = (error as Error).message;
      this.logger.error(`剧本编辑任务失败: ${taskId}, ${errorMessage}`);

      // 返还额度（任务失败时全额返还）
      try {
        await this.textGenQuotaService.refund(taskId, `编辑失败: ${errorMessage}`);
      } catch (refundError) {
        this.logger.warn(`返还额度失败: taskId=${taskId}`, refundError instanceof Error ? refundError.message : undefined);
      }

      // 判断错误类型
      let errorCode: string = ErrorCode.EDIT_FAILED;

      if (errorMessage.includes("timeout")) {
        errorCode = ErrorCode.STREAM_TIMEOUT;
      } else if (errorMessage.includes("connection")) {
        errorCode = ErrorCode.STREAM_TIMEOUT;
      }

      const userFriendlyMessage = errorMessage.includes("timeout")
        ? "处理超时，请稍后重试"
        : "处理失败，请稍后重试";

      // 更新任务状态（脱敏处理）
      await this.updateTaskStatus(taskId, AITaskStatus.FAILED, {
        error: userFriendlyMessage,
        errorCode,
      });

      throw error;
    }
  }

  /**
   * 构建提示词
   */
  private buildPrompts(
    type: string,
    requestData: Record<string, unknown>,
  ): { systemPrompt: string; userPrompt: string } {
    switch (type) {
      case AITaskType.CONTINUE:
        return {
          systemPrompt: SCRIPT_CONTINUE_SYSTEM_PROMPT,
          userPrompt: buildScriptContinueUserPrompt({
            context: requestData.context as string,
            length:
              (requestData.length as "short" | "medium" | "long") || "medium",
            style:
              (requestData.style as
                | "match"
                | "casual"
                | "dramatic"
                | "humorous") || "match",
            focusCharacter: requestData.focusCharacter as string,
          }),
        };

      case AITaskType.REWRITE:
        return {
          systemPrompt: SCRIPT_REWRITE_SYSTEM_PROMPT,
          userPrompt: buildScriptRewriteUserPrompt({
            originalContent: requestData.originalContent as string,
            instruction: requestData.instruction as string,
            preserveLength: requestData.preserveLength as boolean,
            style: requestData.style as
              | "formal"
              | "casual"
              | "dramatic"
              | "humorous",
          }),
        };

      case AITaskType.EXPAND:
        return {
          systemPrompt: SCRIPT_EXPAND_SYSTEM_PROMPT,
          userPrompt: buildScriptExpandUserPrompt({
            originalContent: requestData.originalContent as string,
            expansionRatio:
              (requestData.expansionRatio as "50%" | "100%" | "200%") || "100%",
            focus: requestData.focus as
              | "description"
              | "emotion"
              | "action"
              | "dialogue",
          }),
        };

      case AITaskType.CONDENSE:
        return {
          systemPrompt: SCRIPT_CONDENSE_SYSTEM_PROMPT,
          userPrompt: buildScriptCondenseUserPrompt({
            originalContent: requestData.originalContent as string,
            compressionRatio:
              (requestData.compressionRatio as "30%" | "50%") || "50%",
            keepKeyPoints: requestData.keepKeyPoints as boolean,
          }),
        };

      default:
        throw new Error(`不支持的编辑类型: ${type}`);
    }
  }

  /**
   * 获取温度参数
   */
  private getTemperature(type: string): number {
    switch (type) {
      case AITaskType.CONTINUE:
        return 0.8; // 续写需要一些创造性
      case AITaskType.REWRITE:
        return 0.7;
      case AITaskType.EXPAND:
        return 0.75;
      case AITaskType.CONDENSE:
        return 0.3; // 缩写需要更稳定
      default:
        return 0.7;
    }
  }

  /**
   * 解析编辑结果
   */
  private parseEditResult(
    text: string,
    type: string,
  ): {
    paragraphs: Array<{
      id: string;
      type: string;
      content: string;
      character?: string;
      emotion?: string;
      parenthetical?: string;
    }>;
    suggestedSceneTitle?: string;
  } {
    try {
      // 使用共享工具函数清理和解析 JSON
      const cleaned = cleanJsonText(text);
      const parsed = JSON.parse(cleaned);

      // 为段落分配 ID
      const paragraphs = (parsed.paragraphs || []).map(
        (para: {
          type: string;
          content: string;
          character?: string;
          emotion?: string;
          parenthetical?: string;
        }) => ({
          id: generateId("p"),
          type: para.type,
          content: para.content,
          character: para.character,
          emotion: para.emotion,
          parenthetical: para.parenthetical,
        }),
      );

      return {
        paragraphs,
        suggestedSceneTitle: parsed.suggestedSceneTitle,
      };
    } catch (error) {
      this.logger.error(`解析编辑结果失败: ${(error as Error).message}`);
      this.logger.error(`原始内容: ${text.substring(0, 500)}...`);

      // 如果解析失败，返回原始文本作为单个段落
      return {
        paragraphs: [
          {
            id: generateId("p"),
            type: "action",
            content: text,
          },
        ],
      };
    }
  }

  /**
   * 更新任务状态
   */
  private async updateTaskStatus(
    taskId: string,
    status: AITaskStatusType,
    additionalData?: Record<string, unknown>,
  ): Promise<void> {
    const updateData: Partial<AITask> = {
      status,
    };

    if (status === AITaskStatus.PROCESSING) {
      updateData.startedAt = new Date();
    }

    if (status === AITaskStatus.COMPLETED || status === AITaskStatus.FAILED) {
      updateData.completedAt = new Date();
    }

    if (additionalData) {
      if (additionalData.result) {
        updateData.result = additionalData.result as Record<string, unknown>;
      }
      if (additionalData.tokensUsed) {
        updateData.progress = 100;
      }
      if (additionalData.error) {
        updateData.error = additionalData.error as string;
      }
    }

    // 使用 query builder 避免类型问题
    const updateFields: Record<string, unknown> = {};
    if (updateData.status !== undefined)
      updateFields.status = updateData.status;
    if (updateData.startedAt !== undefined)
      updateFields.startedAt = updateData.startedAt;
    if (updateData.completedAt !== undefined)
      updateFields.completedAt = updateData.completedAt;
    if (updateData.result !== undefined)
      updateFields.result = updateData.result;
    if (updateData.progress !== undefined)
      updateFields.progress = updateData.progress;
    if (updateData.error !== undefined) updateFields.error = updateData.error;

    await this.aiTaskRepository
      .createQueryBuilder()
      .update()
      .set(updateFields)
      .where("id = :taskId", { taskId })
      .execute();
  }

  /**
   * 队列失败处理
   */
  @OnWorkerEvent("failed")
  async onFailed(job: Job, error: Error): Promise<void> {
    this.logger.error(`剧本编辑任务 ${job.id} 失败`);
    this.logger.debug("详细错误信息:", error);

    const { taskId } = job.data;

    // 更新任务状态
    await this.aiTaskRepository.update(
      { id: taskId },
      {
        status: AITaskStatus.FAILED,
        completedAt: new Date(),
        error: "处理失败",
      },
    );
  }
}

// 导入类型
type AITaskStatusType = (typeof AITaskStatus)[keyof typeof AITaskStatus];
