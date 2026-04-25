import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between } from "typeorm";
import { User } from "../../user/entities/user.entity";
import {
  RechargeOrder,
  PaymentStatus,
} from "../../billing/entities/recharge-order.entity";
import { AiModel } from "../../model-config/entities/ai-model.entity";

export interface DashboardStats {
  // 用户统计
  userTotal: number;
  userTodayNew: number;
  userYesterdayNew: number;

  // 收入统计
  revenueTotal: number;
  revenueToday: number;
  revenueYesterday: number;

  // 模型统计
  modelTotal: number;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(RechargeOrder)
    private rechargeRepo: Repository<RechargeOrder>,
    @InjectRepository(AiModel)
    private modelRepo: Repository<AiModel>,
  ) {}

  /**
   * 获取仪表盘统计数据
   */
  async getStats(): Promise<DashboardStats> {
    // 获取今日和昨日的日期范围
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // 并发执行所有统计查询
    const [
      userTotal,
      userTodayNew,
      userYesterdayNew,
      revenueTotal,
      revenueToday,
      revenueYesterday,
      modelTotal,
    ] = await Promise.all([
      // 用户总数
      this.getUserTotal(),
      // 今日新增用户
      this.getUserCountByDateRange(today, tomorrow),
      // 昨日新增用户
      this.getUserCountByDateRange(yesterday, today),
      // 累计收入
      this.getRevenueTotal(),
      // 今日收入
      this.getRevenueByDateRange(today, tomorrow),
      // 昨日收入
      this.getRevenueByDateRange(yesterday, today),
      // 模型总数
      this.getModelTotal(),
    ]);

    return {
      userTotal,
      userTodayNew,
      userYesterdayNew,
      revenueTotal,
      revenueToday,
      revenueYesterday,
      modelTotal,
    };
  }

  /**
   * 获取用户总数
   */
  private async getUserTotal(): Promise<number> {
    return this.userRepo.count();
  }

  /**
   * 获取指定日期范围内的用户数量
   */
  private async getUserCountByDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    return this.userRepo.count({
      where: {
        createdAt: Between(startDate, endDate),
      },
    });
  }

  /**
   * 获取累计收入金额
   */
  private async getRevenueTotal(): Promise<number> {
    const result = await this.rechargeRepo.sum("amount", {
      paymentStatus: PaymentStatus.PAID,
    });
    return result || 0;
  }

  /**
   * 获取指定日期范围内的收入金额
   */
  private async getRevenueByDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const result = await this.rechargeRepo.sum("amount", {
      paymentStatus: PaymentStatus.PAID,
      paidAt: Between(startDate, endDate),
    });
    return result || 0;
  }

  /**
   * 获取模型总数
   */
  private async getModelTotal(): Promise<number> {
    return this.modelRepo.count();
  }
}
