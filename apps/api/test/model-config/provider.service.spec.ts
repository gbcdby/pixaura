import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProviderService } from '../../src/modules/model-config/services/provider.service';
import { CacheService } from '../../src/modules/model-config/services/cache.service';
import { EncryptionService } from '../../src/modules/model-config/services/encryption.service';
import { Provider, AiModel, ModelProvider } from '../../src/modules/model-config/entities';
import { NotFoundException, ConflictException } from '@nestjs/common';
import type { CreateProviderDto, UpdateProviderDto } from '@pixaura/shared-types';

describe('ProviderService', () => {
  let service: ProviderService;
  let providerRepository: Repository<Provider>;
  let aiModelRepository: Repository<AiModel>;
  let modelProviderRepository: Repository<ModelProvider>;
  let cacheService: CacheService;
  let encryptionService: EncryptionService;

  // Mock 加密后的值 (格式: iv:authTag:ciphertext)
  const mockApiKeyEnc = 'mockIv:mockAuthTag:mockEncryptedKey';

  const mockProvider: Provider = {
    id: 'uuid-1',
    providerId: 'openai',
    providerName: 'OpenAI',
    providerType: 'official',
    baseUrl: 'https://api.openai.com',
    authType: 'api_key',
    apiKeyEnc: mockApiKeyEnc,
    apiSecretEnc: null,
    status: 'enabled',
    healthStatus: 'healthy',
    checkConfig: { interval: 30, timeout: 10 },
    rateLimitConfig: { requestsPerMinute: 60 },
    apiKeyExpiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProviderRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    update: jest.fn(),
  };

  const mockModelProviderRepository = {
    count: jest.fn(),
  };

  const mockCacheService = {
    invalidateProviderRelatedCache: jest.fn(),
    invalidateProviderHealth: jest.fn(),
  };

  const mockEncryptionService = {
    encrypt: jest.fn().mockResolvedValue(mockApiKeyEnc),
    decrypt: jest.fn().mockResolvedValue('test-key'),
    generateKey: jest.fn().mockReturnValue('mock-key'),
    saveKey: jest.fn().mockResolvedValue(undefined),
    getEncryptionKey: jest.fn().mockResolvedValue('mock-key'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProviderService,
        {
          provide: getRepositoryToken(Provider),
          useValue: mockProviderRepository,
        },
        {
          provide: getRepositoryToken(AiModel),
          useValue: {},
        },
        {
          provide: getRepositoryToken(ModelProvider),
          useValue: mockModelProviderRepository,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: EncryptionService,
          useValue: mockEncryptionService,
        },
      ],
    }).compile();

    service = module.get<ProviderService>(ProviderService);
    providerRepository = module.get<Repository<Provider>>(getRepositoryToken(Provider));
    aiModelRepository = module.get<Repository<AiModel>>(getRepositoryToken(AiModel));
    modelProviderRepository = module.get<Repository<ModelProvider>>(getRepositoryToken(ModelProvider));
    cacheService = module.get<CacheService>(CacheService);
    encryptionService = module.get<EncryptionService>(EncryptionService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateProviderDto = {
      providerId: 'openai',
      providerName: 'OpenAI',
      providerType: 'official',
      baseUrl: 'https://api.openai.com',
      authType: 'api_key',
      apiKey: 'test-api-key',
    };

    it('应该成功创建供应商', async () => {
      mockProviderRepository.findOne.mockResolvedValue(null);
      mockProviderRepository.create.mockReturnValue(mockProvider);
      mockProviderRepository.save.mockResolvedValue(mockProvider);

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(mockProviderRepository.create).toHaveBeenCalled();
      expect(mockProviderRepository.save).toHaveBeenCalled();
      expect(mockCacheService.invalidateProviderRelatedCache).toHaveBeenCalled();
    });

    it('应该抛出 ConflictException 当供应商ID已存在', async () => {
      mockProviderRepository.findOne.mockResolvedValue(mockProvider);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });

    it('应该加密API Key', async () => {
      mockProviderRepository.findOne.mockResolvedValue(null);
      mockProviderRepository.create.mockReturnValue(mockProvider);
      mockProviderRepository.save.mockResolvedValue(mockProvider);

      await service.create(createDto);

      const createCall = mockProviderRepository.create.mock.calls[0][0];
      expect(createCall.apiKeyEnc).toBeDefined();
      expect(createCall.apiKeyEnc).not.toBe(createDto.apiKey);
    });
  });

  describe('update', () => {
    const updateDto: UpdateProviderDto = {
      providerName: 'OpenAI GPT-4',
      status: 'disabled',
    };

    it('应该成功更新供应商', async () => {
      mockProviderRepository.findOne.mockResolvedValue(mockProvider);
      mockProviderRepository.save.mockResolvedValue({ ...mockProvider, ...updateDto });

      const result = await service.update('openai', updateDto);

      expect(result).toBeDefined();
      expect(result.providerName).toBe(updateDto.providerName);
      expect(mockCacheService.invalidateProviderRelatedCache).toHaveBeenCalled();
    });

    it('应该抛出 NotFoundException 当供应商不存在', async () => {
      mockProviderRepository.findOne.mockResolvedValue(null);

      await expect(service.update('nonexistent', updateDto)).rejects.toThrow(NotFoundException);
    });

    it('应该加密新的API Key', async () => {
      const dtoWithKey: UpdateProviderDto = { apiKey: 'new-api-key' };
      mockProviderRepository.findOne.mockResolvedValue(mockProvider);
      mockProviderRepository.save.mockResolvedValue(mockProvider);

      await service.update('openai', dtoWithKey);

      const saveCall = mockProviderRepository.save.mock.calls[0][0];
      expect(saveCall.apiKeyEnc).toBeDefined();
      expect(saveCall.apiKeyEnc).not.toBe(dtoWithKey.apiKey);
    });
  });

  describe('delete', () => {
    it('应该成功删除供应商', async () => {
      mockProviderRepository.findOne.mockResolvedValue(mockProvider);
      mockModelProviderRepository.count.mockResolvedValue(0);

      await service.delete('openai');

      expect(mockProviderRepository.remove).toHaveBeenCalled();
      expect(mockCacheService.invalidateProviderRelatedCache).toHaveBeenCalled();
    });

    it('应该抛出 NotFoundException 当供应商不存在', async () => {
      mockProviderRepository.findOne.mockResolvedValue(null);

      await expect(service.delete('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('应该抛出 ConflictException 当供应商有关联模型', async () => {
      mockProviderRepository.findOne.mockResolvedValue(mockProvider);
      mockModelProviderRepository.count.mockResolvedValue(5);

      await expect(service.delete('openai')).rejects.toThrow(ConflictException);
    });
  });

  describe('findById', () => {
    it('应该返回供应商', async () => {
      mockProviderRepository.findOne.mockResolvedValue(mockProvider);

      const result = await service.findById('openai');

      expect(result).toBeDefined();
      expect(result?.providerId).toBe('openai');
    });

    it('应该返回 null 当供应商不存在', async () => {
      mockProviderRepository.findOne.mockResolvedValue(null);

      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('应该返回供应商列表', async () => {
      mockProviderRepository.find.mockResolvedValue([mockProvider]);
      mockModelProviderRepository.count.mockResolvedValue(3);

      const result = await service.findAll();

      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
      expect(result[0].providerId).toBe('openai');
      expect(result[0].modelsCount).toBe(3);
    });

    it('应该支持按状态筛选', async () => {
      mockProviderRepository.find.mockResolvedValue([mockProvider]);
      mockModelProviderRepository.count.mockResolvedValue(0);

      await service.findAll('enabled');

      expect(mockProviderRepository.find).toHaveBeenCalledWith({
        where: { status: 'enabled' },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('getProviderWithDecryptedKey', () => {
    it('应该返回带有解密API Key的供应商', async () => {
      const apiKey = 'test-api-key';
      const providerWithEnc = {
        ...mockProvider,
        apiKeyEnc: mockApiKeyEnc,
      };
      mockProviderRepository.findOne.mockResolvedValue(providerWithEnc);

      const result = await service.getProviderWithDecryptedKey('openai');

      expect(result).toBeDefined();
      expect(result.apiKey).toBe('test-key');
    });

    it('应该抛出 NotFoundException 当供应商不存在', async () => {
      mockProviderRepository.findOne.mockResolvedValue(null);

      await expect(service.getProviderWithDecryptedKey('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('应该抛出错误当解密失败', async () => {
      mockProviderRepository.findOne.mockResolvedValue({
        ...mockProvider,
        apiKeyEnc: 'invalid-encrypted-data',
      });

      await expect(service.getProviderWithDecryptedKey('openai')).rejects.toThrow();
    });
  });

  describe('updateHealthStatus', () => {
    it('应该更新健康状态', async () => {
      mockProviderRepository.update.mockResolvedValue({ affected: 1 });

      await service.updateHealthStatus('openai', 'unhealthy');

      expect(mockProviderRepository.update).toHaveBeenCalledWith(
        { providerId: 'openai' },
        { healthStatus: 'unhealthy' }
      );
      expect(mockCacheService.invalidateProviderHealth).toHaveBeenCalled();
    });
  });
});
