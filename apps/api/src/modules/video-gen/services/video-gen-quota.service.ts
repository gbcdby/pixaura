import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { VideoGenQuotaRecord } from "../entities/video-gen-quota-record.entity";
import { VideoGenerationTask } from "../entities/video-generation-task.entity";
import { VideoMode } from "../entities/video-generation-task.entity";
import type { VideoResolution } from "@pixaura/shared-types";
import { QuotaDeductService } from "../../billing/services/quota-deduct.service";
import { AiModel } from "../../model-config/entities/ai-model.entity";
import type {
  CheckQuotaDto,
  DeductQuotaDto,
  QuotaCheckResult,
  QuotaDeductResult,
} from "@pixaura/shared-types";

/**
 * 分辨率单价配置（积分/分钟）- 作为后备配置
 */
const RESOLUTION_PRICE: Record<VideoResolution, number> = {
  "480p": 50,
  "720p": 100,
  "1080p": 200,
};

/**
 * 任务类型系数
 * 重命名说明：
 * - audio_driven → audio_reference
 * - video_first → lip_sync
 */
const VIDEO_MODE_COEFFICIENT: Record<VideoMode, number> = {
  video_only: 1.0,
  audio_reference: 1.2,
  lip_sync: 1.5,
};

/**
 * 视频生成配置
 */
interface VideoGenConfig {
  outputConfig: {
    resolution: VideoResolution;
  };
  videoMode: VideoMode;
  modelId?: string;
}

/**
 * 额度不足错误
 */
export class InsufficientQuotaError extends BadRequestException {
  constructor(
    public readonly required: number,
    public readonly available: number,
    public readonly shortfall: number,
    public readonly deductFrom: "subscription" | "balance" | null,
  ) {
    super({
      code: "INSUFFICIENT_QUOTA",
      message: "额度不足，无法创建任务",
      details: {
        required,
        available,
        shortfall,
        deductFrom,
      },
    });
  }
}

/**
 * 视频生成额度服务
 * 负责视频生成任务的额度计算、预扣减、确认和返还
 */
@Injectable()
export class VideoGenQuotaService {
  private readonly logger = new Logger(VideoGenQuotaService.name);

  constructor(
    @InjectRepository(VideoGenQuotaRecord)
    private quotaRecordRepository: Repository<VideoGenQuotaRecord>,
    @InjectRepository(VideoGenerationTask)
    private taskRepository: Repository<VideoGenerationTask>,
    @InjectRepository(AiModel)
    private aiModelRepository: Repository<AiModel>,
    private quotaDeductService: QuotaDeductService,
    private dataSource: DataSource,
  ) {}

  /**
   * 计算预估额度
   * @param config 视频生成配置
   * @param duration 预估时长（秒），默认5秒
   * @returns 预估额度（元）
   *
   * 计算公式：
   * - 如果模型配置了 pricePerSecond：预估额度 = pricePerSecond × 时长(秒)
   * - 否则使用后备配置：预估额度 = 分辨率单价 × 预估时长(分钟) × 任务类型系数
   */
  async calculateEstimate(
    config: VideoGenConfig,
    duration: number = 5,
  ): Promise<number> {
    const modelId = config.modelId;

    // 优先使用模型配置的 pricePerSecond
    if (modelId) {
      const model = await this.aiModelRepository.findOne({
        where: { modelId },
      });

      if (model) {
        const costConfig = (model.costConfig || {}) as Record<string, unknown>;
        const billingMode = (costConfig.billingMode as string) || "per_call";

        if (billingMode === "per_second") {
          const pricePerSecond = (costConfig.pricePerSecond as number) || 0;
          if (pricePerSecond > 0) {
            const estimatedAmount = pricePerSecond * duration;
            this.logger.debug(
              `额度计算(按秒计费): modelId=${modelId}, ` +
                `pricePerSecond=${pricePerSecond}, duration=${duration}s, ` +
                `estimated=${estimatedAmount.toFixed(4)}`,
            );
            return estimatedAmount;
          }
        }
      }
    }

    // 使用后备配置（按分辨率计费）
    const resolution = config.outputConfig.resolution;
    const videoMode = config.videoMode;

    // 获取分辨率单价
    const pricePerMinute = RESOLUTION_PRICE[resolution];
    if (!pricePerMinute) {
      throw new BadRequestException(`不支持的分辨率: ${resolution}`);
    }

    // 获取任务类型系数
    const coefficient = VIDEO_MODE_COEFFICIENT[videoMode];
    if (!coefficient) {
      throw new BadRequestException(`不支持的任务类型: ${videoMode}`);
    }

    // 转换为分钟，不足1分钟按1分钟计算
    const durationInMinutes = Math.max(1, Math.ceil(duration / 60));

    // 计算预估额度（转换为元，假设50积分=1元）
    const estimatedAmount =
      Math.ceil(pricePerMinute * durationInMinutes * coefficient) / 50;

    this.logger.debug(
      `额度计算(后备配置): resolution=${resolution}, mode=${videoMode}, ` +
        `duration=${duration}s, estimated=${estimatedAmount.toFixed(4)}`,
    );

    return estimatedAmount;
  }

