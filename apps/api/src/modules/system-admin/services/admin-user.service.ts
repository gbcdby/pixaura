import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Like } from "typeorm";
import { User } from "../../user/entities/user.entity";
import { UserBanRecord } from "../entities/user-ban-record.entity";
import { isSuperAdmin } from "@pixaura/shared-types";

interface UserListQuery {
  keyword?: string;
  isBanned?: boolean;
  page?: number;
  pageSize?: number;
}

interface BanUserDto {
  reason: string;
  durationDays: number;
  notifyUser?: boolean;
}

interface UnbanUserDto {
  reason: string;
}

@Injectable()
export class AdminUserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserBanRecord)
    private readonly banRecordRepo: Repository<UserBanRecord>,
  ) {}

  /**
   * 获取用户列表
   */
  async getUserList(query: UserListQuery) {
    const { keyword, isBanned, page = 1, pageSize = 20 } = query;

    const where: any = {};

    if (isBanned !== undefined) {
      where.isBanned = isBanned;
    }

    if (keyword) {
      where.username = Like(`%${keyword}%`);
    }

    const [users, total] = await this.userRepo.findAndCount({
      where,
      select: [
        "id",
        "username",
        "phone",
        "email",
        "perms",
        "subscriptionTier",
        "balance",
        "isBanned",
        "bannedReason",
        "createdAt",
        "lastLoginAt",
      ],
      order: { createdAt: "DESC" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // 脱敏处理
    const maskedUsers = users.map((user) => this.maskUserInfo(user));

    return {
      total,
      page,
      pageSize,
      items: maskedUsers,
    };
  }

  /**
   * 获取用户详情
   */
  async getUserDetail(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: [
        "id",
        "username",
        "phone",
        "email",
        "emailVerified",
        "perms",
        "subscriptionTier",
        "subscriptionExpiresAt",
        "balance",
        "isBanned",
        "bannedReason",
        "bannedAt",
        "createdAt",
        "updatedAt",
      ],
    });

    if (!user) {
      throw new NotFoundException("用户不存在");
    }

    // 获取最近封禁记录
    const banRecords = await this.banRecordRepo.find({
      where: { userId },
      order: { bannedAt: "DESC" },
      take: 5,
    });

    return {
      user: this.maskUserInfo(user),
      banRecords: banRecords.map((record) => ({
        id: record.id,
        reason: record.reason,
        durationDays: record.durationDays,
        bannedAt: record.bannedAt,
        unbannedAt: record.unbannedAt,
        unbanReason: record.unbanReason,
      })),
    };
  }

  /**
   * 封禁用户
   */
  async banUser(userId: string, dto: BanUserDto, adminId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("用户不存在");
    }

    if (user.isBanned) {
      throw new ForbiddenException("用户已被封禁");
    }

    // 检查是否尝试封禁超级管理员
    if (isSuperAdmin(user.perms)) {
      throw new ForbiddenException("无权操作超级管理员");
    }

    // 创建封禁记录
    const banRecord = this.banRecordRepo.create({
      userId,
      bannedBy: adminId,
      reason: dto.reason,
      durationDays: dto.durationDays,
    });
    await this.banRecordRepo.save(banRecord);

    // 更新用户状态
    user.isBanned = true;
    user.bannedReason = dto.reason;
    user.bannedAt = new Date();
    await this.userRepo.save(user);

    // TODO: 如果 notifyUser 为 true，发送通知

    return {
      userId,
      isBanned: true,
      bannedAt: user.bannedAt,
      banExpiresAt:
        dto.durationDays > 0
          ? new Date(Date.now() + dto.durationDays * 24 * 60 * 60 * 1000)
          : null,
    };
  }

  /**
   * 解封用户
   */
  async unbanUser(userId: string, dto: UnbanUserDto, adminId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("用户不存在");
    }

    if (!user.isBanned) {
      throw new ForbiddenException("用户未被封禁");
    }

    // 更新最新的封禁记录
    const latestBanRecord = await this.banRecordRepo.findOne({
      where: { userId },
      order: { bannedAt: "DESC" },
    });

    if (latestBanRecord && !latestBanRecord.unbannedAt) {
      latestBanRecord.unbannedBy = adminId;
      latestBanRecord.unbannedAt = new Date();
      latestBanRecord.unbanReason = dto.reason;
      await this.banRecordRepo.save(latestBanRecord);
    }

    // 更新用户状态
    user.isBanned = false;
    user.bannedReason = null;
    user.bannedAt = null;
    await this.userRepo.save(user);

    return {
      userId,
      isBanned: false,
      unbannedAt: new Date(),
    };
  }

  /**
   * 脱敏用户信息
   */
  private maskUserInfo(user: User): Record<string, unknown> {
    return {
      ...user,
      phone: user.phone ? this.maskPhone(user.phone) : null,
      email: user.email ? this.maskEmail(user.email) : null,
    };
  }

  /**
   * 手机号脱敏：138****1234
   */
  private maskPhone(phone: string): string {
    if (phone.length < 7) return phone;
    return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
  }

  /**
   * 邮箱脱敏：tes***@gmail.com
   */
  private maskEmail(email: string): string {
    const atIndex = email.indexOf("@");
    if (atIndex < 3) return email;
    const local = email.slice(0, atIndex);
    const domain = email.slice(atIndex);
    return `${local.slice(0, 3)}***${domain}`;
  }
}
