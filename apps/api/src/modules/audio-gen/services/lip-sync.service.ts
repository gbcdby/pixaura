/**
 * 对口型服务
 * 视频对口型（简化版）
 */
import { Injectable, Logger } from "@nestjs/common";
import { AudioGenerationTaskEntity } from "../entities";
import { AudioGenerationOutputRepository } from "../repositories";
import { AudioStorageService } from "./audio-storage.service";

@Injectable()
export class LipSyncService {
  private readonly logger = new Logger(LipSyncService.name);

  constructor(
    private outputRepo: AudioGenerationOutputRepository,
    private storageService: AudioStorageService,
  ) {}

  /**
   * 执行对口型合成
   */
  async generate(task: AudioGenerationTaskEntity): Promise<void> {
    const config = task.config.lipSyncConfig;
    if (!config) {
      throw new Error("对口型配置不存在");
    }

    this.logger.log(`开始对口型合成: ${task.id}`);

    // 模拟生成过程
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 创建输出记录
    const entity = this.outputRepo.create({
      taskId: task.id,
      type: "lip_sync_video",
      file: {
        url: `https://oss.example.com/audio/${task.id}/output.mp4`,
        format: "mp4",
        duration: 10.0,
        size: 2048000,
      },
      metadata: {
        syncedRegions: [{ start: 0, end: 10, confidence: 0.95 }],
      },
    });

    await this.outputRepo.save(entity);

    this.logger.log(`对口型合成完成: ${task.id}`);
  }
}
