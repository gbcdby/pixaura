import { ref, computed } from "vue";
import { defineStore } from "pinia";
import { h } from "vue";
import { modelConfigApi } from "@/api/model-config";
import { scriptApi } from "@/api/script";
import type { SelectOption } from "naive-ui";

/**
 * 带价格信息的模型选项类型（继承 Naive UI SelectOption）
 */
export interface ModelOptionWithPrice extends SelectOption {
  model: {
    modelId: string;
    modelName: string;
    pricePer1kTokens?: number;
    pricePerCall?: number;
    pricePerSecond?: number;
    pricePerChar?: number; // TTS 按字计费
  };
}

/**
 * 渲染模型选项标签（带价格信息，两端对齐布局）
 * @param option 选择器选项（兼容 Naive UI SelectOption）
 * @param modelOptions 带完整价格信息的模型选项列表（用于查找价格）
 * @returns VNode
 */
export function renderModelLabelWithPrice(
  option: SelectOption,
  modelOptions: ModelOptionWithPrice[],
): ReturnType<typeof h> {
  // 从模型选项中获取完整数据
  const valueStr = String(option.value ?? "");
  const labelStr = String(option.label ?? "");
  const modelOption = modelOptions.find((m) => String(m.value) === valueStr);
  if (!modelOption) {
    return h("span", labelStr);
  }

  const model = modelOption.model;

  // 构建价格文本
  let priceText = "";
  if (model.pricePer1kTokens) {
    priceText = `¥${model.pricePer1kTokens}/千token`;
  } else if (model.pricePerCall) {
    priceText = `¥${model.pricePerCall}/次`;
  } else if (model.pricePerSecond) {
    priceText = `¥${model.pricePerSecond}/秒`;
  } else if (model.pricePerChar) {
    priceText = `¥${model.pricePerChar}/字`;
  } else {
    priceText = "免费";
  }

  // 两端对齐布局：模型名称在左，价格在右
  return h("div", { style: "display: flex; justify-content: space-between; align-items: center; width: 100%;" }, [
    h("span", { style: "flex: 1; overflow: hidden; text-overflow: ellipsis;" }, labelStr),
    h("span", { style: "color: #999; font-size: 12px; margin-left: 8px;" }, priceText),
  ]);
}

/**
 * 渲染 ModelOptionWithPrice 类型的选项标签（带价格信息，两端对齐布局）
 * 用于选项已经是 ModelOptionWithPrice 类型的场景（如 ModelSelectors.vue）
 * @param option 带完整价格信息的模型选项
 * @returns VNode
 */
export function renderModelOptionWithPrice(
  option: ModelOptionWithPrice | SelectOption,
): ReturnType<typeof h> {
  const modelOption = option as ModelOptionWithPrice;
  const model = modelOption.model;
  const labelStr = String(option.label ?? "");

  // 如果没有 model 信息，只显示标签
  if (!model) {
    return h("span", labelStr);
  }

  // 构建价格文本
  let priceText = "";
  if (model.pricePer1kTokens) {
    priceText = `¥${model.pricePer1kTokens}/千token`;
  } else if (model.pricePerCall) {
    priceText = `¥${model.pricePerCall}/次`;
  } else if (model.pricePerSecond) {
    priceText = `¥${model.pricePerSecond}/秒`;
  } else if (model.pricePerChar) {
    priceText = `¥${model.pricePerChar}/字`;
  } else {
    priceText = "免费";
  }

  // 两端对齐布局：模型名称在左，价格在右
  return h("div", { style: "display: flex; justify-content: space-between; align-items: center; width: 100%;" }, [
    h("span", { style: "flex: 1; overflow: hidden; text-overflow: ellipsis;" }, labelStr),
    h("span", { style: "color: #999; font-size: 12px; margin-left: 8px;" }, priceText),
  ]);
}

/**
 * 系统配置中的模型价格
 */
interface SystemPrices {
  tts: {
    flash: { pricePerChar: number };
    instructFlash: { pricePerChar: number };
  };
  lipSync: {
    pricePerSecond: number;
    subjectDetection: { pricePerRequest: number };
  };
}

