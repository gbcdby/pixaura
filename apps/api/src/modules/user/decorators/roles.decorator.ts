import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "roles";

/**
 * 角色装饰器
 * 用于标记只有特定角色才能访问的路由
 * @param roles 允许的角色列表
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
