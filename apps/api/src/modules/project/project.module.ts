import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ProjectController, ProjectTemplateController } from "./controllers";
import { ProjectService, ProjectTemplateService } from "./services";
import { ProjectGuard, OwnerGuard, EditorGuard } from "./guards";
import {
  Project,
  Collaborator,
  ProjectModelConfig,
  ProjectInviteLink,
  ProjectTemplate,
  CleanupQueue,
} from "./entities";
import { UserModule } from "../user/user.module";
import { ModelConfigModule } from "../model-config/model-config.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      Collaborator,
      ProjectModelConfig,
      ProjectInviteLink,
      ProjectTemplate,
      CleanupQueue,
    ]),
    UserModule,
    ModelConfigModule,
  ],
  controllers: [ProjectController, ProjectTemplateController],
  providers: [
    ProjectService,
    ProjectTemplateService,
    ProjectGuard,
    OwnerGuard,
    EditorGuard,
  ],
  exports: [ProjectService, ProjectTemplateService],
})
export class ProjectModule {}
