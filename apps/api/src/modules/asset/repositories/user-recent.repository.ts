/**
 * 用户最近使用 Repository
 * 管理用户最近使用资产记录的数据访问
 */
import { Injectable } from "@nestjs/common";
import { DataSource, Repository } from "typeorm";
import { UserRecentEntity } from "../entities";

@Injectable()
export class UserRecentRepository extends Repository<UserRecentEntity> {
  constructor(private dataSource: DataSource) {
    super(UserRecentEntity, dataSource.createEntityManager());
  }

  /**
   * 根据ID查找记录
   */
  async findById(id: string): Promise<UserRecentEntity | null> {
    return this.findOne({
      where: { id },
    });
  }

  /**
   * 获取用户的最近使用列表
   */
  async findByUserId(
    userId: string,
    options: {
      action?: "view" | "import" | "use_in_shot";
      assetType?: "character" | "scene" | "prop";
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<[UserRecentEntity[], number]> {
    const { action, assetType, limit = 50, offset = 0 } = options;

    const where: Record<string, unknown> = { userId };

    if (action) {
      where.action = action;
    }

    if (assetType) {
      where.assetType = assetType;
    }

    return this.findAndCount({
      where,
      order: { usedAt: "DESC" },
      take: limit,
      skip: offset,
    });
  }

  /**
   * 创建使用记录
   * 注：数据库触发器会自动限制每个用户最多保留50条记录
   */
  async createRecentRecord(
    data: Omit<UserRecentEntity, "id" | "createdAt">,
  ): Promise<UserRecentEntity> {
    const recent = this.create({
      ...data,
      usedAt: data.usedAt ?? new Date(),
    });

    return this.save(recent);
  }

  /**
   * 清除用户的所有记录
   */
  async clearByUserId(userId: string): Promise<void> {
    await this.delete({ userId });
  }

  /**
   * 清除指定条件的记录
   */
  async clearByConditions(
    userId: string,
    conditions: {
      assetType?: "character" | "scene" | "prop";
      action?: "view" | "import" | "use_in_shot";
    },
  ): Promise<void> {
    const where: Record<string, unknown> = { userId };

    if (conditions.assetType) {
      where.assetType = conditions.assetType;
    }

    if (conditions.action) {
      where.action = conditions.action;
    }

    await this.delete(where);
  }

  /**
   * 获取用户在指定资产上的最近操作
   */
  async findByUserAndAsset(
    userId: string,
    assetType: "character" | "scene" | "prop",
    assetId: string,
  ): Promise<UserRecentEntity[]> {
    return this.find({
      where: { userId, assetType, assetId },
      order: { usedAt: "DESC" },
    });
  }
}
