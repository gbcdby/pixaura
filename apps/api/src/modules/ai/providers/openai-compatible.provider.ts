import { Injectable, Logger } from "@nestjs/common";
import { UrlTransformService } from "../../../common/services/url-transform.service";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type {
  AIProviderAdapter,
  TextGenerationRequest,
  TextGenerationResult,
  ImageGenerationRequest,
  ImageGenerationResult,
  VideoGenerationRequest,
  VideoGenerationResult,
} from "./ai-provider.interface";
import { Provider, ModelProvider, AiModel } from "../../model-config/entities";
import { EncryptionService } from "../../model-config/services/encryption.service";
import { AI_STREAM_TIMEOUT_CONFIG } from "../config/ai.config";
import { buildQwenImageContent, buildTaggedPrompt } from "../../../prompts/image-reference-prompt";

/**
 * OpenAI 兼容 Provider
 * 支持所有 OpenAI 兼容接口的模型厂商（阿里云、DeepSeek、OpenRouter 等）
 * 配置从数据库读取
 */
@Injectable()
export class OpenAICompatibleProvider implements AIProviderAdapter {
  private readonly logger = new Logger(OpenAICompatibleProvider.name);
  readonly name = "openai-compatible";
  // 支持所有模型，实际可用性通过数据库配置检查
  readonly supportedModels: string[] = [];

  constructor(
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
    @InjectRepository(ModelProvider)
    private readonly modelProviderRepository: Repository<ModelProvider>,
    @InjectRepository(AiModel)
    private readonly aiModelRepository: Repository<AiModel>,
    private readonly encryptionService: EncryptionService,
    private readonly urlTransformService: UrlTransformService,
  ) {}

  /**
   * 获取模型配置
   * 根据 modelId 查询对应的 provider 配置
   * @param modelId 模型ID
   * @param providerId 可选，指定供应商ID。如果不指定，则使用优先级最高的可用供应商
   */
  private async getModelConfig(
    modelId: string,
    providerId?: string,
  ): Promise<{
    baseUrl: string;
    apiKey: string;
    providerModelId: string;
    customParams: Record<string, unknown>;
  }> {
    // 1. 查找模型对应的 provider 映射
    let modelProvider: ModelProvider | null;

    if (providerId) {
      // 如果指定了 providerId，使用指定的供应商
      modelProvider = await this.modelProviderRepository.findOne({
        where: { modelId, providerId, status: "enabled" },
      });

      if (!modelProvider) {
        throw new Error(`模型 ${modelId} 未配置供应商 ${providerId}`);
      }
    } else {
      // 未指定 providerId，使用优先级最高的可用供应商
      modelProvider = await this.modelProviderRepository.findOne({
        where: { modelId, status: "enabled" },
        order: { isPrimary: "DESC", priority: "ASC" },
      });

      if (!modelProvider) {
        throw new Error(`模型 ${modelId} 未配置对应的供应商`);
      }
    }

    // 2. 获取 provider 详情
    const provider = await this.providerRepository.findOne({
      where: { providerId: modelProvider.providerId, status: "enabled" },
    });

    if (!provider) {
      throw new Error(`供应商 ${modelProvider.providerId} 不存在或已禁用`);
    }

    // 3. 解密 API Key
    let apiKey = "";
    if (provider.apiKeyEnc) {
      try {
        apiKey = await this.encryptionService.decrypt(provider.apiKeyEnc);
      } catch (_error) {
        this.logger.error(`API Key 解密失败: ${provider.providerId}`);
        throw new Error("API Key 解密失败", { cause: _error });
      }
    }

    if (!apiKey) {
      throw new Error(`供应商 ${provider.providerId} 未配置 API Key`);
    }

    // 4. 读取模型的自定义参数
    const aiModel = await this.aiModelRepository.findOne({
      where: { modelId },
    });
    const customParams = (aiModel?.customParams || {}) as Record<string, unknown>;

    return {
      baseUrl: provider.baseUrl,
      apiKey,
      providerModelId: modelProvider.providerModelId || modelId,
      customParams,
    };
  }

