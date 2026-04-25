import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OssService } from "../../../common/oss/oss.service";
import { UrlTransformService } from "../../../common/services/url-transform.service";
import * as zlib from "zlib";

/**
 * 主体区域坐标
 */
export interface SubjectRegion {
  x: number; // 0-1
  y: number; // 0-1
  width: number; // 0-1
  height: number; // 0-1
}

/**
 * Mask 图片转存服务
 * 从火山引擎临时 URL 下载 mask 图片，或根据坐标生成 mask 图片，转存到项目存储
 */
@Injectable()
export class MaskStorageService {
  private readonly logger = new Logger(MaskStorageService.name);
  private readonly maxRetries = 3;
  private readonly baseDelay = 1000; // 1 秒基础延迟

  constructor(
    private readonly ossService: OssService,
    private readonly urlTransformService: UrlTransformService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 从坐标区域生成 mask 图片并存储
   * @param sourceImageUrl 原图 URL（用于获取图片尺寸）
   * @param region 主体区域坐标（百分比 0-1）
   * @param sequenceId 分镜组 ID
   * @param type mask 类型
   * @param index 主体序号
   * @param characterId 角色 ID（手动框选时使用）
   * @param projectId 项目 ID
   * @param scriptId 剧本 ID，用于按项目/剧本分目录存储
   * @returns 存储路径 maskKey
   */
  async generateMaskFromRegion(
    sourceImageUrl: string,
    region: SubjectRegion,
    sequenceId: string,
    type: "subject" | "manual" | "preview",
    index?: number,
    characterId?: string,
    projectId?: string,
    scriptId?: string,
  ): Promise<string> {
    const maskKey = this.generateMaskKey(sequenceId, type, index, characterId, projectId, scriptId);

    this.logger.log(
      `开始从坐标生成 mask: type=${type}, sequenceId=${sequenceId}, region=${JSON.stringify(region)}`,
    );

    try {
      // 获取原图尺寸
      const imageDimensions = await this.getImageDimensions(sourceImageUrl);

      // 生成 mask 图片
      const maskBuffer = this.createMaskBuffer(
        imageDimensions.width,
        imageDimensions.height,
        region,
      );


      // 上传 mask 图片
      const result = await this.ossService.uploadFile(maskKey, maskBuffer, {
        headers: { "Content-Type": "image/png" },
      });

      if (result) {
        this.logger.log(`mask 从坐标生成成功: key=${maskKey}`);
        return maskKey;
      }

      throw new Error("OSS 上传失败");
    } catch (error) {
      this.logger.error("从坐标生成 mask 失败");
      this.logger.debug("详细错误信息:", error);
      throw error;
    }
  }

  /**
   * 获取图片尺寸
   * 通过下载图片并解析
   */
  private async getImageDimensions(imageUrl: string): Promise<{ width: number; height: number }> {
    // 如果 URL 是本地路径，需要获取完整 URL
    const fullUrl = await this.urlTransformService.getAccessibleUrl(imageUrl);

    // 尝试通过 HEAD 请求获取图片信息
    const response = await fetch(fullUrl, { method: "HEAD" });
    if (!response.ok) {
      this.logger.error("获取图片信息失败");
      this.logger.debug(`详细错误信息: status=${response.status}`);
      throw new Error("获取图片信息失败，请稍后重试");
    }

    // 下载图片头部获取尺寸
    // 使用 PNG/JPEG 的尺寸解析
    const imgResponse = await fetch(fullUrl, {
      headers: { Range: "bytes=0-65535" }, // 只下载前 64KB，通常包含尺寸信息
    });

    if (!imgResponse.ok) {
        // 如果不支持 Range，下载完整图片
        const fullResponse = await fetch(fullUrl);
        if (!fullResponse.ok) {
          this.logger.error(`下载图片失败: HTTP ${fullResponse.status}`);
          throw new Error("下载图片失败，请稍后重试");
        }
      const buffer = Buffer.from(await fullResponse.arrayBuffer());
      return this.parseImageDimensions(buffer);
    }

    const buffer = Buffer.from(await imgResponse.arrayBuffer());
    return this.parseImageDimensions(buffer);
  }

  /**
   * 解析图片尺寸
   * 支持 PNG 和 JPEG
   */
  private parseImageDimensions(buffer: Buffer): { width: number; height: number } {
    // 检查 PNG
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      // PNG: 宽度在 byte 16-19，高度在 byte 20-23（大端序）
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height };
    }

    // 检查 JPEG
    if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
      // JPEG: 需要遍历 segments 找到 SOF0 (0xC0) 或 SOF2 (0xC2)
      let offset = 2;
      while (offset < buffer.length) {
        // 跳过填充字节
        while (offset < buffer.length && buffer[offset] === 0xFF) {
          offset++;
        }

        if (offset >= buffer.length) break;

        const marker = buffer[offset];
        offset++;

        // SOF0, SOF1, SOF2 包含尺寸信息
        if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
          // 高度在 byte offset+3-4，宽度在 byte offset+5-6（大端序）
          const height = buffer.readUInt16BE(offset + 3);
          const width = buffer.readUInt16BE(offset + 5);
          return { width, height };
        }

