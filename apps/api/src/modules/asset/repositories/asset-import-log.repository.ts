/**
 * 资产导入日志 Repository
 * 管理资产导入记录的数据访问
 */
import { Injectable } from "@nestjs/common";
import { DataSource, Repository, In } from "typeorm";
import { AssetImportLogEntity } from "../entities";

@Injectable()
export class AssetImportLogRepository extends Repository<AssetImportLogEntity> {
  constructor(private dataSource: DataSource) {
    super(AssetImportLogEntity, dataSource.createEntityManager());
  }

  /**
   * 根据ID查找导入记录
   */
  async findById(id: string): Promise<AssetImportLogEntity | null> {
    return this.findOne({
      where: { id },
    });
  }

  /**
   * 获取目标项目的导入历史
   */
  async findByTargetProject(
    projectId: string,
    options: {
      sourceAssetType?: "character" | "scene" | "prop";
      importMethod?: "single" | "batch";
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<[AssetImportLogEntity[], number]> {
    const { sourceAssetType, importMethod, limit = 20, offset = 0 } = options;

    const where: Record<string, unknown> = { targetProjectId: projectId };

    if (sourceAssetType) {
      where.sourceAssetType = sourceAssetType;
    }

    if (importMethod) {
      where.importMethod = importMethod;
    }

    return this.findAndCount({
      where,
      order: { importedAt: "DESC" },
      take: limit,
      skip: offset,
    });
  }

  /**
   * 获取源项目的导出记录
   */
  async findBySourceProject(
    projectId: string,
    options: {
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<[AssetImportLogEntity[], number]> {
    const { limit = 20, offset = 0 } = options;

    return this.findAndCount({
      where: { sourceProjectId: projectId },
      order: { importedAt: "DESC" },
      take: limit,
      skip: offset,
    });
  }

  /**
   * 根据批次ID获取批量导入详情
   * 注：批量导入时，同一批次的记录具有相同的 importMethod='batch' 和相近的 importedAt
   * 这里使用 importedBy + importedAt 的组合来查询批量导入记录
   */
  async findByBatchId(batchId: string): Promise<AssetImportLogEntity[]> {
    // batchId 格式: {importedBy}_{timestamp}
    const [importedBy, timestamp] = batchId.split("_");
    if (!importedBy || !timestamp) {
      return [];
    }

    const batchTime = new Date(parseInt(timestamp, 10));

    return this.find({
      where: {
        importedBy,
        importMethod: "batch",
        importedAt: In([batchTime]),
      },
      order: { importedAt: "DESC" },
    });
  }

  /**
   * 创建导入记录
   */
  async createImportLog(
    data: Omit<AssetImportLogEntity, "id" | "createdAt">,
  ): Promise<AssetImportLogEntity> {
    const log = this.create({
      ...data,
      importedAt: data.importedAt ?? new Date(),
    });

    return this.save(log);
  }

  /**
   * 批量创建导入记录
   */
  async batchCreateImportLogs(
    data: Omit<AssetImportLogEntity, "id" | "createdAt">[],
  ): Promise<AssetImportLogEntity[]> {
    const logs = data.map((item) =>
      this.create({
        ...item,
        importedAt: item.importedAt ?? new Date(),
      }),
    );

    return this.save(logs);
  }

  /**
   * 获取用户的导入历史
   */
  async findByImportedBy(
    importedBy: string,
    options: {
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<[AssetImportLogEntity[], number]> {
    const { limit = 20, offset = 0 } = options;

    return this.findAndCount({
      where: { importedBy },
      order: { importedAt: "DESC" },
      take: limit,
      skip: offset,
    });
  }

  /**
   * 获取指定资产的导入记录
   */
  async findBySourceAsset(
    sourceAssetType: "character" | "scene" | "prop",
    sourceAssetId: string,
  ): Promise<AssetImportLogEntity[]> {
    return this.find({
      where: { sourceAssetType, sourceAssetId },
      order: { importedAt: "DESC" },
    });
  }
}
