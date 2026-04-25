import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AiModel, ModelProvider, Provider } from "../entities";
import { CacheService } from "./cache.service";
import {
  QuotaConfig,
  QuotaTargetType,
  QuotaCycleType,
} from "../../billing/entities/quota-config.entity";
import { SubscriptionTier } from "../../billing/entities/subscription.entity";
import type {
  CreateModelDto,
  UpdateModelDto,
  UserModelListItemDto,
  AdminModelListItemDto,
  ModelByCategoryDto,
  UserModelDetailDto,
} from "@pixaura/shared-types";
import { FunctionCategory, FunctionCategoryNames } from "@pixaura/shared-types";
import { EncryptionService } from "./encryption.service";

@Injectable()
export class ModelService {
  constructor(
    @InjectRepository(AiModel)
    private aiModelRepository: Repository<AiModel>,
    @InjectRepository(ModelProvider)
    private modelProviderRepository: Repository<ModelProvider>,
    @InjectRepository(Provider)
    private providerRepository: Repository<Provider>,
    @InjectRepository(QuotaConfig)
    private quotaConfigRepository: Repository<QuotaConfig>,
    private cacheService: CacheService,
    private encryptionService: EncryptionService,
  ) {}

  async create(dto: CreateModelDto): Promise<AiModel> {
    const existing = await this.aiModelRepository.findOne({
      where: { modelId: dto.modelId },
    });
    if (existing) {
      throw new ConflictException("模型ID已存在");
    }

    // 检查供应商是否存在
    const provider = await this.providerRepository.findOne({
      where: { providerId: dto.providerId },
    });
    if (!provider) {
      throw new NotFoundException("供应商不存在");
    }

    if (dto.isDefault) {
      await this.unsetDefaultForCategory(dto.category);
    }

    const costConfig: Record<string, unknown> = {
      billingMode: dto.billingMode,
    };

    if (dto.billingMode === "per_token") {
      costConfig.costPer1kTokens = dto.costPer1kTokens ?? 0;
      costConfig.pricePer1kTokens = dto.pricePer1kTokens ?? 0;
    } else if (dto.billingMode === "per_second") {
      costConfig.costPerSecond = dto.costPerSecond ?? 0;
      costConfig.pricePerSecond = dto.pricePerSecond ?? 0;
    } else {
      costConfig.costPerCall = dto.costPerCall ?? 0;
      costConfig.pricePerCall = dto.pricePerCall ?? 0;
    }

    const model = this.aiModelRepository.create({
      modelId: dto.modelId,
      modelName: dto.modelName,
      category: dto.category,
      description: dto.description ?? null,
      minTier: dto.minTier,
      isDefault: dto.isDefault,
      status: "enabled",
      defaultParams: dto.defaultParams,
      customParams: dto.customParams ?? {},
      costConfig,
      supportedFeatures: dto.supportedFeatures,
    });

    const saved = await this.aiModelRepository.save(model);

    // 创建模型-供应商关联（作为主要供应商）
    const modelProvider = this.modelProviderRepository.create({
      modelId: dto.modelId,
      providerId: dto.providerId,
      isPrimary: true,
      priority: 1,
      providerModelId: dto.providerModelId || null,
      status: "enabled",
    });
    await this.modelProviderRepository.save(modelProvider);

    // 创建额度配置（basic 和 pro 订阅等级，小周期和大周期）
    await this.createQuotaConfigs(saved);

    await this.cacheService.invalidateModelRelatedCache(saved.modelId);
    return saved;
  }

