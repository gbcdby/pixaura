import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource, In, IsNull } from "typeorm";
import { AssetImportLogEntity } from "../entities/asset-import-log.entity";
import { CharacterService } from "../../character/services/character.service";
import { SceneService } from "../../scene/services/scene.service";
import { PropService } from "../../prop/services/prop.service";
import { ProjectService } from "../../project/services/project.service";
import type {
  ImportAssetDto,
  BatchImportAssetsDto,
  CheckImportConflictDto,
  ImportAssetResponseDto,
  BatchImportAssetsResponseDto,
  CheckImportConflictResultDto,
  ImportHistoryDto,
  BatchImportDetailDto,
  ImportConflictDto,
  ImportResultDto,
  LibraryAssetType,
  ConflictHandling,
} from "@pixaura/shared-types";

/**
 * 批量导入批次信息（内存存储，实际生产环境应使用 Redis 或数据库）
 */
interface BatchImportInfo {
  batchId: string;
  projectId: string;
  status: "completed" | "partial_failed" | "failed";
  total: number;
  success: number;
  failed: number;
  skipped: number;
  createdAt: Date;
  completedAt: Date;
  results: ImportResultDto[];
}

/**
 * 资产导入服务
 * 处理跨项目资产导入、批量导入、冲突检测等功能
 */
@Injectable()
export class AssetImportService {
  // 批量导入批次缓存（实际生产环境应使用 Redis）
  private batchImportCache: Map<string, BatchImportInfo> = new Map();

  constructor(
    @InjectRepository(AssetImportLogEntity)
    private readonly importLogRepository: Repository<AssetImportLogEntity>,
    @Inject(forwardRef(() => CharacterService))
    private readonly characterService: CharacterService,
    @Inject(forwardRef(() => SceneService))
    private readonly sceneService: SceneService,
    @Inject(forwardRef(() => PropService))
    private readonly propService: PropService,
    private readonly projectService: ProjectService,
    private readonly dataSource: DataSource,
  ) {}

  // ==================== 单资产导入 ====================

