/**
 * 额度 Redis Key 生成工具
 * 使用 Hash Tag 确保同一用户的所有 key 在同一个 slot（支持 Redis Cluster）
 */

/**
 * 获取 Hash Tag
 * 格式: {userId}
 * 用于确保同一用户的额度相关 key 都在同一个 Redis slot
 */
export function getHashTag(userId: string): string {
  return `{${userId}}`;
}

/**
 * 小周期额度 key
 * 格式: quota:{userId}:small:{targetType}:{targetId}
 */
export function getSmallQuotaKey(
  userId: string,
  targetType: string,
  targetId: string,
): string {
  return `quota:${getHashTag(userId)}:small:${targetType}:${targetId}`;
}

/**
 * 大周期额度 key
 * 格式: quota:{userId}:large:{targetType}:{targetId}
 */
export function getLargeQuotaKey(
  userId: string,
  targetType: string,
  targetId: string,
): string {
  return `quota:${getHashTag(userId)}:large:${targetType}:${targetId}`;
}

/**
 * 功能类别额度 key
 * 格式: quota:{userId}:category:{categoryId}
 */
export function getCategoryQuotaKey(
  userId: string,
  categoryId: string,
  cycleType: "small" | "large",
): string {
  return `quota:${getHashTag(userId)}:${cycleType}:category:${categoryId}`;
}

/**
 * 用户余额 key
 * 格式: balance:{userId}
 */
export function getBalanceKey(userId: string): string {
  return `balance:${getHashTag(userId)}`;
}

/**
 * 扣减分布式锁 key
 * 格式: deduct_lock:{userId}
 */
export function getDeductLockKey(userId: string): string {
  return `deduct_lock:${getHashTag(userId)}`;
}

/**
 * 周期信息 key
 * 格式: quota_cycle:{userId}
 */
export function getQuotaCycleKey(userId: string): string {
  return `quota_cycle:${getHashTag(userId)}`;
}

/**
 * 幂等键 key
 * 格式: idempotency:{idempotencyKey}
 */
export function getIdempotencyKey(idempotencyKey: string): string {
  return `idempotency:${idempotencyKey}`;
}

/**
 * 获取所有额度相关的 keys（用于 Lua 脚本）
 */
export function getQuotaKeys(
  userId: string,
  modelId: string,
  categoryId: string,
): {
  smallModel: string;
  largeModel: string;
  smallCategory: string;
  largeCategory: string;
  lock: string;
} {
  return {
    smallModel: getSmallQuotaKey(userId, "model", modelId),
    largeModel: getLargeQuotaKey(userId, "model", modelId),
    smallCategory: getCategoryQuotaKey(userId, categoryId, "small"),
    largeCategory: getCategoryQuotaKey(userId, categoryId, "large"),
    lock: getDeductLockKey(userId),
  };
}
