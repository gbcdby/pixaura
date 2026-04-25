/**
 * 音频生成成本服务
 * 额度计算和管理，通过 QuotaDeductService 统一计费入口
 * TTS 采用按实际时长结算的预扣减模式
 */
import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TextGenQuotaRecord } from "../../billing/entities/text-gen-quota-record.entity";
import { QuotaDeductService } from "../../billing/services/quota-deduct.service";
import type {
  QuotaCheckResult,
  QuotaDeductResult,
} from "@pixaura/shared-types";

/**
 * TTS 额度扣减记录
 * 用于跟踪 TTS 任务的预扣减和结算状态
 */
interface TTSQuotaEntry {
  userId: string;
  taskId: string;
  estimatedDuration: number;
  estimatedAmount: number;
  deductedFrom: "subscription" | "balance" | null;
  idempotencyKey: string;
}

@Injectable()
export class AudioGenerationCostService {
  private readonly logger = new Logger(AudioGenerationCostService.name);

  // 内存存储 TTS 预扣减记录（生产环境应使用数据库表）
  private readonly ttsQuotaRecords = new Map<string, TTSQuotaEntry>();

  // 成本配置（单位：分），用于无模型价格时的默认值
  private readonly costConfig: Record<
    string,
    { baseCost: number; unitCost: number }
  > = {
    tts: { baseCost: 0, unitCost: 5 }, // 按实际时长：5分/秒
    lip_sync: { baseCost: 200, unitCost: 0 }, // 200分/次
    bgm: { baseCost: 100, unitCost: 10 }, // 100分 + 10分/秒
    ambience: { baseCost: 80, unitCost: 5 }, // 80分 + 5分/秒
    mixing: { baseCost: 50, unitCost: 20 }, // 50分 + 20分/轨
  };

  constructor(
    private readonly quotaDeductService: QuotaDeductService,
    @InjectRepository(TextGenQuotaRecord)
    private readonly textGenQuotaRecordRepo: Repository<TextGenQuotaRecord>,
  ) {}

  /**
   * 计算预估成本
   */
  calculateEstimatedCost(
    type: string,
    quantity: number = 1,
  ): { estimatedCost: number; actualCost: number; currency: string } {
    const config = this.costConfig[type];
    if (!config) {
      throw new Error(`未知的音频生成类型: ${type}`);
    }

    const estimatedCost = config.baseCost + config.unitCost * quantity;

    return {
      estimatedCost,
      actualCost: 0,
      currency: "CNY",
    };
  }

  /**
   * 估算 TTS 语音时长（秒）
   * @param text 文本内容
   * @param speed 语速倍率
   * @returns 估算时长（秒）
   */
  estimateTTSDuration(text: string, speed: number = 1.0): number {
    // 过滤标点符号
    const cleaned = text.replace(/[\s\p{P}\p{S}]/gu, "");
    // 中文字符 ~0.3s/字
    const chineseChars = (cleaned.match(/[\u4e00-\u9fa5]/g) || []).length;
    // 英文单词 ~0.2s/词
    const englishWords = (cleaned.match(/[a-zA-Z]+/g) || []).length;
    // 其他字符
    const otherChars = cleaned.length - chineseChars - englishWords;
    const baseDuration = chineseChars * 0.3 + englishWords * 0.2 + otherChars * 0.15;
    return Math.round((baseDuration / speed) * 100) / 100;
  }

  /**
   * 将 TTS 时长转换为金额（元）
   * TTS 按实际时长计费：5分/秒（0.05元/秒）
   */
  private durationToAmount(durationSeconds: number): number {
    return Math.round(durationSeconds * 0.05 * 10000) / 10000;
  }

