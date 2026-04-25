import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, IsNull, Not } from "typeorm";
import { SystemNotice, NoticeStatus } from "../entities/system-notice.entity";

// 本地定义 DTO 类型
interface CreateNoticeRequest {
  title: string;
  content: string;
  type: "maintenance" | "feature" | "important" | "other";
  priority: "high" | "medium" | "low";
  status: "draft" | "published";
  startAt: string;
  endAt: string | null;
  isTop: boolean;
}

interface UpdateNoticeRequest {
  title?: string;
  content?: string;
  type?: "maintenance" | "feature" | "important" | "other";
  priority?: "high" | "medium" | "low";
  startAt?: string;
  endAt?: string | null;
  isTop?: boolean;
}

interface UpdateNoticeStatusRequest {
  status: NoticeStatus;
}

interface AdminNoticeListQuery {
  status?: NoticeStatus;
  type?: "maintenance" | "feature" | "important" | "other";
  priority?: "high" | "medium" | "low";
  keyword?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "createdAt" | "startAt" | "priority";
  sortOrder?: "asc" | "desc";
}

interface NoticeListQuery {
  type?: "maintenance" | "feature" | "important" | "other";
  limit?: number;
  offset?: number;
}

@Injectable()
export class NoticeService {
  constructor(
    @InjectRepository(SystemNotice)
    private readonly noticeRepo: Repository<SystemNotice>,
  ) {}

  /**
   * 创建公告
   */
  async create(
    dto: CreateNoticeRequest,
    userId: string,
  ): Promise<SystemNotice> {
    const notice = this.noticeRepo.create({
      title: dto.title,
      content: dto.content,
      type: dto.type,
      priority: dto.priority,
      status: dto.status,
      startAt: new Date(dto.startAt),
      endAt: dto.endAt ? new Date(dto.endAt) : null,
      isTop: dto.isTop,
      createdBy: userId,
    });

    return this.noticeRepo.save(notice);
  }

  /**
   * 获取公告列表（管理端）
   */
  async findAllForAdmin(query: AdminNoticeListQuery): Promise<{
    items: SystemNotice[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const {
      status,
      type,
      priority,
      keyword,
      page = 1,
      pageSize = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = query;

    const qb = this.noticeRepo
      .createQueryBuilder("notice")
      .leftJoinAndSelect("notice.creator", "creator")
      .where("notice.deleted_at IS NULL");

    if (status) {
      qb.andWhere("notice.status = :status", { status });
    }

    if (type) {
      qb.andWhere("notice.type = :type", { type });
    }

    if (priority) {
      qb.andWhere("notice.priority = :priority", { priority });
    }

    if (keyword) {
      qb.andWhere("notice.title LIKE :keyword", {
        keyword: `%${keyword}%`,
      });
    }

    // 排序 - 使用实体属性名（驼峰命名）
    const orderField =
      sortBy === "startAt"
        ? "notice.startAt"
        : sortBy === "priority"
          ? "notice.priority"
          : "notice.createdAt";
    qb.orderBy(orderField, sortOrder.toUpperCase() as "ASC" | "DESC");

    // 分页
    const skip = (page - 1) * pageSize;
    qb.skip(skip).take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      total,
      page,
      pageSize,
    };
  }

  /**
   * 获取有效公告列表（客户端）
   */
  async findAllForClient(query: NoticeListQuery): Promise<{
    items: SystemNotice[];
    total: number;
  }> {
    const { type, limit = 10, offset = 0 } = query;

    const now = new Date();

    const qb = this.noticeRepo
      .createQueryBuilder("notice")
      .where("notice.deleted_at IS NULL")
      .andWhere("notice.status = :status", { status: "published" })
      .andWhere("notice.start_at <= :now", { now })
      .andWhere("(notice.end_at IS NULL OR notice.end_at > :now)", { now });

    if (type) {
      qb.andWhere("notice.type = :type", { type });
    }

    // 按优先级降序、发布时间降序排序
    qb.orderBy("notice.priority", "DESC").addOrderBy("notice.start_at", "DESC");

    qb.skip(offset).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      total,
    };
  }

  /**
   * 获取公告详情（管理端）
   */
  async findOneForAdmin(id: string): Promise<SystemNotice> {
    const notice = await this.noticeRepo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ["creator"],
    });

    if (!notice) {
      throw new NotFoundException("公告不存在");
    }

    return notice;
  }

  /**
   * 获取公告详情（客户端）
   */
  async findOneForClient(id: string): Promise<SystemNotice> {
    const now = new Date();

    const notice = await this.noticeRepo
      .createQueryBuilder("notice")
      .where("notice.id = :id", { id })
      .andWhere("notice.deleted_at IS NULL")
      .andWhere("notice.status = :status", { status: "published" })
      .andWhere("notice.start_at <= :now", { now })
      .andWhere("(notice.end_at IS NULL OR notice.end_at > :now)", { now })
      .getOne();

    if (!notice) {
      throw new NotFoundException("公告不存在或已下架");
    }

    // 增加浏览次数
    notice.viewCount += 1;
    await this.noticeRepo.save(notice);

    return notice;
  }

  /**
   * 更新公告
   */
  async update(id: string, dto: UpdateNoticeRequest): Promise<SystemNotice> {
    const notice = await this.noticeRepo.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!notice) {
      throw new NotFoundException("公告不存在");
    }

    // 更新字段
    if (dto.title !== undefined) notice.title = dto.title;
    if (dto.content !== undefined) notice.content = dto.content;
    if (dto.type !== undefined) notice.type = dto.type;
    if (dto.priority !== undefined) notice.priority = dto.priority;
    if (dto.startAt !== undefined) notice.startAt = new Date(dto.startAt);
    if (dto.endAt !== undefined)
      notice.endAt = dto.endAt ? new Date(dto.endAt) : null;
    if (dto.isTop !== undefined) notice.isTop = dto.isTop;

    return this.noticeRepo.save(notice);
  }

  /**
   * 删除公告（软删除）
   */
  async remove(id: string): Promise<void> {
    const notice = await this.noticeRepo.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!notice) {
      throw new NotFoundException("公告不存在");
    }

    await this.noticeRepo.softRemove(notice);
  }

  /**
   * 更新公告状态
   */
  async updateStatus(
    id: string,
    dto: UpdateNoticeStatusRequest,
  ): Promise<SystemNotice> {
    const notice = await this.noticeRepo.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!notice) {
      throw new NotFoundException("公告不存在");
    }

    const { status } = dto;
    const currentStatus = notice.status;

    // 状态流转规则验证
    const validTransitions: Record<NoticeStatus, NoticeStatus[]> = {
      draft: ["published"],
      published: ["unpublished"],
      unpublished: ["published"],
    };

    if (!validTransitions[currentStatus].includes(status)) {
      throw new BadRequestException(
        `无效的状态流转: ${currentStatus} -> ${status}`,
      );
    }

    notice.status = status;
    return this.noticeRepo.save(notice);
  }
}
