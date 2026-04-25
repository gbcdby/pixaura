import {
  Controller,
  Post,
  Body,
  UseGuards,
  Headers,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { QuotaDeductService } from "../services/quota-deduct.service";
import {
  CheckQuotaSchema,
  DeductQuotaSchema,
  type CheckQuotaDto,
  type DeductQuotaDto,
} from "@pixaura/shared-types";

/**
 * 计费模块 - 内部服务接口
 * 供其他模块（图片生成、视频生成等）调用
 * 需要内部服务密钥认证
 */
@ApiTags("internal-billing")
@Controller("internal/billing")
export class InternalBillingController {
  constructor(private readonly quotaDeductService: QuotaDeductService) {}

  /**
   * 检查额度
   * 供内部模块在执行业务前检查用户是否有足够额度
   */
  @Post("check-quota")
  @ApiOperation({
    summary: "检查用户额度（内部接口）",
    description: "供其他模块调用，检查用户是否有足够额度",
  })
  async checkQuota(
    @Body(new ZodValidationPipe(CheckQuotaSchema))
    dto: CheckQuotaDto,
    @Headers("x-internal-key") internalKey: string,
  ) {
    // 验证内部服务密钥
    this.validateInternalKey(internalKey);

    const result = await this.quotaDeductService.checkQuota(dto);

    return {
      code: 0,
      data: result,
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 扣减额度
   * 供内部模块在业务执行完成后扣减用户额度
   */
  @Post("deduct-quota")
  @ApiOperation({
    summary: "扣减用户额度（内部接口）",
    description: "供其他模块调用，扣减用户额度",
  })
  async deductQuota(
    @Body(new ZodValidationPipe(DeductQuotaSchema))
    dto: DeductQuotaDto,
    @Headers("x-internal-key") internalKey: string,
  ) {
    // 验证内部服务密钥
    this.validateInternalKey(internalKey);

    const result = await this.quotaDeductService.deductQuota(dto);

    return {
      code: 0,
      data: result,
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 验证内部服务密钥
   * 实际项目中应该从配置中心或环境变量获取密钥
   */
  private validateInternalKey(key: string): void {
    // 从环境变量获取内部服务密钥
    const validKey = process.env.INTERNAL_SERVICE_KEY;

    if (!validKey) {
      // 如果没有配置密钥，在开发环境允许通过
      if (process.env.NODE_ENV === "development") {
        return;
      }
      throw new UnauthorizedException("内部服务密钥未配置");
    }

    if (key !== validKey) {
      throw new UnauthorizedException("无效的内部服务密钥");
    }
  }
}
