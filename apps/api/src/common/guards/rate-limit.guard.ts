import "reflect-metadata";
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RedisService } from "../redis/redis.service";

interface RateLimitOptions {
  key: string;
  limit: number;
  window: number;
  type: "ip" | "user";
}

export const RATE_LIMIT_KEY = "rate_limit";

export function RateLimit(
  key: string,
  limit: number,
  window: number,
  type: "ip" | "user" = "ip",
) {
  return SetMetadata(RATE_LIMIT_KEY, { key, limit, window, type });
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const identifier = this.getIdentifier(request, options.type);
    const key = `rate_limit:${options.key}:${identifier}`;

    const count = await this.redisService.increment(key, options.window);

    if (count > options.limit) {
      throw new HttpException(
        "请求过于频繁，请稍后再试",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private getIdentifier(
    request: {
      user?: { sub?: string };
      headers?: Record<string, string>;
      ip?: string;
    },
    type: "ip" | "user",
  ): string {
    if (type === "user") {
      const user = request.user;
      if (user?.sub) {
        return user.sub;
      }
    }

    // 获取 IP 地址
    const forwarded = request.headers?.["x-forwarded-for"];
    const ip = forwarded || request.ip || "unknown";
    return String(ip).split(",")[0].trim();
  }
}
