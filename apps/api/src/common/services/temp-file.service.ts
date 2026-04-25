import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";

/**
 * 临时文件元数据
 */
interface TempFileMetadata {
  key: string; // 文件相对路径（temp/xxx.png）
  createdAt: number; // 创建时间戳
}

/**
 * 临时文件存储服务
 * - 保存裁切后的图片
 * - 复制音频文件到临时目录
 * - 定时清理过期文件
 */
@Injectable()
export class TempFileService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TempFileService.name);
  private readonly FILE_TTL = 30 * 60 * 1000; // 30分钟过期
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5分钟清理一次
  private cleanupTimer: NodeJS.Timeout | null = null;
  private tempDir: string;
  private metaFile: string;
  private metadata: TempFileMetadata[] = [];

  constructor(private readonly configService: ConfigService) {
    const localDir =
      this.configService.get<string>("storage.local.dir") || "./uploads";
    this.tempDir = path.resolve(process.cwd(), localDir, "temp");
    this.metaFile = path.resolve(process.cwd(), localDir, "temp-meta.json");
  }

  /**
   * 模块初始化
   */
  async onModuleInit() {
    const storageType = this.configService.get<string>("storage.type");
    if (storageType !== "local") {
      return; // 只有本地存储模式需要临时文件
    }

    // 确保 temp 目录存在
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
      this.logger.log(`创建临时文件目录: ${this.tempDir}`);
    }

    // 加载已有的元数据
    this.loadMetadata();

    // 启动定时清理
    this.startCleanupTimer();
    this.logger.log(
      `临时文件服务已启动，清理间隔: ${this.CLEANUP_INTERVAL / 60000}分钟，过期时间: ${this.FILE_TTL / 60000}分钟`,
    );
  }

  /**
   * 模块销毁
   */
  onModuleDestroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    // 保存元数据
    this.saveMetadata();
  }

  /**
   * 保存裁切后的图片
   * @param imageData base64 格式图片数据（data:image/png;base64,xxx）或 Buffer
   * @param shotGroupId 分镜组 ID
   * @param characterId 角色 ID
   * @returns 文件相对路径（temp/xxx.png）
   */
  async saveCroppedImage(
    imageData: string | Buffer,
    shotGroupId: string,
    characterId: string,
  ): Promise<string> {
    const fileName = `${shotGroupId}_${characterId}_${uuidv4()}.png`;
    const key = `temp/${fileName}`;
    const filePath = path.join(this.tempDir, fileName);

    let buffer: Buffer;
    if (typeof imageData === "string") {
      // 处理 base64 格式
      const base64Match = imageData.match(/^data:image\/[^;]+;base64,(.+)$/);
      if (!base64Match) {
        throw new Error("无效的 base64 图片格式");
      }
      buffer = Buffer.from(base64Match[1], "base64");
    } else {
      buffer = imageData;
    }

    fs.writeFileSync(filePath, buffer);
    this.logger.debug(`保存裁切图片: ${key}, 大小: ${buffer.length}字节`);

    // 记录元数据
    this.metadata.push({ key, createdAt: Date.now() });
    this.saveMetadata();

    return key;
  }

  /**
   * 复制音频文件到临时目录
   * @param audioKey 原音频文件 key（如 audio/xxx.wav）
   * @param dialogueId 对话 ID
   * @returns 文件相对路径（temp/xxx.wav）
   */
  async copyAudioToTemp(audioKey: string, dialogueId: string): Promise<string> {
    const localDir =
      this.configService.get<string>("storage.local.dir") || "./uploads";
    const sourcePath = path.resolve(process.cwd(), localDir, audioKey);

    if (!fs.existsSync(sourcePath)) {
      throw new Error(`音频文件不存在: ${audioKey}`);
    }

    // 获取文件扩展名
    const ext = path.extname(audioKey) || ".wav";
    const fileName = `${dialogueId}_${uuidv4()}${ext}`;
    const key = `temp/${fileName}`;
    const destPath = path.join(this.tempDir, fileName);

    // 复制文件
    fs.copyFileSync(sourcePath, destPath);
    this.logger.debug(`复制音频到临时目录: ${key}`);

    // 记录元数据
    this.metadata.push({ key, createdAt: Date.now() });
    this.saveMetadata();

    return key;
  }

  /**
   * 获取临时文件的公网 URL
   * @param key 文件相对路径
   * @param ngrokUrl ngrok 公网 URL
   */
  getTempFileUrl(key: string, ngrokUrl: string): string {
    return `${ngrokUrl}/static/${key}`;
  }

  /**
   * 删除临时文件
   * @param key 文件相对路径
   */
  async deleteTempFile(key: string): Promise<boolean> {
    const filePath = path.join(this.tempDir, path.basename(key));

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      this.logger.debug(`删除临时文件: ${key}`);

      // 从元数据中移除
      this.metadata = this.metadata.filter((m) => m.key !== key);
      this.saveMetadata();

      return true;
    }

    return false;
  }

  /**
   * 加载元数据
   */
  private loadMetadata(): void {
    if (fs.existsSync(this.metaFile)) {
      try {
        const content = fs.readFileSync(this.metaFile, "utf-8");
        this.metadata = JSON.parse(content) as TempFileMetadata[];
        this.logger.debug(`加载元数据: ${this.metadata.length}条记录`);
      } catch (error) {
        this.logger.warn(`加载元数据失败: ${error}`);
        this.metadata = [];
      }
    }
  }

  /**
   * 保存元数据
   */
  private saveMetadata(): void {
    try {
      fs.writeFileSync(this.metaFile, JSON.stringify(this.metadata, null, 2));
    } catch (error) {
      this.logger.error(`保存元数据失败: ${error}`);
    }
  }

  /**
   * 启动定时清理
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredFiles();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * 清理过期文件
   */
  private cleanupExpiredFiles(): void {
    const now = Date.now();
    const expiredFiles = this.metadata.filter(
      (m) => now - m.createdAt > this.FILE_TTL,
    );

    if (expiredFiles.length === 0) {
      return;
    }

    this.logger.log(`清理 ${expiredFiles.length} 个过期临时文件`);

    for (const file of expiredFiles) {
      const filePath = path.join(this.tempDir, path.basename(file.key));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.logger.debug(`删除过期文件: ${file.key}`);
      }
    }

    // 更新元数据
    this.metadata = this.metadata.filter(
      (m) => now - m.createdAt <= this.FILE_TTL,
    );
    this.saveMetadata();
  }
}