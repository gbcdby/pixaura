import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { AdminAuthGuard } from "../guards/admin-auth.guard";
import { ProviderService } from "../services/provider.service";
import { ModelService } from "../services/model.service";
import { HealthCheckService } from "../services/health-check.service";
import { ModelCallLogService } from "../services/model-call-log.service";
import type {
  CreateProviderDto,
  UpdateProviderDto,
  CreateModelDto,
  UpdateModelDto,
  ProviderListItemDto,
  AdminModelListItemDto,
  ProviderHealthStatusDto,
  HealthCheckResultDto,
  FunctionCategory,
  CallStatsDto,
  ProviderCallStatsDto,
} from "@pixaura/shared-types";

@ApiTags("模型配置-管理端")
@Controller("/admin/model-config")
@UseGuards(JwtAuthGuard, AdminAuthGuard)
@ApiBearerAuth()
export class AdminModelConfigController {
  constructor(
    private providerService: ProviderService,
    private modelService: ModelService,
    private healthCheckService: HealthCheckService,
    private modelCallLogService: ModelCallLogService,
  ) {}

  @Get("providers")
  @ApiOperation({ summary: "获取供应商列表" })
  async getProviders(
    @Query("status") status?: string,
  ): Promise<{ providers: ProviderListItemDto[] }> {
    const providers = await this.providerService.findAll(status);
    return { providers };
  }

  @Post("providers")
  @ApiOperation({ summary: "创建供应商" })
  async createProvider(
    @Body() dto: CreateProviderDto,
  ): Promise<{ providerId: string }> {
    const provider = await this.providerService.create(dto);
    return { providerId: provider.providerId };
  }

  @Put("providers/:providerId")
  @ApiOperation({ summary: "更新供应商" })
  async updateProvider(
    @Param("providerId") providerId: string,
    @Body() dto: UpdateProviderDto,
  ): Promise<void> {
    await this.providerService.update(providerId, dto);
  }

  @Delete("providers/:providerId")
  @ApiOperation({ summary: "删除供应商" })
  async deleteProvider(@Param("providerId") providerId: string): Promise<void> {
    await this.providerService.delete(providerId);
  }

  @Get("models")
  @ApiOperation({ summary: "获取模型列表" })
  async getModels(
    @Query("providerId") providerId?: string,
    @Query("category") category?: FunctionCategory,
    @Query("status") status?: string,
  ): Promise<{ models: AdminModelListItemDto[] }> {
    const models = await this.modelService.findAllForAdmin(
      providerId,
      category,
      status,
    );
    return { models };
  }

  @Post("models")
  @ApiOperation({ summary: "创建模型" })
  async createModel(@Body() dto: CreateModelDto): Promise<{ modelId: string }> {
    const model = await this.modelService.create(dto);
    return { modelId: model.modelId };
  }

  @Put("models/:modelId")
  @ApiOperation({ summary: "更新模型" })
  async updateModel(
    @Param("modelId") modelId: string,
    @Body() dto: UpdateModelDto,
  ): Promise<void> {
    await this.modelService.update(modelId, dto);
  }

  @Delete("models/:modelId")
  @ApiOperation({ summary: "删除模型" })
  async deleteModel(@Param("modelId") modelId: string): Promise<void> {
    await this.modelService.delete(modelId);
  }

  @Post("models/:modelId/providers")
  @ApiOperation({ summary: "设置模型供应商" })
  async setModelProvider(
    @Param("modelId") modelId: string,
    @Body()
    dto: {
      providerId: string;
      isPrimary: boolean;
      priority: number;
      providerModelId?: string;
    },
  ): Promise<void> {
    await this.modelService.setModelProvider(
      modelId,
      dto.providerId,
      dto.isPrimary,
      dto.priority,
      dto.providerModelId,
    );
  }

  @Get("health")
  @ApiOperation({ summary: "获取供应商健康状态" })
  async getHealthStatus(): Promise<{ status: ProviderHealthStatusDto[] }> {
    const status = await this.healthCheckService.getAllHealthStatus();
    return { status };
  }

  @Post("health-check")
  @ApiOperation({ summary: "手动触发健康检查" })
  async manualHealthCheck(
    @Body() dto?: { providerId?: string },
  ): Promise<ProviderHealthStatusDto[] | HealthCheckResultDto> {
    // 如果指定了 providerId，只检查该供应商；否则检查所有供应商
    if (dto?.providerId) {
      return this.healthCheckService.checkProvider(dto.providerId);
    }
    // 检查所有供应商
    return this.healthCheckService.getAllHealthStatus();
  }

  @Get("stats/models")
  @ApiOperation({ summary: "获取模型调用统计" })
  async getModelCallStats(
    @Query("hours") hours?: string,
  ): Promise<{ stats: CallStatsDto[] }> {
    const hoursNum = hours ? parseInt(hours, 10) : 24;
    const stats =
      await this.modelCallLogService.getAllModelsCallStats(hoursNum);
    return { stats };
  }

  @Get("stats/models/:modelId")
  @ApiOperation({ summary: "获取指定模型调用统计" })
  async getSingleModelCallStats(
    @Param("modelId") modelId: string,
    @Query("hours") hours?: string,
  ): Promise<CallStatsDto> {
    const hoursNum = hours ? parseInt(hours, 10) : 24;
    return this.modelCallLogService.getModelCallStats(modelId, hoursNum);
  }

  @Get("stats/providers")
  @ApiOperation({ summary: "获取供应商调用统计" })
  async getProviderCallStats(
    @Query("hours") hours?: string,
  ): Promise<{ stats: ProviderCallStatsDto[] }> {
    const hoursNum = hours ? parseInt(hours, 10) : 24;
    const stats =
      await this.modelCallLogService.getAllProvidersCallStats(hoursNum);
    return { stats };
  }

  @Get("stats/providers/:providerId")
  @ApiOperation({ summary: "获取指定供应商调用统计" })
  async getSingleProviderCallStats(
    @Param("providerId") providerId: string,
    @Query("hours") hours?: string,
  ): Promise<ProviderCallStatsDto> {
    const hoursNum = hours ? parseInt(hours, 10) : 24;
    return this.modelCallLogService.getProviderCallStats(providerId, hoursNum);
  }

  @Get("providers/:providerId/remote-models")
  @ApiOperation({ summary: "从供应商获取模型列表" })
  async getRemoteModels(@Param("providerId") providerId: string): Promise<{
    models: Array<{
      id: string;
      name: string;
      description?: string;
    }>;
  }> {
    const models = await this.modelService.fetchRemoteModels(providerId);
    return { models };
  }
}