export const useScriptModelsStore = defineStore("script-models", () => {
  // 状态
  const availableModels = ref<
    Array<{
      modelId: string;
      modelName: string;
      category: string;
      defaultParams: Record<string, unknown>;
      pricePer1kTokens?: number;
      pricePerCall?: number;
      pricePerSecond?: number;
    }>
  >([]);
  // 系统配置中的价格
  const systemPrices = ref<SystemPrices | null>(null);
  // 剧本模型配置：步骤 -> 模型ID
  const scriptModelConfigs = ref<Record<string, string>>({});
  const isLoading = ref(false);
  const hasLoaded = ref(false);
  const currentScriptId = ref<string>("");

  // 计算属性：文本生成模型选项（带价格信息）
  const textModelOptions = computed<ModelOptionWithPrice[]>(() => {
    const models = availableModels.value.filter(
      (m) => m.category === "TEXT_GENERATION",
    );
    return models.map((model) => ({
      label: model.modelName,
      value: model.modelId,
      model: {
        modelId: model.modelId,
        modelName: model.modelName,
        pricePer1kTokens: model.pricePer1kTokens,
        pricePerCall: model.pricePerCall,
        pricePerSecond: model.pricePerSecond,
      },
    }));
  });

  // 计算属性：图像生成模型选项（已废弃，请使用 getImageModelOptionsForStep）
  const imageModelOptions = computed<ModelOptionWithPrice[]>(() => {
    const models = availableModels.value.filter(
      (m) => m.category === "IMAGE_GENERATION",
    );
    // 默认使用 characters 步骤的配置
    return models.map((model) => ({
      label: model.modelName,
      value: model.modelId,
      model: {
        modelId: model.modelId,
        modelName: model.modelName,
        pricePer1kTokens: model.pricePer1kTokens,
        pricePerCall: model.pricePerCall,
        pricePerSecond: model.pricePerSecond,
      },
    }));
  });

  // 获取指定图像生成步骤的模型选项（每个步骤独立配置，带价格信息）
  function getImageModelOptionsForStep(_step: string): ModelOptionWithPrice[] {
    const models = availableModels.value.filter(
      (m) => m.category === "IMAGE_GENERATION",
    );
    // 每个步骤使用自己的配置
    return models.map((model) => ({
      label: model.modelName,
      value: model.modelId,
      model: {
        modelId: model.modelId,
        modelName: model.modelName,
        pricePer1kTokens: model.pricePer1kTokens,
        pricePerCall: model.pricePerCall,
        pricePerSecond: model.pricePerSecond,
      },
    }));
  }

  // 获取指定类别的模型选项（带价格信息）
  function getModelsByCategory(category: string): ModelOptionWithPrice[] {
    // Bug 修复：LIP_SYNC 类别的模型不在 ai_models 表中注册
    // OmniHuman 是独立的对口型模型，价格在系统配置中
    if (category === "LIP_SYNC") {
      const lipSyncPrice = systemPrices.value?.lipSync?.pricePerSecond;
      return [
        {
          label: "OmniHuman1.5",
          value: "omnihuman-1.5",
          model: {
            modelId: "omnihuman-1.5",
            modelName: "OmniHuman1.5",
            pricePerSecond: lipSyncPrice,
          },
        },
      ];
    }
    return availableModels.value
      .filter((m) => m.category === category)
      .map((model) => ({
        label: model.modelName,
        value: model.modelId,
        model: {
          modelId: model.modelId,
          modelName: model.modelName,
          pricePer1kTokens: model.pricePer1kTokens,
          pricePerCall: model.pricePerCall,
          pricePerSecond: model.pricePerSecond,
        },
      }));
  }

  // 获取分镜步骤的各类型模型选项（独立选择器）
  const imageGenerationModels = computed<ModelOptionWithPrice[]>(() =>
    getModelsByCategory("IMAGE_GENERATION"),
  );
  const videoGenerationModels = computed<ModelOptionWithPrice[]>(() =>
    getModelsByCategory("VIDEO_GENERATION"),
  );
  // 对口型模型使用硬编码选项（OmniHuman 不在 ai_models 表中）
  const lipSyncModels = computed<ModelOptionWithPrice[]>(() => getModelsByCategory("LIP_SYNC"));

  // 计算属性：BGM 生成模型选项（带价格信息）
  const bgmModelOptions = computed<ModelOptionWithPrice[]>(() => {
    const models = availableModels.value.filter(
      (m) => m.category === "AUDIO_GENERATION" || m.category === "VOICE_GENERATION",
    );
    return models.map((model) => {
      // TTS 模型使用系统配置中的价格
      let pricePerChar: number | undefined;
      if (model.modelId === "qwen3-tts-flash") {
        pricePerChar = systemPrices.value?.tts?.flash?.pricePerChar;
      } else if (model.modelId === "qwen3-tts-instruct-flash") {
        pricePerChar = systemPrices.value?.tts?.instructFlash?.pricePerChar;
      }

      return {
        label: model.modelName,
        value: model.modelId,
        model: {
          modelId: model.modelId,
          modelName: model.modelName,
          pricePer1kTokens: model.pricePer1kTokens,
          pricePerCall: model.pricePerCall,
          pricePerSecond: model.pricePerSecond,
          pricePerChar,
        },
      };
    });
  });

  // 获取指定步骤的默认模型ID
  function getDefaultModelId(step: string): string {
    return scriptModelConfigs.value[step] || "";
  }

  // 加载模型数据和剧本配置
  // scriptId 可选，当创建新剧本时可以不传
  // fetchPrices 控制是否获取系统价格（只有需要 TTS/LipSync 价格时才需要）
  async function loadModels(projectId: string, scriptId?: string, fetchPrices = false) {
    if (
      scriptId &&
      hasLoaded.value &&
      isLoading.value === false &&
      currentScriptId.value === scriptId
    ) {
      return;
    }

    isLoading.value = true;
    if (scriptId) {
      currentScriptId.value = scriptId;
    }

    try {
      // 如果没有 scriptId，只加载可用模型列表（按需获取系统价格）
      if (!scriptId) {
        const promises: Promise<unknown>[] = [
          modelConfigApi.getModels(),
        ];
        if (fetchPrices) {
          promises.push(modelConfigApi.getSystemPrices().catch(() => null));
        }
        const results = await Promise.all(promises);
        const modelsData = results[0] as any;
        const pricesData = fetchPrices ? (results[1] as any) : null;
        // 保存系统价格
        systemPrices.value = pricesData;
        // 处理可用模型列表
        const allModels: Array<{
          modelId: string;
          modelName: string;
          category: string;
          defaultParams: Record<string, unknown>;
          pricePer1kTokens?: number;
          pricePerCall?: number;
          pricePerSecond?: number;
        }> = [];
        for (const category of modelsData) {
          for (const model of category.models) {
            allModels.push({
              modelId: model.modelId,
              modelName: model.modelName,
              category: category.category,
              defaultParams: model.defaultParams || {},
              pricePer1kTokens: model.pricePer1kTokens,
              pricePerCall: model.pricePerCall,
              pricePerSecond: model.pricePerSecond,
            });
          }
        }
        availableModels.value = allModels;
        hasLoaded.value = true;
        return;
      }

      // 有 scriptId 时，并行加载可用模型列表和剧本模型配置（按需获取系统价格）
      const promises: Promise<unknown>[] = [
        modelConfigApi.getModels(),
        scriptApi.getScriptModelConfigs(projectId, scriptId),
      ];
      if (fetchPrices) {
        promises.push(modelConfigApi.getSystemPrices().catch(() => null));
      }
      const results = await Promise.all(promises);
      const modelsData = results[0] as any;
      const configsData = results[1] as any;
      const pricesData = fetchPrices ? (results[2] as any) : null;

      // 保存系统价格
      systemPrices.value = pricesData;

      // 处理可用模型列表
      const allModels: Array<{
        modelId: string;
        modelName: string;
        category: string;
        defaultParams: Record<string, unknown>;
        pricePer1kTokens?: number;
        pricePerCall?: number;
        pricePerSecond?: number;
      }> = [];
      for (const category of modelsData) {
        for (const model of category.models) {
          allModels.push({
            modelId: model.modelId,
            modelName: model.modelName,
            category: category.category,
            defaultParams: model.defaultParams || {},
            pricePer1kTokens: model.pricePer1kTokens,
            pricePerCall: model.pricePerCall,
            pricePerSecond: model.pricePerSecond,
          });
        }
      }
      availableModels.value = allModels;

      // 处理剧本模型配置
      const configs: Record<string, string> = {};
      for (const item of configsData.configs) {
        if (item.modelId) {
          configs[item.step] = item.modelId;
        }
      }
      scriptModelConfigs.value = configs;

      hasLoaded.value = true;
    } catch (error) {
      console.error("加载模型数据失败:", error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  }

  // 更新剧本模型配置
  async function updateScriptModelConfig(
    projectId: string,
    scriptId: string,
    step: string,
    modelId: string,
  ) {
    // 更新本地状态
    scriptModelConfigs.value[step] = modelId;

    // 调用 API 更新
    await scriptApi.updateScriptModelConfigs(projectId, scriptId, {
      configs: { [step]: modelId },
    });
  }

  // 批量更新剧本模型配置
  async function updateScriptModelConfigs(
    projectId: string,
    scriptId: string,
    configs: Record<string, string>,
  ) {
    // 更新本地状态
    for (const [step, modelId] of Object.entries(configs)) {
      scriptModelConfigs.value[step] = modelId;
    }

    // 调用 API 更新
    await scriptApi.updateScriptModelConfigs(projectId, scriptId, {
      configs,
    });
  }

  // 获取指定模型的 defaultParams
  function getModelDefaultParams(modelId: string): Record<string, unknown> {
    return (
      availableModels.value.find((m) => m.modelId === modelId)?.defaultParams ||
      {}
    );
  }

  // 重置状态
  function reset() {
    availableModels.value = [];
    systemPrices.value = null;
    scriptModelConfigs.value = {};
    isLoading.value = false;
    hasLoaded.value = false;
    currentScriptId.value = "";
  }

  return {
    availableModels,
    scriptModelConfigs,
    isLoading,
    hasLoaded,
    textModelOptions,
    imageModelOptions,
    bgmModelOptions,
    imageGenerationModels,
    videoGenerationModels,
    lipSyncModels,
    getDefaultModelId,
    getImageModelOptionsForStep,
    getModelsByCategory,
    getModelDefaultParams,
    loadModels,
    updateScriptModelConfig,
    updateScriptModelConfigs,
    reset,
  };
});
