import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, IsNull } from "typeorm";
import { UserFavoriteEntity } from "../entities/user-favorite.entity";
import { UserRecentEntity } from "../entities/user-recent.entity";
import { Character } from "../../character/entities/character.entity";
import { Prop } from "../../prop/entities/prop.entity";
import type {
  AddFavoriteDto,
  GetFavoritesDto,
  GetRecentDto,
  FavoriteListDto,
  FavoriteItemDto,
  AddFavoriteResponseDto,
  RecentItemDto,
  LibraryAssetType,
  UserActionType,
} from "@pixaura/shared-types";

/**
 * 收藏数量上限
 */
const MAX_FAVORITES = 500;

/**
 * 用户资产服务
 * 处理用户收藏、最近使用等个人素材库功能
 */
@Injectable()
export class UserAssetService {
  constructor(
    @InjectRepository(UserFavoriteEntity)
    private readonly userFavoriteRepository: Repository<UserFavoriteEntity>,
    @InjectRepository(UserRecentEntity)
    private readonly userRecentRepository: Repository<UserRecentEntity>,
    @InjectRepository(Character)
    private readonly characterRepository: Repository<Character>,
    @InjectRepository(Prop)
    private readonly propRepository: Repository<Prop>,
  ) {}

  // ==================== 收藏管理 ====================

  /**
   * 添加收藏
   * @param userId 用户ID
   * @param dto 添加收藏参数
   * @returns 收藏记录
   */
  async addFavorite(
    userId: string,
    dto: AddFavoriteDto,
  ): Promise<AddFavoriteResponseDto> {
    const { assetType, assetId, tags } = dto;

    // 检查资产是否存在
    const assetSnapshot = await this.getAssetSnapshot(assetType, assetId);
    if (!assetSnapshot) {
      throw new NotFoundException({
        code: 2001,
        message: "资产不存在",
      });
    }

    // 检查是否已收藏
    const existingFavorite = await this.userFavoriteRepository.findOne({
      where: { userId, assetType, assetId },
    });
    if (existingFavorite) {
      throw new ConflictException({
        code: 5002,
        message: "已收藏该资产",
      });
    }

    // 检查收藏数量上限
    const favoriteCount = await this.userFavoriteRepository.count({
      where: { userId },
    });
    if (favoriteCount >= MAX_FAVORITES) {
      throw new ForbiddenException({
        code: 3003,
        message: `收藏数量已达上限（${MAX_FAVORITES}条）`,
      });
    }

    // 创建收藏记录
    const favorite = this.userFavoriteRepository.create({
      userId,
      assetType,
      assetId,
      assetSnapshot,
      tags: tags ?? [],
      favoritedAt: new Date(),
    });

    await this.userFavoriteRepository.save(favorite);

    return {
      id: favorite.id,
      assetType: favorite.assetType,
      assetId: favorite.assetId,
      favoritedAt: favorite.favoritedAt.toISOString(),
    };
  }

  /**
   * 取消收藏
   * @param userId 用户ID
   * @param assetType 资产类型
   * @param assetId 资产ID
   * @returns 是否成功
   */
  async removeFavorite(
    userId: string,
    assetType: LibraryAssetType,
    assetId: string,
  ): Promise<{ success: boolean }> {
    const result = await this.userFavoriteRepository.delete({
      userId,
      assetType,
      assetId,
    });

    return { success: result.affected ? result.affected > 0 : false };
  }

