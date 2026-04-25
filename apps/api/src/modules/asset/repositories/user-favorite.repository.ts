/**
 * 用户收藏 Repository
 * 管理用户收藏资产的数据访问
 */
import { Injectable } from "@nestjs/common";
import { DataSource, Repository } from "typeorm";
import { UserFavoriteEntity } from "../entities";

@Injectable()
export class UserFavoriteRepository extends Repository<UserFavoriteEntity> {
  constructor(private dataSource: DataSource) {
    super(UserFavoriteEntity, dataSource.createEntityManager());
  }

  /**
   * 根据ID查找收藏记录
   */
  async findById(id: string): Promise<UserFavoriteEntity | null> {
    return this.findOne({
      where: { id },
    });
  }

  /**
   * 获取用户的收藏列表
   */
  async findByUserId(
    userId: string,
    options: {
      assetType?: "character" | "scene" | "prop";
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<[UserFavoriteEntity[], number]> {
    const { assetType, limit = 20, offset = 0 } = options;

    const where: Record<string, unknown> = { userId };

    if (assetType) {
      where.assetType = assetType;
    }

    return this.findAndCount({
      where,
      order: { favoritedAt: "DESC" },
      take: limit,
      skip: offset,
    });
  }

  /**
   * 检查用户是否已收藏指定资产
   */
  async findByUserAndAsset(
    userId: string,
    assetType: "character" | "scene" | "prop",
    assetId: string,
  ): Promise<UserFavoriteEntity | null> {
    return this.findOne({
      where: { userId, assetType, assetId },
    });
  }

  /**
   * 统计用户收藏数量
   */
  async countByUserId(
    userId: string,
    assetType?: "character" | "scene" | "prop",
  ): Promise<number> {
    const where: Record<string, unknown> = { userId };

    if (assetType) {
      where.assetType = assetType;
    }

    return this.count({ where });
  }

  /**
   * 创建收藏记录
   */
  async createFavorite(
    data: Omit<UserFavoriteEntity, "id" | "createdAt" | "updatedAt">,
  ): Promise<UserFavoriteEntity> {
    const favorite = this.create({
      ...data,
      favoritedAt: data.favoritedAt ?? new Date(),
    });

    return this.save(favorite);
  }

  /**
   * 删除收藏记录
   */
  async removeFavorite(id: string): Promise<void> {
    await this.delete(id);
  }

  /**
   * 根据用户ID和资产ID删除收藏
   */
  async removeByUserAndAsset(
    userId: string,
    assetType: "character" | "scene" | "prop",
    assetId: string,
  ): Promise<void> {
    await this.delete({ userId, assetType, assetId });
  }
}
