import { Injectable, Logger } from "@nestjs/common";
import { Signer } from "@volcengine/openapi";
import { RequestObj } from "@volcengine/openapi/lib/base/types";
import { SystemConfigService } from "../../system-admin/services/system-config.service";

/**
 * 主体检测结果
 */
export interface SubjectDetectionResult {
  /** 是否检测到主体 */
  hasSubject: boolean;
  /** 检测到的主体列表 */
  subjects: Array<{
    /** 主体序号（1-5） */
    index: number;
    /** mask 图片 URL */
    maskUrl: string;
    /** 面积（像素） */
    area?: number;
  }>;
  /** 原始响应 */
  rawResponse?: unknown;
}

/**
 * 火山引擎主体检测 Provider
 * 用于检测图片中的主体并返回 mask 图片
 *
 * API 文档: docs/lip-sync/volcano/调用步骤2: 主体检测.md
 */
@Injectable()
export class VolcanoSubjectDetectionProvider {
  private readonly logger = new Logger(VolcanoSubjectDetectionProvider.name);

  // 火山引擎 CV 服务配置
  private readonly SERVICE = "cv";
  private readonly REGION = "cn-north-1";
  private readonly BASE_URL = "https://visual.volcengineapi.com";
  private readonly API_VERSION = "2022-08-31";

  // 请求键
  private readonly REQ_KEY = "jimeng_realman_avatar_object_detection";

  constructor(private readonly systemConfigService: SystemConfigService) {}

  /**
   * 检测图片中的主体
   * @param imageUrl 图片 URL
   * @returns 检测结果
   */
  async detectSubjects(imageUrl: string): Promise<SubjectDetectionResult> {
    // 获取配置
    const config = await this.systemConfigService.getLipSyncApiConfig();

    if (!config || !config.hasCredentials) {
      throw new Error(
        "对口型 API 未配置，请在管理后台配置 AccessKey 和 SecretKey",
      );
    }

    if (!config.enabled || !config.subjectDetection.enabled) {
      throw new Error("主体检测服务未启用");
    }

    this.logger.log(`开始主体检测: ${imageUrl}`);

    try {
      // 构建请求
      const requestBody = {
        req_key: this.REQ_KEY,
        image_url: imageUrl,
      };

      // 构建请求对象
      const requestObj: RequestObj = {
        region: this.REGION,
        method: "POST",
        pathname: "/",
        params: {
          Action: "CVProcess",
          Version: this.API_VERSION,
        },
        headers: {
          "Content-Type": "application/json",
          Host: new URL(this.BASE_URL).hostname,
        },
        body: JSON.stringify(requestBody),
      };

      // 创建签名器并签名
      const signer = new Signer(requestObj, this.SERVICE);
      signer.addAuthorization({
        accessKeyId: config.accessKey,
        secretKey: config.secretKey,
      });

      // 发送请求
      const response = await fetch(
        `${this.BASE_URL}?Action=CVProcess&Version=${this.API_VERSION}`,
        {
          method: "POST",
          headers: requestObj.headers as Record<string, string>,
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error("主体检测请求失败");
        this.logger.debug(`详细错误信息: status=${response.status}, response=${errorText}`);
        throw new Error("主体检测服务请求失败");
      }

      const result = (await response.json()) as {
        code: number;
        data?: {
          resp_data?: string;
        };
        message?: string;
        request_id?: string;
      };

      this.logger.debug(`主体检测响应: ${JSON.stringify(result)}`);

      // 检查响应状态
      if (result.code !== 10000) {
        const errorMsg = result.message || `API 错误: ${result.code}`;
        this.logger.error(`主体检测 API 错误: ${errorMsg}`);
        throw new Error("主体检测失败");
      }

      // 解析 resp_data
      if (!result.data?.resp_data) {
        this.logger.warn("主体检测响应无 resp_data");
        return {
          hasSubject: false,
          subjects: [],
          rawResponse: result,
        };
      }

      // resp_data 是 JSON 字符串，需要解析
      const respData = JSON.parse(result.data.resp_data) as {
        code?: number;
        status?: number;
        object_detection_result?: {
          mask?: {
            url?: string[];
          };
        };
      };

      // status: 0=无主体, 1=有主体
      if (
        respData.status !== 1 ||
        !respData.object_detection_result?.mask?.url
      ) {
        this.logger.log("未检测到主体");
        return {
          hasSubject: false,
          subjects: [],
          rawResponse: result,
        };
      }

      // 构建 subjects 列表
      const maskUrls = respData.object_detection_result.mask.url;
      const subjects: SubjectDetectionResult["subjects"] = maskUrls.map(
        (url, index) => ({
          index: index + 1, // 1-based
          maskUrl: url,
        }),
      );

      this.logger.log(`检测到 ${subjects.length} 个主体`);

      return {
        hasSubject: true,
        subjects,
        rawResponse: result,
      };
    } catch (error) {
      this.logger.error(`主体检测失败: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * 检查服务是否可用
   */
  async isAvailable(): Promise<boolean> {
    try {
      const config = await this.systemConfigService.getLipSyncApiConfig();
      return !!(
        config &&
        config.hasCredentials &&
        config.enabled &&
        config.subjectDetection.enabled
      );
    } catch {
      return false;
    }
  }
}
