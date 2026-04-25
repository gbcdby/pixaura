/**
 * 额度周期计算工具
 *
 * 周期起点: 用户订阅生效时间（subscription_started_at）
 *
 * 周期编号计算:
 * - 小周期编号: ceil((now - subscription_started_at) / 4h)
 * - 大周期编号: ceil((now - subscription_started_at) / 7d)
 */

// 小周期时长：4小时（毫秒）
export const SMALL_CYCLE_MS = 4 * 60 * 60 * 1000;

// 大周期时长：7天（毫秒）
export const LARGE_CYCLE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 计算小周期编号
 * @param subscriptionStartedAt 订阅生效时间
 * @param now 当前时间（默认现在）
 * @returns 小周期编号（从1开始）
 */
export function calculateSmallCycleNumber(
  subscriptionStartedAt: Date,
  now: Date = new Date(),
): number {
  const diffMs = now.getTime() - subscriptionStartedAt.getTime();

  // 使用 ceil 确保边界时刻正确归属
  // 例如：刚好4小时时，ceil(1) = 1，属于第1周期
  // 但下一秒 ceil(1.0001) = 2，属于第2周期
  const cycleNumber = Math.ceil(diffMs / SMALL_CYCLE_MS);

  // 最小为1（周期从1开始）
  return Math.max(1, cycleNumber);
}

/**
 * 计算大周期编号
 * @param subscriptionStartedAt 订阅生效时间
 * @param now 当前时间（默认现在）
 * @returns 大周期编号（从1开始）
 */
export function calculateLargeCycleNumber(
  subscriptionStartedAt: Date,
  now: Date = new Date(),
): number {
  const diffMs = now.getTime() - subscriptionStartedAt.getTime();
  const cycleNumber = Math.ceil(diffMs / LARGE_CYCLE_MS);
  return Math.max(1, cycleNumber);
}

/**
 * 计算当前小周期的结束时间
 * @param subscriptionStartedAt 订阅生效时间
 * @param now 当前时间（默认现在）
 * @returns 小周期结束时间
 */
export function calculateSmallCycleEndAt(
  subscriptionStartedAt: Date,
  now: Date = new Date(),
): Date {
  const cycleNumber = calculateSmallCycleNumber(subscriptionStartedAt, now);
  const endTimeMs =
    subscriptionStartedAt.getTime() + cycleNumber * SMALL_CYCLE_MS;
  return new Date(endTimeMs);
}

/**
 * 计算当前大周期的结束时间
 * @param subscriptionStartedAt 订阅生效时间
 * @param now 当前时间（默认现在）
 * @returns 大周期结束时间
 */
export function calculateLargeCycleEndAt(
  subscriptionStartedAt: Date,
  now: Date = new Date(),
): Date {
  const cycleNumber = calculateLargeCycleNumber(subscriptionStartedAt, now);
  const endTimeMs =
    subscriptionStartedAt.getTime() + cycleNumber * LARGE_CYCLE_MS;
  return new Date(endTimeMs);
}

/**
 * 计算下一小周期的开始时间
 * @param subscriptionStartedAt 订阅生效时间
 * @param now 当前时间（默认现在）
 * @returns 下一小周期开始时间
 */
export function calculateNextSmallCycleStartAt(
  subscriptionStartedAt: Date,
  now: Date = new Date(),
): Date {
  return calculateSmallCycleEndAt(subscriptionStartedAt, now);
}

/**
 * 计算下一 大周期的开始时间
 * @param subscriptionStartedAt 订阅生效时间
 * @param now 当前时间（默认现在）
 * @returns 下一 大周期开始时间
 */
export function calculateNextLargeCycleStartAt(
  subscriptionStartedAt: Date,
  now: Date = new Date(),
): Date {
  return calculateLargeCycleEndAt(subscriptionStartedAt, now);
}

/**
 * 计算小周期剩余时间（毫秒）
 * @param subscriptionStartedAt 订阅生效时间
 * @param now 当前时间（默认现在）
 * @returns 剩余毫秒数
 */
export function calculateSmallCycleRemainingMs(
  subscriptionStartedAt: Date,
  now: Date = new Date(),
): number {
  const endAt = calculateSmallCycleEndAt(subscriptionStartedAt, now);
  return Math.max(0, endAt.getTime() - now.getTime());
}

/**
 * 计算大周期剩余时间（毫秒）
 * @param subscriptionStartedAt 订阅生效时间
 * @param now 当前时间（默认现在）
 * @returns 剩余毫秒数
 */
export function calculateLargeCycleRemainingMs(
  subscriptionStartedAt: Date,
  now: Date = new Date(),
): number {
  const endAt = calculateLargeCycleEndAt(subscriptionStartedAt, now);
  return Math.max(0, endAt.getTime() - now.getTime());
}

/**
 * 周期信息接口
 */
export interface CycleInfo {
  smallCycleNumber: number;
  largeCycleNumber: number;
  smallCycleEndAt: Date;
  largeCycleEndAt: Date;
  smallCycleRemainingMs: number;
  largeCycleRemainingMs: number;
}

/**
 * 获取完整的周期信息
 * @param subscriptionStartedAt 订阅生效时间
 * @param now 当前时间（默认现在）
 * @returns 周期信息
 */
export function getCycleInfo(
  subscriptionStartedAt: Date,
  now: Date = new Date(),
): CycleInfo {
  return {
    smallCycleNumber: calculateSmallCycleNumber(subscriptionStartedAt, now),
    largeCycleNumber: calculateLargeCycleNumber(subscriptionStartedAt, now),
    smallCycleEndAt: calculateSmallCycleEndAt(subscriptionStartedAt, now),
    largeCycleEndAt: calculateLargeCycleEndAt(subscriptionStartedAt, now),
    smallCycleRemainingMs: calculateSmallCycleRemainingMs(
      subscriptionStartedAt,
      now,
    ),
    largeCycleRemainingMs: calculateLargeCycleRemainingMs(
      subscriptionStartedAt,
      now,
    ),
  };
}

/**
 * 检查是否处于新周期（需要重置额度）
 * @param lastCycleNumber 上次记录的周期编号
 * @param currentCycleNumber 当前周期编号
 * @returns 是否需要重置
 */
export function isNewCycle(
  lastCycleNumber: number,
  currentCycleNumber: number,
): boolean {
  return currentCycleNumber > lastCycleNumber;
}

/**
 * 计算周期开始时间
 * @param subscriptionStartedAt 订阅生效时间
 * @param cycleNumber 周期编号
 * @param cycleMs 周期时长（毫秒）
 * @returns 周期开始时间
 */
export function calculateCycleStartAt(
  subscriptionStartedAt: Date,
  cycleNumber: number,
  cycleMs: number,
): Date {
  return new Date(
    subscriptionStartedAt.getTime() + (cycleNumber - 1) * cycleMs,
  );
}

/**
 * 格式化周期信息（用于日志）
 * @param cycleInfo 周期信息
 * @returns 格式化字符串
 */
export function formatCycleInfo(cycleInfo: CycleInfo): string {
  const formatMs = (ms: number): string => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}小时${minutes}分钟`;
  };

  return (
    `小周期: #${cycleInfo.smallCycleNumber} (剩余${formatMs(cycleInfo.smallCycleRemainingMs)}), ` +
    `大周期: #${cycleInfo.largeCycleNumber} (剩余${formatMs(cycleInfo.largeCycleRemainingMs)})`
  );
}
