/**
 * TTS Store
 * 集中管理 TTS 音色和指令模板数据，避免重复请求
 */
import { ref, computed } from "vue";
import { defineStore } from "pinia";
import { ttsApi, type TTSVoiceDto, type TTSInstructionTemplateDto } from "@/api/tts";

export const useTtsStore = defineStore("tts", () => {
  // ==================== 音色状态 ====================
  const voices = ref<TTSVoiceDto[]>([]);
  const voicesLoading = ref(false);
  const voicesLoaded = ref(false);

  // ==================== 指令模板状态 ====================
  const instructionTemplates = ref<TTSInstructionTemplateDto[]>([]);
  const instructionTemplatesLoading = ref(false);
  const instructionTemplatesLoaded = ref(false);

  // ==================== 音色计算属性 ====================
  // 按性别分类的音色
  const femaleVoices = computed(() =>
    voices.value.filter(v => v.gender === "female" && v.category !== "dialect" && v.isActive),
  );
  const maleVoices = computed(() =>
    voices.value.filter(v => v.gender === "male" && v.category !== "dialect" && v.isActive),
  );
  const childVoices = computed(() =>
    voices.value.filter(v => v.gender === "child" && v.category !== "dialect" && v.isActive),
  );
  const dialectVoices = computed(() =>
    voices.value.filter(v => v.category === "dialect" && v.isActive),
  );

  // 所有启用的音色
  const activeVoices = computed(() =>
    voices.value.filter(v => v.isActive),
  );

  // ==================== 音色方法 ====================
  /**
   * 加载音色列表（仅请求一次，后续从缓存获取）
   */
  async function loadVoices() {
    // 已加载过，直接返回
    if (voicesLoaded.value) {
      return voices.value;
    }
    // 正在加载中，等待完成
    if (voicesLoading.value) {
      // 等待加载完成
      await new Promise<void>((resolve) => {
        const checkLoaded = () => {
          if (voicesLoaded.value) {
            resolve();
          } else {
            setTimeout(checkLoaded, 50);
          }
        };
        checkLoaded();
      });
      return voices.value;
    }

    voicesLoading.value = true;
    try {
      const data = await ttsApi.getVoices();
      voices.value = data;
      voicesLoaded.value = true;
      return data;
    } catch (error) {
      console.error("加载音色列表失败:", error);
      throw error;
    } finally {
      voicesLoading.value = false;
    }
  }

  /**
   * 根据 voiceId 获取音色信息
   */
  function getVoiceByVoiceId(voiceId: string): TTSVoiceDto | undefined {
    return voices.value.find(v => v.voiceId === voiceId);
  }

  /**
   * 根据 id 获取音色信息
   */
  function getVoiceById(id: string): TTSVoiceDto | undefined {
    return voices.value.find(v => v.id === id);
  }

  // ==================== 指令模板方法 ====================
  /**
   * 加载指令模板列表（仅请求一次，后续从缓存获取）
   */
  async function loadInstructionTemplates() {
    // 已加载过，直接返回
    if (instructionTemplatesLoaded.value) {
      return instructionTemplates.value;
    }
    // 正在加载中，等待完成
    if (instructionTemplatesLoading.value) {
      await new Promise<void>((resolve) => {
        const checkLoaded = () => {
          if (instructionTemplatesLoaded.value) {
            resolve();
          } else {
            setTimeout(checkLoaded, 50);
          }
        };
        checkLoaded();
      });
      return instructionTemplates.value;
    }

    instructionTemplatesLoading.value = true;
    try {
      const data = await ttsApi.getInstructionTemplates();
      instructionTemplates.value = data;
      instructionTemplatesLoaded.value = true;
      return data;
    } catch (error) {
      console.error("加载指令模板列表失败:", error);
      throw error;
    } finally {
      instructionTemplatesLoading.value = false;
    }
  }

  /**
   * 根据 id 获取指令模板
   */
  function getInstructionTemplateById(id: string): TTSInstructionTemplateDto | undefined {
    return instructionTemplates.value.find(t => t.id === id);
  }

  // ==================== 重置方法 ====================
  /**
   * 重置所有状态（用于退出页面时清理）
   */
  function reset() {
    voices.value = [];
    voicesLoading.value = false;
    voicesLoaded.value = false;
    instructionTemplates.value = [];
    instructionTemplatesLoading.value = false;
    instructionTemplatesLoaded.value = false;
  }

  return {
    // 音色状态
    voices,
    voicesLoading,
    voicesLoaded,
    femaleVoices,
    maleVoices,
    childVoices,
    dialectVoices,
    activeVoices,

    // 指令模板状态
    instructionTemplates,
    instructionTemplatesLoading,
    instructionTemplatesLoaded,

    // 音色方法
    loadVoices,
    getVoiceByVoiceId,
    getVoiceById,

    // 指令模板方法
    loadInstructionTemplates,
    getInstructionTemplateById,

    // 重置
    reset,
  };
});