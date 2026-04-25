import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ScheduleModule } from "@nestjs/schedule";
import {
  Provider,
  AiModel,
  ModelProvider,
  ProviderHealthLog,
  ModelAdapterConfig,
  ModelCallLog,
} from "./entities";
import {
  ProviderService,
  ModelService,
  HealthCheckService,
  CacheService,
  ModelCallLogService,
  ApiKeyAlertService,
  EncryptionService,
} from "./services";
import {
  ModelConfigController,
  AdminModelConfigController,
  InternalModelConfigController,
} from "./controllers";
import { AdminAuthGuard, SuperAdminGuard, InternalApiKeyGuard } from "./guards";
import { UserModule } from "../user/user.module";
import { QuotaConfig } from "../billing/entities/quota-config.entity";
import { SystemConfig } from "../system-admin/entities/system-config.entity";
import { SystemConfigService } from "../system-admin/services/system-config.service";
import { RedisModule } from "../../common/redis/redis.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Provider,
      AiModel,
      ModelProvider,
      ProviderHealthLog,
      ModelAdapterConfig,
      ModelCallLog,
      QuotaConfig,
      SystemConfig, // 添加 SystemConfig 实体
    ]),
    UserModule,
    RedisModule, // 添加 Redis 模块
    ScheduleModule.forRoot(),
  ],
  providers: [
    ProviderService,
    ModelService,
    HealthCheckService,
    CacheService,
    ModelCallLogService,
    ApiKeyAlertService,
    EncryptionService, // 添加加密服务
    SystemConfigService, // 添加系统配置服务
    AdminAuthGuard,
    SuperAdminGuard,
    InternalApiKeyGuard,
  ],
  controllers: [
    ModelConfigController,
    AdminModelConfigController,
    InternalModelConfigController,
  ],
  exports: [
    TypeOrmModule, // 导出 TypeOrmModule 使导入模块可使用注册的实体 Repository
    ProviderService,
    ModelService,
    CacheService,
    ModelCallLogService,
    ApiKeyAlertService,
    EncryptionService, // 导出加密服务
  ],
})
export class ModelConfigModule {}
