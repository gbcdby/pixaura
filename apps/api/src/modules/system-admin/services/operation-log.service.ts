import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between } from "typeorm";
import { AdminOperationLog } from "../entities/admin-operation-log.entity";

interface LogListQuery {
  adminId?: string;
  operationType?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

interface CreateLogDto {
  adminId: string;
  operationType: string;
  targetType?: string;
  targetId?: string;
  details: Record<string, unknown>;
  ipAddress: string;
  userAgent?: string;
}

@Injectable()
export class OperationLogService {
  constructor(
    @InjectRepository(AdminOperationLog)
    private readonly logRepo: Repository<AdminOperationLog>,
  ) {}

  /**
   * 创建操作日志
   */
  async createLog(dto: CreateLogDto): Promise<AdminOperationLog> {
    const log = this.logRepo.create({
      adminId: dto.adminId,
      operationType: dto.operationType,
      targetType: dto.targetType || null,
      targetId: dto.targetId || null,
      details: dto.details,
      ipAddress: dto.ipAddress,
      userAgent: dto.userAgent || null,
    });

    return this.logRepo.save(log);
  }

  /**
   * 获取操作日志列表
   */
  async getLogList(query: LogListQuery) {
    const {
      adminId,
      operationType,
      startDate,
      endDate,
      page = 1,
      pageSize = 20,
    } = query;

    const where: any = {};

    if (adminId) {
      where.adminId = adminId;
    }

    if (operationType) {
      where.operationType = operationType;
    }

    if (startDate && endDate) {
      where.createdAt = Between(startDate, endDate);
    }

    const [logs, total] = await this.logRepo.findAndCount({
      where,
      order: { createdAt: "DESC" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      relations: ["admin"],
    });

    return {
      total,
      page,
      pageSize,
      items: logs.map((log) => ({
        id: log.id,
        adminId: log.adminId,
        adminUsername: log.admin?.username || "未知",
        operationType: log.operationType,
        targetType: log.targetType,
        targetId: log.targetId,
        details: log.details,
        ip: log.ipAddress,
        createdAt: log.createdAt,
      })),
    };
  }

  /**
   * 获取操作类型列表（用于筛选）
   */
  async getOperationTypes(): Promise<string[]> {
    const result = await this.logRepo
      .createQueryBuilder("log")
      .select("DISTINCT log.operation_type", "type")
      .getRawMany();

    return result.map((r) => r.type);
  }

  /**
   * 获取管理员的操作统计
   */
  async getAdminStats(adminId: string, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await this.logRepo
      .createQueryBuilder("log")
      .select("log.operation_type", "type")
      .addSelect("COUNT(*)", "count")
      .where("log.admin_id = :adminId", { adminId })
      .andWhere("log.created_at >= :startDate", { startDate })
      .groupBy("log.operation_type")
      .getRawMany();

    return stats;
  }
}
