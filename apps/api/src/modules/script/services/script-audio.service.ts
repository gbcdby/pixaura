/**
 * 剧本对话音频服务
 * 处理分镜对话的 TTS 音频生成
 */
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Script } from "../entities/script.entity";
import { TTSService } from "../../audio-gen/services/tts.service";
import { BgmTrack } from "@pixaura/shared-types";

export interface DialogueAudioGenerateRequest {
  voiceId?: string;
  speed?: number;
  emotion?: string;
  // 千问 TTS 扩展
  instructions?: string; // 指令控制
}

export interface DialogueAudioResult {
  dialogueId: string;
  audioUrl: string;
  duration: number;
  status: "completed";
  shotGroupDuration: number;
}

export interface DeleteAudioResult {
  shotGroupDuration: number;
}

// 对话类型（包含音频字段）
interface DialogueWithAudio {
  id: string;
  characterId?: string;
  characterName: string;
  text: string;
  emotion?: string;
  isVoiceover: boolean;
  audioUrl?: string;
  audioDuration?: number;
  audioStatus?: "pending" | "processing" | "completed" | "failed";
  audioTaskId?: string;
  // 千问 TTS 字段
  voiceId?: string;
  instructions?: string;
}

// 分镜组类型（包含对话音频字段）- 使用 shotGroups 替代 storyboards
interface ShotGroupWithAudioDialogues {
  id: string;
  dialogues?: DialogueWithAudio[];
  [key: string]: unknown;
}

// 角色类型（包含音色配置）
interface CharacterWithVoice {
  id: string;
  name: string;
  voiceId?: string;
  voiceInstructions?: string;
  [key: string]: unknown;
}

// 剧本内容类型
interface ScriptContentWithVoice {
  characters?: CharacterWithVoice[];
  narrationVoiceId?: string;
  narrationInstructions?: string;
  // 使用 shotGroups 替代 storyboards
  shotGroups?: ShotGroupWithAudioDialogues[];
  // BGM 配乐轨道
  bgmTracks?: BgmTrack[];
}

@Injectable()
export class ScriptAudioService {
  private readonly logger = new Logger(ScriptAudioService.name);

  constructor(
    @InjectRepository(Script)
    private readonly scriptRepository: Repository<Script>,
    private readonly ttsService: TTSService,
  ) {}

  /**
   * 生成单条对话音频
   */
  async generateDialogueAudio(
    scriptId: string,
    storyboardId: string,
    dialogueId: string,
    options: DialogueAudioGenerateRequest = {},
  ): Promise<DialogueAudioResult> {
    // 1. 获取剧本
    const script = await this.scriptRepository.findOne({
      where: { id: scriptId },
    });

    if (!script) {
      throw new NotFoundException(`剧本 ${scriptId} 不存在`);
    }

    // 2. 查找分镜组和对话（使用 shotGroups 替代 storyboards）
    const content = script.content as ScriptContentWithVoice;
    const shotGroups = content?.shotGroups || [];
    const shotGroup = shotGroups.find((s) => s.id === storyboardId);

    if (!shotGroup) {
      throw new NotFoundException(`分镜组 ${storyboardId} 不存在`);
    }

    const dialogue = shotGroup.dialogues?.find((d) => d.id === dialogueId) as
      | DialogueWithAudio
      | undefined;

    if (!dialogue) {
      throw new NotFoundException(`对话 ${dialogueId} 不存在`);
    }

    if (!dialogue.text || dialogue.text.trim().length === 0) {
      throw new Error("对话文本为空，无法生成音频");
    }

    // 3. 确定音色配置（优先级：请求参数 > 对话配置 > 角色配置/旁白配置）
    const voiceConfig = this.resolveVoiceConfig(
      dialogue,
      content.characters || [],
      options,
      dialogue.isVoiceover,
      {
        voiceId: content.narrationVoiceId,
        instructions: content.narrationInstructions,
      },
    );

    // 4. 校验音色配置，必须有音色才能生成
    if (!voiceConfig || !voiceConfig.voiceId) {
      if (dialogue.isVoiceover) {
        throw new Error("旁白音色未配置，请先在剧本设置中选择旁白音色");
      } else {
        const character = (content.characters || []).find(
          (c) => c.id === dialogue.characterId,
        );
        const characterName =
          character?.name || dialogue.characterName || "未知角色";
        throw new Error(
          `该对话的角色【${characterName}】未配置音色，请先在角色列表中为角色选择音色`,
        );
      }
    }

    // 5. 更新状态为 processing
    await this.updateDialogueAudioStatus(
      script,
      storyboardId,
      dialogueId,
      "processing",
    );

    try {
      // 6. 调用 TTS 服务
      const result = await this.ttsService.generate({
        text: dialogue.text,
        voiceId: voiceConfig.voiceId,
        speed: options.speed || 1.0,
        emotion: options.emotion || dialogue.emotion,
        instructions: voiceConfig.instructions,
        projectId: script.projectId,
        scriptId: script.id,
      });

      // 7. 更新对话音频信息（含 shotGroup duration 自动计算）
      const shotGroupDuration = await this.updateDialogueAudio(
        script,
        storyboardId,
        dialogueId,
        result.audioUrl,
        result.duration,
      );

      this.logger.log(
        `对话音频生成完成: scriptId=${scriptId}, storyboardId=${storyboardId}, dialogueId=${dialogueId}, shotGroupDuration=${shotGroupDuration}`,
      );

      return {
        dialogueId,
        audioUrl: result.audioUrl,
        duration: result.duration,
        status: "completed",
        shotGroupDuration,
      };
    } catch (error) {
      // 更新状态为 failed
      await this.updateDialogueAudioStatus(
        script,
        storyboardId,
        dialogueId,
        "failed",
      );

      throw error;
    }
  }