        // 跳过其他 segments
        if (marker !== 0xD9 && marker !== 0xD8) {
          if (offset + 1 < buffer.length) {
            const length = buffer.readUInt16BE(offset);
            offset += length;
          }
        }
      }
    }

    // 默认尺寸
    this.logger.warn("无法解析图片尺寸，使用默认值 1920x1080");
    return { width: 1920, height: 1080 };
  }

  /**
   * 创建 mask PNG 图片 Buffer
   * @param imageWidth 原图宽度
   * @param imageHeight 原图高度
   * @param region 主体区域坐标（百分比）
   * @returns PNG Buffer
   */
  private createMaskBuffer(
    imageWidth: number,
    imageHeight: number,
    region: SubjectRegion,
  ): Buffer {
    // 计算实际像素坐标
    const x = Math.round(region.x * imageWidth);
    const y = Math.round(region.y * imageHeight);
    const width = Math.round(region.width * imageWidth);
    const height = Math.round(region.height * imageHeight);

    // 确保最小尺寸
    const finalWidth = Math.max(width, 1);
    const finalHeight = Math.max(height, 1);

    // 创建简单的 PNG（使用最简化的 PNG 格式）
    // PNG 文件结构：
    // 1. PNG 签名 (8 bytes)
    // 2. IHDR chunk (25 bytes)
    // 3. IDAT chunk (图像数据)
    // 4. IEND chunk (12 bytes)

    const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

    // IHDR chunk
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(finalWidth, 0); // width
    ihdrData.writeUInt32BE(finalHeight, 4); // height
    ihdrData[8] = 8; // bit depth
    ihdrData[9] = 6; // color type: RGBA
    ihdrData[10] = 0; // compression method
    ihdrData[11] = 0; // filter method
    ihdrData[12] = 0; // interlace method
    const ihdrChunk = this.createPngChunk("IHDR", ihdrData);

    // 创建图像数据（RGBA，白色不透明）
    const rowSize = finalWidth * 4 + 1; // +1 for filter byte
    const imageData = Buffer.alloc(finalHeight * rowSize);

    for (let row = 0; row < finalHeight; row++) {
      imageData[row * rowSize] = 0; // filter byte: 0 (None)
      for (let col = 0; col < finalWidth; col++) {
        const offset = row * rowSize + 1 + col * 4;
        imageData[offset] = 255; // R
        imageData[offset + 1] = 255; // G
        imageData[offset + 2] = 255; // B
        imageData[offset + 3] = 255; // A (不透明)
      }
    }

    // 压缩图像数据
    const compressedData = zlib.deflateSync(imageData);
    const idatChunk = this.createPngChunk("IDAT", compressedData);

    // IEND chunk
    const iendChunk = this.createPngChunk("IEND", Buffer.alloc(0));

    // 组合所有部分
    return Buffer.concat([pngSignature, ihdrChunk, idatChunk, iendChunk]);
  }

  /**
   * 创建 PNG chunk
   */
  private createPngChunk(type: string, data: Buffer): Buffer {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);

    const typeBuffer = Buffer.from(type, "ascii");

    const crc = Buffer.alloc(4);
    const crcValue = this.calculateCrc32(Buffer.concat([typeBuffer, data]));
    crc.writeUInt32BE(crcValue, 0);

    return Buffer.concat([length, typeBuffer, data, crc]);
  }

  /**
   * 计算 CRC32
   */
  private calculateCrc32(buffer: Buffer): number {
    const crcTable = this.getCrcTable();
    let crc = 0xffffffff;

    for (let i = 0; i < buffer.length; i++) {
      crc = crcTable[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
    }

    return (crc ^ 0xffffffff) >>> 0;
  }

  /**
   * 获取 CRC 表
   */
  private crcTable: number[] | null = null;
  private getCrcTable(): number[] {
    if (this.crcTable) {
      return this.crcTable;
    }

    this.crcTable = new Array(256);
    for (let i = 0; i < 256; i++) {
      let crc = i;
      for (let j = 0; j < 8; j++) {
        crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
      }
      this.crcTable[i] = crc >>> 0;
    }

    return this.crcTable;
  }

  /**
   * 下载并转存 mask 图片
   * @param sourceUrl 火山引擎返回的临时 URL
   * @param sequenceId 分镜组序号
   * @param type mask 类型
   * @param index 主体序号（subject/preview 类型使用）
   * @param characterId 角色ID（manual 类型使用）
   * @param projectId 项目 ID
   * @param scriptId 剧本 ID，用于按项目/剧本分目录存储
   * @returns 存储路径 maskKey
   */
  async storeMask(
    sourceUrl: string,
    sequenceId: string,
    type: "subject" | "manual" | "preview",
    index?: number,
    characterId?: string,
    projectId?: string,
    scriptId?: string,
  ): Promise<string> {
    const maskKey = this.generateMaskKey(sequenceId, type, index, characterId, projectId, scriptId);

    this.logger.log(
      `开始下载 mask 图片: type=${type}, sequenceId=${sequenceId}, targetKey=${maskKey}`,
    );

    // 重试机制
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const buffer = await this.downloadImage(sourceUrl);
        const result = await this.ossService.uploadFile(maskKey, buffer, {
          headers: { "Content-Type": "image/png" },
        });

        if (result) {
          this.logger.log(
            `mask 图片转存成功: key=${maskKey}, attempt=${attempt}`,
          );
          return maskKey;
        }

        this.logger.warn(`OSS 上传失败: key=${maskKey}, attempt=${attempt}`);
      } catch (error) {
        this.logger.warn(
          `mask 图片下载/上传失败: attempt=${attempt}/${this.maxRetries}`,
        );
        this.logger.debug("详细错误信息:", error);
      }

      // 指数退避等待（最后一次不等待）
      if (attempt < this.maxRetries) {
        const delay = this.baseDelay * Math.pow(2, attempt - 1);
        this.logger.debug(`等待 ${delay}ms 后重试...`);
        await this.sleep(delay);
      }
    }

    // 所有重试失败
    const error = new Error(
      `mask 图片转存失败，已重试 ${this.maxRetries} 次: ${maskKey}`,
    );
    this.logger.error(error.message);
    throw error;
  }

  /**
   * 批量转存 mask 图片
   * @param masks mask 图片配置列表
   * @param sequenceId 分镜组序号
   * @returns 所有成功转存的 maskKey 列表
   */
  async storeMasks(
    masks: Array<{
      url: string;
      type: "subject" | "manual" | "preview";
      index?: number;
      characterId?: string;
    }>,
    sequenceId: string,
    projectId?: string,
    scriptId?: string,
  ): Promise<string[]> {
    const results: string[] = [];

    for (const mask of masks) {
      try {
        const maskKey = await this.storeMask(
          mask.url,
          sequenceId,
          mask.type,
          mask.index,
          mask.characterId,
          projectId,
          scriptId,
        );
        results.push(maskKey);
      } catch (error) {
        // 单个失败不影响其他 mask，继续处理
        this.logger.warn(
          `mask 批量转存部分失败: type=${mask.type}, sequenceId=${sequenceId}`,
        );
      }
    }

    return results;
  }

  /**
   * 生成 mask 存储路径
   * 格式：mask/projects/{projectId}/scripts/{scriptId}/{date}/{sequenceId}_{suffix}.png
   */
  private generateMaskKey(
    sequenceId: string,
    type: "subject" | "manual" | "preview",
    index?: number,
    characterId?: string,
    projectId?: string,
    scriptId?: string,
  ): string {
    const date = new Date().toISOString().split("T")[0].replace(/-/g, "");

    let suffix: string;
    switch (type) {
      case "subject":
        suffix = `${index ?? 0}`;
        break;
      case "manual":
        suffix = `${characterId}_manual`;
        break;
      case "preview":
        suffix = `${index ?? 0}_preview`;
        break;
      default:
        suffix = "unknown";
    }

    const scopePart = projectId
      ? scriptId
        ? `projects/${projectId}/scripts/${scriptId}/`
        : `projects/${projectId}/`
      : "";
    return `mask/${scopePart}${date}/${sequenceId}_${suffix}.png`;
  }

  /**
   * 下载图片到 Buffer
   */
  private async downloadImage(url: string): Promise<Buffer> {
    // 火山引擎临时 URL 可直接访问，无需 URL 转换
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "image/png, image/jpeg, image/*",
      },
    });

    if (!response.ok) {
      this.logger.error("下载 mask 图片失败");
      this.logger.debug(`详细错误信息: status=${response.status}`);
      throw new Error("下载图片失败，请稍后重试");
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 获取 mask 的完整 URL
   * @param maskKey 存储路径
   * @returns 可访问的完整 URL
   */
  async getMaskUrl(maskKey: string): Promise<string> {
    return this.urlTransformService.getAccessibleUrl(`/static/${maskKey}`);
  }

  /**
   * 删除 mask 图片
   * @param maskKey 存储路径
   */
  async deleteMask(maskKey: string): Promise<boolean> {
    try {
      const result = await this.ossService.deleteFile(maskKey);
      if (result) {
        this.logger.log(`mask 图片删除成功: key=${maskKey}`);
      }
      return result;
    } catch (error) {
      this.logger.error(`mask 图片删除失败: key=${maskKey}`);
      this.logger.debug("详细错误信息:", error);
      return false;
    }
  }
}
