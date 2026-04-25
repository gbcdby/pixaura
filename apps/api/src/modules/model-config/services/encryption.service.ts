/**
 * 加密服务
 * 管理 API Key 的加密/解密，密钥从数据库读取并缓存到 Redis
 */
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto";
import { RedisService } from "../../../common/redis/redis.service";
import { SystemConfig } from "../../system-admin/entities/system-config.entity";

@Injectable()
export class EncryptionService implements OnModuleInit {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly ALGORITHM = "aes-256-gcm";
  private readonly KEY_LENGTH = 32;
  private readonly IV_LENGTH = 16;
  private readonly CACHE_KEY = "sys:encryption:key";
  private readonly CONFIG_KEY = "security.encryption_key";

  private cachedKey: Buffer | null = null;

  constructor(
    @InjectRepository(SystemConfig)
    private readonly configRepo: Repository<SystemConfig>,
    private readonly redisService: RedisService,
  ) {}

  async onModuleInit() {
    // 启动时预热密钥
    try {
      await this.getKey();
      this.logger.log("加密服务初始化完成");
    } catch (error) {
      this.logger.warn(
        `加密密钥未配置: ${error instanceof Error ? error.message : "未知错误"}`,
      );
    }
  }

  /**
   * 获取加密密钥
   * 优先级：内存缓存 > Redis 缓存 > 数据库
   */
  private async getKey(): Promise<Buffer> {
    // 1. 检查内存缓存
    if (this.cachedKey) {
      return this.cachedKey;
    }

    // 2. 检查 Redis 缓存
    const redisKey = await this.redisService.getClient().get(this.CACHE_KEY);
    if (redisKey) {
      this.cachedKey = Buffer.from(redisKey, "base64");
      return this.cachedKey;
    }

    // 3. 从数据库读取
    const config = await this.configRepo.findOne({
      where: { configKey: this.CONFIG_KEY },
    });

    let keyValue: string;

    if (config?.configValue?.value) {
      keyValue = config.configValue.value as string;
    } else {
      // 4. 未配置则生成新密钥（仅开发环境）
      if (process.env.NODE_ENV === "production") {
        throw new Error(
          "加密密钥未配置，请在管理后台设置 security.encryption_key",
        );
      }
      this.logger.warn("使用开发环境默认密钥，生产环境请配置正式密钥");
      keyValue = this.generateKey();

      // 自动保存到数据库（开发环境）
      await this.saveKey(keyValue, null);
    }

    // 转换为 Buffer 并缓存
    this.cachedKey = Buffer.from(keyValue, "base64");

    // 写入 Redis 缓存
    await this.redisService.getClient().setex(this.CACHE_KEY, 3600, keyValue);

    return this.cachedKey;
  }

  /**
   * 生成新的加密密钥
   */
  generateKey(): string {
    return randomBytes(32).toString("base64");
  }

  /**
   * 保存加密密钥到数据库
   */
  async saveKey(key: string, adminId: string | null): Promise<void> {
    let config = await this.configRepo.findOne({
      where: { configKey: this.CONFIG_KEY },
    });

    if (config) {
      config.configValue = { value: key };
      config.updatedBy = adminId;
    } else {
      config = this.configRepo.create({
        configKey: this.CONFIG_KEY,
        configValue: { value: key },
        description: "API Key 加密密钥（AES-256-GCM）",
        updatedBy: adminId,
      });
    }

    await this.configRepo.save(config);

    // 更新缓存
    this.cachedKey = Buffer.from(key, "base64");
    await this.redisService.getClient().setex(this.CACHE_KEY, 3600, key);

    this.logger.log("加密密钥已更新");
  }

  /**
   * 清除密钥缓存（密钥更新时调用）
   */
  async clearCache(): Promise<void> {
    this.cachedKey = null;
    await this.redisService.getClient().del(this.CACHE_KEY);
  }

  /**
   * 加密文本
   */
  async encrypt(text: string): Promise<string> {
    if (!text) return "";

    try {
      const key = await this.getKey();
      const iv = randomBytes(this.IV_LENGTH);
      const cipher = createCipheriv(this.ALGORITHM, key, iv);
      let encrypted = cipher.update(text, "utf8", "base64");
      encrypted += cipher.final("base64");
      const authTag = cipher.getAuthTag();
      return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted}`;
    } catch (error) {
      throw new Error(
        `加密失败: ${error instanceof Error ? error.message : "未知错误"}`,
      );
    }
  }

  /**
   * 解密文本
   */
  async decrypt(encryptedText: string): Promise<string> {
    if (!encryptedText) return "";

    try {
      const key = await this.getKey();
      const parts = encryptedText.split(":");
      if (parts.length !== 3) throw new Error("无效的加密格式");
      const iv = Buffer.from(parts[0], "base64");
      const authTag = Buffer.from(parts[1], "base64");
      const ciphertext = parts[2];
      const decipher = createDecipheriv(this.ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(ciphertext, "base64", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    } catch (error) {
      throw new Error(
        `解密失败: ${error instanceof Error ? error.message : "未知错误"}`,
      );
    }
  }
}
