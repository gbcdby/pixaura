import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { VideoGenService } from '../../src/modules/video-gen/services/video-gen.service';
import { VideoGenerationTask } from '../../src/modules/video-gen/entities/video-generation-task.entity';
import { VideoGenerationOutput } from '../../src/modules/video-gen/entities/video-generation-output.entity';
import { VideoGenTaskStatus } from '../../src/modules/video-gen/entities/video-generation-task.entity';
import {
  CreateVideoGenTaskDto,
  CreateBatchVideoGenDto,
  RetryVideoGenTaskDto,
  VideoMode,
  ReferenceMode,
} from '@pixaura/shared-types';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';

describe('VideoGenService', () => {
  let service: VideoGenService;
  let taskRepository: Repository<VideoGenerationTask>;
  let outputRepository: Repository<VideoGenerationOutput>;
  let dataSource: DataSource;

  const mockTaskRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const mockOutputRepository = {
    find: jest.fn(),
  };

  const mockDataSource = {
    getRepository: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VideoGenService,
        {
          provide: getRepositoryToken(VideoGenerationTask),
          useValue: mockTaskRepository,
        },
        {
          provide: getRepositoryToken(VideoGenerationOutput),
          useValue: mockOutputRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<VideoGenService>(VideoGenService);
    taskRepository = module.get<Repository<VideoGenerationTask>>(
      getRepositoryToken(VideoGenerationTask),
    );
    outputRepository = module.get<Repository<VideoGenerationOutput>>(
      getRepositoryToken(VideoGenerationOutput),
    );
    dataSource = module.get<DataSource>(DataSource);

    jest.clearAllMocks();
  });

  describe('createTask', () => {
    const createMockDto = (): CreateVideoGenTaskDto => ({
      projectId: 'proj_123',
      shotId: 'shot_456',
      config: {
        referenceMode: ReferenceMode.MULTI_REFERENCE,
        videoMode: VideoMode.AUDIO_REFERENCE,
        modelId: 'model_1',
        shotData: {
          briefDescription: '测试描述',
          detailedDescription: '详细描述',
          sequence: [
            {
              timeStart: 0,
              timeEnd: 5,
              description: '测试序列',
              dialogue: {
                speaker: '主角',
                speakerId: 'char_1',
                text: '测试对话',
                emotion: '平静',
              },
            },
          ],
          references: {
            characters: [{ id: 'char_1', name: '主角' }],
            scenes: [],
            props: [],
          },
        },
        outputConfig: {
          resolution: '720p',
          aspectRatio: '9:16',
        },
      },
      notifyWs: true,
    });

    it('should create a task successfully', async () => {
      const mockDto = createMockDto();
      mockTaskRepository.findOne.mockResolvedValue(null);
      mockTaskRepository.create.mockReturnValue({
        ...mockDto,
        id: 'task_123',
        status: VideoGenTaskStatus.PENDING,
      });
      mockTaskRepository.save.mockResolvedValue({
        id: 'task_123',
        status: VideoGenTaskStatus.PENDING,
        projectId: mockDto.projectId,
        shotId: mockDto.shotId,
        config: mockDto.config,
        progress: {
          currentStep: '',
          percentage: 0,
          steps: [
            { name: 'prepare', label: '准备数据', status: 'pending', progress: 0 },
            { name: 'tts', label: '生成音频', status: 'pending', progress: 0 },
            { name: 'video', label: '生成视频', status: 'pending', progress: 0 },
            { name: 'sync', label: '音画同步', status: 'pending', progress: 0 },
          ],
        },
        cost: {
          estimatedCost: 500,
          actualCost: 0,
          currency: 'CNY',
        },
      });

      const result = await service.createTask('user_123', mockDto);

      expect(result.taskId).toBeDefined();
      expect(result.status).toBe(VideoGenTaskStatus.PENDING);
      expect(result.estimatedCost).toBe(500);
      expect(result.estimatedTime).toBe(120);
      expect(result.steps).toHaveLength(4);
      expect(mockTaskRepository.save).toHaveBeenCalled();
    });

    it('should throw error if task already exists', async () => {
      mockTaskRepository.findOne.mockResolvedValue({
        id: 'existing_task',
        status: VideoGenTaskStatus.PENDING,
      });

      await expect(service.createTask('user_123', createMockDto())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create task with correct steps for video_first mode', async () => {
      const baseDto = createMockDto();
      const videoFirstDto: CreateVideoGenTaskDto = {
        ...baseDto,
        config: {
          ...baseDto.config,
          videoMode: VideoMode.LIP_SYNC,
          outputConfig: {
            ...baseDto.config.outputConfig,
            resolution: '1080p' as const,
          },
        },
      };

      mockTaskRepository.findOne.mockResolvedValue(null);
      mockTaskRepository.create.mockReturnValue({
        ...videoFirstDto,
        id: 'task_124',
        status: VideoGenTaskStatus.PENDING,
      });
      mockTaskRepository.save.mockResolvedValue({
        id: 'task_124',
        status: VideoGenTaskStatus.PENDING,
        config: videoFirstDto.config,
        progress: {
          steps: [
            { name: 'prepare', label: '准备数据', status: 'pending', progress: 0 },
            { name: 'video_silent', label: '生成无声视频', status: 'pending', progress: 0 },
            { name: 'tts', label: '生成音频', status: 'pending', progress: 0 },
            { name: 'lip_sync', label: '对口型处理', status: 'pending', progress: 0 },
          ],
        },
        cost: { estimatedCost: 1000, actualCost: 0, currency: 'CNY' },
      });

      const result = await service.createTask('user_123', videoFirstDto);

      expect(result.estimatedCost).toBe(1000);
      expect(result.steps.map(s => s.name)).toEqual([
        'prepare', 'video_silent', 'tts', 'lip_sync',
      ]);
    });

    it('should create task with correct steps for video_only mode', async () => {
      const baseDto = createMockDto();
      const videoOnlyDto: CreateVideoGenTaskDto = {
        ...baseDto,
        config: {
          ...baseDto.config,
          videoMode: VideoMode.VIDEO_ONLY,
          outputConfig: {
            ...baseDto.config.outputConfig,
            resolution: '480p' as const,
          },
        },
      };

      mockTaskRepository.findOne.mockResolvedValue(null);
      mockTaskRepository.create.mockReturnValue({
        ...videoOnlyDto,
        id: 'task_125',
        status: VideoGenTaskStatus.PENDING,
      });
      mockTaskRepository.save.mockResolvedValue({
        id: 'task_125',
        status: VideoGenTaskStatus.PENDING,
        config: videoOnlyDto.config,
        progress: {
          steps: [
            { name: 'prepare', label: '准备数据', status: 'pending', progress: 0 },
            { name: 'video', label: '生成视频', status: 'pending', progress: 0 },
          ],
        },
        cost: { estimatedCost: 250, actualCost: 0, currency: 'CNY' },
      });

      const result = await service.createTask('user_123', videoOnlyDto);

      expect(result.estimatedCost).toBe(250);
      expect(result.steps.map(s => s.name)).toEqual(['prepare', 'video']);
    });
  });

  describe('createBatchTasks', () => {
    const createMockBatchDto = (): CreateBatchVideoGenDto => ({
      projectId: 'proj_123',
      notifyWs: true,
      shots: [
        {
          shotId: 'shot_1',
          config: {
            referenceMode: ReferenceMode.MULTI_REFERENCE,
            videoMode: VideoMode.AUDIO_REFERENCE,
            shotData: {
              briefDescription: '测试',
              detailedDescription: '测试详细',
              sequence: [],
              references: { characters: [], scenes: [], props: [] },
            },
            outputConfig: { resolution: '720p' as const, aspectRatio: '9:16' as const },
          },
        },
      ],
      commonConfig: {
        modelId: 'model_1',
        outputConfig: { resolution: '720p' },
      },
    });

    it('should throw error if shots exceed 10', async () => {
      const baseDto = createMockBatchDto();
      const tooManyShotsDto: CreateBatchVideoGenDto = {
        ...baseDto,
        shots: Array(11).fill(baseDto.shots[0]),
      };

      await expect(service.createBatchTasks('user_123', tooManyShotsDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create batch tasks successfully', async () => {
      const mockBatchDto = createMockBatchDto();
      const mockBatchRepo = {
        save: jest.fn().mockResolvedValue({ id: 'batch_123' }),
      };
      mockDataSource.getRepository.mockReturnValue(mockBatchRepo);
      mockTaskRepository.findOne.mockResolvedValue(null);
      mockTaskRepository.create.mockReturnValue({
        id: 'task_1',
        status: VideoGenTaskStatus.PENDING,
      });
      mockTaskRepository.save.mockResolvedValue({
        id: 'task_1',
        status: VideoGenTaskStatus.PENDING,
      });

      const result = await service.createBatchTasks('user_123', mockBatchDto);

      expect(result.batchId).toBe('batch_123');
      expect(result.tasks).toHaveLength(1);
      expect(result.totalCost).toBeDefined();
    });
  });

  describe('findById', () => {
    it('should return task details', async () => {
      const mockTask = {
        id: 'task_123',
        projectId: 'proj_123',
        shotId: 'shot_456',
        status: VideoGenTaskStatus.COMPLETED,
        config: {},
        progress: { percentage: 100 },
        outputs: [],
        cost: { estimatedCost: 500, actualCost: 500 },
        createdAt: new Date(),
        createdBy: 'user_123',
      };

      mockTaskRepository.findOne.mockResolvedValue(mockTask);

      const result = await service.findById('task_123', 'user_123');

      expect(result.id).toBe('task_123');
      expect(result.status).toBe(VideoGenTaskStatus.COMPLETED);
    });

    it('should throw NotFoundException if task not found', async () => {
      mockTaskRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('nonexistent', 'user_123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user has no permission', async () => {
      const mockTask = {
        id: 'task_123',
        createdBy: 'other_user',
      };

      mockTaskRepository.findOne.mockResolvedValue(mockTask);

      await expect(service.findById('task_123', 'user_123')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('cancelTask', () => {
    it('should cancel pending task', async () => {
      const mockTask = {
        id: 'task_123',
        status: VideoGenTaskStatus.PENDING,
        createdBy: 'user_123',
        cost: { estimatedCost: 500 },
      };

      mockTaskRepository.findOne.mockResolvedValue(mockTask);
      mockTaskRepository.update.mockResolvedValue({});

      const result = await service.cancelTask('task_123', 'user_123');

      expect(result.status).toBe(VideoGenTaskStatus.CANCELLED);
      expect(result.refundAmount).toBe(500);
    });

    it('should cancel generating task with cancelling status', async () => {
      const mockTask = {
        id: 'task_123',
        status: VideoGenTaskStatus.GENERATING,
        createdBy: 'user_123',
        cost: { estimatedCost: 500 },
      };

      mockTaskRepository.findOne.mockResolvedValue(mockTask);
      mockTaskRepository.update.mockResolvedValue({});

      const result = await service.cancelTask('task_123', 'user_123');

      expect(result.status).toBe('cancelling');
    });

    it('should throw error for completed task', async () => {
      const mockTask = {
        id: 'task_123',
        status: VideoGenTaskStatus.COMPLETED,
        createdBy: 'user_123',
      };

      mockTaskRepository.findOne.mockResolvedValue(mockTask);

      await expect(service.cancelTask('task_123', 'user_123')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('retryTask', () => {
    it('should retry failed task', async () => {
      const mockTask = {
        id: 'task_123',
        status: VideoGenTaskStatus.FAILED,
        createdBy: 'user_123',
        config: {
          videoMode: VideoMode.AUDIO_REFERENCE,
          outputConfig: {
            resolution: '720p',
            aspectRatio: '9:16',
          },
        },
        error: { code: 1, message: 'Failed' },
        progress: { percentage: 50 },
      };

      mockTaskRepository.findOne.mockResolvedValue(mockTask);
      mockTaskRepository.save.mockResolvedValue({
        ...mockTask,
        status: VideoGenTaskStatus.PENDING,
      });

      const dto: RetryVideoGenTaskDto = {
        overrideConfig: {
          modelId: 'new_model',
          outputConfig: { resolution: '1080p' },
        },
      };

      const result = await service.retryTask('task_123', 'user_123', dto);

      expect(result.status).toBe(VideoGenTaskStatus.PENDING);
      expect(result.message).toBe('任务已重新提交');
    });

    it('should throw error for non-failed/non-cancelled task', async () => {
      const mockTask = {
        id: 'task_123',
        status: VideoGenTaskStatus.PENDING,
        createdBy: 'user_123',
      };

      mockTaskRepository.findOne.mockResolvedValue(mockTask);

      await expect(service.retryTask('task_123', 'user_123')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findActiveTasksByProject', () => {
    it('should return active tasks', async () => {
      const mockTasks = [
        {
          id: 'task_1',
          status: VideoGenTaskStatus.PENDING,
          config: {},
          progress: {},
          cost: {},
          createdAt: new Date(),
        },
        {
          id: 'task_2',
          status: VideoGenTaskStatus.GENERATING,
          config: {},
          progress: {},
          cost: {},
          createdAt: new Date(),
        },
      ];

      mockTaskRepository.find.mockResolvedValue(mockTasks);

      const result = await service.findActiveTasksByProject('proj_123');

      expect(result).toHaveLength(2);
      expect(mockTaskRepository.find).toHaveBeenCalledWith({
        where: {
          projectId: 'proj_123',
          status: expect.any(Object),
          deletedAt: expect.any(Object),
        },
        relations: ['outputs'],
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('cost calculation', () => {
    it('should calculate correct cost for different resolutions', async () => {
      mockTaskRepository.findOne.mockResolvedValue(null);

      const testCases = [
        { resolution: '480p' as const, expectedCost: 250 },
        { resolution: '720p' as const, expectedCost: 500 },
        { resolution: '1080p' as const, expectedCost: 1000 },
      ];

      for (const testCase of testCases) {
        mockTaskRepository.create.mockReturnValue({
          id: `task_${testCase.resolution}`,
          status: VideoGenTaskStatus.PENDING,
        });
        mockTaskRepository.save.mockResolvedValue({
          id: `task_${testCase.resolution}`,
          status: VideoGenTaskStatus.PENDING,
          cost: { estimatedCost: testCase.expectedCost },
        });

        const dto: CreateVideoGenTaskDto = {
          projectId: 'proj_123',
          shotId: 'shot_456',
          notifyWs: true,
          config: {
            referenceMode: ReferenceMode.MULTI_REFERENCE,
            videoMode: VideoMode.AUDIO_REFERENCE,
            shotData: {
              briefDescription: '测试',
              detailedDescription: '详细描述',
              sequence: [],
              references: { characters: [], scenes: [], props: [] },
            },
            outputConfig: {
              resolution: testCase.resolution,
              aspectRatio: '9:16',
            },
          },
        };

        const result = await service.createTask('user_123', dto);
        expect(result.estimatedCost).toBe(testCase.expectedCost);
      }
    });
  });
});
