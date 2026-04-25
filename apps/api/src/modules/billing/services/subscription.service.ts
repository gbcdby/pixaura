import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource, In } from "typeorm";
import {
  Subscription,
  SubscriptionTier,
  SubscriptionPeriod,
  SubscriptionStatus,
} from "../entities/subscription.entity";
import { QuotaManagementService } from "./quota-management.service";
import { CycleCalculationService } from "./cycle-calculation.service";
import { QuotaRedisService } from "./quota-redis.service";
import { PricingConfigService } from "./pricing-config.service";
import { UserService } from "../../user/user.service";
import type {
  CreateSubscriptionDto,
  GrantSubscriptionDto,
} from "@pixaura/shared-types";

/**
 * 订阅价格配置（从数据库读取）
 * 原硬编码价格已迁移至 subscription_pricing 表
 */

/**
 * 订阅管理服务
 * 负责订阅的创建、升级、取消、查询等
 */
@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    private readonly quotaManagementService: QuotaManagementService,
    private readonly cycleCalculationService: CycleCalculationService,
    private readonly quotaRedisService: QuotaRedisService,
    private readonly pricingConfigService: PricingConfigService,
    private readonly dataSource: DataSource,
    private readonly userService: UserService,
  ) {}

  /**
   * 获取用户当前订阅
   * @param userId 用户ID
   * @returns 订阅信息
   */
  async getCurrentSubscription(userId: string): Promise<Subscription | null> {
    return this.subscriptionRepo.findOne({
      where: { userId, status: SubscriptionStatus.ACTIVE },
      order: { createdAt: "DESC" },
    });
  }

  /**
   * 创建或升级订阅
   * @param userId 用户ID
   * @param dto 创建订阅请求
   * @returns 创建的订阅
   */
  async createSubscription(
    userId: string,
    dto: CreateSubscriptionDto,
  ): Promise<{
    subscription: Subscription;
    amount: number;
    isUpgrade: boolean;
  }> {
    const { tier, period, autoRenew } = dto;

    // 1. 检查是否已有有效订阅
    const currentSubscription = await this.getCurrentSubscription(userId);

    // 2. 如果是降级，拒绝处理
    if (
      currentSubscription &&
      this.isDowngrade(currentSubscription.tier, tier as SubscriptionTier)
    ) {
      throw new BadRequestException("不支持降级操作，请先取消当前订阅");
    }

    // 3. 如果是同级续费，延长有效期
    if (currentSubscription && currentSubscription.tier === tier) {
      const newExpiresAt =
        this.cycleCalculationService.calculateRenewalExpiresAt(
          currentSubscription.expiresAt,
          period,
        );

      currentSubscription.expiresAt = newExpiresAt;
      currentSubscription.autoRenew = autoRenew;

      const updated = await this.subscriptionRepo.save(currentSubscription);

      // 从数据库获取价格
      const price = await this.pricingConfigService.getPricing(
        tier as any,
        period as SubscriptionPeriod,
      );

      return {
        subscription: updated,
        amount: price,
        isUpgrade: false,
      };
    }

    // 4. 如果是升级，计算差价
    // 从数据库获取新价格
    let amount = await this.pricingConfigService.getPricing(
      tier as any,
      period as SubscriptionPeriod,
    );
    let isUpgrade = false;

    if (currentSubscription) {
      // 从数据库获取当前价格
      const currentPrice = await this.pricingConfigService.getPricing(
        currentSubscription.tier as any,
        currentSubscription.period as SubscriptionPeriod,
      );

      const remainingValue =
        this.cycleCalculationService.calculateUpgradeRemainingValue(
          currentPrice,
          currentSubscription.startedAt,
          currentSubscription.expiresAt,
        );

      amount = Math.max(0, amount - remainingValue);
      isUpgrade = true;
    }

    // 5. 创建新订阅
    const now = new Date();
    const expiresAt = this.calculateExpiresAt(
      now,
      period as SubscriptionPeriod,
    );

    const subscription = this.subscriptionRepo.create({
      userId,
      tier: tier as SubscriptionTier,
      period: period as SubscriptionPeriod,
      status: SubscriptionStatus.ACTIVE,
      startedAt: now,
      expiresAt,
      autoRenew,
    });

    const savedSubscription = await this.subscriptionRepo.save(subscription);

    // 6. 同步更新用户表的订阅状态
    await this.userService.updateSubscriptionStatus(
      userId,
      tier,
      expiresAt,
    );

    // 7. 初始化额度
    await this.quotaManagementService.initializeUserQuota(
      userId,
      savedSubscription,
    );

    this.logger.log(
      `用户 ${userId} ${isUpgrade ? "升级" : "订阅"} ${tier} ${period}，金额: ${amount}`,
    );

    return { subscription: savedSubscription, amount, isUpgrade };
  }

  /**
   * 取消订阅（关闭自动续费）
   * @param userId 用户ID
   * @returns 取消后的订阅
   */
  async cancelSubscription(userId: string): Promise<Subscription> {
    const subscription = await this.getCurrentSubscription(userId);

    if (!subscription) {
      throw new NotFoundException("没有有效的订阅");
    }

    subscription.autoRenew = false;

    return this.subscriptionRepo.save(subscription);
  }

  /**
   * 手动赋予订阅（管理员）
   * @param dto 赋予请求
   * @param grantedBy 操作人ID
   * @returns 赋予的订阅
   */
  async grantSubscription(
    dto: GrantSubscriptionDto,
    grantedBy: string,
  ): Promise<Subscription> {
    const { userId, tier, period, durationDays, reason, description } = dto;

    // 确保 userId 存在
    if (!userId) {
      throw new BadRequestException("用户ID不能为空");
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. 取消现有订阅
      const currentSubscription = await this.subscriptionRepo.findOne({
        where: { userId, status: SubscriptionStatus.ACTIVE },
      });

      if (currentSubscription) {
        currentSubscription.status = SubscriptionStatus.CANCELLED;
        await queryRunner.manager.save(currentSubscription);
      }

      // 2. 创建新订阅
      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setDate(expiresAt.getDate() + durationDays);

      const subscription = this.subscriptionRepo.create({
        userId,
        tier: tier as SubscriptionTier,
        period: period as SubscriptionPeriod,
        status: SubscriptionStatus.ACTIVE,
        startedAt: now,
        expiresAt,
        autoRenew: false,
      });

      const savedSubscription = await queryRunner.manager.save(subscription);

      await queryRunner.commitTransaction();

      // 3. 同步更新用户表的订阅状态
      await this.userService.updateSubscriptionStatus(
        userId,
        tier,
        expiresAt,
      );

      // 4. 清除旧额度，初始化新额度
      await this.quotaRedisService.clearUserQuota(userId);
      await this.quotaManagementService.initializeUserQuota(
        userId,
        savedSubscription,
      );

      this.logger.log(
        `管理员 ${grantedBy} 为用户 ${userId} 赋予 ${tier} 订阅 ${durationDays} 天，原因: ${reason}`,
      );

      return savedSubscription;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 处理订阅过期
   * 定时任务调用
   */
  async handleSubscriptionExpiration(): Promise<void> {
    const now = new Date();

    // 查找已过期的订阅
    const expiredSubscriptions = await this.subscriptionRepo.find({
      where: {
        status: SubscriptionStatus.ACTIVE,
        expiresAt: { $lt: now } as any,
      },
    });

    for (const subscription of expiredSubscriptions) {
      if (subscription.autoRenew) {
        // 尝试自动续费
        await this.autoRenewSubscription(subscription);
      } else {
        // 标记为过期
        subscription.status = SubscriptionStatus.EXPIRED;
        await this.subscriptionRepo.save(subscription);

        // 同步更新用户表的订阅状态为 free
        await this.userService.updateSubscriptionStatus(
          subscription.userId,
          "free",
          null,
        );

        // 清除额度
        await this.quotaRedisService.clearUserQuota(subscription.userId);

        this.logger.log(`用户 ${subscription.userId} 订阅已过期`);
      }
    }
  }

  /**
   * 自动续费处理
   * @param subscription 订阅
   */
  private async autoRenewSubscription(
    subscription: Subscription,
  ): Promise<void> {
    try {
      const newExpiresAt =
        this.cycleCalculationService.calculateRenewalExpiresAt(
          subscription.expiresAt,
          subscription.period,
        );

      subscription.expiresAt = newExpiresAt;
      await this.subscriptionRepo.save(subscription);

      this.logger.log(
        `用户 ${subscription.userId} 订阅自动续费成功，新过期时间: ${newExpiresAt}`,
      );
    } catch (error) {
      this.logger.error(
        `用户 ${subscription.userId} 订阅自动续费失败`,
        error instanceof Error ? error.stack : undefined,
      );

      // 续费失败，标记为过期
      subscription.status = SubscriptionStatus.EXPIRED;
      subscription.autoRenew = false;
      await this.subscriptionRepo.save(subscription);
    }
  }

  /**
   * 获取所有订阅等级信息
   * @returns 订阅等级列表
   */
  async getAvailableTiers(): Promise<
    Array<{
      tier: SubscriptionTier;
      name: string;
      monthlyPrice: number;
      yearlyPrice: number;
      features: string[];
    }>
  > {
    // 从数据库获取价格
    const basicMonthly = await this.pricingConfigService.getPricing(
      "basic" as any,
      "monthly" as any,
    );
    const basicYearly = await this.pricingConfigService.getPricing(
      "basic" as any,
      "yearly" as any,
    );
    const proMonthly = await this.pricingConfigService.getPricing(
      "pro" as any,
      "monthly" as any,
    );
    const proYearly = await this.pricingConfigService.getPricing(
      "pro" as any,
      "yearly" as any,
    );

    return [
      {
        tier: SubscriptionTier.BASIC,
        name: "普通订阅",
        monthlyPrice: basicMonthly,
        yearlyPrice: basicYearly,
        features: ["文本生成额度", "图像生成额度", "基础模型使用权限"],
      },
      {
        tier: SubscriptionTier.PRO,
        name: "专业订阅",
        monthlyPrice: proMonthly,
        yearlyPrice: proYearly,
        features: [
          "更多文本生成额度",
          "更多图像生成额度",
          "视频生成额度",
          "高级模型使用权限",
          "优先队列",
        ],
      },
    ];
  }

  /**
   * 获取用户订阅列表（管理员）
   * @param options 查询选项
   * @returns 订阅列表（包含用户名）
   */
  async getSubscriptions(
    options: {
      userId?: string;
      username?: string;
      status?: SubscriptionStatus;
      page?: number;
      pageSize?: number;
    } = {},
  ): Promise<{
    items: Array<Subscription & { username: string | null }>;
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { userId, username, status, page = 1, pageSize = 20 } = options;

    let targetUserId = userId;

    // 如果提供了用户名，先查找用户ID
    if (username && !userId) {
      const user = await this.userService.findByUsername(username);
      if (user) {
        targetUserId = user.id;
      } else {
        // 用户名不存在，返回空结果
        return { items: [], total: 0, page, pageSize };
      }
    }

    const where: any = {};
    if (targetUserId) where.userId = targetUserId;
    if (status) where.status = status;

    const [subscriptions, total] = await this.subscriptionRepo.findAndCount({
      where,
      order: { createdAt: "DESC" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // 获取所有相关用户信息
    const userIds = subscriptions.map((s) => s.userId);
    const users = await this.userService["userRepository"].findBy({
      id: In(userIds),
    });
    const userMap = new Map(users.map((u) => [u.id, u.username]));

    // 合并用户名到订阅数据
    const items = subscriptions.map((sub) => ({
      id: sub.id,
      userId: sub.userId,
      username: userMap.get(sub.userId) || null,
      tier: sub.tier,
      period: sub.period,
      status: sub.status,
      startedAt: sub.startedAt,
      expiresAt: sub.expiresAt,
      autoRenew: sub.autoRenew,
      version: sub.version,
      createdAt: sub.createdAt,
      updatedAt: sub.updatedAt,
    }));

    return { items, total, page, pageSize };
  }

  /**
   * 判断是否为降级
   * @param currentTier 当前等级
   * @param targetTier 目标等级
   * @returns 是否为降级
   */
  private isDowngrade(
    currentTier: SubscriptionTier,
    targetTier: SubscriptionTier,
  ): boolean {
    const tierOrder = [
      SubscriptionTier.FREE,
      SubscriptionTier.BASIC,
      SubscriptionTier.PRO,
    ];

    const currentIndex = tierOrder.indexOf(currentTier);
    const targetIndex = tierOrder.indexOf(targetTier);

    return targetIndex < currentIndex;
  }

  /**
   * 计算订阅过期时间
   * @param startAt 开始时间
   * @param period 周期类型
   * @returns 过期时间
   */
  private calculateExpiresAt(startAt: Date, period: SubscriptionPeriod): Date {
    const expiresAt = new Date(startAt);

    if (period === SubscriptionPeriod.MONTHLY) {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    } else {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    }

    return expiresAt;
  }

  /**
   * 新用户注册赠送体验订阅
   * @param userId 用户ID
   * @param queryRunner 事务查询运行器
   * @returns 创建的订阅
   */
  async createTrialSubscription(
    userId: string,
    queryRunner?: any,
  ): Promise<Subscription> {
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setHours(expiresAt.getHours() + 1); // 1小时体验

    const subscription = this.subscriptionRepo.create({
      userId,
      tier: SubscriptionTier.BASIC,
      period: SubscriptionPeriod.MONTHLY,
      status: SubscriptionStatus.ACTIVE,
      startedAt: now,
      expiresAt,
      autoRenew: false,
    });

    let savedSubscription: Subscription;

    if (queryRunner) {
      savedSubscription = await queryRunner.manager.save(subscription);
    } else {
      savedSubscription = await this.subscriptionRepo.save(subscription);
    }

    // 初始化额度
    await this.quotaManagementService.initializeUserQuota(
      userId,
      savedSubscription,
    );

    this.logger.log(`用户 ${userId} 获得1小时体验订阅`);

    return savedSubscription;
  }
}
