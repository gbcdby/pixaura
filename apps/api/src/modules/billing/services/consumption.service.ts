/**
 * 消费流水服务
 * 提供消费记录查询和统计功能
 */
import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { QuotaUsage, QuotaReason } from "../entities/quota-usage.entity";
import {
  BalanceRecord,
  BalanceRecordType,
} from "../entities/balance-record.entity";

export interface ConsumptionQueryOptions {
  userId: string;
  startDate?: Date;
  endDate?: Date;
  type?: "subscription" | "balance" | "all";
  category?: string;
  page: number;
  pageSize: number;
}

export interface ConsumptionRecord {
  id: string;
  consumptionType: "subscription" | "balance";
  source: string;
  sourceId: string | null;
  sourceName: string | null;
  quantity: number | null;
  costCny: number;
  referenceId: string | null;
  createdAt: Date;
}

export interface ConsumptionSummary {
  period: { startDate: Date | null; endDate: Date | null };
  totalConsumption: number;
  subscriptionUsage: number;
  balanceUsage: number;
  byCategory: {
    category: string;
    count: number;
    costCny: number;
  }[];
}

/**
 * 类别名称映射
 */
const CATEGORY_NAMES: Record<string, string> = {
  TEXT_GENERATION: "文本生成",
  IMAGE_GENERATION: "图片生成",
  VIDEO_GENERATION: "视频生成",
  AUDIO_GENERATION: "音频生成",
  VOICE_GENERATION: "语音生成",
  LIP_SYNC: "对口型",
};

@Injectable()
export class ConsumptionService {
  private readonly logger = new Logger(ConsumptionService.name);

  constructor(
    @InjectRepository(QuotaUsage)
    private readonly quotaUsageRepo: Repository<QuotaUsage>,
    @InjectRepository(BalanceRecord)
    private readonly balanceRecordRepo: Repository<BalanceRecord>,
  ) {}

  /**
   * 获取用户消费流水
   */
  async getConsumptionHistory(
    options: ConsumptionQueryOptions,
  ): Promise<{ records: ConsumptionRecord[]; total: number }> {
    const { userId, startDate, endDate, type, category, page, pageSize } =
      options;

    const records: ConsumptionRecord[] = [];
    let total = 0;

    // 查询订阅消费记录
    if (type === "all" || type === "subscription") {
      const qb = this.quotaUsageRepo
        .createQueryBuilder("q")
        .where("q.userId = :userId", { userId })
        .andWhere("q.amount < 0")
        .andWhere("q.reason = :reason", { reason: QuotaReason.GENERATION });

      if (startDate) {
        qb.andWhere("q.createdAt >= :startDate", { startDate });
      }
      if (endDate) {
        qb.andWhere("q.createdAt <= :endDate", { endDate });
      }
      if (category) {
        qb.andWhere("q.targetId = :category", { category });
      }

      // 只取小周期记录（避免重复计数）
      qb.andWhere("q.quotaType = :quotaType", { quotaType: "small" });

      // 获取总数
      const subTotal = await qb.getCount();

      // 获取分页数据
      const subRecords = await qb
        .orderBy("q.createdAt", "DESC")
        .skip((page - 1) * pageSize)
        .take(pageSize)
        .getMany();

      records.push(
        ...subRecords.map((r) => ({
          id: r.id,
          consumptionType: "subscription" as const,
          source: r.targetType,
          sourceId: r.targetId,
          sourceName:
            r.targetType === "category"
              ? CATEGORY_NAMES[r.targetId] || r.targetId
              : r.targetId,
          quantity: Math.abs(r.amount),
          costCny: 0,
          referenceId: r.referenceId,
          createdAt: r.createdAt,
        })),
      );

      total += subTotal;
    }

    // 查询余额消费记录
    if (type === "all" || type === "balance") {
      const qb = this.balanceRecordRepo
        .createQueryBuilder("b")
        .where("b.userId = :userId", { userId })
        .andWhere("b.type = :type", { type: BalanceRecordType.CONSUMPTION });

      if (startDate) {
        qb.andWhere("b.createdAt >= :startDate", { startDate });
      }
      if (endDate) {
        qb.andWhere("b.createdAt <= :endDate", { endDate });
      }

      // 获取总数
      const balTotal = await qb.getCount();

      // 获取分页数据
      const balRecords = await qb
        .orderBy("b.createdAt", "DESC")
        .skip((page - 1) * pageSize)
        .take(pageSize)
        .getMany();

      records.push(
        ...balRecords.map((r) => ({
          id: r.id,
          consumptionType: "balance" as const,
          source: "balance",
          sourceId: null,
          sourceName: "余额",
          quantity: null,
          costCny: Math.abs(r.changeAmount),
          referenceId: r.referenceId,
          createdAt: r.createdAt,
        })),
      );

      total += balTotal;
    }

    // 按时间排序
    records.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return {
      records: records.slice(0, pageSize),
      total,
    };
  }