  /**
   * 解析音色配置
   * 优先级：请求参数 > 对话配置 > 角色配置/旁白配置
   * @returns 音色配置，如果没有配置则返回 null
   */
  private resolveVoiceConfig(
    dialogue: DialogueWithAudio,
    characters: CharacterWithVoice[],
    options: DialogueAudioGenerateRequest,
    isVoiceover: boolean,
    narrationConfig?: { voiceId?: string; instructions?: string },
  ): { voiceId: string; instructions?: string } | null {
    // 1. 请求参数优先
    if (options.voiceId) {
      return {
        voiceId: options.voiceId,
        instructions: options.instructions,
      };
    }

    // 2. 对话自身配置
    if (dialogue.voiceId) {
      return {
        voiceId: dialogue.voiceId,
        instructions: dialogue.instructions || options.instructions,
      };
    }

    // 3. 旁白配置（仅当 isVoiceover=true 时）
    if (isVoiceover && narrationConfig?.voiceId) {
      return {
        voiceId: narrationConfig.voiceId,
        instructions: narrationConfig.instructions || options.instructions,
      };
    }

    // 4. 角色配置（非旁白）- 包含 voiceId 和 voiceInstructions
    if (!isVoiceover && dialogue.characterId) {
      const character = characters.find((c) => c.id === dialogue.characterId);
      if (character?.voiceId) {
        return {
          voiceId: character.voiceId,
          // 角色的专属指令优先于请求参数
          instructions: character.voiceInstructions || options.instructions,
        };
      }
    }

    // 5. 没有找到音色配置
    return null;
  }

  /**
   * 批量生成分镜组所有对话音频
   */
  async generateStoryboardAudio(
    scriptId: string,
    storyboardId: string,
    options: DialogueAudioGenerateRequest = {},
  ): Promise<DialogueAudioResult[]> {
    // 获取剧本
    const script = await this.scriptRepository.findOne({
      where: { id: scriptId },
    });

    if (!script) {
      throw new NotFoundException(`剧本 ${scriptId} 不存在`);
    }

    // 查找分镜组（使用 shotGroups 替代 storyboards）
    const content = script.content as ScriptContentWithVoice;
    const shotGroups = content?.shotGroups || [];
    const shotGroup = shotGroups.find((s) => s.id === storyboardId);

    if (!shotGroup) {
      throw new NotFoundException(`分镜组 ${storyboardId} 不存在`);
    }

    const dialogues = shotGroup.dialogues || [];

    if (dialogues.length === 0) {
      return [];
    }

    const results: DialogueAudioResult[] = [];

    for (let i = 0; i < dialogues.length; i++) {
      const dialogue = dialogues[i] as DialogueWithAudio;

      if (!dialogue.text || dialogue.text.trim().length === 0) {
        continue;
      }

      try {
        const result = await this.generateDialogueAudio(
          scriptId,
          storyboardId,
          dialogue.id,
          options,
        );
        results.push(result);
      } catch (error) {
        this.logger.error(
          `对话音频生成失败: dialogueId=${dialogue.id}, error=${(error as Error).message}`,
        );
      }
    }

    return results;
  }

