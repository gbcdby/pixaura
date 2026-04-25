import { Module, Global } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { WebSocketGatewayImpl } from "./websocket.gateway";
import { WebSocketService } from "./websocket.service";
import { WebSocketAuthMiddleware } from "./websocket-auth.middleware";
import { RedisModule } from "../../common/redis/redis.module";

/**
 * WebSocket 模块
 * 提供全局 WebSocket 服务，支持实时消息推送
 */
@Global()
@Module({
  imports: [ScheduleModule.forRoot(), RedisModule],
  providers: [
    WebSocketGatewayImpl,
    WebSocketService,
    WebSocketAuthMiddleware,
    JwtService,
    ConfigService,
  ],
  exports: [WebSocketService],
})
export class WebSocketModule {}
