import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { FastifyRequest } from "fastify";
import { NoticeService } from "../services/notice.service";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../user/guards/roles.guard";
import { Roles } from "../../user/decorators/roles.decorator";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import {
  CreateNoticeRequestSchema,
  UpdateNoticeRequestSchema,
  UpdateNoticeStatusRequestSchema,
  AdminNoticeListQuerySchema,
  type CreateNoticeRequest,
  type UpdateNoticeRequest,
  type UpdateNoticeStatusRequest,
  type AdminNoticeListQuery,
} from "@pixaura/shared-types";

@ApiTags("admin-notices")
@Controller("admin/notices")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("super_admin")
@ApiBearerAuth()
export class AdminNoticeController {
  constructor(private readonly noticeService: NoticeService) {}

  /**
   * 获取公告列表
   */
  @Get()
  @ApiOperation({ summary: "获取公告列表" })
  async findAll(
    @Query(new ZodValidationPipe(AdminNoticeListQuerySchema))
    query: AdminNoticeListQuery,
  ) {
    const result = await this.noticeService.findAllForAdmin(query);

    return {
      code: 0,
      data: {
        items: result.items.map((notice) => ({
          id: notice.id,
          title: notice.title,
          type: notice.type,
          priority: notice.priority,
          status: notice.status,
          isTop: notice.isTop,
          startAt: notice.startAt.toISOString(),
          endAt: notice.endAt?.toISOString() ?? null,
          viewCount: notice.viewCount,
          createdBy: notice.createdBy,
          creatorName: notice.creator?.username ?? "未知",
          createdAt: notice.createdAt.toISOString(),
          updatedAt: notice.updatedAt.toISOString(),
        })),
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      },
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 获取公告详情
   */
  @Get(":id")
  @ApiOperation({ summary: "获取公告详情" })
  async findOne(@Param("id") id: string) {
    const notice = await this.noticeService.findOneForAdmin(id);

    return {
      code: 0,
      data: {
        id: notice.id,
        title: notice.title,
        content: notice.content,
        type: notice.type,
        priority: notice.priority,
        status: notice.status,
        isTop: notice.isTop,
        startAt: notice.startAt.toISOString(),
        endAt: notice.endAt?.toISOString() ?? null,
        viewCount: notice.viewCount,
        createdBy: notice.createdBy,
        creatorName: notice.creator?.username ?? "未知",
        createdAt: notice.createdAt.toISOString(),
        updatedAt: notice.updatedAt.toISOString(),
      },
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 创建公告
   */
  @Post()
  @ApiOperation({ summary: "创建公告" })
  async create(
    @Body(new ZodValidationPipe(CreateNoticeRequestSchema))
    dto: CreateNoticeRequest,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    const userId = req.user.sub;
    const notice = await this.noticeService.create(dto, userId);

    return {
      code: 0,
      data: {
        id: notice.id,
        title: notice.title,
        content: notice.content,
        type: notice.type,
        priority: notice.priority,
        status: notice.status,
        startAt: notice.startAt.toISOString(),
        endAt: notice.endAt?.toISOString() ?? null,
        isTop: notice.isTop,
        createdAt: notice.createdAt.toISOString(),
      },
      msg: "公告创建成功",
      timestamp: Date.now(),
    };
  }

  /**
   * 更新公告
   */
  @Put(":id")
  @ApiOperation({ summary: "更新公告" })
  async update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateNoticeRequestSchema))
    dto: UpdateNoticeRequest,
  ) {
    const notice = await this.noticeService.update(id, dto);

    return {
      code: 0,
      data: {
        id: notice.id,
        title: notice.title,
        content: notice.content,
        type: notice.type,
        priority: notice.priority,
        status: notice.status,
        isTop: notice.isTop,
        startAt: notice.startAt.toISOString(),
        endAt: notice.endAt?.toISOString() ?? null,
        updatedAt: notice.updatedAt.toISOString(),
      },
      msg: "公告更新成功",
      timestamp: Date.now(),
    };
  }

  /**
   * 删除公告
   */
  @Delete(":id")
  @ApiOperation({ summary: "删除公告" })
  async remove(@Param("id") id: string) {
    await this.noticeService.remove(id);

    return {
      code: 0,
      data: null,
      msg: "公告删除成功",
      timestamp: Date.now(),
    };
  }

  /**
   * 更新公告状态
   */
  @Patch(":id/status")
  @ApiOperation({ summary: "更新公告状态" })
  async updateStatus(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateNoticeStatusRequestSchema))
    dto: UpdateNoticeStatusRequest,
  ) {
    const notice = await this.noticeService.updateStatus(id, dto);

    return {
      code: 0,
      data: {
        id: notice.id,
        status: notice.status,
        updatedAt: notice.updatedAt.toISOString(),
      },
      msg: "状态更新成功",
      timestamp: Date.now(),
    };
  }
}
