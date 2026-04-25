import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between } from "typeorm";
import { ModelCallLog } from "../entities";

export interface CreateCallLogDto {
  modelId: string;
  providerId: string;
  requestId: string;
  status: "success" | "failed";
  responseTimeMs?: number;
  errorCode?: string;
  errorMessage?: string;
  category?: string;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface CallStatsDto {
  modelId: string;
  modelName?: string;
  totalCalls: number;
  successCalls: number;
  failedCalls: number;
  successRate: number;
  avgResponseTimeMs: number;
  period: string;
}

export interface ProviderCallStatsDto {
  providerId: string;
  providerName?: string;
  totalCalls: number;
  successCalls: number;
  failedCalls: number;
  successRate: number;
  avgResponseTimeMs: number;
  period: string;
}

@Injectable()
export class ModelCallLogService {
  constructor(
    @InjectRepository(ModelCallLog)
    private modelCallLogRepository: Repository<ModelCallLog>,
  ) {}

  /**
   * 记录模型调用日志
   */
  async createLog(data: CreateCallLogDto): Promise<ModelCallLog> {
    const log = this.modelCallLogRepository.create({
      modelId: data.modelId,
      providerId: data.providerId,
      requestId: data.requestId,
      status: data.status,
      responseTimeMs: data.responseTimeMs ?? null,
      errorCode: data.errorCode ?? null,
      errorMessage: data.errorMessage ?? null,
      category: data.category ?? null,
      tokenUsage: data.tokenUsage ?? null,
    });

    return this.modelCallLogRepository.save(log);
  }

  /**
   * 获取模型调用成功率统计
   */
  async getModelCallStats(
    modelId: string,
    hours: number = 24,
  ): Promise<CallStatsDto> {
    const startTime = new Date();
    startTime.setHours(startTime.getHours() - hours);

    const logs = await this.modelCallLogRepository.find({
      where: {
        modelId,
        createdAt: Between(startTime, new Date()),
      },
    });

    const totalCalls = logs.length;
    const successCalls = logs.filter((log) => log.status === "success").length;
    const failedCalls = totalCalls - successCalls;
    const successRate = totalCalls > 0 ? (successCalls / totalCalls) * 100 : 0;

    const successLogs = logs.filter(
      (log) => log.status === "success" && log.responseTimeMs,
    );
    const avgResponseTimeMs =
      successLogs.length > 0
        ? Math.round(
            successLogs.reduce(
              (sum, log) => sum + (log.responseTimeMs || 0),
              0,
            ) / successLogs.length,
          )
        : 0;

    return {
      modelId,
      totalCalls,
      successCalls,
      failedCalls,
      successRate: Math.round(successRate * 100) / 100,
      avgResponseTimeMs,
      period: `${hours}h`,
    };
  }

  /**
   * 获取所有模型的调用统计
   */
  async getAllModelsCallStats(hours: number = 24): Promise<CallStatsDto[]> {
    const startTime = new Date();
    startTime.setHours(startTime.getHours() - hours);

    const logs = await this.modelCallLogRepository.find({
      where: {
        createdAt: Between(startTime, new Date()),
      },
    });

    const modelStats = new Map<string, ModelCallLog[]>();
    for (const log of logs) {
      if (!modelStats.has(log.modelId)) {
        modelStats.set(log.modelId, []);
      }
      modelStats.get(log.modelId)!.push(log);
    }

    const results: CallStatsDto[] = [];
    for (const [modelId, modelLogs] of modelStats) {
      const totalCalls = modelLogs.length;
      const successCalls = modelLogs.filter(
        (log) => log.status === "success",
      ).length;
      const failedCalls = totalCalls - successCalls;
      const successRate =
        totalCalls > 0 ? (successCalls / totalCalls) * 100 : 0;

      const successLogs = modelLogs.filter(
        (log) => log.status === "success" && log.responseTimeMs,
      );
      const avgResponseTimeMs =
        successLogs.length > 0
          ? Math.round(
              successLogs.reduce(
                (sum, log) => sum + (log.responseTimeMs || 0),
                0,
              ) / successLogs.length,
            )
          : 0;

      results.push({
        modelId,
        totalCalls,
        successCalls,
        failedCalls,
        successRate: Math.round(successRate * 100) / 100,
        avgResponseTimeMs,
        period: `${hours}h`,
      });
    }

    return results.sort((a, b) => b.totalCalls - a.totalCalls);
  }

  /**
   * 获取供应商调用成功率统计
   */
  async getProviderCallStats(
    providerId: string,
    hours: number = 24,
  ): Promise<ProviderCallStatsDto> {
    const startTime = new Date();
    startTime.setHours(startTime.getHours() - hours);

    const logs = await this.modelCallLogRepository.find({
      where: {
        providerId,
        createdAt: Between(startTime, new Date()),
      },
    });

    const totalCalls = logs.length;
    const successCalls = logs.filter((log) => log.status === "success").length;
    const failedCalls = totalCalls - successCalls;
    const successRate = totalCalls > 0 ? (successCalls / totalCalls) * 100 : 0;

    const successLogs = logs.filter(
      (log) => log.status === "success" && log.responseTimeMs,
    );
    const avgResponseTimeMs =
      successLogs.length > 0
        ? Math.round(
            successLogs.reduce(
              (sum, log) => sum + (log.responseTimeMs || 0),
              0,
            ) / successLogs.length,
          )
        : 0;

    return {
      providerId,
      totalCalls,
      successCalls,
      failedCalls,
      successRate: Math.round(successRate * 100) / 100,
      avgResponseTimeMs,
      period: `${hours}h`,
    };
  }

  /**
   * 获取所有供应商的调用统计
   */
  async getAllProvidersCallStats(
    hours: number = 24,
  ): Promise<ProviderCallStatsDto[]> {
    const startTime = new Date();
    startTime.setHours(startTime.getHours() - hours);

    const logs = await this.modelCallLogRepository.find({
      where: {
        createdAt: Between(startTime, new Date()),
      },
    });

    const providerStats = new Map<string, ModelCallLog[]>();
    for (const log of logs) {
      if (!providerStats.has(log.providerId)) {
        providerStats.set(log.providerId, []);
      }
      providerStats.get(log.providerId)!.push(log);
    }

    const results: ProviderCallStatsDto[] = [];
    for (const [providerId, providerLogs] of providerStats) {
      const totalCalls = providerLogs.length;
      const successCalls = providerLogs.filter(
        (log) => log.status === "success",
      ).length;
      const failedCalls = totalCalls - successCalls;
      const successRate =
        totalCalls > 0 ? (successCalls / totalCalls) * 100 : 0;

      const successLogs = providerLogs.filter(
        (log) => log.status === "success" && log.responseTimeMs,
      );
      const avgResponseTimeMs =
        successLogs.length > 0
          ? Math.round(
              successLogs.reduce(
                (sum, log) => sum + (log.responseTimeMs || 0),
                0,
              ) / successLogs.length,
            )
          : 0;

      results.push({
        providerId,
        totalCalls,
        successCalls,
        failedCalls,
        successRate: Math.round(successRate * 100) / 100,
        avgResponseTimeMs,
        period: `${hours}h`,
      });
    }

    return results.sort((a, b) => b.totalCalls - a.totalCalls);
  }

  /**
   * 清理过期日志（保留指定天数）
   */
  async cleanupOldLogs(retentionDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.modelCallLogRepository.delete({
      createdAt: Between(new Date(0), cutoffDate),
    });

    return result.affected || 0;
  }
}
