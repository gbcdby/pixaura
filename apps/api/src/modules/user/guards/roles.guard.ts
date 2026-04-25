import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { UserService } from "../user.service";
import { Roles, hasPermission, Permissions } from "@pixaura/shared-types";

/**
 * 角色守卫
 * 检查用户是否具有访问路由所需的角色
 * 基于用户的 perms 字段进行权限检查
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private userService: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 获取路由需要的角色
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 如果没有设置角色要求，允许访问
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // 获取请求中的用户信息（来自 JWT）
    const request = context.switchToHttp().getRequest();
    const { user } = request;

    // 如果没有用户信息，拒绝访问
    if (!user || !user.sub) {
      return false;
    }

    // 从数据库查询用户权限
    const userEntity = await this.userService.findById(user.sub);
    if (!userEntity) {
      return false;
    }

    const userPerms = userEntity.perms;

    // 检查用户是否具有所需角色权限
    return requiredRoles.some((role) => {
      const rolePerms = Roles[role.toUpperCase() as keyof typeof Roles];
      if (rolePerms === undefined) {
        return false;
      }
      // 检查用户是否拥有该角色所需的权限
      // 例如：admin 需要 ADMIN_PANEL (1)，用户 perms=3 包含 1，所以通过
      return (userPerms & rolePerms) === rolePerms;
    });
  }
}
