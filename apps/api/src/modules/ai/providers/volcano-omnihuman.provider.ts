import { Injectable, Logger } from "@nestjs/common";
import { Signer } from "@volcengine/openapi";
import { RequestObj } from "@volcengine/openapi/lib/base/types";
import { SystemConfigService } from "../../system-admin/services/system-config.service";

/**
 * OmniHuman1.5 视频生成请求参数
 */
export interface OmniHumanVideoRequest {
  /** 人像图片 URL */
  imageUrl: string;
  /** 音频 URL（时长 < 60秒） */
  audioUrl: string;
  /** Mask 图片 URL 列表（可选，指定说话主体） */
  maskUrls?: string[];
  /** 提示词（可选） */
  prompt?: string;
  /** 输出分辨率：720 或 1080 */
  outputResolution?: 720 | 1080;
  /** 是否启用快速模式 */
  fastMode?: boolean;
  /** 随机种子 */
  seed?: number;
}

/**
 * OmniHuman1.5 视频生成结果
 */
export interface OmniHumanVideoResult {
  videoUrl: string;
  taskId: string;
  duration: number;
}

/**
 * 任务状态
 */
export type TaskStatus =
  | "processing"
  | "in_queue"
  | "generating"
  | "done"
  | "not_found"
  | "expired";

/**
 * 火山引擎 OmniHuman1.5 Provider
 * 实现数字人对口型视频生成
 *
 * API 文档：https://www.volcengine.com/docs/6444/1340578
 */
@Injectable()
export class VolcanoOmniHumanProvider {
  private readonly logger = new Logger(VolcanoOmniHumanProvider.name);

  // 火山引擎固定配置
  private readonly VOLCANO_REGION = "cn-north-1";
  private readonly VOLCANO_SERVICE = "cv";
  private readonly VOLCANO_VERSION = "2022-08-31";
  private readonly VOLCANO_HOST = "visual.volcengineapi.com";

  // API 请求标识
  private readonly REQ_KEY_OMNIHUMAN_V15 =
    "jimeng_realman_avatar_picture_omni_v15";

  // 轮询配置
  private readonly MAX_POLL_RETRIES = 120; // 最多轮询 120 次
  private readonly POLL_INTERVAL_MS = 5000; // 每 5 秒轮询一次

  constructor(private readonly systemConfigService: SystemConfigService) {}

  /**
   * 检查 API 是否已配置
   */
  async isConfigured(): Promise<boolean> {
    const config = await this.systemConfigService.getLipSyncApiConfig();
    return !!(
      config &&
      config.hasCredentials &&
      config.enabled &&
      config.lipSync.enabled
    );
  }

  /**
   * 生成对口型视频
   * @param request 视频生成请求
   * @param onProgress 进度回调（0-100）
   */
  async generateVideo(
    request: OmniHumanVideoRequest,
    onProgress?: (progress: number) => void,
  ): Promise<OmniHumanVideoResult> {
    const config = await this.systemConfigService.getLipSyncApiConfig();
    if (!config || !config.hasCredentials) {
      throw new Error("火山引擎 OmniHuman API 未配置");
    }

    const { accessKey, secretKey } = config;
    if (!accessKey || !secretKey) {
      throw new Error("火山引擎凭证未配置完整");
    }

    // 调试日志：验证凭证格式（火山引擎 AccessKey 通常以 "AK" 开头）
    this.logger.debug(
      `凭证格式检查: accessKey 前缀="${accessKey.substring(0, 4)}", 长度=${accessKey.length}`,
    );

    // 1. 提交任务
    const taskId = await this.submitTask(request, accessKey, secretKey);

    this.logger.log(`OmniHuman 任务已提交: taskId=${taskId}`);

    // 2. 轮询结果
    const videoUrl = await this.pollTaskResult(
      taskId,
      accessKey,
      secretKey,
      onProgress,
    );

    // 3. 返回结果
    return {
      videoUrl,
      taskId,
      duration: 0, // 火山引擎不返回时长，由调用方估算
    };
  }

  /**
   * 提交视频生成任务
   */
  private async submitTask(
    request: OmniHumanVideoRequest,
    accessKeyId: string,
    secretAccessKey: string,
  ): Promise<string> {
    const body: Record<string, unknown> = {
      req_key: this.REQ_KEY_OMNIHUMAN_V15,
      image_url: request.imageUrl,
      audio_url: request.audioUrl,
    };

    // 可选参数
    if (request.maskUrls && request.maskUrls.length > 0) {
      body.mask_url = request.maskUrls;
    }
    if (request.prompt) {
      body.prompt = request.prompt;
    }
    if (request.outputResolution) {
      body.output_resolution = request.outputResolution;
    }
    if (request.fastMode !== undefined) {
      body.pe_fast_mode = request.fastMode;
    }
    if (request.seed !== undefined) {
      body.seed = request.seed;
    }

    const requestBody = JSON.stringify(body);

    this.logger.log(`提交 OmniHuman 任务: imageUrl=${request.imageUrl.substring(0, 50)}...`);

    const response = await this.signedRequest(
      "POST",
      "CVSubmitTask",
      requestBody,
      accessKeyId,
      secretAccessKey,
    );

    const responseText = await response.text();
    this.logger.debug(`OmniHuman 提交响应: ${responseText.substring(0, 300)}`);

    let result: Record<string, unknown>;
    try {
      result = JSON.parse(responseText) as Record<string, unknown>;
    } catch {
      this.logger.error("OmniHuman 响应 JSON 解析失败");
      this.logger.debug(`响应内容: ${responseText.substring(0, 200)}`);
      throw new Error("视频生成服务响应异常");
    }

    if (result.code !== 10000) {
      const message = (result.message as string) || "提交任务失败";
      const code = result.code ?? "unknown";
      this.logger.error(`OmniHuman 提交失败: code=${code}`);
      this.logger.debug(`详细错误信息: message=${message}`);
      throw new Error("视频生成任务提交失败");
    }

    const data = result.data as Record<string, unknown>;
    const taskId = data?.task_id as string;

    if (!taskId) {
      this.logger.error(`OmniHuman 响应中无 task_id: ${JSON.stringify(result)}`);
      throw new Error("视频生成服务响应异常");
    }

    return taskId;
  }

