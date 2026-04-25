import {
  Injectable,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TextGenQuotaRecord } from "../entities/text-gen-quota-record.entity";
import { QuotaDeductService } from "./quota-deduct.service";
import { estimateTokens } from "../../../common/utils/ai-cost.util";
import type {
  CheckQuotaDto,
  DeductQuotaDto,
  QuotaCheckResult,
  QuotaDeductResult,
} from "@pixaura/shared-types";

/**
 * 文本生成额度服务
 * 负责文本生成任务（剧本生成/解析/编辑/流式）的额度预扣减、确认和返还
 */
@Injectable()
export class TextGenQuotaService {
  private readonly logger = new Logger(TextGenQuotaService.name);

  // 每 1000 token 价格（元），作为后备单价
  private readonly PRICE_PER_1K_TOKENS = 0.02;

  constructor(
    @InjectRepository(TextGenQuotaRecord)
    private quotaRecordRepository: Repository<TextGenQuotaRecord>,
    private quotaDeductService: QuotaDeductService,
  ) {}

  /**
   * 将 token 数转换为金额（元）
   */
  private tokensToAmount(tokens: number): number {
    return Math.round((tokens / 1000) * this.PRICE_PER_1K_TOKENS * 10000) / 10000;
  }

  /**
   * 预扣减额度
   * 在任务开始前调用，估算 token 数并预扣额度
   *
   * @param userId 用户ID
   * @param taskId 任务ID
   * @param text prompt 文本
   * @param modelId 模型ID
   * @param taskType 任务类型（generate/parse/edit/stream）
   * @returns 扣减记录
   */
  async preDeduct(
    userId: string,
    taskId: string,
    text: string,
    modelId: string,
    taskType: string,
  ): Promise<TextGenQuotaRecord> {
    // 1. 估算 prompt token 数
    const promptTokens = estimateTokens(text);
    // 预估总 token = prompt tokens * 2（假设输出与输入相当）
    const estimatedTokens = promptTokens * 2;
    const estimatedAmount = this.tokensToAmount(estimatedTokens);

    // 2. 检查额度
    const checkDto: CheckQuotaDto = {
      userId,
      modelId,
      category: "TEXT_GENERATION",
      count: estimatedTokens,
    };

    const checkResult = await this.quotaDeductService.checkQuota(checkDto);

    if (!checkResult.canExecute) {
      throw new BadRequestException(
        `文本生成额度不足: 预估 ${estimatedTokens} tokens, 原因: ${checkResult.message}`,
      );
    }

    // 3. 执行预扣减
    const deductDto: DeductQuotaDto = {
      userId,
      modelId,
      category: "TEXT_GENERATION",
      count: estimatedTokens,
      referenceId: taskId,
      idempotencyKey: `text-gen-${taskId}-${Date.now()}`,
    };

    let deductResult: QuotaDeductResult;
    try {
      deductResult = await this.quotaDeductService.deductQuota(deductDto);
    } catch (error) {
      this.logger.error(
        `文本生成额度预扣减失败: taskId=${taskId}, userId=${userId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadRequestException("额度扣减失败，请稍后重试");
    }

    // 4. 创建扣减记录
    const record = this.quotaRecordRepository.create({
      userId,
      taskId,
      estimatedTokens,
      estimatedAmount,
      status: "pending",
      deductedFrom: deductResult.deductedFrom,
      metadata: {
        taskType,
        modelId,
        promptLength: text.length,
      },
    });

    const savedRecord = await this.quotaRecordRepository.save(record);

    this.logger.log(
      `文本生成额度预扣减成功: recordId=${savedRecord.id}, taskId=${taskId}, ` +
        `tokens=${estimatedTokens}, amount=${estimatedAmount}, from=${deductResult.deductedFrom}`,
    );

    return savedRecord;
  }

  /**
   * 确认扣减
   * 任务完成后按实际 token 数重新计算费用，多退少补
   *
   * @param taskId 任务ID
   * @param actualTokens 实际消耗的 token 数
   */
  async confirmDeduct(taskId: string, actualTokens: number): Promise<void> {
    // 1. 查找扣减记录
    const record = await this.quotaRecordRepository.findOne({
      where: { taskId },
    });

    if (!record) {
      this.logger.warn(`确认扣减时未找到记录: taskId=${taskId}`);
      return;
    }

    if (record.status !== "pending") {
      this.logger.warn(
        `扣减记录状态不正确: taskId=${taskId}, status=${record.status}`,
      );
      return;
    }

    // 2. 计算实际额度
    const actualAmount = this.tokensToAmount(actualTokens);
    const diff = record.estimatedAmount - actualAmount;

    // 3. 更新记录
    record.actualTokens = actualTokens;
    record.actualAmount = actualAmount;
    record.status = "confirmed";
    record.confirmedAt = new Date();
    await this.quotaRecordRepository.save(record);

    // 4. 如果有差额（预估多扣了），返还额度
    if (diff > 0) {
      await this.refundQuota(record.userId, diff, taskId, "实际消耗小于预估");
      this.logger.log(
        `确认扣减-退还差额: taskId=${taskId}, estimated=${record.estimatedAmount}, actual=${actualAmount}, refund=${diff}`,
      );
    } else if (diff < 0) {
      this.logger.log(
        `确认扣减-预估不足: taskId=${taskId}, estimated=${record.estimatedAmount}, actual=${actualAmount}, shortfall=${Math.abs(diff)}`,
      );
    }

    this.logger.log(
      `文本生成额度确认扣减成功: taskId=${taskId}, estimatedTokens=${record.estimatedTokens}, actualTokens=${actualTokens}`,
    );
  }

  /**
   * 返还额度
   * 任务失败或取消时调用，全额返还预扣减额度
   *
   * @param taskId 任务ID
   * @param reason 返还原因
   */
  async refund(taskId: string, reason: string): Promise<void> {
    // 1. 查找扣减记录
    const record = await this.quotaRecordRepository.findOne({
      where: { taskId },
    });

    if (!record) {
      this.logger.warn(`返还额度时未找到记录: taskId=${taskId}`);
      return;
    }

    if (record.status !== "pending") {
      this.logger.warn(
        `扣减记录状态不正确: taskId=${taskId}, status=${record.status}`,
      );
      return;
    }

    // 2. 返还额度
    await this.refundQuota(record.userId, record.estimatedAmount, taskId, reason);

    // 3. 更新记录状态
    record.status = "refunded";
    record.refundedAt = new Date();
    record.refundReason = reason;
    await this.quotaRecordRepository.save(record);

    this.logger.log(
      `文本生成额度返还成功: taskId=${taskId}, amount=${record.estimatedAmount}, reason=${reason}`,
    );
  }

  /**
   * 内部方法：返还额度到用户账户
   * 通过 QuotaDeductService 的底层能力回增额度
   */
  private async refundQuota(
    userId: string,
    amount: number,
    taskId: string,
    reason: string,
  ): Promise<void> {
    this.logger.log(
      `执行额度返还: userId=${userId}, amount=${amount}, taskId=${taskId}, reason=${reason}`,
    );
    // 通过 Redis 回增余额
    await this.quotaDeductService.refundBalance(userId, amount, taskId, reason);
  }
}
