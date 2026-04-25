import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AdminOperationLog } from "./entities/admin-operation-log.entity";
import { SystemConfig } from "./entities/system-config.entity";
import { UserBanRecord } from "./entities/user-ban-record.entity";
import { User } from "../user/entities/user.entity";
import { UserModule } from "../user/user.module";
import { ModelConfigModule } from "../model-config/model-config.module";
import {
  AdminUserService,
  SystemConfigService,
  OperationLogService,
} from "./services";
import {
  AdminUserController,
  SystemConfigController,
  OperationLogController,
} from "./controllers";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdminOperationLog,
      SystemConfig,
      UserBanRecord,
      User,
    ]),
    UserModule,
    ModelConfigModule,
  ],
  controllers: [
    AdminUserController,
    SystemConfigController,
    OperationLogController,
  ],
  providers: [AdminUserService, SystemConfigService, OperationLogService],
  exports: [AdminUserService, SystemConfigService, OperationLogService],
})
export class SystemAdminModule {}