  /**
   * 获取对话音频状态
   */
  async getDialogueAudioStatus(
    scriptId: string,
    storyboardId: string,
    dialogueId: string,
  ): Promise<{
    audioUrl?: string;
    audioDuration?: number;
    audioStatus?: string;
  }> {
    const script = await this.scriptRepository.findOne({
      where: { id: scriptId },
    });

    if (!script) {
      throw new NotFoundException(`剧本 ${scriptId} 不存在`);
    }

    // 使用 shotGroups 替代 storyboards
    const content = script.content as ScriptContentWithVoice;
    const shotGroups = content?.shotGroups || [];
    const shotGroup = shotGroups.find((s) => s.id === storyboardId);

    if (!shotGroup) {
      throw new NotFoundException(`分镜组 ${storyboardId} 不存在`);
    }

    const dialogue = shotGroup.dialogues?.find((d) => d.id === dialogueId) as
      | DialogueWithAudio
      | undefined;

    if (!dialogue) {
      throw new NotFoundException(`对话 ${dialogueId} 不存在`);
    }

    return {
      audioUrl: dialogue.audioUrl,
      audioDuration: dialogue.audioDuration,
      audioStatus: dialogue.audioStatus,
    };
  }

  /**
   * 删除对话音频
   */
  async deleteDialogueAudio(
    scriptId: string,
    storyboardId: string,
    dialogueId: string,
  ): Promise<DeleteAudioResult> {
    const script = await this.scriptRepository.findOne({
      where: { id: scriptId },
    });

    if (!script) {
      throw new NotFoundException(`剧本 ${scriptId} 不存在`);
    }

    const shotGroupDuration = await this.updateDialogueAudio(
      script,
      storyboardId,
      dialogueId,
      undefined,
      undefined,
    );

    this.logger.log(
      `对话音频已删除: scriptId=${scriptId}, storyboardId=${storyboardId}, dialogueId=${dialogueId}, newDuration=${shotGroupDuration}`,
    );

    return { shotGroupDuration };
  }

  /**
   * 更新对话音频状态
   */
  private async updateDialogueAudioStatus(
    script: Script,
    storyboardId: string,
    dialogueId: string,
    status: "pending" | "processing" | "completed" | "failed",
  ): Promise<void> {
    const content = script.content as Record<string, unknown>;
    // 使用 shotGroups 替代 storyboards
    const shotGroups = (content.shotGroups ||
      []) as ShotGroupWithAudioDialogues[];
    const shotGroupIndex = shotGroups.findIndex((s) => s.id === storyboardId);

    if (shotGroupIndex === -1) return;

    const shotGroup = shotGroups[shotGroupIndex];
    const dialogueIndex = shotGroup.dialogues?.findIndex(
      (d) => d.id === dialogueId,
    );

    if (dialogueIndex === undefined || dialogueIndex === -1) return;

    // 更新状态
    shotGroups[shotGroupIndex].dialogues![dialogueIndex].audioStatus = status;

    // 保存
    script.content = { ...content, shotGroups };
    await this.scriptRepository.save(script);
  }

  /**
   * 计算分镜组时长（所有已完成对话音频时长之和，向上取整）
   */
  private calculateShotGroupDuration(
    shotGroup: ShotGroupWithAudioDialogues,
  ): number {
    const dialogues = shotGroup.dialogues || [];
    const totalDuration = dialogues
      .filter(
        (d) =>
          d.audioStatus === "completed" && typeof d.audioDuration === "number",
      )
      .reduce((sum, d) => sum + (d.audioDuration ?? 0), 0);
    return Math.ceil(totalDuration) || 3; // 无音频时回到默认值 3 秒
  }

