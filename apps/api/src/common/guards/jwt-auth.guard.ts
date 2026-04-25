import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "../jwt/jwt.service";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // 从 Cookie 获取 Token
    let token = request.cookies?.accessToken;

    // 如果没有 Cookie，尝试从 Authorization Header 获取
    if (!token) {
      const authHeader = request.headers?.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      throw new UnauthorizedException("未登录");
    }

    try {
      const payload = await this.jwtService.verifyAccessToken(token);
      // 将 JWT payload 转换为统一的 user 对象格式
      request.user = {
        userId: payload.sub,
        sub: payload.sub, // 兼容使用 sub 的代码
        username: payload.username,
        type: payload.type,
      };
      return true;
    } catch (error) {
      // Token 无效或过期，尝试清除 Cookie
      // 使用与设置时相同的选项清除 cookie
      const isProd = process.env.APP_ENV === "production";
      response.clearCookie("accessToken", {
        httpOnly: false,
        secure: isProd,
        sameSite: "lax",
        path: "/",
      });
      response.clearCookie("refreshToken", {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        path: "/",
      });
      throw new UnauthorizedException("登录已过期，请重新登录");
    }
  }
}
