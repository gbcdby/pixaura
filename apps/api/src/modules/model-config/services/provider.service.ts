import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Provider, AiModel, ModelProvider } from "../entities";
import { EncryptionService } from "./encryption.service";
import { CacheService } from "./cache.service";
import type {
  CreateProviderDto,
  UpdateProviderDto,
  ProviderListItemDto,
} from "@pixaura/shared-types";

@Injectable()
export class ProviderService {
  constructor(
    @InjectRepository(Provider)
    private providerRepository: Repository<Provider>,
    @InjectRepository(AiModel)
    private aiModelRepository: Repository<AiModel>,
    @InjectRepository(ModelProvider)
    private modelProviderRepository: Repository<ModelProvider>,
    private cacheService: CacheService,
    private encryptionService: EncryptionService,
  ) {}

  async create(dto: CreateProviderDto): Promise<Provider> {
    const existing = await this.providerRepository.findOne({
      where: { providerId: dto.providerId },
    });
    if (existing) {
      throw new ConflictException("供应商ID已存在");
    }

    const apiKeyEnc = dto.apiKey
      ? await this.encryptionService.encrypt(dto.apiKey)
      : null;
    const apiSecretEnc = dto.apiSecret
      ? await this.encryptionService.encrypt(dto.apiSecret)
      : null;

    const provider = this.providerRepository.create({
      providerId: dto.providerId,
      providerName: dto.providerName,
      providerType: dto.providerType,
      baseUrl: dto.baseUrl,
      authType: dto.authType,
      apiKeyEnc,
      apiSecretEnc,
      status: "enabled",
      healthStatus: "unknown",
      checkConfig: { interval: 30, timeout: 10 },
      rateLimitConfig: { requestsPerMinute: 60 },
      apiKeyExpiresAt: dto.apiKeyExpiresAt
        ? new Date(dto.apiKeyExpiresAt)
        : null,
    });

    const saved = await this.providerRepository.save(provider);
    await this.cacheService.invalidateProviderRelatedCache(saved.providerId);
    return saved;
  }

  async update(providerId: string, dto: UpdateProviderDto): Promise<Provider> {
    const provider = await this.providerRepository.findOne({
      where: { providerId },
    });
    if (!provider) {
      throw new NotFoundException("供应商不存在");
    }

    if (dto.providerName) provider.providerName = dto.providerName;
    if (dto.baseUrl) provider.baseUrl = dto.baseUrl;
    if (dto.status) provider.status = dto.status;
    if (dto.checkConfig) provider.checkConfig = dto.checkConfig;
    if (dto.rateLimitConfig) provider.rateLimitConfig = dto.rateLimitConfig;
    if (dto.apiKey)
      provider.apiKeyEnc = await this.encryptionService.encrypt(dto.apiKey);
    if (dto.apiSecret)
      provider.apiSecretEnc = await this.encryptionService.encrypt(
        dto.apiSecret,
      );
    if (dto.apiKeyExpiresAt !== undefined)
      provider.apiKeyExpiresAt = dto.apiKeyExpiresAt
        ? new Date(dto.apiKeyExpiresAt)
        : null;

    const saved = await this.providerRepository.save(provider);
    await this.cacheService.invalidateProviderRelatedCache(providerId);
    return saved;
  }

  async delete(providerId: string): Promise<void> {
    const provider = await this.providerRepository.findOne({
      where: { providerId },
    });
    if (!provider) {
      throw new NotFoundException("供应商不存在");
    }

    const modelCount = await this.modelProviderRepository.count({
      where: { providerId },
    });
    if (modelCount > 0) {
      throw new ConflictException("该供应商下有关联的模型，无法删除");
    }

    await this.providerRepository.remove(provider);
    await this.cacheService.invalidateProviderRelatedCache(providerId);
  }

  async findById(providerId: string): Promise<Provider | null> {
    return this.providerRepository.findOne({
      where: { providerId },
    });
  }

  async findAll(status?: string): Promise<ProviderListItemDto[]> {
    const where: Record<string, string> = {};
    if (status) where.status = status;

    const providers = await this.providerRepository.find({
      where,
      order: { createdAt: "DESC" },
    });

    return Promise.all(
      providers.map(async (provider) => {
        const modelsCount = await this.modelProviderRepository.count({
          where: { providerId: provider.providerId },
        });

        // 脱敏 API Key：只显示前 4 位和后 4 位，中间用 * 代替
        let apiKeyMasked: string | null = null;
        if (provider.apiKeyEnc) {
          try {
            const apiKey = await this.encryptionService.decrypt(
              provider.apiKeyEnc,
            );
            if (apiKey && apiKey.length > 8) {
              apiKeyMasked = `${apiKey.slice(0, 4)}${"*".repeat(apiKey.length - 8)}${apiKey.slice(-4)}`;
            } else if (apiKey) {
              apiKeyMasked = `${"*".repeat(apiKey.length)}`;
            }
          } catch {
            // 解密失败，设置为 null
            apiKeyMasked = null;
          }
        }

        return {
          providerId: provider.providerId,
          providerName: provider.providerName,
          providerType:
            provider.providerType as ProviderListItemDto["providerType"],
          baseUrl: provider.baseUrl,
          authType: provider.authType as ProviderListItemDto["authType"],
          status: provider.status as ProviderListItemDto["status"],
          healthStatus:
            provider.healthStatus as ProviderListItemDto["healthStatus"],
          modelsCount,
          apiKeyMasked,
          apiKeyExpiresAt: provider.apiKeyExpiresAt,
          createdAt: provider.createdAt,
        };
      }),
    );
  }

  async getProviderWithDecryptedKey(
    providerId: string,
  ): Promise<Provider & { apiKey?: string; apiSecret?: string }> {
    const provider = await this.providerRepository.findOne({
      where: { providerId },
    });
    if (!provider) {
      throw new NotFoundException("供应商不存在");
    }

    const result = { ...provider } as Provider & {
      apiKey?: string;
      apiSecret?: string;
    };

    if (provider.apiKeyEnc) {
      try {
        result.apiKey = await this.encryptionService.decrypt(
          provider.apiKeyEnc,
        );
      } catch {
        throw new Error("API Key 解密失败");
      }
    }

    if (provider.apiSecretEnc) {
      try {
        result.apiSecret = await this.encryptionService.decrypt(
          provider.apiSecretEnc,
        );
      } catch {
        throw new Error("API Secret 解密失败");
      }
    }

    return result;
  }

  async updateHealthStatus(
    providerId: string,
    healthStatus: string,
  ): Promise<void> {
    await this.providerRepository.update({ providerId }, { healthStatus });
    await this.cacheService.invalidateProviderHealth(providerId);
  }
}
