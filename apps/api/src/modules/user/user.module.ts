import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "./entities/user.entity";
import { LoginLog } from "./entities/login-log.entity";
import { UserService } from "./user.service";
import { LoginLogService } from "./services/login-log.service";
import { AuthController } from "./auth.controller";
import { UserController } from "./user.controller";

@Module({
  imports: [TypeOrmModule.forFeature([User, LoginLog])],
  providers: [UserService, LoginLogService],
  controllers: [AuthController, UserController],
  exports: [UserService],
})
export class UserModule {}
