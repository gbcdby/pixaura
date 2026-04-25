import { MigrateStoryboardsToShotGroups1774000000000 } from '../../src/database/migrations/1774000000000-MigrateStoryboardsToShotGroups';

describe('MigrateStoryboardsToShotGroups', () => {
  let migration: MigrateStoryboardsToShotGroups1774000000000;

  // Mock QueryRunner
  const mockQueryRunner = {
    query: jest.fn(),
  };

  beforeEach(() => {
    migration = new MigrateStoryboardsToShotGroups1774000000000();
    jest.clearAllMocks();
  });

  describe('up', () => {
    it('应该跳过没有 content 的剧本', async () => {
      mockQueryRunner.query.mockResolvedValueOnce([
        { id: 'script-1', content: null },
      ]);

      await migration.up(mockQueryRunner as any);

      // 只调用一次 SELECT，不调用 UPDATE
      expect(mockQueryRunner.query).toHaveBeenCalledTimes(1);
    });

    it('应该跳过没有 storyboards 的剧本', async () => {
      mockQueryRunner.query.mockResolvedValueOnce([
        { id: 'script-1', content: { characters: [] } },
      ]);

      await migration.up(mockQueryRunner as any);

      expect(mockQueryRunner.query).toHaveBeenCalledTimes(1);
    });

    it('应该跳过已有 shotGroups 的剧本', async () => {
      mockQueryRunner.query.mockResolvedValueOnce([
        {
          id: 'script-1',
          content: {
            storyboards: [{ id: 'sb-1' }],
            shotGroups: [{ id: 'sg-1' }],
          },
        },
      ]);

      await migration.up(mockQueryRunner as any);

      expect(mockQueryRunner.query).toHaveBeenCalledTimes(1);
    });

    it('应该正确转换单个 storyboard 为 shotGroup', async () => {
      const mockStoryboard = {
        id: 'sb-1',
        sequenceNumber: 1,
        title: '开场',
        description: '主角出场',
        characterIds: ['char-1'],
        sceneId: 'scene-1',
        propIds: ['prop-1'],
        dialogues: [
          {
            id: 'dialogue-1',
            characterId: 'char-1',
            characterName: '小明',
            text: '你好',
          },
        ],
        referenceMode: 'multi_reference',
        imageModelId: 'img-model-1',
        videoModelId: 'video-model-1',
        images: [{ id: 'img-1', url: 'http://example.com/img.jpg' }],
        mainImageId: 'img-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockQueryRunner.query
        .mockResolvedValueOnce([
          { id: 'script-1', content: { storyboards: [mockStoryboard] } },
        ])
        .mockResolvedValueOnce(undefined);

      await migration.up(mockQueryRunner as any);

      // 验证 UPDATE 调用
      expect(mockQueryRunner.query).toHaveBeenCalledTimes(2);
      const updateCall = mockQueryRunner.query.mock.calls[1];
      expect(updateCall[0]).toContain('UPDATE scripts SET content');

      // 解析更新的 content
      const updatedContent = JSON.parse(updateCall[1][0]);
      expect(updatedContent.shotGroups).toHaveLength(1);

      const shotGroup = updatedContent.shotGroups[0];
      expect(shotGroup.id).toBe('sb-1');
      expect(shotGroup.sequenceNumber).toBe(1);
      expect(shotGroup.title).toBe('开场');
      expect(shotGroup.description).toBe('主角出场');
      expect(shotGroup.characterIds).toEqual(['char-1']);
      expect(shotGroup.sceneId).toBe('scene-1');
      expect(shotGroup.propIds).toEqual(['prop-1']);
      expect(shotGroup.dialogues).toHaveLength(1);
      expect(shotGroup.shots).toHaveLength(1);
      expect(shotGroup.shots[0].dialogueId).toBe('dialogue-1');
      expect(shotGroup.referenceMode).toBe('multi_reference');
      expect(shotGroup.detectionStatus).toBe('pending');
      expect(shotGroup.characterRegions).toEqual({});
    });

    it('应该正确迁移 videoMode 值', async () => {
      const mockStoryboard = {
        id: 'sb-1',
        sequenceNumber: 1,
        description: '测试',
        dialogues: [
          { id: 'd-1', videoMode: 'audio_driven' },
          { id: 'd-2', videoMode: 'video_first' },
          { id: 'd-3', videoMode: 'video_only' },
          { id: 'd-4', videoMode: 'audio_reference' },
          { id: 'd-5', videoMode: 'lip_sync' },
        ],
      };

      mockQueryRunner.query
        .mockResolvedValueOnce([
          { id: 'script-1', content: { storyboards: [mockStoryboard] } },
        ])
        .mockResolvedValueOnce(undefined);

      await migration.up(mockQueryRunner as any);

      const updateCall = mockQueryRunner.query.mock.calls[1];
      const updatedContent = JSON.parse(updateCall[1][0]);
      const shots = updatedContent.shotGroups[0].shots;

      // 验证 videoMode 映射
      expect(shots[0].videoMode).toBe('audio_reference'); // audio_driven → audio_reference
      expect(shots[1].videoMode).toBe('lip_sync'); // video_first → lip_sync
      expect(shots[2].videoMode).toBe('video_only'); // video_only → video_only
      expect(shots[3].videoMode).toBe('audio_reference'); // audio_reference → audio_reference
      expect(shots[4].videoMode).toBe('lip_sync'); // lip_sync → lip_sync
    });

    it('应该处理没有 dialogues 的 storyboard', async () => {
      const mockStoryboard = {
        id: 'sb-1',
        sequenceNumber: 1,
        description: '无对话场景',
        dialogues: [],
      };

      mockQueryRunner.query
        .mockResolvedValueOnce([
          { id: 'script-1', content: { storyboards: [mockStoryboard] } },
        ])
        .mockResolvedValueOnce(undefined);

      await migration.up(mockQueryRunner as any);

      const updateCall = mockQueryRunner.query.mock.calls[1];
      const updatedContent = JSON.parse(updateCall[1][0]);

      expect(updatedContent.shotGroups[0].shots).toHaveLength(0);
      expect(updatedContent.shotGroups[0].dialogues).toEqual([]);
    });

    it('应该迁移 images 和 videoGeneration 字段', async () => {
      const mockStoryboard = {
        id: 'sb-1',
        sequenceNumber: 1,
        description: '测试',
        images: [{ id: 'img-1', url: 'http://example.com/img.jpg' }],
        mainImageId: 'img-1',
        videoGeneration: {
          prompt: 'test prompt',
          status: 'completed',
          videoUrl: 'http://example.com/video.mp4',
        },
      };

      mockQueryRunner.query
        .mockResolvedValueOnce([
          { id: 'script-1', content: { storyboards: [mockStoryboard] } },
        ])
        .mockResolvedValueOnce(undefined);

      await migration.up(mockQueryRunner as any);

      const updateCall = mockQueryRunner.query.mock.calls[1];
      const updatedContent = JSON.parse(updateCall[1][0]);
      const shotGroup = updatedContent.shotGroups[0];

      expect(shotGroup.images).toEqual(mockStoryboard.images);
      expect(shotGroup.mainImageId).toBe('img-1');
      expect(shotGroup.videoGeneration).toEqual(mockStoryboard.videoGeneration);
    });

    it('应该处理多个剧本', async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce([
          {
            id: 'script-1',
            content: { storyboards: [{ id: 'sb-1', sequenceNumber: 1, description: 'A' }] },
          },
          {
            id: 'script-2',
            content: { storyboards: [{ id: 'sb-2', sequenceNumber: 1, description: 'B' }] },
          },
        ])
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      await migration.up(mockQueryRunner as any);

      // 1 SELECT + 2 UPDATE
      expect(mockQueryRunner.query).toHaveBeenCalledTimes(3);
    });
  });

  describe('down', () => {
    it('应该移除 shotGroups 字段', async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce([
          {
            id: 'script-1',
            content: {
              storyboards: [{ id: 'sb-1' }],
              shotGroups: [{ id: 'sg-1' }],
            },
          },
        ])
        .mockResolvedValueOnce(undefined);

      await migration.down(mockQueryRunner as any);

      const updateCall = mockQueryRunner.query.mock.calls[1];
      const updatedContent = JSON.parse(updateCall[1][0]);

      expect(updatedContent.shotGroups).toBeUndefined();
      expect(updatedContent.storyboards).toBeDefined();
    });

    it('应该跳过没有 shotGroups 的剧本', async () => {
      mockQueryRunner.query.mockResolvedValueOnce([
        { id: 'script-1', content: { storyboards: [{ id: 'sb-1' }] } },
      ]);

      await migration.down(mockQueryRunner as any);

      expect(mockQueryRunner.query).toHaveBeenCalledTimes(1);
    });
  });
});