import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { BullModule } from "@nestjs/bullmq";
import * as dotenv from "dotenv";
import * as path from "path";
import configuration from "./config/configuration";
import { UserModule } from "./modules/user/user.module";
import { ModelConfigModule } from "./modules/model-config/model-config.module";
import { BillingModule } from "./modules/billing/billing.module";
import { SystemAdminModule } from "./modules/system-admin/system-admin.module";
import { AdminModule } from "./modules/admin/admin.module";
import { ProjectModule } from "./modules/project/project.module";
import { ScriptModule } from "./modules/script/script.module";
import { ScriptAIModule } from "./modules/script-ai/script-ai.module";
import { CharacterModule } from "./modules/character/character.module";
import { SceneModule } from "./modules/scene/scene.module";
import { PropModule } from "./modules/prop/prop.module";
import { VideoGenModule } from "./modules/video-gen/video-gen.module";
import { ImageGenModule } from "./modules/image-gen/image-gen.module";
import { AssetModule } from "./modules/asset/asset.module";
import { AudioGenModule } from "./modules/audio-gen/audio-gen.module";
import { TtsModule } from "./modules/tts/tts.module";
import { WebSocketModule } from "./modules/websocket/websocket.module";
import { AIModule } from "./modules/ai/ai.module";
import { SystemNoticeModule } from "./modules/system-notice/system-notice.module";
import { RedisModule } from "./common/redis/redis.module";
import { JwtCustomModule } from "./common/jwt/jwt.module";
import { SmsModule } from "./common/sms/sms.module";
import { MailModule } from "./common/mail/mail.module";
import { OssModule } from "./common/oss/oss.module";

// 手动加载 .env 文件
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, ".env") });

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: [".env", "../../.env", "../.env"],
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: "postgres",
        host: process.env.DATABASE_HOST || "localhost",
        port: parseInt(process.env.DATABASE_PORT || "5432", 10),
        username: process.env.DATABASE_USER || "pixaura",
        password: process.env.DATABASE_PASSWORD || "pixaura123",
        database: process.env.DATABASE_NAME || "pixaura",
        entities: [__dirname + "/**/*.entity{.ts,.js}"],
        synchronize: false,
        // logging: process.env.APP_ENV === "development",
        logging: false,
      }),
    }),
    JwtModule.registerAsync({
      global: true,
      useFactory: () => ({
        secret: process.env.JWT_SECRET || "your-jwt-secret",
        signOptions: {
          expiresIn: process.env.JWT_ACCESS_EXPIRATION || "2h",
        },
      }),
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379", 10),
      },
    }),
    RedisModule,
    JwtCustomModule,
    SmsModule,
    MailModule,
    OssModule,
    UserModule,
    ModelConfigModule,
    BillingModule,
    SystemAdminModule,
    AdminModule,
    ProjectModule,
    ScriptModule,
    ScriptAIModule,
    CharacterModule,
    SceneModule,
    PropModule,
    VideoGenModule,
    ImageGenModule,
    AssetModule,
    AudioGenModule,
    TtsModule,
    WebSocketModule,
    AIModule,
    SystemNoticeModule,
  ],
})
export class AppModule {}
