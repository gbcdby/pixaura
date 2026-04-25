import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AiModel, Provider } from "../entities";
import type { AiModelEntity } from "@pixaura/shared-types";
import { RedisService } from "../../../common/redis/redis.service";

@Injectable()
export class CacheService {
  private readonly KEY_PREFIX = {
    AVAILABLE_MODELS: "models:available",
    MODEL_DETAIL: "model:detail",
    PROVIDER_CONFIG: "provider:config",
    PROVIDER_HEALTH: "provider:health",
    FAILOVER: "failover",
    PROVIDER_REMOTE_MODELS: "provider:remote-models",
  };

  constructor(
    private redisService: RedisService,
    @InjectRepository(AiModel)
    private aiModelRepository: Repository<AiModel>,
    @InjectRepository(Provider)
    private providerRepository: Repository<Provider>,
  ) {}

  private getRedisClient() {
    return this.redisService.getClient();
  }

  async getAvailableModels(
    userTier: string,
    category?: string,
  ): Promise<unknown | null> {
    const key = category
      ? `${this.KEY_PREFIX.AVAILABLE_MODELS}:${userTier}:${category}`
      : `${this.KEY_PREFIX.AVAILABLE_MODELS}:${userTier}`;
    const data = await this.getRedisClient().get(key);
    return data ? JSON.parse(data) : null;
  }

  async setAvailableModels(
    userTier: string,
    models: unknown,
    category?: string,
  ): Promise<void> {
    const key = category
      ? `${this.KEY_PREFIX.AVAILABLE_MODELS}:${userTier}:${category}`
      : `${this.KEY_PREFIX.AVAILABLE_MODELS}:${userTier}`;
    await this.getRedisClient().setex(key, 300, JSON.stringify(models));
  }

  async invalidateAvailableModels(): Promise<void> {
    const pattern = `${this.KEY_PREFIX.AVAILABLE_MODELS}:*`;
    const keys = await this.getRedisClient().keys(pattern);
    if (keys.length > 0) {
      await this.getRedisClient().del(...keys);
    }
  }

  async getModelDetail(modelId: string): Promise<AiModelEntity | null> {
    const key = `${this.KEY_PREFIX.MODEL_DETAIL}:${modelId}`;
    const data = await this.getRedisClient().get(key);
    return data ? JSON.parse(data) : null;
  }

  async setModelDetail(modelId: string, model: AiModelEntity): Promise<void> {
    const key = `${this.KEY_PREFIX.MODEL_DETAIL}:${modelId}`;
    await this.getRedisClient().setex(key, 600, JSON.stringify(model));
  }

  async invalidateModelDetail(modelId: string): Promise<void> {
    const key = `${this.KEY_PREFIX.MODEL_DETAIL}:${modelId}`;
    await this.getRedisClient().del(key);
  }

  async setProviderHealth(providerId: string, health: unknown): Promise<void> {
    const key = `${this.KEY_PREFIX.PROVIDER_HEALTH}:${providerId}`;
    await this.getRedisClient().setex(key, 60, JSON.stringify(health));
  }

  async invalidateProviderHealth(providerId: string): Promise<void> {
    const key = `${this.KEY_PREFIX.PROVIDER_HEALTH}:${providerId}`;
    await this.getRedisClient().del(key);
  }

  async setFailoverStatus(modelId: string, providerId: string): Promise<void> {
    const key = `${this.KEY_PREFIX.FAILOVER}:${modelId}`;
    await this.getRedisClient().setex(key, 300, providerId);
  }

  async invalidateFailoverStatus(modelId: string): Promise<void> {
    const key = `${this.KEY_PREFIX.FAILOVER}:${modelId}`;
    await this.getRedisClient().del(key);
  }

  async invalidateModelRelatedCache(modelId: string): Promise<void> {
    await Promise.all([
      this.invalidateModelDetail(modelId),
      this.invalidateAvailableModels(),
    ]);
  }

  async invalidateProviderRelatedCache(providerId: string): Promise<void> {
    await Promise.all([
      this.invalidateProviderHealth(providerId),
      this.invalidateAvailableModels(),
    ]);
  }

  // ==================== 远程模型列表缓存 ====================

  async getProviderRemoteModels(providerId: string): Promise<unknown[] | null> {
    const key = `${this.KEY_PREFIX.PROVIDER_REMOTE_MODELS}:${providerId}`;
    const data = await this.getRedisClient().get(key);
    return data ? JSON.parse(data) : null;
  }

  async setProviderRemoteModels(
    providerId: string,
    models: unknown[],
    ttl: number = 3600,
  ): Promise<void> {
    const key = `${this.KEY_PREFIX.PROVIDER_REMOTE_MODELS}:${providerId}`;
    await this.getRedisClient().setex(key, ttl, JSON.stringify(models));
  }

  async invalidateProviderRemoteModels(providerId: string): Promise<void> {
    const key = `${this.KEY_PREFIX.PROVIDER_REMOTE_MODELS}:${providerId}`;
    await this.getRedisClient().del(key);
  }
}