  /**
   * 获取消费汇总
   */
  async getConsumptionSummary(
    userId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<ConsumptionSummary> {
    // 订阅额度使用统计
    const subQb = this.quotaUsageRepo
      .createQueryBuilder("q")
      .select("SUM(ABS(q.amount))", "totalAmount")
      .addSelect("COUNT(*)", "totalCount")
      .where("q.userId = :userId", { userId })
      .andWhere("q.amount < 0")
      .andWhere("q.reason = :reason", { reason: QuotaReason.GENERATION })
      .andWhere("q.quotaType = :quotaType", { quotaType: "small" });

    if (startDate) {
      subQb.andWhere("q.createdAt >= :startDate", { startDate });
    }
    if (endDate) {
      subQb.andWhere("q.createdAt <= :endDate", { endDate });
    }

    const subStats = await subQb.getRawOne();

    // 余额消费统计
    const balQb = this.balanceRecordRepo
      .createQueryBuilder("b")
      .select("SUM(ABS(b.changeAmount))", "totalAmount")
      .addSelect("COUNT(*)", "totalCount")
      .where("b.userId = :userId", { userId })
      .andWhere("b.type = :type", { type: BalanceRecordType.CONSUMPTION });

    if (startDate) {
      balQb.andWhere("b.createdAt >= :startDate", { startDate });
    }
    if (endDate) {
      balQb.andWhere("b.createdAt <= :endDate", { endDate });
    }

    const balStats = await balQb.getRawOne();

    // 按类别统计
    const catQb = this.quotaUsageRepo
      .createQueryBuilder("q")
      .select("q.targetId", "category")
      .addSelect("SUM(ABS(q.amount))", "count")
      .where("q.userId = :userId", { userId })
      .andWhere("q.amount < 0")
      .andWhere("q.reason = :reason", { reason: QuotaReason.GENERATION })
      .andWhere("q.targetType = :targetType", { targetType: "category" })
      .andWhere("q.quotaType = :quotaType", { quotaType: "small" })
      .groupBy("q.targetId");

    if (startDate) {
      catQb.andWhere("q.createdAt >= :startDate", { startDate });
    }
    if (endDate) {
      catQb.andWhere("q.createdAt <= :endDate", { endDate });
    }

    const categoryStats = await catQb.getRawMany();

    // 按类别的余额消费（从 description 中解析）
    const balCatQb = this.balanceRecordRepo
      .createQueryBuilder("b")
      .select("b.description", "description")
      .addSelect("SUM(ABS(b.changeAmount))", "cost")
      .where("b.userId = :userId", { userId })
      .andWhere("b.type = :type", { type: BalanceRecordType.CONSUMPTION })
      .groupBy("b.description");

    if (startDate) {
      balCatQb.andWhere("b.createdAt >= :startDate", { startDate });
    }
    if (endDate) {
      balCatQb.andWhere("b.createdAt <= :endDate", { endDate });
    }

    const balCatStats = await balCatQb.getRawMany();

    // 合并类别统计
    const byCategory: Map<string, { count: number; costCny: number }> = new Map();

    for (const stat of categoryStats) {
      const cat = stat.category;
      byCategory.set(cat, {
        count: parseInt(stat.count) || 0,
        costCny: 0,
      });
    }

    for (const stat of balCatStats) {
      const desc = stat.description || "";
      // 从 description 中提取类别（格式：模型调用 - xxx 或 类别调用 - xxx）
      const match = desc.match(/模型调用|类别调用/);
      if (match) {
        const cat = desc.replace(/模型调用 - |类别调用 - /, "").trim();
        const existing = byCategory.get(cat) || { count: 0, costCny: 0 };
        existing.costCny += parseFloat(stat.cost) || 0;
        byCategory.set(cat, existing);
      }
    }

    return {
      period: { startDate: startDate || null, endDate: endDate || null },
      totalConsumption: parseFloat(balStats?.totalAmount || "0"),
      subscriptionUsage: parseInt(subStats?.totalAmount || "0"),
      balanceUsage: parseFloat(balStats?.totalAmount || "0"),
      byCategory: Array.from(byCategory.entries()).map(([category, data]) => ({
        category,
        count: data.count,
        costCny: data.costCny,
      })),
    };
  }
}