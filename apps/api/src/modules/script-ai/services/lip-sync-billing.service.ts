import { Injectable, Logger } from "@nestjs/common";
import { SystemConfigService } from "../../system-admin/services/system-config.service";
import { QuotaDeductService } from "../../billing/services/quota-deduct.service";
import type { CheckQuotaDto, DeductQuotaDto } from "@pixaura/shared-types";

/**
 * 对口型计费服务
 * 实现双轨制计费：订阅额度优先，余额兜底
 * 复用 QuotaDeductService 的计费逻辑
 *
 * Note: LIP_SYNC 类别在 billing.ts 的 FunctionCategorySchema 中定义，
 * 用于计费系统，但不属于模型配置系统
 *
 * 计费单位转换：1 单位 = 0.01 元（count = Math.ceil(cost * 100)）
 */
@Injectable()
export class LipSyncBillingService {
  private readonly logger = new Logger(LipSyncBillingService.name);

  // LIP_SYNC 计费类别
  private readonly BILLING_CATEGORY = "LIP_SYNC";

  constructor(
    private readonly systemConfigService: SystemConfigService,
    private readonly quotaDeductService: QuotaDeductService,
  ) {}

  /**
   * 检查额度是否充足（主体检测）
   * 双轨制：先检查订阅额度，不足则检查余额
   */
  async checkBalanceForDetection(userId: string): Promise<{
    canExecute: boolean;
    estimatedCost: number;
    deductFrom: "subscription" | "balance" | null;
    remainingBalance: number;
  }> {
    const config = await this.systemConfigService.getLipSyncApiConfig();
    const pricePerRequest = config?.subjectDetection?.pricePerRequest || 0.05;

    // 将金额转换为计费单位（1 单位 = 0.01 元）
    const count = Math.ceil(pricePerRequest * 100);

    const checkResult = await this.quotaDeductService.checkQuota({
      userId,
      category: this.BILLING_CATEGORY,
      count,
    } as CheckQuotaDto);

    return {
      canExecute: checkResult.canExecute,
      estimatedCost: pricePerRequest,
      deductFrom: checkResult.deductFrom,
      remainingBalance: checkResult.remainingBalance,
    };
  }

  /**
   * 扣减额度（主体检测）
   * 自动从订阅额度或余额扣减
   */
  async deductForDetection(
    userId: string,
    referenceId: string,
  ): Promise<{ deductedFrom: string | null; amount: number }> {
    const config = await this.systemConfigService.getLipSyncApiConfig();
    const pricePerRequest = config?.subjectDetection?.pricePerRequest || 0.05;

    // 将金额转换为计费单位（1 单位 = 0.01 元）
    const count = Math.ceil(pricePerRequest * 100);

    try {
      const result = await this.quotaDeductService.deductQuota({
        userId,
        category: this.BILLING_CATEGORY,
        count,
        referenceId,
        idempotencyKey: `detection-${referenceId}-${Date.now()}`,
      } as DeductQuotaDto);

      this.logger.log(
        `主体检测扣费成功: userId=${userId}, price=${pricePerRequest}, deductedFrom=${result.deductedFrom}`,
      );

      return {
        deductedFrom: result.deductedFrom,
        amount: result.amount,
      };
    } catch (error) {
      this.logger.error(`主体检测扣费失败: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * 检查额度是否充足（对口型视频）
   * 双轨制：先检查订阅额度，不足则检查余额
   */
  async checkBalanceForLipSync(
    userId: string,
    estimatedDuration: number,
  ): Promise<{
    canExecute: boolean;
    estimatedCost: number;
    deductFrom: "subscription" | "balance" | null;
    remainingBalance: number;
  }> {
    const config = await this.systemConfigService.getLipSyncApiConfig();
    const pricePerSecond = config?.lipSync?.pricePerSecond || 1.5;
    const cost = estimatedDuration * pricePerSecond;

    // 将金额转换为计费单位（1 单位 = 0.01 元）
    const count = Math.ceil(cost * 100);

    const checkResult = await this.quotaDeductService.checkQuota({
      userId,
      category: this.BILLING_CATEGORY,
      count,
    } as CheckQuotaDto);

    return {
      canExecute: checkResult.canExecute,
      estimatedCost: cost,
      deductFrom: checkResult.deductFrom,
      remainingBalance: checkResult.remainingBalance,
    };
  }

  /**
   * 扣减额度（对口型视频）
   * @param actualDuration 实际视频时长（秒）
   */
  async deductForLipSync(
    userId: string,
    actualDuration: number,
    referenceId: string,
  ): Promise<{ deductedFrom: string | null; amount: number }> {
    const config = await this.systemConfigService.getLipSyncApiConfig();
    const pricePerSecond = config?.lipSync?.pricePerSecond || 1.5;
    const cost = actualDuration * pricePerSecond;

    // 将金额转换为计费单位（1 单位 = 0.01 元）
    const count = Math.ceil(cost * 100);

    try {
      const result = await this.quotaDeductService.deductQuota({
        userId,
        category: this.BILLING_CATEGORY,
        count,
        referenceId,
        idempotencyKey: `lipsync-${referenceId}-${Date.now()}`,
      } as DeductQuotaDto);

      this.logger.log(
        `对口型视频扣费成功: userId=${userId}, duration=${actualDuration}s, cost=${cost}, deductedFrom=${result.deductedFrom}`,
      );

      return {
        deductedFrom: result.deductedFrom,
        amount: result.amount,
      };
    } catch (error) {
      this.logger.error(`对口型视频扣费失败: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * 获取主体检测价格
   */
  async getDetectionPrice(): Promise<number> {
    const config = await this.systemConfigService.getLipSyncApiConfig();
    return config?.subjectDetection?.pricePerRequest || 0.05;
  }

  /**
   * 获取对口型视频单价（元/秒）
   */
  async getLipSyncPricePerSecond(): Promise<number> {
    const config = await this.systemConfigService.getLipSyncApiConfig();
    return config?.lipSync?.pricePerSecond || 0.2;
  }
}
