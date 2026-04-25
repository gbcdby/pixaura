import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { FastifyRequest } from "fastify";
import { UserService } from "./user.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import {
  RateLimitGuard,
  RateLimit,
} from "../../common/guards/rate-limit.guard";
import {
  UpdateUserSchema,
  ChangePasswordSchema,
  ChangePhoneSchema,
  VerifyOldPhoneSchema,
  SendUpdatePhoneCodeSchema,
  SendChangeEmailCodeSchema,
  ChangeEmailSchema,
  UpdateUserDefaultModelsSchema,
  ErrorCodes,
} from "@pixaura/shared-types";
import type {
  UpdateUserDto,
  ChangePasswordDto,
  ChangePhoneDto,
  VerifyOldPhoneDto,
  SendUpdatePhoneCodeDto,
  SendChangeEmailCodeDto,
  ChangeEmailDto,
  UpdateUserDefaultModelsDto,
} from "@pixaura/shared-types";

@ApiTags("用户")
@Controller("user")
@UseGuards(JwtAuthGuard, RateLimitGuard)
@ApiBearerAuth()
export class UserController {
  constructor(private userService: UserService) {}

  @Get("profile")
  @ApiOperation({ summary: "获取用户信息" })
  async getProfile(@Req() req: FastifyRequest & { user: { sub: string } }) {
    const user = await this.userService.findById(req.user.sub);
    if (!user) {
      throw new NotFoundException({
        code: ErrorCodes.USER_NOT_FOUND.code,
        message: ErrorCodes.USER_NOT_FOUND.message,
      });
    }
    return this.userService.toResponseDto(user);
  }

