/**
 * AI Provider 适配器接口
 * 定义所有 AI 提供商需要实现的方法
 */

export interface TextGenerationRequest {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  jsonMode?: boolean;
}

export interface TextGenerationResult {
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: string;
}

export interface ImageGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  /** 图片比例（如 "9:16" / "16:9" / "1:1"），优先使用，直接透传不做转换 */
  aspectRatio?: string;
  style?: string;
  quality?: string;
  /** 参考图 URL 列表，最多 3 张。DashScope 千问系列通过多模态 messages 传入；OpenAI 兼容服务通过 image_urls 数组传入 */
  referenceImages?: string[];
  /** 带类型的参考图列表（用于千问等需要标识参考图类型的模型） */
  typedReferenceImages?: Array<{
    url: string;
    type: "character" | "scene" | "prop" | "reference";
    name?: string;
  }>;
}

export interface ImageGenerationResult {
  imageUrl: string;
  prompt: string;
}

export interface VideoGenerationRequest {
  prompt: string;
  /** 单图参考模式：分镜主图 URL */
  imageUrl?: string;
  /** 多图参考模式：多张素材图 URL（角色/场景/道具主图 + 用户上传参考图） */
  imageUrls?: string[];
  /** 音频参考 URL（单音频，已废弃，建议使用 audioUrls） */
  audioUrl?: string;
  /** 多音频参考模式：音频 URL 数组（音频参考模式使用） */
  audioUrls?: string[];
  duration?: number;
  resolution?: string;
  aspectRatio?: string;
  /** 视频生成参考模式：single_reference（首尾帧）或 multi_reference（多参考） */
  referenceMode?: "single_reference" | "multi_reference";
}

export interface VideoGenerationResult {
  videoUrl: string;
  duration: number;
  resolution: string;
}

export interface AudioGenerationRequest {
  text: string;
  voice?: string;
  speed?: number;
}

export interface AudioGenerationResult {
  audioUrl: string;
  duration: number;
}

export interface AIProviderAdapter {
  readonly name: string;
  readonly supportedModels: string[];

  /**
   * 文本生成（流式）
   * @param providerId 可选，指定供应商ID
   */
  generateTextStream(
    request: TextGenerationRequest,
    modelId: string,
    onChunk: (chunk: string) => void,
    onComplete: (result: TextGenerationResult) => void,
    onError: (error: Error) => void,
    providerId?: string,
  ): Promise<void>;

  /**
   * 文本生成（非流式）
   * @param providerId 可选，指定供应商ID
   */
  generateText(
    request: TextGenerationRequest,
    modelId: string,
    providerId?: string,
  ): Promise<TextGenerationResult>;

  /**
   * 图片生成
   * @param providerId 可选，指定供应商ID
   */
  generateImage(
    request: ImageGenerationRequest,
    modelId: string,
    providerId?: string,
  ): Promise<ImageGenerationResult>;

  /**
   * 视频生成
   * @param request 视频生成请求
   * @param modelId 模型ID
   * @param providerId 可选，指定供应商ID
   * @param onProgress 可选，进度回调（progress: 0-100）
   */
  generateVideo(
    request: VideoGenerationRequest,
    modelId: string,
    providerId?: string,
    onProgress?: (progress: number) => void,
  ): Promise<VideoGenerationResult>;

  /**
   * 音频生成
   */
  generateAudio(
    request: AudioGenerationRequest,
    modelId: string,
  ): Promise<AudioGenerationResult>;

  /**
   * 检查模型可用性
   */
  checkModelAvailability(modelId: string): Promise<boolean>;
}
