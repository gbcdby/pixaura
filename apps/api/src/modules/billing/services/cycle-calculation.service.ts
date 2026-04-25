import { Injectable } from "@nestjs/common";
import {
  getCycleInfo,
  calculateSmallCycleNumber,
  calculateLargeCycleNumber,
  calculateSmallCycleEndAt,
  calculateLargeCycleEndAt,
  calculateSmallCycleRemainingMs,
  calculateLargeCycleRemainingMs,
  type CycleInfo,
} from "../utils";

/**
 * 周期计算服务
 * 负责双周期（4小时小周期 + 7天大周期）的计算和管理
 */
@Injectable()
export class CycleCalculationService {
  /**
   * 获取完整的周期信息
   * @param subscriptionStartedAt 订阅生效时间
   * @param now 当前时间（默认现在）
   * @returns 周期信息
   */
  getCycleInfo(subscriptionStartedAt: Date, now: Date = new Date()): CycleInfo {
    return getCycleInfo(subscriptionStartedAt, now);
  }

  /**
   * 计算小周期编号
   * @param subscriptionStartedAt 订阅生效时间
   * @param now 当前时间（默认现在）
   * @returns 小周期编号（从1开始）
   */
  calculateSmallCycleNumber(
    subscriptionStartedAt: Date,
    now: Date = new Date(),
  ): number {
    return calculateSmallCycleNumber(subscriptionStartedAt, now);
  }

  /**
   * 计算大周期编号
   * @param subscriptionStartedAt 订阅生效时间
   * @param now 当前时间（默认现在）
   * @returns 大周期编号（从1开始）
   */
  calculateLargeCycleNumber(
    subscriptionStartedAt: Date,
    now: Date = new Date(),
  ): number {
    return calculateLargeCycleNumber(subscriptionStartedAt, now);
  }

  /**
   * 计算小周期结束时间
   * @param subscriptionStartedAt 订阅生效时间
   * @param now 当前时间（默认现在）
   * @returns 小周期结束时间
   */
  calculateSmallCycleEndAt(
    subscriptionStartedAt: Date,
    now: Date = new Date(),
  ): Date {
    return calculateSmallCycleEndAt(subscriptionStartedAt, now);
  }

  /**
   * 计算大周期结束时间
   * @param subscriptionStartedAt 订阅生效时间
   * @param now 当前时间（默认现在）
   * @returns 大周期结束时间
   */
  calculateLargeCycleEndAt(
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
  calculateSmallCycleRemainingMs(
    subscriptionStartedAt: Date,
    now: Date = new Date(),
  ): number {
    return calculateSmallCycleRemainingMs(subscriptionStartedAt, now);
  }

  /**
   * 计算大周期剩余时间（毫秒）
   * @param subscriptionStartedAt 订阅生效时间
   * @param now 当前时间（默认现在）
   * @returns 剩余毫秒数
   */
  calculateLargeCycleRemainingMs(
    subscriptionStartedAt: Date,
    now: Date = new Date(),
  ): number {
    return calculateLargeCycleRemainingMs(subscriptionStartedAt, now);
  }

  /**
   * 检查是否处于新周期（需要重置额度）
   * @param lastSmallCycle 上次记录的小周期编号
   * @param lastLargeCycle 上次记录的大周期编号
   * @param currentSmallCycle 当前小周期编号
   * @param currentLargeCycle 当前大周期编号
   * @returns 是否需要重置及哪些周期需要重置
   */
  checkCycleChange(
    lastSmallCycle: number,
    lastLargeCycle: number,
    currentSmallCycle: number,
    currentLargeCycle: number,
  ): {
    needReset: boolean;
    smallCycleChanged: boolean;
    largeCycleChanged: boolean;
  } {
    const smallCycleChanged = currentSmallCycle > lastSmallCycle;
    const largeCycleChanged = currentLargeCycle > lastLargeCycle;

    return {
      needReset: smallCycleChanged || largeCycleChanged,
      smallCycleChanged,
      largeCycleChanged,
    };
  }

  /**
   * 格式化周期剩余时间（用于展示）
   * @param remainingMs 剩余毫秒数
   * @returns 格式化字符串（如：3小时25分钟）
   */
  formatRemainingTime(remainingMs: number): string {
    if (remainingMs <= 0) {
      return "已过期";
    }

    const hours = Math.floor(remainingMs / (1000 * 60 * 60));
    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return `${days}天${remainingHours}小时`;
    }

    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    }

    return `${minutes}分钟`;
  }

  /**
   * 计算订阅剩余时间
   * @param expiresAt 订阅过期时间
   * @param now 当前时间（默认现在）
   * @returns 剩余毫秒数
   */
  calculateSubscriptionRemainingMs(
    expiresAt: Date,
    now: Date = new Date(),
  ): number {
    return Math.max(0, expiresAt.getTime() - now.getTime());
  }

  /**
   * 检查订阅是否有效
   * @param expiresAt 订阅过期时间
   * @param now 当前时间（默认现在）
   * @returns 是否有效
   */
  isSubscriptionValid(expiresAt: Date, now: Date = new Date()): boolean {
    return expiresAt.getTime() > now.getTime();
  }

  /**
   * 计算升级时的剩余价值
   * @param originalPrice 原订阅价格
   * @param originalStartedAt 原订阅生效时间
   * @param originalExpiresAt 原订阅过期时间
   * @param now 当前时间（默认现在）
   * @returns 剩余价值（元）
   */
  calculateUpgradeRemainingValue(
    originalPrice: number,
    originalStartedAt: Date,
    originalExpiresAt: Date,
    now: Date = new Date(),
  ): number {
    const totalDurationMs =
      originalExpiresAt.getTime() - originalStartedAt.getTime();
    const remainingMs = Math.max(
      0,
      originalExpiresAt.getTime() - now.getTime(),
    );

    if (totalDurationMs <= 0 || remainingMs <= 0) {
      return 0;
    }

    // 按比例计算剩余价值
    const remainingRatio = remainingMs / totalDurationMs;
    return parseFloat((originalPrice * remainingRatio).toFixed(2));
  }

  /**
   * 计算续费后的新过期时间
   * @param currentExpiresAt 当前过期时间
   * @param period 周期类型（monthly/yearly）
   * @param now 当前时间（默认现在）
   * @returns 新的过期时间
   */
  calculateRenewalExpiresAt(
    currentExpiresAt: Date,
    period: "monthly" | "yearly",
    now: Date = new Date(),
  ): Date {
    const startTime =
      currentExpiresAt.getTime() > now.getTime() ? currentExpiresAt : now;

    const monthsToAdd = period === "monthly" ? 1 : 12;
    const newExpiresAt = new Date(startTime);
    newExpiresAt.setMonth(newExpiresAt.getMonth() + monthsToAdd);

    return newExpiresAt;
  }
}
