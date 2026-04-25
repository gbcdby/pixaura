import { api } from "@/utils/request";

// 枚举类型
export type NoticeType = "maintenance" | "feature" | "important" | "other";
export type NoticePriority = "high" | "medium" | "low";
export type NoticeStatus = "draft" | "published" | "unpublished";

// 客户端公告列表项
export interface ClientNoticeItem {
  id: string;
  title: string;
  content: string;
  type: NoticeType;
  priority: NoticePriority;
  isTop: boolean;
  startAt: string;
  endAt: string | null;
  createdAt: string;
}

// 客户端公告详情
export interface ClientNoticeDetail extends ClientNoticeItem {
  viewCount: number;
}

// 管理端公告列表项
export interface AdminNoticeItem {
  id: string;
  title: string;
  type: NoticeType;
  priority: NoticePriority;
  status: NoticeStatus;
  isTop: boolean;
  startAt: string;
  endAt: string | null;
  viewCount: number;
  createdBy: string;
  creatorName: string;
  createdAt: string;
  updatedAt: string;
}

// 管理端公告详情
export interface AdminNoticeDetail extends AdminNoticeItem {
  content: string;
}

// 创建公告请求
export interface CreateNoticeRequest {
  title: string;
  content: string;
  type: NoticeType;
  priority?: NoticePriority;
  status?: "draft" | "published";
  startAt: string;
  endAt?: string | null;
  isTop?: boolean;
}

// 更新公告请求
export interface UpdateNoticeRequest {
  title?: string;
  content?: string;
  type?: NoticeType;
  priority?: NoticePriority;
  startAt?: string;
  endAt?: string | null;
  isTop?: boolean;
}

// 更新状态请求
export interface UpdateNoticeStatusRequest {
  status: NoticeStatus;
}

// 公告列表查询参数
export interface NoticeListQuery {
  type?: NoticeType;
  limit?: number;
  offset?: number;
}

// 管理端公告列表查询参数
export interface AdminNoticeListQuery {
  status?: NoticeStatus;
  type?: NoticeType;
  priority?: NoticePriority;
  keyword?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "createdAt" | "startAt" | "priority";
  sortOrder?: "asc" | "desc";
}

// 列表响应
export interface NoticeListResponse<T> {
  items: T[];
  total: number;
}

// 管理端列表响应
export interface AdminNoticeListResponse<T> extends NoticeListResponse<T> {
  page: number;
  pageSize: number;
}

// 客户端 API
export const systemNoticeApi = {
  /**
   * 获取有效公告列表（客户端）
   */
  async getNotices(
    params?: NoticeListQuery,
  ): Promise<NoticeListResponse<ClientNoticeItem>> {
    return api.get("/notices", { params });
  },

  /**
   * 获取公告详情（客户端）
   */
  async getNoticeDetail(id: string): Promise<ClientNoticeDetail> {
    return api.get(`/notices/${id}`);
  },
};

// 管理端 API
export const adminNoticeApi = {
  /**
   * 获取公告列表（管理端）
   */
  async getAdminNotices(
    params?: AdminNoticeListQuery,
  ): Promise<AdminNoticeListResponse<AdminNoticeItem>> {
    return api.get("/admin/notices", { params });
  },

  /**
   * 获取公告详情（管理端）
   */
  async getAdminNoticeDetail(id: string): Promise<AdminNoticeDetail> {
    return api.get(`/admin/notices/${id}`);
  },

  /**
   * 创建公告
   */
  async createNotice(data: CreateNoticeRequest): Promise<AdminNoticeDetail> {
    return api.post("/admin/notices", data);
  },

  /**
   * 更新公告
   */
  async updateNotice(
    id: string,
    data: UpdateNoticeRequest,
  ): Promise<AdminNoticeDetail> {
    return api.put(`/admin/notices/${id}`, data);
  },

  /**
   * 删除公告
   */
  async deleteNotice(id: string): Promise<void> {
    return api.delete(`/admin/notices/${id}`);
  },

  /**
   * 更新公告状态
   */
  async updateNoticeStatus(
    id: string,
    data: UpdateNoticeStatusRequest,
  ): Promise<{ id: string; status: string; updatedAt: string }> {
    return api.patch(`/admin/notices/${id}/status`, data);
  },
};