  async update(modelId: string, dto: UpdateModelDto): Promise<AiModel> {
    const model = await this.aiModelRepository.findOne({
      where: { modelId },
    });
    if (!model) {
      throw new NotFoundException("模型不存在");
    }

    if (dto.isDefault && !model.isDefault) {
      await this.unsetDefaultForCategory(model.category);
    }

    if (dto.modelName) model.modelName = dto.modelName;
    if (dto.description !== undefined)
      model.description = dto.description ?? null;
    if (dto.minTier) model.minTier = dto.minTier;
    if (dto.isDefault !== undefined) model.isDefault = dto.isDefault;
    if (dto.status) model.status = dto.status;
    if (dto.defaultParams) model.defaultParams = dto.defaultParams;
    if (dto.customParams) model.customParams = dto.customParams;
    if (dto.supportedFeatures) model.supportedFeatures = dto.supportedFeatures;

    if (
      dto.billingMode ||
      dto.costPer1kTokens !== undefined ||
      dto.pricePer1kTokens !== undefined ||
      dto.costPerCall !== undefined ||
      dto.pricePerCall !== undefined ||
      dto.costPerSecond !== undefined ||
      dto.pricePerSecond !== undefined
    ) {
      const costConfig: Record<string, unknown> = { ...model.costConfig };

      if (dto.billingMode !== undefined) costConfig.billingMode = dto.billingMode;
      if (dto.costPer1kTokens !== undefined)
        costConfig.costPer1kTokens = dto.costPer1kTokens;
      if (dto.pricePer1kTokens !== undefined)
        costConfig.pricePer1kTokens = dto.pricePer1kTokens;
      if (dto.costPerCall !== undefined)
        costConfig.costPerCall = dto.costPerCall;
      if (dto.pricePerCall !== undefined)
        costConfig.pricePerCall = dto.pricePerCall;
      if (dto.costPerSecond !== undefined)
        costConfig.costPerSecond = dto.costPerSecond;
      if (dto.pricePerSecond !== undefined)
        costConfig.pricePerSecond = dto.pricePerSecond;

      model.costConfig = costConfig;
    }

    const saved = await this.aiModelRepository.save(model);
    await this.cacheService.invalidateModelRelatedCache(modelId);
    return saved;
  }

  async delete(modelId: string): Promise<void> {
    const model = await this.aiModelRepository.findOne({
      where: { modelId },
    });
    if (!model) {
      throw new NotFoundException("模型不存在");
    }

    // 删除模型与供应商的关联关系
    await this.modelProviderRepository.delete({ modelId });

    // 删除模型的额度配置
    await this.quotaConfigRepository.delete({
      targetType: QuotaTargetType.MODEL,
      targetId: modelId,
    });

    // 真正从数据库中删除模型
    await this.aiModelRepository.remove(model);
    await this.cacheService.invalidateModelRelatedCache(modelId);
  }

  async findById(modelId: string): Promise<AiModel | null> {
    return this.aiModelRepository.findOne({
      where: { modelId },
    });
  }

  async findByIdWithProvider(
    modelId: string,
  ): Promise<(AiModel & { provider?: Provider }) | null> {
    const model = await this.aiModelRepository.findOne({
      where: { modelId },
    });
    if (!model) return null;

    const modelProvider = await this.modelProviderRepository.findOne({
      where: { modelId, isPrimary: true },
    });

    if (modelProvider) {
      const provider = await this.providerRepository.findOne({
        where: { providerId: modelProvider.providerId, status: "enabled" },
      });
      if (provider) {
        return { ...model, provider };
      }
    }

    return model;
  }

  async getAvailableModels(
    userTier: string,
    category?: string,
  ): Promise<ModelByCategoryDto[]> {
    const cached = await this.cacheService.getAvailableModels(
      userTier,
      category,
    );
    if (cached) {
      return cached as ModelByCategoryDto[];
    }

    // 查询启用的模型，且关联的主要供应商也是启用状态
    const queryBuilder = this.aiModelRepository
      .createQueryBuilder("model")
      .innerJoin(
        "model_providers",
        "mp",
        "model.model_id = mp.model_id AND mp.is_primary = true",
      )
      .innerJoin("providers", "p", "mp.provider_id = p.provider_id")
      .where("model.status = :modelStatus", { modelStatus: "enabled" })
      .andWhere("p.status = :providerStatus", { providerStatus: "enabled" })
      .orderBy("model.created_at", "DESC");

    if (category) {
      queryBuilder.andWhere("model.category = :category", { category });
    }

    const models = await queryBuilder.getMany();

    const tierOrder = {
      [SubscriptionTier.FREE]: 0,
      [SubscriptionTier.BASIC]: 1,
      [SubscriptionTier.PRO]: 2,
    };
    const userTierLevel = tierOrder[userTier as SubscriptionTier] ?? 0;

    const filteredModels = models.filter((model) => {
      const modelTierLevel = tierOrder[model.minTier as SubscriptionTier] ?? 0;
      return modelTierLevel <= userTierLevel;
    });

    const result = await this.groupModelsByCategory(filteredModels);
    await this.cacheService.setAvailableModels(userTier, result, category);

    return result;
  }

