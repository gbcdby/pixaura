/**
 * 剧本 content 字段级合并工具
 *
 * 背景：所有步骤共用 PUT /scripts/:id 接口，客户端总是发整份 ScriptContent。
 *      若直接整段覆盖，会造成两类竞态问题：
 *      1) WS 任务回调写入的字段（videoUrl / mainImageId / images 等）被前端 PUT 回滚；
 *      2) 跨设备/跨标签页同时编辑不同字段时，后写覆盖前写。
 *
 * 解决：updateScript 改为"读-合并-写"——拿到 DB 当前 content，与客户端 dto 按字段策略合并。
 *      策略分三类：
 *        - "client"：客户端 dto 中存在则用 dto，否则保留 DB；
 *        - "db"：始终保留 DB 当前值，客户端提交的会被忽略（WS 写入不被前端覆盖）；
 *        - "keyed-array"：按 id 取并集，
 *            * 客户端缺失的 id => 视为用户主动删除；
 *            * 客户端新增的 id => 直接追加；
 *            * 已存在的 id => 递归字段级合并。
 *
 * 注意：本工具仅维护合并语义，**调用方仍需做 Zod 校验**。所有"deep clone"通过 JSON 序列化完成，
 *      因此 ScriptContent 内不能出现 Date/Map/Set 等非 JSON 友好结构（实际 schema 也都是平凡 JSON）。
 */

import type { ScriptContent } from "@pixaura/shared-types";

// ============================================================
// 字段策略表
// ============================================================

type Policy = "client" | "db" | "keyed-array";

const TOP_LEVEL_POLICY: Record<string, Policy> = {
  // 资源引用：keyed-array
  characters: "keyed-array",
  scenes: "keyed-array",
  props: "keyed-array",
  shotGroups: "keyed-array",
  // BGM 由专用端点维护，updateScript 不动
  bgmTracks: "db",
  // 创作设置 / 步骤设置：客户端唯一来源
  resolution: "client",
  genre: "client",
  narrationVoiceId: "client",
  narrationInstructions: "client",
  shotGroupSettings: "client",
  scriptSettings: "client",
  characterSettings: "client",
  sceneSettings: "client",
  propSettings: "client",
  bgmSettings: "client",
  audioVolumeConfig: "client",
};

const SHOT_GROUP_POLICY: Record<string, Policy> = {
  // 后端 worker / WS 维护
  mainImageId: "db",
  mainImageKey: "db",
  mainImageVersion: "db",
  images: "db",
  detectionStatus: "db",
  detectionError: "db",
  detectedSubjects: "db",
  video: "db",
  // 数组按 id 合并
  shots: "keyed-array",
  dialogues: "keyed-array",
  // 客户端编辑
  id: "client",
  sequenceNumber: "client",
  title: "client",
  description: "client",
  characterIds: "client",
  sceneId: "client",
  propIds: "client",
  videoMode: "client",
  referenceMode: "client",
  duration: "client",
  imageModelId: "client",
  videoModelId: "client",
  lipSyncModelId: "client",
  characterRegions: "client",
  mode: "client",
  createdAt: "client",
  updatedAt: "client",
};

const SHOT_POLICY: Record<string, Policy> = {
  videoUrl: "db",
  audioUrl: "db",
  status: "db",
  taskId: "db",
  id: "client",
  dialogueId: "client",
};

const DIALOGUE_POLICY: Record<string, Policy> = {
  audioUrl: "db",
  audioDuration: "db",
  audioStatus: "db",
  audioTaskId: "db",
  // 其余字段（id / characterId / characterName / text / emotion / actions / isVoiceover /
  // voiceId / instructions / characterRegions）默认 client
};

// 资源引用（character/scene/prop ref）所有字段都由客户端控制
// 不需要专门策略表，使用 mergeAssetRef 默认 client-wins

// ============================================================
// 工具函数
// ============================================================

type AnyRecord = Record<string, unknown>;

function isObject(value: unknown): value is AnyRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepClone<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * 通用按策略合并：
 * - 未知字段（不在 policy 中）：默认按 "client" 处理（客户端有就覆盖、没就保留 DB）
 * - "client"：dto 中字段存在则用 dto[key]，否则用 db[key]
 * - "db"：始终用 db[key]，无视 dto
 * - "keyed-array"：调用方负责传 keyedArrayMergers[key]，否则按 client 兜底
 */
