import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OSS from "ali-oss";
import * as fs from "fs/promises";
import * as path from "path";
import { Readable } from "stream";
import {
  FileCategory,
  FileUploadResult,
  LargeFileUploadOptions,
} from "@pixaura/shared-types";

/**
 * 存储提供者接口
 */
interface StorageProvider {
  uploadFile(
    key: string,
    buffer: Buffer,
    options?: OSS.PutObjectOptions,
  ): Promise<FileUploadResult | null>;
  deleteFile(key: string): Promise<boolean>;
  isConfigured(): boolean;
  /** 流式上传（用于大文件） */
  uploadStream?(
    key: string,
    stream: Readable,
    options?: OSS.PutStreamOptions,
  ): Promise<FileUploadResult | null>;
  /** 分片上传（用于超大文件） */
  uploadMultipart?(
    key: string,
    filePath: string,
    options?: LargeFileUploadOptions,
  ): Promise<FileUploadResult | null>;
  /** 获取公网可访问的 URL（用于第三方 API 调用） */
  getPublicUrl?(key: string, expiresIn?: number): string | null;
}

/**
 * OSS 存储提供者
 */
class OssStorageProvider implements StorageProvider {
  private client: OSS;

  constructor(client: OSS) {
    this.client = client;
  }

  async uploadFile(
    key: string,
    buffer: Buffer,
    options?: OSS.PutObjectOptions,
  ): Promise<FileUploadResult | null> {
    try {
      await this.client.put(key, buffer, options);
      // 返回相对路径，由前端代理转发到 OSS
      return {
        url: `/static/${key}`,
        key,
      };
    } catch (error) {
      console.error("OSS upload error:", error);
      return null;
    }
  }

  async deleteFile(key: string): Promise<boolean> {
    try {
      // key 已是原始路径（不含 /static/ 前缀），直接使用
      await this.client.delete(key);
      return true;
    } catch (error) {
      console.error("OSS delete error:", error);
      return false;
    }
  }

  isConfigured(): boolean {
    return true;
  }

  /**
   * 获取公网可访问的签名 URL
   * 用于第三方 API（如火山引擎）需要公网访问图片的场景
   * @param key OSS 文件 key
   * @param expiresIn URL 有效期（秒），默认 1 小时
   */
  getPublicUrl(key: string, expiresIn?: number): string | null {
    try {
      // 使用 signatureUrl 生成带签名的临时访问 URL
      const url = this.client.signatureUrl(key, {
        expires: expiresIn || 3600, // 默认 1 小时
      });
      return url;
    } catch (error) {
      console.error("OSS signatureUrl error:", error);
      return null;
    }
  }

  async putObject(
    key: string,
    filePath: string,
    options?: OSS.PutObjectOptions,
  ): Promise<FileUploadResult | null> {
    try {
      await this.client.put(key, filePath, options);
      // 返回相对路径，由前端代理转发到 OSS
      return {
        url: `/static/${key}`,
        key,
      };
    } catch (error) {
      console.error("OSS putObject error:", error);
      return null;
    }
  }

  /**
   * 流式上传（用于大文件）
   */
  async uploadStream(
    key: string,
    stream: Readable,
    options?: OSS.PutStreamOptions,
  ): Promise<FileUploadResult | null> {
    try {
      await this.client.putStream(key, stream, options);
      return {
        url: `/static/${key}`,
        key,
      };
    } catch (error) {
      console.error("OSS uploadStream error:", error);
      return null;
    }
  }

  /**
   * 分片上传（用于超大文件，>=100MB）
   */
  async uploadMultipart(
    key: string,
    filePath: string,
    options?: LargeFileUploadOptions,
  ): Promise<FileUploadResult | null> {
    try {
      const chunkSize = options?.chunkSize || 5 * 1024 * 1024; // 默认 5MB
      const onProgress = options?.onProgress;

      await this.client.multipartUpload(key, filePath, {
        partSize: chunkSize,
        progress: onProgress
          ? (p: number) => {
              onProgress(Math.round(p * 100));
            }
          : undefined,
      });

      return {
        url: `/static/${key}`,
        key,
      };
    } catch (error) {
      console.error("OSS multipartUpload error:", error);
      return null;
    }
  }

