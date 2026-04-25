import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThan, MoreThan, Not, IsNull } from "typeorm";
import { Provider } from "../entities";

export interface ApiKeyAlertInfo {
  providerId: string;
  providerName: string;
  expiresAt: Date;
  daysUntilExpiry: number;
  alertLevel: "info" | "warning" | "critical";
}

@Injectable()
export class ApiKeyAlertService {
  private readonly logger = new Logger(ApiKeyAlertService.name);

  // 告警阈值（天数）
  private readonly ALERT_THRESHOLDS = {
    CRITICAL: 7, // 7天内过期 - 紧急
    WARNING: 30, // 30天内过期 - 警告
  };

  constructor(
    @InjectRepository(Provider)
    private providerRepository: Repository<Provider>,
  ) {}

  /**
   * 检查所有供应商的 API Key 过期情况
   */
  async checkAllApiKeyExpiry(): Promise<ApiKeyAlertInfo[]> {
    const now = new Date();
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(now.getDate() + 30);

    // 查找所有有过期时间且未过期的供应商
    const providers = await this.providerRepository.find({
      where: {
        apiKeyExpiresAt: Not(IsNull()),
        status: "enabled",
      },
    });

    const alerts: ApiKeyAlertInfo[] = [];

    for (const provider of providers) {
      if (!provider.apiKeyExpiresAt) continue;

      const daysUntilExpiry = Math.ceil(
        (provider.apiKeyExpiresAt.getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24),
      );

      // 已过期
      if (daysUntilExpiry < 0) {
        alerts.push({
          providerId: provider.providerId,
          providerName: provider.providerName,
          expiresAt: provider.apiKeyExpiresAt,
          daysUntilExpiry,
          alertLevel: "critical",
        });
      }
      // 7天内过期
      else if (daysUntilExpiry <= this.ALERT_THRESHOLDS.CRITICAL) {
        alerts.push({
          providerId: provider.providerId,
          providerName: provider.providerName,
          expiresAt: provider.apiKeyExpiresAt,
          daysUntilExpiry,
          alertLevel: "critical",
        });
      }
      // 30天内过期
      else if (daysUntilExpiry <= this.ALERT_THRESHOLDS.WARNING) {
        alerts.push({
          providerId: provider.providerId,
          providerName: provider.providerName,
          expiresAt: provider.apiKeyExpiresAt,
          daysUntilExpiry,
          alertLevel: "warning",
        });
      }
    }

    return alerts.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  }

  /**
   * 发送 API Key 过期告警
   */
  async sendApiKeyAlerts(): Promise<void> {
    const alerts = await this.checkAllApiKeyExpiry();

    for (const alert of alerts) {
      await this.notifyAlert(alert);
    }

    if (alerts.length === 0) {
      this.logger.log("所有供应商 API Key 状态正常");
    }
  }

  /**
   * 通知告警（当前只记录日志，后续可扩展为邮件/站内信）
   */
  private async notifyAlert(alert: ApiKeyAlertInfo): Promise<void> {
    const message = `API Key 即将过期 - ${alert.providerName}(${alert.providerId}): ${alert.daysUntilExpiry < 0 ? "已过期" : `还有 ${alert.daysUntilExpiry} 天过期`}`;

    switch (alert.alertLevel) {
      case "critical":
        if (alert.daysUntilExpiry < 0) {
          this.logger.error(`[API Key 已过期] ${message}`);
        } else {
          this.logger.warn(`[API Key 紧急] ${message}`);
        }
        // TODO: 发送邮件通知管理员
        // TODO: 发送站内信
        break;
      case "warning":
        this.logger.warn(`[API Key 警告] ${message}`);
        // TODO: 发送邮件通知管理员
        break;
    }
  }

  /**
   * 获取单个供应商的 API Key 过期信息
   */
  async getProviderApiKeyExpiry(
    providerId: string,
  ): Promise<ApiKeyAlertInfo | null> {
    const provider = await this.providerRepository.findOne({
      where: { providerId },
    });

    if (!provider || !provider.apiKeyExpiresAt) {
      return null;
    }

    const now = new Date();
    const daysUntilExpiry = Math.ceil(
      (provider.apiKeyExpiresAt.getTime() - now.getTime()) /
        (1000 * 60 * 60 * 24),
    );

    let alertLevel: "info" | "warning" | "critical" = "info";
    if (
      daysUntilExpiry < 0 ||
      daysUntilExpiry <= this.ALERT_THRESHOLDS.CRITICAL
    ) {
      alertLevel = "critical";
    } else if (daysUntilExpiry <= this.ALERT_THRESHOLDS.WARNING) {
      alertLevel = "warning";
    }

    return {
      providerId: provider.providerId,
      providerName: provider.providerName,
      expiresAt: provider.apiKeyExpiresAt,
      daysUntilExpiry,
      alertLevel,
    };
  }
}
