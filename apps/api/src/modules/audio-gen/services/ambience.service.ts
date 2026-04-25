/**
 * 环境音服务
 * 环境音效匹配/生成（简化版）
 */
import { Injectable, Logger } from "@nestjs/common";
import { AudioGenerationTaskEntity } from "../entities";
import { AudioGenerationOutputRepository } from "../repositories";
import { AudioStorageService } from "./audio-storage.service";

@Injectable()
export class AmbienceService {
  private readonly logger = new Logger(AmbienceService.name);

  constructor(
    private outputRepo: AudioGenerationOutputRepository,
    private storageService: AudioStorageService,
  ) {}

  /**
   * 执行环境音生成
   */
  async generate(task: AudioGenerationTaskEntity): Promise<void> {
    const config = task.config.ambienceConfig;
    if (!config) {
      throw new Error("环境音配置不存在");
    }

    this.logger.log(
      `开始环境音生成: ${task.id}, 标签: ${config.sceneTags.join(",")}`,
    );

    // 模拟生成过程
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // 创建输出记录
    const entity = this.outputRepo.create({
      taskId: task.id,
      type: "ambience",
      file: {
        url: `https://oss.example.com/audio/${task.id}/output.wav`,
        format: "wav",
        duration: config.duration,
        size: 256000,
      },
      metadata: {
        sceneTags: config.sceneTags,
        reverbPreset: config.reverbPreset,
      },
    });

    await this.outputRepo.save(entity);

    this.logger.log(`环境音生成完成: ${task.id}`);
  }
}