  /**
   * 检查用户额度是否充足
   * @param userId 用户ID
   * @param estimatedAmount 预估额度
   * @returns 检查结果
   */
  async checkQuota(
    userId: string,
    estimatedAmount: number,
    modelId?: string,
    duration?: number,
  ): Promise<QuotaCheckResult> {
    const checkDto: CheckQuotaDto = {
      userId,
      modelId: modelId || "video-gen-default",
      category: "VIDEO_GENERATION",
      count: estimatedAmount,
      duration,
    };

    return this.quotaDeductService.checkQuota(checkDto);
  }

  /**
   * 预扣减额度
   * 在任务创建前调用，先扣减用户额度
   *
   * @param userId 用户ID
   * @param taskId 任务ID
   * @param config 视频生成配置
   * @param duration 预估时长（秒）
   * @param batchId 批量任务ID（可选）
   * @returns 扣减记录
   */
  async preDeduct(
    userId: string,
    taskId: string,
    config: VideoGenConfig,
    duration: number = 5,
    batchId?: string,
  ): Promise<VideoGenQuotaRecord> {
    // 1. 计算预估额度
    const estimatedAmount = await this.calculateEstimate(config, duration);

    // 2. 检查额度
    const checkResult = await this.checkQuota(
      userId,
      estimatedAmount,
      config.modelId,
      duration,
    );

    if (!checkResult.canExecute) {
      throw new InsufficientQuotaError(
        estimatedAmount,
        checkResult.deductFrom === "subscription"
          ? 0 // 订阅额度不足时，可用额度为0（简化处理）
          : Math.floor(checkResult.remainingBalance * 50), // 余额转积分（假设1元=50积分）
        estimatedAmount,
        checkResult.deductFrom,
      );
    }

    // 3. 执行额度扣减
    const deductDto: DeductQuotaDto = {
      userId,
      modelId: config.modelId || "video-gen-default",
      category: "VIDEO_GENERATION",
      count: estimatedAmount,
      referenceId: taskId,
      idempotencyKey: `${taskId}-${Date.now()}`,
      duration,
    };

    let deductResult: QuotaDeductResult;
    try {
      deductResult = await this.quotaDeductService.deductQuota(deductDto);
    } catch (error) {
      this.logger.error(
        `额度扣减失败: taskId=${taskId}, userId=${userId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadRequestException("额度扣减失败，请稍后重试");
    }

    // 4. 创建扣减记录
    const record = this.quotaRecordRepository.create({
      userId,
      taskId,
      batchId: batchId || null,
      estimatedAmount,
      actualAmount: 0,
      status: "pending",
      deductedFrom: deductResult.deductedFrom,
      metadata: {
        resolution: config.outputConfig.resolution,
        duration,
        videoMode: config.videoMode,
        modelId: config.modelId || "video-gen-default",
      },
    });

    const savedRecord = await this.quotaRecordRepository.save(record);

    // 5. 更新任务关联的额度记录ID
    await this.taskRepository.update(taskId, {
      quotaRecordId: savedRecord.id,
    });

    this.logger.log(
      `额度预扣减成功: recordId=${savedRecord.id}, taskId=${taskId}, ` +
        `amount=${estimatedAmount}, from=${deductResult.deductedFrom}`,
    );

    return savedRecord;
  }

  /**
   * 批量预扣减额度
   * 用于批量任务创建时的额度汇总扣减
   *
   * @param userId 用户ID
   * @param tasks 任务配置列表
   * @param batchId 批量任务ID
   * @returns 总扣减记录
   */
  async preDeductBatch(
    userId: string,
    tasks: Array<{
      taskId: string;
      config: VideoGenConfig;
      duration?: number;
    }>,
    batchId: string,
  ): Promise<{
    totalEstimated: number;
    records: VideoGenQuotaRecord[];
  }> {
    // 1. 计算总额度
    let totalEstimated = 0;
    for (const task of tasks) {
      totalEstimated += await this.calculateEstimate(
        task.config,
        task.duration || 5,
      );
    }

    // 2. 检查总额度
    const checkResult = await this.checkQuota(userId, totalEstimated);

    if (!checkResult.canExecute) {
      throw new InsufficientQuotaError(
        totalEstimated,
        checkResult.deductFrom === "subscription"
          ? 0
          : Math.floor(checkResult.remainingBalance * 50),
        totalEstimated,
        checkResult.deductFrom,
      );
    }

    // 3. 执行批量额度扣减
    const deductDto: DeductQuotaDto = {
      userId,
      modelId: "video-gen-default",
      category: "VIDEO_GENERATION",
      count: totalEstimated,
      referenceId: batchId,
      idempotencyKey: `${batchId}-${Date.now()}`,
    };

    let deductResult: QuotaDeductResult;
    try {
      deductResult = await this.quotaDeductService.deductQuota(deductDto);
    } catch (error) {
      this.logger.error(
        `批量额度扣减失败: batchId=${batchId}, userId=${userId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadRequestException("额度扣减失败，请稍后重试");
    }

    // 4. 为每个任务创建扣减记录
    const records: VideoGenQuotaRecord[] = [];
    for (const task of tasks) {
      const estimatedAmount = await this.calculateEstimate(
        task.config,
        task.duration || 5,
      );

      const record = this.quotaRecordRepository.create({
        userId,
        taskId: task.taskId,
        batchId,
        estimatedAmount,
        actualAmount: 0,
        status: "pending",
        deductedFrom: deductResult.deductedFrom,
        metadata: {
          resolution: task.config.outputConfig.resolution,
          duration: task.duration || 5,
          videoMode: task.config.videoMode,
          modelId: task.config.modelId || "video-gen-default",
        },
      });

      const savedRecord = await this.quotaRecordRepository.save(record);
      records.push(savedRecord);

      // 更新任务关联的额度记录ID
      await this.taskRepository.update(task.taskId, {
        quotaRecordId: savedRecord.id,
      });
    }

    this.logger.log(
      `批量额度预扣减成功: batchId=${batchId}, total=${totalEstimated}, ` +
        `count=${tasks.length}, from=${deductResult.deductedFrom}`,
    );

    return { totalEstimated, records };
  }

  /**
   * 确认扣减
   * 任务成功完成后调用，根据实际消耗确认扣减
   *
   * @param taskId 任务ID
   * @param actualDuration 实际视频时长（秒）
   */
  async confirmDeduct(taskId: string, actualDuration?: number): Promise<void> {
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
    let actualAmount = record.estimatedAmount;
    if (actualDuration && record.metadata) {
      actualAmount = await this.calculateEstimate(
        {
          outputConfig: {
            resolution: record.metadata.resolution as VideoResolution,
          },
          videoMode: record.metadata.videoMode as VideoMode,
          modelId: record.metadata.modelId,
        },
        actualDuration,
      );
    }

    // 3. 计算差额
    const diff = record.estimatedAmount - actualAmount;

    // 4. 更新记录状态
    record.actualAmount = actualAmount;
    record.status = "confirmed";
    record.confirmedAt = new Date();
    await this.quotaRecordRepository.save(record);

    // 5. 如果有差额，返还额度
    if (diff > 0) {
      await this.refundQuota(record.userId, diff, taskId, "实际消耗小于预估");
    }

    this.logger.log(
      `额度确认扣减成功: taskId=${taskId}, estimated=${record.estimatedAmount}, ` +
        `actual=${actualAmount}, refund=${diff > 0 ? diff : 0}`,
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
    await this.refundQuota(
      record.userId,
      record.estimatedAmount,
      taskId,
      reason,
    );

    // 3. 更新记录状态
    record.status = "refunded";
    record.refundedAt = new Date();
    record.refundReason = reason;
    await this.quotaRecordRepository.save(record);

    this.logger.log(
      `额度返还成功: taskId=${taskId}, amount=${record.estimatedAmount}, reason=${reason}`,
    );
  }

  /**
   * 获取任务的额度扣减信息
   *
   * @param taskId 任务ID
   * @returns 额度扣减信息
   */
  async getQuotaInfo(taskId: string): Promise<{
    estimatedAmount: number;
    actualAmount: number;
    status: string;
    deductedFrom: string | null;
    refundAmount?: number;
  } | null> {
    const record = await this.quotaRecordRepository.findOne({
      where: { taskId },
    });

    if (!record) {
      return null;
    }

    return {
      estimatedAmount: record.estimatedAmount,
      actualAmount: record.actualAmount,
      status: record.status,
      deductedFrom: record.deductedFrom,
      refundAmount:
        record.status === "refunded" ? record.estimatedAmount : undefined,
    };
  }

  /**
   * 查询用户的额度扣减记录
   *
   * @param userId 用户ID
   * @param options 查询选项
   * @returns 记录列表
   */
  async findRecords(
    userId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      status?: "pending" | "confirmed" | "refunded";
      page?: number;
      pageSize?: number;
    } = {},
  ): Promise<{
    items: VideoGenQuotaRecord[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { startDate, endDate, status, page = 1, pageSize = 20 } = options;

    const queryBuilder = this.quotaRecordRepository
      .createQueryBuilder("record")
      .where("record.user_id = :userId", { userId });

    if (startDate) {
      queryBuilder.andWhere("record.created_at >= :startDate", { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere("record.created_at <= :endDate", { endDate });
    }

    if (status) {
      queryBuilder.andWhere("record.status = :status", { status });
    }

    const [items, total] = await queryBuilder
      .orderBy("record.created_at", "DESC")
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      items,
      total,
      page,
      pageSize,
    };
  }

  /**
   * 内部方法：返还额度到用户账户
   * 通过 QuotaDeductService 回增余额
   */
  private async refundQuota(
    userId: string,
    amount: number,
    taskId: string,
    reason: string,
  ): Promise<void> {
    await this.quotaDeductService.refundBalance(userId, amount, taskId, reason);
    this.logger.log(
      `额度返还成功: userId=${userId}, amount=${amount}, taskId=${taskId}, reason=${reason}`,
    );
  }
}
