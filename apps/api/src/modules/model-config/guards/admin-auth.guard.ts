import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { UserService } from "../../user/user.service";
import { isAdmin } from "@pixaura/shared-types";

@Injectable()
export class AdminAuthGuard implements CanActivate {
  private readonly logger = new Logger(AdminAuthGuard.name);

  constructor(private userService: UserService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    this.logger.debug(
      `AdminAuthGuard 执行 - req.user: ${JSON.stringify(user)}`,
    );

    if (!user) {
      this.logger.warn("AdminAuthGuard 拒绝 - 未登录");
      throw new ForbiddenException("未登录");
    }

    const userId = user.sub || user.userId;
    const userDetail = await this.userService.findById(userId);
    this.logger.debug(
      `AdminAuthGuard 查询用户 - userId: ${userId}, perms: ${userDetail?.perms}`,
    );

    if (!userDetail) {
      this.logger.warn(`AdminAuthGuard 拒绝 - 用户不存在: ${userId}`);
      throw new ForbiddenException("用户不存在");
    }

    if (!isAdmin(userDetail.perms)) {
      this.logger.warn(
        `AdminAuthGuard 拒绝 - 用户 ${userDetail.username} 无管理员权限 (perms: ${userDetail.perms})`,
      );
      throw new ForbiddenException("无权访问，需要管理员权限");
    }

    this.logger.debug(`AdminAuthGuard 通过 - 用户: ${userDetail.username}`);
    return true;
  }
}
