import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CharacterController } from "./controllers/character.controller";
import { CharacterService } from "./services/character.service";
import { Character, CharacterImage } from "./entities";
import { Collaborator } from "../project/entities/collaborator.entity";
import { Project } from "../project/entities/project.entity";
import { Script } from "../script/entities/script.entity";
import { ProjectModule } from "../project/project.module";
import { ImageGenModule } from "../image-gen/image-gen.module";
import { ImageStorageService } from "../image-gen/services";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Character,
      CharacterImage,
      Collaborator,
      Project,
      Script,
    ]),
    ProjectModule,
    forwardRef(() => ImageGenModule),
  ],
  controllers: [CharacterController],
  providers: [CharacterService, ImageStorageService],
  exports: [CharacterService],
})
export class CharacterModule {}
