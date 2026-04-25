/**
 * TTS 模块
 * 提供 TTS 音色和指令模板管理
 */
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TtsVoiceEntity } from "./entities/voice.entity";
import { TtsInstructionTemplateEntity } from "./entities/instruction-template.entity";
import { TtsVoiceService } from "./services/voice.service";
import { TtsInstructionTemplateService } from "./services/instruction-template.service";
import { TtsVoiceController } from "./controllers/voice.controller";
import { TtsInstructionTemplateController } from "./controllers/instruction-template.controller";
import { AdminTtsVoiceController } from "./controllers/admin-voice.controller";
import { AdminTtsInstructionTemplateController } from "./controllers/admin-instruction-template.controller";
import { UserModule } from "../user/user.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([TtsVoiceEntity, TtsInstructionTemplateEntity]),
    UserModule,
  ],
  controllers: [
    TtsVoiceController,
    TtsInstructionTemplateController,
    AdminTtsVoiceController,
    AdminTtsInstructionTemplateController,
  ],
  providers: [TtsVoiceService, TtsInstructionTemplateService],
  exports: [TtsVoiceService, TtsInstructionTemplateService],
})
export class TtsModule {}
