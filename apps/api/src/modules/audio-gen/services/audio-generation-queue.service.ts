/**
 * 音频生成队列服务
 * 管理任务队列和进度推送（简化版，不使用Bull队列）
 */
import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class AudioGenerationQueueService {
  private readonly logger = new Logger(AudioGenerationQueueService.name);

  /**
   * 添加任务到队列
   */
  async addTask(taskId: string, notifyWs: boolean = true): Promise<void> {
    this.logger.log(`任务已加入队列: ${taskId}`);
    // 简化版：直接处理，实际应使用Bull队列
  }

  /**
   * 检查队列是否已满
   */
  async isQueueFull(): Promise<boolean> {
    return false;
  }

  /**
   * 获取队列状态
   */
  async getQueueStatus(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    return {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
    };
  }
}
