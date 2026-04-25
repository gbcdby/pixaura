import { Injectable, Logger } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import { RedisService } from "../../../common/redis/redis.service";
import {
  getQuotaKeys,
  getBalanceKey,
  getQuotaCycleKey,
  getDeductLockKey,
  getIdempotencyKey,
  calculateSmallCycleNumber,
  calculateLargeCycleNumber,
  getCycleInfo,
  DEDUCT_QUOTA_LUA_SCRIPT,
  CHECK_QUOTA_LUA_SCRIPT,
  RELEASE_LOCK_LUA_SCRIPT,
  parseLuaResult,
  type DeductQuotaResult,
  type CheckQuotaResult,
} from "../utils";
import type { QuotaConfig } from "../entities/quota-config.entity";

/**
 * 额度 Redis 服务
 * 负责额度的 Redis 存储、查询、扣减等操作
 */
@Injectable()
export class QuotaRedisService {
  private readonly logger = new Logger(QuotaRedisService.name);

  // 分布式锁超时时间（毫秒）
  private readonly LOCK_TIMEOUT_MS = 30000;

  // 幂等键过期时间（24小时）
  private readonly IDEMPOTENCY_TTL_SECONDS = 86400;

  constructor(private readonly redisService: RedisService) {}

  private get redis() {
    return this.redisService.getClient();
  }

  /**
   * 获取分布式锁
   * @param userId 用户ID
   * @returns 锁标识（用于释放锁），失败返回 null
   */
  async acquireLock(userId: string): Promise<string | null> {
    const lockKey = getDeductLockKey(userId);
    const lockValue = uuidv4();

    const result = await this.redis.set(
      lockKey,
      lockValue,
      "PX",
      this.LOCK_TIMEOUT_MS,
      "NX",
    );

    if (result === "OK") {
      return lockValue;
    }

    return null;
  }

  /**
   * 释放分布式锁
   * @param userId 用户ID
   * @param lockValue 锁标识
   */
  async releaseLock(userId: string, lockValue: string): Promise<void> {
    const lockKey = getDeductLockKey(userId);

    await this.redis.eval(RELEASE_LOCK_LUA_SCRIPT, 1, lockKey, lockValue);
  }

  /**
   * 检查额度是否充足
   * @param userId 用户ID
   * @param modelId 模型ID（可选，LIP_SYNC 等类别不需要）
   * @param categoryId 功能类别ID
   * @param count 需要的额度数量
   * @returns 检查结果
   */
  async checkQuota(
    userId: string,
    modelId: string | undefined,
    categoryId: string,
    count: number = 1,
  ): Promise<CheckQuotaResult> {
    // 当 modelId 为 undefined 时，使用空字符串跳过模型级别检查
    const effectiveModelId = modelId || "";
    const keys = getQuotaKeys(userId, effectiveModelId, categoryId);

    const result = await this.redis.eval(
      CHECK_QUOTA_LUA_SCRIPT,
      4,
      keys.smallModel,
      keys.largeModel,
      keys.smallCategory,
      keys.largeCategory,
      effectiveModelId,
      count.toString(),
      categoryId,
    );

    return parseLuaResult<CheckQuotaResult>(result as string);
  }

  /**
   * 扣减额度
   * 使用 Lua 脚本保证原子性
   *
   * @param userId 用户ID
   * @param modelId 模型ID（可选，LIP_SYNC 等类别不需要）
   * @param categoryId 功能类别ID
   * @param count 扣减数量
   * @param lockValue 分布式锁标识
   * @returns 扣减结果
   */
  async deductQuota(
    userId: string,
    modelId: string | undefined,
    categoryId: string,
    count: number,
    lockValue: string,
  ): Promise<DeductQuotaResult> {
    // 当 modelId 为 undefined 时，使用空字符串跳过模型级别扣减
    const effectiveModelId = modelId || "";
    const keys = getQuotaKeys(userId, effectiveModelId, categoryId);

    const result = await this.redis.eval(
      DEDUCT_QUOTA_LUA_SCRIPT,
      5,
      keys.smallModel,
      keys.largeModel,
      keys.smallCategory,
      keys.largeCategory,
      keys.lock,
      lockValue,
      effectiveModelId,
      count.toString(),
      categoryId,
    );

    return parseLuaResult<DeductQuotaResult>(result as string);
  }

