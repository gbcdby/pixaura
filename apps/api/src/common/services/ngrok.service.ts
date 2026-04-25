import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * Ngrok URL 自动获取服务
 * 检测 ngrok 是否运行，获取当前公网 URL 并缓存
 */
@Injectable()
export class NgrokService implements OnModuleInit {
  private readonly logger = new Logger(NgrokService.name);
  private cachedUrl: string | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

  constructor(private readonly configService: ConfigService) {}

  /**
   * 获取 ngrok API 地址
   * 优先从配置读取，其次环境变量，最后默认本地地址
   */
  private getNgrokApiUrl(): string {
    const baseUrl =
      this.configService.get<string>("NGROK_API_URL") ||
      process.env.NGROK_API_URL ||
      "http://127.0.0.1:4040";
    return `${baseUrl}/api/tunnels`;
  }

  /**
   * 模块初始化时检测 ngrok 状态
   */
  async onModuleInit() {
    const storageType = this.configService.get<string>("storage.type");
    if (storageType !== "local") {
      return; // 只有本地存储模式需要 ngrok
    }

    const available = await this.isNgrokAvailable();
    if (available) {
      const url = await this.getPublicUrl();
      this.logger.log(`ngrok 已启动，公网 URL: ${url}`);
    } else {
      this.logger.warn(
        "本地存储模式下，部分功能（火山引擎主体检测、对口型视频生成）需要 ngrok。\n" +
          "请在另一个终端运行: ngrok http 3000",
      );
    }
  }

  /**
   * 检测 ngrok 是否运行
   */
  async isNgrokAvailable(): Promise<boolean> {
    try {
      const response = await fetch(this.getNgrokApiUrl(), {
        method: "GET",
        signal: AbortSignal.timeout(3000), // 3秒超时
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 获取当前公网 URL
   * 使用缓存避免频繁请求
   */
  async getPublicUrl(): Promise<string | null> {
    // 检查缓存是否有效
    if (this.cachedUrl && Date.now() - this.cacheTimestamp < this.CACHE_TTL) {
      return this.cachedUrl;
    }

    try {
      const response = await fetch(this.getNgrokApiUrl(), {
        method: "GET",
        signal: AbortSignal.timeout(3000),
      });

      if (!response.ok) {
        this.logger.warn("ngrok API 返回错误");
        this.logger.debug(`详细错误信息: status=${response.status}`);
        return null;
      }

      const data = (await response.json()) as { tunnels: NgrokTunnel[] };
      const tunnels = data.tunnels || [];

      // 查找 http 隧道（非 https）
      const httpTunnel = tunnels.find(
        (t) => t.proto === "http" && t.public_url,
      );
      if (httpTunnel) {
        this.cachedUrl = httpTunnel.public_url;
        this.cacheTimestamp = Date.now();
        return this.cachedUrl;
      }

      // 如果没有 http 隧道，尝试 https
      const httpsTunnel = tunnels.find(
        (t) => t.proto === "https" && t.public_url,
      );
      if (httpsTunnel) {
        this.cachedUrl = httpsTunnel.public_url;
        this.cacheTimestamp = Date.now();
        return this.cachedUrl;
      }

      this.logger.warn("ngrok 未找到有效的隧道");
      return null;
    } catch (error) {
      this.logger.error(`获取 ngrok URL 失败: ${error}`);
      return null;
    }
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cachedUrl = null;
    this.cacheTimestamp = 0;
    this.logger.debug("ngrok URL 缓存已清除");
  }
}

/**
 * ngrok 隧道信息
 */
interface NgrokTunnel {
  name: string;
  proto: string;
  public_url: string;
}