  @Put("profile")
  @ApiOperation({ summary: "更新用户信息" })
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @Req() req: FastifyRequest & { user: { sub: string } },
    @Body() data: UpdateUserDto,
  ) {
    const result = UpdateUserSchema.safeParse(data);
    if (!result.success) {
      throw new BadRequestException({
        code: ErrorCodes.INVALID_PARAMS.code,
        message: "参数错误",
        errors: result.error.errors,
      });
    }
    const user = await this.userService.updateProfile(req.user.sub, data);
    return this.userService.toResponseDto(user);
  }

  @Put("password")
  @ApiOperation({ summary: "修改密码" })
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Req() req: FastifyRequest & { user: { sub: string } },
    @Body() data: ChangePasswordDto,
  ) {
    const result = ChangePasswordSchema.safeParse(data);
    if (!result.success) {
      throw new BadRequestException({
        code: ErrorCodes.INVALID_PARAMS.code,
        message: "参数错误",
        errors: result.error.errors,
      });
    }
    await this.userService.changePassword(
      req.user.sub,
      data.oldPassword,
      data.newPassword,
    );
    return { message: "密码修改成功" };
  }

  @Post("send-update-phone-code")
  @ApiOperation({ summary: "发送修改手机号验证码" })
  @HttpCode(HttpStatus.OK)
  @RateLimit("send-phone-code", 3, 60)
  async sendUpdatePhoneCode(
    @Req() req: FastifyRequest & { user: { sub: string } },
    @Body() data: SendUpdatePhoneCodeDto,
  ) {
    const result = SendUpdatePhoneCodeSchema.safeParse(data);
    if (!result.success) {
      throw new BadRequestException({
        code: ErrorCodes.INVALID_PARAMS.code,
        message: "参数错误",
        errors: result.error.errors,
      });
    }
    const user = await this.userService.findById(req.user.sub);
    if (!user) {
      throw new NotFoundException({
        code: ErrorCodes.USER_NOT_FOUND.code,
        message: ErrorCodes.USER_NOT_FOUND.message,
      });
    }
    if (data.type === "verify_old") {
      await this.userService.sendSmsCode(user.phone, "change_phone");
    } else if (data.type === "verify_new" && data.phone) {
      await this.userService.sendSmsCode(data.phone, "change_phone");
    }
    return { message: "验证码已发送" };
  }

  @Post("phone/verify-old")
  @ApiOperation({ summary: "验证原手机号" })
  @HttpCode(HttpStatus.OK)
  async verifyOldPhone(
    @Req() req: FastifyRequest & { user: { sub: string } },
    @Body() data: VerifyOldPhoneDto,
  ) {
    const result = VerifyOldPhoneSchema.safeParse(data);
    if (!result.success) {
      throw new BadRequestException({
        code: ErrorCodes.INVALID_PARAMS.code,
        message: "参数错误",
        errors: result.error.errors,
      });
    }
    const user = await this.userService.findById(req.user.sub);
    if (!user) {
      throw new NotFoundException({
        code: ErrorCodes.USER_NOT_FOUND.code,
        message: ErrorCodes.USER_NOT_FOUND.message,
      });
    }
    await this.userService.verifySmsCode(user.phone, "change_phone", data.code);
    const verifyToken = await this.userService.generatePhoneVerifyToken(
      req.user.sub,
    );
    return { verifyToken };
  }

  @Put("phone")
  @ApiOperation({ summary: "修改手机号" })
  @HttpCode(HttpStatus.OK)
  async changePhone(
    @Req() req: FastifyRequest & { user: { sub: string } },
    @Body() data: ChangePhoneDto,
  ) {
    const result = ChangePhoneSchema.safeParse(data);
    if (!result.success) {
      throw new BadRequestException({
        code: ErrorCodes.INVALID_PARAMS.code,
        message: "参数错误",
        errors: result.error.errors,
      });
    }
    await this.userService.changePhone(
      req.user.sub,
      data.newPhone,
      data.newPhoneCode,
      data.verifyToken,
    );
    return { message: "手机号修改成功" };
  }

  @Post("send-change-email-code")
  @ApiOperation({ summary: "发送修改邮箱验证码" })
  @HttpCode(HttpStatus.OK)
  @RateLimit("send-email-code", 3, 60)
  async sendChangeEmailCode(
    @Req() req: FastifyRequest & { user: { sub: string } },
    @Body() data: SendChangeEmailCodeDto,
  ) {
    const result = SendChangeEmailCodeSchema.safeParse(data);
    if (!result.success) {
      throw new BadRequestException({
        code: ErrorCodes.INVALID_PARAMS.code,
        message: "参数错误",
        errors: result.error.errors,
      });
    }
    await this.userService.sendChangeEmailCode(req.user.sub, data.newEmail);
    return { message: "验证码已发送到新邮箱" };
  }

  @Put("email")
  @ApiOperation({ summary: "修改邮箱" })
  @HttpCode(HttpStatus.OK)
  async changeEmail(
    @Req() req: FastifyRequest & { user: { sub: string } },
    @Body() data: ChangeEmailDto,
  ) {
    const result = ChangeEmailSchema.safeParse(data);
    if (!result.success) {
      throw new BadRequestException({
        code: ErrorCodes.INVALID_PARAMS.code,
        message: "参数错误",
        errors: result.error.errors,
      });
    }
    await this.userService.changeEmail(req.user.sub, data.newEmail, data.code);
    return { message: "邮箱修改成功" };
  }

  @Post("avatar")
  @ApiOperation({ summary: "上传头像" })
  @HttpCode(HttpStatus.OK)
  @RateLimit("avatar-upload", 3, 86400)
  async uploadAvatar(@Req() req: FastifyRequest & { user: { sub: string } }) {
    const file = await req.file();
    if (!file) {
      throw new BadRequestException({
        code: ErrorCodes.INVALID_PARAMS.code,
        message: "请选择要上传的文件",
      });
    }
    const buffer = await file.toBuffer();
    const url = await this.userService.uploadAvatar(
      req.user.sub,
      buffer,
      file.filename,
    );
    return { avatarUrl: url };
  }

  @Get("default-models")
  @ApiOperation({ summary: "获取用户默认模型配置" })
  async getDefaultModels(
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    const configs = await this.userService.getDefaultModels(req.user.sub);
    return { configs };
  }

  @Put("default-models")
  @ApiOperation({ summary: "更新用户默认模型配置" })
  @HttpCode(HttpStatus.OK)
  async updateDefaultModels(
    @Req() req: FastifyRequest & { user: { sub: string } },
    @Body() data: UpdateUserDefaultModelsDto,
  ) {
    const result = UpdateUserDefaultModelsSchema.safeParse(data);
    if (!result.success) {
      throw new BadRequestException({
        code: ErrorCodes.INVALID_PARAMS.code,
        message: "参数错误",
        errors: result.error.errors,
      });
    }
    const updatedConfigs = await this.userService.updateDefaultModels(
      req.user.sub,
      data.configs,
    );
    return { configs: updatedConfigs };
  }
}
