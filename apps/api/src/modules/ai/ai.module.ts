import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  OpenAIProvider,
  OpenAICompatibleProvider,
  VolcanoOmniHumanProvider,
  VolcanoSubjectDetectionProvider,
} from "./providers";
import { Provider, ModelProvider, AiModel } from "../model-config/entities";
import { ModelConfigModule } from "../model-config/model-config.module";
import { SystemAdminModule } from "../system-admin/system-admin.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Provider, ModelProvider, AiModel]),
    ModelConfigModule,
    SystemAdminModule,
  ],
  providers: [
    OpenAIProvider,
    OpenAICompatibleProvider,
    VolcanoOmniHumanProvider,
    VolcanoSubjectDetectionProvider,
  ],
  exports: [
    OpenAICompatibleProvider,
    VolcanoOmniHumanProvider,
    VolcanoSubjectDetectionProvider,
  ],
})
export class AIModule {}
