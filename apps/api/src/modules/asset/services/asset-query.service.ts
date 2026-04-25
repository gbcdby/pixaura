import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Like, IsNull, In, Brackets } from "typeorm";
import { Character } from "../../character/entities/character.entity";
import { CharacterImage } from "../../character/entities/character-image.entity";
import { Scene } from "../../scene/entities/scene.entity";
import { SceneImage } from "../../scene/entities/scene-image.entity";
import { Prop } from "../../prop/entities/prop.entity";
import { PropImage } from "../../prop/entities/prop-image.entity";
import { Project } from "../../project/entities/project.entity";
import { AssetStatsEntity } from "../entities/asset-stats.entity";
import { UserFavoriteEntity } from "../entities/user-favorite.entity";
import type {
  LibraryAssetType,
  LibraryAssetStatus,
  QueryAssetsDto,
  SearchAssetsDto,
  GetPopularAssetsDto,
  AssetListDto,
  AssetSummaryDto,
  AssetDetailBaseDto,
  AssetStatsDto,
  PopularAssetsDto,
  PopularAssetItemDto,
  AssetFilterOptionsDto,
  AssetStatsInfo,
  UsageDistribution,
} from "@pixaura/shared-types";

/**
 * 资产查询服务
 * 提供资产列表查询、搜索、详情获取、统计等功能
 */
