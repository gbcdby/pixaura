import { Controller, Get, UseGuards } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from "@nestjs/swagger";
import { DashboardService } from "../services/dashboard.service";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../user/guards/roles.guard";
import { Roles } from "../../user/decorators/roles.decorator";

@ApiTags("admin-dashboard")
@Controller("admin/dashboard")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * 获取仪表盘统计数据
   */
  @Get("stats")
  @ApiOperation({ summary: "获取仪表盘统计数据" })
  @ApiResponse({
    status: 200,
    description: "获取成功",
    schema: {
      type: "object",
      properties: {
        code: { type: "number", example: 0 },
        data: {
          type: "object",
          properties: {
            userTotal: { type: "number", example: 1256 },
            userTodayNew: { type: "number", example: 23 },
            userYesterdayNew: { type: "number", example: 18 },
            revenueTotal: { type: "number", example: 45200.5 },
            revenueToday: { type: "number", example: 1200.0 },
            revenueYesterday: { type: "number", example: 980.0 },
            modelTotal: { type: "number", example: 24 },
          },
        },
        msg: { type: "string", example: "success" },
        timestamp: { type: "number", example: 1705312800000 },
      },
    },
  })
  @ApiResponse({ status: 401, description: "未登录" })
  @ApiResponse({ status: 403, description: "无权限访问" })
  async getStats() {
    const stats = await this.dashboardService.getStats();

    return {
      code: 0,
      data: stats,
      msg: "success",
      timestamp: Date.now(),
    };
  }
}
