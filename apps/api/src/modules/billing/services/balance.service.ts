import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource, In, Between } from "typeorm";
import {
  BalanceRecord,
  BalanceRecordType,
} from "../entities/balance-record.entity";
import {
  RechargeOrder,
  PaymentStatus,
  PaymentMethod,
} from "../entities/recharge-order.entity";
import { RechargePromotion } from "../entities/recharge-promotion.entity";
import { QuotaRedisService } from "./quota-redis.service";
import { UserService } from "../../user/user.service";

/**
 * 余额管理服务
 * 负责余额查询、充值、消费记录等
 */
@Injectable()
export class BalanceService {
  private readonly logger = new Logger(BalanceService.name);

  constructor(
    @InjectRepository(BalanceRecord)
    private readonly balanceRecordRepo: Repository<BalanceRecord>,
    @InjectRepository(RechargeOrder)
    private readonly rechargeOrderRepo: Repository<RechargeOrder>,
    @InjectRepository(RechargePromotion)
    private readonly promotionRepo: Repository<RechargePromotion>,
    private readonly quotaRedisService: QuotaRedisService,
    private readonly dataSource: DataSource,
    private readonly userService: UserService,
  ) {}

  /**
   * 获取用户余额
   * @param userId 用户ID
   * @returns 余额
   */
  async getBalance(userId: string): Promise<number> {
    // 优先从 Redis 获取（实时）
    const redisBalance = await this.quotaRedisService.getBalance(userId);

    // 如果 Redis 没有，从数据库获取并同步到 Redis
    if (redisBalance === 0) {
      const dbBalance = await this.getBalanceFromDB(userId);
      if (dbBalance > 0) {
        await this.quotaRedisService.setBalance(userId, dbBalance);
      }
      return dbBalance;
    }

    return redisBalance;
  }

  /**
   * 从数据库获取余额
   * @param userId 用户ID
   * @returns 余额
   */
  private async getBalanceFromDB(userId: string): Promise<number> {
    const latestRecord = await this.balanceRecordRepo.findOne({
      where: { userId },
      order: { createdAt: "DESC" },
    });

    return latestRecord?.balanceAfter ?? 0;
  }

