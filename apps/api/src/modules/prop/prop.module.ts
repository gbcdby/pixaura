import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PropController } from "./controllers/prop.controller";
import { PropService } from "./services/prop.service";
import { Prop } from "./entities/prop.entity";
import { PropImage } from "./entities/prop-image.entity";
import { Collaborator } from "../project/entities/collaborator.entity";
import { Project } from "../project/entities/project.entity";
import { Script } from "../script/entities/script.entity";
import { ProjectModule } from "../project/project.module";
import { ImageGenModule } from "../image-gen/image-gen.module";
import { ImageStorageService } from "../image-gen/services";

@Module({
  imports: [
    TypeOrmModule.forFeature([Prop, PropImage, Collaborator, Project, Script]),
    ProjectModule,
    forwardRef(() => ImageGenModule),
  ],
  controllers: [PropController],
  providers: [PropService, ImageStorageService],
  exports: [PropService],
})
export class PropModule {}
