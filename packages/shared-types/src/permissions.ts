/**
 * 权限定义
 * 使用位运算存储权限
 */

// 权限位定义
export const Permissions = {
  // 无特殊权限（普通用户）
  NONE: 0,

  // 后台管理权限 - 可访问后台管理界面
  ADMIN_PANEL: 1 << 0, // 1

  // 管理员管理权限 - 可管理其他管理员
  ADMIN_MANAGEMENT: 1 << 1, // 2
} as const;

export type Permission = (typeof Permissions)[keyof typeof Permissions];

/**
 * 角色定义
 */
export const Roles = {
  // 普通用户
  USER: Permissions.NONE,

  // 管理员
  ADMIN: Permissions.ADMIN_PANEL,

  // 超级管理员
  SUPER_ADMIN: Permissions.ADMIN_PANEL | Permissions.ADMIN_MANAGEMENT,
} as const;

export type Role = keyof typeof Roles;

/**
 * 订阅等级
 */
export const SubscriptionTier = {
  FREE: "free",
  BASIC: "basic",
  PRO: "pro",
} as const;

export type SubscriptionTier =
  (typeof SubscriptionTier)[keyof typeof SubscriptionTier];

/**
 * 检查是否拥有指定权限
 * @param perms 用户权限值
 * @param required 需要的权限
 */
export function hasPermission(perms: number, required: Permission): boolean {
  return (perms & required) !== 0;
}

/**
 * 检查是否拥有任一指定权限
 * @param perms 用户权限值
 * @param requiredList 需要的权限列表
 */
export function hasAnyPermission(
  perms: number,
  requiredList: Permission[],
): boolean {
  return requiredList.some((required) => hasPermission(perms, required));
}

/**
 * 检查是否拥有所有指定权限
 * @param perms 用户权限值
 * @param requiredList 需要的权限列表
 */
export function hasAllPermissions(
  perms: number,
  requiredList: Permission[],
): boolean {
  return requiredList.every((required) => hasPermission(perms, required));
}

/**
 * 检查是否为管理员
 * @param perms 用户权限值
 */
export function isAdmin(perms: number): boolean {
  return hasPermission(perms, Permissions.ADMIN_PANEL);
}

/**
 * 检查是否为超级管理员
 * @param perms 用户权限值
 */
export function isSuperAdmin(perms: number): boolean {
  return hasAllPermissions(perms, [
    Permissions.ADMIN_PANEL,
    Permissions.ADMIN_MANAGEMENT,
  ]);
}