  /**
   * 获取余额流水
   * @param userId 用户ID
   * @param page 页码
   * @param pageSize 每页数量
   * @returns 流水记录
   */
  async getBalanceRecords(
    userId: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<{
    items: BalanceRecord[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const [items, total] = await this.balanceRecordRepo.findAndCount({
      where: { userId },
      order: { createdAt: "DESC" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return { items, total, page, pageSize };
  }

  /**
   * 创建充值订单
   * @param userId 用户ID
   * @param amount 充值金额
   * @param paymentMethod 支付方式
   * @returns 充值订单
   */
  async createRechargeOrder(
    userId: string,
    amount: number,
    paymentMethod: PaymentMethod,
  ): Promise<RechargeOrder> {
    // 检查最低充值金额
    if (amount < 10) {
      throw new BadRequestException("充值金额至少10元");
    }

    // 计算赠送金额
    const bonus = await this.calculateRechargeBonus(amount);
    const credits = amount + bonus;

    // 创建订单
    const order = this.rechargeOrderRepo.create({
      userId,
      amount,
      credits,
      paymentMethod,
      paymentStatus: PaymentStatus.PENDING,
    });

    return this.rechargeOrderRepo.save(order);
  }

  /**
   * 获取充值订单
   * @param orderId 订单ID
   * @returns 订单
   */
  async getRechargeOrder(orderId: string): Promise<RechargeOrder> {
    const order = await this.rechargeOrderRepo.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException("充值订单不存在");
    }

    return order;
  }

  /**
   * 处理支付回调
   * @param orderId 订单ID
   * @param transactionNo 第三方交易号
   * @returns 是否处理成功
   */
  async handlePaymentCallback(
    orderId: string,
    transactionNo: string,
  ): Promise<boolean> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. 获取并锁定订单
      const order = await queryRunner.manager.findOne(RechargeOrder, {
        where: { id: orderId },
        lock: { mode: "pessimistic_write" },
      });

      if (!order) {
        await queryRunner.rollbackTransaction();
        this.logger.warn(`支付回调：订单 ${orderId} 不存在`);
        return false;
      }

      // 2. 幂等检查：已处理的订单直接返回成功
      if (order.paymentStatus === PaymentStatus.PAID) {
        await queryRunner.rollbackTransaction();
        this.logger.log(`支付回调：订单 ${orderId} 已处理`);
        return true;
      }

      // 3. 检查订单状态
      if (order.paymentStatus !== PaymentStatus.PENDING) {
        await queryRunner.rollbackTransaction();
        this.logger.warn(
          `支付回调：订单 ${orderId} 状态异常 ${order.paymentStatus}`,
        );
        return false;
      }

      // 4. 更新订单状态
      order.paymentStatus = PaymentStatus.PAID;
      order.transactionNo = transactionNo;
      order.paidAt = new Date();
      await queryRunner.manager.save(order);

      // 5. 增加用户余额
      const currentBalance = await this.getBalance(order.userId);
      const newBalance = currentBalance + order.credits;

      await queryRunner.manager.query(
        `UPDATE users
         SET balance = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [newBalance, order.userId],
      );

      // 6. 记录余额流水
      const balanceRecord = this.balanceRecordRepo.create({
        userId: order.userId,
        changeAmount: order.credits,
        balanceAfter: newBalance,
        type: BalanceRecordType.RECHARGE,
        referenceId: order.id,
        description: `余额充值（含赠送 ${order.credits - order.amount} 元）`,
      });
      await queryRunner.manager.save(balanceRecord);

      await queryRunner.commitTransaction();

      // 7. 同步更新 Redis
      await this.quotaRedisService.setBalance(order.userId, newBalance);

      this.logger.log(
        `用户 ${order.userId} 充值成功，金额: ${order.amount}，赠送: ${order.credits - order.amount}，余额: ${newBalance}`,
      );

      return true;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `处理支付回调失败: ${orderId}`,
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 计算充值赠送金额
   * @param amount 充值金额
   * @returns 赠送金额
   */
  async calculateRechargeBonus(amount: number): Promise<number> {
    const now = new Date();

    // 获取有效的充值活动
    const promotions = await this.promotionRepo.find({
      where: {
        isActive: true,
      },
    });

    // 过滤出满足条件的活动
    const validPromotions = promotions.filter((p) => {
      if (p.startAt && p.startAt > now) return false;
      if (p.endAt && p.endAt < now) return false;
      return p.minAmount <= amount;
    });

    if (validPromotions.length === 0) {
      return 0;
    }

    // 选择赠送最多的活动
    let maxBonus = 0;

    for (const promotion of validPromotions) {
      let bonus = 0;

      if (promotion.bonusType === "percent") {
        bonus = amount * promotion.bonusValue;
        if (promotion.maxBonus && bonus > promotion.maxBonus) {
          bonus = promotion.maxBonus;
        }
      } else {
        bonus = promotion.bonusValue;
      }

      if (bonus > maxBonus) {
        maxBonus = bonus;
      }
    }

    return parseFloat(maxBonus.toFixed(2));
  }

  /**
   * 手动调整余额（管理员）
   * @param userId 用户ID
   * @param amount 调整金额（正数增加，负数减少）
   * @param reason 调整原因
   * @param description 详细描述
   * @param operatorId 操作人ID
   * @returns 调整后的余额
   */
  async adjustBalance(
    userId: string,
    amount: number,
    reason: string,
    description?: string,
    operatorId?: string,
  ): Promise<{ beforeBalance: number; afterBalance: number }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 获取当前余额
      const currentBalance = await this.getBalance(userId);
      const newBalance = currentBalance + amount;

      // 检查扣减后余额是否充足
      if (newBalance < 0) {
        throw new BadRequestException("扣减后余额不足");
      }

      // 更新数据库余额
      await queryRunner.manager.query(
        `UPDATE users
         SET balance = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [newBalance, userId],
      );

      // 记录流水
      const balanceRecord = this.balanceRecordRepo.create({
        userId,
        changeAmount: amount,
        balanceAfter: newBalance,
        type:
          amount > 0 ? BalanceRecordType.RECHARGE : BalanceRecordType.REFUND,
        referenceId: operatorId,
        description: `[管理员调整] ${reason}${description ? ` - ${description}` : ""}`,
      });
      await queryRunner.manager.save(balanceRecord);

      await queryRunner.commitTransaction();

      // 同步 Redis
      await this.quotaRedisService.setBalance(userId, newBalance);

      this.logger.log(
        `用户 ${userId} 余额调整: ${currentBalance} -> ${newBalance}，调整金额: ${amount}，原因: ${reason}，操作人: ${operatorId}`,
      );

      return { beforeBalance: currentBalance, afterBalance: newBalance };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 获取充值活动列表
   * @returns 充值活动列表
   */
  async getRechargePromotions(): Promise<RechargePromotion[]> {
    const now = new Date();

    const promotions = await this.promotionRepo.find({
      where: { isActive: true },
      order: { minAmount: "ASC" },
    });

    // 过滤出当前有效的活动
    return promotions.filter((p) => {
      if (p.startAt && p.startAt > now) return false;
      if (p.endAt && p.endAt < now) return false;
      return true;
    });
  }

  /**
   * 创建充值活动（管理员）
   * @param data 活动数据
   * @returns 创建的活动
   */
  async createRechargePromotion(
    data: Partial<RechargePromotion>,
  ): Promise<RechargePromotion> {
    const promotion = this.promotionRepo.create(data);
    return this.promotionRepo.save(promotion);
  }

  /**
   * 更新充值活动（管理员）
   * @param promotionId 活动ID
   * @param updates 更新内容
   * @returns 更新后的活动
   */
  async updateRechargePromotion(
    promotionId: string,
    updates: Partial<RechargePromotion>,
  ): Promise<RechargePromotion> {
    const promotion = await this.promotionRepo.findOne({
      where: { id: promotionId },
    });

    if (!promotion) {
      throw new NotFoundException("充值活动不存在");
    }

    Object.assign(promotion, updates);
    return this.promotionRepo.save(promotion);
  }

  /**
   * 查询所有充值订单（管理员）
   * @param options 查询选项
   * @returns 充值订单列表
   */
  async getAllRechargeOrders(
    options: {
      userId?: string;
      username?: string;
      status?: PaymentStatus;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      pageSize?: number;
    } = {},
  ): Promise<{
    items: Array<RechargeOrder & { username: string | null }>;
    total: number;
    page: number;
    pageSize: number;
  }> {
    const {
      userId,
      username,
      status,
      startDate,
      endDate,
      page = 1,
      pageSize = 20,
    } = options;

    let targetUserId = userId;

    // 如果提供了用户名，先查找用户ID
    if (username && !userId) {
      const user = await this.userService.findByUsername(username);
      if (user) {
        targetUserId = user.id;
      } else {
        return { items: [], total: 0, page, pageSize };
      }
    }

    const where: any = {};
    if (targetUserId) where.userId = targetUserId;
    if (status) where.paymentStatus = status;
    if (startDate && endDate) {
      where.createdAt = Between(startDate, endDate);
    } else if (startDate) {
      where.createdAt = Between(startDate, new Date());
    }

    const [orders, total] = await this.rechargeOrderRepo.findAndCount({
      where,
      order: { createdAt: "DESC" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // 获取所有相关用户信息
    const userIds = orders.map((o) => o.userId);
    const users = await this.userService["userRepository"].findBy({
      id: In(userIds),
    });
    const userMap = new Map(users.map((u) => [u.id, u.username]));

    const items = orders.map((order) => ({
      ...order,
      username: userMap.get(order.userId) || null,
    }));

    return { items, total, page, pageSize };
  }

  /**
   * 查询所有余额流水（管理员）
   * @param options 查询选项
   * @returns 余额流水列表
   */
  async getAllBalanceRecords(
    options: {
      userId?: string;
      username?: string;
      type?: BalanceRecordType;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      pageSize?: number;
    } = {},
  ): Promise<{
    items: Array<BalanceRecord & { username: string | null }>;
    total: number;
    page: number;
    pageSize: number;
  }> {
    const {
      userId,
      username,
      type,
      startDate,
      endDate,
      page = 1,
      pageSize = 20,
    } = options;

    let targetUserId = userId;

    // 如果提供了用户名，先查找用户ID
    if (username && !userId) {
      const user = await this.userService.findByUsername(username);
      if (user) {
        targetUserId = user.id;
      } else {
        return { items: [], total: 0, page, pageSize };
      }
    }

    const where: any = {};
    if (targetUserId) where.userId = targetUserId;
    if (type) where.type = type;
    if (startDate && endDate) {
      where.createdAt = Between(startDate, endDate);
    } else if (startDate) {
      where.createdAt = Between(startDate, new Date());
    }

    const [records, total] = await this.balanceRecordRepo.findAndCount({
      where,
      order: { createdAt: "DESC" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // 获取所有相关用户信息
    const userIds = records.map((r) => r.userId);
    const users = await this.userService["userRepository"].findBy({
      id: In(userIds),
    });
    const userMap = new Map(users.map((u) => [u.id, u.username]));

    const items = records.map((record) => ({
      ...record,
      username: userMap.get(record.userId) || null,
    }));

    return { items, total, page, pageSize };
  }
}