  /**
   * 按前缀列出文件（用于批量删除）
   */
  async list(
    prefix: string,
    options?: { "max-keys"?: number; marker?: string },
  ): Promise<{ objects?: Array<{ name: string }>; isTruncated?: boolean; nextMarker?: string }> {
    try {
      const result = await this.client.list(
        {
          prefix,
          "max-keys": options?.["max-keys"] || 1000,
          marker: options?.marker,
        },
        {},
      );
      return {
        objects: result.objects || [],
        isTruncated: result.isTruncated,
        nextMarker: result.nextMarker,
      };
    } catch (error) {
      console.error("OSS list error:", error);
      return { objects: [] };
    }
  }

  /**
   * 批量删除文件
   */
  async deleteMulti(keys: string[]): Promise<void> {
    try {
      await this.client.deleteMulti(keys);
    } catch (error) {
      console.error("OSS deleteMulti error:", error);
    }
  }
}

/**
 * 本地文件存储提供者
 */
class LocalStorageProvider implements StorageProvider {
  readonly localDir: string;
  /** 公网访问基础 URL（用于第三方 API 调用） */
  private baseUrl: string | null;

  constructor(localDir: string, baseUrl?: string) {
    this.localDir = path.resolve(process.cwd(), localDir);
    this.baseUrl = baseUrl || null;
  }

  async ensureDir(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  async uploadFile(
    key: string,
    buffer: Buffer,
    _options?: OSS.PutObjectOptions,
  ): Promise<FileUploadResult | null> {
    const fullPath = path.join(this.localDir, key);
    const dirPath = path.dirname(fullPath);

    try {
      await this.ensureDir(dirPath);
      await fs.writeFile(fullPath, buffer);
      return {
        url: `/static/${key}`,
        key,
      };
    } catch (error) {
      console.error("Local upload error:", error);
      return null;
    }
  }

  async deleteFile(key: string): Promise<boolean> {
    const fullPath = path.join(this.localDir, key);
    try {
      await fs.unlink(fullPath);
      return true;
    } catch (error) {
      // 文件不存在不算错误
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return true;
      }
      console.error("Local delete error:", error);
      return false;
    }
  }

  isConfigured(): boolean {
    return true;
  }

  /**
   * 获取公网可访问的 URL
   * 本地模式需要配置 baseUrl，否则返回 null
   * @param key 文件 key
   * @param expiresIn 有效期（秒），本地模式忽略此参数
   */
  getPublicUrl(key: string, _expiresIn?: number): string | null {
    if (!this.baseUrl) {
      console.warn(
        "Local storage baseUrl not configured, cannot generate public URL",
      );
      return null;
    }
    return `${this.baseUrl}/static/${key}`;
  }

  /**
   * 流式上传（本地模式使用文件复制）
   */
  async uploadStream(
    key: string,
    stream: Readable,
    _options?: OSS.PutStreamOptions,
  ): Promise<FileUploadResult | null> {
    const fullPath = path.join(this.localDir, key);
    const dirPath = path.dirname(fullPath);

    try {
      await this.ensureDir(dirPath);
      const { createWriteStream } = await import("fs");
      const writeStream = createWriteStream(fullPath);

      return new Promise((resolve) => {
        writeStream.on("finish", () => {
          resolve({
            url: `/static/${key}`,
            key,
          });
        });
        writeStream.on("error", (err) => {
          console.error("Local uploadStream error:", err);
          resolve(null);
        });
        stream.pipe(writeStream);
      });
    } catch (error) {
      console.error("Local uploadStream error:", error);
      return null;
    }
  }

  /**
   * 分片上传（本地模式直接复制文件）
   */
  async uploadMultipart(
    key: string,
    filePath: string,
    options?: LargeFileUploadOptions,
  ): Promise<FileUploadResult | null> {
    const fullPath = path.join(this.localDir, key);
    const dirPath = path.dirname(fullPath);

    try {
      await this.ensureDir(dirPath);

      // 本地模式直接复制，不支持真正的分片
      // 但模拟进度回调
      const onProgress = options?.onProgress;
      if (onProgress) {
        onProgress(0);
      }

      await fs.copyFile(filePath, fullPath);

      if (onProgress) {
        onProgress(100);
      }

      return {
        url: `/static/${key}`,
        key,
      };
    } catch (error) {
      console.error("Local uploadMultipart error:", error);
      return null;
    }
  }
}

