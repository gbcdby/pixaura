import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { UserService } from "../../user/user.service";
import { isSuperAdmin } from "@pixaura/shared-types";

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private userService: UserService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException("未登录");
    }

    const userId = user.sub || user.userId;
    const userDetail = await this.userService.findById(userId);
    if (!userDetail) {
      throw new ForbiddenException("用户不存在");
    }

    if (!isSuperAdmin(userDetail.perms)) {
      throw new ForbiddenException("无权访问，需要超级管理员权限");
    }

    return true;
  }
}
