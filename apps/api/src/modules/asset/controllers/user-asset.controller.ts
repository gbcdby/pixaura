import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from "@nestjs/swagger";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { UserAssetService } from "../services/user-asset.service";
import {
  AddFavoriteSchema,
  GetFavoritesSchema,
  GetRecentSchema,
  AddFavoriteDto,
  GetFavoritesDto,
  GetRecentDto,
} from "../dto";

/**
 * 用户资产控制器
 * 处理用户收藏、最近使用等个人素材库功能
 */
@ApiTags("素材库-用户资产")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class UserAssetController {
  constructor(private readonly userAssetService: UserAssetService) {}

  /**
   * 获取用户收藏
   * 获取用户收藏的资产列表
   */
  @ApiOperation({ summary: "获取用户收藏" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @Get("user/favorites")
  async getFavorites(
    @Query(new ZodValidationPipe(GetFavoritesSchema)) query: GetFavoritesDto,
    @Request() req: { user: { userId: string } },
  ) {
    return {
      code: 0,
      data: await this.userAssetService.getFavorites(req.user.userId, query),
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 添加收藏
   * 收藏资产到个人素材库
   */
  @ApiOperation({ summary: "添加收藏" })
  @ApiResponse({ status: 200, description: "收藏成功" })
  @ApiResponse({ status: 404, description: "资产不存在" })
  @ApiResponse({ status: 403, description: "收藏数量已达上限（500）" })
  @ApiResponse({ status: 409, description: "已收藏该资产" })
  @Post("user/favorites")
  async addFavorite(
    @Body(new ZodValidationPipe(AddFavoriteSchema)) dto: AddFavoriteDto,
    @Request() req: { user: { userId: string } },
  ) {
    return {
      code: 0,
      data: await this.userAssetService.addFavorite(req.user.userId, dto),
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 取消收藏
   * 取消收藏资产
   */
  @ApiOperation({ summary: "取消收藏" })
  @ApiResponse({ status: 200, description: "取消收藏成功" })
  @Delete("user/favorites/:type/:id")
  async removeFavorite(
    @Param("type") type: string,
    @Param("id") id: string,
    @Request() req: { user: { userId: string } },
  ) {
    // 验证资产类型
    if (!["character", "scene", "prop"].includes(type)) {
      return {
        code: 101,
        data: { success: false },
        msg: "无效的资产类型",
        timestamp: Date.now(),
      };
    }

    return {
      code: 0,
      data: await this.userAssetService.removeFavorite(
        req.user.userId,
        type as "character" | "scene" | "prop",
        id,
      ),
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 获取最近使用
   * 获取用户最近使用的资产记录
   */
  @ApiOperation({ summary: "获取最近使用" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @Get("user/recent")
  async getRecent(
    @Query(new ZodValidationPipe(GetRecentSchema)) query: GetRecentDto,
    @Request() req: { user: { userId: string } },
  ) {
    return {
      code: 0,
      data: await this.userAssetService.getRecent(req.user.userId, query),
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 清除最近使用
   * 清除用户的最近使用记录
   */
  @ApiOperation({ summary: "清除最近使用" })
  @ApiResponse({ status: 200, description: "清除成功" })
  @Delete("user/recent")
  async clearRecent(@Request() req: { user: { userId: string } }) {
    return {
      code: 0,
      data: await this.userAssetService.clearRecent(req.user.userId),
      msg: "success",
      timestamp: Date.now(),
    };
  }
}
