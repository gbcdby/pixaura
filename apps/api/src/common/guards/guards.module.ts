import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { RateLimitGuard } from "./rate-limit.guard";

@Module({
  providers: [JwtAuthGuard, RateLimitGuard],
  exports: [JwtAuthGuard, RateLimitGuard],
})
export class GuardsModule {}
