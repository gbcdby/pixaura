/**
 * 图片生成模块
 */
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BullModule } from "@nestjs/bullmq";
import {
  ImageGenerationTaskEntity,
  ImageGenerationResultEntity,
} from "./entities";
import {
  ImageGenerationTaskRepository,
  ImageGenerationResultRepository,
} from "./repositories";
import {
  ImageGenerationService,
  ImageGenerationQueueService,
  ImageGenerationCostService,
  ImageStorageService,
  ImageGenerationWorkerService,
} from "./services";
import {
  ImageGenerationController,
  InternalImageGenerationController,
} from "./controllers";
import { ImageGenGateway } from "./gateways";
import { BillingModule } from "../billing/billing.module";
import { OpenAICompatibleProvider } from "../ai/providers/openai-compatible.provider";
import { Provider, ModelProvider } from "../model-config/entities";
import { ModelConfigModule } from "../model-config/model-config.module";
// 资产实体（用于图片生成完成后自动回链）
import { Character } from "../character/entities/character.entity";
import { CharacterImage } from "../character/entities/character-image.entity";
import { Scene } from "../scene/entities/scene.entity";
import { SceneImage } from "../scene/entities/scene-image.entity";
import { Prop } from "../prop/entities/prop.entity";
import { PropImage } from "../prop/entities/prop-image.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ImageGenerationTaskEntity,
      ImageGenerationResultEntity,
      Provider,
      ModelProvider,
      // 资产实体（用于图片生成完成后自动回链）
      Character,
      CharacterImage,
      Scene,
      SceneImage,
      Prop,
      PropImage,
    ]),
    BullModule.registerQueue({ name: "ai-image" }),
    BillingModule,
    ModelConfigModule,
  ],
  controllers: [ImageGenerationController, InternalImageGenerationController],
  providers: [
    ImageGenerationTaskRepository,
    ImageGenerationResultRepository,
    ImageGenerationService,
    ImageGenerationQueueService,
    ImageGenerationCostService,
    ImageStorageService,
    ImageGenerationWorkerService,
    ImageGenGateway,
    OpenAICompatibleProvider,
  ],
  exports: [
    ImageGenerationService,
    ImageGenGateway,
    ImageGenerationCostService,
    ImageStorageService,
  ],
})
export class ImageGenModule {}
