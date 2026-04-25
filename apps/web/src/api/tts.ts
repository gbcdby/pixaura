/**
 * TTS 音色和指令模板 API
 */
import { api } from "@/utils/request";

export type VoiceGender = "female" | "male" | "child" | "dialect";

export interface TTSVoiceDto {
  id: string;
  voiceId: string;
  name: string;
  gender: VoiceGender;
  category?: "standard" | "dialect";
  style?: string;
  previewAudioUrl?: string;
  isActive: boolean;
  sortOrder: number;
}

export interface TTSInstructionTemplateDto {
  id: string;
  name: string;
  description?: string;
  category?: string;
  content: string;
  isSystem: boolean;
  isActive?: boolean;
}

// 创建音色请求
export interface CreateTTSVoiceDto {
  voiceId: string;
  name: string;
  gender: VoiceGender;
  category?: "standard" | "dialect";
  style?: string;
  previewAudioUrl?: string;
  sortOrder?: number;
}

// 更新音色请求
export interface UpdateTTSVoiceDto {
  name?: string;
  gender?: VoiceGender;
  category?: "standard" | "dialect";
  style?: string;
  previewAudioUrl?: string;
  sortOrder?: number;
}

// 创建指令模板请求
export interface CreateTTSInstructionTemplateDto {
  name: string;
  description?: string;
  category?: string;
  content: string;
}

// 更新指令模板请求
export interface UpdateTTSInstructionTemplateDto {
  name?: string;
  description?: string;
  category?: string;
  content?: string;
  isActive?: boolean;
}

/**
 * TTS API
 */
export const ttsApi = {
  /**
   * 获取所有音色
   */
  getVoices(): Promise<TTSVoiceDto[]> {
    return api.get("/tts/voices") as Promise<TTSVoiceDto[]>;
  },

  /**
   * 按性别获取音色
   */
  getVoicesByGender(gender: string): Promise<TTSVoiceDto[]> {
    return api.get(`/tts/voices/by-gender/${gender}`) as Promise<TTSVoiceDto[]>;
  },

  /**
   * 按分类获取音色
   */
  getVoicesByCategory(category: string): Promise<TTSVoiceDto[]> {
    return api.get(`/tts/voices/by-category/${category}`) as Promise<
      TTSVoiceDto[]
    >;
  },

  /**
   * 获取单个音色
   */
  getVoice(voiceId: string): Promise<TTSVoiceDto> {
    return api.get(`/tts/voices/${voiceId}`) as Promise<TTSVoiceDto>;
  },

  /**
   * 获取所有指令模板
   */
  getInstructionTemplates(): Promise<TTSInstructionTemplateDto[]> {
    return api.get("/tts/instruction-templates") as Promise<
      TTSInstructionTemplateDto[]
    >;
  },

  /**
   * 按分类获取指令模板
   */
  getInstructionTemplatesByCategory(
    category: string,
  ): Promise<TTSInstructionTemplateDto[]> {
    return api.get(
      `/tts/instruction-templates/by-category/${category}`,
    ) as Promise<TTSInstructionTemplateDto[]>;
  },

  /**
   * 获取单个指令模板
   */
  getInstructionTemplate(id: string): Promise<TTSInstructionTemplateDto> {
    return api.get(
      `/tts/instruction-templates/${id}`,
    ) as Promise<TTSInstructionTemplateDto>;
  },
};

/**
 * TTS 管理后台 API
 */
export const ttsAdminApi = {
  // ========== 音色管理 ==========

  /**
   * 获取所有音色（管理端，包括禁用的）
   */
  getAllVoices(): Promise<TTSVoiceDto[]> {
    return api.get("/admin/tts/voices").then((res: any) => res.voices);
  },

  /**
   * 创建音色
   */
  createVoice(data: CreateTTSVoiceDto): Promise<TTSVoiceDto> {
    return api.post("/admin/tts/voices", data).then((res: any) => res.voice);
  },

  /**
   * 更新音色
   */
  updateVoice(id: string, data: UpdateTTSVoiceDto): Promise<TTSVoiceDto> {
    return api
      .patch(`/admin/tts/voices/${id}`, data)
      .then((res: any) => res.voice);
  },

  /**
   * 删除音色
   */
  deleteVoice(id: string): Promise<void> {
    return api.delete(`/admin/tts/voices/${id}`);
  },

  /**
   * 切换音色启用状态
   */
  toggleVoiceActive(id: string): Promise<TTSVoiceDto> {
    return api
      .patch(`/admin/tts/voices/${id}/toggle-active`)
      .then((res: any) => res.voice);
  },

  // ========== 指令模板管理 ==========

  /**
   * 创建指令模板
   */
  createInstructionTemplate(
    data: CreateTTSInstructionTemplateDto,
  ): Promise<TTSInstructionTemplateDto> {
    return api.post(
      "/admin/tts/instruction-templates",
      data,
    ) as Promise<TTSInstructionTemplateDto>;
  },

  /**
   * 更新指令模板
   */
  updateInstructionTemplate(
    id: string,
    data: UpdateTTSInstructionTemplateDto,
  ): Promise<TTSInstructionTemplateDto> {
    return api.patch(
      `/admin/tts/instruction-templates/${id}`,
      data,
    ) as Promise<TTSInstructionTemplateDto>;
  },

  /**
   * 删除指令模板
   */
  deleteInstructionTemplate(id: string): Promise<void> {
    return api.delete(
      `/admin/tts/instruction-templates/${id}`,
    ) as Promise<void>;
  },
};