  /**
   * 更新对话音频信息
   * 同时自动重新计算并更新分镜组 duration
   * @returns 更新后的 shotGroupDuration
   */
  private async updateDialogueAudio(
    script: Script,
    storyboardId: string,
    dialogueId: string,
    audioUrl?: string,
    duration?: number,
  ): Promise<number> {
    const content = script.content as Record<string, unknown>;
    // 使用 shotGroups 替代 storyboards
    const shotGroups = (content.shotGroups ||
      []) as ShotGroupWithAudioDialogues[];
    const shotGroupIndex = shotGroups.findIndex((s) => s.id === storyboardId);

    if (shotGroupIndex === -1) return 0;

    const shotGroup = shotGroups[shotGroupIndex];
    const dialogueIndex = shotGroup.dialogues?.findIndex(
      (d) => d.id === dialogueId,
    );

    if (dialogueIndex === undefined || dialogueIndex === -1) return 0;

    // 更新音频信息
    const dialogue = shotGroups[shotGroupIndex].dialogues![dialogueIndex];
    dialogue.audioUrl = audioUrl;
    dialogue.audioDuration = duration;
    dialogue.audioStatus = audioUrl ? "completed" : undefined;

    // 自动重新计算分镜组时长
    const shotGroupDuration = this.calculateShotGroupDuration(
      shotGroups[shotGroupIndex],
    );
    shotGroups[shotGroupIndex].duration = shotGroupDuration;

    // 保存
    script.content = { ...content, shotGroups };
    await this.scriptRepository.save(script);

    return shotGroupDuration;
  }

  // ==================== BGM 配乐轨道管理 ====================

  /**
   * 添加 BGM 轨道
   */
  async addBgmTrack(
    scriptId: string,
    bgmTrack: BgmTrack,
  ): Promise<BgmTrack> {
    const script = await this.scriptRepository.findOne({
      where: { id: scriptId },
    });

    if (!script) {
      throw new NotFoundException(`剧本 ${scriptId} 不存在`);
    }

    const content = script.content as ScriptContentWithVoice;
    const bgmTracks = content.bgmTracks || [];

    // 检查是否已存在相同 ID
    const existingIndex = bgmTracks.findIndex((t) => t.id === bgmTrack.id);
    if (existingIndex !== -1) {
      // 更新已存在的轨道
      bgmTracks[existingIndex] = bgmTrack;
    } else {
      // 添加新轨道
      bgmTracks.push(bgmTrack);
    }

    // 保存
    script.content = { ...content, bgmTracks };
    await this.scriptRepository.save(script);

    this.logger.log(
      `BGM 轨道已添加: scriptId=${scriptId}, bgmId=${bgmTrack.id}`,
    );

    return bgmTrack;
  }

  /**
   * 删除 BGM 轨道
   */
  async deleteBgmTrack(
    scriptId: string,
    bgmId: string,
  ): Promise<void> {
    const script = await this.scriptRepository.findOne({
      where: { id: scriptId },
    });

    if (!script) {
      throw new NotFoundException(`剧本 ${scriptId} 不存在`);
    }

    const content = script.content as ScriptContentWithVoice;
    let bgmTracks = content.bgmTracks || [];

    // 过滤掉要删除的轨道
    bgmTracks = bgmTracks.filter((t) => t.id !== bgmId);

    // 保存
    script.content = { ...content, bgmTracks };
    await this.scriptRepository.save(script);

    this.logger.log(
      `BGM 轨道已删除: scriptId=${scriptId}, bgmId=${bgmId}`,
    );
  }

  /**
   * 更新 BGM 轨道
   */
  async updateBgmTrack(
    scriptId: string,
    bgmId: string,
    updates: Partial<Omit<BgmTrack, "id">>,
  ): Promise<BgmTrack> {
    const script = await this.scriptRepository.findOne({
      where: { id: scriptId },
    });

    if (!script) {
      throw new NotFoundException(`剧本 ${scriptId} 不存在`);
    }

    const content = script.content as ScriptContentWithVoice;
    const bgmTracks = content.bgmTracks || [];

    // 查找要更新的轨道
    const trackIndex = bgmTracks.findIndex((t) => t.id === bgmId);
    if (trackIndex === -1) {
      throw new NotFoundException(`BGM 轨道 ${bgmId} 不存在`);
    }

    // 更新轨道
    const updatedTrack = { ...bgmTracks[trackIndex], ...updates };
    bgmTracks[trackIndex] = updatedTrack as BgmTrack;

    // 保存
    script.content = { ...content, bgmTracks };
    await this.scriptRepository.save(script);

    this.logger.log(
      `BGM 轨道已更新: scriptId=${scriptId}, bgmId=${bgmId}`,
    );

    return updatedTrack as BgmTrack;
  }

  /**
   * 获取所有 BGM 轨道
   */
  async getBgmTracks(scriptId: string): Promise<BgmTrack[]> {
    const script = await this.scriptRepository.findOne({
      where: { id: scriptId },
    });

    if (!script) {
      throw new NotFoundException(`剧本 ${scriptId} 不存在`);
    }

    const content = script.content as ScriptContentWithVoice;
    return content.bgmTracks || [];
  }
}
