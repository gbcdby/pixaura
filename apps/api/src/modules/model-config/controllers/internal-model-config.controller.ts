import { Controller, Post, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { InternalApiKeyGuard } from "../guards/internal-api-key.guard";
import { ProviderService } from "../services/provider.service";
import { ModelService } from "../services/model.service";
import { HealthCheckService } from "../services/health-check.service";
import type {
  InternalCallConfigDto,
  UniformGenerateRequest,
  UniformGenerateResponse,
} from "@pixaura/shared-types";
import { ErrorCodes } from "@pixaura/shared-types";

@ApiTags("模型配置-内部接口")
@Controller("/internal/model-config")
@UseGuards(InternalApiKeyGuard)
export class InternalModelConfigController {
  constructor(
    private providerService: ProviderService,
    private modelService: ModelService,
    private healthCheckService: HealthCheckService,
  ) {}

  @Post("call-config")
  @ApiOperation({ summary: "获取模型调用配置（内部接口）" })
  async getCallConfig(@Body() dto: { modelId: string }): Promise<{
    code: number;
    data: InternalCallConfigDto | null;
    msg: string;
  }> {
    const model = await this.modelService.findByIdWithProvider(dto.modelId);
    if (!model || model.status !== "enabled") {
      return {
        code: ErrorCodes.MODEL_NOT_FOUND.code,
        data: null,
        msg: "模型不存在或已禁用",
      };
    }

    if (!model.provider) {
      return {
        code: ErrorCodes.PROVIDER_NOT_FOUND.code,
        data: null,
        msg: "模型未配置供应商",
      };
    }

    const providerWithKey =
      await this.providerService.getProviderWithDecryptedKey(
        model.provider.providerId,
      );

    const costConfig = (model.costConfig || {}) as {
      billingMode?: string;
      pricePer1kTokens?: number;
      pricePerCall?: number;
    };

    const config: InternalCallConfigDto = {
      modelId: model.modelId,
      modelName: model.modelName,
      provider: {
        providerId: providerWithKey.providerId,
        baseUrl: providerWithKey.baseUrl,
        apiKey: providerWithKey.apiKey || "",
      },
      category: model.category as InternalCallConfigDto["category"],
      defaultParams: model.defaultParams,
      customParams: model.customParams,
    };

    if (costConfig.billingMode === "per_token") {
      config.pricePer1kTokens = costConfig.pricePer1kTokens;
    } else {
      config.pricePerCall = costConfig.pricePerCall;
    }

    return {
      code: ErrorCodes.SUCCESS.code,
      data: config,
      msg: "success",
    };
  }

  @Post("generate")
  @ApiOperation({ summary: "执行模型调用（内部接口）" })
  async generate(
    @Body() request: UniformGenerateRequest,
  ): Promise<UniformGenerateResponse> {
    return {
      success: false,
      requestId: request.requestId,
      error: {
        code: ErrorCodes.NOT_IMPLEMENTED.code,
        msg: "模型调用功能待实现",
      },
    };
  }

  @Post("failover-status")
  @ApiOperation({ summary: "获取故障转移状态（内部接口）" })
  async getFailoverStatus(@Body() dto: { modelId: string }): Promise<{
    code: number;
    data: { failoverTo: string | null };
    msg: string;
  }> {
    const failoverProvider = await this.healthCheckService.getFailoverProvider(
      dto.modelId,
    );

    return {
      code: ErrorCodes.SUCCESS.code,
      data: { failoverTo: failoverProvider },
      msg: "success",
    };
  }
}
