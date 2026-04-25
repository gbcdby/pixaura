/**
 * 资产统计 Repository
 * 管理资产使用统计数据的数据访问
 */
import { Injectable } from "@nestjs/common";
import { DataSource, Repository, In } from "typeorm";
import { AssetStatsEntity } from "../entities";

@Injectable()
export class AssetStatsRepository extends Repository<AssetStatsEntity> {
  constructor(private dataSource: DataSource) {
    super(AssetStatsEntity, dataSource.createEntityManager());
  }

  /**
   * 根据ID查找统计记录
   */
  async findById(id: string): Promise<AssetStatsEntity | null> {
    return this.findOne({
      where: { id },
    });
  }

  /**
   * 获取指定资产的统计信息
   */
  async findByAsset(
    assetType: "character" | "scene" | "prop",
    assetId: string,
  ): Promise<AssetStatsEntity | null> {
    return this.findOne({
      where: { assetType, assetId },
    });
  }

  /**
   * 增加使用次数
   */
  async incrementUsage(
    assetType: "character" | "scene" | "prop",
    assetId: string,
    projectId: string,
  ): Promise<void> {
    const existing = await this.findByAsset(assetType, assetId);

    if (existing) {
      await this.update(existing.id, {
        usageCount: () => "usage_count + 1",
        lastUsedAt: new Date(),
      });
    } else {
      await this.save({
        assetType,
        assetId,
        projectId,
        usageCount: 1,
        importCount: 0,
        viewCount: 0,
        firstUsedAt: new Date(),
        lastUsedAt: new Date(),
        heatScore: 0,
      });
    }
  }

  /**
   * 增加导入次数
   */
  async incrementImport(
    assetType: "character" | "scene" | "prop",
    assetId: string,
    projectId: string,
  ): Promise<void> {
    const existing = await this.findByAsset(assetType, assetId);

    if (existing) {
      await this.update(existing.id, {
        importCount: () => "import_count + 1",
        lastImportedAt: new Date(),
      });
    } else {
      await this.save({
        assetType,
        assetId,
        projectId,
        usageCount: 0,
        importCount: 1,
        viewCount: 0,
        lastImportedAt: new Date(),
        heatScore: 0,
      });
    }
  }

  /**
   * 增加查看次数
   */
  async incrementView(
    assetType: "character" | "scene" | "prop",
    assetId: string,
    projectId: string,
  ): Promise<void> {
    const existing = await this.findByAsset(assetType, assetId);

    if (existing) {
      await this.update(existing.id, {
        viewCount: () => "view_count + 1",
      });
    } else {
      await this.save({
        assetType,
        assetId,
        projectId,
        usageCount: 0,
        importCount: 0,
        viewCount: 1,
        heatScore: 0,
      });
    }
  }

  /**
   * 获取热门资产列表
   */
  async getPopularAssets(
    limit: number = 20,
    assetType?: "character" | "scene" | "prop",
  ): Promise<AssetStatsEntity[]> {
    const where: Record<string, unknown> = {};

    if (assetType) {
      where.assetType = assetType;
    }

    return this.find({
      where,
      order: { heatScore: "DESC", usageCount: "DESC" },
      take: limit,
    });
  }

  /**
   * 更新热度分数
   * 注：实际计算逻辑可由定时任务或触发器实现
   */
  async updateHeatScore(): Promise<void> {
    // 热度分数计算公式的占位实现
    // 可由以下因素综合计算：
    // - 使用次数（usageCount）
    // - 导入次数（importCount）
    // - 查看次数（viewCount）
    // - 最近使用时间（lastUsedAt）
    // - 首次使用时间（firstUsedAt）

    // 示例：简单的热度分数更新
    await this.query(`
      UPDATE asset_stats
      SET heat_score = (
        usage_count * 3 +
        import_count * 2 +
        view_count * 0.5
      ) / (
        EXTRACT(EPOCH FROM (NOW() - COALESCE(last_used_at, created_at))) / 86400 + 1
      )
    `);
  }

  /**
   * 批量获取资产统计
   */
  async findByAssetIds(
    assetType: "character" | "scene" | "prop",
    assetIds: string[],
  ): Promise<AssetStatsEntity[]> {
    return this.find({
      where: { assetType, assetId: In(assetIds) },
    });
  }

  /**
   * 获取项目的资产统计
   */
  async findByProjectId(projectId: string): Promise<AssetStatsEntity[]> {
    return this.find({
      where: { projectId },
      order: { heatScore: "DESC" },
    });
  }
}
