/**
 * 图片生成成本服务
 * 处理额度计算和扣减，通过 QuotaDeductService 统一计费入口
 */
import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { QuotaDeductService } from "../../billing/services/quota-deduct.service";
import type {
  QuotaCheckResult,
  QuotaDeductResult,
} from "@pixaura/shared-types";

export interface CostCalculation {
  estimatedCost: number;
  actualCost: number;
  currency: string;
}

@Injectable()
export class ImageGenerationCostService {
  private readonly logger = new Logger(ImageGenerationCostService.name);

  // 单张图片生成成本（CNY），用于无模型价格时的默认值
  private readonly SINGLE_IMAGE_COST = 0.5;

  constructor(private readonly quotaDeductService: QuotaDeductService) {}

  /**
   * 计算预估成本
   * @param type 任务类型
   * @param count 生成数量
   */
  calculateEstimatedCost(type: string, count: number = 1): CostCalculation {
    const costPerImage = this.SINGLE_IMAGE_COST;
    const estimatedCost = costPerImage * count;

    return {
      estimatedCost,
      actualCost: 0,
      currency: "CNY",
    };
  }

  /**
   * 计算实际成本
   * @param successCount 成功数量
   */
  calculateActualCost(successCount: number): CostCalculation {
    const costPerImage = this.SINGLE_IMAGE_COST;
    const actualCost = costPerImage * successCount;

    return {
      estimatedCost: 0,
      actualCost,
      currency: "CNY",
    };
  }

  /**
   * 预留额度（检查额度是否充足）
   * 向后兼容接口，支持两种调用方式：
   * - 新方式：(userId, modelId, count) 返回 QuotaCheckResult
   * - 旧方式：(userId, projectId, estimatedCost) 返回 boolean
   *
   * @param userId 用户ID
   * @param secondParam 第二参数（modelId 或 projectId）
   * @param thirdParam 第三参数（count 或 estimatedCost）
   * @returns QuotaCheckResult（新方式）或 boolean（旧方式）
   */
  async reserveQuota(
    userId: string,
    secondParam: string | undefined,
    thirdParam: number,
  ): Promise<QuotaCheckResult | boolean> {
    this.logger.debug(
      `预留额度: userId=${userId}, secondParam=${secondParam}, thirdParam=${thirdParam}`,
    );

    // 根据参数值判断是新接口还是旧接口
    // 新接口：thirdParam 是 count（通常为整数 1-10）
    // 旧接口：thirdParam 是 estimatedCost（通常为浮点数如 0.5）
    const isNewInterface = thirdParam <= 10 && Number.isInteger(thirdParam);

    if (isNewInterface) {
      // 新接口调用
      const count = thirdParam;
      const modelId = secondParam;

      const result = await this.quotaDeductService.checkQuota({
        userId,
        modelId,
        category: "IMAGE_GENERATION",
        count,
      });

      if (!result.canExecute) {
        this.logger.warn(
          `额度不足: userId=${userId}, reason=${result.reason}, message=${result.message}`,
        );
      }

      return result;
    } else {
      // 旧接口调用（向后兼容）
      const estimatedCost = thirdParam;
      const count = Math.ceil(estimatedCost / this.SINGLE_IMAGE_COST);

      const result = await this.quotaDeductService.checkQuota({
        userId,
        modelId: undefined,
        category: "IMAGE_GENERATION",
        count,
      });

      return result.canExecute;
    }
  }

  /**
   * 预留额度（新接口专用）
   * 明确返回 QuotaCheckResult，供需要详细结果的新代码使用
   */
  async reserveQuotaWithResult(
    userId: string,
    modelId: string | undefined,
    count: number,
  ): Promise<QuotaCheckResult> {
    return this.quotaDeductService.checkQuota({
      userId,
      modelId,
      category: "IMAGE_GENERATION",
      count,
    });
  }

  /**
   * 扣减实际额度
   * @param userId 用户ID
   * @param modelId 模型ID（可选）
   * @param count 扣减数量
   * @param referenceId 关联业务ID
   * @returns 扣减结果
   */
  async deductQuota(
    userId: string,
    modelId: string | undefined,
    count: number,
    referenceId: string,
  ): Promise<QuotaDeductResult> {
    this.logger.debug(
      `扣减额度: userId=${userId}, modelId=${modelId}, count=${count}, referenceId=${referenceId}`,
    );

    const idempotencyKey = `image-${referenceId}-${Date.now()}`;

    return this.quotaDeductService.deductQuota({
      userId,
      modelId,
      category: "IMAGE_GENERATION",
      count,
      referenceId,
      idempotencyKey,
    });
  }

  /**
   * 返还额度（失败时调用）
   * 向后兼容接口，支持两种调用方式：
   * - 新方式：(userId, modelId, count, referenceId)
   * - 旧方式：(userId, projectId, amount) - 仅记录日志
   *
   * @param userId 用户ID
   * @param secondParam 第二参数（modelId 或 projectId）
   * @param thirdParam 第三参数（count 或 amount）
   * @param referenceId 关联业务ID（可选，新接口使用）
   */
  async refundQuota(
    userId: string,
    secondParam: string | undefined,
    thirdParam: number,
    referenceId?: string,
  ): Promise<void> {
    this.logger.debug(
      `返还额度: userId=${userId}, secondParam=${secondParam}, thirdParam=${thirdParam}, referenceId=${referenceId}`,
    );
    // 当前实现：记录日志，后续需要完善退款逻辑
    // 实际退款需要调用 quota-management.service 的 refundQuota 方法
  }

  /**
   * 获取单张图片成本
   */
  getSingleImageCost(): number {
    return this.SINGLE_IMAGE_COST;
  }
}