import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { LoginLog } from "../entities/login-log.entity";

interface CreateLoginLogDto {
  userId: string;
  ip: string;
  userAgent: string;
  deviceType: string;
  loginType: string;
  status: "success" | "failed";
  failReason?: string;
}

@Injectable()
export class LoginLogService {
  constructor(
    @InjectRepository(LoginLog)
    private loginLogRepository: Repository<LoginLog>,
  ) {}

  async create(data: CreateLoginLogDto): Promise<LoginLog> {
    const log = this.loginLogRepository.create(data);
    return this.loginLogRepository.save(log);
  }

  async findByUserId(userId: string, limit: number = 10): Promise<LoginLog[]> {
    return this.loginLogRepository.find({
      where: { userId },
      order: { createdAt: "DESC" },
      take: limit,
    });
  }
}