@Injectable()
export class AssetQueryService {
  constructor(
    @InjectRepository(Character)
    private readonly characterRepository: Repository<Character>,
    @InjectRepository(Scene)
    private readonly sceneRepository: Repository<Scene>,
    @InjectRepository(Prop)
    private readonly propRepository: Repository<Prop>,
    @InjectRepository(CharacterImage)
    private readonly characterImageRepository: Repository<CharacterImage>,
    @InjectRepository(SceneImage)
    private readonly sceneImageRepository: Repository<SceneImage>,
    @InjectRepository(PropImage)
    private readonly propImageRepository: Repository<PropImage>,
    @InjectRepository(AssetStatsEntity)
    private readonly assetStatsRepository: Repository<AssetStatsEntity>,
    @InjectRepository(UserFavoriteEntity)
    private readonly userFavoriteRepository: Repository<UserFavoriteEntity>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  // ==================== 资产列表查询 ====================

  /**
   * 获取资产列表
   * 支持分页、类型筛选、项目筛选、状态筛选、关键词搜索、排序
   */
  async getAssets(
    userId: string,
    query: QueryAssetsDto,
  ): Promise<AssetListDto> {
    const {
      type,
      projectId,
      status,
      keyword,
      sortBy = "updatedAt",
      sortOrder = "desc",
      page = 1,
      pageSize = 20,
    } = query;

    // 根据类型选择查询策略
    if (type) {
      return this.getAssetsByType(userId, type, {
        projectId,
        status,
        keyword,
        sortBy,
        sortOrder,
        page,
        pageSize,
      });
    }

    // 查询所有类型（需要合并结果）
    return this.getAllAssets(userId, {
      projectId,
      status,
      keyword,
      sortBy,
      sortOrder,
      page,
      pageSize,
    });
  }

  /**
   * 按类型查询资产
   */
  private async getAssetsByType(
    userId: string,
    type: LibraryAssetType,
    params: {
      projectId?: string;
      status?: LibraryAssetStatus;
      keyword?: string;
      sortBy: string;
      sortOrder: "asc" | "desc";
      page: number;
      pageSize: number;
    },
  ): Promise<AssetListDto> {
    const { projectId, status, keyword, sortBy, sortOrder, page, pageSize } =
      params;

    let list: AssetSummaryDto[] = [];
    let total = 0;

    switch (type) {
      case "character":
        ({ list, total } = await this.queryCharacters(userId, {
          projectId,
          status,
          keyword,
          sortBy,
          sortOrder,
          page,
          pageSize,
        }));
        break;
      case "scene":
        ({ list, total } = await this.queryScenes(userId, {
          projectId,
          status,
          keyword,
          sortBy,
          sortOrder,
          page,
          pageSize,
        }));
        break;
      case "prop":
        ({ list, total } = await this.queryProps(userId, {
          projectId,
          status,
          keyword,
          sortBy,
          sortOrder,
          page,
          pageSize,
        }));
        break;
    }

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

  /**
   * 查询所有类型的资产（合并结果）
   */
  private async getAllAssets(
    userId: string,
    params: {
      projectId?: string;
      status?: LibraryAssetStatus;
      keyword?: string;
      sortBy: string;
      sortOrder: "asc" | "desc";
      page: number;
      pageSize: number;
    },
  ): Promise<AssetListDto> {
    const { projectId, status, keyword, sortBy, sortOrder, page, pageSize } =
      params;

    // 并行查询三种类型的资产
    const [characters, scenes, props] = await Promise.all([
      this.queryCharacters(userId, {
        projectId,
        status,
        keyword,
        sortBy,
        sortOrder,
        page: 1,
        pageSize: 1000,
      }),
      this.queryScenes(userId, {
        projectId,
        status,
        keyword,
        sortBy,
        sortOrder,
        page: 1,
        pageSize: 1000,
      }),
      this.queryProps(userId, {
        projectId,
        status,
        keyword,
        sortBy,
        sortOrder,
        page: 1,
        pageSize: 1000,
      }),
    ]);

    // 合并所有资产
    const allAssets = [...characters.list, ...scenes.list, ...props.list];

    // 排序
    this.sortAssets(allAssets, sortBy, sortOrder);

    // 分页
    const total = allAssets.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedList = allAssets.slice(start, end);

    return {
      list: paginatedList,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 查询角色资产
   */
  private async queryCharacters(
    userId: string,
    params: {
      projectId?: string;
      status?: LibraryAssetStatus;
      keyword?: string;
      sortBy: string;
      sortOrder: "asc" | "desc";
      page: number;
      pageSize: number;
    },
  ): Promise<{ list: AssetSummaryDto[]; total: number }> {
    const { projectId, status, keyword, sortBy, sortOrder, page, pageSize } =
      params;

    const queryBuilder = this.characterRepository
      .createQueryBuilder("character")
      .leftJoinAndSelect("character.images", "images")
      .where("character.deletedAt IS NULL");

    if (projectId) {
      queryBuilder.andWhere("character.projectId = :projectId", { projectId });
    }

    if (status) {
      queryBuilder.andWhere("character.status = :status", { status });
    }

    if (keyword) {
      queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where("character.name LIKE :keyword", {
            keyword: `%${keyword}%`,
          }).orWhere("character.description LIKE :keyword", {
            keyword: `%${keyword}%`,
          });
        }),
      );
    }

    // 排序
    const orderField = this.getOrderField("character", sortBy);
    queryBuilder.orderBy(orderField, sortOrder.toUpperCase() as "ASC" | "DESC");

    // 分页
    queryBuilder.skip((page - 1) * pageSize).take(pageSize);

    const [characters, total] = await queryBuilder.getManyAndCount();

    // 获取统计信息和收藏状态
    const list = await this.enrichAssetSummaries(
      userId,
      characters.map((c) => ({
        id: c.id,
        type: "character" as LibraryAssetType,
        name: c.name,
        description: c.description ?? "",
        thumbnailUrl: this.getCharacterThumbnail(c),
        status: c.status as LibraryAssetStatus,
        projectId: c.projectId,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
    );

    return { list, total };
  }

  /**
   * 查询场景资产
   */
  private async queryScenes(
    userId: string,
    params: {
      projectId?: string;
      status?: LibraryAssetStatus;
      keyword?: string;
      sortBy: string;
      sortOrder: "asc" | "desc";
      page: number;
      pageSize: number;
    },
  ): Promise<{ list: AssetSummaryDto[]; total: number }> {
    const { projectId, status, keyword, sortBy, sortOrder, page, pageSize } =
      params;

    const queryBuilder = this.sceneRepository
      .createQueryBuilder("scene")
      .leftJoinAndSelect("scene.images", "images")
      .where("scene.deletedAt IS NULL");

    if (projectId) {
      queryBuilder.andWhere("scene.projectId = :projectId", { projectId });
    }

    if (status) {
      queryBuilder.andWhere("scene.status = :status", { status });
    }

    if (keyword) {
      queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where("scene.name LIKE :keyword", {
            keyword: `%${keyword}%`,
          }).orWhere("scene.description LIKE :keyword", {
            keyword: `%${keyword}%`,
          });
        }),
      );
    }

    // 排序
    const orderField = this.getOrderField("scene", sortBy);
    queryBuilder.orderBy(orderField, sortOrder.toUpperCase() as "ASC" | "DESC");

    // 分页
    queryBuilder.skip((page - 1) * pageSize).take(pageSize);

    const [scenes, total] = await queryBuilder.getManyAndCount();

    // 获取统计信息和收藏状态
    const list = await this.enrichAssetSummaries(
      userId,
      scenes.map((s) => ({
        id: s.id,
        type: "scene" as LibraryAssetType,
        name: s.name,
        description: s.description ?? "",
        thumbnailUrl: this.getSceneThumbnail(s),
        status: s.status as LibraryAssetStatus,
        projectId: s.projectId,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      })),
    );

    return { list, total };
  }

  /**
   * 查询道具资产
   */
  private async queryProps(
    userId: string,
    params: {
      projectId?: string;
      status?: LibraryAssetStatus;
      keyword?: string;
      sortBy: string;
      sortOrder: "asc" | "desc";
      page: number;
      pageSize: number;
    },
  ): Promise<{ list: AssetSummaryDto[]; total: number }> {
    const { projectId, status, keyword, sortBy, sortOrder, page, pageSize } =
      params;

    const queryBuilder = this.propRepository
      .createQueryBuilder("prop")
      .leftJoinAndSelect("prop.images", "images")
      .where("prop.deletedAt IS NULL");

    if (projectId) {
      queryBuilder.andWhere("prop.projectId = :projectId", { projectId });
    }

    if (status) {
      queryBuilder.andWhere("prop.status = :status", { status });
    }

    if (keyword) {
      queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where("prop.name LIKE :keyword", {
            keyword: `%${keyword}%`,
          }).orWhere("prop.description LIKE :keyword", {
            keyword: `%${keyword}%`,
          });
        }),
      );
    }

    // 排序
    const orderField = this.getOrderField("prop", sortBy);
    queryBuilder.orderBy(orderField, sortOrder.toUpperCase() as "ASC" | "DESC");

    // 分页
    queryBuilder.skip((page - 1) * pageSize).take(pageSize);

    const [props, total] = await queryBuilder.getManyAndCount();

    // 获取统计信息和收藏状态
    const list = await this.enrichAssetSummaries(
      userId,
      props.map((p) => ({
        id: p.id,
        type: "prop" as LibraryAssetType,
        name: p.name,
        description: p.description ?? "",
        thumbnailUrl: this.getPropThumbnail(p),
        status: p.status as LibraryAssetStatus,
        projectId: p.projectId,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
    );

    return { list, total };
  }

  /**
   * 获取排序字段
   */
  private getOrderField(alias: string, sortBy: string): string {
    switch (sortBy) {
      case "name":
        return `${alias}.name`;
      case "updatedAt":
        return `${alias}.updatedAt`;
      case "createdAt":
        return `${alias}.createdAt`;
      default:
        return `${alias}.updatedAt`;
    }
  }

  /**
   * 对资产列表进行排序
   */
  private sortAssets(
    assets: AssetSummaryDto[],
    sortBy: string,
    sortOrder: "asc" | "desc",
  ): void {
    const multiplier = sortOrder === "asc" ? 1 : -1;

    assets.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "heatScore":
          comparison = (a.stats?.heatScore ?? 0) - (b.stats?.heatScore ?? 0);
          break;
        case "createdAt":
          comparison =
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case "updatedAt":
        default:
          comparison =
            new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
      }
      return comparison * multiplier;
    });
  }

  /**
   * 丰富资产摘要信息（添加统计信息和收藏状态）
   */
  private async enrichAssetSummaries(
    userId: string,
    assets: Omit<AssetSummaryDto, "stats" | "isFavorited" | "projectName">[],
  ): Promise<AssetSummaryDto[]> {
    if (assets.length === 0) return [];

    const assetIds = assets.map((a) => a.id);
    const assetTypes = [...new Set(assets.map((a) => a.type))];
    const projectIds = [...new Set(assets.map((a) => a.projectId))];

    // 批量获取统计信息
    const statsList = await this.assetStatsRepository.find({
      where: {
        assetId: In(assetIds),
        assetType: In(assetTypes),
      },
    });

    // 批量获取收藏状态
    const favorites = await this.userFavoriteRepository.find({
      where: {
        userId,
        assetId: In(assetIds),
      },
    });

    // 批量获取项目名称
    const projects = await this.projectRepository.find({
      where: { projectId: In(projectIds) },
    });
    const projectMap = new Map(projects.map((p) => [p.projectId, p.name]));

    const statsMap = new Map(
      statsList.map((s) => [`${s.assetType}:${s.assetId}`, s]),
    );
    const favoriteSet = new Set(
      favorites.map((f) => `${f.assetType}:${f.assetId}`),
    );

    return assets.map((asset) => {
      const stats = statsMap.get(`${asset.type}:${asset.id}`);
      return {
        ...asset,
        projectName: projectMap.get(asset.projectId) ?? "未知项目",
        stats: stats
          ? {
              usageCount: stats.usageCount,
              importCount: stats.importCount,
              heatScore: stats.heatScore,
            }
          : { usageCount: 0, importCount: 0, heatScore: 0 },
        isFavorited: favoriteSet.has(`${asset.type}:${asset.id}`),
      };
    });
  }

  // ==================== 搜索资产 ====================

  /**
   * 全文搜索资产
   * 支持类型筛选、项目筛选，关键词最少2个字符
   */
  async searchAssets(
    userId: string,
    query: SearchAssetsDto,
  ): Promise<AssetListDto> {
    const { q, type, projectId, page = 1, pageSize = 20 } = query;

    // 解析类型筛选（支持逗号分隔的多选）
    const types = type
      ? (type
          .split(",")
          .filter((t) =>
            ["character", "scene", "prop"].includes(t),
          ) as LibraryAssetType[])
      : ["character", "scene", "prop"];

    // 并行搜索各类型
    const searchResults = await Promise.all(
      types.map((t: LibraryAssetType) =>
        this.searchAssetsByType(userId, t, q, projectId),
      ),
    );

    // 合并结果
    let allAssets: AssetSummaryDto[] = [];
    searchResults.forEach((result) => {
      allAssets = allAssets.concat(result);
    });

    // 按热度排序
    allAssets.sort(
      (a, b) => (b.stats?.heatScore ?? 0) - (a.stats?.heatScore ?? 0),
    );

    // 分页
    const total = allAssets.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedList = allAssets.slice(start, end);

    return {
      list: paginatedList,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 按类型搜索资产
   */
  private async searchAssetsByType(
    userId: string,
    type: LibraryAssetType,
    keyword: string,
    projectId?: string,
  ): Promise<AssetSummaryDto[]> {
    const params = {
      projectId,
      keyword,
      sortBy: "heatScore" as const,
      sortOrder: "desc" as const,
      page: 1,
      pageSize: 1000,
    };

    switch (type) {
      case "character":
        return (await this.queryCharacters(userId, params)).list;
      case "scene":
        return (await this.queryScenes(userId, params)).list;
      case "prop":
        return (await this.queryProps(userId, params)).list;
      default:
        return [];
    }
  }

  // ==================== 资产详情 ====================

  /**
   * 获取资产详情
   * 根据类型和ID获取对应类型的完整数据
   */
  async getAssetDetail(
    userId: string,
    assetType: LibraryAssetType,
    assetId: string,
  ): Promise<AssetDetailBaseDto> {
    switch (assetType) {
      case "character":
        return this.getCharacterDetail(userId, assetId);
      case "scene":
        return this.getSceneDetail(userId, assetId);
      case "prop":
        return this.getPropDetail(userId, assetId);
      default:
        throw new NotFoundException({
          code: 20001,
          message: "不支持的资产类型",
        });
    }
  }

  /**
   * 获取角色详情
   */
  private async getCharacterDetail(
    userId: string,
    assetId: string,
  ): Promise<AssetDetailBaseDto> {
    const character = await this.characterRepository.findOne({
      where: { id: assetId, deletedAt: IsNull() },
      relations: ["images"],
    });

    if (!character) {
      throw new NotFoundException({
        code: 20002,
        message: "角色不存在",
      });
    }

    const [stats, isFavorited, project] = await Promise.all([
      this.getAssetStatsInfo("character", assetId),
      this.checkIsFavorited(userId, "character", assetId),
      this.projectRepository.findOne({
        where: { projectId: character.projectId },
      }),
    ]);

    return {
      id: character.id,
      type: "character",
      name: character.name,
      description: character.description ?? "",
      status: character.status as LibraryAssetStatus,
      projectId: character.projectId,
      projectName: project?.name ?? "未知项目",
      thumbnailUrl: this.getCharacterThumbnail(character),
      stats,
      isFavorited,
      createdAt: character.createdAt.toISOString(),
      updatedAt: character.updatedAt.toISOString(),
    };
  }

  /**
   * 获取场景详情
   */
  private async getSceneDetail(
    userId: string,
    assetId: string,
  ): Promise<AssetDetailBaseDto> {
    const scene = await this.sceneRepository.findOne({
      where: { id: assetId, deletedAt: IsNull() },
      relations: ["images"],
    });

    if (!scene) {
      throw new NotFoundException({
        code: 20003,
        message: "场景不存在",
      });
    }

    const [stats, isFavorited, project] = await Promise.all([
      this.getAssetStatsInfo("scene", assetId),
      this.checkIsFavorited(userId, "scene", assetId),
      this.projectRepository.findOne({ where: { projectId: scene.projectId } }),
    ]);

    return {
      id: scene.id,
      type: "scene",
      name: scene.name,
      description: scene.description ?? "",
      status: scene.status as LibraryAssetStatus,
      projectId: scene.projectId,
      projectName: project?.name ?? "未知项目",
      thumbnailUrl: this.getSceneThumbnail(scene),
      stats,
      isFavorited,
      createdAt: scene.createdAt.toISOString(),
      updatedAt: scene.updatedAt.toISOString(),
    };
  }

  /**
   * 获取道具详情
   */
  private async getPropDetail(
    userId: string,
    assetId: string,
  ): Promise<AssetDetailBaseDto> {
    const prop = await this.propRepository.findOne({
      where: { id: assetId, deletedAt: IsNull() },
      relations: ["images"],
    });

    if (!prop) {
      throw new NotFoundException({
        code: 20004,
        message: "道具不存在",
      });
    }

    const [stats, isFavorited, project] = await Promise.all([
      this.getAssetStatsInfo("prop", assetId),
      this.checkIsFavorited(userId, "prop", assetId),
      this.projectRepository.findOne({ where: { projectId: prop.projectId } }),
    ]);

    return {
      id: prop.id,
      type: "prop",
      name: prop.name,
      description: prop.description ?? "",
      status: prop.status as LibraryAssetStatus,
      projectId: prop.projectId,
      projectName: project?.name ?? "未知项目",
      thumbnailUrl: this.getPropThumbnail(prop),
      stats,
      isFavorited,
      createdAt: prop.createdAt.toISOString(),
      updatedAt: prop.updatedAt.toISOString(),
    };
  }

  /**
   * 获取资产统计信息
   */
  private async getAssetStatsInfo(
    assetType: LibraryAssetType,
    assetId: string,
  ): Promise<AssetStatsInfo> {
    const stats = await this.assetStatsRepository.findOne({
      where: { assetType, assetId },
    });

    if (!stats) {
      return {
        usageCount: 0,
        importCount: 0,
        heatScore: 0,
      };
    }

    return {
      usageCount: stats.usageCount,
      importCount: stats.importCount,
      heatScore: stats.heatScore,
    };
  }

  /**
   * 检查资产是否被收藏
   */
  private async checkIsFavorited(
    userId: string,
    assetType: LibraryAssetType,
    assetId: string,
  ): Promise<boolean> {
    const favorite = await this.userFavoriteRepository.findOne({
      where: { userId, assetType, assetId },
    });
    return !!favorite;
  }

  // ==================== 资产统计 ====================

  /**
   * 获取资产统计
   * 包含使用分布（按项目、按时间）
   */
  async getAssetStats(
    assetType: LibraryAssetType,
    assetId: string,
  ): Promise<AssetStatsDto> {
    const stats = await this.assetStatsRepository.findOne({
      where: { assetType, assetId },
    });

    if (!stats) {
      throw new NotFoundException({
        code: 20005,
        message: "资产统计信息不存在",
      });
    }

    // 获取使用分布
    const usageDistribution = await this.getUsageDistribution(
      assetType,
      assetId,
    );

    return {
      assetId: stats.assetId,
      assetType: stats.assetType as LibraryAssetType,
      projectId: stats.projectId,
      usageCount: stats.usageCount,
      importCount: stats.importCount,
      viewCount: stats.viewCount,
      firstUsedAt: stats.firstUsedAt?.toISOString(),
      lastUsedAt: stats.lastUsedAt?.toISOString(),
      lastImportedAt: stats.lastImportedAt?.toISOString(),
      heatScore: stats.heatScore,
      heatRank: stats.heatRank ?? undefined,
      usageDistribution,
    };
  }

  /**
   * 获取使用分布
   */
  private async getUsageDistribution(
    assetType: LibraryAssetType,
    assetId: string,
  ): Promise<UsageDistribution> {
    // 按项目分布（从 asset_stats 表获取）
    const projectStats = await this.assetStatsRepository.find({
      where: { assetType, assetId },
    });

    const byProject = await Promise.all(
      projectStats.map(async (stat) => {
        const project = await this.projectRepository.findOne({
          where: { projectId: stat.projectId },
        });
        return {
          projectId: stat.projectId,
          projectName: project?.name ?? "未知项目",
          count: stat.usageCount,
        };
      }),
    );

    // 按时间分布（最近30天，模拟数据）
    const byTime: { date: string; count: number }[] = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      byTime.push({
        date: date.toISOString().split("T")[0],
        count: 0, // 实际应从使用记录表查询
      });
    }

    return {
      byProject,
      byTime,
    };
  }

  // ==================== 热门资产 ====================

  /**
   * 获取热门资产
   * 按热度分数排序，支持类型筛选、数量限制
   */
  async getPopularAssets(
    userId: string,
    query: GetPopularAssetsDto,
  ): Promise<PopularAssetsDto> {
    const { type, limit = 10, period = "month" } = query;

    // 构建查询条件
    const where: Record<string, unknown> = {};
    if (type) {
      where.assetType = type;
    }

    // 根据周期筛选
    if (period === "week") {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      where.lastUsedAt = { $gte: weekAgo };
    } else if (period === "month") {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      where.lastUsedAt = { $gte: monthAgo };
    }

    // 查询热门资产统计
    const popularStats = await this.assetStatsRepository.find({
      where,
      order: { heatScore: "DESC" },
      take: limit,
    });

    if (popularStats.length === 0) {
      return {
        list: [],
        updatedAt: new Date().toISOString(),
      };
    }

    // 获取资产详情
    const list = await this.buildPopularAssetList(userId, popularStats);

    return {
      list,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * 构建热门资产列表
   */
  private async buildPopularAssetList(
    userId: string,
    statsList: AssetStatsEntity[],
  ): Promise<PopularAssetItemDto[]> {
    const result: PopularAssetItemDto[] = [];

    for (let i = 0; i < statsList.length; i++) {
      const stats = statsList[i];
      const asset = await this.getAssetBasicInfo(
        stats.assetType as LibraryAssetType,
        stats.assetId,
      );

      if (asset) {
        result.push({
          rank: i + 1,
          id: stats.assetId,
          type: stats.assetType as LibraryAssetType,
          name: asset.name,
          description: asset.description,
          thumbnailUrl: asset.thumbnailUrl,
          projectId: stats.projectId,
          projectName: asset.projectName,
          heatScore: stats.heatScore,
          importCount: stats.importCount,
          usageCount: stats.usageCount,
        });
      }
    }

    return result;
  }

  /**
   * 获取资产基本信息
   */
  private async getAssetBasicInfo(
    type: LibraryAssetType,
    assetId: string,
  ): Promise<{
    name: string;
    description: string;
    thumbnailUrl: string;
    projectName: string;
  } | null> {
    let entity: Character | Scene | Prop | null = null;

    switch (type) {
      case "character":
        entity = await this.characterRepository.findOne({
          where: { id: assetId, deletedAt: IsNull() },
          relations: ["images"],
        });
        if (entity) {
          const project = await this.projectRepository.findOne({
            where: { projectId: entity.projectId },
          });
          return {
            name: entity.name,
            description: entity.description ?? "",
            thumbnailUrl: this.getCharacterThumbnail(entity as Character),
            projectName: project?.name ?? "未知项目",
          };
        }
        break;
      case "scene":
        entity = await this.sceneRepository.findOne({
          where: { id: assetId, deletedAt: IsNull() },
          relations: ["images"],
        });
        if (entity) {
          const project = await this.projectRepository.findOne({
            where: { projectId: entity.projectId },
          });
          return {
            name: entity.name,
            description: entity.description ?? "",
            thumbnailUrl: this.getSceneThumbnail(entity as Scene),
            projectName: project?.name ?? "未知项目",
          };
        }
        break;
      case "prop":
        entity = await this.propRepository.findOne({
          where: { id: assetId, deletedAt: IsNull() },
          relations: ["images"],
        });
        if (entity) {
          const project = await this.projectRepository.findOne({
            where: { projectId: entity.projectId },
          });
          return {
            name: entity.name,
            description: entity.description ?? "",
            thumbnailUrl: this.getPropThumbnail(entity as Prop),
            projectName: project?.name ?? "未知项目",
          };
        }
        break;
    }

    return null;
  }

  // ==================== 筛选选项 ====================

  /**
   * 获取筛选选项
   * 返回可用的类型、状态、项目列表，统计各类型资产数量
   */
  async getFilterOptions(userId: string): Promise<AssetFilterOptionsDto> {
    // 统计各类型资产数量
    const [characterCount, sceneCount, propCount] = await Promise.all([
      this.characterRepository.count({ where: { deletedAt: IsNull() } }),
      this.sceneRepository.count({ where: { deletedAt: IsNull() } }),
      this.propRepository.count({ where: { deletedAt: IsNull() } }),
    ]);

    // 获取项目列表（带资产数量）
    const projects = await this.projectRepository.find({
      where: { isDeleted: false },
      select: ["projectId", "name"],
    });

    const projectsWithCount = await Promise.all(
      projects.map(async (project) => {
        const [charCount, sceneCount, propCount] = await Promise.all([
          this.characterRepository.count({
            where: { projectId: project.projectId, deletedAt: IsNull() },
          }),
          this.sceneRepository.count({
            where: { projectId: project.projectId, deletedAt: IsNull() },
          }),
          this.propRepository.count({
            where: { projectId: project.projectId, deletedAt: IsNull() },
          }),
        ]);
        return {
          id: project.projectId,
          name: project.name,
          assetCount: charCount + sceneCount + propCount,
        };
      }),
    );

    return {
      types: [
        { value: "character", label: "角色", count: characterCount },
        { value: "scene", label: "场景", count: sceneCount },
        { value: "prop", label: "道具", count: propCount },
      ],
      statuses: [
        { value: "draft", label: "草稿" },
        { value: "active", label: "已激活" },
        { value: "archived", label: "已归档" },
      ],
      projects: projectsWithCount.filter((p) => p.assetCount > 0),
      sortOptions: [
        { value: "createdAt", label: "创建时间" },
        { value: "updatedAt", label: "更新时间" },
        { value: "name", label: "名称" },
        { value: "heatScore", label: "热度" },
      ],
    };
  }

  // ==================== 辅助方法 ====================

  /**
   * 获取角色缩略图
   */
  private getCharacterThumbnail(character: Character): string {
    const frontView = character.images?.find(
      (img) => img.isCurrent && img.type === "front_view",
    );
    return frontView?.thumbnailUrl ?? frontView?.url ?? "";
  }

  /**
   * 获取场景缩略图
   */
  private getSceneThumbnail(scene: Scene): string {
    const panorama = scene.images?.find(
      (img) => img.isCurrent && img.type === "panorama",
    );
    const wideShot = scene.images?.find(
      (img) => img.isCurrent && img.type === "wide_shot",
    );
    return (
      panorama?.thumbnailUrl ??
      panorama?.url ??
      wideShot?.thumbnailUrl ??
      wideShot?.url ??
      ""
    );
  }

  /**
   * 获取道具缩略图
   */
  private getPropThumbnail(prop: Prop): string {
    const frontView = prop.images?.find(
      (img) => img.isCurrent && img.type === "front_view",
    );
    return frontView?.thumbnailUrl ?? frontView?.url ?? "";
  }
}
