/**
 * 分布式锁服务
 * 基于 Redlock 算法实现
 */
import { Injectable, Logger } from "@nestjs/common";
import { RedisService } from "../redis/redis.service";
import Redlock, { Lock, ExecutionError } from "redlock";

@Injectable()
export class RedlockService {
  private readonly logger = new Logger(RedlockService.name);
  private readonly redlock: Redlock;

  constructor(private readonly redisService: RedisService) {
    this.redlock = new Redlock([this.redisService.getClient()], {
      // 漂移因子：用于补偿时钟漂移
      driftFactor: 0.01,
      // 重试次数
      retryCount: 3,
      // 重试延迟（毫秒）
      retryDelay: 200,
      // 重试抖动（毫秒）
      retryJitter: 200,
      // 自动续期阈值（毫秒）
      automaticExtensionThreshold: 500,
    });

    // 监听 Redlock 错误
    this.redlock.on("error", (error) => {
      this.logger.error("Redlock 错误", error);
    });
  }

  /**
   * 获取锁
   * @param resource 资源标识符
   * @param ttl 锁超时时间（毫秒），默认 5000ms
   * @returns Lock 对象或 null（获取失败）
   */
  async acquireLock(
    resource: string,
    ttl: number = 5000,
  ): Promise<Lock | null> {
    try {
      const lock = await this.redlock.acquire([resource], ttl);
      this.logger.debug(`获取锁成功: ${resource}`);
      return lock;
    } catch (error) {
      if (error instanceof ExecutionError) {
        this.logger.debug(`获取锁失败: ${resource}`);
      } else {
        this.logger.error(`获取锁异常: ${resource}`, error);
      }
      return null;
    }
  }

  /**
   * 释放锁
   * @param lock Lock 对象
   */
  async releaseLock(lock: Lock): Promise<void> {
    try {
      await this.redlock.release(lock);
      this.logger.debug(`释放锁成功: ${lock.resources.join(", ")}`);
    } catch (error) {
      this.logger.error("释放锁失败", error);
    }
  }

  /**
   * 使用锁执行业务逻辑（自动获取和释放）
   * @param resource 资源标识符
   * @param ttl 锁超时时间（毫秒）
   * @param fn 执行业务逻辑的函数
   * @returns 业务逻辑执行结果
   * @throws 获取锁失败时抛出错误
   */
  async withLock<T>(
    resource: string,
    ttl: number,
    fn: () => Promise<T>,
  ): Promise<T> {
    const lock = await this.acquireLock(resource, ttl);

    if (!lock) {
      throw new Error(`获取锁失败: ${resource}`);
    }

    try {
      const result = await fn();
      return result;
    } finally {
      await this.releaseLock(lock);
    }
  }

  /**
   * 尝试获取锁，失败时返回 null 不抛异常
   * @param resource 资源标识符
   * @param ttl 锁超时时间（毫秒）
   * @param fn 执行业务逻辑的函数
   * @returns 业务逻辑执行结果或 null
   */
  async tryWithLock<T>(
    resource: string,
    ttl: number,
    fn: () => Promise<T>,
  ): Promise<T | null> {
    const lock = await this.acquireLock(resource, ttl);

    if (!lock) {
      return null;
    }

    try {
      const result = await fn();
      return result;
    } finally {
      await this.releaseLock(lock);
    }
  }

  /**
   * 获取 Redlock 实例（用于高级用法）
   */
  getRedlockInstance(): Redlock {
    return this.redlock;
  }
}
