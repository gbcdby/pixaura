/**
 * 剧本对话音频控制器
 * 提供分镜对话音频生成 API
 */
import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Param,
  Body,
  UseGuards,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import {
  ScriptAudioService,
  DialogueAudioGenerateRequest,
} from "../services/script-audio.service";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { ProjectGuard } from "../../project/guards/project.guard";
import { BgmTrack } from "@pixaura/shared-types";

@Controller("projects/:projectId/scripts/:scriptId")
@UseGuards(JwtAuthGuard, ProjectGuard)
export class ScriptAudioController {
  constructor(private readonly scriptAudioService: ScriptAudioService) {}

  /**
   * 生成单条对话音频
   * POST /projects/:projectId/scripts/:scriptId/storyboards/:storyboardId/dialogues/:dialogueId/audio
   */
  @Post("storyboards/:storyboardId/dialogues/:dialogueId/audio")
  async generateDialogueAudio(
    @Param("projectId") projectId: string,
    @Param("scriptId") scriptId: string,
    @Param("storyboardId") storyboardId: string,
    @Param("dialogueId") dialogueId: string,
    @Body() body: DialogueAudioGenerateRequest,
  ) {
    try {
      const result = await this.scriptAudioService.generateDialogueAudio(
        scriptId,
        storyboardId,
        dialogueId,
        body,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error("生成对话音频失败:", error);
      throw new HttpException(
        `生成对话音频失败: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 获取对话音频状态
   * GET /projects/:projectId/scripts/:scriptId/storyboards/:storyboardId/dialogues/:dialogueId/audio
   */
  @Get("storyboards/:storyboardId/dialogues/:dialogueId/audio")
  async getDialogueAudioStatus(
    @Param("projectId") projectId: string,
    @Param("scriptId") scriptId: string,
    @Param("storyboardId") storyboardId: string,
    @Param("dialogueId") dialogueId: string,
  ) {
    const result = await this.scriptAudioService.getDialogueAudioStatus(
      scriptId,
      storyboardId,
      dialogueId,
    );

    return {
      success: true,
      data: result,
    };
  }

  /**
   * 删除对话音频
   * DELETE /projects/:projectId/scripts/:scriptId/storyboards/:storyboardId/dialogues/:dialogueId/audio
   */
  @Delete("storyboards/:storyboardId/dialogues/:dialogueId/audio")
  async deleteDialogueAudio(
    @Param("projectId") projectId: string,
    @Param("scriptId") scriptId: string,
    @Param("storyboardId") storyboardId: string,
    @Param("dialogueId") dialogueId: string,
  ) {
    const result = await this.scriptAudioService.deleteDialogueAudio(
      scriptId,
      storyboardId,
      dialogueId,
    );

    return {
      success: true,
      message: "对话音频已删除",
      data: result,
    };
  }

  /**
   * 批量生成分镜所有对话音频
   * POST /projects/:projectId/scripts/:scriptId/storyboards/:storyboardId/audio/generate-all
   */
  @Post("storyboards/:storyboardId/audio/generate-all")
  async generateStoryboardAudio(
    @Param("projectId") projectId: string,
    @Param("scriptId") scriptId: string,
    @Param("storyboardId") storyboardId: string,
    @Body() body: DialogueAudioGenerateRequest,
  ) {
    const results = await this.scriptAudioService.generateStoryboardAudio(
      scriptId,
      storyboardId,
      body,
    );

    return {
      success: true,
      data: {
        total: results.length,
        results,
      },
    };
  }

  // ==================== BGM 配乐轨道 API ====================

  /**
   * 获取所有 BGM 轨道
   * GET /projects/:projectId/scripts/:scriptId/bgm
   */
  @Get("bgm")
  async getBgmTracks(
    @Param("projectId") projectId: string,
    @Param("scriptId") scriptId: string,
  ) {
    const tracks = await this.scriptAudioService.getBgmTracks(scriptId);
    return {
      success: true,
      data: tracks,
    };
  }

  /**
   * 添加 BGM 轨道
   * POST /projects/:projectId/scripts/:scriptId/bgm
   */
  @Post("bgm")
  async addBgmTrack(
    @Param("projectId") projectId: string,
    @Param("scriptId") scriptId: string,
    @Body() body: BgmTrack,
  ) {
    const track = await this.scriptAudioService.addBgmTrack(scriptId, body);
    return {
      success: true,
      data: track,
    };
  }

  /**
   * 更新 BGM 轨道
   * PATCH /projects/:projectId/scripts/:scriptId/bgm/:bgmId
   */
  @Patch("bgm/:bgmId")
  async updateBgmTrack(
    @Param("projectId") projectId: string,
    @Param("scriptId") scriptId: string,
    @Param("bgmId") bgmId: string,
    @Body() body: Partial<Omit<BgmTrack, "id">>,
  ) {
    const track = await this.scriptAudioService.updateBgmTrack(
      scriptId,
      bgmId,
      body,
    );
    return {
      success: true,
      data: track,
    };
  }

  /**
   * 删除 BGM 轨道
   * DELETE /projects/:projectId/scripts/:scriptId/bgm/:bgmId
   */
  @Delete("bgm/:bgmId")
  async deleteBgmTrack(
    @Param("projectId") projectId: string,
    @Param("scriptId") scriptId: string,
    @Param("bgmId") bgmId: string,
  ) {
    await this.scriptAudioService.deleteBgmTrack(scriptId, bgmId);
    return {
      success: true,
      message: "BGM 轨道已删除",
    };
  }
}
