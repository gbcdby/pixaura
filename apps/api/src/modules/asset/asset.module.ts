import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  AssetController,
  AssetImportController,
  UserAssetController,
} from "./controllers";
import {
  AssetQueryService,
  AssetImportService,
  UserAssetService,
} from "./services";
import {
  UserFavoriteRepository,
  UserRecentRepository,
  AssetStatsRepository,
  AssetImportLogRepository,
} from "./repositories";
import {
  UserFavoriteEntity,
  UserRecentEntity,
  AssetStatsEntity,
  AssetImportLogEntity,
  FileReferenceEntity,
} from "./entities";
// 导入其他模块的 Entity
import { Character, CharacterImage } from "../character/entities";
import { Scene, SceneImage } from "../scene/entities";
import { Prop, PropImage } from "../prop/entities";
import { Project } from "../project/entities/project.entity";
import {
  ImageGenerationTaskEntity,
  ImageGenerationResultEntity,
} from "../image-gen/entities";
// 导入其他模块（使用 forwardRef 避免循环依赖）
import { CharacterModule } from "../character/character.module";
import { SceneModule } from "../scene/scene.module";
import { PropModule } from "../prop/prop.module";
import { ProjectModule } from "../project/project.module";
import { ImageGenModule } from "../image-gen/image-gen.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      // Asset 模块自身 Entity
      UserFavoriteEntity,
      UserRecentEntity,
      AssetStatsEntity,
      AssetImportLogEntity,
      FileReferenceEntity,
      // 依赖的其他模块 Entity
      Character,
      CharacterImage,
      Scene,
      SceneImage,
      Prop,
      PropImage,
      Project,
      // 图像生成任务 Entity
      ImageGenerationTaskEntity,
      ImageGenerationResultEntity,
    ]),
    // 导入其他模块以使用它们的 Service
    forwardRef(() => CharacterModule),
    forwardRef(() => SceneModule),
    forwardRef(() => PropModule),
    forwardRef(() => ProjectModule),
    forwardRef(() => ImageGenModule),
  ],
  controllers: [AssetController, AssetImportController, UserAssetController],
  providers: [
    // Services
    AssetQueryService,
    AssetImportService,
    UserAssetService,
    // Repositories
    UserFavoriteRepository,
    UserRecentRepository,
    AssetStatsRepository,
    AssetImportLogRepository,
  ],
  exports: [AssetQueryService, AssetImportService, UserAssetService],
})
export class AssetModule {}
