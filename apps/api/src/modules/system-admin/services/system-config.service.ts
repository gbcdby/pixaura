import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { RedisService } from "../../../common/redis/redis.service";
import { SystemConfig } from "../entities/system-config.entity";
import { EncryptionService } from "../../model-config/services/encryption.service";

export interface FileUploadItemConfig {
  maxSize?: number;
  allowedTypes?: string[];
  dailyLimit?: number;
}

export interface FileUploadConfig {
  avatar?: FileUploadItemConfig;
  reference?: FileUploadItemConfig;
  project?: { maxSize?: number };
}

export interface RateLimitConfig {
  enabled?: boolean;
  windowSeconds?: number;
  maxRequests?: number;
  banDurationSeconds?: number;
  whitelistIps?: string[];
}

@Injectable()
export class SystemConfigService {
  private readonly CONFIG_CACHE_PREFIX = "sys:config:";
  private readonly CONFIG_CACHE_TTL = 300; // 5分钟

  // TTS 配置相关常量
  private readonly TTS_CONFIG_KEY = "tts.api_config";

  constructor(
    @InjectRepository(SystemConfig)
    private readonly configRepo: Repository<SystemConfig>,
    private readonly redisService: RedisService,
    private readonly encryptionService: EncryptionService,
  ) {}

  /**
   * 获取完整配置
   */
  async getFullConfig(): Promise<{
    fileUpload: FileUploadConfig;
    rateLimit: RateLimitConfig;
  }> {
    const [avatarConfig, referenceConfig, projectConfig, rateLimitConfig] =
      await Promise.all([
        this.getConfig("file_upload.avatar"),
        this.getConfig("file_upload.reference"),
        this.getConfig("file_upload.project"),
        this.getConfig("rate_limit"),
      ]);

    return {
      fileUpload: {
        avatar: avatarConfig ?? {
          maxSize: 1048576,
          allowedTypes: ["jpg", "png", "webp"],
          dailyLimit: 3,
        },
        reference: referenceConfig ?? {
          maxSize: 5242880,
          allowedTypes: ["jpg", "png", "webp"],
        },
        project: projectConfig ?? {
          maxSize: 52428800,
        },
      },
      rateLimit: rateLimitConfig ?? {
        enabled: true,
        windowSeconds: 60,
        maxRequests: 100,
        banDurationSeconds: 300,
        whitelistIps: ["127.0.0.1"],
      },
    };
  }

  /**
   * 获取单个配置
   */
  async getConfig<T>(key: string): Promise<T | null> {
    // 先查缓存
    const cacheKey = `${this.CONFIG_CACHE_PREFIX}${key}`;
    const cached = await this.redisService.getClient().get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as T;
    }

    // 查数据库
    const config = await this.configRepo.findOne({
      where: { configKey: key },
    });

    if (!config) {
      return null;
    }

    // 写入缓存
    await this.redisService
      .getClient()
      .setex(
        cacheKey,
        this.CONFIG_CACHE_TTL,
        JSON.stringify(config.configValue),
      );

