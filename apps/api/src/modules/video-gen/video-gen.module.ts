import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { VideoGenController, InternalVideoGenController } from "./controllers";
import {
  VideoGenService,
  VideoGenProcessor,
  VideoGenQuotaService,
} from "./services";
import { VideoGenGateway } from "./gateways";
import {
  VideoGenerationTask,
  VideoGenerationOutput,
  VideoGenerationBatch,
  VideoGenQuotaRecord,
} from "./entities";
import { AiModel } from "../model-config/entities/ai-model.entity";
import { ProjectModule } from "../project/project.module";
import { BillingModule } from "../billing/billing.module";
import { WebSocketModule } from "../websocket/websocket.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VideoGenerationTask,
      VideoGenerationOutput,
      VideoGenerationBatch,
      VideoGenQuotaRecord,
      AiModel,
    ]),
    ProjectModule,
    BillingModule,
    WebSocketModule,
  ],
  controllers: [VideoGenController, InternalVideoGenController],
  providers: [
    VideoGenService,
    VideoGenProcessor,
    VideoGenQuotaService,
    VideoGenGateway,
  ],
  exports: [VideoGenService, VideoGenQuotaService, VideoGenGateway],
})
export class VideoGenModule {}