function mergeByPolicy<T extends AnyRecord>(
  db: T | undefined,
  client: T | undefined,
  policy: Record<string, Policy>,
  keyedArrayMergers: Record<
    string,
    (
      dbArr: AnyRecord[] | undefined,
      clientArr: AnyRecord[] | undefined,
    ) => AnyRecord[]
  > = {},
): T {
  // 两边都缺：返回空对象（理论上调用方会避免这种情况）
  if (!db && !client) return {} as T;
  // 缺 DB：客户端值即结果
  if (!db) return deepClone(client) as T;
  // 缺客户端：DB 值即结果
  if (!client) return deepClone(db) as T;

  const result: AnyRecord = {};
  // 收集两边所有 key（保证不丢字段）
  const keys = new Set<string>([...Object.keys(db), ...Object.keys(client)]);

  for (const key of keys) {
    const fieldPolicy = policy[key] ?? "client";
    if (fieldPolicy === "db") {
      // 始终用 DB（包括 db[key] === undefined 的情况，避免无意义占位）
      if (db[key] !== undefined) result[key] = deepClone(db[key]);
      continue;
    }

    if (fieldPolicy === "keyed-array") {
      const merger = keyedArrayMergers[key];
      if (merger) {
        const dbArr = Array.isArray(db[key])
          ? (db[key] as AnyRecord[])
          : undefined;
        const clientArr = Array.isArray(client[key])
          ? (client[key] as AnyRecord[])
          : undefined;
        result[key] = merger(dbArr, clientArr);
      } else {
        // 没注册 merger 兜底：等价于 client
        result[key] =
          client[key] !== undefined
            ? deepClone(client[key])
            : deepClone(db[key]);
      }
      continue;
    }

    // "client"
    result[key] =
      client[key] !== undefined ? deepClone(client[key]) : deepClone(db[key]);
  }

  return result as T;
}

/**
 * keyed-array 合并：按 id 取并集，递归合并已存在 id 的字段
 *
 * - 客户端缺失的 id：删除（用户主动删除）
 * - 客户端新增的 id：追加
 * - 已存在的 id：用 itemMerger 递归合并
 *
 * 输出顺序：跟随 client（保留客户端 reorder 操作）
 *
 * 没有 id 字段的元素会按出现顺序退化为简单替换（理论上 schema 都有 id）。
 */
function mergeKeyedArray(
  dbArr: AnyRecord[] | undefined,
  clientArr: AnyRecord[] | undefined,
  itemMerger: (db: AnyRecord, client: AnyRecord) => AnyRecord,
): AnyRecord[] {
  if (!clientArr) return dbArr ? deepClone(dbArr) : [];
  if (!dbArr) return deepClone(clientArr);

  const dbMap = new Map<string, AnyRecord>();
  for (const item of dbArr) {
    const id = typeof item.id === "string" ? item.id : undefined;
    if (id) dbMap.set(id, item);
  }

  return clientArr.map((clientItem) => {
    const id =
      typeof clientItem.id === "string" ? clientItem.id : undefined;
    if (!id) return deepClone(clientItem);
    const dbItem = dbMap.get(id);
    if (!dbItem) return deepClone(clientItem); // 客户端新增
    return itemMerger(dbItem, clientItem); // 已存在 id：字段级合并
  });
}

// ============================================================
// 类型化合并器
// ============================================================

function mergeShot(db: AnyRecord, client: AnyRecord): AnyRecord {
  return mergeByPolicy(db, client, SHOT_POLICY);
}

function mergeDialogue(db: AnyRecord, client: AnyRecord): AnyRecord {
  return mergeByPolicy(db, client, DIALOGUE_POLICY);
}

export function mergeShotGroup(db: AnyRecord, client: AnyRecord): AnyRecord {
  return mergeByPolicy(db, client, SHOT_GROUP_POLICY, {
    shots: (dbArr, clientArr) => mergeKeyedArray(dbArr, clientArr, mergeShot),
    dialogues: (dbArr, clientArr) =>
      mergeKeyedArray(dbArr, clientArr, mergeDialogue),
  });
}

/**
 * 资源引用（character/scene/prop ref）合并：
 * 现阶段所有字段都属于客户端，等价于 client-wins
 */
function mergeAssetRef(db: AnyRecord, client: AnyRecord): AnyRecord {
  return mergeByPolicy(db, client, {});
}

// ============================================================
// 对外入口
// ============================================================

/**
 * 合并 DB 中的 ScriptContent 与客户端提交的 ScriptContent
 * 返回新对象，不修改入参
 *
 * 用法：
 * ```ts
 * const merged = mergeScriptContent(script.content, dto.content);
 * const parsed = ScriptContentSchema.safeParse(merged);
 * if (!parsed.success) throw new BadRequestException(...)
 * script.content = parsed.data;
 * ```
 */
export function mergeScriptContent(
  dbContent: ScriptContent,
  clientContent: Partial<ScriptContent>,
): ScriptContent {
  // 双 cast 进入字典，统一走 mergeByPolicy
  const merged = mergeByPolicy(
    dbContent as unknown as AnyRecord,
    clientContent as unknown as AnyRecord,
    TOP_LEVEL_POLICY,
    {
      characters: (dbArr, clientArr) =>
        mergeKeyedArray(dbArr, clientArr, mergeAssetRef),
      scenes: (dbArr, clientArr) =>
        mergeKeyedArray(dbArr, clientArr, mergeAssetRef),
      props: (dbArr, clientArr) =>
        mergeKeyedArray(dbArr, clientArr, mergeAssetRef),
      shotGroups: (dbArr, clientArr) =>
        mergeKeyedArray(dbArr, clientArr, mergeShotGroup),
    },
  );

  return merged as unknown as ScriptContent;
}

// ============================================================
// 测试支持：暴露内部函数（仅测试使用）
// ============================================================

export const __testing__ = {
  mergeByPolicy,
  mergeKeyedArray,
  mergeShot,
  mergeDialogue,
  mergeShotGroup,
  mergeAssetRef,
  TOP_LEVEL_POLICY,
  SHOT_GROUP_POLICY,
  SHOT_POLICY,
  DIALOGUE_POLICY,
};
