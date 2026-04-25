import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SceneController } from "./controllers/scene.controller";
import { SceneService } from "./services/scene.service";
import { Scene, SceneImage } from "./entities";
import { Collaborator } from "../project/entities/collaborator.entity";
import { Project } from "../project/entities/project.entity";
import { Script } from "../script/entities/script.entity";
import { ProjectModule } from "../project/project.module";
import { ImageGenModule } from "../image-gen/image-gen.module";
import { ImageStorageService } from "../image-gen/services";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Scene,
      SceneImage,
      Collaborator,
      Project,
      Script,
    ]),
    ProjectModule,
    forwardRef(() => ImageGenModule),
  ],
  controllers: [SceneController],
  providers: [SceneService, ImageStorageService],
  exports: [SceneService],
})
export class SceneModule {}