    return config.configValue as T;
  }

  /**
   * 更新文件上传配置
   */
  async updateFileUploadConfig(
    config: Partial<FileUploadConfig>,
    adminId: string,
  ) {
    if (config.avatar) {
      await this.setConfig("file_upload.avatar", config.avatar, adminId);
    }
    if (config.reference) {
      await this.setConfig("file_upload.reference", config.reference, adminId);
    }
    if (config.project) {
      await this.setConfig("file_upload.project", config.project, adminId);
    }

    // 清除缓存
    await this.clearConfigCache();

    return this.getFullConfig();
  }

  /**
   * 更新限流配置
   */
  async updateRateLimitConfig(
    config: Partial<RateLimitConfig>,
    adminId: string,
  ) {
    const existing = await this.getConfig<RateLimitConfig>("rate_limit");
    const merged = { ...existing, ...config };

    await this.setConfig("rate_limit", merged, adminId);

    // 清除缓存
    await this.clearConfigCache();

    return this.getFullConfig();
  }

  /**
   * 设置配置
   */
  private async setConfig<T>(
    key: string,
    value: T,
    adminId: string,
  ): Promise<void> {
    let config = await this.configRepo.findOne({
      where: { configKey: key },
    });

    if (config) {
      config.configValue = value as Record<string, unknown>;
      config.updatedBy = adminId;
    } else {
      config = this.configRepo.create({
        configKey: key,
        configValue: value as Record<string, unknown>,
        updatedBy: adminId,
      });
    }

    await this.configRepo.save(config);

    // 更新缓存
    const cacheKey = `${this.CONFIG_CACHE_PREFIX}${key}`;
    await this.redisService
      .getClient()
      .setex(cacheKey, this.CONFIG_CACHE_TTL, JSON.stringify(value));
  }

  /**
   * 清除配置缓存
   */
  private async clearConfigCache(): Promise<void> {
    const keys = await this.redisService
      .getClient()
      .keys(`${this.CONFIG_CACHE_PREFIX}*`);
    if (keys.length > 0) {
      await this.redisService.getClient().del(...keys);
    }
  }

  // ==================== 加密密钥管理 ====================

  private readonly ENCRYPTION_KEY_CONFIG = "security.encryption_key";

  /**
   * 获取加密密钥（用于 API Key 加密/解密）
   * 优先从 Redis 缓存读取，缓存未命中则从数据库读取
   */
  async getEncryptionKey(): Promise<string | null> {
    // 1. 先查 Redis 缓存
    const cacheKey = `${this.CONFIG_CACHE_PREFIX}${this.ENCRYPTION_KEY_CONFIG}`;
    const cached = await this.redisService.getClient().get(cacheKey);
    if (cached) {
      return cached;
    }

    // 2. 查数据库
    const config = await this.configRepo.findOne({
      where: { configKey: this.ENCRYPTION_KEY_CONFIG },
    });

    if (!config) {
      return null;
    }

    const keyValue = config.configValue?.value as string;
    if (!keyValue) {
      return null;
    }

    // 3. 写入 Redis 缓存（长期缓存，密钥不常变更）
    await this.redisService.getClient().setex(cacheKey, 3600, keyValue); // 1小时缓存

    return keyValue;
  }

  /**
   * 设置加密密钥
   */
  async setEncryptionKey(key: string, adminId: string): Promise<void> {
    let config = await this.configRepo.findOne({
      where: { configKey: this.ENCRYPTION_KEY_CONFIG },
    });

    if (config) {
      config.configValue = { value: key };
      config.updatedBy = adminId;
    } else {
      config = this.configRepo.create({
        configKey: this.ENCRYPTION_KEY_CONFIG,
        configValue: { value: key },
        description: "API Key 加密密钥",
        updatedBy: adminId,
      });
    }

    await this.configRepo.save(config);

    // 更新 Redis 缓存
    const cacheKey = `${this.CONFIG_CACHE_PREFIX}${this.ENCRYPTION_KEY_CONFIG}`;
    await this.redisService.getClient().setex(cacheKey, 3600, key);
  }

  /**
   * 生成新的加密密钥
   */
  generateEncryptionKey(): string {
    const { randomBytes } = require("crypto");
    return randomBytes(32).toString("base64");
  }

  // ==================== TTS API 配置管理 ====================

  // TTS 模型价格默认值（¥/字）
  private readonly TTS_DEFAULT_PRICES = {
    flash: { costPerChar: 0.00002, pricePerChar: 0.00005 },
    instructFlash: { costPerChar: 0.00003, pricePerChar: 0.00008 },
  };

  /**
   * 获取 TTS API 配置
   */
  async getTTSApiConfig(): Promise<{
    apiKey: string;
    baseUrl: string;
    enabled: boolean;
    hasApiKey: boolean;
    models: {
      flash: { enabled: boolean; costPerChar: number; pricePerChar: number };
      instructFlash: {
        enabled: boolean;
        costPerChar: number;
        pricePerChar: number;
      };
    };
  } | null> {
    // 先查缓存
    const cacheKey = `${this.CONFIG_CACHE_PREFIX}${this.TTS_CONFIG_KEY}`;
    const cached = await this.redisService.getClient().get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      // 解密 API Key
      if (parsed.apiKeyEnc) {
        try {
          parsed.apiKey = await this.encryptionService.decrypt(
            parsed.apiKeyEnc,
          );
          parsed.hasApiKey = true;
          delete parsed.apiKeyEnc;
        } catch {
          return null;
        }
      }
      return parsed;
    }

    // 查数据库
    const config = await this.configRepo.findOne({
      where: { configKey: this.TTS_CONFIG_KEY },
    });

    if (!config) {
      // 返回默认配置
      return {
        apiKey: "",
        baseUrl: "https://dashscope.aliyuncs.com",
        enabled: true,
        hasApiKey: false,
        models: {
          flash: { enabled: true, ...this.TTS_DEFAULT_PRICES.flash },
          instructFlash: {
            enabled: true,
            ...this.TTS_DEFAULT_PRICES.instructFlash,
          },
        },
      };
    }

    const value = config.configValue as Record<string, unknown>;
    let apiKey = "";
    let hasApiKey = false;

    // 解密 API Key
    if (value.apiKeyEnc) {
      try {
        apiKey = await this.encryptionService.decrypt(
          value.apiKeyEnc as string,
        );
        hasApiKey = true;
      } catch {
        // 解密失败，返回 null
        return null;
      }
    }

    const modelConfig = value.models as Record<string, unknown> | undefined;
    const flashConfig = modelConfig?.flash as
      | Record<string, unknown>
      | undefined;
    const instructConfig = modelConfig?.instructFlash as
      | Record<string, unknown>
      | undefined;

    const result = {
      apiKey,
      baseUrl: (value.baseUrl as string) || "https://dashscope.aliyuncs.com",
      enabled: (value.enabled as boolean) ?? true,
      hasApiKey,
      models: {
        flash: {
          enabled: (flashConfig?.enabled as boolean) ?? true,
          costPerChar:
            (flashConfig?.costPerChar as number) ??
            this.TTS_DEFAULT_PRICES.flash.costPerChar,
          pricePerChar:
            (flashConfig?.pricePerChar as number) ??
            this.TTS_DEFAULT_PRICES.flash.pricePerChar,
        },
        instructFlash: {
          enabled: (instructConfig?.enabled as boolean) ?? true,
          costPerChar:
            (instructConfig?.costPerChar as number) ??
            this.TTS_DEFAULT_PRICES.instructFlash.costPerChar,
          pricePerChar:
            (instructConfig?.pricePerChar as number) ??
            this.TTS_DEFAULT_PRICES.instructFlash.pricePerChar,
        },
      },
    };

    // 写入缓存（不缓存明文 API Key，缓存加密后的）
    await this.redisService.getClient().setex(
      cacheKey,
      this.CONFIG_CACHE_TTL,
      JSON.stringify({
        ...result,
        apiKey: "", // 缓存中不存明文
        apiKeyEnc: value.apiKeyEnc,
      }),
    );

    return result;
  }

  /**
   * 更新 TTS API 配置
   */
  async updateTTSApiConfig(
    config: {
      apiKey?: string;
      baseUrl?: string;
      enabled?: boolean;
      models?: {
        flash?: {
          enabled?: boolean;
          costPerChar?: number;
          pricePerChar?: number;
        };
        instructFlash?: {
          enabled?: boolean;
          costPerChar?: number;
          pricePerChar?: number;
        };
      };
    },
    adminId: string,
  ): Promise<{
    apiKey: string;
    baseUrl: string;
    enabled: boolean;
    hasApiKey: boolean;
    models: {
      flash: { enabled: boolean; costPerChar: number; pricePerChar: number };
      instructFlash: {
        enabled: boolean;
        costPerChar: number;
        pricePerChar: number;
      };
    };
  }> {
    // 获取现有配置
    const existing = await this.configRepo.findOne({
      where: { configKey: this.TTS_CONFIG_KEY },
    });

    const existingValue = existing?.configValue as
      | Record<string, unknown>
      | undefined;
    const existingModels = existingValue?.models as
      | Record<string, unknown>
      | undefined;
    const existingFlash = existingModels?.flash as
      | Record<string, unknown>
      | undefined;
    const existingInstruct = existingModels?.instructFlash as
      | Record<string, unknown>
      | undefined;

    // 处理 API Key
    let apiKeyEnc: string | undefined;
    let hasApiKey = false;
    if (config.apiKey) {
      apiKeyEnc = await this.encryptionService.encrypt(config.apiKey);
      hasApiKey = true;
    } else if (existingValue?.apiKeyEnc) {
      apiKeyEnc = existingValue.apiKeyEnc as string;
      hasApiKey = true;
    }

    // 合并模型配置
    const flashConfig = config.models?.flash || {};
    const instructConfig = config.models?.instructFlash || {};

    const value: Record<string, unknown> = {
      apiKeyEnc,
      baseUrl:
        config.baseUrl ||
        (existingValue?.baseUrl as string) ||
        "https://dashscope.aliyuncs.com",
      enabled: config.enabled ?? (existingValue?.enabled as boolean) ?? true,
      models: {
        flash: {
          enabled:
            flashConfig.enabled ?? (existingFlash?.enabled as boolean) ?? true,
          costPerChar:
            flashConfig.costPerChar ??
            (existingFlash?.costPerChar as number) ??
            this.TTS_DEFAULT_PRICES.flash.costPerChar,
          pricePerChar:
            flashConfig.pricePerChar ??
            (existingFlash?.pricePerChar as number) ??
            this.TTS_DEFAULT_PRICES.flash.pricePerChar,
        },
        instructFlash: {
          enabled:
            instructConfig.enabled ??
            (existingInstruct?.enabled as boolean) ??
            true,
          costPerChar:
            instructConfig.costPerChar ??
            (existingInstruct?.costPerChar as number) ??
            this.TTS_DEFAULT_PRICES.instructFlash.costPerChar,
          pricePerChar:
            instructConfig.pricePerChar ??
            (existingInstruct?.pricePerChar as number) ??
            this.TTS_DEFAULT_PRICES.instructFlash.pricePerChar,
        },
      },
    };

    let configRecord = existing;
    if (configRecord) {
      configRecord.configValue = value;
      configRecord.updatedBy = adminId;
    } else {
      configRecord = this.configRepo.create({
        configKey: this.TTS_CONFIG_KEY,
        configValue: value,
        description: "TTS API 配置（千问 TTS / DashScope）",
        updatedBy: adminId,
      });
    }

    await this.configRepo.save(configRecord);

    // 清除缓存
    const cacheKey = `${this.CONFIG_CACHE_PREFIX}${this.TTS_CONFIG_KEY}`;
    await this.redisService.getClient().del(cacheKey);

    const models = value.models as Record<string, Record<string, unknown>>;
    return {
      apiKey: config.apiKey || "",
      baseUrl: value.baseUrl as string,
      enabled: value.enabled as boolean,
      hasApiKey,
      models: {
        flash: models.flash as {
          enabled: boolean;
          costPerChar: number;
          pricePerChar: number;
        },
        instructFlash: models.instructFlash as {
          enabled: boolean;
          costPerChar: number;
          pricePerChar: number;
        },
      },
    };
  }

  /**
   * 检查 TTS API 是否已配置
   */
  async isTTSConfigured(): Promise<boolean> {
    const config = await this.getTTSApiConfig();
    return !!(config && config.hasApiKey && config.enabled);
  }

  // ==================== 对口型 API 配置管理 ====================

  // 对口型配置键
  private readonly LIP_SYNC_CONFIG_KEY = "lip_sync.api_config";

  // 对口型默认价格配置（火山引擎）
  private readonly LIP_SYNC_DEFAULT_CONFIG = {
    baseUrl: "https://visual.volcengineapi.com",
    enabled: true,
    subjectDetection: {
      enabled: true,
      costPerRequest: 0.02,
      pricePerRequest: 0.05,
    },
    lipSync: {
      enabled: true,
      costPerSecond: 1.0,
      pricePerSecond: 1.5,
    },
  };

  /**
   * 获取对口型 API 配置
   * 火山引擎需要 AccessKey 和 SecretKey
   */
  async getLipSyncApiConfig(): Promise<{
    accessKey: string;
    secretKey: string;
    baseUrl: string;
    enabled: boolean;
    hasCredentials: boolean;
    subjectDetection: {
      enabled: boolean;
      costPerRequest: number;
      pricePerRequest: number;
    };
    lipSync: {
      enabled: boolean;
      costPerSecond: number;
      pricePerSecond: number;
    };
  } | null> {
    // 先查缓存
    const cacheKey = `${this.CONFIG_CACHE_PREFIX}${this.LIP_SYNC_CONFIG_KEY}`;
    const cached = await this.redisService.getClient().get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      // 解密 AccessKey 和 SecretKey
      if (parsed.accessKeyEnc && parsed.secretKeyEnc) {
        try {
          parsed.accessKey = await this.encryptionService.decrypt(
            parsed.accessKeyEnc,
          );
          parsed.secretKey = await this.encryptionService.decrypt(
            parsed.secretKeyEnc,
          );
          parsed.hasCredentials = true;
          delete parsed.accessKeyEnc;
          delete parsed.secretKeyEnc;
        } catch {
          return null;
        }
      }
      return parsed;
    }

    // 查数据库
    const config = await this.configRepo.findOne({
      where: { configKey: this.LIP_SYNC_CONFIG_KEY },
    });

    if (!config) {
      // 返回默认配置
      return {
        accessKey: "",
        secretKey: "",
        baseUrl: this.LIP_SYNC_DEFAULT_CONFIG.baseUrl,
        enabled: this.LIP_SYNC_DEFAULT_CONFIG.enabled,
        hasCredentials: false,
        subjectDetection: this.LIP_SYNC_DEFAULT_CONFIG.subjectDetection,
        lipSync: this.LIP_SYNC_DEFAULT_CONFIG.lipSync,
      };
    }

    const value = config.configValue as Record<string, unknown>;
    let accessKey = "";
    let secretKey = "";
    let hasCredentials = false;

    // 解密 AccessKey 和 SecretKey
    if (value.accessKeyEnc && value.secretKeyEnc) {
      try {
        accessKey = await this.encryptionService.decrypt(
          value.accessKeyEnc as string,
        );
        secretKey = await this.encryptionService.decrypt(
          value.secretKeyEnc as string,
        );
        hasCredentials = true;
      } catch {
        // 解密失败，返回 null
        return null;
      }
    }

    const subjectDetectionConfig = value.subjectDetection as
      | Record<string, unknown>
      | undefined;
    const lipSyncConfig = value.lipSync as Record<string, unknown> | undefined;

    const result = {
      accessKey,
      secretKey,
      baseUrl:
        (value.baseUrl as string) || this.LIP_SYNC_DEFAULT_CONFIG.baseUrl,
      enabled:
        (value.enabled as boolean) ?? this.LIP_SYNC_DEFAULT_CONFIG.enabled,
      hasCredentials,
      subjectDetection: {
        enabled:
          (subjectDetectionConfig?.enabled as boolean) ??
          this.LIP_SYNC_DEFAULT_CONFIG.subjectDetection.enabled,
        costPerRequest:
          (subjectDetectionConfig?.costPerRequest as number) ??
          this.LIP_SYNC_DEFAULT_CONFIG.subjectDetection.costPerRequest,
        pricePerRequest:
          (subjectDetectionConfig?.pricePerRequest as number) ??
          this.LIP_SYNC_DEFAULT_CONFIG.subjectDetection.pricePerRequest,
      },
      lipSync: {
        enabled:
          (lipSyncConfig?.enabled as boolean) ??
          this.LIP_SYNC_DEFAULT_CONFIG.lipSync.enabled,
        costPerSecond:
          (lipSyncConfig?.costPerSecond as number) ??
          this.LIP_SYNC_DEFAULT_CONFIG.lipSync.costPerSecond,
        pricePerSecond:
          (lipSyncConfig?.pricePerSecond as number) ??
          this.LIP_SYNC_DEFAULT_CONFIG.lipSync.pricePerSecond,
      },
    };

    // 写入缓存（不缓存明文密钥，缓存加密后的）
    await this.redisService.getClient().setex(
      cacheKey,
      this.CONFIG_CACHE_TTL,
      JSON.stringify({
        ...result,
        accessKey: "", // 缓存中不存明文
        secretKey: "",
        accessKeyEnc: value.accessKeyEnc,
        secretKeyEnc: value.secretKeyEnc,
      }),
    );

    return result;
  }

  /**
   * 更新对口型 API 配置
   */
  async updateLipSyncApiConfig(
    config: {
      accessKey?: string;
      secretKey?: string;
      baseUrl?: string;
      enabled?: boolean;
      subjectDetection?: {
        enabled?: boolean;
        costPerRequest?: number;
        pricePerRequest?: number;
      };
      lipSync?: {
        enabled?: boolean;
        costPerSecond?: number;
        pricePerSecond?: number;
      };
    },
    adminId: string,
  ): Promise<{
    accessKey: string;
    secretKey: string;
    baseUrl: string;
    enabled: boolean;
    hasCredentials: boolean;
    subjectDetection: {
      enabled: boolean;
      costPerRequest: number;
      pricePerRequest: number;
    };
    lipSync: {
      enabled: boolean;
      costPerSecond: number;
      pricePerSecond: number;
    };
  }> {
    // 获取现有配置
    const existing = await this.configRepo.findOne({
      where: { configKey: this.LIP_SYNC_CONFIG_KEY },
    });

    const existingValue = existing?.configValue as
      | Record<string, unknown>
      | undefined;
    const existingSubjectDetection = existingValue?.subjectDetection as
      | Record<string, unknown>
      | undefined;
    const existingLipSync = existingValue?.lipSync as
      | Record<string, unknown>
      | undefined;

    // 处理 AccessKey 和 SecretKey
    let accessKeyEnc: string | undefined;
    let secretKeyEnc: string | undefined;
    let hasCredentials = false;

    if (config.accessKey && config.secretKey) {
      accessKeyEnc = await this.encryptionService.encrypt(config.accessKey);
      secretKeyEnc = await this.encryptionService.encrypt(config.secretKey);
      hasCredentials = true;
    } else if (existingValue?.accessKeyEnc && existingValue?.secretKeyEnc) {
      accessKeyEnc = existingValue.accessKeyEnc as string;
      secretKeyEnc = existingValue.secretKeyEnc as string;
      hasCredentials = true;
    }

    // 合并配置
    const subjectConfig = config.subjectDetection || {};
    const lipSyncConfig = config.lipSync || {};

    const value: Record<string, unknown> = {
      accessKeyEnc,
      secretKeyEnc,
      baseUrl:
        config.baseUrl ||
        (existingValue?.baseUrl as string) ||
        this.LIP_SYNC_DEFAULT_CONFIG.baseUrl,
      enabled:
        config.enabled ??
        (existingValue?.enabled as boolean) ??
        this.LIP_SYNC_DEFAULT_CONFIG.enabled,
      subjectDetection: {
        enabled:
          subjectConfig.enabled ??
          (existingSubjectDetection?.enabled as boolean) ??
          this.LIP_SYNC_DEFAULT_CONFIG.subjectDetection.enabled,
        costPerRequest:
          subjectConfig.costPerRequest ??
          (existingSubjectDetection?.costPerRequest as number) ??
          this.LIP_SYNC_DEFAULT_CONFIG.subjectDetection.costPerRequest,
        pricePerRequest:
          subjectConfig.pricePerRequest ??
          (existingSubjectDetection?.pricePerRequest as number) ??
          this.LIP_SYNC_DEFAULT_CONFIG.subjectDetection.pricePerRequest,
      },
      lipSync: {
        enabled:
          lipSyncConfig.enabled ??
          (existingLipSync?.enabled as boolean) ??
          this.LIP_SYNC_DEFAULT_CONFIG.lipSync.enabled,
        costPerSecond:
          lipSyncConfig.costPerSecond ??
          (existingLipSync?.costPerSecond as number) ??
          this.LIP_SYNC_DEFAULT_CONFIG.lipSync.costPerSecond,
        pricePerSecond:
          lipSyncConfig.pricePerSecond ??
          (existingLipSync?.pricePerSecond as number) ??
          this.LIP_SYNC_DEFAULT_CONFIG.lipSync.pricePerSecond,
      },
    };

    let configRecord = existing;
    if (configRecord) {
      configRecord.configValue = value;
      configRecord.updatedBy = adminId;
    } else {
      configRecord = this.configRepo.create({
        configKey: this.LIP_SYNC_CONFIG_KEY,
        configValue: value,
        description: "对口型 API 配置（火山引擎 OmniHuman + 主体检测）",
        updatedBy: adminId,
      });
    }

    await this.configRepo.save(configRecord);

    // 清除缓存
    const cacheKey = `${this.CONFIG_CACHE_PREFIX}${this.LIP_SYNC_CONFIG_KEY}`;
    await this.redisService.getClient().del(cacheKey);

    const subjectDetection = value.subjectDetection as Record<string, unknown>;
    const lipSync = value.lipSync as Record<string, unknown>;

    return {
      accessKey: config.accessKey || "",
      secretKey: config.secretKey || "",
      baseUrl: value.baseUrl as string,
      enabled: value.enabled as boolean,
      hasCredentials,
      subjectDetection: {
        enabled: subjectDetection.enabled as boolean,
        costPerRequest: subjectDetection.costPerRequest as number,
        pricePerRequest: subjectDetection.pricePerRequest as number,
      },
      lipSync: {
        enabled: lipSync.enabled as boolean,
        costPerSecond: lipSync.costPerSecond as number,
        pricePerSecond: lipSync.pricePerSecond as number,
      },
    };
  }

  /**
   * 检查对口型 API 是否已配置
   */
  async isLipSyncConfigured(): Promise<boolean> {
    const config = await this.getLipSyncApiConfig();
    return !!(config && config.hasCredentials && config.enabled);
  }
}
