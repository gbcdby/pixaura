import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OssService } from "../oss/oss.service";
import { NgrokService } from "./ngrok.service";
import * as fs from "fs";
import * as path from "path";

/**
 * URL 转换服务
 * 将内部 URL 转换为外部 AI API 可访问的格式
 * - OSS 模式：返回完整 OSS URL（公开访问）
 * - 本地模式：优先使用 ngrok 公网 URL，否则转换为 base64 格式
 */
@Injectable()
export class UrlTransformService {
  private readonly logger = new Logger(UrlTransformService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly ossService: OssService,
    private readonly ngrokService: NgrokService,
  ) {}

  /**
   * 将 URL 转换为外部可访问格式
   * - 外部 URL：直接返回
   * - OSS URL：直接返回（公开访问）
   * - 相对路径：OSS 模式拼接完整 URL，本地模式根据参数决定使用公网 URL 或 base64
   *
   * @param url 原始 URL
   * @param options 配置选项
   * @param options.allowBase64 是否允许使用 base64 格式（默认 true，图片生成等场景可用）
   *                             火山引擎主体检测/对口型视频生成需要公网 URL，应传 false
   */
  async getAccessibleUrl(
    url: string,
    options?: { allowBase64?: boolean },
  ): Promise<string> {
    if (!url) return url;

    const allowBase64 = options?.allowBase64 ?? true;

    // 外部 URL（非 OSS 域名）- 第三方已可访问
    if (this.isExternalUrl(url)) {
      return url;
    }

    // OSS URL（完整 URL，包含 OSS 域名）- 公开访问
    if (this.isOssUrl(url)) {
      return url;
    }

    // 相对路径 /static/${key}
    const key = this.extractKeyFromUrl(url);
    const storageType = this.configService.get("storage.type") || "oss";

    // OSS 模式：拼接完整 URL（使用签名 URL）
    if (storageType === "oss") {
      return this.buildOssUrl(key);
    }

    // 本地模式：优先尝试配置的 baseUrl，再尝试 ngrok
    const baseUrl = this.configService.get("storage.local.baseUrl");
    if (baseUrl) {
      return `${baseUrl}/static/${key}`;
    }

    // 尝试 ngrok 公网 URL
    const ngrokUrl = await this.ngrokService.getPublicUrl();
    if (ngrokUrl) {
      return `${ngrokUrl}/static/${key}`;
    }

    // 无公网配置且 ngrok 未运行时，根据参数决定是否使用 base64
    if (allowBase64) {
      return this.convertToBase64(key);
    }

    // 不允许 base64 且无公网配置，抛出友好错误
    this.logger.error(
      "本地存储模式需要配置 storage.local.baseUrl 或启动 ngrok 才能使用第三方 API",
    );
    throw new BadRequestException(
      "本地模式需要启动 ngrok 才能让火山引擎访问素材，请在终端运行: ngrok http 3000",
    );
  }

  /**
   * 批量转换 URL
   */
  async getAccessibleUrls(
    urls: string[],
    options?: { allowBase64?: boolean },
  ): Promise<string[]> {
    return Promise.all(
      urls.map((u) => this.getAccessibleUrl(u, options)),
    );
  }

  /**
   * 判断是否为外部 URL（非 OSS 域名）
   */
  private isExternalUrl(url: string): boolean {
    if (!url.startsWith("http")) return false;
    const ossDomain = this.configService.get("aliyun.oss.endpoint");
    return ossDomain ? !url.includes(ossDomain) : true;
  }

  /**
   * 判断是否为 OSS URL
   */
  private isOssUrl(url: string): boolean {
    if (!url.startsWith("http")) return false;
    const ossDomain = this.configService.get("aliyun.oss.endpoint");
    return ossDomain ? url.includes(ossDomain) : false;
  }

  /**
   * 从相对路径提取 OSS key
   * /static/image/20260331/abc.jpg → image/20260331/abc.jpg
   */
  private extractKeyFromUrl(url: string): string {
    return url.replace(/^\/static\//, "");
  }

  /**
   * 拼接完整 OSS URL
   * 优先使用签名 URL（适用于私有 bucket），确保第三方 API 可访问
   */
  private buildOssUrl(key: string): string {
    // 优先使用 OSS 签名 URL（适用于私有 bucket）
    const signedUrl = this.ossService.getPublicUrl(key);
    if (signedUrl) {
      this.logger.debug(`使用 OSS 签名 URL: ${key}`);
      return signedUrl;
    }

    // 降级：直接拼接公开 URL（适用于公开 bucket）
    const bucket = this.configService.get("aliyun.oss.bucket");
    const endpoint = this.configService.get("aliyun.oss.endpoint");
    this.logger.warn(
      `OSS 签名 URL 生成失败，使用公开 URL（需要 bucket 为公开访问）: ${key}`,
    );
    return `https://${bucket}.${endpoint}/${key}`;
  }

  /**
   * 本地文件转换为 base64
   */
  private async convertToBase64(key: string): Promise<string> {
    const localDir = this.configService.get("storage.local.dir") || "./uploads";
    const filePath = path.join(localDir, key);

    if (!fs.existsSync(filePath)) {
      this.logger.error(`文件不存在: ${key}`);
      throw new Error(`文件不存在: ${key}`);
    }

    const buffer = fs.readFileSync(filePath);
    const mimeType = this.getMimeType(key);

    // 大文件限制（10MB）
    if (buffer.length > 10 * 1024 * 1024) {
      throw new Error(
        `文件过大 (${Math.round(buffer.length / 1024 / 1024)}MB)，请减小文件大小`,
      );
    }

    const base64 = buffer.toString("base64");
    this.logger.debug(`本地文件转 base64: ${key}, 大小: ${buffer.length}字节`);
    return `data:${mimeType};base64,${base64}`;
  }

  /**
   * 根据扩展名获取 MIME 类型
   */
  private getMimeType(key: string): string {
    const ext = path.extname(key).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".mp3": "audio/mpeg",
      ".wav": "audio/wav",
      ".mp4": "video/mp4",
      ".webm": "video/webm",
    };
    return mimeTypes[ext] || "application/octet-stream";
  }
}
