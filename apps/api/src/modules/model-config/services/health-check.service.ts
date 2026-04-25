import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThan } from "typeorm";
import { Cron } from "@nestjs/schedule";
import { Provider, ProviderHealthLog, ModelProvider } from "../entities";
import { ProviderService } from "./provider.service";
import { CacheService } from "./cache.service";
import { ModelCallLogService } from "./model-call-log.service";
import { ApiKeyAlertService } from "./api-key-alert.service";
import { EncryptionService } from "./encryption.service";
import type {
  ProviderHealthStatusDto,
  HealthCheckResultDto,
} from "@pixaura/shared-types";
import { ModelService } from "./model.service";

@Injectable()
export class HealthCheckService implements OnModuleInit {
  private readonly logger = new Logger(HealthCheckService.name);
  private readonly CONFIG = {
    CHECK_INTERVAL_MS: 30000,
    FAILURE_THRESHOLD: 3,
    TIMEOUT_MS: 10000,
  };

  constructor(
    @InjectRepository(Provider)
    private providerRepository: Repository<Provider>,
    @InjectRepository(ProviderHealthLog)
    private healthLogRepository: Repository<ProviderHealthLog>,
    @InjectRepository(ModelProvider)
    private modelProviderRepository: Repository<ModelProvider>,
    private providerService: ProviderService,
    private cacheService: CacheService,
    private modelCallLogService: ModelCallLogService,
    private apiKeyAlertService: ApiKeyAlertService,
    private modelService: ModelService,
    private encryptionService: EncryptionService,
  ) {}

  /**
   * 模块初始化时立即执行一次健康检查和远程模型缓存
   */
  async onModuleInit() {
    this.logger.log("模块初始化，执行首次健康检查和远程模型缓存...");
    await this.scheduledHealthCheck();
  }

  async checkProvider(providerId: string): Promise<HealthCheckResultDto> {
    const provider = await this.providerRepository.findOne({
      where: { providerId },
    });

    if (!provider) {
      throw new Error("供应商不存在");
    }

    const startTime = Date.now();
    let checkStatus: "healthy" | "unhealthy" = "healthy";
    let statusCode: number | null = null;
    let errorMessage: string | null = null;

    try {
      const response = await this.performHealthCheck(provider);
      statusCode = response.status;

      if (!response.ok) {
        checkStatus = "unhealthy";
        // 优先使用返回的详细错误信息
        errorMessage = response.errorMessage || "请求失败";
      }
    } catch (error) {
      checkStatus = "unhealthy";
      errorMessage = "请求失败";
      this.logger.debug("健康检查错误详情:", error);
    }

    const responseTimeMs = Date.now() - startTime;

    await this.logHealthCheck({
      providerId,
      checkStatus,
      responseTimeMs,
      statusCode,
      errorMessage,
    });

    await this.cacheService.setProviderHealth(providerId, {
      status: checkStatus,
      lastCheck: new Date(),
      responseTimeMs: checkStatus === "healthy" ? responseTimeMs : undefined,
    });

    if (checkStatus === "unhealthy") {
      await this.handleFailure(providerId);
    } else if (provider.healthStatus === "unhealthy") {
      await this.handleRecovery(providerId);
    }

    await this.providerService.updateHealthStatus(providerId, checkStatus);

    return {
      providerId,
      healthStatus: checkStatus,
      responseTimeMs,
    };
  }

  async getAllHealthStatus(): Promise<ProviderHealthStatusDto[]> {
    const providers = await this.providerRepository.find({
      where: { status: "enabled" },
    });

    const results: ProviderHealthStatusDto[] = [];

    for (const provider of providers) {
      const stats = await this.getHealthStats(provider.providerId);

      const dto: ProviderHealthStatusDto = {
        providerId: provider.providerId,
        providerName: provider.providerName,
        healthStatus:
          provider.healthStatus as ProviderHealthStatusDto["healthStatus"],
        lastCheckAt: stats.lastCheckAt,
        avgResponseTimeMs: stats.avgResponseTimeMs,
        failureCount: stats.recentFailureCount,
      };

      if (provider.healthStatus === "unhealthy") {
        const failoverProvider = await this.getFailoverProvider(
          provider.providerId,
        );
        if (failoverProvider) {
          dto.failoverTo = failoverProvider;
        }
      }

      results.push(dto);
    }

    return results;
  }

  async manualHealthCheck(providerId: string): Promise<HealthCheckResultDto> {
    return this.checkProvider(providerId);
  }

