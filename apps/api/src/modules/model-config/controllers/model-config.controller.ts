import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { ModelService } from "../services/model.service";
import { UserService } from "../../user/user.service";
import { SystemConfigService } from "../../system-admin/services/system-config.service";
import type {
  ModelByCategoryDto,
  UserModelDetailDto,
  FunctionCategory,
} from "@pixaura/shared-types";

@ApiTags("模型配置")
@Controller("/model-config")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ModelConfigController {
  constructor(
    private modelService: ModelService,
    private userService: UserService,
    private systemConfigService: SystemConfigService,
  ) {}

  @Get("models")
  @ApiOperation({ summary: "获取可用模型列表" })
  async getAvailableModels(
    @Query("category") category?: FunctionCategory,

    @Query("user") user?: any,
  ): Promise<{ categories: ModelByCategoryDto[] }> {
    const userDetail = await this.userService.findById(user?.userId);
    const userTier = userDetail?.subscriptionTier || "free";

    const categories = await this.modelService.getAvailableModels(
      userTier,
      category,
    );

    return { categories };
  }

  @Get("models/:modelId")
  @ApiOperation({ summary: "获取模型详情" })
  async getModelDetail(
    @Param("modelId") modelId: string,

    @Query("user") user?: any,
  ): Promise<UserModelDetailDto> {
    const userDetail = await this.userService.findById(user?.userId);
    const userTier = userDetail?.subscriptionTier || "free";

    const hasPermission = await this.modelService.checkUserPermission(
      modelId,
      userTier,
    );
    if (!hasPermission) {
      throw new ForbiddenException("您没有权限使用该模型");
    }

    const model = await this.modelService.getUserModelDetail(modelId);
    if (!model) {
      throw new NotFoundException("模型不存在或已禁用");
    }

    return model;
  }

  /**
   * 获取系统配置中的模型价格（TTS、LipSync 等）
   * 这些模型的价格配置在 system_config 表中，不在 ai_models 表
   */
  @Get("system-prices")
  @ApiOperation({ summary: "获取系统配置中的模型价格" })
  async getSystemPrices(): Promise<{
    tts: {
      flash: { pricePerChar: number };
      instructFlash: { pricePerChar: number };
    };
    lipSync: {
      pricePerSecond: number;
      subjectDetection: { pricePerRequest: number };
    };
  }> {
    // 获取 TTS 配置
    const ttsConfig = await this.systemConfigService.getTTSApiConfig();
    // 获取对口型配置
    const lipSyncConfig = await this.systemConfigService.getLipSyncApiConfig();

    return {
      tts: {
        flash: {
          pricePerChar: ttsConfig?.models?.flash?.pricePerChar ?? 0.00005,
        },
        instructFlash: {
          pricePerChar: ttsConfig?.models?.instructFlash?.pricePerChar ?? 0.00008,
        },
      },
      lipSync: {
        pricePerSecond: lipSyncConfig?.lipSync?.pricePerSecond ?? 0.2,
        subjectDetection: {
          pricePerRequest: lipSyncConfig?.subjectDetection?.pricePerRequest ?? 0.05,
        },
      },
    };
  }
}