  /**
   * 初始化用户额度
   * 在周期切换或新订阅时调用
   *
   * @param userId 用户ID
   * @param subscriptionStartedAt 订阅生效时间
   * @param modelConfigs 模型额度配置列表
   * @param categoryConfigs 类别额度配置列表
   */
  async initializeQuota(
    userId: string,
    subscriptionStartedAt: Date,
    modelConfigs: QuotaConfig[],
    categoryConfigs: QuotaConfig[],
  ): Promise<void> {
    const cycleInfo = getCycleInfo(subscriptionStartedAt);

    // 批量初始化模型额度
    for (const config of modelConfigs) {
      const keys = getQuotaKeys(userId, config.targetId, "");

      if (config.cycleType === "small") {
        await this.redis.hset(
          keys.smallModel,
          config.targetId,
          config.quotaValue,
        );
        await this.redis.pexpire(keys.smallModel, 7 * 24 * 60 * 60 * 1000); // 7天过期
      } else {
        await this.redis.hset(
          keys.largeModel,
          config.targetId,
          config.quotaValue,
        );
        await this.redis.pexpire(keys.largeModel, 14 * 24 * 60 * 60 * 1000); // 14天过期
      }
    }

    // 批量初始化类别额度
    for (const config of categoryConfigs) {
      const keys = getQuotaKeys(userId, "", config.targetId);

      if (config.cycleType === "small") {
        await this.redis.hset(
          keys.smallCategory,
          config.targetId,
          config.quotaValue,
        );
        await this.redis.pexpire(keys.smallCategory, 7 * 24 * 60 * 60 * 1000);
      } else {
        await this.redis.hset(
          keys.largeCategory,
          config.targetId,
          config.quotaValue,
        );
        await this.redis.pexpire(keys.largeCategory, 14 * 24 * 60 * 60 * 1000);
      }
    }

    // 存储周期信息
    const cycleKey = getQuotaCycleKey(userId);
    await this.redis.hmset(cycleKey, {
      small_cycle: cycleInfo.smallCycleNumber.toString(),
      large_cycle: cycleInfo.largeCycleNumber.toString(),
      small_cycle_end: cycleInfo.smallCycleEndAt.getTime().toString(),
      large_cycle_end: cycleInfo.largeCycleEndAt.getTime().toString(),
    });
    await this.redis.pexpire(cycleKey, 14 * 24 * 60 * 60 * 1000);

    this.logger.debug(`用户 ${userId} 额度初始化完成`);
  }

  /**
   * 获取用户当前额度
   * @param userId 用户ID
   * @param modelIds 模型ID列表
   * @param categoryIds 类别ID列表
   * @returns 额度信息
   */
  async getQuota(
    userId: string,
    modelIds: string[],
    categoryIds: string[],
  ): Promise<{
    models: Record<string, { small: number; large: number }>;
    categories: Record<string, { small: number; large: number }>;
  }> {
    const models: Record<string, { small: number; large: number }> = {};
    const categories: Record<string, { small: number; large: number }> = {};

    // 获取模型额度
    for (const modelId of modelIds) {
      const keys = getQuotaKeys(userId, modelId, "");
      const [small, large] = await Promise.all([
        this.redis.hget(keys.smallModel, modelId),
        this.redis.hget(keys.largeModel, modelId),
      ]);

      models[modelId] = {
        small: parseInt(small || "0", 10),
        large: parseInt(large || "0", 10),
      };
    }

    // 获取类别额度
    for (const categoryId of categoryIds) {
      const keys = getQuotaKeys(userId, "", categoryId);
      const [small, large] = await Promise.all([
        this.redis.hget(keys.smallCategory, categoryId),
        this.redis.hget(keys.largeCategory, categoryId),
      ]);

      categories[categoryId] = {
        small: parseInt(small || "0", 10),
        large: parseInt(large || "0", 10),
      };
    }

    return { models, categories };
  }

  /**
   * 获取用户余额
   * @param userId 用户ID
   * @returns 余额
   */
  async getBalance(userId: string): Promise<number> {
    const balanceKey = getBalanceKey(userId);
    const balance = await this.redis.get(balanceKey);
    return parseFloat(balance || "0");
  }

  /**
   * 设置用户余额
   * @param userId 用户ID
   * @param amount 余额
   */
  async setBalance(userId: string, amount: number): Promise<void> {
    const balanceKey = getBalanceKey(userId);
    await this.redis.set(balanceKey, amount.toFixed(2));
  }

  /**
   * 增加用户余额（充值）
   * @param userId 用户ID
   * @param amount 增加的金额
   * @returns 增加后的余额
   */
  async incrementBalance(userId: string, amount: number): Promise<number> {
    const balanceKey = getBalanceKey(userId);
    const newBalance = await this.redis.incrbyfloat(balanceKey, amount);
    return parseFloat(newBalance.toString());
  }

