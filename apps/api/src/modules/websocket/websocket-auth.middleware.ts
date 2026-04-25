import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Socket } from "socket.io";
import {
  AuthenticatedSocket,
  WebSocketErrorCode,
  CONNECTION_CONFIG,
} from "./websocket.types";

/**
 * WebSocket 认证中间件
 * 处理 JWT Token 验证和连接认证
 */
@Injectable()
export class WebSocketAuthMiddleware {
  private readonly logger = new Logger(WebSocketAuthMiddleware.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * 验证客户端连接
   * @param client Socket 连接
   * @returns 验证结果
   */
  async validateClient(client: Socket): Promise<{
    success: boolean;
    userId?: string;
    tokenExpiresAt?: number;
    errorCode?: number;
    errorMessage?: string;
  }> {
    try {
      // 从 Cookie 中获取 accessToken
      const token = this.extractTokenFromCookie(client);

      if (!token) {
        this.logger.warn(`客户端 ${client.id} 未提供 Token`);
        return {
          success: false,
          errorCode: WebSocketErrorCode.TOKEN_EXPIRED,
          errorMessage: "未提供认证令牌",
        };
      }

      // 验证 Token
      const payload = await this.verifyToken(token);

      if (!payload) {
        this.logger.warn(`客户端 ${client.id} Token 验证失败`);
        return {
          success: false,
          errorCode: WebSocketErrorCode.TOKEN_EXPIRED,
          errorMessage: "认证令牌无效或已过期",
        };
      }

      const userId = payload.sub as string;
      const tokenExpiresAt = payload.exp as number;

      // 检查 Token 是否已过期
      const now = Math.floor(Date.now() / 1000);
      if (tokenExpiresAt && tokenExpiresAt < now) {
        this.logger.warn(`客户端 ${client.id} Token 已过期`);
        return {
          success: false,
          errorCode: WebSocketErrorCode.TOKEN_EXPIRED,
          errorMessage: "认证令牌已过期",
        };
      }

      // 检查 Token 是否即将过期（5分钟内）
      if (
        tokenExpiresAt &&
        tokenExpiresAt - now < CONNECTION_CONFIG.tokenExpiryThreshold / 1000
      ) {
        this.logger.debug(`客户端 ${client.id} Token 即将过期`);
        // 返回成功，但标记 Token 即将过期
        return {
          success: true,
          userId,
          tokenExpiresAt: tokenExpiresAt * 1000, // 转换为毫秒
        };
      }

      return {
        success: true,
        userId,
        tokenExpiresAt: tokenExpiresAt ? tokenExpiresAt * 1000 : undefined,
      };
    } catch (error) {
      this.logger.error("认证中间件错误");
      this.logger.debug("详细错误信息:", error);
      return {
        success: false,
        errorCode: WebSocketErrorCode.INTERNAL_ERROR,
        errorMessage: "认证过程发生错误",
      };
    }
  }

  /**
   * 从 Cookie 中提取 Token
   * @param client Socket 连接
   * @returns Token 字符串或 null
   */
  private extractTokenFromCookie(client: Socket): string | null {
    try {
      // 从 auth 对象中提取（优先，前端显式传递）
      const authToken = client.handshake.auth?.token as string;
      if (authToken) {
        // 支持 Bearer 前缀
        if (authToken.startsWith("Bearer ")) {
          return authToken.substring(7);
        }
        return authToken;
      }

      // 从 headers.cookie 中提取
      const cookieHeader = client.handshake.headers.cookie;
      if (cookieHeader) {
        const match = cookieHeader.match(/accessToken=([^;]+)/);
        if (match) {
          return decodeURIComponent(match[1]);
        }
      }

      // 从 handshake.query 中提取（备用方案）
      const queryToken = client.handshake.query.token as string;
      if (queryToken) {
        return queryToken;
      }

      return null;
    } catch (error) {
      this.logger.error("提取 Token 错误");
      this.logger.debug("详细错误信息:", error);
      return null;
    }
  }

  /**
   * 验证 JWT Token
   * @param token JWT Token
   * @returns 解码后的 payload 或 null
   */
  private async verifyToken(
    token: string,
  ): Promise<Record<string, unknown> | null> {
    try {
      const secret = this.configService.get<string>("JWT_SECRET");
      const payload = await this.jwtService.verifyAsync(token, {
        secret: secret || "your-jwt-secret",
      });
      return payload;
    } catch (error) {
      this.logger.debug(`Token 验证失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 检查 Token 是否需要刷新
   * @param tokenExpiresAt Token 过期时间（毫秒）
   * @returns 是否需要刷新
   */
  shouldRefreshToken(tokenExpiresAt?: number): boolean {
    if (!tokenExpiresAt) return false;
    const now = Date.now();
    return tokenExpiresAt - now < CONNECTION_CONFIG.tokenExpiryThreshold;
  }

  /**
   * 检查 Token 是否已过期
   * @param tokenExpiresAt Token 过期时间（毫秒）
   * @returns 是否已过期
   */
  isTokenExpired(tokenExpiresAt?: number): boolean {
    if (!tokenExpiresAt) return false;
    return Date.now() > tokenExpiresAt;
  }
}
