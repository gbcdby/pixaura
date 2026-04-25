import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import {
  QuotaConfig,
  QuotaCycleType,
  QuotaTargetType,
} from "../entities/quota-config.entity";
import {
  QuotaUsage,
  QuotaType,
  QuotaReason,
} from "../entities/quota-usage.entity";
import {
  Subscription,
  SubscriptionTier,
  SubscriptionStatus,
} from "../entities/subscription.entity";
import { QuotaRedisService } from "./quota-redis.service";
import { CycleCalculationService } from "./cycle-calculation.service";
import { AiModel } from "../../model-config/entities/ai-model.entity";
import { FunctionCategoryNames, FunctionCategory } from "@pixaura/shared-types";

/**
 * 额度管理服务
 * 负责额度的查询、初始化、刷新等管理操作
 */
@Injectable()
export class QuotaManagementService {
  private readonly logger = new Logger(QuotaManagementService.name);

  // 兼容旧版 kebab-case 格式的类别 ID 映射
  private readonly legacyCategoryIdMap: Record<string, string> = {
    "text-generation": FunctionCategory.TEXT_GENERATION,
    "image-generation": FunctionCategory.IMAGE_GENERATION,
    "video-generation": FunctionCategory.VIDEO_GENERATION,
    "audio-generation": FunctionCategory.AUDIO_GENERATION,
    "voice-generation": FunctionCategory.VOICE_GENERATION,
    "lip-sync": "LIP_SYNC", // 对口型类别（独立于模型配置系统）
  };

  // 独立类别名称映射（不包含在 FunctionCategory 枚举中）
  private readonly additionalCategoryNames: Record<string, string> = {
    LIP_SYNC: "对口型配音",
  };

  // 独立模型名称映射（不存储在 ai_models 表中的模型）
  private readonly additionalModelNames: Record<string, string> = {
    "omnihuman-1.5": "OmniHuman1.5",
  };

  constructor(
    @InjectRepository(QuotaConfig)
    private readonly quotaConfigRepo: Repository<QuotaConfig>,
    @InjectRepository(QuotaUsage)
    private readonly quotaUsageRepo: Repository<QuotaUsage>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(AiModel)
    private readonly aiModelRepo: Repository<AiModel>,
    private readonly quotaRedisService: QuotaRedisService,
    private readonly cycleCalculationService: CycleCalculationService,
  ) {}

  /**
   * 获取用户的额度配置
   * @param tier 订阅等级
   * @returns 额度配置列表
   */
  async getQuotaConfigs(tier: SubscriptionTier): Promise<QuotaConfig[]> {
    return this.quotaConfigRepo.find({
      where: { tier, isActive: true },
      order: { cycleType: "ASC", targetType: "ASC" },
    });
  }

