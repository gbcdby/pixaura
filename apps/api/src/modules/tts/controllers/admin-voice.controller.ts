/**
 * TTS 音色管理控制器（管理后台）
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { AdminAuthGuard } from "../../model-config/guards/admin-auth.guard";
import { TtsVoiceService, TtsVoiceDto } from "../services/voice.service";
import { CreateTtsVoiceDto, UpdateTtsVoiceDto } from "@pixaura/shared-types";

@ApiTags("TTS 管理 - 音色")
@Controller("/admin/tts/voices")
@UseGuards(JwtAuthGuard, AdminAuthGuard)
@ApiBearerAuth()
export class AdminTtsVoiceController {
  constructor(private readonly voiceService: TtsVoiceService) {}

  /**
   * 获取所有音色（包括禁用的）
   * GET /api/admin/tts/voices
   */
  @Get()
  @ApiOperation({ summary: "获取所有音色（管理端）" })
  async findAll(): Promise<{ voices: TtsVoiceDto[] }> {
    // 管理端需要看到所有音色，包括禁用的
    const voices = await this.voiceService.findAllIncludingInactive();
    return { voices };
  }

  /**
   * 创建音色
   * POST /api/admin/tts/voices
   */
  @Post()
  @ApiOperation({ summary: "创建音色" })
  async create(
    @Body() dto: CreateTtsVoiceDto,
  ): Promise<{ voice: TtsVoiceDto }> {
    const voice = await this.voiceService.create({
      voiceId: dto.voiceId,
      name: dto.name,
      gender: dto.gender,
      category: dto.category,
      style: dto.style,
      previewAudioUrl: dto.previewAudioUrl,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    });
    return { voice };
  }

  /**
   * 更新音色
   * PATCH /api/admin/tts/voices/:id
   */
  @Patch(":id")
  @ApiOperation({ summary: "更新音色" })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateTtsVoiceDto,
  ): Promise<{ voice: TtsVoiceDto }> {
    const voice = await this.voiceService.update(id, {
      voiceId: dto.voiceId,
      name: dto.name,
      gender: dto.gender,
      category: dto.category,
      style: dto.style,
      previewAudioUrl: dto.previewAudioUrl,
      isActive: dto.isActive,
      sortOrder: dto.sortOrder,
    });
    if (!voice) {
      throw new Error("音色不存在");
    }
    return { voice };
  }

  /**
   * 删除音色
   * DELETE /api/admin/tts/voices/:id
   */
  @Delete(":id")
  @ApiOperation({ summary: "删除音色" })
  async remove(@Param("id") id: string): Promise<{ success: boolean }> {
    const success = await this.voiceService.remove(id);
    return { success };
  }

  /**
   * 切换启用状态
   * PATCH /api/admin/tts/voices/:id/toggle-active
   */
  @Patch(":id/toggle-active")
  @ApiOperation({ summary: "切换音色启用状态" })
  async toggleActive(@Param("id") id: string): Promise<{ voice: TtsVoiceDto }> {
    const voice = await this.voiceService.toggleActive(id);
    if (!voice) {
      throw new Error("音色不存在");
    }
    return { voice };
  }
}
