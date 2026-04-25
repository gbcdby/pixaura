import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { OperationLogService } from "../services/operation-log.service";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../user/guards/roles.guard";
import { Roles } from "../../user/decorators/roles.decorator";

@ApiTags("admin-logs")
@Controller("admin/logs")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
@ApiBearerAuth()
export class OperationLogController {
  constructor(private readonly operationLogService: OperationLogService) {}

  /**
   * 获取操作日志列表
   */
  @Get("operations")
  @ApiOperation({ summary: "获取操作日志列表" })
  @ApiQuery({ name: "adminId", required: false })
  @ApiQuery({ name: "operationType", required: false })
  @ApiQuery({ name: "startDate", required: false })
  @ApiQuery({ name: "endDate", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  async getOperationLogs(
    @Query("adminId") adminId?: string,
    @Query("operationType") operationType?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const result = await this.operationLogService.getLogList({
      adminId,
      operationType,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });

    return {
      code: 0,
      data: result,
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 获取操作类型列表
   */
  @Get("operation-types")
  @ApiOperation({ summary: "获取操作类型列表" })
  async getOperationTypes() {
    const types = await this.operationLogService.getOperationTypes();

    return {
      code: 0,
      data: types,
      msg: "success",
      timestamp: Date.now(),
    };
  }
}
