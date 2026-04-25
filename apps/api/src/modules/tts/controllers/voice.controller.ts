/**
 * TTS 音色控制器
 */
import {
  Controller,
  Get,
  Param,
  Query,
  NotFoundException,
  Res,
} from "@nestjs/common";
import { FastifyReply } from "fastify";
import { TtsVoiceService, TtsVoiceDto } from "../services/voice.service";

@Controller("tts")
export class TtsVoiceController {
  constructor(private readonly voiceService: TtsVoiceService) {}

  /**
   * 获取所有音色
   * GET /api/tts/voices
   */
  @Get("voices")
  async findAll(): Promise<TtsVoiceDto[]> {
    return this.voiceService.findAll();
  }

  /**
   * 按性别获取音色
   * GET /api/tts/voices/by-gender/:gender
   */
  @Get("voices/by-gender/:gender")
  async findByGender(@Param("gender") gender: string): Promise<TtsVoiceDto[]> {
    return this.voiceService.findByGender(gender);
  }

  /**
   * 按分类获取音色
   * GET /api/tts/voices/by-category/:category
   */
  @Get("voices/by-category/:category")
  async findByCategory(
    @Param("category") category: string,
  ): Promise<TtsVoiceDto[]> {
    return this.voiceService.findByCategory(category);
  }

  /**
   * 获取单个音色
   * GET /api/tts/voices/:voiceId
   */
  @Get("voices/:voiceId")
  async findByVoiceId(
    @Param("voiceId") voiceId: string,
  ): Promise<TtsVoiceDto | null> {
    return this.voiceService.findByVoiceId(voiceId);
  }

  /**
   * 获取音色预览音频（代理接口，解决跨域问题）
   * GET /api/tts/voices/:id/preview-audio
   * 直接使用 Fastify 响应发送音频数据
   */
  @Get("voices/:id/preview-audio")
  async getPreviewAudio(
    @Param("id") id: string,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const voice = await this.voiceService.findById(id);
    if (!voice || !voice.previewAudioUrl) {
      throw new NotFoundException("音色预览音频不存在");
    }

    // 通过后端代理请求外部音频 URL
    const audioBuffer = await this.voiceService.fetchPreviewAudio(
      voice.previewAudioUrl,
    );

    // 设置响应头并发送音频数据
    reply
      .header("Content-Type", "audio/mpeg")
      .header("Content-Length", audioBuffer.length)
      .send(audioBuffer);
  }
}