  /**
   * 流式文本生成
   * @param request 文本生成请求
   * @param modelId 模型ID
   * @param onChunk 接收到数据块时的回调
   * @param onComplete 生成完成时的回调
   * @param onError 生成出错时的回调
   * @param providerId 可选，指定供应商ID
   */
  async generateTextStream(
    request: TextGenerationRequest,
    modelId: string,
    onChunk: (chunk: string) => void,
    onComplete: (result: TextGenerationResult) => void,
    onError: (error: Error) => void,
    providerId?: string,
  ): Promise<void> {
    try {
      const config = await this.getModelConfig(modelId, providerId);

      const messages = [];
      if (request.systemPrompt) {
        messages.push({ role: "system", content: request.systemPrompt });
      }
      messages.push({ role: "user", content: request.prompt });

      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.providerModelId,
          messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens,
          top_p: request.topP ?? 0.9,
          stream: true,
          ...config.customParams,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error("流式文本生成 API 错误");
        this.logger.debug(`详细错误信息: status=${response.status}, response=${errorText}`);
        throw new Error("AI 服务暂时不可用，请稍后重试");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      let fullText = "";
      let promptTokens = 0;
      let completionTokens = 0;
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data:")) {
            const data = line.slice(5).trim();
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || "";
              if (content) {
                fullText += content;
                onChunk(content);
              }
              if (parsed.usage) {
                promptTokens = parsed.usage.prompt_tokens || 0;
                completionTokens = parsed.usage.completion_tokens || 0;
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }

      onComplete({
        text: fullText,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
        },
        finishReason: "stop",
      });
    } catch (error) {
      this.logger.error(`Stream error: ${(error as Error).message}`);
      onError(error as Error);
    }
  }

  /**
   * 带超时的 fetch 请求
   * @param url 请求URL
   * @param options fetch 选项
   * @param timeoutMs 超时时间（毫秒）
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number = AI_STREAM_TIMEOUT_CONFIG.requestTimeoutMs,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Request timeout after ${timeoutMs}ms`, {
          cause: error,
        });
      }
      throw error;
    }
  }

  /**
   * 非流式文本生成
   * @param request 文本生成请求
   * @param modelId 模型ID
   * @param providerId 可选，指定供应商ID
   */
  async generateText(
    request: TextGenerationRequest,
    modelId: string,
    providerId?: string,
  ): Promise<TextGenerationResult> {
    const config = await this.getModelConfig(modelId, providerId);

    const messages = [];
    if (request.systemPrompt) {
      messages.push({ role: "system", content: request.systemPrompt });
    }
    messages.push({ role: "user", content: request.prompt });

    const response = await this.fetchWithTimeout(
      `${config.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.providerModelId,
          messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens,
          top_p: request.topP ?? 0.9,
          stream: false,
          ...config.customParams,
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error("文本生成 API 错误");
      this.logger.debug(`详细错误信息: status=${response.status}, response=${errorText}`);
      throw new Error("AI 服务暂时不可用，请稍后重试");
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    return {
      text: choice?.message?.content || "",
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
      finishReason: choice?.finish_reason || "stop",
    };
  }

  /**
   * 将比例尺寸根据 quality 转换为像素尺寸
   * @param aspectRatio 比例尺寸，如 "9:16"、"1:1"、"16:9"
   * @param quality 图片质量，如 "512", "1k", "2k", "4k"
   * @returns 转换后的像素尺寸，如 "576x1024"
   */
  private convertAspectRatioToPixelSize(
    aspectRatio: string,
    quality?: string,
  ): string {
    const match = aspectRatio.match(/^(\d+)[:*x](\d+)$/);
    if (!match) {
      // 解析失败原样返回
      return aspectRatio;
    }

    const w = parseInt(match[1], 10);
    const h = parseInt(match[2], 10);

    const qualityMap: Record<string, number> = {
      "512": 512,
      "1k": 1024,
      "2k": 2048,
      "4k": 4096,
    };

    const targetShortSide = qualityMap[quality ?? ""];
    if (!targetShortSide) {
      // quality 未知，使用 1k 作为默认值
      return this.calculatePixelSize(w, h, 1024);
    }

    return this.calculatePixelSize(w, h, targetShortSide);
  }

  /**
   * 根据宽高比例和短边目标值计算像素尺寸
   */
  private calculatePixelSize(
    w: number,
    h: number,
    shortSide: number,
  ): string {
    const roundTo64 = (n: number) => Math.round(n / 64) * 64;

    if (w === h) {
      const size = Math.max(64, roundTo64(shortSide));
      return `${size}*${size}`;
    }

    const scale = shortSide / Math.min(w, h);
    const newW = Math.max(64, roundTo64(w * scale));
    const newH = Math.max(64, roundTo64(h * scale));

    return `${newW}*${newH}`;
  }

  /**
   * 统一收集带类型的参考图列表
   * 优先使用 typedReferenceImages，fallback 到 referenceImages 并默认类型为 reference
   */
  private collectTypedReferences(
    request: ImageGenerationRequest,
    maxReferences: number,
  ): Array<{ url: string; type: "character" | "scene" | "prop" | "reference"; name?: string }> {
    if (request.typedReferenceImages?.length) {
      return request.typedReferenceImages.slice(0, maxReferences);
    }
    if (request.referenceImages?.length) {
      return request.referenceImages
        .slice(0, maxReferences)
        .map((url) => ({ url, type: "reference" as const }));
    }
    return [];
  }

  /**
   * 图像生成（OpenAI DALL-E 兼容格式）
   * @param request 图像生成请求
   * @param modelId 模型ID
   * @param providerId 可选，指定供应商ID
   */
  async generateImage(
    request: ImageGenerationRequest,
    modelId: string,
    providerId?: string,
  ): Promise<ImageGenerationResult> {
    const config = await this.getModelConfig(modelId, providerId);

    // 尝试从 ai_models 读取参考图配置，查不到就用默认值 3
    const aiModel = await this.aiModelRepository.findOne({
      where: { modelId },
    });
    const defaultParams = (aiModel?.defaultParams || {}) as Record<string, unknown>;
    const maxReferences = (defaultParams.max_references as number | undefined) ?? 3;
    if (aiModel) {
      this.logger.debug(`模型 ${modelId} 参考图配置: max_references=${maxReferences}`);
    }

    // 读取尺寸模式和模型配置的 image_size
    const sizeMode = (defaultParams.size_mode as string | undefined) ?? "ratio";
    const modelImageSize = (defaultParams.image_size as string | undefined) ?? "1:1";

    // 原始尺寸值：优先使用调用方传入的 aspectRatio，fallback 到模型配置的默认值
    const rawSize = request.aspectRatio || modelImageSize;

    // 根据尺寸模式计算最终传递的 size
    // ratio 模式：直接透传比例值
    // pixel 模式：根据比例 + quality 转换为像素尺寸
    const finalSize = sizeMode === "pixel"
      ? this.convertAspectRatioToPixelSize(rawSize, request.quality)
      : rawSize;

    this.logger.log(`模型 ${modelId} 尺寸模式: ${sizeMode}, 原始尺寸: ${rawSize}, 最终尺寸: ${finalSize}`);

    // 图像生成通常需要更长时间，使用更长的超时
    const imageTimeoutMs = AI_STREAM_TIMEOUT_CONFIG.requestTimeoutMs * 2;

    // 统一收集带类型的参考图（DashScope 和 OpenAI 兼容路径共用）
    const references = this.collectTypedReferences(request, maxReferences);

    // 检测是否为 DashScope 供应商（阿里云），使用其原生图像生成 API
    if (config.baseUrl.includes("dashscope.aliyuncs.com")) {
      const nativeBaseUrl = config.baseUrl.replace("/compatible-mode/v1", "");
      const endpoint = `${nativeBaseUrl}/api/v1/services/aigc/multimodal-generation/generation`;

      const requestBody = {
        model: config.providerModelId,
        input: {
          messages: [
            {
              role: "user",
              content: buildQwenImageContent(request.prompt, references),
            },
          ],
        },
        parameters: {
          prompt_extend: false,
          size: finalSize,
          ...config.customParams,
        },
      };
      this.logger.log(`DashScope 图像生成请求体: ${JSON.stringify(requestBody, null, 2)}`);

      const response = await this.fetchWithTimeout(
        endpoint,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        },
        imageTimeoutMs,
      );

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error("DashScope 图像生成 API 错误");
        this.logger.error(`请求体: ${JSON.stringify(requestBody)}`);
        this.logger.error(`响应: status=${response.status}, body=${errorText}`);
        throw new Error("AI 服务暂时不可用，请稍后重试");
      }

      const data = await response.json();
      this.logger.log(`DashScope 图像生成响应: ${JSON.stringify(data, null, 2)}`);
      const imageUrl =
        (
          data.output?.choices?.[0]?.message?.content as Array<{
            image?: string;
          }>
        )?.[0]?.image || "";

      if (!imageUrl) {
        this.logger.error("DashScope 图像生成响应中未包含图片 URL");
        this.logger.error(`响应数据: ${JSON.stringify(data)}`);
        throw new Error("图像生成响应异常，未返回图片 URL");
      }

      return {
        imageUrl,
        prompt: request.prompt,
      };
    }

    // 构建带参考图标识的 prompt（与 DashScope 路径一致）
    const taggedPrompt = buildTaggedPrompt(request.prompt, references);

    // 收集并转换参考图 URL
    let imageUrls: string[] = [];
    const rawRefUrls = references.map((r) => r.url);

    // 去重并按模型配置限制数量
    const uniqueRefUrls = [...new Set(rawRefUrls)].slice(0, maxReferences);

    if (uniqueRefUrls.length > 0) {
      this.logger.debug(`OpenAI 兼容图像生成：转换 ${uniqueRefUrls.length} 张参考图 URL`);
      imageUrls = await Promise.all(
        uniqueRefUrls.map(async (url) => {
          // 已经是外部可访问格式，直接使用
          if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
            return url;
          }
          // 否则通过转换服务处理（外部/OSS URL → baseUrl → ngrok → base64 → 报错）
          return this.urlTransformService.getAccessibleUrl(url);
        }),
      );
      this.logger.debug(`参考图 URL 转换完成: ${imageUrls.length} 张`);
    }

    const body: Record<string, unknown> = {
      model: config.providerModelId,
      prompt: taggedPrompt,
      size: finalSize,
      n: 1,
    };

    if (request.quality?.trim()) {
      body.quality = request.quality.trim();
    }

    if (imageUrls.length > 0) {
      body.image_urls = imageUrls;
    }

    // 合并自定义参数
    Object.assign(body, config.customParams);

    // ---- OpenAI 兼容图像生成：异步任务模式 ----
    const submitEndpoint = `${config.baseUrl}/images/generations`;

    this.logger.log(`OpenAI 兼容图像生成请求体: ${JSON.stringify(body, null, 2)}`);

    const submitResp = await this.fetchWithTimeout(
      submitEndpoint,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
      imageTimeoutMs,
    );

    if (!submitResp.ok) {
      const errText = await submitResp.text();
      this.logger.error(`OpenAI 兼容图像任务提交失败: ${submitResp.status} - ${errText}`);
      this.logger.error(`请求体: ${JSON.stringify(body)}`);
      throw new Error("AI 服务暂时不可用，请稍后重试");
    }

    const submitData = (await submitResp.json()) as Record<string, unknown>;
    this.logger.log(`OpenAI 兼容图像生成提交响应: ${JSON.stringify(submitData, null, 2)}`);
    const taskId = submitData.id as string;
    if (!taskId) {
      this.logger.error(`OpenAI 兼容图像任务响应中无 id: ${JSON.stringify(submitData)}`);
      throw new Error("图像生成服务响应异常");
    }

    this.logger.log(`OpenAI 兼容图像任务已提交，id=${taskId}，开始轮询`);

    // 轮询 GET /tasks/{id}（最多 60 次，每 10 秒，共 10 分钟）
    const taskQueryEndpoint = `${config.baseUrl}/tasks/${taskId}`;
    const maxRetries = 60;
    const pollIntervalMs = 10000;
    let pollFailCount = 0;
    const maxPollFailCount = 10;

    for (let i = 0; i < maxRetries; i++) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

      let pollResp: Response;
      try {
        pollResp = await this.fetchWithTimeout(
          taskQueryEndpoint,
          {
            method: "GET",
            headers: { Authorization: `Bearer ${config.apiKey}` },
          },
          60000,
        );
      } catch (e) {
        pollFailCount++;
        this.logger.warn(
          `OpenAI 兼容图像轮询异常: ${(e as Error).message}, 失败次数: ${pollFailCount}/${maxPollFailCount}`,
        );
        if (pollFailCount >= maxPollFailCount) {
          throw new Error(`OpenAI 兼容图像轮询连续失败 ${pollFailCount} 次: ${(e as Error).message}`);
        }
        continue;
      }

      if (!pollResp.ok) {
        pollFailCount++;
        this.logger.warn(
          `OpenAI 兼容图像轮询失败: ${pollResp.status}, 失败次数: ${pollFailCount}/${maxPollFailCount}`,
        );
        if (pollFailCount >= maxPollFailCount) {
          throw new Error(`OpenAI 兼容图像轮询连续失败 ${pollFailCount} 次，状态码: ${pollResp.status}`);
        }
        continue;
      }

      pollFailCount = 0;

      const pollData = (await pollResp.json()) as Record<string, unknown>;
      const taskStatus = pollData.status as string;
      const progress = (pollData.progress as number) ?? Math.min(90, 10 + Math.round((i / maxRetries) * 80));

      this.logger.log(
        `OpenAI 兼容图像任务 ${taskId} 状态: ${taskStatus}, 进度: ${progress}% (第 ${i + 1} 次)`,
      );

      if (taskStatus === "completed") {
        const results = pollData.results as string[] | undefined;
        const imageUrl = results?.[0] || "";
        if (!imageUrl) {
          this.logger.error(`OpenAI 兼容图像生成完成但无图片 URL: ${JSON.stringify(pollData)}`);
          throw new Error("图像生成服务响应异常，未返回图片 URL");
        }
        return {
          imageUrl,
          prompt: request.prompt,
        };
      }

      if (taskStatus === "failed") {
        const errObj = pollData.error as Record<string, unknown> | undefined;
        this.logger.error(`OpenAI 兼容图像生成失败: ${errObj?.message || JSON.stringify(pollData)}`);
        throw new Error("图像生成失败，请稍后重试");
      }
      // pending / processing 继续轮询
    }

    throw new Error("图像生成超时，请稍后重试");
  }

  /**
   * 视频生成（支持 DashScope wan2.6 等模型）
   * wan2.6 使用异步任务提交 + 轮询结果的方式
   * @param request 视频生成请求
   * @param modelId 模型ID
   * @param providerId 可选，指定供应商ID
   * @param onProgress 可选，进度回调（progress: 0-100）
   */
  async generateVideo(
    request: VideoGenerationRequest,
    modelId: string,
    providerId?: string,
    onProgress?: (progress: number) => void,
  ): Promise<VideoGenerationResult> {
    const config = await this.getModelConfig(modelId, providerId);

    // 视频生成超时设定为 10 分钟（wan2.6 生成耗时较长）
    const videoTimeoutMs = 10 * 60 * 1000;

    if (config.baseUrl.includes("dashscope.aliyuncs.com")) {
      // DashScope wan2.6 视频生成：先提交任务，再轮询结果
      const nativeBaseUrl = config.baseUrl.replace("/compatible-mode/v1", "");
      const submitEndpoint = `${nativeBaseUrl}/api/v1/services/aigc/video-generation/generation`;

      // 构建请求体
      const requestBody: Record<string, unknown> = {
        model: config.providerModelId,
        input: {
          prompt: request.prompt,
        },
        parameters: {},
      };

      // 如果提供了参考图，使用图生视频模式
      if (request.imageUrl) {
        (requestBody.input as Record<string, unknown>).image_url =
          request.imageUrl;
      }

      // DashScope wan2.6: duration 参数在 parameters 中
      if (request.duration) {
        (requestBody.parameters as Record<string, unknown>).duration =
          request.duration;
      }

      // 合并自定义参数
      Object.assign(requestBody.parameters as Record<string, unknown>, config.customParams);

      // 打印请求体，方便调试
      this.logger.log(
        `DashScope 视频生成请求体: ${JSON.stringify(requestBody, null, 2)}`,
      );

      // 提交视频生成任务（异步提交接口返回 task_id）
      const submitResponse = await this.fetchWithTimeout(
        submitEndpoint,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
            "X-DashScope-Async": "enable",
          },
          body: JSON.stringify(requestBody),
        },
        videoTimeoutMs,
      );

      if (!submitResponse.ok) {
        const errorText = await submitResponse.text();
        this.logger.error("视频生成任务提交失败");
        this.logger.debug(`详细错误信息: status=${submitResponse.status}, response=${errorText}`);
        throw new Error("视频生成任务提交失败");
      }

      const submitData = (await submitResponse.json()) as Record<
        string,
        unknown
      >;
      const taskId = (submitData.output as Record<string, unknown>)
        ?.task_id as string;

      if (!taskId) {
        this.logger.error(`视频生成任务提交响应中无 task_id: ${JSON.stringify(submitData)}`);
        throw new Error("视频生成服务响应异常");
      }

      this.logger.log(`视频生成任务已提交，task_id=${taskId}，开始轮询结果`);

      // 轮询任务结果（最多轮询 60 次，每次间隔 10 秒，共最多等待 10 分钟）
      const taskStatusEndpoint = `${nativeBaseUrl}/api/v1/tasks/${taskId}`;
      const maxRetries = 60;
      const pollIntervalMs = 10000;

      for (let i = 0; i < maxRetries; i++) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

        const statusResponse = await this.fetchWithTimeout(
          taskStatusEndpoint,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${config.apiKey}`,
            },
          },
          30000,
        );

        if (!statusResponse.ok) {
          this.logger.warn(
            `轮询视频任务状态失败: ${statusResponse.status}，继续重试`,
          );
          continue;
        }

        const statusData = (await statusResponse.json()) as Record<
          string,
          unknown
        >;
        const output = statusData.output as Record<string, unknown>;
        const taskStatus = output?.task_status as string;

        // 估算进度：根据轮询次数（10%-90%）
        const estimatedProgress = Math.min(
          90,
          10 + Math.round((i / maxRetries) * 80),
        );
        onProgress?.(estimatedProgress);

        this.logger.log(
          `视频任务 ${taskId} 状态: ${taskStatus}, 进度: ${estimatedProgress}% (第 ${i + 1} 次轮询)`,
        );

        if (taskStatus === "SUCCEEDED") {
          // 提取视频 URL（wan2.6 响应格式：output.results[0].url）
          const results = output?.results as
            | Array<Record<string, unknown>>
            | undefined;
          const videoUrl =
            (results?.[0]?.url as string) ||
            (output?.video_url as string) ||
            "";

          if (!videoUrl) {
            throw new Error(
              `视频生成成功但未返回视频 URL: ${JSON.stringify(statusData)}`,
            );
          }

          onProgress?.(100);
          return {
            videoUrl,
            duration: (request as { duration?: number }).duration ?? 5,
            resolution: "1280x720",
          };
        }

        if (taskStatus === "FAILED") {
          const errorMsg =
            (output?.message as string) || "视频生成失败，未知错误";
          this.logger.error(`视频生成任务失败: ${errorMsg}`);
          throw new Error("视频生成失败，请稍后重试");
        }

        // PENDING / RUNNING 状态继续轮询
      }

      throw new Error("视频生成超时，请稍后重试");
    }

    // EvoLink 视频生成：POST /v1/videos/generations → 轮询 GET /v1/tasks/{id}
    if (config.baseUrl.includes("evolink.ai")) {
      const evolinkBase = config.baseUrl.replace(/\/v1\/?$/, "");
      const submitEndpoint = `${evolinkBase}/v1/videos/generations`;

      // 构建请求体：model 使用 providerModelId（如 wan2.6-text-to-video）
      const evolinkBody: Record<string, unknown> = {
        model: config.providerModelId || modelId,
        prompt: request.prompt,
      };
      if (request.aspectRatio) {
        evolinkBody.aspect_ratio = request.aspectRatio;
      }
      if (request.duration) {
        evolinkBody.duration = request.duration;
      }

      // 统一使用 image_urls 数组参数传递给外部服务
      // 尾帧模式（single_reference）：只传一张图片（分镜组参考图）
      // 多参考模式（multi_reference）：传递所有参考图片
      const isSingleReference = request.referenceMode === "single_reference";

      let finalImageUrls: string[] = [];
      if (isSingleReference) {
        // 首尾帧模式：只取一张图片
        if (request.imageUrl) {
          finalImageUrls = [request.imageUrl];
        } else if (request.imageUrls && request.imageUrls.length > 0) {
          finalImageUrls = [request.imageUrls[0]];
        }
      } else {
        // 多参考模式：传递所有图片
        if (request.imageUrls && request.imageUrls.length > 0) {
          finalImageUrls = request.imageUrls;
        } else if (request.imageUrl) {
          finalImageUrls = [request.imageUrl];
        }
      }

      // 统一使用 image_urls 数组参数
      if (finalImageUrls.length > 0) {
        evolinkBody.image_urls = finalImageUrls;
      }

      // 音频参考模式：添加 audio_urls 参数
      if (request.audioUrls && request.audioUrls.length > 0) {
        evolinkBody.audio_urls = request.audioUrls;
        this.logger.log(
          `EvoLink 视频生成包含 ${request.audioUrls.length} 个音频参考`,
        );
      }

      // 合并自定义参数
      Object.assign(evolinkBody, config.customParams);

      // 打印请求体，方便调试
      this.logger.log(
        `EvoLink 视频生成请求体: ${JSON.stringify(evolinkBody, null, 2)}`,
      );

      const submitResp = await this.fetchWithTimeout(
        submitEndpoint,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(evolinkBody),
        },
        videoTimeoutMs,
      );

      if (!submitResp.ok) {
        const errText = await submitResp.text();
        this.logger.error(`EvoLink 视频任务提交失败: ${submitResp.status} - ${errText}`);
        throw new Error("视频生成任务提交失败");
      }

      const submitData = (await submitResp.json()) as Record<string, unknown>;
      const evolinkTaskId = submitData.id as string;
      if (!evolinkTaskId) {
        this.logger.error(`EvoLink 视频任务响应中无 id: ${JSON.stringify(submitData)}`);
        throw new Error("视频生成服务响应异常");
      }

      this.logger.log(`EvoLink 视频任务已提交，id=${evolinkTaskId}，开始轮询`);

      // 轮询 GET /v1/tasks/{id}（最多 60 次，每 10 秒，共 10 分钟）
      const taskQueryEndpoint = `${evolinkBase}/v1/tasks/${evolinkTaskId}`;
      const maxRetries = 60;
      const pollIntervalMs = 10000;
      // 轮询失败计数器，连续失败超过阈值才真正放弃
      let pollFailCount = 0;
      const maxPollFailCount = 10;

      for (let i = 0; i < maxRetries; i++) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

        // 使用 try-catch 包裹轮询请求，捕获超时等异常
        let pollResp: Response;
        try {
          pollResp = await this.fetchWithTimeout(
            taskQueryEndpoint,
            {
              method: "GET",
              headers: { Authorization: `Bearer ${config.apiKey}` },
            },
            60000, // 轮询超时增加到 60s
          );
        } catch (e) {
          pollFailCount++;
          this.logger.warn(
            `EvoLink 轮询异常: ${(e as Error).message}, 失败次数: ${pollFailCount}/${maxPollFailCount}`,
          );
          // 连续失败超过阈值才真正放弃
          if (pollFailCount >= maxPollFailCount) {
            throw new Error(
              `EvoLink 轮询连续失败 ${pollFailCount} 次: ${(e as Error).message}`,
            );
          }
          continue; // 继续下一次轮询
        }

        if (!pollResp.ok) {
          pollFailCount++;
          this.logger.warn(
            `EvoLink 轮询任务失败: ${pollResp.status}, 失败次数: ${pollFailCount}/${maxPollFailCount}`,
          );
          // 连续失败超过阈值才真正放弃
          if (pollFailCount >= maxPollFailCount) {
            throw new Error(
              `EvoLink 轮询连续失败 ${pollFailCount} 次，状态码: ${pollResp.status}`,
            );
          }
          continue;
        }

        // 成功响应，重置失败计数
        pollFailCount = 0;

        const pollData = (await pollResp.json()) as Record<string, unknown>;
        const taskStatus = pollData.status as string;
        // EvoLink API 返回 progress 字段（0-100）
        const progress =
          (pollData.progress as number) ??
          Math.min(90, 10 + Math.round((i / maxRetries) * 80));

        // 调用进度回调
        onProgress?.(progress);

        this.logger.log(
          `EvoLink 视频任务 ${evolinkTaskId} 状态: ${taskStatus}, 进度: ${progress}% (第 ${i + 1} 次)`,
        );

        if (taskStatus === "completed") {
          const results = pollData.results as string[] | undefined;
          const videoUrl = results?.[0] || "";
          if (!videoUrl) {
            this.logger.error(`EvoLink 视频生成完成但无视频 URL: ${JSON.stringify(pollData)}`);
            throw new Error("视频生成服务响应异常");
          }
          onProgress?.(100);
          return {
            videoUrl,
            duration: request.duration ?? 5,
            resolution: "1280x720",
          };
        }

        if (taskStatus === "failed") {
          const errObj = pollData.error as Record<string, unknown> | undefined;
          this.logger.error(`EvoLink 视频生成失败: ${errObj?.message || JSON.stringify(pollData)}`);
          throw new Error("视频生成失败，请稍后重试");
        }
        // pending / processing 继续轮询
      }

      throw new Error("视频生成超时，请稍后重试");
    }

    // 标准 OpenAI 兼容视频生成（暂无通用实现，直接报错）
    throw new Error(`当前供应商 (${config.baseUrl}) 不支持视频生成`);
  }

  /**
   * 音频生成（暂未实现）
   */
  async generateAudio(): Promise<any> {
    throw new Error("Audio generation not implemented yet");
  }

  /**
   * 检查模型可用性
   */
  async checkModelAvailability(modelId: string): Promise<boolean> {
    try {
      const config = await this.getModelConfig(modelId);
      return !!config.apiKey;
    } catch {
      return false;
    }
  }
}
