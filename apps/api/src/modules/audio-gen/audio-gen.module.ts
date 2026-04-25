/**
 * 音频生成模块
 */
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  AudioGenerationTaskEntity,
  AudioGenerationOutputEntity,
} from "./entities";
import { TextGenQuotaRecord } from "../billing/entities/text-gen-quota-record.entity";
import {
  AudioGenerationTaskRepository,
  AudioGenerationOutputRepository,
} from "./repositories";
import {
  AudioGenerationService,
  TTSService,
  LipSyncService,
  BGMService,
  AmbienceService,
  MixingService,
  AudioGenerationCostService,
  AudioGenerationQueueService,
  AudioStorageService,
} from "./services";
import {
  AudioGenerationController,
  InternalAudioGenerationController,
} from "./controllers";
import { AudioGenerationProcessor } from "./processors";
import { SystemAdminModule } from "../system-admin/system-admin.module";
import { BillingModule } from "../billing/billing.module";
import { ModelConfigModule } from "../model-config/model-config.module";
import { Provider, ModelProvider } from "../model-config/entities";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AudioGenerationTaskEntity,
      AudioGenerationOutputEntity,
      TextGenQuotaRecord,
      Provider, // BGMService 需要查询供应商配置
      ModelProvider, // BGMService 需要查询模型-供应商关联
    ]),
    SystemAdminModule,
    BillingModule,
    ModelConfigModule, // 添加 ModelConfigModule 以使用 ModelService 查询模型配置
  ],
  controllers: [AudioGenerationController, InternalAudioGenerationController],
  providers: [
    // Repositories
    AudioGenerationTaskRepository,
    AudioGenerationOutputRepository,
    // Services
    AudioGenerationService,
    TTSService,
    LipSyncService,
    BGMService,
    AmbienceService,
    MixingService,
    AudioGenerationCostService,
    AudioGenerationQueueService,
    AudioStorageService,
    // Processors
    AudioGenerationProcessor,
  ],
  exports: [
    AudioGenerationService,
    TTSService,
    AudioGenerationTaskRepository,
    AudioGenerationOutputRepository,
  ],
})
export class AudioGenModule {}
