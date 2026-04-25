import {
  Controller,
  Get,
  Post,
  Delete,
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
import { QuotaManagementService } from "../services/quota-management.service";
import { BalanceService } from "../services/balance.service";
import { SubscriptionService } from "../services/subscription.service";
import { QuotaDeductService } from "../services/quota-deduct.service";
import { ConsumptionService } from "../services/consumption.service";
import { RedlockService } from "../../../common/services/redlock.service";
import { AiModel } from "../../model-config/entities/ai-model.entity";
import { User } from "../../user/entities/user.entity";
import { TextGenQuotaRecord } from "../entities/text-gen-quota-record.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { v4 as uuidv4 } from "uuid";
import { PaymentMethod } from "../entities/recharge-order.entity";
import { isAdmin } from "@pixaura/shared-types";
import {
  CreateRechargeOrderSchema,
  CreateSubscriptionSchema,
  PaymentCallbackSchema,
  type CreateRechargeOrderDto,
  type CreateSubscriptionDto,
  type PaymentCallbackDto,
} from "@pixaura/shared-types";

/**
 * 计费模块 - 用户端接口
 * 提供额度查询、充值、订阅管理等功能
 */
@ApiTags("billing")
@Controller("billing")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BillingController {
  constructor(
    private readonly quotaManagementService: QuotaManagementService,
    private readonly balanceService: BalanceService,
    private readonly subscriptionService: SubscriptionService,
    private readonly quotaDeductService: QuotaDeductService,
    private readonly consumptionService: ConsumptionService,
    private readonly redlockService: RedlockService,
    @InjectRepository(AiModel)
    private readonly aiModelRepo: Repository<AiModel>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(TextGenQuotaRecord)
    private readonly textGenQuotaRecordRepo: Repository<TextGenQuotaRecord>,
  ) {}

  /**
   * 获取用户当前额度
   */
  @Get("quota")
  @ApiOperation({ summary: "获取用户当前额度" })
  async getQuota(@Req() req: any) {
    const userId = req.user.sub;

    // 检查是否为管理员
    const user = await this.userRepo.findOne({ where: { id: userId } });
    const isAdminUser = user ? isAdmin(user.perms) : false;

    const quotaStatus = await this.quotaManagementService.getUserQuota(userId);

    // 检查是否需要刷新周期
    await this.quotaManagementService.checkAndRefreshQuota(userId);

    const canUseSubscription = quotaStatus.models.some(
      (m) => m.canUseSubscription,
    );

    return {
      code: 0,
      data: {
        isAdmin: isAdminUser,
        subscription: quotaStatus.subscription
          ? {
              tier: quotaStatus.subscription.tier,
              period: quotaStatus.subscription.period,
              status: quotaStatus.subscription.status,
              startedAt: quotaStatus.subscription.startedAt,
              expiresAt: quotaStatus.subscription.expiresAt,
            }
          : null,
        quotaStatus: {
          canUseSubscription,
          message: canUseSubscription
            ? "订阅额度可用"
            : "订阅额度已耗尽，将使用余额扣费",
        },
        quotas: {
          models: quotaStatus.models,
          categories: quotaStatus.categories,
        },
        balance: {
          amount: await this.balanceService.getBalance(userId),
          currency: "CNY",
        },
      },
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 获取预扣额度（按类别分组）
   */
  @Get("quota/pending")
  @ApiOperation({ summary: "获取预扣额度" })
  async getPendingQuota(@Req() req: any) {
    const userId = req.user.sub;

    // 查询用户所有 pending 状态的预扣记录
    const pendingRecords = await this.textGenQuotaRecordRepo.find({
      where: { userId, status: "pending" },
    });

    // 按类别分组聚合
    const categoryMap: Record<
      string,
      {
        category: string;
        categoryName: string;
        pendingTokens: number;
        pendingCount: number;
      }
    > = {};

    for (const record of pendingRecords) {
      const category = (record.metadata?.taskType as string) || "TEXT_GENERATION";
      // 将 taskType 映射为类别名称
      const categoryNames: Record<string, string> = {
        generate: "剧本生成",
        parse: "剧本解析",
        edit: "剧本编辑",
        stream: "流式生成",
        TEXT_GENERATION: "文本生成",
      };

      if (!categoryMap[category]) {
        categoryMap[category] = {
          category,
          categoryName: categoryNames[category] || category,
          pendingTokens: 0,
          pendingCount: 0,
        };
      }

      categoryMap[category].pendingTokens += record.estimatedTokens;
      categoryMap[category].pendingCount += 1;
    }

    return {
      code: 0,
      data: {
        categories: Object.values(categoryMap),
        totalCount: pendingRecords.length,
        totalTokens: pendingRecords.reduce(
          (sum, r) => sum + r.estimatedTokens,
          0,
        ),
      },
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 获取额度使用历史
   */
  @Get("quota/history")
  @ApiOperation({ summary: "获取额度使用历史" })
  @ApiQuery({ name: "startDate", required: false })
  @ApiQuery({ name: "endDate", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  async getQuotaHistory(
    @Req() req: any,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const userId = req.user.sub;

    const history = await this.quotaManagementService.getQuotaUsageHistory(
      userId,
      {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        page: page ? parseInt(page, 10) : 1,
        pageSize: pageSize ? parseInt(pageSize, 10) : 20,
      },
    );

    return {
      code: 0,
      data: history,
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 创建充值订单
   */
  @Post("recharge")
  @ApiOperation({ summary: "创建充值订单" })
  async createRechargeOrder(
    @Req() req: any,
    @Body(new ZodValidationPipe(CreateRechargeOrderSchema))
    dto: CreateRechargeOrderDto,
  ) {
    const userId = req.user.sub;

    const order = await this.balanceService.createRechargeOrder(
      userId,
      dto.amount,
      dto.paymentMethod as PaymentMethod,
    );

    return {
      code: 0,
      data: {
        orderId: order.id,
        amount: order.amount,
        credits: order.credits,
        paymentStatus: order.paymentStatus,
        // TODO: 集成支付 SDK 获取支付参数
        paymentParams: {},
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30分钟过期
      },
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 查询充值订单
   */
  @Get("recharge/:orderId")
  @ApiOperation({ summary: "查询充值订单" })
  async getRechargeOrder(@Req() req: any, @Param("orderId") orderId: string) {
    const userId = req.user.sub;
    const order = await this.balanceService.getRechargeOrder(orderId);

    // 检查订单是否属于当前用户
    if (order.userId !== userId) {
      return {
        code: 2001,
        data: null,
        msg: "订单不存在",
        timestamp: Date.now(),
      };
    }

    return {
      code: 0,
      data: {
        orderId: order.id,
        amount: order.amount,
        credits: order.credits,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        transactionNo: order.transactionNo,
        paidAt: order.paidAt,
        createdAt: order.createdAt,
      },
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 获取当前订阅
   */
  @Get("subscription")
  @ApiOperation({ summary: "获取当前订阅" })
  async getSubscription(@Req() req: any) {
    const userId = req.user.sub;

    const subscription =
      await this.subscriptionService.getCurrentSubscription(userId);
    const availableTiers = await this.subscriptionService.getAvailableTiers();

    return {
      code: 0,
      data: {
        subscription: subscription
          ? {
              id: subscription.id,
              tier: subscription.tier,
              period: subscription.period,
              status: subscription.status,
              startedAt: subscription.startedAt,
              expiresAt: subscription.expiresAt,
              autoRenew: subscription.autoRenew,
            }
          : null,
        availableTiers,
      },
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 创建/升级订阅
   */
  @Post("subscription")
  @ApiOperation({ summary: "创建或升级订阅" })
  async createSubscription(
    @Req() req: any,
    @Body(new ZodValidationPipe(CreateSubscriptionSchema))
    dto: CreateSubscriptionDto,
  ) {
    const userId = req.user.sub;

    const result = await this.subscriptionService.createSubscription(
      userId,
      dto,
    );

    return {
      code: 0,
      data: {
        subscription: {
          id: result.subscription.id,
          tier: result.subscription.tier,
          period: result.subscription.period,
          status: result.subscription.status,
          startedAt: result.subscription.startedAt,
          expiresAt: result.subscription.expiresAt,
        },
        amount: result.amount,
        isUpgrade: result.isUpgrade,
        // TODO: 集成支付 SDK 获取支付参数
        paymentParams: {},
      },
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 取消订阅（关闭自动续费）
   */
  @Delete("subscription")
  @ApiOperation({ summary: "取消订阅自动续费" })
  async cancelSubscription(@Req() req: any) {
    const userId = req.user.sub;

    const subscription =
      await this.subscriptionService.cancelSubscription(userId);

    return {
      code: 0,
      data: {
        message: "订阅将在到期后自动取消",
        subscription: {
          id: subscription.id,
          status: subscription.status,
          expiresAt: subscription.expiresAt,
          autoRenew: subscription.autoRenew,
        },
      },
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 支付回调接口
   * 接收第三方支付平台的支付结果通知
   */
  @Post("webhook/:provider")
  @ApiOperation({ summary: "支付回调接口" })
  async handleWebhook(
    @Param("provider") provider: string,
    @Body(new ZodValidationPipe(PaymentCallbackSchema))
    dto: PaymentCallbackDto,
  ) {
    // 验证支付平台
    if (!["alipay", "wechat"].includes(provider)) {
      return {
        code: 2003,
        data: null,
        msg: "支付方式不支持",
        timestamp: Date.now(),
      };
    }

    // 处理支付回调
    const success = await this.balanceService.handlePaymentCallback(
      dto.orderId,
      dto.transactionNo,
    );

    if (!success) {
      return {
        code: 2009,
        data: null,
        msg: "支付回调处理失败",
        timestamp: Date.now(),
      };
    }

    return {
      code: 0,
      data: null,
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 获取充值活动列表（用户端）
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
   * 获取余额和流水
   */
  @Get("balance")
  @ApiOperation({ summary: "获取余额和流水" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  async getBalance(
    @Req() req: any,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const userId = req.user.sub;

    const [balance, records] = await Promise.all([
      this.balanceService.getBalance(userId),
      this.balanceService.getBalanceRecords(
        userId,
        page ? parseInt(page, 10) : 1,
        pageSize ? parseInt(pageSize, 10) : 20,
      ),
    ]);

    return {
      code: 0,
      data: {
        balance: {
          amount: balance,
          currency: "CNY",
        },
        records,
      },
      msg: "success",
      timestamp: Date.now(),
    };
  }

  // ==================== v1.2 新增：并发额度扣减接口 ====================

  /**
   * 额度预扣减（增强版，支持分布式锁）
   */
  @Post("pre-deduct")
  @ApiOperation({ summary: "额度预扣减" })
  async preDeduct(
    @Req() req: any,
    @Body()
    body: {
      taskId: string;
      taskType: "video-gen" | "image-gen" | "audio-gen";
      estimatedCost: number;
      timeout?: number;
    },
  ) {
    const userId = req.user.sub;
    const lockKey = `billing:user:${userId}:lock`;
    const timeout = body.timeout ?? 5;
    const ttl = timeout * 1000;

    // 尝试获取分布式锁
    const lockResult = await this.redlockService.tryWithLock(
      lockKey,
      ttl,
      async () => {
        // 检查额度
        const checkResult = await this.quotaDeductService.checkQuota({
          userId,
          modelId: body.taskType,
          category: this.getCategoryFromTaskType(body.taskType),
          count: 1,
        });

        if (!checkResult.canExecute) {
          return {
            success: false,
            error: {
              code: "INSUFFICIENT_BALANCE",
              message: "额度不足",
              required: body.estimatedCost,
              available: checkResult.remainingBalance,
            },
          };
        }

        // 生成锁ID
        const lockId = uuidv4();

        return {
          success: true,
          data: {
            lockId,
            deductedAmount: body.estimatedCost,
            remainingBalance: checkResult.remainingBalance,
            expiresAt: new Date(Date.now() + ttl).toISOString(),
          },
        };
      },
    );

    if (lockResult === null) {
      return {
        success: false,
        error: {
          code: "LOCK_ACQUIRE_FAILED",
          message: "系统繁忙，请稍后重试",
          retryAfter: 1,
        },
      };
    }

    return lockResult;
  }

  /**
   * 确认扣减
   */
  @Post("confirm-deduct")
  @ApiOperation({ summary: "确认额度扣减" })
  async confirmDeduct(
    @Req() req: any,
    @Body()
    body: {
      taskId: string;
      lockId: string;
      actualCost: number;
    },
  ) {
    // TODO: 实现确认扣减逻辑
    return {
      success: true,
      data: {
        confirmedAmount: body.actualCost,
        refundedAmount: 0,
        remainingBalance: 0,
      },
    };
  }

  /**
   * 额度返还
   */
  @Post("refund")
  @ApiOperation({ summary: "额度返还" })
  async refund(
    @Req() req: any,
    @Body()
    body: {
      taskId: string;
      lockId: string;
      refundAmount: number;
      reason: "task_cancelled" | "task_failed" | "other";
    },
  ) {
    // TODO: 实现额度返还逻辑
    return {
      success: true,
      data: {
        refundedAmount: body.refundAmount,
        remainingBalance: 0,
      },
    };
  }

  /**
   * 任务类型转换为功能类别
   */
  private getCategoryFromTaskType(
    taskType: "video-gen" | "image-gen" | "audio-gen",
  ): "VIDEO_GENERATION" | "IMAGE_GENERATION" | "AUDIO_GENERATION" {
    const mapping: Record<string, "VIDEO_GENERATION" | "IMAGE_GENERATION" | "AUDIO_GENERATION"> = {
      "video-gen": "VIDEO_GENERATION",
      "image-gen": "IMAGE_GENERATION",
      "audio-gen": "AUDIO_GENERATION",
    };
    return mapping[taskType];
  }

  // ==================== 新增：模型定价查询 ====================

  /**
   * 获取模型定价信息
   * 用于前端模型选择器展示价格
   */
  @Get("models/:modelId/pricing")
  @ApiOperation({ summary: "获取模型定价信息" })
  async getModelPricing(@Req() req: any, @Param("modelId") modelId: string) {
    const userId = req.user.sub;

    const model = await this.aiModelRepo.findOne({
      where: { modelId },
    });

    if (!model) {
      return {
        code: 2001,
        data: null,
        msg: "模型不存在",
        timestamp: Date.now(),
      };
    }

    const costConfig = (model.costConfig || {}) as Record<string, unknown>;
    const billingMode = (costConfig.billingMode as string) || "per_call";

    // 获取当前用户的额度状态
    const quotaStatus = await this.quotaManagementService.getUserQuota(userId);
    const modelQuota = quotaStatus.models.find(
      (m) => m.modelId === modelId,
    );

    // 计算价格
    let pricePerCall = 0;
    let pricePerToken = 0;
    let pricePerSecond = 0;

    switch (billingMode) {
      case "per_token":
        pricePerToken = (costConfig.pricePer1kTokens as number) || 0;
        break;
      case "per_second":
        pricePerSecond = (costConfig.pricePerSecond as number) || 0;
        break;
      case "per_call":
      default:
        pricePerCall = (costConfig.pricePerCall as number) || 0.02;
        break;
    }

    return {
      code: 0,
      data: {
        modelId: model.modelId,
        modelName: model.modelName,
        category: model.category,
        billingMode,
        pricing: {
          pricePerCall,
          pricePerToken,
          pricePerSecond,
          currency: "CNY",
        },
        minTier: model.minTier,
        quota: modelQuota
          ? {
              smallCycle: modelQuota.smallCycle,
              largeCycle: modelQuota.largeCycle,
              canUseSubscription: modelQuota.canUseSubscription,
            }
          : null,
      },
      msg: "success",
      timestamp: Date.now(),
    };
  }

  // ==================== 新增：消费流水查询 ====================

  /**
   * 获取用户消费流水
   */
  @Get("consumption")
  @ApiOperation({ summary: "获取用户消费流水" })
  @ApiQuery({ name: "startDate", required: false })
  @ApiQuery({ name: "endDate", required: false })
  @ApiQuery({ name: "type", required: false, enum: ["subscription", "balance", "all"] })
  @ApiQuery({ name: "category", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  async getConsumption(
    @Req() req: any,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("type") type?: "subscription" | "balance" | "all",
    @Query("category") category?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const userId = req.user.sub;

    const result = await this.consumptionService.getConsumptionHistory({
      userId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      type: type || "all",
      category,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });

    return {
      code: 0,
      data: {
        records: result.records,
        total: result.total,
        page: page ? parseInt(page, 10) : 1,
        pageSize: pageSize ? parseInt(pageSize, 10) : 20,
      },
      msg: "success",
      timestamp: Date.now(),
    };
  }

  /**
   * 获取消费汇总（按类别）
   */
  @Get("consumption/summary")
  @ApiOperation({ summary: "获取消费汇总" })
  @ApiQuery({ name: "startDate", required: false })
  @ApiQuery({ name: "endDate", required: false })
  async getConsumptionSummary(
    @Req() req: any,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    const userId = req.user.sub;

    const summary = await this.consumptionService.getConsumptionSummary(
      userId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );

    return {
      code: 0,
      data: summary,
      msg: "success",
      timestamp: Date.now(),
    };
  }
}
