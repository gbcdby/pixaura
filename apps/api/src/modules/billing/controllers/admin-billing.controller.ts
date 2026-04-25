import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../user/guards/roles.guard";
import { Roles } from "../../user/decorators/roles.decorator";
import { QuotaManagementService } from "../services/quota-management.service";
import { BalanceService } from "../services/balance.service";
import { SubscriptionService } from "../services/subscription.service";
import { PricingConfigService } from "../services/pricing-config.service";
import { UserService } from "../../user/user.service";
import {
  RechargePromotion,
  BonusType,
} from "../entities/recharge-promotion.entity";
import { hasPermission, Permissions } from "@pixaura/shared-types";
import { SubscriptionTier } from "../entities/subscription.entity";
import {
  QuotaTargetType,
  QuotaCycleType,
} from "../entities/quota-config.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  UpdateQuotaConfigSchema,
  AdjustBalanceSchema,
  GrantSubscriptionSchema,
  CreatePromotionSchema,
  CreateCategoryQuotaConfigSchema,
  UpdatePricingConfigSchema,
  type UpdateQuotaConfigDto,
  type AdjustBalanceDto,
  type GrantSubscriptionDto,
  type CreatePromotionDto,
  type CreateCategoryQuotaConfigDto,
  type UpdatePricingConfigDto,
} from "@pixaura/shared-types";

/**
 * 计费模块 - 管理端接口
 * 提供额度配置管理、余额调整、订阅管理等功能
 * 仅限管理员访问
 */
@ApiTags("admin-billing")
@Controller("admin/billing")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
@ApiBearerAuth()
export class AdminBillingController {
  constructor(
    private readonly quotaManagementService: QuotaManagementService,
    private readonly balanceService: BalanceService,
    private readonly subscriptionService: SubscriptionService,
    private readonly pricingConfigService: PricingConfigService,
    private readonly userService: UserService,
    @InjectRepository(RechargePromotion)
    private readonly promotionRepo: Repository<RechargePromotion>,
  ) {}

