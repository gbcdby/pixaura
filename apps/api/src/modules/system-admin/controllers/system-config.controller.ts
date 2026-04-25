import { Controller, Get, Put, Body, UseGuards, Req } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { FastifyRequest } from "fastify";
import { SystemConfigService } from "../services/system-config.service";
import { OperationLogService } from "../services/operation-log.service";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../user/guards/roles.guard";
import { Roles } from "../../user/decorators/roles.decorator";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import {
  UpdateFileUploadConfigSchema,
  UpdateRateLimitConfigSchema,
  UpdateTTSApiConfigSchema,
  UpdateLipSyncApiConfigSchema,
  type UpdateFileUploadConfigDto,
  type UpdateRateLimitConfigDto,
  type UpdateTTSApiConfigDto,
  type UpdateLipSyncApiConfigDto,
} from "@pixaura/shared-types";

@ApiTags("admin-config")
@Controller("admin/config")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("super_admin")
@ApiBearerAuth()
export class SystemConfigController {
  constructor(
    private readonly systemConfigService: SystemConfigService,
    private readonly operationLogService: OperationLogService,
  ) {}

  /**
   * 获取全局配置
   */
  @Get()
  @ApiOperation({ summary: "获取全局配置" })
  async getFullConfig() {
    const config = await this.systemConfigService.getFullConfig();

    return {
      code: 0,
      data: config,
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 更新文件上传配置
   */
  @Put("file-upload")
  @ApiOperation({ summary: "更新文件上传配置" })
  async updateFileUploadConfig(
    @Body(new ZodValidationPipe(UpdateFileUploadConfigSchema))
    dto: UpdateFileUploadConfigDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    const adminId = req.user.sub;
    const config = await this.systemConfigService.updateFileUploadConfig(
      dto,
      adminId,
    );

    // 记录操作日志
    await this.operationLogService.createLog({
      adminId,
      operationType: "config_update",
      targetType: "config",
      targetId: undefined,
      details: {
        configType: "file_upload",
        changes: dto,
      },
      ipAddress: req.ip || "unknown",
      userAgent: req.headers["user-agent"] as string | undefined,
    });

    return {
      code: 0,
      data: config.fileUpload,
      msg: "文件上传配置更新成功",
      timestamp: Date.now(),
    };
  }

  /**
   * 更新限流配置
   */
  @Put("rate-limit")
  @ApiOperation({ summary: "更新限流配置" })
  async updateRateLimitConfig(
    @Body(new ZodValidationPipe(UpdateRateLimitConfigSchema))
    dto: UpdateRateLimitConfigDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    const adminId = req.user.sub;
    const config = await this.systemConfigService.updateRateLimitConfig(
      dto,
      adminId,
    );

    // 记录操作日志
    await this.operationLogService.createLog({
      adminId,
      operationType: "config_update",
      targetType: "config",
      targetId: undefined,
      details: {
        configType: "rate_limit",
        changes: dto,
      },
      ipAddress: req.ip || "unknown",
      userAgent: req.headers["user-agent"] as string | undefined,
    });

    return {
      code: 0,
      data: config.rateLimit,
      msg: "限流配置更新成功",
      timestamp: Date.now(),
    };
  }

  // ==================== TTS API 配置 ====================

  /**
   * 获取 TTS API 配置
   */
  @Get("tts")
  @ApiOperation({ summary: "获取 TTS API 配置" })
  async getTTSApiConfig() {
    const config = await this.systemConfigService.getTTSApiConfig();

    // 返回时隐藏部分 API Key（只显示后4位）
    const maskedConfig = config
      ? {
          ...config,
          apiKey: config.apiKey ? `****${config.apiKey.slice(-4)}` : "",
          hasApiKey: !!config.apiKey,
        }
      : null;

    return {
      code: 0,
      data: maskedConfig,
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 更新 TTS API 配置
   */
  @Put("tts")
  @ApiOperation({ summary: "更新 TTS API 配置" })
  async updateTTSApiConfig(
    @Body(new ZodValidationPipe(UpdateTTSApiConfigSchema))
    dto: UpdateTTSApiConfigDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    const adminId = req.user.sub;
    const config = await this.systemConfigService.updateTTSApiConfig(
      dto,
      adminId,
    );

    // 记录操作日志
    await this.operationLogService.createLog({
      adminId,
      operationType: "config_update",
      targetType: "config",
      targetId: undefined,
      details: {
        configType: "tts_api",
        changes: { enabled: config.enabled, baseUrl: config.baseUrl },
      },
      ipAddress: req.ip || "unknown",
      userAgent: req.headers["user-agent"] as string | undefined,
    });

    // 返回时隐藏部分 API Key
    return {
      code: 0,
      data: {
        ...config,
        apiKey: `****${config.apiKey.slice(-4)}`,
      },
      msg: "TTS API 配置更新成功",
      timestamp: Date.now(),
    };
  }

  // ==================== 对口型 API 配置 ====================

  /**
   * 获取对口型 API 配置
   */
  @Get("lip-sync")
  @ApiOperation({ summary: "获取对口型 API 配置" })
  async getLipSyncApiConfig() {
    const config = await this.systemConfigService.getLipSyncApiConfig();

    // 返回时隐藏密钥（只显示后4位）
    const maskedConfig = config
      ? {
          ...config,
          accessKey: config.accessKey
            ? `****${config.accessKey.slice(-4)}`
            : "",
          secretKey: config.secretKey ? "****" : "", // 完全隐藏 SecretKey
          hasCredentials: config.hasCredentials,
        }
      : null;

    return {
      code: 0,
      data: maskedConfig,
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 更新对口型 API 配置
   */
  @Put("lip-sync")
  @ApiOperation({ summary: "更新对口型 API 配置" })
  async updateLipSyncApiConfig(
    @Body(new ZodValidationPipe(UpdateLipSyncApiConfigSchema))
    dto: UpdateLipSyncApiConfigDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    const adminId = req.user.sub;
    const config = await this.systemConfigService.updateLipSyncApiConfig(
      dto,
      adminId,
    );

    // 记录操作日志
    await this.operationLogService.createLog({
      adminId,
      operationType: "config_update",
      targetType: "config",
      targetId: undefined,
      details: {
        configType: "lip_sync_api",
        changes: {
          enabled: config.enabled,
          baseUrl: config.baseUrl,
          subjectDetection: config.subjectDetection,
          lipSync: config.lipSync,
        },
      },
      ipAddress: req.ip || "unknown",
      userAgent: req.headers["user-agent"] as string | undefined,
    });

    // 返回时隐藏密钥
    return {
      code: 0,
      data: {
        ...config,
        accessKey: config.accessKey ? `****${config.accessKey.slice(-4)}` : "",
        secretKey: config.secretKey ? "****" : "",
      },
      msg: "对口型 API 配置更新成功",
      timestamp: Date.now(),
    };
  }
}
