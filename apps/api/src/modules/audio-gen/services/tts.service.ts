/**
 * TTS 服务
 * 文本转语音生成 - 支持阿里云千问 TTS (qwen3-tts-flash / qwen3-tts-instruct-flash)
 * 兼容旧版 DashScope CosyVoice
 */
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AudioGenerationTaskEntity } from "../entities";
import { OssService } from "../../../common/oss/oss.service";
import { SystemConfigService } from "../../../modules/system-admin/services/system-config.service";
import { FileCategory } from "@pixaura/shared-types";

export interface TTSConfig {
  text: string;
  voiceId: string;
  emotion?: string;
  speed?: number;
  pitch?: number;
  // 指令模板（用于 qwen3-tts-instruct-flash）
  // 新格式: { templateId?: string, content: string }
  // 旧格式: string（兼容）
  instructions?: string | { templateId?: string; content: string };
  // 项目 ID 和剧本 ID，用于文件按项目/剧本分目录存储
  // scriptId 传入时路径为 projects/{projectId}/scripts/{scriptId}/
  projectId?: string;
  scriptId?: string;
}

export interface TTSResult {
  audioUrl: string;
  duration: number;
  format: string;
  sampleRate: number;
}

// 千问 TTS 模型 ID（与模型配置表中的 modelId 保持一致）
export const QWEN_TTS_MODELS = {
  FLASH: "qwen3-tts-flash",
  INSTRUCT_FLASH: "qwen3-tts-instruct-flash",
} as const;

@Injectable()
export class TTSService {
  private readonly logger = new Logger(TTSService.name);

  constructor(
    private readonly ossService: OssService,
    private readonly configService: ConfigService,
    private readonly systemConfigService: SystemConfigService,
  ) {}

  /**
   * 智能选择 TTS 模型
   * 有指令模板（instructions）时使用 qwen3-tts-instruct-flash
   * 无指令模板时使用 qwen3-tts-flash
   */
  selectTTSModel(hasInstructions: boolean): string {
    return hasInstructions
      ? QWEN_TTS_MODELS.INSTRUCT_FLASH
      : QWEN_TTS_MODELS.FLASH;
  }

  /**
   * 检测是否为千问 TTS 模型
   */
  private isQwenTTSModel(modelId: string): boolean {
    return modelId.startsWith("qwen3-tts");
  }

  /**
   * 获取 TTS 模型配置
   * 只使用 system_config 中的 TTS API 配置
   */
  private async getTTSModelConfig(
    modelId: string = QWEN_TTS_MODELS.FLASH,
    _providerId?: string,
  ): Promise<{
    baseUrl: string;
    apiKey: string;
    providerModelId: string;
  }> {
    const ttsConfig = await this.systemConfigService.getTTSApiConfig();

    if (!ttsConfig || !ttsConfig.apiKey) {
      throw new Error("TTS API 未配置，请在管理后台配置 TTS API Key");
    }

    if (!ttsConfig.enabled) {
      throw new Error("TTS API 已禁用，请在管理后台启用");
    }

    this.logger.log("使用 system_config 中的 TTS API 配置");

    return {
      baseUrl: ttsConfig.baseUrl,
      apiKey: ttsConfig.apiKey,
      providerModelId: modelId,
    };
  }

  /**
   * 生成 TTS 音频
   * @param config TTS 配置
   * @param modelId 模型ID（可选，会根据 instructions 自动选择）
   * @param providerId 可选，指定供应商ID
   */
  async generate(
    config: TTSConfig,
    modelId?: string,
    providerId?: string,
  ): Promise<TTSResult> {
    const { text, voiceId, instructions } = config;

    // 兼容新旧 instructions 格式，提取实际的指令内容
    const instructionsContent =
      typeof instructions === "string"
        ? instructions
        : instructions?.content || undefined;

    if (!voiceId) {
      throw new Error("请选择音色");
    }

    if (!text || text.trim().length === 0) {
      throw new Error("文本内容不能为空");
    }

    // 智能选择模型：有 instructions 时用 instruct-flash，否则用 flash
    const finalModelId = modelId || this.selectTTSModel(!!instructionsContent);

    this.logger.log(
      `开始 TTS 生成: 文本长度 ${text.length}, 音色 ${voiceId}, 模型 ${finalModelId}${
        instructionsContent
          ? `, 指令: ${instructionsContent.substring(0, 50)}...`
          : ""
      }`,
    );

    // 获取模型配置
    const modelConfig = await this.getTTSModelConfig(finalModelId, providerId);

    // 根据模型类型选择不同的 API 端点和请求格式
    if (this.isQwenTTSModel(finalModelId)) {
      return this.generateWithQwenTTS(
        modelConfig,
        config,
        finalModelId,
        instructionsContent,
      );
    }

    throw new Error(`不支持的 TTS 模型: ${finalModelId}`);
  }

