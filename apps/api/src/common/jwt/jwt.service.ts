import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService as NestJwtService } from "@nestjs/jwt";
import { RedisService } from "../redis/redis.service";

interface TokenPayload {
  sub: string;
  username: string;
  type: "access" | "refresh";
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpires: number;
  refreshTokenExpires: number;
}

@Injectable()
export class JwtService {
  constructor(
    private configService: ConfigService,
    private jwtService: NestJwtService,
    private redisService: RedisService,
  ) {}

  /**
   * 生成 Token 对
   */
  async generateTokenPair(
    userId: string,
    username: string,
    deviceType: string,
    ip: string,
    remember = false,
  ): Promise<TokenPair> {
    const payload: TokenPayload = { sub: userId, username, type: "access" };
    const refreshPayload: TokenPayload = {
      sub: userId,
      username,
      type: "refresh",
    };

    // 根据"记住我"选项设置过期时间
    const accessExpiresIn = remember
      ? "7d"
      : this.configService.get("jwt.accessExpiration");
    const refreshExpiresIn = remember
      ? "30d"
      : this.configService.get("jwt.refreshExpiration");

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: accessExpiresIn,
    });

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.configService.get("jwt.secret"),
      expiresIn: refreshExpiresIn,
    });

    // 记住我：Access Token 7天，Refresh Token 30天
    // 普通：Access Token 2小时，Refresh Token 7天
    const accessTokenExpires = remember
      ? Date.now() + 7 * 24 * 60 * 60 * 1000
      : Date.now() + 2 * 60 * 60 * 1000;
    const refreshTokenExpires = remember
      ? Date.now() + 30 * 24 * 60 * 60 * 1000
      : Date.now() + 7 * 24 * 60 * 60 * 1000;

    // 存储 Session
    const sessionId = this.extractJti(refreshToken) || refreshToken.slice(-32);
    await this.redisService.setSession(userId, sessionId, {
      refreshTokenHash: await this.hashToken(refreshToken),
      deviceType,
      ip,
      createdAt: new Date(),
      remember,
    });

    return {
      accessToken,
      refreshToken,
      accessTokenExpires,
      refreshTokenExpires,
    };
  }

  /**
   * 验证 Access Token
   */
  async verifyAccessToken(token: string): Promise<TokenPayload> {
    // 检查黑名单
    const isBlacklisted = await this.redisService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      throw new Error("Token is blacklisted");
    }

    return this.jwtService.verify<TokenPayload>(token);
  }

  /**
   * 验证 Refresh Token
   */
  async verifyRefreshToken(token: string): Promise<TokenPayload> {
    return this.jwtService.verify<TokenPayload>(token, {
      secret: this.configService.get("jwt.secret"),
    });
  }

  /**
   * 刷新 Token
   */
  async refreshTokens(
    refreshToken: string,
    deviceType: string,
    ip: string,
  ): Promise<TokenPair | null> {
    try {
      const payload = await this.verifyRefreshToken(refreshToken);

      if (payload.type !== "refresh") {
        throw new Error("Invalid token type");
      }

      // 检查防竞态缓存
      const cachedRefresh = await this.redisService.getTokenRefresh(
        payload.sub,
      );
      if (cachedRefresh) {
        return JSON.parse(cachedRefresh);
      }

      // 生成新的 Token 对
      const tokens = await this.generateTokenPair(
        payload.sub,
        payload.username,
        deviceType,
        ip,
      );

      // 缓存刷新结果（5秒窗口期）
      await this.redisService.setTokenRefresh(
        payload.sub,
        JSON.stringify(tokens),
      );

      // 将旧 refreshToken 加入黑名单
      const decoded = this.jwtService.decode(refreshToken) as { exp: number };
      if (decoded?.exp) {
        const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
        if (expiresIn > 0) {
          await this.redisService.addToTokenBlacklist(refreshToken, expiresIn);
        }
      }

      return tokens;
    } catch {
      return null;
    }
  }

  /**
   * 使 Token 失效
   */
  async revokeToken(token: string): Promise<void> {
    const decoded = this.jwtService.decode(token) as { exp: number };
    if (decoded?.exp) {
      const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
      if (expiresIn > 0) {
        await this.redisService.addToTokenBlacklist(token, expiresIn);
      }
    }
  }

  /**
   * 从 Token 中提取 JTI
   */
  private extractJti(token: string): string | null {
    try {
      const decoded = this.jwtService.decode(token) as { jti?: string };
      return decoded?.jti || null;
    } catch {
      return null;
    }
  }

  /**
   * 计算 Token 哈希
   */
  private async hashToken(token: string): Promise<string> {
    // 简单哈希，实际生产环境可以使用 crypto
    return token.slice(-32);
  }
}
