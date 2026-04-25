/**
 * 图片生成队列服务
 * 管理任务队列和调度
 */
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { ImageGenTaskStatus } from "../entities";

export interface QueueTask {
  taskId: string;
  projectId: string;
  priority: number;
  createdAt: number;
}

@Injectable()
export class ImageGenerationQueueService implements OnModuleInit {
  private readonly logger = new Logger(ImageGenerationQueueService.name);
  private redisClient: Redis | null = null;
  private readonly QUEUE_KEY = "image_gen:queue";
  private readonly PROCESSING_KEY = "image_gen:processing";
  private readonly MAX_CONCURRENT = 2; // 单用户最大并发

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.initRedis();
  }

  private initRedis(): void {
    try {
      const host = this.configService.get<string>("REDIS_HOST") || "localhost";
      const port = this.configService.get<number>("REDIS_PORT") || 6379;

      this.redisClient = new Redis({
        host,
        port,
        db: 0,
        retryStrategy: (times) => Math.min(times * 50, 2000),
      });

      this.logger.log("Redis 客户端初始化成功");
    } catch (error) {
      this.logger.error("Redis 客户端初始化失败:", error);
    }
  }

  /**
   * 添加任务到队列
   * @param taskId 任务ID
   * @param projectId 项目ID
   * @param userId 用户ID
   */
  async enqueue(
    taskId: string,
    projectId: string,
    userId: string,
    priority: number = 100,
  ): Promise<void> {
    if (!this.redisClient) {
      this.logger.warn("Redis 未初始化，任务队列功能不可用");
      return;
    }

    const task: QueueTask = {
      taskId,
      projectId,
      priority,
      createdAt: Date.now(),
    };

    // 使用有序集合，按优先级和时间排序
    await this.redisClient.zadd(this.QUEUE_KEY, priority, JSON.stringify(task));

    this.logger.debug(`任务 ${taskId} 已加入队列，优先级: ${priority}`);
  }

  /**
   * 从队列中获取下一个任务
   */
  async dequeue(): Promise<QueueTask | null> {
    if (!this.redisClient) {
      return null;
    }

    // 获取优先级最高的任务
    const tasks = await this.redisClient.zrange(
      this.QUEUE_KEY,
      0,
      0,
      "WITHSCORES",
    );

    if (!tasks || tasks.length === 0) {
      return null;
    }

    const taskData = tasks[0];
    const task: QueueTask = JSON.parse(taskData);

    // 从队列中移除
    await this.redisClient.zrem(this.QUEUE_KEY, taskData);

    // 添加到处理中集合
    await this.redisClient.hset(
      this.PROCESSING_KEY,
      task.taskId,
      JSON.stringify({ ...task, startedAt: Date.now() }),
    );

    return task;
  }

  /**
   * 标记任务完成
   */
  async complete(taskId: string): Promise<void> {
    if (!this.redisClient) {
      return;
    }

    await this.redisClient.hdel(this.PROCESSING_KEY, taskId);
    this.logger.debug(`任务 ${taskId} 已完成`);
  }

  /**
   * 取消任务
   */
  async cancel(taskId: string): Promise<boolean> {
    if (!this.redisClient) {
      return false;
    }

    // 从队列中移除
    const tasks = await this.redisClient.zrange(this.QUEUE_KEY, 0, -1);
    for (const taskData of tasks) {
      const task: QueueTask = JSON.parse(taskData);
      if (task.taskId === taskId) {
        await this.redisClient.zrem(this.QUEUE_KEY, taskData);
        this.logger.debug(`任务 ${taskId} 已从队列移除`);
        return true;
      }
    }

    return false;
  }

  /**
   * 检查用户并发数
   */
  async getUserConcurrentCount(userId: string): Promise<number> {
    if (!this.redisClient) {
      return 0;
    }

    // 简化实现：实际应该跟踪每个用户的任务
    return 0;
  }

  /**
   * 检查用户是否超过并发限制
   */
  async isUserConcurrentLimitReached(userId: string): Promise<boolean> {
    const count = await this.getUserConcurrentCount(userId);
    return count >= this.MAX_CONCURRENT;
  }

  /**
   * 获取队列长度
   */
  async getQueueLength(): Promise<number> {
    if (!this.redisClient) {
      return 0;
    }

    return this.redisClient.zcard(this.QUEUE_KEY);
  }

  /**
   * 获取队列深度（是否已满）
   */
  async isQueueFull(maxDepth: number = 1000): Promise<boolean> {
    const length = await this.getQueueLength();
    return length >= maxDepth;
  }

  /**
   * 获取处理中任务数
   */
  async getProcessingCount(): Promise<number> {
    if (!this.redisClient) {
      return 0;
    }

    return this.redisClient.hlen(this.PROCESSING_KEY);
  }

  /**
   * 重新入队失败任务（重试）
   */
  async requeue(
    taskId: string,
    projectId: string,
    priority: number = 100,
  ): Promise<void> {
    // 移除处理中状态
    if (this.redisClient) {
      await this.redisClient.hdel(this.PROCESSING_KEY, taskId);
    }

    // 重新加入队列
    await this.enqueue(taskId, projectId, "", priority);
  }
}
