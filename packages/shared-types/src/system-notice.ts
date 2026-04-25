import { z } from "zod";

/**
 * 系统公告相关类型定义
 */

// 枚举定义
export const NoticeTypeEnum = z.enum([
  "maintenance",
  "feature",
  "important",
  "other",
]);
export const NoticePriorityEnum = z.enum(["high", "medium", "low"]);
export const NoticeStatusEnum = z.enum(["draft", "published", "unpublished"]);

export type NoticeType = z.infer<typeof NoticeTypeEnum>;
export type NoticePriority = z.infer<typeof NoticePriorityEnum>;
export type NoticeStatus = z.infer<typeof NoticeStatusEnum>;

// 客户端公告列表项
export const ClientNoticeItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  content: z.string(),
  type: NoticeTypeEnum,
  priority: NoticePriorityEnum,
  isTop: z.boolean(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

// 客户端公告详情
export const ClientNoticeDetailSchema = ClientNoticeItemSchema.extend({
  viewCount: z.number().int().nonnegative(),
});

// 管理端公告列表项
export const AdminNoticeItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  type: NoticeTypeEnum,
  priority: NoticePriorityEnum,
  status: NoticeStatusEnum,
  isTop: z.boolean(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime().nullable(),
  viewCount: z.number().int().nonnegative(),
  createdBy: z.string().uuid(),
  creatorName: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// 管理端公告详情
export const AdminNoticeDetailSchema = AdminNoticeItemSchema.extend({
  content: z.string(),
});

// 创建公告请求
export const CreateNoticeRequestSchema = z
  .object({
    title: z.string().min(1).max(200),
    content: z.string().min(1).max(10000),
    type: NoticeTypeEnum,
    priority: NoticePriorityEnum.default("medium"),
    status: z.enum(["draft", "published"]).default("draft"),
    startAt: z.string().datetime(),
    endAt: z.string().datetime().nullable().default(null),
    isTop: z.boolean().default(false),
  })
  .refine(
    (data) => {
      if (data.endAt) {
        return new Date(data.endAt) > new Date(data.startAt);
      }
      return true;
    },
    {
      message: "结束时间必须大于开始时间",
      path: ["endAt"],
    },
  );

// 更新公告请求
export const UpdateNoticeRequestSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    content: z.string().min(1).max(10000).optional(),
    type: NoticeTypeEnum.optional(),
    priority: NoticePriorityEnum.optional(),
    startAt: z.string().datetime().optional(),
    endAt: z.string().datetime().nullable().optional(),
    isTop: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.startAt && data.endAt) {
        return new Date(data.endAt) > new Date(data.startAt);
      }
      return true;
    },
    {
      message: "结束时间必须大于开始时间",
      path: ["endAt"],
    },
  );

// 更新状态请求
export const UpdateNoticeStatusRequestSchema = z.object({
  status: NoticeStatusEnum,
});

// 公告列表查询参数
export const NoticeListQuerySchema = z.object({
  type: NoticeTypeEnum.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

// 管理端公告列表查询参数
export const AdminNoticeListQuerySchema = z.object({
  status: NoticeStatusEnum.optional(),
  type: NoticeTypeEnum.optional(),
  priority: NoticePriorityEnum.optional(),
  keyword: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["createdAt", "startAt", "priority"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// 类型导出
export type ClientNoticeItem = z.infer<typeof ClientNoticeItemSchema>;
export type ClientNoticeDetail = z.infer<typeof ClientNoticeDetailSchema>;
export type AdminNoticeItem = z.infer<typeof AdminNoticeItemSchema>;
export type AdminNoticeDetail = z.infer<typeof AdminNoticeDetailSchema>;
export type CreateNoticeRequest = z.infer<typeof CreateNoticeRequestSchema>;
export type UpdateNoticeRequest = z.infer<typeof UpdateNoticeRequestSchema>;
export type UpdateNoticeStatusRequest = z.infer<
  typeof UpdateNoticeStatusRequestSchema
>;
export type NoticeListQuery = z.infer<typeof NoticeListQuerySchema>;
export type AdminNoticeListQuery = z.infer<typeof AdminNoticeListQuerySchema>;
