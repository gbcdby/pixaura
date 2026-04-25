import {
  Controller,
  Post,
  Get,
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
import { ProjectGuard } from "../../project/guards/project.guard";
import { AssetImportService } from "../services/asset-import.service";
import {
  ImportAssetSchema,
  BatchImportAssetsSchema,
  CheckImportConflictSchema,
  ImportAssetDto,
  BatchImportAssetsDto,
  CheckImportConflictDto,
} from "../dto";

/**
 * 资产导入控制器
 * 处理跨项目资产导入、批量导入、冲突检测等功能
 */
@ApiTags("素材库-资产导入")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class AssetImportController {
  constructor(private readonly assetImportService: AssetImportService) {}

  /**
   * 导入资产
   * 将资产从其他项目导入到当前项目
   */
  @ApiOperation({ summary: "导入资产" })
  @ApiResponse({ status: 200, description: "导入成功" })
  @ApiResponse({ status: 404, description: "源资产不存在" })
  @ApiResponse({ status: 403, description: "无权访问源资产或需要编辑权限" })
  @ApiResponse({ status: 409, description: "资产名称冲突" })
  @Post("projects/:id/assets/import")
  @UseGuards(ProjectGuard)
  async importAsset(
    @Param("id") projectId: string,
    @Body(new ZodValidationPipe(ImportAssetSchema)) dto: ImportAssetDto,
    @Request() req: { user: { userId: string } },
  ) {
    return {
      code: 0,
      data: await this.assetImportService.importAsset(
        projectId,
        req.user.userId,
        dto,
      ),
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 批量导入资产
   * 批量导入多个资产到当前项目
   */
  @ApiOperation({ summary: "批量导入资产" })
  @ApiResponse({ status: 200, description: "批量导入完成" })
  @ApiResponse({ status: 400, description: "导入列表为空或超过限制" })
  @ApiResponse({ status: 403, description: "需要编辑权限" })
  @Post("projects/:id/assets/import/batch")
  @UseGuards(ProjectGuard)
  async batchImportAssets(
    @Param("id") projectId: string,
    @Body(new ZodValidationPipe(BatchImportAssetsSchema))
    dto: BatchImportAssetsDto,
    @Request() req: { user: { userId: string } },
  ) {
    return {
      code: 0,
      data: await this.assetImportService.batchImportAssets(
        projectId,
        req.user.userId,
        dto,
      ),
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 检查导入冲突
   * 检查导入时可能遇到的名称冲突
   */
  @ApiOperation({ summary: "检查导入冲突" })
  @ApiResponse({ status: 200, description: "检查完成" })
  @ApiResponse({ status: 403, description: "需要编辑权限" })
  @Post("projects/:id/assets/import/check")
  @UseGuards(ProjectGuard)
  async checkImportConflicts(
    @Param("id") projectId: string,
    @Body(new ZodValidationPipe(CheckImportConflictSchema))
    dto: CheckImportConflictDto,
    @Request() req: { user: { userId: string } },
  ) {
    return {
      code: 0,
      data: await this.assetImportService.checkImportConflicts(
        projectId,
        req.user.userId,
        dto,
      ),
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 获取导入历史
   * 获取项目的资产导入历史记录
   */
  @ApiOperation({ summary: "获取导入历史" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @Get("projects/:id/assets/import-history")
  @UseGuards(ProjectGuard)
  async getImportHistory(
    @Param("id") projectId: string,
    @Query("page") page: string = "1",
    @Query("pageSize") pageSize: string = "20",
    @Request() req: { user: { userId: string } },
  ) {
    return {
      code: 0,
      data: await this.assetImportService.getImportHistory(
        projectId,
        req.user.userId,
        parseInt(page, 10),
        parseInt(pageSize, 10),
      ),
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 获取批量导入详情
   * 获取批量导入批次的详细结果（包含失败项）
   */
  @ApiOperation({ summary: "获取批量导入详情" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @ApiResponse({ status: 404, description: "批量导入批次不存在或已过期" })
  @Get("projects/:id/assets/import/batch/:batchId")
  @UseGuards(ProjectGuard)
  async getBatchImportDetail(
    @Param("id") projectId: string,
    @Param("batchId") batchId: string,
    @Request() req: { user: { userId: string } },
  ) {
    return {
      code: 0,
      data: await this.assetImportService.getBatchImportDetail(
        batchId,
        req.user.userId,
      ),
      msg: "success",
      timestamp: Date.now(),
    };
  }
}
