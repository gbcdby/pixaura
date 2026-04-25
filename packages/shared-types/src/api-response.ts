import { z } from "zod";

/**
 * API 响应标准格式
 */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data?: T;
}

/**
 * 分页请求参数
 */
export const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1).describe("页码"),
  pageSize: z.number().int().min(1).max(100).default(20).describe("每页数量"),
});

export type PaginationParams = z.infer<typeof PaginationSchema>;

/**
 * 分页响应数据
 */
export interface PaginatedData<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * 创建成功响应
 */
export function createSuccessResponse<T>(
  data?: T,
  message = "成功",
): ApiResponse<T> {
  return {
    code: 0,
    message,
    data,
  };
}

/**
 * 创建分页响应
 */
export function createPaginatedResponse<T>(
  list: T[],
  total: number,
  page: number,
  pageSize: number,
): ApiResponse<PaginatedData<T>> {
  return createSuccessResponse({
    list,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}

/**
 * API 响应 Zod Schema（用于验证）
 */
export function createApiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    code: z.number(),
    message: z.string(),
    data: dataSchema.optional(),
  });
}