  /**
   * 预留 TTS 语音生成额度（预扣减模式）
   * 按估算时长预扣额度
   *
   * @param userId 用户ID
   * @param taskId 任务ID（如对话 ID）
   * @param text 语音文本
   * @param speed 语速倍率
   * @param modelId 模型ID
   * @returns 额度检查结果
   */
  async reserveTTSQuota(
    userId: string,
    taskId: string,
    text: string,
    speed: number = 1.0,
    modelId: string = "qwen3-tts-flash",
  ): Promise<QuotaCheckResult> {
    // 1. 估算时长
    const estimatedDuration = this.estimateTTSDuration(text, speed);
    const estimatedAmount = this.durationToAmount(estimatedDuration);

    this.logger.debug(
      `预留 TTS 额度: userId=${userId}, taskId=${taskId}, duration=${estimatedDuration}s, amount=${estimatedAmount}`,
    );

    // 2. 检查额度
    const result = await this.quotaDeductService.checkQuota({
      userId,
      modelId,
      category: "VOICE_GENERATION",
      count: estimatedAmount,
      duration: estimatedDuration,
    });

    if (!result.canExecute) {
      this.logger.warn(
        `TTS 额度不足: userId=${userId}, reason=${result.reason}, message=${result.message}`,
      );
      return result;
    }

    // 3. 执行预扣减
    const idempotencyKey = `tts-pre-${taskId}-${Date.now()}`;
    try {
      const deductResult = await this.quotaDeductService.deductQuota({
        userId,
        modelId,
        category: "VOICE_GENERATION",
        count: estimatedAmount,
        referenceId: taskId,
        idempotencyKey,
        duration: estimatedDuration,
      });

      // 4. 记录预扣减信息（用于后续结算）
      this.ttsQuotaRecords.set(taskId, {
        userId,
        taskId,
        estimatedDuration,
        estimatedAmount,
        deductedFrom: deductResult.deductedFrom,
        idempotencyKey,
      });

      this.logger.log(
        `TTS 额度预扣减成功: taskId=${taskId}, duration=${estimatedDuration}s, amount=${estimatedAmount}, from=${deductResult.deductedFrom}`,
      );
    } catch (error) {
      this.logger.error(
        `TTS 额度预扣减失败: taskId=${taskId}, userId=${userId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadRequestException("TTS 额度预扣减失败，请稍后重试");
    }

    return result;
  }

  /**
   * 结算 TTS 实际成本
   * 按实际时长确认扣减，多退少补
   *
   * @param taskId 任务ID
   * @param actualDuration 实际语音时长（秒）
   */
  async settleTTSCost(taskId: string, actualDuration: number): Promise<void> {
    const entry = this.ttsQuotaRecords.get(taskId);
    if (!entry) {
      this.logger.warn(`结算 TTS 成本时未找到预扣减记录: taskId=${taskId}`);
      return;
    }

    // 1. 计算实际费用
    const actualAmount = this.durationToAmount(actualDuration);
    const diff = entry.estimatedAmount - actualAmount;

    // 2. 返还差额（预估多扣的情况）
    if (diff > 0) {
      await this.refundTTSBalance(entry.userId, diff, taskId, "TTS 实际时长小于预估");
      this.logger.log(
        `TTS 结算-退还差额: taskId=${taskId}, estimated=${entry.estimatedAmount}, actual=${actualAmount}, refund=${diff}`,
      );
    } else if (diff < 0) {
      this.logger.log(
        `TTS 结算-预估不足: taskId=${taskId}, estimated=${entry.estimatedAmount}, actual=${actualAmount}, shortfall=${Math.abs(diff)}`,
      );
    }

    // 3. 清理记录
    this.ttsQuotaRecords.delete(taskId);

    this.logger.log(
      `TTS 成本结算完成: taskId=${taskId}, estimatedDuration=${entry.estimatedDuration}s, actualDuration=${actualDuration}s`,
    );
  }

  /**
   * 返还 TTS 额度
   * 任务失败或取消时调用，全额返还预扣减额度
   *
   * @param userId 用户ID
   * @param taskId 任务ID
   */
  async refundTTSQuota(userId: string, taskId: string): Promise<void> {
    const entry = this.ttsQuotaRecords.get(taskId);
    if (!entry) {
      this.logger.warn(
        `返还 TTS 额度时未找到预扣减记录: taskId=${taskId}，使用 userId 直接返还`,
      );
      // 如果没有预扣减记录，尝试返还 0（仅记录日志）
      await this.refundTTSBalance(userId, 0, taskId, "TTS 任务失败-无预扣记录");
      return;
    }

    // 返还预估额度
    await this.refundTTSBalance(userId, entry.estimatedAmount, taskId, "TTS 任务失败");
    this.ttsQuotaRecords.delete(taskId);
  }

  /**
   * 内部方法：返还 TTS 预扣余额
   */
  private async refundTTSBalance(
    userId: string,
    amount: number,
    referenceId: string,
    reason: string,
  ): Promise<void> {
    if (amount <= 0) {
      this.logger.debug(`返还金额<=0，跳过: userId=${userId}, amount=${amount}`);
      return;
    }
    await this.quotaDeductService.refundBalance(userId, amount, referenceId, reason);
  }

  /**
   * 预留 TTS 语音生成额度（旧接口兼容，按次数扣减）
   * @deprecated 请使用 reserveTTSQuota(userId, taskId, text, speed, modelId)
   */
  async reserveTTSQuotaLegacy(
    userId: string,
    modelId: string,
    count: number,
  ): Promise<QuotaCheckResult> {
    this.logger.debug(
      `预留 TTS 额度（旧接口）: userId=${userId}, modelId=${modelId}, count=${count}`,
    );

    const result = await this.quotaDeductService.checkQuota({
      userId,
      modelId,
      category: "VOICE_GENERATION",
      count,
    });

    if (!result.canExecute) {
      this.logger.warn(
        `TTS 额度不足: userId=${userId}, reason=${result.reason}, message=${result.message}`,
      );
    }

    return result;
  }

  /**
   * 扣减 TTS 语音生成额度（旧接口兼容，按次数扣减）
   * @deprecated 请使用 reserveTTSQuota + settleCost
   */
  async deductTTSQuota(
    userId: string,
    modelId: string,
    referenceId: string,
  ): Promise<QuotaDeductResult> {
    this.logger.debug(
      `扣减 TTS 额度（旧接口）: userId=${userId}, modelId=${modelId}, referenceId=${referenceId}`,
    );

    const idempotencyKey = `tts-${referenceId}-${Date.now()}`;

    return this.quotaDeductService.deductQuota({
      userId,
      modelId,
      category: "VOICE_GENERATION",
      count: 1,
      referenceId,
      idempotencyKey,
    });
  }

  /**
   * 预留 BGM 背景音乐生成额度
   * @param userId 用户ID
   * @param durationSeconds 时长（秒）
   * @returns 额度检查结果
   */
  async reserveBGMQuota(
    userId: string,
    durationSeconds: number,
  ): Promise<QuotaCheckResult> {
    this.logger.debug(
      `预留 BGM 额度: userId=${userId}, durationSeconds=${durationSeconds}`,
    );

    // BGM 使用 AUDIO_GENERATION 类别（区别于 VOICE_GENERATION）
    const result = await this.quotaDeductService.checkQuota({
      userId,
      modelId: undefined,
      category: "AUDIO_GENERATION",
      count: 1,
      duration: durationSeconds,
    });

    if (!result.canExecute) {
      this.logger.warn(
        `BGM 额度不足: userId=${userId}, reason=${result.reason}, message=${result.message}`,
      );
    }

    return result;
  }

  /**
   * 预留额度（旧接口兼容）
   * @deprecated 请使用 reserveTTSQuota 或 reserveBGMQuota
   */
  async reserveQuota(
    userId: string,
    projectId: string,
    amount: number,
  ): Promise<boolean> {
    this.logger.debug(
      `预留额度（兼容接口）: userId=${userId}, projectId=${projectId}, amount=${amount}`,
    );

    // 使用 VOICE_GENERATION 类别作为默认
    const result = await this.quotaDeductService.checkQuota({
      userId,
      modelId: undefined,
      category: "VOICE_GENERATION",
      count: 1,
    });

    return result.canExecute;
  }

  /**
   * 返还额度（旧接口兼容）
   * @deprecated 请使用 refundTTSQuota
   */
  async refundQuota(
    userId: string,
    projectId: string,
    amount: number,
  ): Promise<number> {
    this.logger.log(`退还额度（兼容接口）: userId=${userId}, amount=${amount}分`);
    if (amount > 0) {
      const amountYuan = amount / 100;
      await this.quotaDeductService.refundBalance(
        userId,
        amountYuan,
        projectId,
        "手动返还",
      );
    }
    return amount;
  }

  /**
   * 结算实际成本
   */
  async settleCost(
    userId: string,
    projectId: string,
    estimatedCost: number,
    actualCost: number,
  ): Promise<void> {
    const diff = estimatedCost - actualCost;

    if (diff > 0) {
      await this.refundQuota(userId, projectId, diff);
      this.logger.log(`退还差额: ${diff}分`);
    } else if (diff < 0) {
      await this.reserveQuota(userId, projectId, Math.abs(diff));
      this.logger.log(`扣除差额: ${Math.abs(diff)}分`);
    }
  }
}