  /**
   * 获取额度配置列表
   */
  @Get("quota-config")
  @ApiOperation({ summary: "获取额度配置列表" })
  @ApiQuery({ name: "tier", required: false })
  async getQuotaConfigs(@Query("tier") tier?: string) {
    const configs = tier
      ? await this.quotaManagementService.getAllQuotaConfigs(tier as any)
      : await this.quotaManagementService.getAllQuotaConfigs();

    return {
      code: 0,
      data: configs,
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 更新额度配置
   */
  @Put("quota-config/:configId")
  @ApiOperation({ summary: "更新额度配置" })
  async updateQuotaConfig(
    @Param("configId") configId: string,
    @Body(new ZodValidationPipe(UpdateQuotaConfigSchema))
    dto: UpdateQuotaConfigDto,
  ) {
    const config = await this.quotaManagementService.updateQuotaConfig(
      configId,
      dto,
    );

    return {
      code: 0,
      data: config,
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 创建类别额度配置
   */
  @Post("quota-config/category")
  @ApiOperation({ summary: "创建类别额度配置" })
  async createCategoryQuotaConfig(
    @Body(new ZodValidationPipe(CreateCategoryQuotaConfigSchema))
    dto: CreateCategoryQuotaConfigDto,
  ) {
    // 创建小周期配置
    const smallConfig = await this.quotaManagementService.createQuotaConfig({
      tier: dto.tier as SubscriptionTier,
      cycleType: QuotaCycleType.SMALL,
      targetType: QuotaTargetType.CATEGORY,
      targetId: dto.targetId,
      quotaValue: dto.smallCycleQuota,
      isActive: dto.isActive,
    });

    // 创建大周期配置
    const largeConfig = await this.quotaManagementService.createQuotaConfig({
      tier: dto.tier as SubscriptionTier,
      cycleType: QuotaCycleType.LARGE,
      targetType: QuotaTargetType.CATEGORY,
      targetId: dto.targetId,
      quotaValue: dto.largeCycleQuota,
      isActive: dto.isActive,
    });

    return {
      code: 0,
      data: {
        smallCycle: smallConfig,
        largeCycle: largeConfig,
      },
      msg: "类别额度配置创建成功",
      timestamp: Date.now(),
    };
  }

  /**
   * 刷新所有用户额度
   */
  @Post("quota/refresh-all")
  @ApiOperation({ summary: "刷新所有用户额度（紧急修复用）" })
  @Roles("super_admin")
  async refreshAllQuotas() {
    // TODO: 实现全量刷新逻辑
    return {
      code: 0,
      data: { message: "额度刷新任务已启动" },
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 获取订阅列表
   */
  @Get("subscriptions")
  @ApiOperation({ summary: "获取订阅列表" })
  @ApiQuery({ name: "userId", required: false })
  @ApiQuery({ name: "username", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  async getSubscriptions(
    @Query("userId") userId?: string,
    @Query("username") username?: string,
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const result = await this.subscriptionService.getSubscriptions({
      userId,
      username,
      status: status as any,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });

    return {
      code: 0,
      data: result,
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 调整用户余额（超级管理员）
   */
  @Post("balance/adjust")
  @ApiOperation({ summary: "调整用户余额" })
  @Roles("super_admin")
  async adjustBalance(
    @Body(new ZodValidationPipe(AdjustBalanceSchema))
    dto: AdjustBalanceDto,
    @Req() req: any,
  ) {
    // 从 JWT 获取操作人 ID
    const operatorId = req.user.sub;

    // 如果提供了用户名，查找用户ID
    let targetUserId = dto.userId;
    if (dto.username && !dto.userId) {
      const user = await this.userService.findByUsername(dto.username);
      if (!user) {
        return {
          code: 404,
          data: null,
          msg: `用户 ${dto.username} 不存在`,
          timestamp: Date.now(),
        };
      }
      targetUserId = user.id;
    }

    if (!targetUserId) {
      return {
        code: 400,
        data: null,
        msg: "用户ID或用户名必须提供",
        timestamp: Date.now(),
      };
    }

    // 检查目标用户是否为管理员
    const targetUser = await this.userService.findById(targetUserId as string);
    if (
      targetUser &&
      hasPermission(targetUser.perms, Permissions.ADMIN_PANEL)
    ) {
      return {
        code: 403,
        data: null,
        msg: "管理员用户无需调整余额，管理员默认拥有无限额度",
        timestamp: Date.now(),
      };
    }

    const result = await this.balanceService.adjustBalance(
      targetUserId as string,
      dto.amount,
      dto.reason,
      dto.description,
      operatorId,
    );

    return {
      code: 0,
      data: {
        userId: targetUserId,
        beforeBalance: result.beforeBalance,
        afterBalance: result.afterBalance,
        adjustAmount: dto.amount,
        reason: dto.reason,
      },
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 手动赋予订阅（超级管理员）
   */
  @Post("subscription/grant")
  @ApiOperation({ summary: "手动赋予用户订阅" })
  @Roles("super_admin")
  async grantSubscription(
    @Body(new ZodValidationPipe(GrantSubscriptionSchema))
    dto: GrantSubscriptionDto,
    @Req() req: any,
  ) {
    // 从 JWT 获取操作人 ID
    const grantedBy = req.user.sub;

    // 如果提供了用户名，查找用户ID
    let targetUserId = dto.userId;
    if (dto.username && !dto.userId) {
      const user = await this.userService.findByUsername(dto.username);
      if (!user) {
        return {
          code: 404,
          data: null,
          msg: `用户 ${dto.username} 不存在`,
          timestamp: Date.now(),
        };
      }
      targetUserId = user.id;
    }

    if (!targetUserId) {
      return {
        code: 400,
        data: null,
        msg: "用户ID或用户名必须提供",
        timestamp: Date.now(),
      };
    }

    // 检查目标用户是否为管理员
    const targetUser = await this.userService.findById(targetUserId as string);
    if (
      targetUser &&
      hasPermission(targetUser.perms, Permissions.ADMIN_PANEL)
    ) {
      return {
        code: 403,
        data: null,
        msg: "管理员用户无需赋予订阅，管理员默认拥有无限期专业订阅",
        timestamp: Date.now(),
      };
    }

    // 构建新的 DTO 传递给服务层
    const serviceDto = {
      ...dto,
      userId: targetUserId as string,
    };

    const subscription = await this.subscriptionService.grantSubscription(
      serviceDto as GrantSubscriptionDto,
      grantedBy,
    );

    return {
      code: 0,
      data: {
        subscription: {
          id: subscription.id,
          userId: subscription.userId,
          tier: subscription.tier,
          period: subscription.period,
          status: subscription.status,
          startedAt: subscription.startedAt,
          expiresAt: subscription.expiresAt,
        },
        message: `成功为用户赋予 ${subscription.tier} 订阅，有效期至 ${subscription.expiresAt}`,
      },
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 获取充值活动列表
   */
  @Get("promotions")
  @ApiOperation({ summary: "获取充值活动列表" })
  async getPromotions() {
    const promotions = await this.balanceService.getRechargePromotions();

    return {
      code: 0,
      data: promotions,
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 创建充值活动
   */
  @Post("promotions")
  @ApiOperation({ summary: "创建充值活动" })
  async createPromotion(
    @Body(new ZodValidationPipe(CreatePromotionSchema))
    dto: CreatePromotionDto,
  ) {
    const promotion = await this.balanceService.createRechargePromotion({
      name: dto.name,
      description: dto.description,
      minAmount: dto.minAmount,
      bonusType: dto.bonusType as BonusType,
      bonusValue: dto.bonusValue,
      maxBonus: dto.maxBonus,
      startAt: dto.startAt ? new Date(dto.startAt) : null,
      endAt: dto.endAt ? new Date(dto.endAt) : null,
      isActive: dto.isActive ?? true,
    });

    return {
      code: 0,
      data: promotion,
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 更新充值活动
   */
  @Put("promotions/:promotionId")
  @ApiOperation({ summary: "更新充值活动" })
  async updatePromotion(
    @Param("promotionId") promotionId: string,
    @Body() dto: Partial<CreatePromotionDto>,
  ) {
    const updateData: Partial<RechargePromotion> = {
      ...dto,
      bonusType: dto.bonusType as BonusType | undefined,
      startAt: dto.startAt ? new Date(dto.startAt) : undefined,
      endAt: dto.endAt ? new Date(dto.endAt) : undefined,
    };

    const promotion = await this.balanceService.updateRechargePromotion(
      promotionId,
      updateData,
    );

    return {
      code: 0,
      data: promotion,
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 获取余额流水（管理员查看）
   */
  @Get("balance/records")
  @ApiOperation({ summary: "获取用户余额流水" })
  @ApiQuery({ name: "userId", required: true })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  async getBalanceRecords(
    @Query("userId") userId: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    if (!userId) {
      return {
        code: 400,
        data: null,
        msg: "userId 不能为空",
        timestamp: Date.now(),
      };
    }

    const records = await this.balanceService.getBalanceRecords(
      userId,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );

    return {
      code: 0,
      data: records,
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 查询所有充值记录（管理员）
   */
  @Get("transactions/recharge")
  @ApiOperation({ summary: "查询所有充值记录" })
  @ApiQuery({ name: "userId", required: false })
  @ApiQuery({ name: "username", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "startDate", required: false })
  @ApiQuery({ name: "endDate", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  async getAllRechargeRecords(
    @Query("userId") userId?: string,
    @Query("username") username?: string,
    @Query("status") status?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const result = await this.balanceService.getAllRechargeOrders({
      userId,
      username,
      status: status as any,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });

    return {
      code: 0,
      data: result,
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 查询所有消费记录（管理员）
   */
  @Get("transactions/consumption")
  @ApiOperation({ summary: "查询所有消费记录" })
  @ApiQuery({ name: "userId", required: false })
  @ApiQuery({ name: "username", required: false })
  @ApiQuery({ name: "type", required: false })
  @ApiQuery({ name: "startDate", required: false })
  @ApiQuery({ name: "endDate", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  async getAllConsumptionRecords(
    @Query("userId") userId?: string,
    @Query("username") username?: string,
    @Query("type") type?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const result = await this.balanceService.getAllBalanceRecords({
      userId,
      username,
      type: type as any,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });

    return {
      code: 0,
      data: result,
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 获取当前价格配置
   */
  @Get("pricing-config")
  @ApiOperation({ summary: "获取当前价格配置" })
  async getPricingConfig(@Req() req: any) {
    const pricings = await this.pricingConfigService.getAllPricing();
    return {
      code: 0,
      data: { pricings },
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 更新价格配置
   */
  @Put("pricing-config")
  @ApiOperation({ summary: "更新价格配置" })
  async updatePricingConfig(
    @Body(new ZodValidationPipe(UpdatePricingConfigSchema))
    dto: UpdatePricingConfigDto,
    @Req() req: any,
  ) {
    const operatorId = req.user.sub; // 从 JWT 中获取用户 ID

    const result = await this.pricingConfigService.updatePrice(
      dto.tier,
      dto.period,
      dto.price,
      operatorId,
      dto.reason,
    );

    return {
      code: 0,
      data: result,
      msg: "价格更新成功",
      timestamp: Date.now(),
    };
  }

  /**
   * 获取价格变更历史
   */
  @Get("pricing-history")
  @ApiOperation({ summary: "获取价格变更历史" })
  @ApiQuery({ name: "tier", required: false })
  @ApiQuery({ name: "period", required: false })
  @ApiQuery({ name: "operator_id", required: false })
  @ApiQuery({ name: "start_date", required: false })
  @ApiQuery({ name: "end_date", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "page_size", required: false, type: Number })
  async getPricingHistory(
    @Query("tier") tier?: string,
    @Query("period") period?: string,
    @Query("operator_id") operatorId?: string,
    @Query("start_date") startDate?: string,
    @Query("end_date") endDate?: string,
    @Query("page") page?: string,
    @Query("page_size") pageSize?: string,
  ) {
    const result = await this.pricingConfigService.getHistory({
      tier,
      period,
      operator_id: operatorId,
      start_date: startDate,
      end_date: endDate,
      page: page ? parseInt(page, 10) : 1,
      page_size: pageSize ? parseInt(pageSize, 10) : 20,
    });

    return {
      code: 0,
      data: result,
      msg: "success",
      timestamp: Date.now(),
    };
  }
}
