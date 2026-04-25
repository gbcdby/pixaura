import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { NoticeService } from "../services/notice.service";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import {
  NoticeListQuerySchema,
  type NoticeListQuery,
} from "@pixaura/shared-types";

@ApiTags("notices")
@Controller("notices")
export class ClientNoticeController {
  constructor(private readonly noticeService: NoticeService) {}

  /**
   * 获取有效公告列表
   */
  @Get()
  @ApiOperation({ summary: "获取有效公告列表" })
  async findAll(
    @Query(new ZodValidationPipe(NoticeListQuerySchema))
    query: NoticeListQuery,
  ) {
    const result = await this.noticeService.findAllForClient(query);

    return {
      code: 0,
      data: {
        items: result.items.map((notice) => ({
          id: notice.id,
          title: notice.title,
          content: notice.content,
          type: notice.type,
          priority: notice.priority,
          isTop: notice.isTop,
          startAt: notice.startAt.toISOString(),
          endAt: notice.endAt?.toISOString() ?? null,
          createdAt: notice.createdAt.toISOString(),
        })),
        total: result.total,
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
    const notice = await this.noticeService.findOneForClient(id);

    return {
      code: 0,
      data: {
        id: notice.id,
        title: notice.title,
        content: notice.content,
        type: notice.type,
        priority: notice.priority,
        startAt: notice.startAt.toISOString(),
        endAt: notice.endAt?.toISOString() ?? null,
        viewCount: notice.viewCount,
        createdAt: notice.createdAt.toISOString(),
      },
      msg: "success",
      timestamp: Date.now(),
    };
  }
}
