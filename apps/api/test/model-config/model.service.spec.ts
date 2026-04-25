import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModelService } from '../../src/modules/model-config/services/model.service';
import { CacheService } from '../../src/modules/model-config/services/cache.service';
import { AiModel, ModelProvider, Provider } from '../../src/modules/model-config/entities';
import { NotFoundException, ConflictException } from '@nestjs/common';
import type { CreateModelDto, UpdateModelDto } from '@pixaura/shared-types';
import { FunctionCategory, SubscriptionTier } from '@pixaura/shared-types';

describe('ModelService', () => {
  let service: ModelService;
  let aiModelRepository: Repository<AiModel>;
  let modelProviderRepository: Repository<ModelProvider>;
  let providerRepository: Repository<Provider>;
  let cacheService: CacheService;

  const mockModel: AiModel = {
    id: 'uuid-1',
    modelId: 'gpt-4',
    modelName: 'GPT-4',
    category: FunctionCategory.TEXT_GENERATION,
    description: 'GPT-4大模型',
    minTier: 'free',
    isDefault: false,
    status: 'enabled',
    defaultParams: { temperature: 0.7, maxTokens: 2048 },
    costConfig: { billingMode: 'per_token', costPer1kTokens: 0.001, pricePer1kTokens: 0.002 },
    supportedFeatures: ['stream', 'function_calling'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAiModelRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const mockModelProviderRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  };

  const mockProviderRepository = {
    findOne: jest.fn(),
  };

  const mockCacheService = {
    getAvailableModels: jest.fn(),
    setAvailableModels: jest.fn(),
    getModelDetail: jest.fn(),
    setModelDetail: jest.fn(),
    invalidateModelRelatedCache: jest.fn(),
    invalidateModelDetail: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModelService,
        {
          provide: getRepositoryToken(AiModel),
          useValue: mockAiModelRepository,
        },
        {
          provide: getRepositoryToken(ModelProvider),
          useValue: mockModelProviderRepository,
        },
        {
          provide: getRepositoryToken(Provider),
          useValue: mockProviderRepository,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<ModelService>(ModelService);
    aiModelRepository = module.get<Repository<AiModel>>(getRepositoryToken(AiModel));
    modelProviderRepository = module.get<Repository<ModelProvider>>(getRepositoryToken(ModelProvider));
    providerRepository = module.get<Repository<Provider>>(getRepositoryToken(Provider));
    cacheService = module.get<CacheService>(CacheService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateModelDto = {
      modelId: 'new-model',
      modelName: 'New Model',
      providerId: 'openai',
      category: FunctionCategory.TEXT_GENERATION,
      description: 'Test description',
      minTier: 'free',
      isDefault: false,
      billingMode: 'per_token',
      costPer1kTokens: 0.001,
      pricePer1kTokens: 0.002,
      defaultParams: {},
      supportedFeatures: [],
    };

    const mockProvider = {
      id: 'uuid-provider',
      providerId: 'openai',
      providerName: 'OpenAI GPT-4',
    };

    it('应该成功创建模型', async () => {
      mockAiModelRepository.findOne.mockResolvedValue(null);
      mockProviderRepository.findOne.mockResolvedValue(mockProvider);
      mockAiModelRepository.create.mockReturnValue(mockModel);
      mockAiModelRepository.save.mockResolvedValue(mockModel);
      mockModelProviderRepository.create.mockReturnValue({
        id: 'uuid-mp',
        modelId: createDto.modelId,
        providerId: createDto.providerId,
        isPrimary: true,
        priority: 1,
        providerModelId: null,
        status: 'enabled',
      });
      mockModelProviderRepository.save.mockResolvedValue({
        id: 'uuid-mp',
      });

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(mockAiModelRepository.create).toHaveBeenCalled();
      expect(mockAiModelRepository.save).toHaveBeenCalled();
      expect(mockModelProviderRepository.create).toHaveBeenCalled();
      expect(mockModelProviderRepository.save).toHaveBeenCalled();
      expect(mockCacheService.invalidateModelRelatedCache).toHaveBeenCalled();
    });

    it('应该抛出 NotFoundException 当供应商不存在', async () => {
      mockAiModelRepository.findOne.mockResolvedValue(null);
      mockProviderRepository.findOne.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });

    it('应该抛出 ConflictException 当模型ID已存在', async () => {
      mockAiModelRepository.findOne.mockResolvedValue(mockModel);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });

    it('设置为默认模型时应该取消同类别的其他默认模型', async () => {
      const dtoWithDefault: CreateModelDto = { ...createDto, isDefault: true };
      mockAiModelRepository.findOne.mockResolvedValue(null);
      mockProviderRepository.findOne.mockResolvedValue(mockProvider);
      mockAiModelRepository.create.mockReturnValue(mockModel);
      mockAiModelRepository.save.mockResolvedValue(mockModel);
      mockModelProviderRepository.create.mockReturnValue({
        id: 'uuid-mp',
        modelId: createDto.modelId,
        providerId: createDto.providerId,
        isPrimary: true,
        priority: 1,
        providerModelId: null,
        status: 'enabled',
      });
      mockModelProviderRepository.save.mockResolvedValue({ id: 'uuid-mp' });

      await service.create(dtoWithDefault);

      expect(mockAiModelRepository.update).toHaveBeenCalledWith(
        { category: dtoWithDefault.category, isDefault: true },
        { isDefault: false }
      );
    });

    it('应该正确设置按调用计费的配置', async () => {
      const dtoPerCall: CreateModelDto = {
        ...createDto,
        billingMode: 'per_call',
        costPerCall: 0.01,
        pricePerCall: 0.02,
      };
      mockAiModelRepository.findOne.mockResolvedValue(null);
      mockProviderRepository.findOne.mockResolvedValue(mockProvider);
      mockAiModelRepository.create.mockReturnValue(mockModel);
      mockAiModelRepository.save.mockResolvedValue(mockModel);
      mockModelProviderRepository.create.mockReturnValue({
        id: 'uuid-mp',
        modelId: createDto.modelId,
        providerId: createDto.providerId,
        isPrimary: true,
        priority: 1,
        providerModelId: null,
        status: 'enabled',
      });
      mockModelProviderRepository.save.mockResolvedValue({ id: 'uuid-mp' });

      await service.create(dtoPerCall);

      const createCall = mockAiModelRepository.create.mock.calls[0][0];
      expect(createCall.costConfig.billingMode).toBe('per_call');
      expect(createCall.costConfig.costPerCall).toBe(0.01);
      expect(createCall.costConfig.pricePerCall).toBe(0.02);
    });
  });

  describe('update', () => {
    const updateDto: UpdateModelDto = {
      modelName: 'Updated Name',
      status: 'disabled',
    };

    it('应该成功更新模型', async () => {
      mockAiModelRepository.findOne.mockResolvedValue(mockModel);
      mockAiModelRepository.save.mockResolvedValue({ ...mockModel, ...updateDto });

      const result = await service.update('qwen2.5-72b', updateDto);

      expect(result).toBeDefined();
      expect(result.modelName).toBe(updateDto.modelName);
      expect(mockCacheService.invalidateModelRelatedCache).toHaveBeenCalled();
    });

    it('应该抛出 NotFoundException 当模型不存在', async () => {
      mockAiModelRepository.findOne.mockResolvedValue(null);

      await expect(service.update('nonexistent', updateDto)).rejects.toThrow(NotFoundException);
    });

    it('设置为默认模型时应该取消同类别的其他默认模型', async () => {
      mockAiModelRepository.findOne.mockResolvedValue({ ...mockModel, isDefault: false });
      mockAiModelRepository.save.mockResolvedValue({ ...mockModel, isDefault: true });

      await service.update('qwen2.5-72b', { isDefault: true });

      expect(mockAiModelRepository.update).toHaveBeenCalledWith(
        { category: mockModel.category, isDefault: true },
        { isDefault: false }
      );
    });
  });

  describe('delete', () => {
    it('应该软删除模型', async () => {
      mockAiModelRepository.findOne.mockResolvedValue(mockModel);
      mockAiModelRepository.save.mockResolvedValue({ ...mockModel, status: 'disabled' });

      await service.delete('qwen2.5-72b');

      expect(mockAiModelRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'disabled' })
      );
      expect(mockCacheService.invalidateModelRelatedCache).toHaveBeenCalled();
    });

    it('应该抛出 NotFoundException 当模型不存在', async () => {
      mockAiModelRepository.findOne.mockResolvedValue(null);

      await expect(service.delete('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAvailableModels', () => {
    it('应该从缓存获取模型列表', async () => {
      const cachedData = [{ category: 'TEXT_GENERATION', categoryName: '文本生成', models: [] }];
      mockCacheService.getAvailableModels.mockResolvedValue(cachedData);

      const result = await service.getAvailableModels('free');

      expect(result).toEqual(cachedData);
      expect(mockAiModelRepository.find).not.toHaveBeenCalled();
    });

    it('应该按用户订阅等级过滤模型', async () => {
      mockCacheService.getAvailableModels.mockResolvedValue(null);
      mockAiModelRepository.find.mockResolvedValue([
        { ...mockModel, minTier: 'free' },
        { ...mockModel, modelId: 'pro-model', minTier: 'pro' },
      ]);
      mockModelProviderRepository.findOne.mockResolvedValue(null);

      const result = await service.getAvailableModels('basic');

      expect(result).toBeDefined();
      // free 用户可以看到 free 模型
      const freeResult = await service.getAvailableModels('free');
      expect(mockCacheService.setAvailableModels).toHaveBeenCalled();
    });

    it('应该支持按类别筛选', async () => {
      mockCacheService.getAvailableModels.mockResolvedValue(null);
      mockAiModelRepository.find.mockResolvedValue([mockModel]);
      mockModelProviderRepository.findOne.mockResolvedValue(null);

      await service.getAvailableModels('free', FunctionCategory.TEXT_GENERATION);

      expect(mockAiModelRepository.find).toHaveBeenCalledWith({
        where: { status: 'enabled', category: FunctionCategory.TEXT_GENERATION },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('getUserModelDetail', () => {
    it('应该从缓存获取模型详情', async () => {
      mockCacheService.getModelDetail.mockResolvedValue({
        ...mockModel,
        provider: { providerId: 'openai', providerName: 'OpenAI' },
      });

      const result = await service.getUserModelDetail('qwen2.5-72b');

      expect(result).toBeDefined();
      expect(result?.modelId).toBe('qwen2.5-72b');
    });

    it('应该返回 null 当模型不存在', async () => {
      mockCacheService.getModelDetail.mockResolvedValue(null);
      mockAiModelRepository.findOne.mockResolvedValue(null);

      const result = await service.getUserModelDetail('nonexistent');

      expect(result).toBeNull();
    });

    it('应该返回 null 当模型已禁用', async () => {
      mockCacheService.getModelDetail.mockResolvedValue(null);
      mockAiModelRepository.findOne.mockResolvedValue({ ...mockModel, status: 'disabled' });

      const result = await service.getUserModelDetail('qwen2.5-72b');

      expect(result).toBeNull();
    });
  });

  describe('checkUserPermission', () => {
    it('应该返回 true 当用户有权限访问模型', async () => {
      mockAiModelRepository.findOne.mockResolvedValue({ ...mockModel, status: 'enabled', minTier: 'free' });

      const result = await service.checkUserPermission('qwen2.5-72b', 'free');

      expect(result).toBe(true);
    });

    it('应该返回 false 当用户订阅等级不足', async () => {
      mockAiModelRepository.findOne.mockResolvedValue({ ...mockModel, minTier: 'pro' });

      const result = await service.checkUserPermission('qwen2.5-72b', 'free');

      expect(result).toBe(false);
    });

    it('应该返回 false 当模型不存在', async () => {
      mockAiModelRepository.findOne.mockResolvedValue(null);

      const result = await service.checkUserPermission('nonexistent', 'free');

      expect(result).toBe(false);
    });

    it('应该返回 false 当模型已禁用', async () => {
      mockAiModelRepository.findOne.mockResolvedValue({ ...mockModel, status: 'disabled' });

      const result = await service.checkUserPermission('qwen2.5-72b', 'free');

      expect(result).toBe(false);
    });
  });

  describe('setModelProvider', () => {
    it('应该创建新的模型供应商关联', async () => {
      mockModelProviderRepository.findOne.mockResolvedValue(null);
      mockModelProviderRepository.create.mockReturnValue({
        modelId: 'qwen2.5-72b',
        providerId: 'openai',
        isPrimary: true,
        priority: 1,
      });
      mockModelProviderRepository.save.mockResolvedValue({
        modelId: 'qwen2.5-72b',
        providerId: 'openai',
        isPrimary: true,
        priority: 1,
      });

      const result = await service.setModelProvider('qwen2.5-72b', 'openai', true, 1, 'qwen-max');

      expect(result).toBeDefined();
      expect(result.isPrimary).toBe(true);
    });

    it('应该更新已存在的模型供应商关联', async () => {
      const existing = {
        modelId: 'qwen2.5-72b',
        providerId: 'openai',
        isPrimary: false,
        priority: 2,
      };
      mockModelProviderRepository.findOne.mockResolvedValue(existing);
      mockModelProviderRepository.save.mockResolvedValue({ ...existing, isPrimary: true, priority: 1 });

      const result = await service.setModelProvider('qwen2.5-72b', 'openai', true, 1);

      expect(result.isPrimary).toBe(true);
      expect(result.priority).toBe(1);
    });

    it('设置为主要供应商时应该取消其他主要供应商', async () => {
      mockModelProviderRepository.findOne.mockResolvedValue(null);
      mockModelProviderRepository.create.mockReturnValue({
        modelId: 'qwen2.5-72b',
        providerId: 'openai',
        isPrimary: true,
        priority: 1,
      });
      mockModelProviderRepository.save.mockResolvedValue({
        modelId: 'qwen2.5-72b',
        providerId: 'openai',
        isPrimary: true,
        priority: 1,
      });

      await service.setModelProvider('qwen2.5-72b', 'openai', true, 1);

      expect(mockModelProviderRepository.update).toHaveBeenCalledWith(
        { modelId: 'qwen2.5-72b', isPrimary: true },
        { isPrimary: false }
      );
    });
  });
});