  async getUserModelDetail(
    modelId: string,
  ): Promise<UserModelDetailDto | null> {
    const cached = await this.cacheService.getModelDetail(modelId);
    if (cached) {
      return this.toUserModelDetail(
        cached as unknown as AiModel & { provider?: Provider },
      );
    }

    const model = await this.findByIdWithProvider(modelId);
    // findByIdWithProvider 已经检查了供应商状态，返回的 provider 只包含 enabled 状态的供应商
    if (!model || model.status !== "enabled") {
      return null;
    }

    // 如果没有关联的启用供应商，也不返回
    if (!model.provider) {
      return null;
    }

    await this.cacheService.setModelDetail(
      modelId,
      model as unknown as import("@pixaura/shared-types").AiModelEntity,
    );
    return this.toUserModelDetail(model);
  }

  /**
   * 获取指定类别的系统默认模型（isDefault = true 的启用模型）
   */
  async getDefaultModelForCategory(category: string): Promise<AiModel | null> {
    return this.aiModelRepository.findOne({
      where: { category, isDefault: true, status: "enabled" },
    });
  }

  async findAllForAdmin(
    providerId?: string,
    category?: string,
    status?: string,
  ): Promise<AdminModelListItemDto[]> {
    const where: Record<string, unknown> = {};
    if (category) where.category = category;
    if (status) where.status = status;

    const models = await this.aiModelRepository.find({
      where,
      order: { createdAt: "DESC" },
    });

    const result: AdminModelListItemDto[] = [];

    for (const model of models) {
      const modelProvider = await this.modelProviderRepository.findOne({
        where: { modelId: model.modelId, isPrimary: true },
      });

      let providerName = "-";
      if (modelProvider) {
        const provider = await this.providerRepository.findOne({
          where: { providerId: modelProvider.providerId },
        });
        if (provider) {
          providerName = provider.providerName;
        }
      }

      const costConfig = (model.costConfig || {}) as Record<
        string,
        number | undefined
      >;

      result.push({
        modelId: model.modelId,
        modelName: model.modelName,
        providerId: modelProvider?.providerId || "-",
        providerName,
        category: model.category as AdminModelListItemDto["category"],
        status: model.status as AdminModelListItemDto["status"],
        minTier: model.minTier as AdminModelListItemDto["minTier"],
        isDefault: model.isDefault,
        billingMode: costConfig.billingMode as string | undefined,
        costPer1kTokens: costConfig.costPer1kTokens,
        pricePer1kTokens: costConfig.pricePer1kTokens,
        costPerCall: costConfig.costPerCall,
        pricePerCall: costConfig.pricePerCall,
        costPerSecond: costConfig.costPerSecond,
        pricePerSecond: costConfig.pricePerSecond,
        defaultParams: model.defaultParams,
        customParams: model.customParams,
        supportedFeatures: model.supportedFeatures,
        createdAt: model.createdAt,
      });
    }

    return result;
  }

  private async unsetDefaultForCategory(category: string): Promise<void> {
    await this.aiModelRepository.update(
      { category, isDefault: true },
      { isDefault: false },
    );
  }

