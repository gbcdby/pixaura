import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../user/entities/user.entity";
import { RechargeOrder } from "../billing/entities/recharge-order.entity";
import { AiModel } from "../model-config/entities/ai-model.entity";
import { UserModule } from "../user/user.module";
import { DashboardController } from "./controllers/dashboard.controller";
import { DashboardService } from "./services/dashboard.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([User, RechargeOrder, AiModel]),
    UserModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class AdminModule {}
