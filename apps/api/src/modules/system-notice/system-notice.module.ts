import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SystemNotice } from "./entities/system-notice.entity";
import { UserModule } from "../user/user.module";
import { NoticeService } from "./services";
import { AdminNoticeController, ClientNoticeController } from "./controllers";

@Module({
  imports: [TypeOrmModule.forFeature([SystemNotice]), UserModule],
  controllers: [AdminNoticeController, ClientNoticeController],
  providers: [NoticeService],
  exports: [NoticeService],
})
export class SystemNoticeModule {}
