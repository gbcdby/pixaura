import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Query,
  Res,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBody, ApiQuery } from "@nestjs/swagger";
import { FastifyReply, FastifyRequest } from "fastify";
import { UserService } from "./user.service";
import { LoginLogService } from "./services/login-log.service";
import { JwtService } from "../../common/jwt/jwt.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import {
  RateLimitGuard,
  RateLimit,
} from "../../common/guards/rate-limit.guard";
import {
  LoginSchema,
  PhoneLoginSchema,
  RegisterSchema,
  ResetPasswordSchema,
} from "@pixaura/shared-types";
import { ErrorCodes } from "@pixaura/shared-types";
import type {
  LoginDto,
  PhoneLoginDto,
  RegisterDto,
  ResetPasswordDto,
} from "@pixaura/shared-types";

@ApiTags("认证")
@Controller("auth")
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private loginLogService: LoginLogService,
  ) {}

  /**
   * 获取设备类型
   */
  private getDeviceType(userAgent: string): string {
    if (!userAgent) return "unknown";
    if (userAgent.includes("Mobile")) return "mobile";
    if (userAgent.includes("Tablet")) return "tablet";
    return "desktop";
  }

  /**
   * 设置 Token Cookies
   */
  private setTokenCookies(
    res: FastifyReply,
    tokens: {
      accessToken: string;
      refreshToken: string;
      accessTokenExpires: number;
      refreshTokenExpires: number;
    },
    remember = false,
  ): void {
    const isProd = process.env.APP_ENV === "production";

    // Access Token - 非 httponly，前端可读取
    // 记住我：7天，否则：2小时
    const accessTokenMaxAge = remember
      ? 7 * 24 * 60 * 60 * 1000 // 7天
      : 2 * 60 * 60 * 1000; // 2小时

    res.setCookie("accessToken", tokens.accessToken, {
      httpOnly: false,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: accessTokenMaxAge,
    });

    // Refresh Token - httponly，增强安全性
    // 记住我：30天，否则：7天
    const refreshTokenMaxAge = remember
      ? 30 * 24 * 60 * 60 * 1000 // 30天
      : 7 * 24 * 60 * 60 * 1000; // 7天

    res.setCookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: refreshTokenMaxAge,
    });
  }

  /**
   * 清除 Token Cookies
   */
  private clearTokenCookies(res: FastifyReply): void {
    const isProd = process.env.APP_ENV === "production";

    // 清除 cookie 时需要使用与设置时相同的选项
    res.clearCookie("accessToken", {
      httpOnly: false,
      secure: isProd,
      sameSite: "lax",
      path: "/",
    });
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
    });
  }

  @Post("register")
  @ApiOperation({ summary: "用户注册" })
  @RateLimit("register", 5, 60)
  async register(
    @Body() data: RegisterDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    // 验证参数
    const result = RegisterSchema.safeParse(data);
    if (!result.success) {
      throw new BadRequestException({
        code: ErrorCodes.INVALID_PARAMS.code,
        message: "参数错误",
        errors: result.error.errors,
      });
    }

    const user = await this.userService.register(
      data.phone,
      data.username,
      data.password,
      data.code,
      data.email,
    );

    // 如果用户填写了邮箱，发送验证邮件
    if (data.email) {
      try {
        await this.userService.sendEmailVerification(user.id, data.email);
      } catch {
        // 邮件发送失败不影响注册流程，仅记录（可选）
      }
    }

    // 生成 Token
    const tokens = await this.jwtService.generateTokenPair(
      user.id,
      user.username,
      this.getDeviceType(req.headers["user-agent"] || ""),
      req.ip || "",
    );

    // 设置 Cookie
    this.setTokenCookies(res, tokens);

    // 记录登录日志
    await this.loginLogService.create({
      userId: user.id,
      ip: req.ip || "",
      userAgent: req.headers["user-agent"] || "",
      deviceType: this.getDeviceType(req.headers["user-agent"] || ""),
      loginType: "register",
      status: "success",
    });

    return {
      user: this.userService.toResponseDto(user),
      accessToken: tokens.accessToken,
      accessTokenExpires: tokens.accessTokenExpires,
    };
  }

  @Post("login")
  @ApiOperation({ summary: "账号密码登录" })
  @HttpCode(HttpStatus.OK)
  @RateLimit("login", 10, 60)
  async login(
    @Body() data: LoginDto & { remember?: boolean },
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    // 验证参数
    const result = LoginSchema.safeParse(data);
    if (!result.success) {
      throw new BadRequestException({
        code: ErrorCodes.INVALID_PARAMS.code,
        message: "参数错误",
        errors: result.error.errors,
      });
    }

    const user = await this.userService.login(data.username, data.password);

    // 生成 Token
    const tokens = await this.jwtService.generateTokenPair(
      user.id,
      user.username,
      this.getDeviceType(req.headers["user-agent"] || ""),
      req.ip || "",
      data.remember,
    );

    // 设置 Cookie
    this.setTokenCookies(res, tokens, data.remember);

    // 记录登录日志
    await this.loginLogService.create({
      userId: user.id,
      ip: req.ip || "",
      userAgent: req.headers["user-agent"] || "",
      deviceType: this.getDeviceType(req.headers["user-agent"] || ""),
      loginType: "password",
      status: "success",
    });

    return {
      user: this.userService.toResponseDto(user),
      accessToken: tokens.accessToken,
      accessTokenExpires: tokens.accessTokenExpires,
      remember: data.remember,
    };
  }

  @Post("sms-login")
  @ApiOperation({ summary: "手机号验证码登录" })
  @HttpCode(HttpStatus.OK)
  @RateLimit("sms-login", 10, 60)
  async smsLogin(
    @Body() data: PhoneLoginDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    // 验证参数
    const result = PhoneLoginSchema.safeParse(data);
    if (!result.success) {
      throw new BadRequestException({
        code: ErrorCodes.INVALID_PARAMS.code,
        message: "参数错误",
        errors: result.error.errors,
      });
    }

    const user = await this.userService.loginByPhone(data.phone, data.code);

    // 生成 Token
    const tokens = await this.jwtService.generateTokenPair(
      user.id,
      user.username,
      this.getDeviceType(req.headers["user-agent"] || ""),
      req.ip || "",
    );

    // 设置 Cookie
    this.setTokenCookies(res, tokens);

    // 记录登录日志
    await this.loginLogService.create({
      userId: user.id,
      ip: req.ip || "",
      userAgent: req.headers["user-agent"] || "",
      deviceType: this.getDeviceType(req.headers["user-agent"] || ""),
      loginType: "sms",
      status: "success",
    });

    return {
      user: this.userService.toResponseDto(user),
      accessToken: tokens.accessToken,
      accessTokenExpires: tokens.accessTokenExpires,
    };
  }

  @Post("send-login-code")
  @ApiOperation({ summary: "发送登录验证码" })
  @HttpCode(HttpStatus.OK)
  @RateLimit("send-login-code", 3, 60)
  async sendLoginCode(@Body() data: { phone: string }) {
    if (!data.phone || !/^1[3-9]\d{9}$/.test(data.phone)) {
      throw new BadRequestException({
        code: ErrorCodes.INVALID_PHONE_FORMAT.code,
        message: ErrorCodes.INVALID_PHONE_FORMAT.message,
      });
    }

    // 检查用户是否存在
    const user = await this.userService.findByPhone(data.phone);
    if (!user) {
      throw new BadRequestException({
        code: ErrorCodes.USER_NOT_FOUND.code,
        message: "该手机号未注册，请先注册",
      });
    }

    await this.userService.sendSmsCode(data.phone, "login");

    return { message: "验证码已发送" };
  }

  @Post("send-register-code")
  @ApiOperation({ summary: "发送注册验证码" })
  @HttpCode(HttpStatus.OK)
  @RateLimit("send-register-code", 3, 60)
  async sendRegisterCode(@Body() data: { phone: string }) {
    if (!data.phone || !/^1[3-9]\d{9}$/.test(data.phone)) {
      throw new BadRequestException({
        code: ErrorCodes.INVALID_PHONE_FORMAT.code,
        message: ErrorCodes.INVALID_PHONE_FORMAT.message,
      });
    }

    // 检查手机号是否已被注册
    const existingUser = await this.userService.findByPhone(data.phone);
    if (existingUser) {
      throw new BadRequestException({
        code: ErrorCodes.PHONE_ALREADY_EXISTS.code,
        message: "该手机号已注册，请直接登录",
      });
    }

    await this.userService.sendSmsCode(data.phone, "register");

    return { message: "验证码已发送" };
  }

  @Post("send-reset-password-code")
  @ApiOperation({ summary: "发送重置密码验证码" })
  @HttpCode(HttpStatus.OK)
  @RateLimit("send-reset-password-code", 3, 60)
  async sendResetPasswordCode(@Body() data: { phone: string }) {
    if (!data.phone || !/^1[3-9]\d{9}$/.test(data.phone)) {
      throw new BadRequestException({
        code: ErrorCodes.INVALID_PHONE_FORMAT.code,
        message: ErrorCodes.INVALID_PHONE_FORMAT.message,
      });
    }

    // 检查用户是否存在
    const user = await this.userService.findByPhone(data.phone);
    if (!user) {
      throw new BadRequestException({
        code: ErrorCodes.USER_NOT_FOUND.code,
        message: "该手机号未注册，请先注册",
      });
    }

    await this.userService.sendSmsCode(data.phone, "reset_password");

    return { message: "验证码已发送" };
  }

  @Put("password")
  @ApiOperation({ summary: "重置密码" })
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() data: ResetPasswordDto) {
    // 验证参数
    const result = ResetPasswordSchema.safeParse(data);
    if (!result.success) {
      throw new BadRequestException({
        code: ErrorCodes.INVALID_PARAMS.code,
        message: "参数错误",
        errors: result.error.errors,
      });
    }

    await this.userService.resetPassword(
      data.phone,
      data.code,
      data.newPassword,
    );

    return { message: "密码重置成功" };
  }

  @Post("refresh")
  @ApiOperation({ summary: "刷新 Token" })
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException({
        code: ErrorCodes.UNAUTHORIZED.code,
        message: "未登录",
      });
    }

    const tokens = await this.jwtService.refreshTokens(
      refreshToken,
      this.getDeviceType(req.headers["user-agent"] || ""),
      req.ip || "",
    );

    if (!tokens) {
      this.clearTokenCookies(res);
      throw new UnauthorizedException({
        code: ErrorCodes.REFRESH_TOKEN_EXPIRED.code,
        message: ErrorCodes.REFRESH_TOKEN_EXPIRED.message,
      });
    }

    // 设置新 Cookie
    this.setTokenCookies(res, tokens);

    return {
      accessToken: tokens.accessToken,
      accessTokenExpires: tokens.accessTokenExpires,
    };
  }

  @Post("logout")
  @ApiOperation({ summary: "退出登录" })
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const accessToken = req.cookies?.accessToken;

    // 无论 token 是否有效，都尝试撤销并清除 cookie
    if (accessToken) {
      try {
        await this.jwtService.revokeToken(accessToken);
      } catch {
        // Token 无效或已过期，忽略错误继续清除 cookie
      }
    }

    // 始终清除 cookie
    this.clearTokenCookies(res);

    return { message: "退出成功" };
  }

  @Post("send-email-verify")
  @ApiOperation({ summary: "发送邮箱验证邮件" })
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async sendEmailVerify(
    @Req() req: FastifyRequest & { user: { sub: string } },
    @Body() data: { email: string },
  ) {
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      throw new BadRequestException({
        code: ErrorCodes.INVALID_EMAIL_FORMAT.code,
        message: ErrorCodes.INVALID_EMAIL_FORMAT.message,
      });
    }

    await this.userService.sendEmailVerification(req.user.sub, data.email);

    return { message: "验证邮件已发送" };
  }

  @Get("verify-email")
  @ApiOperation({ summary: "邮箱验证页面" })
  @ApiQuery({ name: "token", description: "验证令牌" })
  async verifyEmailPage(@Query("token") token: string) {
    // 返回 HTML 验证页面
    return {
      type: "html",
      content: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>邮箱验证</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .container { text-align: center; }
            button { padding: 12px 24px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; }
            button:hover { background: #45a049; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>邮箱验证</h1>
            <p>点击下方按钮完成邮箱验证</p>
            <form action="/api/auth/verify-email" method="POST">
              <input type="hidden" name="token" value="${token}">
              <button type="submit">验证邮箱</button>
            </form>
          </div>
        </body>
        </html>
      `,
    };
  }

  @Post("verify-email")
  @ApiOperation({ summary: "验证邮箱" })
  @ApiBody({ schema: { properties: { token: { type: "string" } } } })
  async verifyEmail(@Body("token") token: string) {
    await this.userService.verifyEmail(token);

    return {
      type: "html",
      content: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>验证成功</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; text-align: center; }
            .success { color: #4CAF50; }
          </style>
        </head>
        <body>
          <h1 class="success">邮箱验证成功！</h1>
          <p>请返回登录页面继续操作。</p>
          <script>setTimeout(() => window.close(), 3000);</script>
        </body>
        </html>
      `,
    };
  }
}
