import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BullModule } from "@nestjs/bullmq";
import { ScriptAIController } from "./controllers/script-ai.controller";
import { ScriptGenerateWorker } from "./workers/script-generate.worker";
import { ScriptParseWorker } from "./workers/script-parse.worker";
import { ScriptEditWorker } from "./workers/script-edit.worker";
import { AITask } from "../script/entities/ai-task.entity";
import { Script } from "../script/entities/script.entity";
import { ScriptModule } from "../script/script.module";
import { AIModule } from "../ai/ai.module";
import { ProjectModule } from "../project/project.module";
import { ScriptAssetDedupService } from "../script/services/script-asset-dedup.service";
import { CharacterModule } from "../character/character.module";
import { SceneModule } from "../scene/scene.module";
import { PropModule } from "../prop/prop.module";
import { Collaborator } from "../project/entities/collaborator.entity";
import { Project } from "../project/entities/project.entity";
import { ProjectModelConfig } from "../project/entities/project-model-config.entity";
import { OssModule } from "../../common/oss/oss.module";
import { RedlockService } from "../../common/services/redlock.service";
import { RedisModule } from "../../common/redis/redis.module";
import { MaskStorageService } from "./services/mask-storage.service";
import { LipSyncBillingService } from "./services/lip-sync-billing.service";
import { BillingModule } from "../billing/billing.module";
import { SystemAdminModule } from "../system-admin/system-admin.module";

import { CharacterImage } from "../character/entities/character-image.entity";
import { SceneImage } from "../scene/entities/scene-image.entity";
import { PropImage } from "../prop/entities/prop-image.entity";

/**
 * 剧本 AI 模块
 * 提供剧本生成、解析、编辑等 AI 功能
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      AITask,
      Script,
      Collaborator,
      Project,
      ProjectModelConfig,
      CharacterImage,
      SceneImage,
      PropImage,
    ]),
    BullModule.registerQueue(
      {
        name: "script-ai-generate",
        defaultJobOptions: {
          attempts: 3, // 最多重试3次
          backoff: {
            type: "exponential",
            delay: 5000, // 初始延迟5秒
          },
          removeOnComplete: 10, // 保留最近10个完成的任务
          removeOnFail: 20, // 保留最近20个失败的任务
        },
      },
      {
        name: "script-ai-parse",
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
          removeOnComplete: 10,
          removeOnFail: 20,
        },
      },
      {
        name: "ai-text-stream",
        defaultJobOptions: {
          attempts: 2,
          backoff: {
            type: "fixed",
            delay: 3000,
          },
          removeOnComplete: 10,
          removeOnFail: 20,
        },
      },
    ),
    forwardRef(() => ScriptModule),
    AIModule,
    ProjectModule,
    CharacterModule,
    SceneModule,
    PropModule,
    OssModule,
    RedisModule,
    BillingModule,
    SystemAdminModule,
  ],
  controllers: [ScriptAIController],
  providers: [
    ScriptGenerateWorker,
    ScriptParseWorker,
    ScriptEditWorker,
    ScriptAssetDedupService,
    RedlockService,
    MaskStorageService,
    LipSyncBillingService,
  ],
  exports: [MaskStorageService, LipSyncBillingService],
})
export class ScriptAIModule {}