  /**
   * 扣减用户余额
   * @param userId 用户ID
   * @param amount 扣减金额
   * @returns 是否扣减成功
   */
  async decrementBalance(
    userId: string,
    amount: number,
  ): Promise<{ success: boolean; balance: number }> {
    const balanceKey = getBalanceKey(userId);

    // 使用 Lua 脚本原子性扣减
    const luaScript = `
      local balance = tonumber(redis.call('GET', KEYS[1]) or '0')
      local deduct = tonumber(ARGV[1])

      if balance >= deduct then
        local newBalance = balance - deduct
        redis.call('SET', KEYS[1], string.format('%.2f', newBalance))
        return { tostring(newBalance), '1' }
      else
        return { tostring(balance), '0' }
      end
    `;

    const result = (await this.redis.eval(
      luaScript,
      1,
      balanceKey,
      amount.toString(),
    )) as string[];

    const newBalance = parseFloat(result[0]);
    const success = result[1] === "1";

    return { success, balance: newBalance };
  }

  /**
   * 检查幂等键是否存在
   * @param idempotencyKey 幂等键
   * @returns 是否存在
   */
  async checkIdempotencyKey(idempotencyKey: string): Promise<boolean> {
    const key = getIdempotencyKey(idempotencyKey);
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  /**
   * 设置幂等键
   * @param idempotencyKey 幂等键
   * @param result 结果（存储用于返回相同结果）
   */
  async setIdempotencyKey(
    idempotencyKey: string,
    result: string,
  ): Promise<void> {
    const key = getIdempotencyKey(idempotencyKey);
    await this.redis.setex(key, this.IDEMPOTENCY_TTL_SECONDS, result);
  }

  /**
   * 获取幂等键的结果
   * @param idempotencyKey 幂等键
   * @returns 存储的结果
   */
  async getIdempotencyResult(idempotencyKey: string): Promise<string | null> {
    const key = getIdempotencyKey(idempotencyKey);
    return await this.redis.get(key);
  }

  /**
   * 检查并切换周期
   * 如果周期已变更，返回新的周期信息
   *
   * @param userId 用户ID
   * @param subscriptionStartedAt 订阅生效时间
   * @returns 是否需要切换周期
   */
  async checkAndSwitchCycle(
    userId: string,
    subscriptionStartedAt: Date,
  ): Promise<{
    needSwitch: boolean;
    newSmallCycle?: number;
    newLargeCycle?: number;
  }> {
    const cycleKey = getQuotaCycleKey(userId);
    const storedCycle = await this.redis.hgetall(cycleKey);

    if (!storedCycle || Object.keys(storedCycle).length === 0) {
      // 首次初始化
      return { needSwitch: true };
    }

    const currentSmallCycle = calculateSmallCycleNumber(subscriptionStartedAt);
    const currentLargeCycle = calculateLargeCycleNumber(subscriptionStartedAt);

    const storedSmallCycle = parseInt(storedCycle.small_cycle || "0", 10);
    const storedLargeCycle = parseInt(storedCycle.large_cycle || "0", 10);

    const needSwitch =
      currentSmallCycle > storedSmallCycle ||
      currentLargeCycle > storedLargeCycle;

    return {
      needSwitch,
      newSmallCycle: currentSmallCycle,
      newLargeCycle: currentLargeCycle,
    };
  }

  /**
   * 清除用户所有额度数据
   * 用于订阅变更或数据重置
   * @param userId 用户ID
   */
  async clearUserQuota(userId: string): Promise<void> {
    const pattern = `*{${userId}}*`;
    const keys = await this.redis.keys(pattern);

    if (keys.length > 0) {
      await this.redis.del(...keys);
      this.logger.debug(`清除用户 ${userId} ${keys.length} 个额度相关 key`);
    }
  }

  /**
   * 批量获取多个用户的余额
   * @param userIds 用户ID列表
   * @returns 余额映射
   */
  async getBalances(userIds: string[]): Promise<Record<string, number>> {
    const pipeline = this.redis.pipeline();

    for (const userId of userIds) {
      pipeline.get(getBalanceKey(userId));
    }

    const results = await pipeline.exec();
    const balances: Record<string, number> = {};

    for (let i = 0; i < userIds.length; i++) {
      const result = results?.[i];
      balances[userIds[i]] = parseFloat((result?.[1] as string) || "0");
    }

    return balances;
  }
}
