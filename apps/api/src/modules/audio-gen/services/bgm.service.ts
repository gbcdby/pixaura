/**
 * BGM 服务
 * 背景音乐匹配/生成
 * 支持通过 AUDIO_GENERATION 类别模型配置调用 AI API
 */
import { Injectable, Logger } from "@nestjs/common";
import { AudioGenerationTaskEntity, BGMConfig, FileInfo } from "../entities";
import { AudioGenerationOutputRepository } from "../repositories";
import { OssService } from "../../../common/oss/oss.service";
import { ModelService } from "../../model-config/services/model.service";
import { Provider } from "../../model-config/entities";
import { ModelProvider } from "../../model-config/entities";
import { EncryptionService } from "../../model-config/services/encryption.service";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { FileCategory, FunctionCategory } from "@pixaura/shared-types";

// 音频格式类型（与 FileInfo 保持一致）
type AudioFormat = "wav" | "mp3" | "mp4";

// BGM 生成结果
interface BGMGenerationResult {
  audioUrl: string;
  duration: number;
  format: AudioFormat;
  bpm?: number;
  keyPoints?: number[];
}

@Injectable()
export class BGMService {
  private readonly logger = new Logger(BGMService.name);

  constructor(
    private outputRepo: AudioGenerationOutputRepository,
    private ossService: OssService,
    private modelService: ModelService,
    private encryptionService: EncryptionService,
    @InjectRepository(Provider)
    private providerRepository: Repository<Provider>,
    @InjectRepository(ModelProvider)
    private modelProviderRepository: Repository<ModelProvider>,
  ) {}

  /**
   * 执行 BGM 生成
   */
  async generate(task: AudioGenerationTaskEntity): Promise<void> {
    const config = task.config.bgmConfig;
    if (!config) {
      throw new Error("BGM配置不存在");
    }

    this.logger.log(
      `开始BGM生成: ${task.id}, 时长: ${config.duration}s, 风格: ${config.style || "默认"}`,
    );

    // 1. 确定使用的模型：优先使用用户指定的 modelId，否则使用系统默认
    let modelId = config.modelId;
    if (!modelId) {
      const defaultModel = await this.modelService.getDefaultModelForCategory(
        FunctionCategory.AUDIO_GENERATION,
      );
      modelId = defaultModel?.modelId;
    }

    if (!modelId) {
      // 如果没有配置模型，使用 mock 模式（开发阶段）
      this.logger.warn(
        `AUDIO_GENERATION 类别未配置模型且未指定 modelId，使用 mock 模式生成 BGM`,
      );
      await this.generateMockBGM(task, config);
      return;
    }

    // 查询模型详情
    const model = await this.modelService.findById(modelId);
    if (!model) {
      this.logger.warn(
        `模型 ${modelId} 不存在，使用 mock 模式生成 BGM`,
      );
      await this.generateMockBGM(task, config);
      return;
    }

    if (!model) {
      // 如果没有配置模型，使用 mock 模式（开发阶段）
      this.logger.warn(
        `AUDIO_GENERATION 类别未配置模型，使用 mock 模式生成 BGM`,
      );
      await this.generateMockBGM(task, config);
      return;
    }

    // 2. 获取模型对应的 provider 配置
    const modelProvider = await this.modelProviderRepository.findOne({
      where: { modelId: model.modelId, isPrimary: true, status: "enabled" },
    });

    if (!modelProvider) {
      this.logger.warn(
        `模型 ${model.modelId} 未配置供应商，使用 mock 模式生成 BGM`,
      );
      await this.generateMockBGM(task, config);
      return;
    }

    const provider = await this.providerRepository.findOne({
      where: { providerId: modelProvider.providerId, status: "enabled" },
    });

    if (!provider) {
      this.logger.warn(
        `供应商 ${modelProvider.providerId} 不存在或已禁用，使用 mock 模式生成 BGM`,
      );
      await this.generateMockBGM(task, config);
      return;
    }

    // 3. 解密 API Key
    let apiKey = "";
    if (provider.apiKeyEnc) {
      try {
        apiKey = await this.encryptionService.decrypt(provider.apiKeyEnc);
      } catch (error) {
        this.logger.error(`API Key 解密失败: ${provider.providerId}`);
        throw new Error("API Key 解密失败");
      }
    }

    if (!apiKey) {
      this.logger.warn(
        `供应商 ${provider.providerId} 未配置 API Key，使用 mock 模式生成 BGM`,
      );
      await this.generateMockBGM(task, config);
      return;
    }

    // 4. 根据供应商类型调用对应的 AI API
    try {
      const providerModelId = modelProvider.providerModelId || model.modelId;

      // 根据供应商 baseUrl 判断 API 类型
      if (provider.baseUrl.includes("dashscope.aliyuncs.com")) {
        // 阿里云 DashScope（目前暂无 BGM 生成 API）
        this.logger.warn(
          `DashScope 暂不支持 BGM 生成，使用 mock 模式`,
        );
        await this.generateMockBGM(task, config);
        return;
      }

      // 其他供应商：调用通用音频生成 API
      const result = await this.callAudioGenerationAPI(
        provider.baseUrl,
        apiKey,
        providerModelId,
        config,
      );

      // 5. 下载音频并上传到 OSS
      const audioBuffer = await this.downloadAudio(result.audioUrl);
      const ossKey = this.ossService.generateKey(
        FileCategory.AUDIO,
        `${Date.now()}.${result.format}`,
        "bgm_",
        task.projectId,
      );
      const uploadResult = await this.ossService.uploadFile(ossKey, audioBuffer, {
        headers: { "Content-Type": `audio/${result.format}` },
      });

      if (!uploadResult) {
        throw new Error("音频上传 OSS 失败");
      }

      // 6. 创建输出记录
      const entity = this.outputRepo.create({
        taskId: task.id,
        type: "bgm",
        file: {
          url: uploadResult.url,
          format: result.format,
          duration: result.duration,
          size: audioBuffer.length,
        },
        metadata: {
          bpm: result.bpm || 120,
          keyPoints: result.keyPoints || [0, 0.5, 1.0, 1.5],
          style: config.style,
          tempo: config.tempo,
        },
      });

      await this.outputRepo.save(entity);
      this.logger.log(`BGM生成完成: ${task.id}, URL: ${uploadResult.url}`);
    } catch (error) {
      this.logger.error(`BGM AI 生成失败: ${(error as Error).message}`);
      // 降级到 mock 模式
      this.logger.warn(`降级到 mock 模式生成 BGM`);
      await this.generateMockBGM(task, config);
    }
  }