  /**
   * 使用千问 TTS 生成音频
   */
  private async generateWithQwenTTS(
    modelConfig: { baseUrl: string; apiKey: string; providerModelId: string },
    config: TTSConfig,
    modelId: string,
    instructionsContent?: string,
  ): Promise<TTSResult> {
    const { text, voiceId, speed = 1.0 } = config;

    if (!voiceId) {
      throw new Error("请选择音色");
    }

    // 千问 TTS API 端点 (multimodal-generation)
    const baseUrl = modelConfig.baseUrl.includes("dashscope.aliyuncs.com")
      ? modelConfig.baseUrl.replace("/compatible-mode/v1", "")
      : "https://dashscope.aliyuncs.com";
    const endpoint = `${baseUrl}/api/v1/services/aigc/multimodal-generation/generation`;

    // 构建请求体 - 按照阿里云文档格式
    const requestBody: Record<string, unknown> = {
      model: modelConfig.providerModelId,
      input: {
        text: text,
        voice: voiceId,
        language_type: "Chinese", // 自动检测语言
      },
    };

    // 如果有 instructions，使用 instruct-flash 模型支持的参数
    if (instructionsContent && modelId === QWEN_TTS_MODELS.INSTRUCT_FLASH) {
      (requestBody.input as Record<string, unknown>).instructions =
        instructionsContent;
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${modelConfig.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      // 脱敏处理：日志中不记录完整请求/响应体
      this.logger.debug(`千问 TTS API 请求: model=${modelConfig.providerModelId}, voice=${voiceId}`);
      // 不使用 error 级别记录正常响应
      // this.logger.error("千问 TTS API 响应:", response);

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error("千问 TTS API 错误");
        this.logger.debug(`详细错误信息: status=${response.status}, response=${errorText}`);
        throw new Error("语音合成服务暂时不可用");
      }

      // 检查响应类型
      const contentType = response.headers.get("content-type") || "";

      // 如果是音频数据，直接获取 buffer
      if (
        contentType.includes("audio/") ||
        contentType.includes("application/octet-stream")
      ) {
        const audioBuffer = Buffer.from(await response.arrayBuffer());

        // 估算音频时长（WAV 格式，24000 采样率，16bit 单声道）
        const estimatedDuration = audioBuffer.length / (24000 * 2 * 1);

        // 上传到 OSS
        const ossKey = this.ossService.generateKey(
          FileCategory.AUDIO,
          `${Date.now()}.wav`,
          "tts_",
          config.projectId,
          config.scriptId,
        );
        const uploadResult = await this.ossService.uploadFile(
          ossKey,
          audioBuffer,
          {
            headers: {
              "Content-Type": "audio/wav",
            },
          },
        );

        if (!uploadResult) {
          throw new Error("音频上传 OSS 失败");
        }

        this.logger.log(
          `千问 TTS 生成完成: ${uploadResult.url}, 时长 ${estimatedDuration.toFixed(2)}s`,
        );

        return {
          audioUrl: uploadResult.url,
          duration: Math.round(estimatedDuration * 100) / 100,
          format: "wav",
          sampleRate: 24000,
        };
      }

      // 如果是 JSON 响应
      const data = (await response.json()) as Record<string, unknown>;

      // 解析响应 - 阿里云 multimodal-generation 格式: output.audio.url
      if (data.output && typeof data.output === "object") {
        const output = data.output as Record<string, unknown>;

        // 检查 audio 对象
        if (output.audio && typeof output.audio === "object") {
          const audio = output.audio as Record<string, unknown>;

          // 如果返回了音频 URL（有效期 24 小时，需要下载并存储到 OSS）
          if (audio.url) {
            const remoteUrl = audio.url as string;

            // 下载远程音频并存储到 OSS
            const audioResponse = await fetch(remoteUrl);
            if (!audioResponse.ok) {
              throw new Error(`下载音频失败: ${audioResponse.status}`);
            }

            const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
            const estimatedDuration = audioBuffer.length / (24000 * 2 * 1);

            // 上传到 OSS
            const ossKey = this.ossService.generateKey(
              FileCategory.AUDIO,
              `${Date.now()}.wav`,
              "tts_",
              config.projectId,
              config.scriptId,
            );
            const uploadResult = await this.ossService.uploadFile(
              ossKey,
              audioBuffer,
              {
                headers: {
                  "Content-Type": "audio/wav",
                },
              },
            );

            if (!uploadResult) {
              // 上传失败，使用原始 URL（临时方案）
              this.logger.warn(
                `音频上传 OSS 失败，使用临时 URL（24小时有效）: ${remoteUrl}`,
              );
              return {
                audioUrl: remoteUrl,
                duration:
                  (audio.duration as number) ||
                  this.estimateDuration(text, speed),
                format: "wav",
                sampleRate: 24000,
              };
            }

            this.logger.log(
              `千问 TTS 生成完成（已存储）: ${uploadResult.url}, 时长 ${estimatedDuration.toFixed(2)}s`,
            );

            return {
              audioUrl: uploadResult.url,
              duration: Math.round(estimatedDuration * 100) / 100,
              format: "wav",
              sampleRate: 24000,
            };
          }
        }

        // 如果是异步任务，需要轮询
        if (output.task_id) {
          return await this.pollAsyncTask(
            modelConfig.apiKey,
            output.task_id as string,
            baseUrl,
            config.projectId,
            config.scriptId,
          );
        }
      }

      throw new Error("语音合成服务响应异常");
    } catch (error) {
      this.logger.error(`千问 TTS 生成失败: ${(error as Error).message}`);
      throw new Error("语音合成失败，请稍后重试");
    }
  }