  private async groupModelsByCategory(
    models: AiModel[],
  ): Promise<ModelByCategoryDto[]> {
    const groups = new Map<string, AiModel[]>();

    for (const model of models) {
      if (!groups.has(model.category)) {
        groups.set(model.category, []);
      }
      groups.get(model.category)!.push(model);
    }

    const result: ModelByCategoryDto[] = [];

    for (const [category, categoryModels] of groups) {
      const modelList: UserModelListItemDto[] = [];

      for (const model of categoryModels) {
        const costConfig = (model.costConfig || {}) as Record<string, unknown>;
        const item: UserModelListItemDto = {
          modelId: model.modelId,
          modelName: model.modelName,
          description: model.description,
          isDefault: model.isDefault,
          defaultParams: (model.defaultParams || {}) as Record<string, unknown>,
          customParams: (model.customParams || {}) as Record<string, unknown>,
        };

        if (costConfig.billingMode === "per_token") {
          item.pricePer1kTokens = costConfig.pricePer1kTokens as
            | number
            | undefined;
        } else if (costConfig.billingMode === "per_second") {
          item.pricePerSecond = costConfig.pricePerSecond as number | undefined;
        } else {
          item.pricePerCall = costConfig.pricePerCall as number | undefined;
        }

        modelList.push(item);
      }

      result.push({
        category: category as FunctionCategory,
        categoryName:
          FunctionCategoryNames[category as FunctionCategory] || category,
        models: modelList,
      });
    }

    return result;
  }

  private toUserModelDetail(
    model: AiModel & { provider?: Provider },
  ): UserModelDetailDto {
    const costConfig = (model.costConfig || {}) as Record<string, unknown>;

    const result: UserModelDetailDto = {
      modelId: model.modelId,
      modelName: model.modelName,
      category: model.category as FunctionCategory,
      description: model.description,
      defaultParams: model.defaultParams,
      customParams: model.customParams,
      supportedFeatures: model.supportedFeatures,
    };

    if (costConfig.billingMode === "per_token") {
      result.pricePer1kTokens = costConfig.pricePer1kTokens as
        | number
        | undefined;
    } else if (costConfig.billingMode === "per_second") {
      result.pricePerSecond = costConfig.pricePerSecond as number | undefined;
    } else {
      result.pricePerCall = costConfig.pricePerCall as number | undefined;
    }

    return result;
  }

  async checkUserPermission(
    modelId: string,
    userTier: string,
  ): Promise<boolean> {
    const model = await this.findById(modelId);
    if (!model || model.status !== "enabled") {
      return false;
    }

    const tierOrder = {
      [SubscriptionTier.FREE]: 0,
      [SubscriptionTier.BASIC]: 1,
      [SubscriptionTier.PRO]: 2,
    };
    const userTierLevel = tierOrder[userTier as SubscriptionTier] ?? 0;
    const modelTierLevel = tierOrder[model.minTier as SubscriptionTier] ?? 0;

    return modelTierLevel <= userTierLevel;
  }

  async setModelProvider(
    modelId: string,
    providerId: string,
    isPrimary: boolean,
    priority: number,
    providerModelId?: string,
  ): Promise<ModelProvider> {
    const existing = await this.modelProviderRepository.findOne({
      where: { modelId, providerId },
    });

    if (existing) {
      existing.isPrimary = isPrimary;
      existing.priority = priority;
      if (providerModelId) existing.providerModelId = providerModelId;
      return this.modelProviderRepository.save(existing);
    }

    if (isPrimary) {
      await this.modelProviderRepository.update(
        { modelId, isPrimary: true },
        { isPrimary: false },
      );
    }

    const modelProvider = this.modelProviderRepository.create({
      modelId,
      providerId,
      isPrimary,
      priority,
      providerModelId: providerModelId || null,
      status: "enabled",
    });

    return this.modelProviderRepository.save(modelProvider);
  }

