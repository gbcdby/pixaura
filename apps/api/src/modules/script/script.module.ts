import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BullModule } from "@nestjs/bullmq";
import { ScriptController } from "./controllers/script.controller";
import { ScriptAssetController } from "./controllers/script-asset.controller";
import { ScriptStoryboardController } from "./controllers/script-storyboard.controller";
import { ScriptAudioController } from "./controllers/script-audio.controller";
import { ScriptShotGroupController } from "./controllers/script-shot-group.controller";
import { ScriptService } from "./services/script.service";
import { ScriptAssetService } from "./services/script-asset.service";
import { ScriptAssetDedupService } from "./services/script-asset-dedup.service";
import { ScriptStoryboardService } from "./services/script-storyboard.service";
import { ScriptAudioService } from "./services/script-audio.service";
import { ScriptShotGroupService } from "./services/script-shot-group.service";
import { Script } from "./entities/script.entity";
import { AITask } from "./entities/ai-task.entity";
import { AssetCrossProjectRef } from "./entities/asset-cross-project-ref.entity";
import { Collaborator } from "../project/entities/collaborator.entity";
import { Project } from "../project/entities/project.entity";
import { ProjectModelConfig } from "../project/entities/project-model-config.entity";
import { User } from "../user/entities/user.entity";
import { Character } from "../character/entities/character.entity";
import { CharacterImage } from "../character/entities/character-image.entity";
import { Scene } from "../scene/entities/scene.entity";
import { SceneImage } from "../scene/entities/scene-image.entity";
import { Prop } from "../prop/entities/prop.entity";
import { PropImage } from "../prop/entities/prop-image.entity";
import { ProjectModule } from "../project/project.module";
import { AIModule } from "../ai/ai.module";
import { CharacterModule } from "../character/character.module";
import { SceneModule } from "../scene/scene.module";
import { PropModule } from "../prop/prop.module";
import { ModelConfigModule } from "../model-config/model-config.module";
import { AudioGenModule } from "../audio-gen/audio-gen.module";
import { RedisModule } from "../../common/redis/redis.module";
import { RedlockService } from "../../common/services/redlock.service";
import { OssModule } from "../../common/oss/oss.module";
import { ScriptAIModule } from "../script-ai/script-ai.module";
import { WebSocketModule } from "../websocket/websocket.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Script,
      AITask,
      AssetCrossProjectRef,
      Collaborator,
      Project,
      ProjectModelConfig,
      User,
      Character,
      CharacterImage,
      Scene,
      SceneImage,
      Prop,
      PropImage,
    ]),
    BullModule.registerQueue({
      name: "script-ai-parse",
    }),
    BullModule.registerQueue({
      name: "script-ai-generate",
    }),
    ProjectModule,
    AIModule,
    CharacterModule,
    SceneModule,
    PropModule,
    ModelConfigModule,
    AudioGenModule,
    RedisModule,
    OssModule,
    forwardRef(() => ScriptAIModule),
    WebSocketModule,
  ],
  controllers: [
    ScriptController,
    ScriptAssetController,
    ScriptStoryboardController,
    ScriptAudioController,
    ScriptShotGroupController,
  ],
  providers: [
    ScriptService,
    ScriptAssetService,
    ScriptAssetDedupService,
    ScriptStoryboardService,
    ScriptAudioService,
    ScriptShotGroupService,
    RedlockService,
  ],
  exports: [
    ScriptService,
    ScriptAssetDedupService,
    ScriptAudioService,
    ScriptShotGroupService,
  ],
})
export class ScriptModule {}