  /**
   * 轮询异步任务结果
   */
  private async pollAsyncTask(
    apiKey: string,
    taskId: string,
    baseUrl: string,
    projectId?: string,
    scriptId?: string,
  ): Promise<TTSResult> {
    const taskEndpoint = `${baseUrl}/api/v1/tasks/${taskId}`;
    const maxRetries = 30;
    const pollIntervalMs = 2000;

    for (let i = 0; i < maxRetries; i++) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

      const response = await fetch(taskEndpoint, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        this.logger.warn("轮询 TTS 任务状态失败");
        continue;
      }

      const data = (await response.json()) as Record<string, unknown>;
      const output = data.output as Record<string, unknown>;
      const taskStatus = output?.task_status as string;

      this.logger.log(`TTS 任务 ${taskId} 状态: ${taskStatus}`);

      if (taskStatus === "SUCCEEDED") {
        const results = output?.results as
          | Array<Record<string, unknown>>
          | undefined;
        const audioUrl = results?.[0]?.url as string | undefined;
        if (!audioUrl) {
          throw new Error(`TTS 任务成功但未返回音频 URL`);
        }

        // 下载音频并上传到 OSS
        const audioResponse = await fetch(audioUrl);
        const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
        const estimatedDuration = audioBuffer.length / (24000 * 2 * 1);

        const ossKey = this.ossService.generateKey(
          FileCategory.AUDIO,
          `tts-${Date.now()}.wav`,
          "tts_",
          projectId,
          scriptId,
        );
        const uploadResult = await this.ossService.uploadFile(
          ossKey,
          audioBuffer,
          {
            headers: {
              "Content-Type": "audio/wav",
            },
          },
        );

        if (!uploadResult) {
          // 如果上传失败，直接使用原始 URL
          return {
            audioUrl: audioUrl,
            duration: (output?.duration as number) || estimatedDuration,
            format: "wav",
            sampleRate: 24000,
          };
        }

        return {
          audioUrl: uploadResult.url,
          duration: estimatedDuration,
          format: "wav",
          sampleRate: 24000,
        };
      }

      if (taskStatus === "FAILED") {
        this.logger.error(`TTS 任务失败: ${output?.message || "未知错误"}`);
        throw new Error("语音合成失败，请稍后重试");
      }

      // PENDING / RUNNING 状态继续轮询
    }

    throw new Error("语音合成超时，请稍后重试");
  }

  /**
   * 根据文本长度估算音频时长
   * 改进版：区分中英文字符，按实际语速估算
   */
  estimateDuration(text: string, speed: number = 1.0): number {
    // 过滤标点符号
    const cleaned = text.replace(/[\s\p{P}\p{S}]/gu, "");
    // 中文字符 ~0.3s/字
    const chineseChars = (cleaned.match(/[\u4e00-\u9fa5]/g) || []).length;
    // 英文单词 ~0.2s/词
    const englishWords = (cleaned.match(/[a-zA-Z]+/g) || []).length;
    // 其他字符
    const otherChars = cleaned.length - chineseChars - englishWords;
    const baseDuration = chineseChars * 0.3 + englishWords * 0.2 + otherChars * 0.15;
    return Math.round((baseDuration / speed) * 100) / 100;
  }

  /**
   * 执行 TTS 任务（供 Worker 调用）
   */
  async execute(task: AudioGenerationTaskEntity): Promise<void> {
    const config = task.config.ttsConfig;
    if (!config) {
      throw new Error("TTS配置不存在");
    }

    const result = await this.generate({
      text: config.text,
      voiceId: config.voiceId || config.speakerId,
      emotion: config.emotion,
      speed: config.speed,
      instructions: config.instructions,
    });

    // 更新任务输出
    this.logger.log(`TTS 任务完成: ${task.id}, 音频URL: ${result.audioUrl}`);
  }
}