  /**
   * 为模型创建额度配置
   * 为每个订阅等级（basic、pro）创建小周期（4小时）和大周期（7天）的额度配置
   */
  private async createQuotaConfigs(model: AiModel): Promise<void> {
    const tiers = [SubscriptionTier.BASIC, SubscriptionTier.PRO];
    const cycles = [QuotaCycleType.SMALL, QuotaCycleType.LARGE];

    // 默认额度值配置
    const defaultQuotaValues: Record<
      SubscriptionTier.BASIC | SubscriptionTier.PRO,
      Record<QuotaCycleType, number>
    > = {
      [SubscriptionTier.BASIC]: {
        [QuotaCycleType.SMALL]: 50, // basic 小周期 50次
        [QuotaCycleType.LARGE]: 1000, // basic 大周期 1000次
      },
      [SubscriptionTier.PRO]: {
        [QuotaCycleType.SMALL]: 100, // pro 小周期 100次
        [QuotaCycleType.LARGE]: 2000, // pro 大周期 2000次
      },
    };

    const quotaConfigs: QuotaConfig[] = [];

    for (const tier of tiers) {
      for (const cycle of cycles) {
        // 检查是否已存在
        const existing = await this.quotaConfigRepository.findOne({
          where: {
            tier,
            cycleType: cycle,
            targetType: QuotaTargetType.MODEL,
            targetId: model.modelId,
          },
        });

        if (!existing) {
          const config = this.quotaConfigRepository.create({
            tier,
            cycleType: cycle,
            targetType: QuotaTargetType.MODEL,
            targetId: model.modelId,
            quotaValue:
              defaultQuotaValues[
                tier as SubscriptionTier.BASIC | SubscriptionTier.PRO
              ][cycle],
            isActive: true,
          });
          quotaConfigs.push(config);
        }
      }
    }

    if (quotaConfigs.length > 0) {
      await this.quotaConfigRepository.save(quotaConfigs);
    }
  }

  /**
   * 从供应商获取远程模型列表（优先从 Redis 缓存读取）
   * @param providerId 供应商 ID
   * @param forceRefresh 是否强制刷新，跳过缓存
   */
  async fetchRemoteModels(
    providerId: string,
    forceRefresh: boolean = false,
  ): Promise<
    Array<{
      id: string;
      name: string;
      description?: string;
    }>
  > {
    // 优先从缓存读取（如果不强制刷新）
    if (!forceRefresh) {
      const cached =
        await this.cacheService.getProviderRemoteModels(providerId);
      if (cached && cached.length > 0) {
        return cached as Array<{
          id: string;
          name: string;
          description?: string;
        }>;
      }
    }

    const provider = await this.providerRepository.findOne({
      where: { providerId },
    });

    if (!provider) {
      throw new NotFoundException("供应商不存在");
    }

    // 解密 API Key
    let apiKey: string | null = null;
    if (provider.apiKeyEnc) {
      try {
        apiKey = await this.encryptionService.decrypt(provider.apiKeyEnc);
      } catch (error) {
        throw new Error("API Key 解密失败");
      }
    }

    // 标准化 baseUrl：移除末尾斜杠
    const normalizedBaseUrl = provider.baseUrl?.replace(/\/$/, "");

    // 调用供应商的 /models 接口
    const modelsUrl = `${normalizedBaseUrl}/models`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(modelsUrl, {
        method: "GET",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey || ""}`,
          "Content-Type": "application/json",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error("获取模型列表失败");
      }

      const data = await response.json();

      // 处理响应数据，提取模型列表
      // 支持 OpenAI 兼容格式：{ data: [{ id: 'xxx', name: 'xxx', ... }, ...] }
      let models: Array<{ id: string; name?: string; description?: string }> =
        [];

      if (Array.isArray(data)) {
        // 直接返回数组
        models = data;
      } else if (data && Array.isArray(data.data)) {
        // { data: [...] } 格式
        models = data.data;
      }

      // 统一格式输出
      const result = models.map((model: any) => {
        // 兼容不同的字段命名
        const id = model.id || model.model_id || model.modelId || "";
        const name =
          model.name ||
          model.model_name ||
          model.modelName ||
          model.display_name ||
          id;
        const description =
          model.description ||
          model.desc ||
          model.summary ||
          model.model_description;

        return { id, name, description };
      });

      // 缓存结果（1 小时）
      await this.cacheService.setProviderRemoteModels(providerId, result, 3600);

      return result;
    } catch (error) {
      throw new Error("获取远程模型列表失败");
    }
  }
}
