import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import {
  Subscription,
  SubscriptionStatus,
} from "../entities/subscription.entity";
import {
  QuotaUsage,
  QuotaReason,
  QuotaType,
} from "../entities/quota-usage.entity";
import {
  BalanceRecord,
  BalanceRecordType,
} from "../entities/balance-record.entity";
import { AiModel } from "../../model-config/entities/ai-model.entity";
import { User } from "../../user/entities/user.entity";
import { QuotaRedisService } from "./quota-redis.service";
import { QuotaManagementService } from "./quota-management.service";
import { CycleCalculationService } from "./cycle-calculation.service";
import { isAdmin, Permissions } from "@pixaura/shared-types";
import type {
  CheckQuotaDto,
  DeductQuotaDto,
  QuotaCheckResult,
  QuotaDeductResult,
} from "@pixaura/shared-types";

/**
 * 额度扣减服务
 * 负责额度检查、扣减的统一入口
 * 实现双周期额度限制 + 余额扣减的完整逻辑
 */
@Injectable()
export class QuotaDeductService {
  private readonly logger = new Logger(QuotaDeductService.name);

  // 获取锁重试次数
  private readonly LOCK_RETRY_ATTEMPTS = 3;

  // 获取锁重试间隔（毫秒）
  private readonly LOCK_RETRY_DELAY_MS = 100;

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(QuotaUsage)
    private readonly quotaUsageRepo: Repository<QuotaUsage>,
    @InjectRepository(BalanceRecord)
    private readonly balanceRecordRepo: Repository<BalanceRecord>,
    @InjectRepository(AiModel)
    private readonly aiModelRepo: Repository<AiModel>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly quotaRedisService: QuotaRedisService,
    private readonly quotaManagementService: QuotaManagementService,
    private readonly cycleCalculationService: CycleCalculationService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 检查是否为管理员用户
   * 管理员（perms >= 1）豁免所有计费检查
   */
  private async isAdminUser(userId: string): Promise<boolean> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      return false;
    }
    return isAdmin(user.perms);
  }

  /**
   * 检查额度
   * 供内部模块调用，检查用户是否有足够额度执行操作
   *
   * @param dto 检查请求
   * @returns 检查结果
   */
  async checkQuota(dto: CheckQuotaDto): Promise<QuotaCheckResult> {
    const { userId, modelId, category, count, duration } = dto;

    // Layer 0: 管理员豁免
    const isAdminUser = await this.isAdminUser(userId);
    if (isAdminUser) {
      this.logger.debug(`管理员豁免计费: userId=${userId}`);
      return {
        canExecute: true,
        deductFrom: null, // 不扣减
        estimatedCost: 0,
        quotaCheck: {
          modelSmallCycle: { required: count, available: count, passed: true },
          modelLargeCycle: { required: count, available: count, passed: true },
          categorySmallCycle: { required: count, available: count, passed: true },
          categoryLargeCycle: { required: count, available: count, passed: true },
        },
        reason: "admin_exempt",
        message: "管理员豁免计费",
        remainingBalance: 0,
      };
    }

    // 1. 获取用户订阅
    const subscription = await this.subscriptionRepo.findOne({
      where: { userId, status: SubscriptionStatus.ACTIVE },
    });

    // 2. 获取用户余额
    const balance = await this.quotaRedisService.getBalance(userId);

    // 3. 获取模型价格配置
    // 如果没有 modelId（如 LIP_SYNC 类别），使用默认单价 0.01 元
    const unitPrice = modelId
      ? (await this.getModelPrice(modelId, duration)).price
      : 0.01;
    const estimatedCost = unitPrice * count;

    // 4. 如果没有有效订阅，直接检查余额
    if (!subscription) {
      if (balance >= estimatedCost) {
        return {
          canExecute: true,
          deductFrom: "balance",
          estimatedCost,
          quotaCheck: {
            modelSmallCycle: { required: count, available: 0, passed: false },
            modelLargeCycle: { required: count, available: 0, passed: false },
            categorySmallCycle: {
              required: count,
              available: 0,
              passed: false,
            },
            categoryLargeCycle: {
              required: count,
              available: 0,
              passed: false,
            },
          },
          reason: "no_active_subscription",
          message: "无有效订阅，将使用余额扣费",
          remainingBalance: balance,
        };
      }

      return {
        canExecute: false,
        deductFrom: null,
        estimatedCost,
        quotaCheck: {
          modelSmallCycle: { required: count, available: 0, passed: false },
          modelLargeCycle: { required: count, available: 0, passed: false },
          categorySmallCycle: { required: count, available: 0, passed: false },
          categoryLargeCycle: { required: count, available: 0, passed: false },
        },
        reason: "insufficient_quota_and_balance",
        message: "余额不足",
        remainingBalance: balance,
      };
    }

    // 4. 检查周期是否需要刷新
    await this.quotaManagementService.checkAndRefreshQuota(userId);

    // 5. 检查订阅额度
    const quotaCheck = await this.quotaRedisService.checkQuota(
      userId,
      modelId,
      category,
      count,
    );

    // 6. 判断额度是否充足
    const subscriptionSufficient = quotaCheck.sufficient;

    if (subscriptionSufficient) {
      return {
        canExecute: true,
        deductFrom: "subscription",
        estimatedCost: 0,
        quotaCheck: {
          modelSmallCycle: {
            required: count,
            available: quotaCheck.smallQuota,
            passed: quotaCheck.smallQuota >= count,
          },
          modelLargeCycle: {
            required: count,
            available: quotaCheck.largeQuota,
            passed: quotaCheck.largeQuota >= count,
          },
          categorySmallCycle: {
            required: count,
            available: quotaCheck.categorySmallQuota,
            passed: quotaCheck.categorySmallQuota >= count,
          },
          categoryLargeCycle: {
            required: count,
            available: quotaCheck.categoryLargeQuota,
            passed: quotaCheck.categoryLargeQuota >= count,
          },
        },
        remainingBalance: balance,
      };
    }

    // 7. 订阅额度不足，检查余额
    if (balance >= estimatedCost) {
      // 判断哪个周期不足
      const reasons: string[] = [];
      if (quotaCheck.smallQuota < count) reasons.push("模型小周期额度已耗尽");
      if (quotaCheck.largeQuota < count) reasons.push("模型大周期额度已耗尽");
      if (quotaCheck.categorySmallQuota < count)
        reasons.push("类别小周期额度已耗尽");
      if (quotaCheck.categoryLargeQuota < count)
        reasons.push("类别大周期额度已耗尽");

      return {
        canExecute: true,
        deductFrom: "balance",
        estimatedCost,
        quotaCheck: {
          modelSmallCycle: {
            required: count,
            available: quotaCheck.smallQuota,
            passed: quotaCheck.smallQuota >= count,
          },
          modelLargeCycle: {
            required: count,
            available: quotaCheck.largeQuota,
            passed: quotaCheck.largeQuota >= count,
          },
          categorySmallCycle: {
            required: count,
            available: quotaCheck.categorySmallQuota,
            passed: quotaCheck.categorySmallQuota >= count,
          },
          categoryLargeCycle: {
            required: count,
            available: quotaCheck.categoryLargeQuota,
            passed: quotaCheck.categoryLargeQuota >= count,
          },
        },
        reason: "quota_insufficient",
        message: reasons.join("，") + "，将使用余额扣费",
        remainingBalance: balance,
      };
    }

    // 8. 余额也不足
    return {
      canExecute: false,
      deductFrom: null,
      estimatedCost,
      quotaCheck: {
        modelSmallCycle: {
          required: count,
          available: quotaCheck.smallQuota,
          passed: quotaCheck.smallQuota >= count,
        },
        modelLargeCycle: {
          required: count,
          available: quotaCheck.largeQuota,
          passed: quotaCheck.largeQuota >= count,
        },
        categorySmallCycle: {
          required: count,
          available: quotaCheck.categorySmallQuota,
          passed: quotaCheck.categorySmallQuota >= count,
        },
        categoryLargeCycle: {
          required: count,
          available: quotaCheck.categoryLargeQuota,
          passed: quotaCheck.categoryLargeQuota >= count,
        },
      },
      reason: "insufficient_quota_and_balance",
      message: "订阅额度已耗尽且余额不足",
      remainingBalance: balance,
    };
  }

  /**
   * 扣减额度
   * 统一扣减入口，先尝试订阅额度，不足时扣减余额
   *
   * @param dto 扣减请求
   * @returns 扣减结果
   */
  async deductQuota(dto: DeductQuotaDto): Promise<QuotaDeductResult> {
    const {
      userId,
      modelId,
      category,
      count,
      referenceId,
      idempotencyKey,
      duration,
    } = dto;

    // 1. 检查幂等性（管理员也需要）
    const existingResult =
      await this.quotaRedisService.getIdempotencyResult(idempotencyKey);
    if (existingResult) {
      this.logger.warn(`重复扣减请求，idempotencyKey: ${idempotencyKey}`);
      throw new ConflictException("重复扣减请求");
    }

    // Layer 0: 管理员豁免
    const isAdminUser = await this.isAdminUser(userId);
    if (isAdminUser) {
      this.logger.debug(`管理员豁免扣减: userId=${userId}`);
      const result: QuotaDeductResult = {
        deductedFrom: null,
        amount: 0,
        remainingBalance: 0,
      };
      await this.quotaRedisService.setIdempotencyKey(
        idempotencyKey,
        JSON.stringify(result),
      );
      return result;
    }

    // 2. 获取分布式锁
    const lockValue = await this.acquireLockWithRetry(userId);
    if (!lockValue) {
      throw new BadRequestException("系统繁忙，请稍后重试");
    }

    try {
      // 3. 先执行检查
      const checkResult = await this.checkQuota({
        userId,
        modelId,
        category,
        count,
        duration,
      });

      if (!checkResult.canExecute) {
        throw new BadRequestException(checkResult.message || "额度不足");
      }

      // 4. 根据检查结果执行扣减
      if (checkResult.deductFrom === "subscription") {
        return await this.deductSubscriptionQuota(
          userId,
          modelId,
          category,
          count,
          referenceId,
          lockValue,
          checkResult,
          idempotencyKey,
        );
      } else {
        return await this.deductBalance(
          userId,
          modelId,
          count,
          referenceId,
          idempotencyKey,
          duration,
        );
      }
    } finally {
      // 5. 释放锁
      await this.quotaRedisService.releaseLock(userId, lockValue);
    }
  }

  /**
   * 扣减订阅额度
   */
  private async deductSubscriptionQuota(
    userId: string,
    modelId: string | undefined,
    category: string,
    count: number,
    referenceId: string,
    lockValue: string,
    checkResult: QuotaCheckResult,
    idempotencyKey: string,
  ): Promise<QuotaDeductResult> {
    // 1. Redis Lua 脚本扣减
    const deductResult = await this.quotaRedisService.deductQuota(
      userId,
      modelId,
      category,
      count,
      lockValue,
    );

    if (deductResult.err) {
      throw new BadRequestException(`额度扣减失败: ${deductResult.err}`);
    }

    if (!deductResult.success) {
      throw new BadRequestException("额度扣减失败");
    }

    // 2. 获取周期编号
    const subscription = await this.subscriptionRepo.findOne({
      where: { userId, status: SubscriptionStatus.ACTIVE },
    });

    if (!subscription) {
      throw new BadRequestException("无有效订阅");
    }

    const smallCycleNumber =
      this.cycleCalculationService.calculateSmallCycleNumber(
        subscription.startedAt,
      );
    const largeCycleNumber =
      this.cycleCalculationService.calculateLargeCycleNumber(
        subscription.startedAt,
      );

    // 3. 异步记录额度使用（不阻塞主流程）
    this.recordQuotaUsageAsync(
      userId,
      modelId,
      category,
      count,
      smallCycleNumber,
      largeCycleNumber,
      referenceId,
      deductResult,
    );

    // 4. 设置幂等键
    const result: QuotaDeductResult = {
      deductedFrom: "subscription",
      amount: 0,
      deductedQuota: {
        modelSmallCycle: {
          before: checkResult.quotaCheck.modelSmallCycle.available,
          deducted: count,
          after: deductResult.smallRemaining ?? 0,
        },
        modelLargeCycle: {
          before: checkResult.quotaCheck.modelLargeCycle.available,
          deducted: count,
          after: deductResult.largeRemaining ?? 0,
        },
        categorySmallCycle: {
          before: checkResult.quotaCheck.categorySmallCycle.available,
          deducted: count,
          after: deductResult.categorySmallRemaining ?? 0,
        },
        categoryLargeCycle: {
          before: checkResult.quotaCheck.categoryLargeCycle.available,
          deducted: count,
          after: deductResult.categoryLargeRemaining ?? 0,
        },
      },
      remainingBalance: checkResult.remainingBalance,
    };

    await this.quotaRedisService.setIdempotencyKey(
      idempotencyKey,
      JSON.stringify(result),
    );

    return result;
  }

  /**
   * 扣减余额
   */
  private async deductBalance(
    userId: string,
    modelId: string | undefined,
    count: number,
    referenceId: string,
    idempotencyKey: string,
    duration?: number,
  ): Promise<QuotaDeductResult> {
    // 获取模型价格配置（无 modelId 时使用默认单价）
    const unitPrice = modelId
      ? (await this.getModelPrice(modelId, duration)).price
      : 0.01;
    const cost = unitPrice * count;

    // 1. 数据库事务扣减余额
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let newBalance: number;

    try {
      // 获取并锁定用户余额记录
      // 这里假设用户表中有 balance 字段，实际应该根据你的用户实体调整
      const result = await queryRunner.manager.query(
        `UPDATE users
         SET balance = balance - $1,
             updated_at = NOW()
         WHERE id = $2 AND balance >= $1
         RETURNING balance`,
        [cost, userId],
      );

      if (result.length === 0) {
        await queryRunner.rollbackTransaction();
        throw new BadRequestException("余额不足");
      }

      newBalance = parseFloat(result[0].balance);

      // 记录余额流水
      const balanceRecord = this.balanceRecordRepo.create({
        userId,
        changeAmount: -cost,
        balanceAfter: newBalance,
        type: BalanceRecordType.CONSUMPTION,
        referenceId,
        description: modelId
          ? `模型调用 - ${modelId}`
          : `类别调用 - ${referenceId}`,
      });
      await queryRunner.manager.save(balanceRecord);

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    // 2. 同步更新 Redis 余额
    await this.quotaRedisService.setBalance(userId, newBalance);

    // 3. 设置幂等键
    const result: QuotaDeductResult = {
      deductedFrom: "balance",
      amount: cost,
      remainingBalance: newBalance,
    };

    await this.quotaRedisService.setIdempotencyKey(
      idempotencyKey,
      JSON.stringify(result),
    );

    return result;
  }

  /**
   * 带重试的获取锁
   */
  private async acquireLockWithRetry(userId: string): Promise<string | null> {
    for (let i = 0; i < this.LOCK_RETRY_ATTEMPTS; i++) {
      const lockValue = await this.quotaRedisService.acquireLock(userId);
      if (lockValue) {
        return lockValue;
      }

      if (i < this.LOCK_RETRY_ATTEMPTS - 1) {
        await this.sleep(this.LOCK_RETRY_DELAY_MS * (i + 1));
      }
    }

    return null;
  }

  /**
   * 异步记录额度使用
   */
  private async recordQuotaUsageAsync(
    userId: string,
    modelId: string | undefined,
    category: string,
    count: number,
    smallCycleNumber: number,
    largeCycleNumber: number,
    referenceId: string,
    deductResult: {
      smallRemaining?: number;
      largeRemaining?: number;
      categorySmallRemaining?: number;
      categoryLargeRemaining?: number;
    },
  ): Promise<void> {
    try {
      // 记录模型周期使用（仅当 modelId 存在时）
      if (modelId) {
        // 记录模型小周期使用
        await this.quotaUsageRepo.save({
          userId,
          quotaType: QuotaType.SMALL,
          targetType: "model",
          targetId: modelId,
          cycleNumber: smallCycleNumber,
          amount: -count,
          balanceAfter: deductResult.smallRemaining ?? 0,
          reason: QuotaReason.GENERATION,
          referenceId,
        });

        // 记录模型大周期使用
        await this.quotaUsageRepo.save({
          userId,
          quotaType: QuotaType.LARGE,
          targetType: "model",
          targetId: modelId,
          cycleNumber: largeCycleNumber,
          amount: -count,
          balanceAfter: deductResult.largeRemaining ?? 0,
          reason: QuotaReason.GENERATION,
          referenceId,
        });
      }

      // 记录类别小周期使用
      await this.quotaUsageRepo.save({
        userId,
        quotaType: QuotaType.SMALL,
        targetType: "category",
        targetId: category,
        cycleNumber: smallCycleNumber,
        amount: -count,
        balanceAfter: deductResult.categorySmallRemaining ?? 0,
        reason: QuotaReason.GENERATION,
        referenceId,
      });

      // 记录类别大周期使用
      await this.quotaUsageRepo.save({
        userId,
        quotaType: QuotaType.LARGE,
        targetType: "category",
        targetId: category,
        cycleNumber: largeCycleNumber,
        amount: -count,
        balanceAfter: deductResult.categoryLargeRemaining ?? 0,
        reason: QuotaReason.GENERATION,
        referenceId,
      });
    } catch (error) {
      this.logger.error(
        "记录额度使用失败",
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 返还余额（预扣减多退或失败返还）
   * 通过 Redis 回增余额，同时记录数据库流水
   *
   * @param userId 用户ID
   * @param amount 返还金额（元）
   * @param referenceId 关联业务ID（任务ID）
   * @param reason 返还原因
   */
  async refundBalance(
    userId: string,
    amount: number,
    referenceId: string,
    reason: string,
  ): Promise<void> {
    if (amount <= 0) {
      this.logger.debug(`返还金额<=0，跳过: userId=${userId}, amount=${amount}`);
      return;
    }

    this.logger.log(
      `开始返还余额: userId=${userId}, amount=${amount}, referenceId=${referenceId}, reason=${reason}`,
    );

    // 1. 通过 Redis 回增余额（原子操作）
    const newBalance = await this.quotaRedisService.incrementBalance(userId, amount);

    // 2. 记录余额流水
    const balanceRecord = this.balanceRecordRepo.create({
      userId,
      changeAmount: amount,
      balanceAfter: newBalance,
      type: BalanceRecordType.REFUND,
      referenceId,
      description: `额度返还: ${reason}`,
    });
    await this.balanceRecordRepo.save(balanceRecord);

    this.logger.log(
      `余额返还完成: userId=${userId}, amount=${amount}, newBalance=${newBalance}`,
    );
  }

  /**
   * 获取模型价格配置
   * 根据模型的计费模式返回相应的价格
   *
   * @param modelId 模型ID
   * @param duration 视频时长（秒），按秒计费时使用
   * @returns 预估费用（元）
   */
  private async getModelPrice(
    modelId: string,
    duration?: number,
  ): Promise<{ price: number; billingMode: string }> {
    // 查询模型配置
    const model = await this.aiModelRepo.findOne({
      where: { modelId },
    });

    if (!model) {
      // 默认价格
      return { price: 0.02, billingMode: "per_call" };
    }

    const costConfig = (model.costConfig || {}) as Record<string, unknown>;
    const billingMode = (costConfig.billingMode as string) || "per_call";

    switch (billingMode) {
      case "per_token": {
        const pricePer1kTokens = (costConfig.pricePer1kTokens as number) || 0;
        // 按token计费时，count表示token数量，这里简化处理
        return { price: pricePer1kTokens / 1000, billingMode };
      }
      case "per_second": {
        const pricePerSecond = (costConfig.pricePerSecond as number) || 0;
        // 按秒计费时，使用 duration 计算费用
        const seconds = duration || 1;
        return { price: pricePerSecond * seconds, billingMode };
      }
      case "per_call":
      default: {
        const pricePerCall = (costConfig.pricePerCall as number) || 0.02;
        return { price: pricePerCall, billingMode };
      }
    }
  }
}
