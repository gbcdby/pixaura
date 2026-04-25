/**
 * 图片存储服务
 * 处理图片上传到 OSS 和缩略图生成
 */
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OssService } from "../../../common/oss/oss.service";
import { FileCategory } from "@pixaura/shared-types";

export interface UploadedImageInfo {
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  format: string;
  size: number;
}

@Injectable()
export class ImageStorageService {
  private readonly logger = new Logger(ImageStorageService.name);

  constructor(
    private configService: ConfigService,
    private ossService: OssService,
  ) {}

  /**
   * 上传图片
   */
  async uploadImage(
    imageBuffer: Buffer,
    options: {
      projectId: string;
      taskId: string;
      index: number;
      format?: string;
    },
  ): Promise<UploadedImageInfo> {
    const { projectId, taskId, index, format = "png" } = options;

    // 生成存储 key
    const filename = `${taskId}/${index}.${format}`;
    const key = this.ossService.generateKey(
      FileCategory.IMAGE,
      filename,
      undefined,
      projectId,
    );

    // 上传到 OSS（本地存储写入 uploads/ 目录）
    const result = await this.ossService.uploadFile(key, imageBuffer);
    if (!result) {
      throw new Error(`图片上传失败: ${key}`);
    }

    // 缩略图 key（暂用原图，后续可接入 sharp 生成真实缩略图）
    const thumbnailUrl = result.url;

    this.logger.debug(
      `图片上传成功: projectId=${projectId}, taskId=${taskId}, key=${key}, url=${result.url}`,
    );

    return {
      url: result.url,
      thumbnailUrl,
      width: 1024, // TODO: 从图片元数据读取真实宽高
      height: 1024,
      format,
      size: imageBuffer.length,
    };
  }

  /**
   * 批量上传图片
   */
  async uploadImages(
    images: Array<{
      buffer: Buffer;
      index: number;
      format?: string;
    }>,
    projectId: string,
    taskId: string,
  ): Promise<UploadedImageInfo[]> {
    const results: UploadedImageInfo[] = [];

    for (const image of images) {
      const info = await this.uploadImage(image.buffer, {
        projectId,
        taskId,
        index: image.index,
        format: image.format,
      });
      results.push(info);
    }

    return results;
  }

  /**
   * 删除图片
   */
  async deleteImage(url: string): Promise<void> {
    // 从 URL 提取 key（本地存储格式：/static/{key}）
    const key = url.replace("/static/", "");
    if (key && key !== url) {
      this.logger.debug(`删除图片: key=${key}`);
      await this.ossService.deleteFile(key);
    } else {
      this.logger.warn(`无法从 URL 提取 key，跳过删除: ${url}`);
    }
  }

  /**
   * 生成临时 URL
   */
  async generateSignedUrl(
    url: string,
    expires: number = 3600,
  ): Promise<string> {
    // 本地存储直接返回原 URL（OSS 模式可生成签名 URL）
    if (url.startsWith("/static/")) {
      return url;
    }
    // 从 URL 提取 key
    const key = url.split("/").pop();
    if (key) {
      const signedUrl = this.ossService.getPublicUrl(key, expires);
      return signedUrl || url;
    }
    return url;
  }
}
