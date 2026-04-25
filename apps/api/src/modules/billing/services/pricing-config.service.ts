import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { RedisService } from "../../../common/redis/redis.service";
import {
  SubscriptionPricing,
  SubscriptionTier,
  SubscriptionPeriod,
} from "../entities/subscription-pricing.entity";
import { PricingHistory } from "../entities/pricing-history.entity";
import { User } from "../../user/entities/user.entity";

/**
 * 订阅价格配置服务
 * 负责价格配置的查询、更新、历史记录管理等
 */
@Injectable()
export class PricingConfigService {
  private readonly logger = new Logger(PricingConfigService.name);
  private readonly CACHE_KEY = "subscription_pricing:all";

  constructor(
    @InjectRepository(SubscriptionPricing)
    private readonly pricingRepo: Repository<SubscriptionPricing>,
    @InjectRepository(PricingHistory)
    private readonly historyRepo: Repository<PricingHistory>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  /**
   * 获取所有价格配置（含更新人信息）
   * 优先从 Redis 缓存读取，未命中则查数据库并回写缓存
   */
  async getAllPricing(): Promise<
    Array<{
      id: string;
      tier: string;
      tier_name: string;
      period: string;
      period_name: string;
      price: number;
      original_price: number | null;
      is_active: boolean;
      updated_at: Date;
      updated_by: string;
      updater_name: string;
    }>
  > {
    const redis = this.redisService.getClient();

    // 尝试从缓存读取
    const cached = await redis.hgetall(this.CACHE_KEY);
    if (cached && Object.keys(cached).length > 0) {
      this.logger.debug("从缓存读取价格配置");
      // 缓存中有完整数据，直接解析返回
      const pricings = JSON.parse(cached.data || "[]");
      return pricings;
    }

    this.logger.debug("缓存未命中，从数据库读取价格配置");
    // 从数据库读取
    const pricings = await this.pricingRepo.find({
      where: { isActive: true },
      order: { tier: "ASC", period: "ASC" },
    });

    const result = [];
    for (const pricing of pricings) {
      const updater = await this.userRepo.findOne({
        where: { id: pricing.updatedBy },
        select: ["id", "username"],
      });

      result.push({
        id: pricing.id,
        tier: pricing.tier,
        tier_name: this.getTierName(pricing.tier),
        period: pricing.period,
        period_name: this.getPeriodName(pricing.period),
        price: parseFloat(pricing.price.toString()),
        original_price: pricing.originalPrice
          ? parseFloat(pricing.originalPrice.toString())
          : null,
        is_active: pricing.isActive,
        updated_at: pricing.updatedAt,
        updated_by: pricing.updatedBy,
        updater_name: updater?.username || "未知",
      });
    }

    // 写入缓存（存储完整数据）
    await redis.hset(this.CACHE_KEY, {
      data: JSON.stringify(result),
      version: Date.now().toString(),
    });
    await redis.expire(this.CACHE_KEY, 86400); // 24 小时 TTL

    return result;
  }

  /**
   * 更新价格配置
   * 使用乐观锁防止并发修改
   */
  async updatePrice(
    tier: string,
    period: string,
    newPrice: number,
    operatorId: string,
    reason?: string,
  ): Promise<{
    id: string;
    tier: string;
    period: string;
    price: number;
    original_price: number | null;
    is_active: boolean;
    version: number;
    updated_at: Date;
    updated_by: string;
    change_record: {
      old_price: number;
      new_price: number;
      reason: string | null;
    };
  }> {
    // 1. 验证价格合法性
    if (newPrice < 0) {
      throw new BadRequestException("价格不能为负数");
    }

    if (!["basic", "pro"].includes(tier)) {
      throw new BadRequestException("订阅等级不合法");
    }

    if (!["monthly", "yearly"].includes(period)) {
      throw new BadRequestException("周期类型不合法");
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 2. 查询当前价格（带版本号）
      const pricing = await queryRunner.manager.findOne(SubscriptionPricing, {
        where: {
          tier: tier as SubscriptionTier,
          period: period as SubscriptionPeriod,
          isActive: true,
        },
      });

      if (!pricing) {
        throw new NotFoundException("价格配置不存在");
      }

      const oldPrice = parseFloat(pricing.price.toString());
      const currentVersion = pricing.version;

      // 3. 检查价格变更幅度（超过 50% 记录警告）
      const changePercent =
        oldPrice > 0 ? Math.abs((newPrice - oldPrice) / oldPrice) * 100 : 0;

      if (changePercent > 50) {
        this.logger.warn(
          `价格变更幅度过大：${tier}-${period} 从 ${oldPrice} 变更为 ${newPrice} (${changePercent.toFixed(2)}%)`,
        );
        // MVP 阶段仅记录警告，后续可扩展为需要二次确认
      }

      // 4. 更新价格（带乐观锁）
      const updateResult = await queryRunner.manager.update(
        SubscriptionPricing,
        pricing.id,
        {
          price: newPrice,
          version: currentVersion + 1,
          updatedBy: operatorId,
        },
      );

      // 5. 检查是否更新成功（乐观锁校验）
      if (updateResult.affected === 0) {
        throw new ConflictException("价格已被其他管理员修改，请刷新后重试");
      }

      // 6. 写入历史记录
      await queryRunner.manager.save(PricingHistory, {
        pricingId: pricing.id,
        operatorId,
        oldPrice,
        newPrice,
        changeReason: reason || null,
      });

      await queryRunner.commitTransaction();

      // 7. 清除缓存
      await this.clearCache();

      // 8. 返回结果
      return {
        id: pricing.id,
        tier,
        period,
        price: newPrice,
        original_price: pricing.originalPrice
          ? parseFloat(pricing.originalPrice.toString())
          : null,
        is_active: pricing.isActive,
        version: currentVersion + 1,
        updated_at: new Date(),
        updated_by: operatorId,
        change_record: {
          old_price: oldPrice,
          new_price: newPrice,
          reason: reason || null,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 获取价格变更历史
   * 支持筛选和分页
   */
  async getHistory(query: {
    tier?: string;
    period?: string;
    operator_id?: string;
    start_date?: string;
    end_date?: string;
    page?: number;
    page_size?: number;
  }): Promise<{
    total: number;
    page: number;
    page_size: number;
    items: Array<{
      id: string;
      pricing_id: string;
      tier: string;
      tier_name: string;
      period: string;
      period_name: string;
      old_price: number;
      new_price: number;
      price_change: number;
      price_change_percent: number;
      operator_id: string;
      operator_name: string;
      change_reason: string | null;
      changed_at: Date;
    }>;
  }> {
    const {
      tier,
      period,
      operator_id,
      start_date,
      end_date,
      page = 1,
      page_size = 20,
    } = query;

    // 使用原生SQL查询以避免TypeORM关系查询问题
    let sql = `
      SELECT
        h.id,
        h.pricing_id,
        h.operator_id,
        h.old_price,
        h.new_price,
        h.change_reason,
        h.changed_at,
        p.tier,
        p.period,
        u.username as operator_name
      FROM pricing_history h
      INNER JOIN subscription_pricing p ON h.pricing_id = p.id
      LEFT JOIN users u ON h.operator_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (tier) {
      sql += ` AND p.tier = $${params.length + 1}`;
      params.push(tier);
    }
    if (period) {
      sql += ` AND p.period = $${params.length + 1}`;
      params.push(period);
    }
    if (operator_id) {
      sql += ` AND h.operator_id = $${params.length + 1}`;
      params.push(operator_id);
    }
    if (start_date) {
      sql += ` AND h.changed_at >= $${params.length + 1}`;
      params.push(new Date(start_date));
    }
    if (end_date) {
      sql += ` AND h.changed_at <= $${params.length + 1}`;
      params.push(new Date(end_date + "T23:59:59"));
    }

    // 获取总数
    const countSql = `SELECT COUNT(*) as total FROM (${sql}) as subquery`;
    const countResult = await this.dataSource.query(countSql, params);
    const total = parseInt(countResult[0]?.total || "0", 10);

    // 添加排序和分页
    sql += ` ORDER BY h.changed_at DESC`;
    sql += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(page_size, (page - 1) * page_size);

    // 执行查询
    const items = await this.dataSource.query(sql, params);

    // 格式化返回数据
    const formattedItems = items.map((item: any) => ({
      id: item.id,
      pricing_id: item.pricing_id,
      tier: item.tier,
      tier_name: this.getTierName(item.tier),
      period: item.period,
      period_name: this.getPeriodName(item.period),
      old_price: parseFloat(item.old_price),
      new_price: parseFloat(item.new_price),
      price_change: parseFloat((item.new_price - item.old_price).toString()),
      price_change_percent: parseFloat(
        (((item.new_price - item.old_price) / item.old_price) * 100).toFixed(2),
      ),
      operator_id: item.operator_id,
      operator_name: item.operator_name || "未知",
      change_reason: item.change_reason,
      changed_at: item.changed_at,
    }));

    return {
      total,
      page,
      page_size,
      items: formattedItems,
    };
  }

  /**
   * 获取指定订阅等级和周期的价格（供内部调用）
   */
  async getPricing(
    tier: SubscriptionTier,
    period: SubscriptionPeriod,
  ): Promise<number> {
    const pricings = await this.getAllPricing();
    const key = `${tier}:${period}`;
    const pricing = pricings.find(
      (p) => p.tier === tier && p.period === period,
    );

    if (!pricing) {
      throw new NotFoundException(`价格配置不存在：${tier}-${period}`);
    }

    return pricing.price;
  }

  /**
   * 清除缓存
   */
  async clearCache(): Promise<void> {
    const redis = this.redisService.getClient();
    await redis.del(this.CACHE_KEY);
    this.logger.debug("价格配置缓存已清除");
  }

  /**
   * 获取订阅等级名称
   */
  private getTierName(tier: string): string {
    const names: Record<string, string> = {
      basic: "普通订阅",
      pro: "专业订阅",
    };
    return names[tier] || tier;
  }

  /**
   * 获取周期名称
   */
  private getPeriodName(period: string): string {
    const names: Record<string, string> = {
      monthly: "月度",
      yearly: "年度",
    };
    return names[period] || period;
  }
}