@Injectable()
export class OssService implements OnModuleInit {
  private provider: StorageProvider;
  private ossProvider: OssStorageProvider | null = null;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const storageType =
      this.configService.get<"oss" | "local">("storage.type") || "oss";

    if (storageType === "local") {
      const localDir =
        this.configService.get<string>("storage.local.dir") || "./uploads";
      const baseUrl =
        this.configService.get<string>("storage.local.baseUrl") || undefined;
      this.provider = new LocalStorageProvider(localDir, baseUrl);
      console.log(
        `[Storage] Local mode enabled, directory: ${path.resolve(process.cwd(), localDir)}`,
      );
      if (baseUrl) {
        console.log(`[Storage] Local public URL base: ${baseUrl}`);
      } else {
        console.warn(
          "[Storage] Local public URL not configured, third-party API calls may fail",
        );
      }
    } else {
      const client = this.createOssClient();
      if (!client) {
        throw new Error("OSS configuration is incomplete");
      }
      this.ossProvider = new OssStorageProvider(client);
      this.provider = this.ossProvider;
      console.log("[Storage] OSS mode enabled");
    }
  }

  private createOssClient(): OSS | null {
    const region = this.configService.get<string>("aliyun.oss.region");
    const accessKeyId = this.configService.get<string>(
      "aliyun.oss.accessKeyId",
    );
    const accessKeySecret = this.configService.get<string>(
      "aliyun.oss.accessKeySecret",
    );
    const bucket = this.configService.get<string>("aliyun.oss.bucket");
    const endpoint = this.configService.get<string>("aliyun.oss.endpoint");

    if (!region || !accessKeyId || !accessKeySecret || !bucket) {
      return null;
    }

    const config: OSS.Options = {
      region,
      accessKeyId,
      accessKeySecret,
      bucket,
    };

    if (endpoint) {
      config.endpoint = endpoint;
    }

    return new OSS(config);
  }

  /**
   * 上传文件
   */
  async uploadFile(
    key: string,
    buffer: Buffer,
    options?: OSS.PutObjectOptions,
  ): Promise<FileUploadResult | null> {
    return this.provider.uploadFile(key, buffer, options);
  }

  /**
   * 删除文件
   */
  async deleteFile(key: string): Promise<boolean> {
    return this.provider.deleteFile(key);
  }

  /**
   * 生成 OSS 文件路径
   * @param category 文件类别（使用 FileCategory 枚举，兼容旧字符串参数）
   * @param filename 原始文件名（用于提取扩展名）
   * @param prefix 可选前缀标识（如 "tts_"、"tmp_"、"ref_"）
   * @param projectId 项目 ID，传入时路径会加入 projects/{projectId}/ 前缀
   * @param scriptId 剧本 ID，传入时嵌套在项目下 projects/{projectId}/scripts/{scriptId}/
   * @returns OSS Key（格式: `${category}/projects/{projectId}/scripts/{scriptId}/${YYYYMMDD}/${prefix}${randomId}.${ext}` 或 `${category}/projects/{projectId}/${YYYYMMDD}/${prefix}${randomId}.${ext}`）
   */
  generateKey(
    category: FileCategory | "avatar" | "image" | "video" | "audio",
    filename: string,
    prefix?: string,
    projectId?: string,
    scriptId?: string,
  ): string {
    // 兼容旧字符串参数
    const normalizedCategory: string =
      typeof category === "string" &&
      !Object.values(FileCategory).includes(category as FileCategory)
        ? category
        : category;

    const date = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const random = Math.random().toString(36).substring(2, 10);
    const ext = filename.split(".").pop() || "";
    const prefixPart = prefix || "";
    // 剧本素材嵌套在项目下：projects/{projectId}/scripts/{scriptId}/
    const scopePart = projectId
      ? scriptId
        ? `projects/${projectId}/scripts/${scriptId}/`
        : `projects/${projectId}/`
      : "";
    return `${normalizedCategory}/${scopePart}${date}/${prefixPart}${random}.${ext}`;
  }

  /**
   * 按前缀批量删除文件
   * OSS 模式：使用 list + deleteMulti 批量删除
   * Local 模式：递归删除目录
   */
  async deleteFilesByPrefix(prefix: string): Promise<{ deleted: number }> {
    // Local 模式：递归删除目录
    if (this.provider instanceof LocalStorageProvider) {
      const dirPath = path.join((this.provider as LocalStorageProvider).localDir, prefix);
      try {
        await fs.rm(dirPath, { recursive: true, force: true });
        return { deleted: 1 };
      } catch {
        return { deleted: 0 };
      }
    }

    // OSS 模式：list + deleteMulti
    if (this.ossProvider) {
      try {
        const result = await this.ossProvider.list(prefix);
        const keys = result.objects?.map((obj) => obj.name).filter(Boolean) || [];
        if (keys.length === 0) {
          return { deleted: 0 };
        }
        await this.ossProvider.deleteMulti(keys);
        return { deleted: keys.length };
      } catch {
        return { deleted: 0 };
      }
    }

    return { deleted: 0 };
  }

  /**
   * 检查是否配置
   */
  isConfigured(): boolean {
    return this.provider.isConfigured();
  }

  /**
   * 获取公网可访问的 URL
   * 用于第三方 API（如火山引擎主体检测）需要公网访问文件的场景
   * OSS 模式：生成带签名的临时 URL
   * 本地模式：需要配置 storage.local.baseUrl
   * @param key 文件 key（OSS Key 或本地文件相对路径）
   * @param expiresIn URL 有效期（秒），默认 1 小时
   * @returns 公网可访问的 URL，失败返回 null
   */
  getPublicUrl(key: string, expiresIn?: number): string | null {
    if (this.provider.getPublicUrl) {
      return this.provider.getPublicUrl(key, expiresIn);
    }
    return null;
  }

  /**
   * 上传本地文件到 OSS（仅 OSS 模式可用）
   */
  async putObject(
    key: string,
    filePath: string,
    options?: OSS.PutObjectOptions,
  ): Promise<FileUploadResult | null> {
    if (!this.ossProvider) {
      throw new Error("putObject is only available in OSS mode");
    }
    return this.ossProvider.putObject(key, filePath, options);
  }

  /**
   * 替换文件（原子操作：先上传新文件，成功后删除旧文件）
   * @param oldKey 旧文件 OSS Key（可为 null，空则只上传）
   * @param newKey 新文件 OSS Key
   * @param buffer 新文件内容
   * @param options 上传选项（Content-Type 等）
   * @returns 新文件信息，失败返回 null
   */
  async replaceFile(
    oldKey: string | null,
    newKey: string,
    buffer: Buffer,
    options?: OSS.PutObjectOptions,
  ): Promise<FileUploadResult | null> {
    // 1. 先上传新文件
    const result = await this.uploadFile(newKey, buffer, options);
    if (!result) {
      // 上传失败，保持原状
      return null;
    }

    // 2. 上传成功后删除旧文件（静默处理删除失败）
    if (oldKey) {
      try {
        await this.deleteFile(oldKey);
      } catch (error) {
        console.warn("Failed to delete old file during replace:", error);
      }
    }

    return result;
  }

  /**
   * 上传大文件（自动选择流式或分片上传）
   * @param key OSS Key
   * @param filePath 本地文件路径
   * @param options 上传选项
   * @returns 文件信息，失败返回 null
   *
   * 策略：
   * - 文件 < 100MB：使用 putStream 流式上传
   * - 文件 >= 100MB：使用 multipart 分片上传
   */
  async uploadLargeFile(
    key: string,
    filePath: string,
    options?: LargeFileUploadOptions & OSS.PutObjectOptions,
  ): Promise<FileUploadResult | null> {
    const LARGE_FILE_THRESHOLD = 100 * 1024 * 1024; // 100MB

    try {
      // 获取文件大小
      const stats = await fs.stat(filePath);
      const fileSize = stats.size;

      // 选择上传策略
      if (fileSize >= LARGE_FILE_THRESHOLD) {
        // 大文件：分片上传
        if (this.provider.uploadMultipart) {
          return this.provider.uploadMultipart(key, filePath, options);
        }
        // 降级到普通上传
        console.warn(
          "Multipart upload not supported, falling back to normal upload",
        );
      }

      // 中等文件：流式上传（不传 options，使用默认值）
      if (this.provider.uploadStream) {
        const { createReadStream } = await import("fs");
        const stream = createReadStream(filePath);
        return this.provider.uploadStream(key, stream);
      }

      // 小文件：直接读取后上传
      const buffer = await fs.readFile(filePath);
      return this.uploadFile(key, buffer, options);
    } catch (error) {
      console.error("uploadLargeFile error:", error);
      return null;
    }
  }
}