  async getFailoverProvider(providerId: string): Promise<string | null> {
    const modelProviders = await this.modelProviderRepository.find({
      where: { providerId, status: "enabled" },
    });

    for (const mp of modelProviders) {
      const alternative = await this.modelProviderRepository.findOne({
        where: {
          modelId: mp.modelId,
          status: "enabled",
        },
        order: { priority: "ASC" },
      });

      if (alternative && alternative.providerId !== providerId) {
        const provider = await this.providerRepository.findOne({
          where: { providerId: alternative.providerId },
        });

        if (provider && provider.healthStatus === "healthy") {
          return alternative.providerId;
        }
      }
    }

    return null;
  }

  async cleanupOldLogs(): Promise<number> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const result = await this.healthLogRepository.delete({
      checkedAt: LessThan(sevenDaysAgo),
    });

    return result.affected || 0;
  }

  private async performHealthCheck(provider: Provider): Promise<{
    status: number;
    statusText: string;
    ok: boolean;
    errorMessage?: string;
  }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.CONFIG.TIMEOUT_MS,
    );

    try {
      // 解密 API Key
      let apiKey: string | null = null;
      if (provider.apiKeyEnc) {
        try {
          apiKey = await this.encryptionService.decrypt(provider.apiKeyEnc);
        } catch (decryptError) {
          this.logger.warn(
            `API Key 解密失败 - 供应商 ${provider.providerId}: ${decryptError instanceof Error ? decryptError.message : "未知错误"}`,
          );
          clearTimeout(timeoutId);
          return {
            status: 0,
            statusText: "API Key 解密失败",
            ok: false,
            errorMessage: "API Key 解密失败，请检查加密密钥配置",
          };
        }
      }

      // 标准化 baseUrl 处理：移除末尾斜杠
      const normalizedBaseUrl = provider.baseUrl?.replace(/\/$/, "");

      // 统一使用 OpenAI 兼容格式进行健康检查 - 使用 /models 接口
      const healthUrl = `${normalizedBaseUrl}/models`;
      const fetchOptions: RequestInit = {
        method: "GET",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey || ""}`,
          "Content-Type": "application/json",
        },
      };

      const response = await fetch(healthUrl, fetchOptions);
      clearTimeout(timeoutId);

      // 读取响应体获取详细错误信息
      let responseBody: string | undefined;
      try {
        responseBody = await response.text();
      } catch {
        // 忽略响应体读取错误
      }

      if (!response.ok) {
        // 脱敏处理：不暴露响应体内容
        this.logger.warn(`健康检查失败 - 供应商 ${provider.providerId}`);
        this.logger.debug(`详细错误: status=${response.status}, body=${responseBody?.slice(0, 200)}`);
        return {
          status: response.status,
          statusText: response.statusText,
          ok: false,
          errorMessage: "请求失败",
        };
      }

      return {
        status: response.status,
        statusText: response.statusText,
        ok: true,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      const errorMessage = "请求失败";
      this.logger.debug("健康检查错误详情:", error);
      return {
        status: 0,
        statusText: errorMessage,
        ok: false,
        errorMessage,
      };
    }
  }

  private async logHealthCheck(data: {
    providerId: string;
    checkStatus: string;
    responseTimeMs: number;
    statusCode: number | null;
    errorMessage: string | null;
  }): Promise<void> {
    const log = this.healthLogRepository.create({
      providerId: data.providerId,
      checkStatus: data.checkStatus,
      responseTimeMs: data.responseTimeMs,
      statusCode: data.statusCode,
      errorMessage: data.errorMessage,
      checkedAt: new Date(),
    });

    await this.healthLogRepository.save(log);
  }

  private async handleFailure(providerId: string): Promise<void> {
    const recentFailures = await this.getRecentFailureCount(providerId);

    if (recentFailures >= this.CONFIG.FAILURE_THRESHOLD) {
      this.logger.warn(
        `供应商 ${providerId} 连续 ${recentFailures} 次检查失败，触发故障转移`,
      );

      await this.triggerFailover(providerId);
    }
  }

  private async handleRecovery(providerId: string): Promise<void> {
    this.logger.log(`供应商 ${providerId} 恢复健康`);

    const modelProviders = await this.modelProviderRepository.find({
      where: { providerId },
    });

    for (const mp of modelProviders) {
      await this.cacheService.invalidateFailoverStatus(mp.modelId);
    }
  }

  private async triggerFailover(failedProviderId: string): Promise<void> {
    const modelProviders = await this.modelProviderRepository.find({
      where: { providerId: failedProviderId, isPrimary: true },
    });

    for (const mp of modelProviders) {
      const backupProvider = await this.modelProviderRepository.findOne({
        where: {
          modelId: mp.modelId,
          status: "enabled",
        },
        order: { priority: "ASC" },
      });

      if (backupProvider && backupProvider.providerId !== failedProviderId) {
        const provider = await this.providerRepository.findOne({
          where: { providerId: backupProvider.providerId },
        });

        if (provider && provider.healthStatus === "healthy") {
          await this.cacheService.setFailoverStatus(
            mp.modelId,
            backupProvider.providerId,
          );

          this.logger.log(
            `模型 ${mp.modelId} 从 ${failedProviderId} 故障转移到 ${backupProvider.providerId}`,
          );
        }
      }
    }
  }

  private async getRecentFailureCount(providerId: string): Promise<number> {
    const recentLogs = await this.healthLogRepository.find({
      where: { providerId },
      order: { checkedAt: "DESC" },
      take: this.CONFIG.FAILURE_THRESHOLD,
    });

    return recentLogs.filter((log) => log.checkStatus === "unhealthy").length;
  }

  private async getHealthStats(providerId: string): Promise<{
    lastCheckAt: Date | null;
    avgResponseTimeMs: number;
    recentFailureCount: number;
  }> {
    const recentLogs = await this.healthLogRepository.find({
      where: { providerId },
      order: { checkedAt: "DESC" },
      take: 10,
    });

    const lastCheckAt = recentLogs.length > 0 ? recentLogs[0].checkedAt : null;

    const healthyLogs = recentLogs.filter(
      (log) => log.checkStatus === "healthy" && log.responseTimeMs,
    );
    const avgResponseTimeMs =
      healthyLogs.length > 0
        ? Math.round(
            healthyLogs.reduce(
              (sum, log) => sum + (log.responseTimeMs || 0),
              0,
            ) / healthyLogs.length,
          )
        : 0;

    let recentFailureCount = 0;
    for (const log of recentLogs) {
      if (log.checkStatus === "unhealthy") {
        recentFailureCount++;
      } else {
        break;
      }
    }

    return {
      lastCheckAt,
      avgResponseTimeMs,
      recentFailureCount,
    };
  }

  /**
   * 定时健康检查任务 - 每 60 秒执行一次
   */
  @Cron("0 * * * * *")
  async scheduledHealthCheck(): Promise<void> {
    const providers = await this.providerRepository.find({
      where: { status: "enabled" },
    });

    if (providers.length === 0) {
      return;
    }

    this.logger.debug(`开始定时健康检查，共 ${providers.length} 个供应商`);

    for (const provider of providers) {
      try {
        await this.checkProvider(provider.providerId);
        // 获取并缓存远程模型列表
        await this.cacheRemoteModels(provider.providerId);
      } catch (error) {
        this.logger.error(
          `健康检查失败 - 供应商 ${provider.providerId}: ${error instanceof Error ? error.message : "未知错误"}`,
        );
      }
    }

    // 清理 7 天前的日志
    try {
      const deletedCount = await this.cleanupOldLogs();
      if (deletedCount > 0) {
        this.logger.debug(`清理了 ${deletedCount} 条过期健康检查日志`);
      }
    } catch (error) {
      this.logger.error(
        `清理健康检查日志失败：${error instanceof Error ? error.message : "未知错误"}`,
      );
    }
  }

  /**
   * 定时清理模型调用日志 - 每天凌晨 3 点执行
   */
  @Cron("0 0 3 * * *")
  async scheduledCleanupModelCallLogs(): Promise<void> {
    try {
      this.logger.log("开始清理模型调用日志...");
      const deletedCount = await this.modelCallLogService.cleanupOldLogs(30);
      this.logger.log(
        `清理了 ${deletedCount} 条过期模型调用日志（保留 30 天）`,
      );
    } catch (error) {
      this.logger.error(
        `清理模型调用日志失败：${error instanceof Error ? error.message : "未知错误"}`,
      );
    }
  }

  /**
   * 定时检查 API Key 过期 - 每天早上 9 点执行
   */
  @Cron("0 0 9 * * *")
  async scheduledApiKeyExpiryCheck(): Promise<void> {
    try {
      this.logger.log("开始检查 API Key 过期情况...");
      await this.apiKeyAlertService.sendApiKeyAlerts();
    } catch (error) {
      this.logger.error(
        `API Key 过期检查失败：${error instanceof Error ? error.message : "未知错误"}`,
      );
    }
  }

  /**
   * 缓存供应商的远程模型列表
   */
  private async cacheRemoteModels(providerId: string): Promise<void> {
    try {
      const models = await this.modelService.fetchRemoteModels(providerId);
      if (models && models.length > 0) {
        await this.cacheService.setProviderRemoteModels(providerId, models);
        this.logger.debug(
          `已缓存供应商 ${providerId} 的 ${models.length} 个模型`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `缓存远程模型列表失败 - 供应商 ${providerId}: ${error instanceof Error ? error.message : "未知错误"}`,
      );
    }
  }
}