  /**
   * 单资产导入
   * @param targetProjectId 目标项目ID
   * @param userId 操作用户ID
   * @param dto 导入参数
   * @returns 导入结果
   */
  async importAsset(
    targetProjectId: string,
    userId: string,
    dto: ImportAssetDto,
  ): Promise<ImportAssetResponseDto> {
    const { assetType, assetId, sourceProjectId, conflictHandling, newName } =
      dto;

    // 1. 检查源项目读权限
    await this.checkSourceProjectReadPermission(userId, sourceProjectId);

    // 2. 检查目标项目写权限
    await this.checkTargetProjectWritePermission(userId, targetProjectId);

    // 3. 检查源资产是否存在
    const sourceAsset = await this.findSourceAsset(
      assetType,
      assetId,
      sourceProjectId,
    );
    if (!sourceAsset) {
      throw new NotFoundException({
        code: 1313,
        message: "源资产不存在",
      });
    }

    // 4. 检查名称冲突
    const conflictResult = await this.checkNameConflict(
      assetType,
      sourceAsset.name,
      targetProjectId,
    );

    let targetAssetName = sourceAsset.name;
    let conflictResolved: ImportAssetResponseDto["conflictResolved"] =
      undefined;

    // 5. 处理冲突
    if (conflictResult.hasConflict) {
      switch (conflictHandling) {
        case "skip":
          throw new BadRequestException({
            code: 300,
            message: "资产名称冲突，已选择跳过",
          });
        case "replace":
          // 替换逻辑：先删除现有资产，再导入
          await this.replaceAsset(
            assetType,
            conflictResult.existingAssetId!,
            targetProjectId,
          );
          conflictResolved = {
            originalName: sourceAsset.name,
            resolution: "replace",
          };
          break;
        case "rename":
        default:
          // 重命名逻辑
          targetAssetName =
            newName ||
            this.generateUniqueName(sourceAsset.name, targetProjectId);
          conflictResolved = {
            originalName: sourceAsset.name,
            resolution: "rename",
            newName: targetAssetName,
          };
          break;
      }
    }

    // 6. 使用事务执行导入
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let targetAssetId: string;

    try {
      // 执行导入
      targetAssetId = await this.executeImport(
        assetType,
        assetId,
        sourceProjectId,
        targetProjectId,
        userId,
        targetAssetName,
      );

      // 创建导入记录
      const importLog = this.importLogRepository.create({
        sourceAssetType: assetType,
        sourceAssetId: assetId,
        sourceProjectId,
        targetAssetId,
        targetProjectId,
        importedBy: userId,
        importedAt: new Date(),
        importMethod: "single",
        conflictHandling: conflictHandling || "rename",
        originalName: sourceAsset.name,
      });

      await queryRunner.manager.save(importLog);
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    return {
      success: true,
      targetAssetId,
      targetAssetName,
      conflictResolved,
      importedAt: new Date().toISOString(),
    };
  }

  // ==================== 批量导入 ====================

  /**
   * 批量导入资产
   * @param targetProjectId 目标项目ID
   * @param userId 操作用户ID
   * @param dto 批量导入参数
   * @returns 批量导入结果
   */
  async batchImportAssets(
    targetProjectId: string,
    userId: string,
    dto: BatchImportAssetsDto,
  ): Promise<BatchImportAssetsResponseDto> {
    const { assets, conflictHandling, continueOnError } = dto;

    // 1. 检查批量导入数量限制
    if (assets.length > 20) {
      throw new BadRequestException({
        code: 301,
        message: "批量导入单次最多支持20个资产",
      });
    }

    // 2. 检查目标项目写权限
    await this.checkTargetProjectWritePermission(userId, targetProjectId);

    // 3. 批量检查源项目读权限
    const sourceProjectIds = [...new Set(assets.map((a) => a.sourceProjectId))];
    for (const sourceProjectId of sourceProjectIds) {
      await this.checkSourceProjectReadPermission(userId, sourceProjectId);
    }

    // 4. 生成批次ID
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // 5. 执行批量导入
    const results: ImportResultDto[] = [];
    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const asset of assets) {
      try {
        // 检查源资产是否存在
        const sourceAsset = await this.findSourceAsset(
          asset.assetType,
          asset.assetId,
          asset.sourceProjectId,
        );

        if (!sourceAsset) {
          results.push({
            assetId: asset.assetId,
            assetType: asset.assetType,
            success: false,
            error: {
              code: 1313,
              message: "源资产不存在",
            },
          });
          failedCount++;
          if (!continueOnError) break;
          continue;
        }

        // 检查名称冲突
        const conflictResult = await this.checkNameConflict(
          asset.assetType,
          sourceAsset.name,
          targetProjectId,
        );

        let targetAssetName = sourceAsset.name;

        // 处理冲突
        if (conflictResult.hasConflict) {
          switch (conflictHandling) {
            case "skip":
              results.push({
                assetId: asset.assetId,
                assetType: asset.assetType,
                success: false,
                error: {
                  code: 300,
                  message: "资产名称冲突，已跳过",
                },
              });
              skippedCount++;
              continue;
            case "replace":
              await this.replaceAsset(
                asset.assetType,
                conflictResult.existingAssetId!,
                targetProjectId,
              );
              break;
            case "rename":
            default:
              targetAssetName = this.generateUniqueName(
                sourceAsset.name,
                targetProjectId,
              );
              break;
          }
        }

        // 执行导入
        const targetAssetId = await this.executeImport(
          asset.assetType,
          asset.assetId,
          asset.sourceProjectId,
          targetProjectId,
          userId,
          targetAssetName,
        );

        // 创建导入记录
        const importLog = this.importLogRepository.create({
          sourceAssetType: asset.assetType,
          sourceAssetId: asset.assetId,
          sourceProjectId: asset.sourceProjectId,
          targetAssetId,
          targetProjectId,
          importedBy: userId,
          importedAt: new Date(),
          importMethod: "batch",
          conflictHandling,
          originalName: sourceAsset.name,
        });

        await this.importLogRepository.save(importLog);

        results.push({
          assetId: asset.assetId,
          assetType: asset.assetType,
          success: true,
          targetAssetId,
          targetAssetName,
        });
        successCount++;
      } catch (error) {
        results.push({
          assetId: asset.assetId,
          assetType: asset.assetType,
          success: false,
          error: {
            code: 1311,
            message: error instanceof Error ? error.message : "导入失败",
          },
        });
        failedCount++;
        if (!continueOnError) break;
      }
    }

    // 6. 保存批次信息
    const batchInfo: BatchImportInfo = {
      batchId,
      projectId: targetProjectId,
      status:
        failedCount === 0
          ? "completed"
          : successCount > 0
            ? "partial_failed"
            : "failed",
      total: assets.length,
      success: successCount,
      failed: failedCount,
      skipped: skippedCount,
      createdAt: new Date(),
      completedAt: new Date(),
      results,
    };

    this.batchImportCache.set(batchId, batchInfo);

    return {
      total: assets.length,
      success: successCount,
      failed: failedCount,
      skipped: skippedCount,
      results,
      importId: batchId,
    };
  }

