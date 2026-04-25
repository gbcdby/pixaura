import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  Request,
  BadRequestException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from "@nestjs/swagger";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { AssetQueryService } from "../services/asset-query.service";
import {
  QueryAssetsSchema,
  SearchAssetsSchema,
  GetPopularAssetsSchema,
  AssetSuggestSchema,
  QueryAssetsDto,
  SearchAssetsDto,
  GetPopularAssetsDto,
  AssetSuggestDto,
} from "../dto";

/**
 * 资产浏览控制器
 * 提供资产列表查询、搜索、详情获取、热门资产等功能
 */
@ApiTags("素材库-资产浏览")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("assets")
export class AssetController {
  constructor(private readonly assetQueryService: AssetQueryService) {}

  /**
   * 获取资产列表
   * 支持分类、项目、状态筛选
   */
  @ApiOperation({ summary: "获取资产列表" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @ApiResponse({ status: 403, description: "无权访问该项目" })
  @Get()
  async getAssets(
    @Query(new ZodValidationPipe(QueryAssetsSchema)) query: QueryAssetsDto,
    @Request() req: { user: { userId: string } },
  ) {
    return {
      code: 0,
      data: await this.assetQueryService.getAssets(req.user.userId, query),
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 获取资产详情
   * 获取指定资产的详细信息
   */
  @ApiOperation({ summary: "获取资产详情" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @ApiResponse({ status: 404, description: "资产不存在" })
  @Get(":type/:id")
  async getAssetDetail(
    @Param("type") type: string,
    @Param("id") id: string,
    @Request() req: { user: { userId: string } },
  ) {
    // 验证资产类型
    if (!["character", "scene", "prop"].includes(type)) {
      throw new BadRequestException({
        code: 101,
        message: "无效的资产类型",
      });
    }

    return {
      code: 0,
      data: await this.assetQueryService.getAssetDetail(
        req.user.userId,
        type as "character" | "scene" | "prop",
        id,
      ),
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 获取资产统计
   * 获取资产的使用统计数据
   */
  @ApiOperation({ summary: "获取资产统计" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @ApiResponse({ status: 404, description: "资产统计信息不存在" })
  @Get(":type/:id/stats")
  async getAssetStats(@Param("type") type: string, @Param("id") id: string) {
    // 验证资产类型
    if (!["character", "scene", "prop"].includes(type)) {
      throw new BadRequestException({
        code: 101,
        message: "无效的资产类型",
      });
    }

    return {
      code: 0,
      data: await this.assetQueryService.getAssetStats(
        type as "character" | "scene" | "prop",
        id,
      ),
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 获取热门资产
   * 获取平台热门资产列表
   */
  @ApiOperation({ summary: "获取热门资产" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @Get("popular")
  async getPopularAssets(
    @Query(new ZodValidationPipe(GetPopularAssetsSchema))
    query: GetPopularAssetsDto,
    @Request() req: { user: { userId: string } },
  ) {
    return {
      code: 0,
      data: await this.assetQueryService.getPopularAssets(
        req.user.userId,
        query,
      ),
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 搜索资产
   * 全文搜索资产
   */
  @ApiOperation({ summary: "搜索资产" })
  @ApiResponse({ status: 200, description: "搜索成功" })
  @ApiResponse({ status: 400, description: "搜索关键词过短（最少2字符）" })
  @Get("search")
  async searchAssets(
    @Query(new ZodValidationPipe(SearchAssetsSchema)) query: SearchAssetsDto,
    @Request() req: { user: { userId: string } },
  ) {
    return {
      code: 0,
      data: await this.assetQueryService.searchAssets(req.user.userId, query),
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 获取筛选选项
   * 获取资产筛选的可用选项
   */
  @ApiOperation({ summary: "获取筛选选项" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @Get("filters")
  async getFilterOptions(@Request() req: { user: { userId: string } }) {
    return {
      code: 0,
      data: await this.assetQueryService.getFilterOptions(req.user.userId),
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 搜索建议
   * 搜索关键词自动补全建议
   */
  @ApiOperation({ summary: "搜索建议" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @Get("suggest")
  async getSearchSuggestions(
    @Query(new ZodValidationPipe(AssetSuggestSchema)) query: AssetSuggestDto,
  ) {
    // TODO: 实现搜索建议功能
    // 暂时返回空数组
    return {
      code: 0,
      data: {
        suggestions: [],
      },
      msg: "success",
      timestamp: Date.now(),
    };
  }
}