  /**
   * 获取用户当前额度状态
   * @param userId 用户ID
   * @returns 额度状态
   */
  async getUserQuota(userId: string): Promise<{
    subscription: Subscription | null;
    models: Array<{
      modelId: string;
      modelName: string;
      category: string;
      categoryName: string;
      smallCycle: { total: number; used: number; remaining: number };
      largeCycle: { total: number; used: number; remaining: number };
      canUseSubscription: boolean;
    }>;
    categories: Array<{
      categoryId: string;
      categoryName: string;
      smallCycle: { total: number; used: number; remaining: number };
      largeCycle: { total: number; used: number; remaining: number };
      canUseSubscription: boolean;
    }>;
  }> {
    // 1. 获取用户订阅
    const subscription = await this.subscriptionRepo.findOne({
      where: { userId, status: SubscriptionStatus.ACTIVE },
      order: { createdAt: "DESC" },
    });

    // 2. 获取额度配置
    const configs = subscription
      ? await this.getQuotaConfigs(subscription.tier)
      : [];

    const modelConfigs = configs.filter(
      (c) => c.targetType === QuotaTargetType.MODEL,
    );
    const categoryConfigs = configs.filter(
      (c) => c.targetType === QuotaTargetType.CATEGORY,
    );

    // 3. 从 Redis 获取实时额度
    const modelIds = modelConfigs.map((c) => c.targetId);
    const categoryIds = categoryConfigs.map((c) => c.targetId);

    const redisQuota = await this.quotaRedisService.getQuota(
      userId,
      modelIds,
      categoryIds,
    );

    // 4. 组装模型额度信息
    // 先获取模型配置信息
    const modelConfigEntities = await this.aiModelRepo.findBy({
      modelId: In(modelIds),
    });
    const modelConfigMap = new Map(
      modelConfigEntities.map((m) => [m.modelId, m]),
    );

    const models = modelConfigs
      .filter((c) => c.cycleType === QuotaCycleType.SMALL)
      .map((smallConfig) => {
        const largeConfig = modelConfigs.find(
          (c) =>
            c.targetId === smallConfig.targetId &&
            c.cycleType === QuotaCycleType.LARGE,
        );

        const smallRemaining =
          redisQuota.models[smallConfig.targetId]?.small ?? 0;
        const largeRemaining =
          redisQuota.models[smallConfig.targetId]?.large ?? 0;

        const smallTotal = smallConfig.quotaValue;
        const largeTotal = largeConfig?.quotaValue ?? 0;

        // 获取模型配置信息
        const modelEntity = modelConfigMap.get(smallConfig.targetId);
        const category = modelEntity?.category || "TEXT_GENERATION";
        const modelName = modelEntity?.modelName || this.additionalModelNames[smallConfig.targetId] || smallConfig.targetId;

        return {
          modelId: smallConfig.targetId,
          modelName,
          category,
          categoryName: FunctionCategoryNames[category as FunctionCategory] || this.additionalCategoryNames[category] || category,
          smallCycle: {
            total: smallTotal,
            used: Math.max(0, smallTotal - smallRemaining),
            remaining: smallRemaining,
          },
          largeCycle: {
            total: largeTotal,
            used: Math.max(0, largeTotal - largeRemaining),
            remaining: largeRemaining,
          },
          canUseSubscription: smallRemaining > 0 && largeRemaining > 0,
        };
      });

    // 5. 组装类别额度信息
    const categories = categoryConfigs
      .filter((c) => c.cycleType === QuotaCycleType.SMALL)
      .map((smallConfig) => {
        const largeConfig = categoryConfigs.find(
          (c) =>
            c.targetId === smallConfig.targetId &&
            c.cycleType === QuotaCycleType.LARGE,
        );

        const smallRemaining =
          redisQuota.categories[smallConfig.targetId]?.small ?? 0;
        const largeRemaining =
          redisQuota.categories[smallConfig.targetId]?.large ?? 0;

        const smallTotal = smallConfig.quotaValue;
        const largeTotal = largeConfig?.quotaValue ?? 0;

        // 获取类别名称
        const categoryId = this.legacyCategoryIdMap[smallConfig.targetId] || smallConfig.targetId;
        const categoryName = FunctionCategoryNames[categoryId as FunctionCategory] || this.additionalCategoryNames[categoryId] || categoryId;

        return {
          categoryId,
          categoryName,
          smallCycle: {
            total: smallTotal,
            used: Math.max(0, smallTotal - smallRemaining),
            remaining: smallRemaining,
          },
          largeCycle: {
            total: largeTotal,
            used: Math.max(0, largeTotal - largeRemaining),
            remaining: largeRemaining,
          },
          canUseSubscription: smallRemaining > 0 && largeRemaining > 0,
        };
      });

    return { subscription, models, categories };
  }

  /**
   * 初始化用户额度
   * 在新订阅或周期切换时调用
   * @param userId 用户ID
   * @param subscription 订阅信息
   */
  async initializeUserQuota(
    userId: string,
    subscription: Subscription,
  ): Promise<void> {
    const configs = await this.getQuotaConfigs(subscription.tier);

    const modelConfigs = configs.filter(
      (c) => c.targetType === QuotaTargetType.MODEL,
    );
    const categoryConfigs = configs.filter(
      (c) => c.targetType === QuotaTargetType.CATEGORY,
    );

    await this.quotaRedisService.initializeQuota(
      userId,
      subscription.startedAt,
      modelConfigs,
      categoryConfigs,
    );

    this.logger.log(
      `用户 ${userId} 额度初始化完成，等级: ${subscription.tier}`,
    );
  }

  /**
   * 检查并刷新周期额度
   * @param userId 用户ID
   * @returns 是否已刷新
   */
  async checkAndRefreshQuota(userId: string): Promise<boolean> {
    const subscription = await this.subscriptionRepo.findOne({
      where: { userId, status: SubscriptionStatus.ACTIVE },
    });

    if (!subscription) {
      return false;
    }

    const cycleCheck = await this.quotaRedisService.checkAndSwitchCycle(
      userId,
      subscription.startedAt,
    );

    if (cycleCheck.needSwitch) {
      this.logger.log(`用户 ${userId} 周期切换，重新初始化额度`);
      await this.initializeUserQuota(userId, subscription);
      return true;
    }

    return false;
  }

  /**
   * 记录额度使用
   * @param userId 用户ID
   * @param quotaType 额度类型
   * @param targetType 目标类型
   * @param targetId 目标ID
   * @param cycleNumber 周期编号
   * @param amount 变更数量（负数为扣减）
   * @param balanceAfter 变更后余额
   * @param reason 原因
   * @param referenceId 关联ID
   */
  async recordQuotaUsage(
    userId: string,
    quotaType: QuotaType,
    targetType: string,
    targetId: string,
    cycleNumber: number,
    amount: number,
    balanceAfter: number,
    reason: QuotaReason,
    referenceId?: string,
  ): Promise<QuotaUsage> {
    const usage = this.quotaUsageRepo.create({
      userId,
      quotaType,
      targetType,
      targetId,
      cycleNumber,
      amount,
      balanceAfter,
      reason,
      referenceId: referenceId || null,
    });

    return this.quotaUsageRepo.save(usage);
  }

