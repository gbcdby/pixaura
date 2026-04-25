/**
 * 内部音频生成 Controller
 * 供其他模块调用的内部接口
 */
import { Controller, Post, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { AudioGenerationService } from "../services/audio-generation.service";
import {
  InternalTTSDto,
  InternalLipSyncDto,
  InternalMixingDto,
  InternalMasterMixDto,
} from "@pixaura/shared-types";

@ApiTags("内部 - 音频生成")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("internal/audio-gen")
export class InternalAudioGenerationController {
  constructor(private audioGenService: AudioGenerationService) {}

  /**
   * 内部 TTS 生成
   * 供 video-gen 模块调用
   */
  @Post("tts")
  @ApiOperation({
    summary: "内部 TTS 生成",
    description: "供 video-gen 模块调用",
  })
  async internalTTS(@Body() dto: InternalTTSDto) {
    // 转换为标准 TTS DTO
    const result = await this.audioGenService.createTTSTask("system", {
      projectId: dto.projectId,
      config: {
        text: dto.text,
        speakerId: dto.speakerId,
        emotion: dto.emotion as
          | "neutral"
          | "happy"
          | "sad"
          | "angry"
          | "excited"
          | "fearful"
          | "surprised"
          | undefined,
        speed: dto.speed ?? 1.0,
        targetDuration: dto.targetDuration,
      },
      outputConfig: { format: "wav" },
      notifyWs: false,
    });

    return {
      code: 0,
      data: {
        audioUrl: "",
        duration: 0,
        format: "wav",
        taskId: result.taskId,
      },
      msg: "success",
    };
  }

  /**
   * 内部对口型合成
   * 供 video-gen 模块调用
   */
  @Post("lip-sync")
  @ApiOperation({
    summary: "内部对口型合成",
    description: "供 video-gen 模块调用",
  })
  async internalLipSync(@Body() dto: InternalLipSyncDto) {
    const result = await this.audioGenService.createLipSyncTask("system", {
      projectId: dto.projectId,
      config: {
        videoUrl: dto.videoUrl,
        audioUrl: dto.audioUrl,
        characterId: dto.characterId,
        referenceMode: dto.referenceMode,
      },
      notifyWs: false,
    });

    return {
      code: 0,
      data: {
        videoUrl: "",
        syncedRegions: [],
        taskId: result.taskId,
      },
      msg: "success",
    };
  }

  /**
   * 内部混音
   * 供 video-gen 模块调用
   */
  @Post("mix")
  @ApiOperation({
    summary: "内部音频混音",
    description: "供 video-gen 模块调用",
  })
  async internalMixing(@Body() dto: InternalMixingDto) {
    const tracks = dto.tracks.map((t, index) => ({
      trackId: `track_${index}`,
      trackType: "dialogue" as const,
      audioUrl: t.audioUrl,
      startTime: t.startTime,
      endTime: t.endTime,
      volume: t.volume,
    }));

    const result = await this.audioGenService.createMixingTask("system", {
      projectId: dto.projectId,
      config: {
        tracks,
        normalize: true,
        targetLufs: -14,
      },
      outputConfig: { format: dto.outputFormat },
      notifyWs: false,
    });

    return {
      code: 0,
      data: {
        mixedAudioUrl: "",
        duration: 0,
        taskId: result.taskId,
      },
      msg: "success",
    };
  }

  /**
   * 全局混音
   * 供 video-edit 模块调用 (Step 5)
   */
  @Post("master-mix")
  @ApiOperation({
    summary: "全局混音",
    description: "供 video-edit 模块调用（Step 5）",
  })
  async masterMix(@Body() dto: InternalMasterMixDto) {
    // 这里应该实现全局混音逻辑，包括：
    // 1. 对白 TTS 生成
    // 2. 旁白 TTS 生成
    // 3. BGM 匹配
    // 4. 环境音生成
    // 5. 多轨道混音

    // 简化实现：创建混音任务
    const tracks = [
      ...dto.audioClips.dialogueClips.map((clip, index) => ({
        trackId: `dialogue_${index}`,
        trackType: "dialogue" as const,
        audioUrl: clip.audioUrl,
        startTime: clip.startTime,
        endTime: clip.endTime,
        volume: 1.0,
      })),
    ];

    const result = await this.audioGenService.createMixingTask("system", {
      projectId: dto.projectId,
      config: {
        tracks,
        normalize: true,
        targetLufs: dto.outputConfig.targetLufs,
      },
      outputConfig: { format: dto.outputConfig.format },
      notifyWs: false,
    });

    return {
      code: 0,
      data: {
        taskId: result.taskId,
        status: result.status,
      },
      msg: "success",
    };
  }
}