  // ==================== 冲突检测 ====================

  /**
   * 检查导入冲突
   * @param targetProjectId 目标项目ID
   * @param userId 操作用户ID
   * @param dto 冲突检测参数
   * @returns 冲突检测结果
   */
  async checkImportConflicts(
    targetProjectId: string,
    userId: string,
    dto: CheckImportConflictDto,
  ): Promise<CheckImportConflictResultDto> {
    const { assets } = dto;

    // 检查目标项目写权限
    await this.checkTargetProjectWritePermission(userId, targetProjectId);

    const conflicts: ImportConflictDto[] = [];

    for (const asset of assets) {
      // 检查源资产是否存在
      const sourceAsset = await this.findSourceAsset(
        asset.assetType,
        asset.assetId,
        asset.sourceProjectId,
      );

      if (!sourceAsset) {
        continue;
      }

      // 检查名称冲突
      const conflictResult = await this.checkNameConflict(
        asset.assetType,
        sourceAsset.name,
        targetProjectId,
      );

      if (conflictResult.hasConflict && conflictResult.existingAsset) {
        conflicts.push({
          assetId: asset.assetId,
          assetType: asset.assetType,
          sourceName: sourceAsset.name,
          conflictType: "name",
          existingAsset: {
            id: conflictResult.existingAsset.id,
            name: conflictResult.existingAsset.name,
            createdAt: conflictResult.existingAsset.createdAt.toISOString(),
          },
        });
      }
    }

    return {
      total: assets.length,
      conflicts,
      conflictCount: conflicts.length,
    };
  }

  // ==================== 导入历史 ====================