  /**
   * 获取额度使用历史
   * @param userId 用户ID
   * @param options 查询选项
   * @returns 额度使用记录
   */
  async getQuotaUsageHistory(
    userId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      page?: number;
      pageSize?: number;
    } = {},
  ): Promise<{
    items: QuotaUsage[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { startDate, endDate, page = 1, pageSize = 20 } = options;

    const queryBuilder = this.quotaUsageRepo
      .createQueryBuilder("usage")
      .where("usage.userId = :userId", { userId })
      .orderBy("usage.createdAt", "DESC");

    if (startDate) {
      queryBuilder.andWhere("usage.createdAt >= :startDate", { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere("usage.createdAt <= :endDate", { endDate });
    }

    const [items, total] = await queryBuilder
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items, total, page, pageSize };
  }

  /**
   * 更新额度配置
   * @param configId 配置ID
   * @param updates 更新内容
   * @returns 更新后的配置
   */
  async updateQuotaConfig(
    configId: string,
    updates: { quotaValue?: number; isActive?: boolean },
  ): Promise<QuotaConfig> {
    const config = await this.quotaConfigRepo.findOne({
      where: { id: configId },
    });

    if (!config) {
      throw new NotFoundException("额度配置不存在");
    }

    if (updates.quotaValue !== undefined) {
      config.quotaValue = updates.quotaValue;
    }

    if (updates.isActive !== undefined) {
      config.isActive = updates.isActive;
    }

    return this.quotaConfigRepo.save(config);
  }

  /**
   * 创建额度配置
   * @param data 配置数据
   * @returns 创建的配置
   */
  async createQuotaConfig(data: Partial<QuotaConfig>): Promise<QuotaConfig> {
    const config = this.quotaConfigRepo.create(data);
    return this.quotaConfigRepo.save(config);
  }

  /**
   * 获取所有额度配置
   * @param tier 可选：按等级筛选
   * @returns 额度配置列表（包含 targetName）
   */
  async getAllQuotaConfigs(tier?: SubscriptionTier): Promise<
    Array<
      QuotaConfig & {
        targetName: string;
      }
    >
  > {
    const where: Partial<QuotaConfig> = {};
    if (tier) {
      where.tier = tier;
    }

    const configs = await this.quotaConfigRepo.find({
      where,
      order: { tier: "ASC", cycleType: "ASC" },
    });

    // 收集所有模型ID和类别ID
    const modelIds: string[] = [];
    const categoryIds: string[] = [];

    for (const config of configs) {
      if (config.targetType === QuotaTargetType.MODEL) {
        modelIds.push(config.targetId);
      } else {
        categoryIds.push(config.targetId);
      }
    }

    // 查询模型名称
    const models =
      modelIds.length > 0
        ? await this.aiModelRepo.findBy({
            modelId: In(modelIds),
          })
        : [];

    const modelMap = new Map(models.map((m) => [m.modelId, m.modelName]));

    // 组装结果，添加 targetName
    return configs.map((config) => {
      let targetName = "";

      if (config.targetType === QuotaTargetType.MODEL) {
        // 优先使用独立模型名称映射，其次从 ai_models 表查询，最后使用原始 targetId
        targetName =
          this.additionalModelNames[config.targetId] ||
          modelMap.get(config.targetId) ||
          config.targetId;
      } else {
        // 兼容旧版 kebab-case 格式
        const normalizedCategoryId =
          this.legacyCategoryIdMap[config.targetId] || config.targetId;
        // 优先使用独立类别名称映射，其次使用 FunctionCategoryNames
        targetName =
          this.additionalCategoryNames[normalizedCategoryId] ||
          FunctionCategoryNames[
            normalizedCategoryId as keyof typeof FunctionCategoryNames
          ] ||
          config.targetId;
      }

      return {
        ...config,
        targetName,
      };
    });
  }

  /**
   * 清除用户额度数据
   * @param userId 用户ID
   */
  async clearUserQuota(userId: string): Promise<void> {
    await this.quotaRedisService.clearUserQuota(userId);
    this.logger.log(`用户 ${userId} 额度数据已清除`);
  }

  /**
   * 重新初始化所有活跃用户额度
   * 用于配置变更后批量刷新
   */
  async reinitializeAllActiveQuotas(): Promise<void> {
    const activeSubscriptions = await this.subscriptionRepo.find({
      where: { status: SubscriptionStatus.ACTIVE },
    });

    this.logger.log(
      `开始重新初始化 ${activeSubscriptions.length} 个用户的额度`,
    );

    for (const subscription of activeSubscriptions) {
      try {
        await this.initializeUserQuota(subscription.userId, subscription);
      } catch (error) {
        this.logger.error(
          `重新初始化用户 ${subscription.userId} 额度失败`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    this.logger.log("额度重新初始化完成");
  }
}