  /**
   * 轮询任务结果
   */
  private async pollTaskResult(
    taskId: string,
    accessKeyId: string,
    secretAccessKey: string,
    onProgress?: (progress: number) => void,
  ): Promise<string> {
    const body = JSON.stringify({
      req_key: this.REQ_KEY_OMNIHUMAN_V15,
      task_id: taskId,
    });

    for (let i = 0; i < this.MAX_POLL_RETRIES; i++) {
      await this.sleep(this.POLL_INTERVAL_MS);

      const response = await this.signedRequest(
        "POST",
        "CVGetResult",
        body,
        accessKeyId,
        secretAccessKey,
      );

      const responseText = await response.text();
      let result: Record<string, unknown>;
      try {
        result = JSON.parse(responseText) as Record<string, unknown>;
      } catch {
        this.logger.warn("轮询响应 JSON 解析失败");
        this.logger.debug(`响应内容: ${responseText.substring(0, 100)}`);
        continue;
      }

      // code 不为 10000 时，可能是任务还在处理中
      if (result.code !== 10000) {
        // 某些错误码可以重试
        if (result.code === 50429 || result.code === 50430) {
          this.logger.warn(`API 限流，等待重试: ${result.message}`);
          continue;
        }
        // 其他错误码，记录日志但继续轮询
        this.logger.warn(
          `轮询返回非成功状态: code=${result.code}, message=${result.message}`,
        );
      }

      const data = result.data as Record<string, unknown> | null;
      if (!data) {
        continue;
      }

      const status = data.status as TaskStatus;

      // 估算进度
      const progress = Math.min(
        95,
        10 + Math.round((i / this.MAX_POLL_RETRIES) * 85),
      );
      onProgress?.(progress);

      this.logger.debug(
        `OmniHuman 任务轮询: taskId=${taskId}, status=${status}, progress=${progress}%`,
      );

      if (status === "done") {
        const videoUrl = data.video_url as string;
        if (!videoUrl) {
          this.logger.error(`OmniHuman 任务完成但无视频 URL: ${JSON.stringify(result)}`);
          throw new Error("视频生成完成但获取结果失败");
        }
        onProgress?.(100);
        return videoUrl;
      }

      if (status === "not_found" || status === "expired") {
        throw new Error(
          `OmniHuman 任务${status === "expired" ? "已过期" : "未找到"}: ${taskId}`,
        );
      }

      // processing / in_queue / generating 继续轮询
    }

    throw new Error(`OmniHuman 任务超时: taskId=${taskId}`);
  }

  /**
   * 发送签名请求
   * 使用官方 SDK Signer 进行签名，确保与火山引擎 API 兼容
   */
  private async signedRequest(
    method: string,
    action: string,
    body: string,
    accessKeyId: string,
    secretAccessKey: string,
  ): Promise<Response> {
    const url = `https://${this.VOLCANO_HOST}?Action=${action}&Version=${this.VOLCANO_VERSION}`;

    // 构建请求对象，参考 VolcanoSubjectDetectionProvider
    const requestObj: RequestObj = {
      region: this.VOLCANO_REGION,
      method: method,
      pathname: "/",
      params: {
        Action: action,
        Version: this.VOLCANO_VERSION,
      },
      headers: {
        "Content-Type": "application/json",
        Host: this.VOLCANO_HOST,
      },
      body: body,
    };

    // 使用官方 SDK 签名
    const signer = new Signer(requestObj, this.VOLCANO_SERVICE);
    signer.addAuthorization({
      accessKeyId: accessKeyId,
      secretKey: secretAccessKey,
    });

    this.logger.debug(`OmniHuman API 请求: ${method} ${url}`);
    this.logger.debug(`请求体: ${body.substring(0, 200)}...`);
    this.logger.debug(`签名后 Headers: ${JSON.stringify(requestObj.headers)}`);

    const response = await fetch(url, {
      method,
      headers: requestObj.headers as Record<string, string>,
      body,
    });

    // 检查 HTTP 状态码
    if (!response.ok) {
      const responseText = await response.text();
      this.logger.error("OmniHuman API HTTP 错误");
      this.logger.debug(`详细错误信息: status=${response.status}, response=${responseText.substring(0, 200)}`);
      throw new Error("视频生成服务请求失败");
    }

    return response;
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