  /**
   * 获取收藏列表
   * @param userId 用户ID
   * @param query 查询参数
   * @returns 收藏列表
   */
  async getFavorites(
    userId: string,
    query: GetFavoritesDto,
  ): Promise<FavoriteListDto> {
    const { type, tag, page = 1, pageSize = 20 } = query;

    // 构建查询条件
    const where: Record<string, unknown> = { userId };
    if (type) {
      where.assetType = type;
    }
    if (tag) {
      where.tags = tag;
    }

    // 查询收藏列表
    const [favorites, total] = await this.userFavoriteRepository.findAndCount({
      where,
      order: { favoritedAt: "DESC" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // 转换为 DTO
    const list: FavoriteItemDto[] = favorites.map((favorite) => ({
      id: favorite.id,
      assetType: favorite.assetType,
      assetId: favorite.assetId,
      name: favorite.assetSnapshot.name,
      description: favorite.assetSnapshot.description,
      thumbnailUrl: favorite.assetSnapshot.thumbnailUrl,
      projectName: favorite.assetSnapshot.projectName,
      projectId: favorite.assetSnapshot.projectId,
      favoritedAt: favorite.favoritedAt.toISOString(),
      tags: favorite.tags,
    }));

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
   * 检查用户是否已收藏资产
   * @param userId 用户ID
   * @param assetType 资产类型
   * @param assetId 资产ID
   * @returns 是否已收藏
   */
  async isFavorited(
    userId: string,
    assetType: LibraryAssetType,
    assetId: string,
  ): Promise<boolean> {
    const count = await this.userFavoriteRepository.count({
      where: { userId, assetType, assetId },
    });
    return count > 0;
  }

  // ==================== 最近使用 ====================

  /**
   * 记录最近使用
   * @param userId 用户ID
   * @param assetType 资产类型
   * @param assetId 资产ID
   * @param action 操作类型
   * @param context 上下文信息
   */
  async recordRecentUsage(
    userId: string,
    assetType: LibraryAssetType,
    assetId: string,
    action: UserActionType,
    context?: {
      sourceProjectId?: string;
      targetProjectId?: string;
      shotId?: string;
    },
  ): Promise<void> {
    // 获取资产快照
    const assetSnapshot = await this.getAssetSnapshot(assetType, assetId);
    if (!assetSnapshot) {
      // 资产不存在时不记录，静默返回
      return;
    }

    // 创建使用记录
    const recent = this.userRecentRepository.create({
      userId,
      assetType,
      assetId,
      action,
      context,
      usedAt: new Date(),
    });

    await this.userRecentRepository.save(recent);
    // 注意：触发器会自动限制50条记录
  }

  /**
   * 获取最近使用列表
   * @param userId 用户ID
   * @param query 查询参数
   * @returns 最近使用列表
   */
  async getRecent(
    userId: string,
    query: GetRecentDto,
  ): Promise<{ list: RecentItemDto[] }> {
    const { type, action, limit = 20 } = query;

    // 构建查询条件
    const where: Record<string, unknown> = { userId };
    if (type) {
      where.assetType = type;
    }
    if (action) {
      where.action = action;
    }

    // 查询最近使用记录
    const recents = await this.userRecentRepository.find({
      where,
      order: { usedAt: "DESC" },
      take: limit,
    });

    // 转换为 DTO
    const list: RecentItemDto[] = await Promise.all(
      recents.map(async (recent) => {
        // 获取资产快照（用于显示名称和缩略图）
        const assetSnapshot = await this.getAssetSnapshot(
          recent.assetType,
          recent.assetId,
        );

        // 构建上下文信息
        const context: RecentItemDto["context"] = {};
        if (recent.context?.sourceProjectId) {
          // 这里简化处理，实际可能需要查询项目名称
          context.sourceProjectName = recent.context.sourceProjectId;
        }
        if (recent.context?.targetProjectId) {
          context.targetProjectName = recent.context.targetProjectId;
        }

        return {
          id: recent.id,
          assetType: recent.assetType,
          assetId: recent.assetId,
          name: assetSnapshot?.name ?? "未知资产",
          thumbnailUrl: assetSnapshot?.thumbnailUrl ?? "",
          action: recent.action,
          context: Object.keys(context).length > 0 ? context : undefined,
          usedAt: recent.usedAt.toISOString(),
        };
      }),
    );

    return { list };
  }

  /**
   * 清除最近使用记录
   * @param userId 用户ID
   * @returns 清除数量
   */
  async clearRecent(userId: string): Promise<{ clearedCount: number }> {
    const result = await this.userRecentRepository.delete({ userId });
    return { clearedCount: result.affected ?? 0 };
  }

  // ==================== 私有方法 ====================

  /**
   * 获取资产快照
   * @param assetType 资产类型
   * @param assetId 资产ID
   * @returns 资产快照
   */
  private async getAssetSnapshot(
    assetType: LibraryAssetType,
    assetId: string,
  ): Promise<{
    name: string;
    description: string;
    thumbnailUrl: string;
    projectName: string;
    projectId: string;
  } | null> {
    switch (assetType) {
      case "character": {
        const character = await this.characterRepository.findOne({
          where: { id: assetId, deletedAt: IsNull() },
          relations: ["images"],
        });
        if (!character) return null;

        // 获取缩略图（从当前版本的正面图中获取）
        const thumbnailImage = character.images?.find(
          (img) => img.isCurrent && img.thumbnailUrl,
        );

        return {
          name: character.name,
          description: character.description ?? "",
          thumbnailUrl: thumbnailImage?.thumbnailUrl ?? "",
          projectName: "", // 需要通过项目ID查询项目名称
          projectId: character.projectId,
        };
      }

      case "prop": {
        const prop = await this.propRepository.findOne({
          where: { id: assetId, deletedAt: IsNull() },
          relations: ["images"],
        });
        if (!prop) return null;

        // 获取缩略图
        const thumbnailImage = prop.images?.find(
          (img) => img.isCurrent && img.thumbnailUrl,
        );

        return {
          name: prop.name,
          description: prop.description ?? "",
          thumbnailUrl: thumbnailImage?.thumbnailUrl ?? "",
          projectName: "",
          projectId: prop.projectId,
        };
      }

      case "scene":
        // 场景实体尚未实现，返回 null
        return null;

      default:
        return null;
    }
  }
}