  /**
   * 调用通用音频生成 API
   * 支持各种 BGM 生成模型（如 Suno、Stable Audio 等）
   */
  private async callAudioGenerationAPI(
    baseUrl: string,
    apiKey: string,
    modelId: string,
    config: BGMConfig,
  ): Promise<BGMGenerationResult> {
    // 构建 prompt：根据情绪曲线和风格生成描述
    const prompt = this.buildBGMPrompt(config);

    const endpoint = `${baseUrl.replace(/\/$/, "")}/audio/generations`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelId,
        prompt,
        duration: config.duration,
        style: config.style,
        // 如果需要节拍点，传递额外参数
        ...(config.needBeatPoints && { return_beats: true }),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`音频生成 API 错误`);
      this.logger.debug(`详细错误信息: status=${response.status}, response=${errorText}`);
      throw new Error("音频生成服务暂时不可用");
    }

    const data = (await response.json()) as Record<string, unknown>;

    // 解析响应（兼容不同 API 格式）
    const audioUrl =
      (data.audio_url as string) ||
      (data.url as string) ||
      ((data.data as Array<Record<string, unknown>>)?.[0]?.url as string);

    if (!audioUrl) {
      throw new Error("音频生成响应中未包含音频 URL");
    }

    return {
      audioUrl,
      duration: (data.duration as number) || config.duration,
      format: ((data.format as string) || "mp3") as AudioFormat,
      bpm: (data.bpm as number) || 120,
      keyPoints: (data.key_points as number[]) || undefined,
    };
  }

  /**
   * 构建 BGM 生成 prompt
   * 根据情绪曲线和风格生成适合 AI 模型的描述
   */
  private buildBGMPrompt(config: BGMConfig): string {
    const parts: string[] = [];

    // 基础描述
    parts.push(`Generate a ${config.duration} second background music track`);

    // 风格
    if (config.style) {
      parts.push(`in ${config.style} style`);
    }

    // 情绪曲线描述
    if (config.emotionCurve && config.emotionCurve.length > 0) {
      const emotions = config.emotionCurve.map((e) => e.emotion).join(" -> ");
      parts.push(`with emotional progression: ${emotions}`);
    }

    // 节拍
    if (config.tempo) {
      parts.push(`at ${config.tempo} BPM tempo`);
    }

    return parts.join(", ") + ". Suitable for short video background.";
  }

  /**
   * 下载音频文件
   */
  private async downloadAudio(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`下载音频失败: ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  /**
   * Mock BGM 生成（开发/测试阶段使用）
   */
  private async generateMockBGM(
    task: AudioGenerationTaskEntity,
    config: BGMConfig,
  ): Promise<void> {
    // 模拟生成过程
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // 创建输出记录
    const entity = this.outputRepo.create({
      taskId: task.id,
      type: "bgm",
      file: {
        url: `https://oss.example.com/audio/${task.id}/output.mp3`,
        format: "mp3",
        duration: config.duration,
        size: 512000,
      },
      metadata: {
        bpm: config.tempo || 120,
        keyPoints: [0, 0.5, 1.0, 1.5],
        style: config.style,
        tempo: config.tempo,
        mock: true, // 标记为 mock 数据
      },
    });

    await this.outputRepo.save(entity);
    this.logger.log(`BGM Mock 生成完成: ${task.id}`);
  }
}
