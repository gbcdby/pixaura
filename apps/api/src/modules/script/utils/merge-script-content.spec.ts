import { mergeScriptContent } from "./merge-script-content";
import type { ScriptContent } from "@pixaura/shared-types";

/**
 * 构造一个最小可用的 ScriptContent 基线，便于在测试中按需改写。
 * 仅放必要字段，schema 上有默认值的可省略；最终返回时 cast 为 ScriptContent。
 */
function makeBaseContent(overrides: Partial<ScriptContent> = {}): ScriptContent {
  return {
    characters: [],
    scenes: [],
    props: [],
    shotGroups: [],
    bgmTracks: [],
    ...overrides,
  } as ScriptContent;
}

describe("mergeScriptContent", () => {
  describe("顶层字段策略", () => {
    it("client 字段：dto 提供则覆盖、未提供则保留 DB", () => {
      const db = makeBaseContent({
        resolution: "9:16",
        genre: "drama",
      });
      const merged = mergeScriptContent(db, { resolution: "16:9" });

      expect(merged.resolution).toBe("16:9");
      expect(merged.genre).toBe("drama"); // dto 未提供，保留 DB
    });

    it("client 字段：dto 显式 undefined 不会覆盖 DB", () => {
      const db = makeBaseContent({ resolution: "9:16" });
      // 模拟客户端漏发 resolution（key 不存在）
      const merged = mergeScriptContent(db, {});
      expect(merged.resolution).toBe("9:16");
    });

    it("db 字段：bgmTracks 始终用 DB 值，dto 提交的会被忽略", () => {
      const dbTracks = [
        {
          id: "bgm-1",
          url: "https://oss/bgm-1.mp3",
          duration: 60,
          mode: "overall" as const,
          source: "ai" as const,
          timelineStart: 0,
          volume: 0.3,
          muted: false,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ];
      const db = makeBaseContent({ bgmTracks: dbTracks });
      const merged = mergeScriptContent(db, {
        bgmTracks: [], // 客户端误传空数组
      });
      expect(merged.bgmTracks).toEqual(dbTracks);
    });

    it("db 字段：客户端不传 bgmTracks 时 DB 值不变", () => {
      const dbTracks = [
        {
          id: "bgm-1",
          url: "https://oss/bgm-1.mp3",
          duration: 60,
          mode: "overall" as const,
          source: "ai" as const,
          timelineStart: 0,
          volume: 0.3,
          muted: false,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ];
      const db = makeBaseContent({ bgmTracks: dbTracks });
      const merged = mergeScriptContent(db, {});
      expect(merged.bgmTracks).toEqual(dbTracks);
    });
  });

  describe("characters keyed-array", () => {
    it("客户端新增 character → 追加保留", () => {
      const db = makeBaseContent({
        characters: [
          {
            id: "c1",
            characterId: "char-1",
            importance: "protagonist",
            assetStatus: "imported",
          } as ScriptContent["characters"][number],
        ],
      });
      const merged = mergeScriptContent(db, {
        characters: [
          {
            id: "c1",
            characterId: "char-1",
            importance: "protagonist",
            assetStatus: "imported",
          },
          {
            id: "c2",
            characterId: "char-2",
            importance: "supporting",
            assetStatus: "will_create",
          },
        ] as ScriptContent["characters"],
      });

      expect(merged.characters).toHaveLength(2);
      expect(merged.characters.map((c) => c.id)).toEqual(["c1", "c2"]);
    });

    it("客户端缺失 id → 视为删除", () => {
      const db = makeBaseContent({
        characters: [
          {
            id: "c1",
            characterId: "char-1",
            importance: "protagonist",
            assetStatus: "imported",
          },
          {
            id: "c2",
            characterId: "char-2",
            importance: "supporting",
            assetStatus: "imported",
          },
        ] as ScriptContent["characters"],
      });
      const merged = mergeScriptContent(db, {
        characters: [
          {
            id: "c1",
            characterId: "char-1",
            importance: "protagonist",
            assetStatus: "imported",
          },
        ] as ScriptContent["characters"],
      });

      expect(merged.characters).toHaveLength(1);
      expect(merged.characters[0].id).toBe("c1");
    });

    it("客户端 reorder → 输出顺序跟随 client", () => {
      const db = makeBaseContent({
        characters: [
          {
            id: "c1",
            characterId: "char-1",
            importance: "protagonist",
            assetStatus: "imported",
          },
          {
            id: "c2",
            characterId: "char-2",
            importance: "supporting",
            assetStatus: "imported",
          },
        ] as ScriptContent["characters"],
      });
      const merged = mergeScriptContent(db, {
        characters: [
          {
            id: "c2",
            characterId: "char-2",
            importance: "supporting",
            assetStatus: "imported",
          },
          {
            id: "c1",
            characterId: "char-1",
            importance: "protagonist",
            assetStatus: "imported",
          },
        ] as ScriptContent["characters"],
      });
      expect(merged.characters.map((c) => c.id)).toEqual(["c2", "c1"]);
    });
  });

  describe("shotGroups keyed-array + 字段级合并", () => {
    /**
     * 构造一个完整 shotGroup，便于在测试中按字段重写。
     * 用类型断言绕过 schema 默认值，因 makeShotGroup 仅供测试快速构造。
     */
    function makeShotGroup(
      id: string,
      overrides: Record<string, unknown> = {},
    ): ScriptContent["shotGroups"][number] {
      return {
        id,
        sequenceNumber: 1,
        description: "测试分镜组",
        mainImageVersion: 0,
        detectionStatus: "pending",
        characterRegions: {},
        characterIds: [],
        propIds: [],
        dialogues: [],
        shots: [],
        referenceMode: "multi_reference",
        duration: 3,
        ...overrides,
      } as ScriptContent["shotGroups"][number];
    }

    it("用户改 title + WS 同时写 shots[0].videoUrl → 两者都保留", () => {
      // DB 状态：WS 刚把 shots[0].videoUrl 写进去
      const db = makeBaseContent({
        shotGroups: [
          makeShotGroup("sg1", {
            title: "旧标题",
            shots: [
              {
                id: "s1",
                dialogueId: "d1",
                status: "completed",
                taskId: "task-x",
                videoUrl: "https://oss/v1.mp4",
              },
            ],
          }),
        ],
      });
      // 客户端基于"WS 写入前"的快照，把 title 改了，shots[0] 上还没有 videoUrl
      const merged = mergeScriptContent(db, {
        shotGroups: [
          makeShotGroup("sg1", {
            title: "新标题",
            shots: [
              {
                id: "s1",
                dialogueId: "d1",
                status: "pending",
                // 客户端没有 videoUrl
              },
            ],
          }),
        ],
      });

      const sg = merged.shotGroups[0];
      expect(sg.title).toBe("新标题"); // client
      expect(sg.shots[0].videoUrl).toBe("https://oss/v1.mp4"); // db
      expect(sg.shots[0].status).toBe("completed"); // db
      expect(sg.shots[0].taskId).toBe("task-x"); // db
    });

    it("用户删除 shotGroup + WS 同时写该组 video → 该组被删除（用户优先）", () => {
      const db = makeBaseContent({
        shotGroups: [
          makeShotGroup("sg1", {
            title: "组1",
            video: {
              status: "completed",
              taskId: "vt-1",
              url: "https://oss/sg1.mp4",
            },
          }),
          makeShotGroup("sg2", { title: "组2" }),
        ],
      });
      // 客户端删除了 sg1
      const merged = mergeScriptContent(db, {
        shotGroups: [makeShotGroup("sg2", { title: "组2" })],
      });

      expect(merged.shotGroups).toHaveLength(1);
      expect(merged.shotGroups[0].id).toBe("sg2");
    });

    it("WS 写入 shotGroup 的 mainImageId/images 不被 client PUT 覆盖", () => {
      const dbImages = [
        {
          id: "img-1",
          url: "https://oss/img-1.png",
          type: "main" as const,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ];
      const db = makeBaseContent({
        shotGroups: [
          makeShotGroup("sg1", {
            title: "原标题",
            mainImageId: "img-1",
            mainImageKey: "shotgroups/sg1/main.png",
            images: dbImages,
            detectionStatus: "completed",
            detectedSubjects: [
              {
                index: 1,
                region: { x: 0, y: 0, width: 0.5, height: 0.5 },
              },
            ],
          }),
        ],
      });
      // 客户端只改了 title，没有 mainImageId / images / detection 字段
      const merged = mergeScriptContent(db, {
        shotGroups: [
          makeShotGroup("sg1", {
            title: "新标题",
            // 模拟客户端发了空 images，但 db-only 策略应该忽略
            images: [],
            mainImageId: undefined,
          }),
        ],
      });

      const sg = merged.shotGroups[0];
      expect(sg.title).toBe("新标题");
      expect(sg.mainImageId).toBe("img-1");
      expect(sg.mainImageKey).toBe("shotgroups/sg1/main.png");
      expect(sg.images).toEqual(dbImages);
      expect(sg.detectionStatus).toBe("completed");
      expect(sg.detectedSubjects).toHaveLength(1);
    });

    it("client 把 shot.videoUrl 改成空串 → 仍保留 DB（db 优先）", () => {
      const db = makeBaseContent({
        shotGroups: [
          makeShotGroup("sg1", {
            shots: [
              {
                id: "s1",
                dialogueId: "d1",
                status: "completed",
                videoUrl: "https://oss/v1.mp4",
              },
            ],
          }),
        ],
      });
      const merged = mergeScriptContent(db, {
        shotGroups: [
          makeShotGroup("sg1", {
            shots: [
              {
                id: "s1",
                dialogueId: "d1",
                status: "pending",
                videoUrl: "", // 客户端误改/恶意改
              },
            ],
          }),
        ],
      });

      const shot = merged.shotGroups[0].shots[0];
      expect(shot.videoUrl).toBe("https://oss/v1.mp4");
      expect(shot.status).toBe("completed");
    });

    it("WS 写 dialogue.audioUrl 不被 client PUT 覆盖；client 改 text 同时生效", () => {
      const db = makeBaseContent({
        shotGroups: [
          makeShotGroup("sg1", {
            dialogues: [
              {
                id: "d1",
                characterName: "小明",
                text: "原台词",
                isVoiceover: false,
                audioUrl: "https://oss/d1.mp3",
                audioStatus: "completed",
                audioDuration: 1.5,
              },
            ],
          }),
        ],
      });
      const merged = mergeScriptContent(db, {
        shotGroups: [
          makeShotGroup("sg1", {
            dialogues: [
              {
                id: "d1",
                characterName: "小明",
                text: "改后的台词",
                isVoiceover: false,
                // 客户端没拿到 audio* 字段
              },
            ],
          }),
        ],
      });

      const d = merged.shotGroups[0].dialogues[0];
      expect(d.text).toBe("改后的台词"); // client
      expect(d.audioUrl).toBe("https://oss/d1.mp3"); // db
      expect(d.audioStatus).toBe("completed"); // db
      expect(d.audioDuration).toBe(1.5); // db
    });

    it("client 新增 dialogue → 追加保留", () => {
      const db = makeBaseContent({
        shotGroups: [
          makeShotGroup("sg1", {
            dialogues: [
              {
                id: "d1",
                characterName: "小明",
                text: "你好",
                isVoiceover: false,
              },
            ],
          }),
        ],
      });
      const merged = mergeScriptContent(db, {
        shotGroups: [
          makeShotGroup("sg1", {
            dialogues: [
              {
                id: "d1",
                characterName: "小明",
                text: "你好",
                isVoiceover: false,
              },
              {
                id: "d2",
                characterName: "小红",
                text: "你也好",
                isVoiceover: false,
              },
            ],
          }),
        ],
      });

      expect(merged.shotGroups[0].dialogues).toHaveLength(2);
    });

    it("client 删除 dialogue → 该 dialogue 被删除", () => {
      const db = makeBaseContent({
        shotGroups: [
          makeShotGroup("sg1", {
            dialogues: [
              {
                id: "d1",
                characterName: "小明",
                text: "你好",
                isVoiceover: false,
                audioUrl: "https://oss/d1.mp3",
              },
              {
                id: "d2",
                characterName: "小红",
                text: "再见",
                isVoiceover: false,
              },
            ],
          }),
        ],
      });
      const merged = mergeScriptContent(db, {
        shotGroups: [
          makeShotGroup("sg1", {
            dialogues: [
              {
                id: "d1",
                characterName: "小明",
                text: "你好",
                isVoiceover: false,
              },
            ],
          }),
        ],
      });

      const dlg = merged.shotGroups[0].dialogues;
      expect(dlg).toHaveLength(1);
      expect(dlg[0].id).toBe("d1");
      expect(dlg[0].audioUrl).toBe("https://oss/d1.mp3"); // 保留 DB 字段
    });

    it("client 提供 modelId/duration/videoMode → client 覆盖", () => {
      const db = makeBaseContent({
        shotGroups: [
          makeShotGroup("sg1", {
            duration: 3,
            videoMode: "video_only",
            imageModelId: "img-old",
            videoModelId: "vid-old",
          }),
        ],
      });
      const merged = mergeScriptContent(db, {
        shotGroups: [
          makeShotGroup("sg1", {
            duration: 5,
            videoMode: "lip_sync",
            imageModelId: "img-new",
            videoModelId: "vid-new",
            lipSyncModelId: "ls-new",
          }),
        ],
      });
      const sg = merged.shotGroups[0];
      expect(sg.duration).toBe(5);
      expect(sg.videoMode).toBe("lip_sync");
      expect(sg.imageModelId).toBe("img-new");
      expect(sg.videoModelId).toBe("vid-new");
      expect(sg.lipSyncModelId).toBe("ls-new");
    });
  });

  describe("不变性", () => {
    it("不修改入参（DB 与 client 都不被改写）", () => {
      const db = makeBaseContent({
        resolution: "9:16",
        characters: [
          {
            id: "c1",
            characterId: "char-1",
            importance: "protagonist",
            assetStatus: "imported",
          },
        ] as ScriptContent["characters"],
      });
      const dbSnapshot = JSON.parse(JSON.stringify(db));
      const client = { resolution: "16:9" };
      const clientSnapshot = JSON.parse(JSON.stringify(client));

      mergeScriptContent(db, client);

      expect(db).toEqual(dbSnapshot);
      expect(client).toEqual(clientSnapshot);
    });
  });
});