  /**
   * 获取导入历史
   * @param projectId 项目ID
   * @param userId 操作用户ID
   * @param page 页码
   * @param pageSize 每页数量
   * @returns 导入历史列表
   */
  async getImportHistory(
    projectId: string,
    userId: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<ImportHistoryDto> {
    // 检查项目访问权限
    await this.checkProjectAccessPermission(userId, projectId);

    const [logs, total] = await this.importLogRepository.findAndCount({
      where: { targetProjectId: projectId },
      order: { importedAt: "DESC" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // 获取源资产和项目名称（这里简化处理，实际可能需要查询各模块服务）
    const list = await Promise.all(
      logs.map(async (log) => {
        // 获取源资产名称
        const sourceAsset = await this.findSourceAsset(
          log.sourceAssetType,
          log.sourceAssetId,
          log.sourceProjectId,
        );

        return {
          id: log.id,
          sourceAssetType: log.sourceAssetType,
          sourceAssetId: log.sourceAssetId,
          sourceAssetName: sourceAsset?.name || "未知资产",
          sourceProjectId: log.sourceProjectId,
          sourceProjectName: "未知项目", // 实际应从项目服务获取
          targetAssetId: log.targetAssetId,
          targetAssetName: sourceAsset?.name || "未知资产",
          importedBy: log.importedBy,
          importedByName: "未知用户", // 实际应从用户服务获取
          importedAt: log.importedAt.toISOString(),
          conflictHandling: log.conflictHandling as ConflictHandling,
        };
      }),
    );

    return {
      list,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  // ==================== 批量导入详情 ====================

  /**
   * 获取批量导入详情
   * @param batchId 批次ID
   * @param userId 操作用户ID
   * @returns 批量导入详情
   */
  async getBatchImportDetail(
    batchId: string,
    userId: string,
  ): Promise<BatchImportDetailDto> {
    const batchInfo = this.batchImportCache.get(batchId);

    if (!batchInfo) {
      throw new NotFoundException({
        code: 302,
        message: "批量导入批次不存在或已过期",
      });
    }

    // 检查项目访问权限
    await this.checkProjectAccessPermission(userId, batchInfo.projectId);

    // 分离成功和失败项
    const failedItems = [];
    const successItems = [];

    for (const result of batchInfo.results) {
      if (result.success) {
        successItems.push({
          assetId: result.assetId,
          assetType: result.assetType,
          targetAssetId: result.targetAssetId!,
          targetAssetName: result.targetAssetName!,
        });
      } else {
        // 获取源资产信息
        const assetInfo = batchInfo.results.find(
          (r) => r.assetId === result.assetId,
        );
        failedItems.push({
          assetId: result.assetId,
          assetType: result.assetType,
          sourceProjectId: "", // 从原始请求中获取
          sourceProjectName: "",
          sourceAssetName: "",
          error: result.error!,
          retryable: result.error!.code !== 1313, // 源资产不存在不可重试
        });
      }
    }

    return {
      batchId: batchInfo.batchId,
      projectId: batchInfo.projectId,
      status: batchInfo.status,
      summary: {
        total: batchInfo.total,
        success: batchInfo.success,
        failed: batchInfo.failed,
        skipped: batchInfo.skipped,
      },
      createdAt: batchInfo.createdAt.toISOString(),
      completedAt: batchInfo.completedAt.toISOString(),
      failedItems,
      successItems,
    };
  }

  // ==================== 私有工具方法 ====================

  /**
   * 检查源项目读权限
   */
  private async checkSourceProjectReadPermission(
    userId: string,
    sourceProjectId: string,
  ): Promise<void> {
    const role = await this.projectService.getUserRole(sourceProjectId, userId);
    if (!role) {
      throw new ForbiddenException({
        code: 1312,
        message: "无权访问源项目",
      });
    }
  }

  /**
   * 检查目标项目写权限
   */
  private async checkTargetProjectWritePermission(
    userId: string,
    targetProjectId: string,
  ): Promise<void> {
    const role = await this.projectService.getUserRole(targetProjectId, userId);
    if (!role || (role !== "owner" && role !== "editor")) {
      throw new ForbiddenException({
        code: 1202,
        message: "需要编辑权限才能导入资产",
      });
    }
  }

  /**
   * 检查项目访问权限
   */
  private async checkProjectAccessPermission(
    userId: string,
    projectId: string,
  ): Promise<void> {
    const role = await this.projectService.getUserRole(projectId, userId);
    if (!role) {
      throw new ForbiddenException({
        code: 1201,
        message: "没有权限访问此项目",
      });
    }
  }

  /**
   * 查找源资产
   */
  private async findSourceAsset(
    assetType: LibraryAssetType,
    assetId: string,
    projectId: string,
  ): Promise<{ id: string; name: string; createdAt: Date } | null> {
    try {
      switch (assetType) {
        case "character": {
          const character = await this.characterService.findById(assetId);
          if (character.projectId !== projectId) return null;
          return {
            id: character.id,
            name: character.name,
            createdAt: new Date(character.createdAt),
          };
        }
        case "scene": {
          const scene = await this.sceneService.findById(assetId);
          if (scene.projectId !== projectId) return null;
          return {
            id: scene.id,
            name: scene.name,
            createdAt: new Date(scene.createdAt),
          };
        }
        case "prop": {
          const prop = await this.propService.findById(assetId);
          if (prop.projectId !== projectId) return null;
          return {
            id: prop.id,
            name: prop.name,
            createdAt: new Date(prop.createdAt),
          };
        }
        default:
          return null;
      }
    } catch {
      return null;
    }
  }

  /**
   * 检查名称冲突
   */
  private async checkNameConflict(
    assetType: LibraryAssetType,
    name: string,
    projectId: string,
  ): Promise<{
    hasConflict: boolean;
    existingAssetId?: string;
    existingAsset?: { id: string; name: string; createdAt: Date };
  }> {
    try {
      switch (assetType) {
        case "character": {
          // 使用 characterService 的 findAll 方法查询
          const result = await this.characterService.findAll(projectId, {
            search: name,
            page: 1,
            pageSize: 1,
            sortBy: "name",
            sortOrder: "asc",
          });
          const existing = result.list.find((c) => c.name === name);
          if (existing) {
            return {
              hasConflict: true,
              existingAssetId: existing.id,
              existingAsset: {
                id: existing.id,
                name: existing.name,
                createdAt: new Date(existing.createdAt),
              },
            };
          }
          break;
        }
        case "scene": {
          const result = await this.sceneService.findAll(projectId, {
            search: name,
            page: 1,
            pageSize: 1,
            sortBy: "name",
            sortOrder: "asc",
          });
          const existing = result.list.find((s) => s.name === name);
          if (existing) {
            return {
              hasConflict: true,
              existingAssetId: existing.id,
              existingAsset: {
                id: existing.id,
                name: existing.name,
                createdAt: new Date(existing.createdAt),
              },
            };
          }
          break;
        }
        case "prop": {
          const result = await this.propService.findAll(projectId, {
            search: name,
            page: 1,
            pageSize: 1,
            sortBy: "name",
            sortOrder: "asc",
          });
          const existing = result.list.find((p) => p.name === name);
          if (existing) {
            return {
              hasConflict: true,
              existingAssetId: existing.id,
              existingAsset: {
                id: existing.id,
                name: existing.name,
                createdAt: new Date(existing.createdAt),
              },
            };
          }
          break;
        }
      }
    } catch {
      // 查询失败视为无冲突
    }

    return { hasConflict: false };
  }

  /**
   * 生成唯一名称
   */
  private generateUniqueName(baseName: string, projectId: string): string {
    const timestamp = Date.now();
    return `${baseName}_导入_${timestamp}`;
  }

  /**
   * 替换资产
   */
  private async replaceAsset(
    assetType: LibraryAssetType,
    existingAssetId: string,
    projectId: string,
  ): Promise<void> {
    switch (assetType) {
      case "character":
        await this.characterService.remove(existingAssetId);
        break;
      case "scene":
        await this.sceneService.remove(existingAssetId);
        break;
      case "prop":
        await this.propService.remove(existingAssetId);
        break;
    }
  }

  /**
   * 执行导入
   */
  private async executeImport(
    assetType: LibraryAssetType,
    sourceAssetId: string,
    sourceProjectId: string,
    targetProjectId: string,
    userId: string,
    targetAssetName: string,
  ): Promise<string> {
    switch (assetType) {
      case "character": {
        const result = await this.characterService.importFromProject(
          targetProjectId,
          userId,
          {
            sourceProjectId,
            sourceCharacterIds: [sourceAssetId],
          },
        );
        if (result.errors && result.errors.length > 0) {
          throw new Error(result.errors[0].error);
        }
        // 如果名称被修改，需要更新
        if (result.characters[0]?.name !== targetAssetName) {
          // 更新角色名称
          await this.characterService.update(result.characters[0].id, {
            name: targetAssetName,
          });
        }
        return result.characters[0].id;
      }
      case "scene": {
        const result = await this.sceneService.importFromProject(
          targetProjectId,
          userId,
          {
            sourceProjectId,
            sourceSceneIds: [sourceAssetId],
          },
        );
        if (result.errors && result.errors.length > 0) {
          throw new Error(result.errors[0].error);
        }
        if (result.scenes[0]?.name !== targetAssetName) {
          await this.sceneService.update(result.scenes[0].id, {
            name: targetAssetName,
          });
        }
        return result.scenes[0].id;
      }
      case "prop": {
        const result = await this.propService.importFromProject(
          targetProjectId,
          userId,
          {
            sourceProjectId,
            sourcePropIds: [sourceAssetId],
          },
        );
        if (result.errors && result.errors.length > 0) {
          throw new Error(result.errors[0].error);
        }
        if (result.props[0]?.name !== targetAssetName) {
          await this.propService.update(result.props[0].id, {
            name: targetAssetName,
          });
        }
        return result.props[0].id;
      }
      default:
        throw new Error("不支持的资产类型");
    }
  }
}
