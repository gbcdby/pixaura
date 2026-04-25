import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { FastifyRequest } from "fastify";
import { AdminUserService } from "../services/admin-user.service";
import { OperationLogService } from "../services/operation-log.service";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../user/guards/roles.guard";
import { Roles } from "../../user/decorators/roles.decorator";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import {
  BanUserSchema,
  UnbanUserSchema,
  type BanUserDto,
  type UnbanUserDto,
} from "@pixaura/shared-types";

@ApiTags("admin-users")
@Controller("admin/users")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
@ApiBearerAuth()
export class AdminUserController {
  constructor(
    private readonly adminUserService: AdminUserService,
    private readonly operationLogService: OperationLogService,
  ) {}

  /**
   * 获取用户列表
   */
  @Get()
  @ApiOperation({ summary: "获取用户列表" })
  @ApiQuery({ name: "keyword", required: false })
  @ApiQuery({ name: "isBanned", required: false, type: Boolean })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  async getUserList(
    @Query("keyword") keyword?: string,
    @Query("isBanned") isBanned?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const result = await this.adminUserService.getUserList({
      keyword,
      isBanned: isBanned !== undefined ? isBanned === "true" : undefined,
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
   * 获取用户详情
   */
  @Get(":userId")
  @ApiOperation({ summary: "获取用户详情" })
  async getUserDetail(@Param("userId") userId: string) {
    const result = await this.adminUserService.getUserDetail(userId);

    return {
      code: 0,
      data: result,
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 封禁用户
   */
  @Post(":userId/ban")
  @ApiOperation({ summary: "封禁用户" })
  async banUser(
    @Param("userId") userId: string,
    @Body(new ZodValidationPipe(BanUserSchema)) dto: BanUserDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    const adminId = req.user.sub;
    const result = await this.adminUserService.banUser(userId, dto, adminId);

    // 记录操作日志
    await this.operationLogService.createLog({
      adminId,
      operationType: "user_ban",
      targetType: "user",
      targetId: userId,
      details: {
        reason: dto.reason,
        durationDays: dto.durationDays,
        result,
      },
      ipAddress: req.ip || "unknown",
      userAgent: req.headers["user-agent"] as string | undefined,
    });

    return {
      code: 0,
      data: result,
      msg: "用户封禁成功",
      timestamp: Date.now(),
    };
  }

  /**
   * 解封用户
   */
  @Post(":userId/unban")
  @ApiOperation({ summary: "解封用户" })
  async unbanUser(
    @Param("userId") userId: string,
    @Body(new ZodValidationPipe(UnbanUserSchema)) dto: UnbanUserDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    const adminId = req.user.sub;
    const result = await this.adminUserService.unbanUser(userId, dto, adminId);

    // 记录操作日志
    await this.operationLogService.createLog({
      adminId,
      operationType: "user_unban",
      targetType: "user",
      targetId: userId,
      details: {
        reason: dto.reason,
        result,
      },
      ipAddress: req.ip || "unknown",
      userAgent: req.headers["user-agent"] as string | undefined,
    });

    return {
      code: 0,
      data: result,
      msg: "用户解封成功",
      timestamp: Date.now(),
    };
  }
}
