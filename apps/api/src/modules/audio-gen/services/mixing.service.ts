/**
 * 混音服务
 * 多轨道音频混合（简化版）
 */
import { Injectable, Logger } from "@nestjs/common";
import { AudioGenerationTaskEntity } from "../entities";
import { AudioGenerationOutputRepository } from "../repositories";
import { AudioStorageService } from "./audio-storage.service";

@Injectable()
export class MixingService {
  private readonly logger = new Logger(MixingService.name);

  constructor(
    private outputRepo: AudioGenerationOutputRepository,
    private storageService: AudioStorageService,
  ) {}

  /**
   * 执行混音
   */
  async generate(task: AudioGenerationTaskEntity): Promise<void> {
    const config = task.config.mixingConfig;
    if (!config) {
      throw new Error("混音配置不存在");
    }

    this.logger.log(`开始混音: ${task.id}, 轨道数: ${config.tracks.length}`);

    // 模拟生成过程
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // 创建输出记录
    const entity = this.outputRepo.create({
      taskId: task.id,
      type: "mixed_audio",
      file: {
        url: `https://oss.example.com/audio/${task.id}/output.wav`,
        format: "wav",
        duration: 60.0,
        size: 1024000,
      },
      metadata: {
        stats: {
          lufs: -14.0,
          truePeak: -1.2,
          dynamicRange: 12.5,
        },
      },
    });

    await this.outputRepo.save(entity);

    this.logger.log(`混音完成: ${task.id}`);
  }
}
