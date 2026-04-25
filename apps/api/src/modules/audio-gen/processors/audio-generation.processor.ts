/**
 * 音频生成队列处理器
 * 处理音频生成任务队列（简化版）
 */
import { Injectable, Logger } from "@nestjs/common";
import { AudioGenerationTaskRepository } from "../repositories";
import { AudioGenerationCostService } from "../services/audio-generation-cost.service";
import { TTSService } from "../services/tts.service";
import { LipSyncService } from "../services/lip-sync.service";
import { BGMService } from "../services/bgm.service";
import { AmbienceService } from "../services/ambience.service";
import { MixingService } from "../services/mixing.service";

@Injectable()
export class AudioGenerationProcessor {
  private readonly logger = new Logger(AudioGenerationProcessor.name);

  constructor(
    private taskRepo: AudioGenerationTaskRepository,
    private costService: AudioGenerationCostService,
    private ttsService: TTSService,
    private lipSyncService: LipSyncService,
    private bgmService: BGMService,
    private ambienceService: AmbienceService,
    private mixingService: MixingService,
  ) {}

  /**
   * 处理生成任务
   */
  async process(taskId: string, notifyWs: boolean): Promise<void> {
    this.logger.log(`开始处理音频生成任务: ${taskId}`);

    // 获取任务详情
    const task = await this.taskRepo.findByIdWithOutputs(taskId);
    if (!task) {
      throw new Error(`任务不存在: ${taskId}`);
    }

    // 更新状态为处理中
    await this.taskRepo.updateStatus(taskId, "processing");

    try {
      // 根据类型执行不同的生成逻辑
      switch (task.type) {
        case "tts":
          await this.ttsService.execute(task);
          break;
        case "lip_sync":
          await this.lipSyncService.generate(task);
          break;
        case "bgm":
          await this.bgmService.generate(task);
          break;
        case "ambience":
          await this.ambienceService.generate(task);
          break;
        case "mixing":
          await this.mixingService.generate(task);
          break;
        default:
          throw new Error(`未知的音频生成类型: ${task.type}`);
      }

      // 更新状态为完成
      await this.taskRepo.updateStatus(taskId, "completed");

      // 结算成本
      const actualCost = task.calculateActualCost(50);
      await this.costService.settleCost(
        task.createdBy,
        task.projectId,
        task.cost.estimatedCost,
        actualCost,
      );

      this.logger.log(`音频生成任务完成: ${taskId}`);
    } catch (error) {
      const errorMessage = (error as Error).message || "未知错误";
      this.logger.error(`音频生成任务失败: ${taskId}`);
      this.logger.debug(`详细错误信息: ${errorMessage}`);

      // 更新状态为失败（脱敏处理）
      await this.taskRepo.updateStatus(taskId, "failed", {
        code: 500,
        message: "音频生成失败，请稍后重试",
      });

      throw error;
    }
  }
}
