import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AITask, AITaskStatus } from "../../script/entities/ai-task.entity";
import { Script, ScriptStatus } from "../../script/entities/script.entity";
import { OpenAICompatibleProvider } from "../../ai/providers/openai-compatible.provider";
import { WebSocketService } from "../../websocket/websocket.service";
import {
  SCRIPT_PARSE_SYSTEM_PROMPT,
  buildScriptParseUserPrompt,
  assignIdsToScriptContent,
  // 分段解析提示词
  CHARACTER_PARSE_SYSTEM_PROMPT,
  buildCharacterParseUserPrompt,
  SCENE_PARSE_SYSTEM_PROMPT,
  buildSceneParseUserPrompt,
  PROP_PARSE_SYSTEM_PROMPT,
  buildPropParseUserPrompt,
  // 分批解析提示词
  STORYBOARD_OUTLINE_SYSTEM_PROMPT,
  buildStoryboardOutlineUserPrompt,
  STORYBOARD_BATCH_PARSE_SYSTEM_PROMPT,
  buildStoryboardBatchParseUserPrompt,
} from "../../../prompts";
import { calculateAICost } from "../../../common/utils/ai-cost.util";
import { safeJsonParse } from "../../../common/utils/json.util";
// JSON 截断修复工具
import {
  parseAndValidateJson,
  safeParseWithSchema,
} from "../../../common/utils/json-repair.util";
import { calculateScriptStats } from "../../script/utils/script-content.util";
import type { ScriptContentForStats } from "../../script/utils/script-content.util";
import { TaskType, ErrorCode } from "../../ai/config/ai.config";
import { ScriptAssetDedupService } from "../../script/services/script-asset-dedup.service";
import { CharacterService } from "../../character/services/character.service";
import { SceneService } from "../../scene/services/scene.service";
import { PropService } from "../../prop/services/prop.service";
import type {
  AssetCharacterUpdateWsData,
  AssetSceneUpdateWsData,
  AssetPropUpdateWsData,
  AssetStoryboardUpdateWsData,
} from "@pixaura/shared-types";
import {
  CharacterParseResultSchema,
  SceneParseResultSchema,
  PropParseResultSchema,
  StoryboardOutlineSchema,
  StoryboardBatchParseResultSchema,
} from "../schemas/script-parse.schema";
import { TextGenQuotaService } from "../../billing/services/text-gen-quota.service";

/**
 * 格式化分镜描述为标准格式
 * 确保 description 符合：【时间】【景别】【运镜】脚本描述
 *
 * @param description 原始描述内容
 * @param shotType 景别（可选）
 * @param timeOfDay 时间（可选，从场景 setting 获取）
 * @param cameraMovement 运镜方式（可选）
 * @returns 格式化后的标准描述
 */
function formatStoryboardDescription(
  description: string,
  shotType?: string,
  timeOfDay?: string,
  cameraMovement?: string,
): string {
  // 如果已是标准格式（至少包含时间和景别），直接返回
  if (description.match(/^【.+】【.+】/)) {
    return description;
  }

  // 时间映射表
  const timeMap: Record<string, string> = {
    morning: "清晨",
    afternoon: "白天",
    evening: "傍晚",
    night: "夜晚",
    unknown: "白天",
  };

  // 景别默认值
  const shotMap: Record<string, string> = {
    远景: "远景",
    全景: "全景",
    中景: "中景",
    近景: "近景",
    特写: "特写",
  };

  // 构建标准格式
  const time = timeMap[timeOfDay || "unknown"] || "白天";
  const shot = shotMap[shotType || ""] || shotType || "中景";
  const movement = cameraMovement?.trim();

  if (movement) {
    return `【${time}】【${shot}】【${movement}】${description}`;
  }
  return `【${time}】【${shot}】${description}`;
}

/**
 * 剧本解析 Worker
 * 处理从 txt 内容提取结构化剧本数据的 AI 任务
 */
@Processor("script-ai-parse", {
  concurrency: 3,
  lockDuration: 300000, // 任务锁定 5 分钟，防止被其他 worker 抢占
  stalledInterval: 60000, // 每分钟检查一次 stalled 任务
  maxStalledCount: 3, // 最多允许 3 次 stalled 后重试
})
export class ScriptParseWorker extends WorkerHost {
  private readonly logger = new Logger(ScriptParseWorker.name);

  constructor(
    @InjectRepository(AITask)
    private readonly aiTaskRepository: Repository<AITask>,
    @InjectRepository(Script)
    private readonly scriptRepository: Repository<Script>,
    private readonly aiProvider: OpenAICompatibleProvider,
    private readonly webSocketService: WebSocketService,
    private readonly scriptAssetDedupService: ScriptAssetDedupService,
    private readonly characterService: CharacterService,
    private readonly sceneService: SceneService,
    private readonly propService: PropService,
    private readonly textGenQuotaService: TextGenQuotaService,
  ) {
    super();
  }

  /**
   * 处理剧本解析任务
   */
  async process(job: Job): Promise<void> {
    const { taskId, type, requestData } = job.data;

    // 检查是否为分镜解析任务
    if (type === "parse-storyboards") {
      this.logger.log(
        `开始处理分镜解析任务: ${taskId}, 尝试次数: ${job.attemptsMade + 1}/${job.opts.attempts || 3}`,
      );
      await this.processParseStoryboardsTask(job);
      return;
    }

    // 检查是否为资源解析任务（通过 job.data.type 判断）
    if (type === "parse-resources") {
      this.logger.log(
        `开始处理剧本资源解析任务: ${taskId}, 尝试次数: ${job.attemptsMade + 1}/${job.opts.attempts || 3}`,
      );
      await this.processParseResourcesTask(job);
      return;
    }

    // 只处理解析任务（旧版通过 type 判断）
    if (type !== TaskType.PARSE) {
      this.logger.debug(`跳过非解析任务: ${taskId}, 类型: ${type}`);
      return;
    }

    this.logger.log(`开始处理剧本解析任务: ${taskId}, 类型: ${type}`);
    await this.processParseScriptTask(job);
  }

  /**
   * 处理资源解析任务（角色/场景/道具）
   */
  private async processParseResourcesTask(job: Job): Promise<void> {
    const { taskId, modelId, requestData } = job.data;
    const { content, scriptId, projectId } = requestData;
    const maxAttempts = job.opts.attempts || 3;
    const isFinalAttempt = job.attemptsMade >= maxAttempts - 1;

    // 验证 modelId 必填
    if (!modelId) {
      this.logger.error(`解析任务缺少 modelId: ${taskId}`);
      await this.updateTaskStatus(taskId, AITaskStatus.FAILED, {
        error: "解析任务必须指定文本模型 (modelId)",
        errorCode: ErrorCode.PARSE_FAILED,
      });
      throw new Error("解析任务必须指定文本模型 (modelId)");
    }

    let aiTask: AITask | null = null;
    let script: Script | null = null;

    try {
      // 1. 更新任务状态为处理中
      await this.updateTaskStatus(taskId, AITaskStatus.PROCESSING);

      // 额度预扣减（在获取剧本信息前预扣）
      // 注意：此处 script 还未获取，先跳过 preDeduct，在获取到 script 后再调用

      // 2. 获取任务和剧本信息
      aiTask = await this.aiTaskRepository.findOne({
        where: { id: taskId },
        relations: ["script"],
      });

      if (!aiTask) {
        throw new Error(`AI 任务不存在: ${taskId}`);
      }

      script = aiTask.script;

      if (!script) {
        throw new Error(`剧本不存在: ${aiTask.scriptId}`);
      }

      // 额度预扣减
      try {
        await this.textGenQuotaService.preDeduct(
          script.createdBy,
          taskId,
          content,
          modelId,
          "parse-resources",
        );
      } catch (quotaError) {
        this.logger.error(`额度预扣减失败: taskId=${taskId}`, quotaError instanceof Error ? quotaError.message : undefined);
        await this.updateTaskStatus(taskId, AITaskStatus.FAILED, {
          error: (quotaError as Error).message || "额度不足",
          errorCode: ErrorCode.GENERATION_FAILED,
        });
        throw quotaError;
      }

      // 更新剧本解析状态
      script.metadata = {
        ...script.metadata,
        parseStatus: "processing",
      };
      await this.scriptRepository.save(script);

      // 推送开始解析进度
      await this.broadcastProgress({
        taskId,
        scriptId: script.id,
        status: "streaming",
        progress: 10,
        message: "正在解析剧本资源...",
      });

      // 3. 检查内容长度
      if (!content || content.trim().length === 0) {
        throw new Error("剧本内容不能为空");
      }

      // 4. 构建名称 -> ID 映射（用于复用已有引用 ID，需在解析前准备好）
      const existingContent = (script.content as Record<string, unknown>) || {};
      const existingCharacters =
        (existingContent.characters as Array<{ id: string; name: string }>) ||
        [];
      const existingScenes =
        (existingContent.scenes as Array<{ id: string; name: string }>) || [];
      const existingProps =
        (existingContent.props as Array<{ id: string; name: string }>) || [];

      const characterNameToId = new Map<string, string>();
      existingCharacters.forEach((c) => characterNameToId.set(c.name, c.id));
      const sceneNameToId = new Map<string, string>();
      existingScenes.forEach((s) => sceneNameToId.set(s.name, s.id));
      const propNameToId = new Map<string, string>();
      existingProps.forEach((p) => propNameToId.set(p.name, p.id));

      // 5. 使用分段解析流程（并行解析角色/场景/道具，然后解析分镜）
      this.logger.log(
        `开始分段解析剧本: ${taskId}, 模型: ${modelId}, 内容长度: ${content.length}`,
      );

      const parseResult = await this.parseInStages(
        content,
        script.id,
        projectId,
        modelId,
        script.createdBy,
        taskId,
        characterNameToId,
        sceneNameToId,
        propNameToId,
        true, // skipStoryboards=true，分镜解析是独立流程，不再自动生成
      );

      // 推送解析中进度
      await this.broadcastProgress({
        taskId,
        scriptId: script.id,
        status: "streaming",
        progress: 60,
        message: "正在保存解析结果...",
      });

      // 6. 从解析结果构建引用列表
      // 使用解析结果中的完整数据构建引用列表
      // 角色：从 parseResult.characters 获取完整字段
      const charactersWithIds: Array<{
        id: string;
        name: string;
        characterId?: string;
        importance: string;
        description?: string;
        personality?: string;
        age?: string;
        occupation?: string;
        gender?: string;
        images: unknown[];
        assetStatus: string;
      }> = [];

      for (const parsedChar of parseResult.characters) {
        // 查找资源库中的角色获取 assetId
        const existingChar = await this.characterService.findByProjectAndName(
          projectId,
          parsedChar.name,
        );
        charactersWithIds.push({
          id: parsedChar.refId,
          name: parsedChar.name,
          characterId: existingChar?.id,
          importance: parsedChar.importance || "minor",
          description: parsedChar.description,
          personality: parsedChar.personality,
          age: parsedChar.age,
          occupation: parsedChar.occupation,
          gender: parsedChar.gender,
          images: [],
          assetStatus: existingChar ? "imported" : "none",
        });
      }

      // 场景：从 parseResult.scenes 获取完整字段
      const scenesWithIds: Array<{
        id: string;
        name: string;
        sceneId?: string;
        description?: string;
        images: unknown[];
        assetStatus: string;
      }> = [];

      for (const parsedScene of parseResult.scenes) {
        const existingScene = await this.sceneService.findByProjectAndName(
          projectId,
          parsedScene.name,
        );
        scenesWithIds.push({
          id: parsedScene.refId,
          name: parsedScene.name,
          sceneId: existingScene?.id,
          description: parsedScene.description,
          images: [],
          assetStatus: existingScene ? "imported" : "none",
        });
      }

      // 道具：从 parseResult.props 获取完整字段
      const propsWithIds: Array<{
        id: string;
        name: string;
        propId?: string;
        description?: string;
        category?: string;
        images: unknown[];
        assetStatus: string;
      }> = [];

      for (const parsedProp of parseResult.props) {
        const existingProp = await this.propService.findByProjectAndName(
          projectId,
          parsedProp.name,
        );
        propsWithIds.push({
          id: parsedProp.refId,
          name: parsedProp.name,
          propId: existingProp?.id,
          description: parsedProp.description,
          category: parsedProp.category,
          images: [],
          assetStatus: existingProp ? "imported" : "none",
        });
      }

      // 6. 更新剧本内容（只包含资源，不再自动生成分镜）
      // 注意：分镜解析是独立的流程，由用户手动触发
      script.content = {
        ...existingContent,
        characters: charactersWithIds,
        scenes: scenesWithIds,
        props: propsWithIds,
        // 保留已有的 shotGroups（如果存在），不覆盖
        shotGroups: existingContent.shotGroups || [],
      };

      // 6.1 解析完成后执行查重，将已有资产标记为 imported
      try {
        const dedupResult =
          await this.scriptAssetDedupService.dedupScriptAssets(script);
        this.logger.log(
          `解析后查重完成: scriptId=${script.id}, checked=${dedupResult.checked}, matched=${dedupResult.matched}`,
        );
      } catch (dedupError) {
        // 查重失败不阻断主流程，仅记录日志
        this.logger.warn(
          `解析后查重失败（不影响解析结果）: ${(dedupError as Error).message}`,
        );
      }

      // 更新剧本元数据
      script.metadata = {
        ...script.metadata,
        parseStatus: "completed",
        parseCompletedAt: new Date().toISOString(),
      };

      await this.scriptRepository.save(script);

      // 7. 更新任务状态为完成
      await this.updateTaskStatus(taskId, AITaskStatus.COMPLETED, {
        result: {
          characters: charactersWithIds,
          scenes: scenesWithIds,
          props: propsWithIds,
        },
      });

      // 推送完成进度
      await this.broadcastProgress({
        taskId,
        scriptId: script.id,
        status: "completed",
        progress: 100,
        result: {
          characters: charactersWithIds,
          scenes: scenesWithIds,
          props: propsWithIds,
        },
      });

      this.logger.log(
        `剧本资源解析任务完成: ${taskId}, 角色: ${charactersWithIds.length}, 场景: ${scenesWithIds.length}, 道具: ${propsWithIds.length}`,
      );
    } catch (error) {
      const errorMessage = (error as Error).message;
      this.logger.error(
        `剧本资源解析任务失败: ${taskId}, 尝试次数: ${job.attemptsMade + 1}/${maxAttempts}, 错误: ${errorMessage}`,
      );

      // 只有最终失败时才更新剧本状态为 failed
      if (isFinalAttempt) {
        // 更新任务状态为失败
        await this.updateTaskStatus(taskId, AITaskStatus.FAILED, {
          error: errorMessage,
          errorCode: ErrorCode.PARSE_FAILED,
        });

        // 更新剧本解析状态
        if (script) {
          script.metadata = {
            ...script.metadata,
            parseStatus: "failed",
            parseError: errorMessage,
          };
          await this.scriptRepository.save(script);
        }

        // 推送失败进度（脱敏处理，不暴露原始错误信息）
        await this.broadcastProgress({
          taskId,
          scriptId: script?.id || scriptId,
          status: "failed",
          error: {
            code: ErrorCode.PARSE_FAILED,
            message: "解析失败，请稍后重试",
            recoverable: true,
          },
        });
      } else {
        // 非最终失败，只推送进度，等待重试
        await this.broadcastProgress({
          taskId,
          scriptId: script?.id || scriptId,
          status: "streaming",
          progress: 10,
          message: `解析失败，正在重试 (${job.attemptsMade + 1}/${maxAttempts})...`,
        });
      }

      // 返还额度（任务失败时全额返还）
      try {
        await this.textGenQuotaService.refund(taskId, `解析失败: ${errorMessage}`);
      } catch (refundError) {
        this.logger.warn(`返还额度失败: taskId=${taskId}`, refundError instanceof Error ? refundError.message : undefined);
      }

      throw error;
    }
  }

  /**
   * 处理分镜解析任务（独立于资源解析）
   */
  private async processParseStoryboardsTask(job: Job): Promise<void> {
    const { taskId, modelId, requestData } = job.data;
    const { content, scriptId, projectId, characterMap: characterMapObj, sceneMap: sceneMapObj, propMap: propMapObj, characterAssetMap: characterAssetMapObj, sceneAssetMap: sceneAssetMapObj, propAssetMap: propAssetMapObj } = requestData;
    const maxAttempts = job.opts.attempts || 3;
    const isFinalAttempt = job.attemptsMade >= maxAttempts - 1;

    // 验证 modelId 必填
    if (!modelId) {
      this.logger.error(`分镜解析任务缺少 modelId: ${taskId}`);
      await this.updateTaskStatus(taskId, AITaskStatus.FAILED, {
        error: "分镜解析任务必须指定文本模型 (modelId)",
        errorCode: ErrorCode.PARSE_FAILED,
      });
      throw new Error("分镜解析任务必须指定文本模型 (modelId)");
    }

    let aiTask: AITask | null = null;
    let script: Script | null = null;

    try {
      // 1. 更新任务状态为处理中
      await this.updateTaskStatus(taskId, AITaskStatus.PROCESSING);

      // 2. 获取任务和剧本信息
      aiTask = await this.aiTaskRepository.findOne({
        where: { id: taskId },
        relations: ["script"],
      });

      if (!aiTask) {
        throw new Error(`AI 任务不存在: ${taskId}`);
      }

      script = aiTask.script;

      if (!script) {
        throw new Error(`剧本不存在: ${aiTask.scriptId}`);
      }

      // 更新剧本分镜解析状态
      script.metadata = {
        ...script.metadata,
        storyboardParseStatus: "processing",
      };
      await this.scriptRepository.save(script);

      // 推送开始解析进度
      await this.broadcastStoryboardParseProgress({
        taskId,
        scriptId: script.id,
        status: "processing",
        progress: 10,
        message: "正在准备分镜解析...",
      });

      // 3. 检查内容长度
      if (!content || content.trim().length === 0) {
        throw new Error("剧本内容不能为空");
      }

      // 4. 从请求数据重建映射（后端从 DB 读取构建，不依赖前端传参）
      const characterMap = new Map<string, string>(Object.entries(characterMapObj || {}));
      const sceneMap = new Map<string, string>(Object.entries(sceneMapObj || {}));
      const propMap = new Map<string, string>(Object.entries(propMapObj || {}));
      const characterAssetMap = new Map<string, string>(Object.entries(characterAssetMapObj || {}));
      const sceneAssetMap = new Map<string, string>(Object.entries(sceneAssetMapObj || {}));
      const propAssetMap = new Map<string, string>(Object.entries(propAssetMapObj || {}));

      // 验证前置条件
      if (characterMap.size === 0 && sceneMap.size === 0) {
        throw new Error("请先解析资源");
      }

      // 5. 构建场景设置映射
      const sceneSettingMap = new Map<string, { timeOfDay?: string; weather?: string }>();

      // 6. 解析分镜
      this.logger.log(
        `开始解析分镜: ${taskId}, 模型: ${modelId}, 内容长度: ${content.length}`,
      );

      const storyboards = await this.parseStoryboards(
        content,
        modelId,
        scriptId,
        script.createdBy,
        characterMap,
        sceneMap,
        propMap,
        sceneSettingMap,
        taskId,
      );

      // 检查解析结果是否为空
      if (storyboards.length === 0) {
        throw new Error("分镜解析未返回任何结果");
      }

      // 推送解析中进度
      await this.broadcastStoryboardParseProgress({
        taskId,
        scriptId: script.id,
        status: "processing",
        progress: 90,
        message: "正在保存分镜结果...",
      });

      // 7. 构建 refId -> assetId 的映射（用于分镜组中的资源引用）
      const refIdToAssetIdMap = {
        characterMap: new Map<string, string>(),
        sceneMap: new Map<string, string>(),
        propMap: new Map<string, string>(),
      };

      for (const [name, refId] of characterMap.entries()) {
        const assetId = characterAssetMap.get(name);
        if (assetId) {
          refIdToAssetIdMap.characterMap.set(refId, assetId);
        }
      }
      for (const [name, refId] of sceneMap.entries()) {
        const assetId = sceneAssetMap.get(name);
        if (assetId) {
          refIdToAssetIdMap.sceneMap.set(refId, assetId);
        }
      }
      for (const [name, refId] of propMap.entries()) {
        const assetId = propAssetMap.get(name);
        if (assetId) {
          refIdToAssetIdMap.propMap.set(refId, assetId);
        }
      }

      const shotGroups = this.convertStoryboardsToShotGroups(
        storyboards,
        refIdToAssetIdMap,
      );

      // 8. 更新剧本内容（只更新分镜部分）
      const existingContent = (script.content as Record<string, unknown>) || {};
      script.content = {
        ...existingContent,
        shotGroups,
      };

      // 更新剧本元数据
      script.metadata = {
        ...script.metadata,
        storyboardParseStatus: "completed",
        storyboardParseCompletedAt: new Date().toISOString(),
      };

      await this.scriptRepository.save(script);

      // 9. 更新任务状态为完成
      await this.updateTaskStatus(taskId, AITaskStatus.COMPLETED, {
        result: {
          shotGroups,
        },
      });

      // 推送完成进度
      await this.broadcastStoryboardParseProgress({
        taskId,
        scriptId: script.id,
        status: "completed",
        progress: 100,
        result: {
          shotGroups,
        },
      });

      this.logger.log(
        `分镜解析任务完成: ${taskId}, 分镜: ${storyboards.length}`,
      );
    } catch (error) {
      const errorMessage = (error as Error).message;
      this.logger.error(
        `分镜解析任务失败: ${taskId}, 尝试次数: ${job.attemptsMade + 1}/${maxAttempts}, 错误: ${errorMessage}`,
      );

      // 只有最终失败时才更新剧本状态为 failed
      if (isFinalAttempt) {
        // 更新任务状态为失败
        await this.updateTaskStatus(taskId, AITaskStatus.FAILED, {
          error: errorMessage,
          errorCode: ErrorCode.PARSE_FAILED,
        });

        // 更新剧本分镜解析状态
        if (script) {
          script.metadata = {
            ...script.metadata,
            storyboardParseStatus: "failed",
            storyboardParseError: errorMessage,
          };
          await this.scriptRepository.save(script);
        }

        // 推送失败进度（脱敏处理）
        await this.broadcastStoryboardParseProgress({
          taskId,
          scriptId: script?.id || scriptId,
          status: "failed",
          error: {
            message: "分镜解析失败，请稍后重试",
          },
        });
      } else {
        // 非最终失败，只推送进度，等待重试
        await this.broadcastStoryboardParseProgress({
          taskId,
          scriptId: script?.id || scriptId,
          status: "processing",
          progress: 10,
          message: `解析失败，正在重试 (${job.attemptsMade + 1}/${maxAttempts})...`,
        });
      }

      throw error;
    }
  }

  // ==================== Zod Schema 已从 ../schemas/script-parse.schema.ts 共享导入 ====================

  /**
   * 分段解析流程
   * 并行解析角色/场景/道具，完成后解析分镜
   *
   * @param content 剧本文本内容
   * @param scriptId 剧本 ID
   * @param projectId 项目 ID
   * @param modelId 文本模型 ID
   * @param userId 用户 ID（用于 WebSocket 推送）
   * @param taskId 解析任务的主 taskId（用于 WebSocket 订阅匹配）
   * @param skipStoryboards 是否跳过分镜解析（用于拆分后的独立分镜解析）
   */
  private async parseInStages(
    content: string,
    scriptId: string,
    projectId: string,
    modelId: string,
    userId: string,
    taskId: string,
    existingCharacterNameToId?: Map<string, string>,
    existingSceneNameToId?: Map<string, string>,
    existingPropNameToId?: Map<string, string>,
    skipStoryboards: boolean = false,
  ): Promise<{
    characterMap: Map<string, string>; // name -> refId
    sceneMap: Map<string, string>; // name -> refId
    propMap: Map<string, string>; // name -> refId
    characterAssetMap: Map<string, string>; // name -> assetId
    sceneAssetMap: Map<string, string>; // name -> assetId
    propAssetMap: Map<string, string>; // name -> assetId
    characters: Array<{
      refId: string;
      name: string;
      description?: string;
      personality?: string;
      age?: string;
      occupation?: string;
      gender?: string;
      importance?: string;
    }>;
    scenes: Array<{
      refId: string;
      name: string;
      description?: string;
      setting?: {
        timeOfDay?: string;
        weather?: string;
      };
    }>;
    props: Array<{
      refId: string;
      name: string;
      description?: string;
      category?: string;
    }>;
    storyboards: Array<{
      id: string;
      sequenceNumber: number;
      sceneId?: string;
      characterIds: string[];
      propIds: string[];
      dialogues: Array<{
        id: string;
        characterId?: string;
        characterName: string;
        text: string;
        emotion?: string;
        actions?: string[];
        isVoiceover: boolean;
      }>;
      description: string;
      shotType?: string;
      cameraAngle?: string;
      cameraMovement?: string;
      duration: number;
      createdAt: string;
      updatedAt: string;
      mode: "standard" | "quick" | "locked";
    }>;
  }> {
    // 名称 -> 引用 ID 的映射表（优先使用已有的 ID）
    const characterMap = new Map<string, string>(existingCharacterNameToId);
    const sceneMap = new Map<string, string>(existingSceneNameToId);
    const propMap = new Map<string, string>(existingPropNameToId);

    // 并行解析角色、场景、道具
    const [characterResult, sceneResult, propResult] = await Promise.all([
      this.parseCharacters(
        content,
        modelId,
        projectId,
        userId,
        scriptId,
        characterMap,
        taskId,
      ),
      this.parseScenes(
        content,
        modelId,
        projectId,
        userId,
        scriptId,
        sceneMap,
        taskId,
      ),
      this.parseProps(
        content,
        modelId,
        projectId,
        userId,
        scriptId,
        propMap,
        taskId,
      ),
    ]);

    this.logger.log(
      `分段解析完成: 角色=${characterResult.length}, 场景=${sceneResult.length}, 道具=${propResult.length}`,
    );

    // 场景设置映射（已废弃，保留空 Map 兼容 parseStoryboards 签名）
    const sceneSettingMap = new Map<
      string,
      { timeOfDay?: string; weather?: string }
    >();

    // 条件执行分镜解析
    let storyboards: Array<{
      id: string;
      sequenceNumber: number;
      sceneId?: string;
      characterIds: string[];
      propIds: string[];
      dialogues: Array<{
        id: string;
        characterId?: string;
        characterName: string;
        text: string;
        emotion?: string;
        actions?: string[];
        isVoiceover: boolean;
      }>;
      description: string;
      shotType?: string;
      cameraAngle?: string;
      cameraMovement?: string;
      duration: number;
      createdAt: string;
      updatedAt: string;
      mode: "standard" | "quick" | "locked";
    }> = [];

    if (!skipStoryboards) {
      storyboards = await this.parseStoryboards(
        content,
        modelId,
        scriptId,
        userId,
        characterMap,
        sceneMap,
        propMap,
        sceneSettingMap,
        taskId,
      );
      this.logger.log(`分镜解析完成: ${storyboards.length} 个分镜`);
    }

    // 构建 name -> assetId 的映射（用于分镜组关联）
    const characterAssetMap = new Map<string, string>();
    for (const char of characterResult) {
      if (char.assetId) {
        characterAssetMap.set(char.name, char.assetId);
      }
    }
    const sceneAssetMap = new Map<string, string>();
    for (const scene of sceneResult) {
      if (scene.assetId) {
        sceneAssetMap.set(scene.name, scene.assetId);
      }
    }
    const propAssetMap = new Map<string, string>();
    for (const prop of propResult) {
      if (prop.assetId) {
        propAssetMap.set(prop.name, prop.assetId);
      }
    }

    return {
      characterMap,
      sceneMap,
      propMap,
      characterAssetMap,
      sceneAssetMap,
      propAssetMap,
      characters: characterResult,
      scenes: sceneResult,
      props: propResult,
      storyboards,
    };
  }

  /**
   * 解析角色
   */
  private async parseCharacters(
    content: string,
    modelId: string,
    projectId: string,
    userId: string,
    scriptId: string,
    characterMap: Map<string, string>,
    taskId: string,
  ): Promise<
    Array<{
      refId: string;
      assetId?: string;
      name: string;
      description?: string;
      personality?: string;
      age?: string;
      occupation?: string;
      gender?: string;
      importance?: string;
    }>
  > {
    try {
      const result = await this.aiProvider.generateText(
        {
          prompt: buildCharacterParseUserPrompt(content),
          systemPrompt: CHARACTER_PARSE_SYSTEM_PROMPT,
          temperature: 0.3,
          maxTokens: 4000,
        },
        modelId,
      );

      // 预处理 AI 返回的 JSON，将中文性别值转换为英文
      // 避免 Zod Schema 校验失败
      const preprocessedText = this.preprocessGenderInJson(result.text);

      // 使用 JSON 修复工具解析结果
      const parseResult = parseAndValidateJson(
        preprocessedText,
        CharacterParseResultSchema,
        ["characters"],
      );

      if (!parseResult.success || !parseResult.data) {
        // 增强日志：记录原始 JSON 和校验错误详情
        this.logger.error(
          `角色解析失败，原始 AI 返回:\n${result.text.slice(0, 500)}...\n校验错误: ${parseResult.error}\n修复详情: ${parseResult.repairDetails}`,
        );
        if (!parseResult.validation.success) {
          this.logger.error(
            `Zod 校验错误详情: ${JSON.stringify(parseResult.validation.error.errors)}`,
          );
        }
        return [];
      }

      const characters = parseResult.data.characters;
      const results: Array<{
        refId: string;
        assetId?: string;
        name: string;
        description?: string;
        personality?: string;
        age?: string;
        occupation?: string;
        gender?: string;
        importance?: string;
      }> = [];

      for (const char of characters) {
        // 优先复用已有的引用 ID，保持分镜引用的稳定性
        const existingRefId = characterMap.get(char.name);
        const refId = existingRefId || this.generateId();
        characterMap.set(char.name, refId);

        // 创建角色资产
        try {
          const existingChar = await this.characterService.findByProjectAndName(
            projectId,
            char.name,
          );

          // 性别值转换（支持中文和英文）
          const genderMap: Record<
            string,
            "male" | "female" | "unknown" | "other"
          > = {
            男: "male",
            女: "female",
            man: "male",
            woman: "female",
            male: "male",
            female: "female",
            unknown: "unknown",
            other: "other",
          };
          const rawGender = char.gender?.toLowerCase() || "";
          const mappedGender = genderMap[rawGender];
          // 如果映射成功使用映射值，否则如果原始值有效则使用它，否则设为 unknown
          const normalizedGender: "male" | "female" | "unknown" | "other" =
            mappedGender || "unknown";
          const finalGender =
            normalizedGender !== "unknown" ? normalizedGender : undefined;

          let assetId: string | undefined;
          if (existingChar) {
            assetId = existingChar.id;
          } else {
            const newChar = await this.characterService.create(
              projectId,
              userId,
              {
                name: char.name,
                description: char.description,
                personality: char.personality, // 性格特点
                age: char.age, // 年龄
                occupation: char.occupation, // 职业
                importance: char.importance || "minor",
                gender: finalGender,
              },
            );
            assetId = newChar.id;
          }

          results.push({
            refId,
            assetId,
            name: char.name,
            description: char.description,
            personality: char.personality,
            age: char.age,
            occupation: char.occupation,
            gender: normalizedGender,
            importance: char.importance,
          });

          // WebSocket 推送角色更新
          await this.broadcastAssetUpdate("character", taskId, {
            type: "asset:character-update" as const,
            scriptId,
            refId,
            assetId,
            name: char.name,
            description: char.description,
            personality: char.personality, // 性格特点
            age: char.age, // 年龄
            occupation: char.occupation, // 职业
            importance: char.importance,
            gender: normalizedGender,
            createdAt: new Date().toISOString(),
          });
        } catch (createError) {
          this.logger.warn(
            `创建角色失败: ${char.name}, ${(createError as Error).message}`,
          );
          // 性别值转换（支持中文和英文）
          const genderMap: Record<
            string,
            "male" | "female" | "unknown" | "other"
          > = {
            男: "male",
            女: "female",
            man: "male",
            woman: "female",
            male: "male",
            female: "female",
            unknown: "unknown",
            other: "other",
          };
          const rawGender = char.gender?.toLowerCase() || "";
          const normalizedGender: "male" | "female" | "unknown" | "other" =
            genderMap[rawGender] || "unknown";
          results.push({
            refId,
            name: char.name,
            description: char.description,
            personality: char.personality,
            age: char.age,
            occupation: char.occupation,
            gender: normalizedGender,
            importance: char.importance,
          });
        }
      }

      return results;
    } catch (error) {
      this.logger.error(`角色解析异常: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * 解析场景
   */
  private async parseScenes(
    content: string,
    modelId: string,
    projectId: string,
    userId: string,
    scriptId: string,
    sceneMap: Map<string, string>,
    taskId: string,
  ): Promise<
    Array<{
      refId: string;
      assetId?: string;
      name: string;
      description?: string;
      setting?: {
        timeOfDay?: string;
        weather?: string;
      };
    }>
  > {
    try {
      const result = await this.aiProvider.generateText(
        {
          prompt: buildSceneParseUserPrompt(content),
          systemPrompt: SCENE_PARSE_SYSTEM_PROMPT,
          temperature: 0.3,
          maxTokens: 4000,
        },
        modelId,
      );

      const parseResult = parseAndValidateJson(
        result.text,
        SceneParseResultSchema,
        ["scenes"],
      );

      if (!parseResult.success || !parseResult.data) {
        this.logger.error(`场景解析失败: ${parseResult.error}`);
        if (parseResult.repairDetails) {
          this.logger.error(`场景解析详细错误: ${parseResult.repairDetails}`);
        }
        const previewText =
          result.text.length > 800
            ? result.text.slice(0, 800) + "..."
            : result.text;
        this.logger.error(`场景解析 AI 原始返回: ${previewText}`);
        return [];
      }

      const scenes = parseResult.data.scenes;
      const results: Array<{
        refId: string;
        assetId?: string;
        name: string;
        description?: string;
        setting?: {
          timeOfDay?: string;
          weather?: string;
        };
      }> = [];

      for (const scene of scenes) {
        // 优先复用已有的引用 ID，保持分镜引用的稳定性
        const existingRefId = sceneMap.get(scene.name);
        const refId = existingRefId || this.generateId();
        sceneMap.set(scene.name, refId);

        try {
          const existingScene = await this.sceneService.findByProjectAndName(
            projectId,
            scene.name,
          );

          let assetId: string | undefined;
          if (existingScene) {
            assetId = existingScene.id;
          } else {
            const newScene = await this.sceneService.create(projectId, userId, {
              name: scene.name,
              description: scene.description,
              type: "interior",
            });
            assetId = newScene.id;
          }

          results.push({
            refId,
            assetId,
            name: scene.name,
            description: scene.description,
          });

          // WebSocket 推送场景更新
          await this.broadcastAssetUpdate("scene", taskId, {
            type: "asset:scene-update" as const,
            scriptId,
            refId,
            assetId,
            name: scene.name,
            description: scene.description,
            createdAt: new Date().toISOString(),
          });
        } catch (createError) {
          this.logger.warn(
            `创建场景失败: ${scene.name}, ${(createError as Error).message}`,
          );
          results.push({
            refId,
            name: scene.name,
            description: scene.description,
          });
        }
      }

      return results;
    } catch (error) {
      this.logger.error(`场景解析异常: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * 解析道具
   */
  private async parseProps(
    content: string,
    modelId: string,
    projectId: string,
    userId: string,
    scriptId: string,
    propMap: Map<string, string>,
    taskId: string,
  ): Promise<
    Array<{
      refId: string;
      assetId?: string;
      name: string;
      description?: string;
      category?: string;
    }>
  > {
    try {
      const result = await this.aiProvider.generateText(
        {
          prompt: buildPropParseUserPrompt(content),
          systemPrompt: PROP_PARSE_SYSTEM_PROMPT,
          temperature: 0.3,
          maxTokens: 4000,
        },
        modelId,
      );

      const parseResult = parseAndValidateJson(
        result.text,
        PropParseResultSchema,
        ["props"],
      );

      if (!parseResult.success || !parseResult.data) {
        this.logger.error(`道具解析失败: ${parseResult.error}`);
        if (parseResult.repairDetails) {
          this.logger.error(`道具解析详细错误: ${parseResult.repairDetails}`);
        }
        const previewText =
          result.text.length > 800
            ? result.text.slice(0, 800) + "..."
            : result.text;
        this.logger.error(`道具解析 AI 原始返回: ${previewText}`);
        return [];
      }

      const props = parseResult.data.props;
      const results: Array<{
        refId: string;
        assetId?: string;
        name: string;
        description?: string;
        category?: string;
      }> = [];

      for (const prop of props) {
        // 优先复用已有的引用 ID，保持分镜引用的稳定性
        const existingRefId = propMap.get(prop.name);
        const refId = existingRefId || this.generateId();
        propMap.set(prop.name, refId);

        try {
          const existingProp = await this.propService.findByProjectAndName(
            projectId,
            prop.name,
          );

          let assetId: string | undefined;
          if (existingProp) {
            assetId = existingProp.id;
          } else {
            const newProp = await this.propService.create(projectId, userId, {
              name: prop.name,
              description: prop.description,
              importance: "background",
            });
            assetId = newProp.id;
          }

          results.push({
            refId,
            assetId,
            name: prop.name,
            description: prop.description,
            category: prop.category,
          });

          // WebSocket 推送道具更新
          await this.broadcastAssetUpdate("prop", taskId, {
            type: "asset:prop-update" as const,
            scriptId,
            refId,
            assetId,
            name: prop.name,
            description: prop.description,
            category: prop.category,
            createdAt: new Date().toISOString(),
          });
        } catch (createError) {
          this.logger.warn(
            `创建道具失败: ${prop.name}, ${(createError as Error).message}`,
          );
          results.push({
            refId,
            name: prop.name,
            description: prop.description,
            category: prop.category,
          });
        }
      }

      return results;
    } catch (error) {
      this.logger.error(`道具解析异常: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * 解析分镜
   */
  private async parseStoryboards(
    content: string,
    modelId: string,
    scriptId: string,
    userId: string,
    characterMap: Map<string, string>,
    sceneMap: Map<string, string>,
    propMap: Map<string, string>,
    sceneSettingMap: Map<string, { timeOfDay?: string; weather?: string }>,
    taskId: string,
  ): Promise<
    Array<{
      id: string;
      sequenceNumber: number;
      sceneId?: string;
      characterIds: string[];
      propIds: string[];
      dialogues: Array<{
        id: string;
        characterId?: string;
        characterName: string;
        text: string;
        emotion?: string;
        actions?: string[];
        isVoiceover: boolean;
      }>;
      description: string;
      shotType?: string;
      cameraAngle?: string;
      duration: number;
      createdAt: string;
      updatedAt: string;
      mode: "standard" | "quick" | "locked";
    }>
  > {
    try {
      const characterNames = Array.from(characterMap.keys());
      const sceneNames = Array.from(sceneMap.keys());
      const propNames = Array.from(propMap.keys());

      // 1. 检测剧本类型并准备批次
      const isFormatted = this.detectFormattedScript(content);
      this.logger.log(
        `剧本类型检测: ${isFormatted ? "格式化剧本" : "非格式化剧本"}, taskId=${taskId}`,
      );

      let batches: Array<{ batchIndex: number; rawText: string }> = [];

      if (isFormatted) {
        const sceneBatches = this.splitScriptByScenes(content, 3);
        batches = sceneBatches.map((b) => ({
          batchIndex: b.batchIndex,
          rawText: b.rawText,
        }));
      } else {
        const outline = await this.extractStoryboardOutline(content, modelId);
        if (outline.length === 0) {
          this.logger.warn(`大纲提取失败，回退到单批次解析: ${taskId}`);
          batches = [{ batchIndex: 0, rawText: content }];
        } else {
          const outlineBatches = this.splitScriptByOutline(
            content,
            outline,
            10,
          );
          batches = outlineBatches.map((b) => ({
            batchIndex: b.batchIndex,
            rawText: b.rawText,
          }));
        }
      }

      if (batches.length === 0) {
        this.logger.error(`批次划分失败，无可用批次: ${taskId}`);
        return [];
      }

      this.logger.log(
        `分镜解析批次划分完成: 共 ${batches.length} 批, taskId=${taskId}`,
      );

      // 2. 并行解析各批次（最多 10 个并发）
      const CONCURRENT_BATCHES = 10;
      const batchResults = new Array<
        Array<{
          sequenceNumber: number;
          sceneName: string;
          characterNames: string[];
          propNames: string[];
          description: string;
          shotType?: string;
          cameraAngle?: string;
          duration?: number;
          dialogues: Array<Record<string, unknown>>;
        }> | null
      >(batches.length).fill(null);
      const failedBatches: number[] = [];
      let totalCompletedShots = 0;
      let completedCount = 0;

      const processBatch = async (batchIdx: number) => {
        try {
          const batch = batches[batchIdx];
          const sceneNamesInBatch =
            "sceneNames" in batch ? (batch as { sceneNames: string[] }).sceneNames : undefined;

          // 推送批次进度
          await this.broadcastStoryboardBatchProgress({
            taskId,
            scriptId,
            status: "processing",
            progress: Math.round((completedCount / batches.length) * 70) + 15,
            message: `正在解析第 ${batchIdx + 1}/${batches.length} 批分镜（已解析 ${totalCompletedShots} 个）...`,
            currentBatch: batchIdx + 1,
            totalBatches: batches.length,
            completedShots: totalCompletedShots,
          });

          // 解析单批次（带自动降级）
          const batchStoryboards = await this.parseBatchWithSplitFallback(
            batch.rawText,
            batchIdx,
            modelId,
            characterMap,
            sceneMap,
            propMap,
            sceneSettingMap,
            isFormatted,
            taskId,
            0,
            sceneNamesInBatch,
          );

          if (batchStoryboards.length > 0) {
            batchResults[batchIdx] = batchStoryboards;
            totalCompletedShots += batchStoryboards.length;
            completedCount++;
            this.logger.log(
              `批次 ${batchIdx + 1} 解析完成: ${batchStoryboards.length} 个分镜`,
            );
          } else {
            this.logger.warn(`批次 ${batchIdx + 1} 解析失败，已跳过`);
            failedBatches.push(batchIdx);
            completedCount++;
          }
        } catch (batchError) {
          this.logger.error(
            `批次 ${batchIdx + 1} 处理异常: ${(batchError as Error).message}`,
          );
          failedBatches.push(batchIdx);
          completedCount++;
        }
      };

      // 分 chunk 并发执行（每 chunk 最多 CONCURRENT_BATCHES 个）
      for (let i = 0; i < batches.length; i += CONCURRENT_BATCHES) {
        const chunkSize = Math.min(CONCURRENT_BATCHES, batches.length - i);
        const promises: Promise<void>[] = [];
        for (let j = 0; j < chunkSize; j++) {
          promises.push(processBatch(i + j));
        }
        await Promise.all(promises);
      }

      // 3. 合并结果
      const validBatchResults = batchResults.filter(
        (r): r is NonNullable<typeof r> => r !== null,
      );
      if (validBatchResults.length === 0) {
        this.logger.error(`所有批次解析失败: ${taskId}`);
        return [];
      }

      const mergedStoryboards = this.mergeBatchResults(validBatchResults);
      this.logger.log(
        `分镜合并完成: 共 ${mergedStoryboards.length} 个分镜, taskId=${taskId}`,
      );

      if (failedBatches.length > 0) {
        this.logger.warn(
          `部分批次解析失败: ${failedBatches
            .map((i) => i + 1)
            .join(", ")}，已保留 ${validBatchResults.length}/${batches.length} 批次的结果`,
        );
      }

      // 4. 处理合并后的分镜数据（复用现有逻辑）
      const storyboards = mergedStoryboards;
      const results: Array<{
        id: string;
        sequenceNumber: number;
        sceneId?: string;
        characterIds: string[];
        propIds: string[];
        dialogues: Array<{
          id: string;
          characterId?: string;
          characterName: string;
          text: string;
          emotion?: string;
          isVoiceover: boolean;
        }>;
        description: string;
        shotType?: string;
        cameraAngle?: string;
        cameraMovement?: string;
        duration: number;
        createdAt: string;
        updatedAt: string;
        mode: "standard" | "quick" | "locked";
      }> = [];

      for (const sb of storyboards) {
        const storyboardId = this.generateId();
        const now = new Date().toISOString();

        // 名称匹配转换 ID（增加容错模糊匹配）
        // 场景匹配
        let sceneId = sceneMap.get(sb.sceneName);
        if (!sceneId) {
          // 尝试模糊匹配（包含关系）
          for (const [name, id] of sceneMap) {
            if (name.includes(sb.sceneName) || sb.sceneName.includes(name)) {
              sceneId = id;
              this.logger.debug(
                `场景模糊匹配成功: "${sb.sceneName}" -> "${name}"`,
              );
              break;
            }
          }
          if (!sceneId) {
            this.logger.warn(
              `场景名称匹配失败: "${sb.sceneName}", 可用场景: ${Array.from(sceneMap.keys()).join(", ")}`,
            );
          }
        }

        // 角色匹配
        const characterIds = (sb.characterNames || [])
          .map((name) => {
            let id = characterMap.get(name);
            if (!id) {
              // 尝试模糊匹配
              for (const [charName, charId] of characterMap) {
                if (charName.includes(name) || name.includes(charName)) {
                  id = charId;
                  this.logger.debug(
                    `角色模糊匹配成功: "${name}" -> "${charName}"`,
                  );
                  break;
                }
              }
              if (!id) {
                this.logger.warn(`角色名称匹配失败: "${name}"`);
              }
            }
            return id;
          })
          .filter((id): id is string => !!id);

        // 道具匹配
        const propIds = (sb.propNames || [])
          .map((name) => {
            let id = propMap.get(name);
            if (!id) {
              // 尝试模糊匹配
              for (const [propName, propId] of propMap) {
                if (propName.includes(name) || name.includes(propName)) {
                  id = propId;
                  this.logger.debug(
                    `道具模糊匹配成功: "${name}" -> "${propName}"`,
                  );
                  break;
                }
              }
              if (!id) {
                this.logger.warn(`道具名称匹配失败: "${name}"`);
              }
            }
            return id;
          })
          .filter((id): id is string => !!id);

        // 转换对白（确保 dialogues 有默认空数组，增强字段名容错）
        // 记录原始 dialogues 数据便于调试
        this.logger.debug(
          `分镜 ${sb.sequenceNumber} 原始 dialogues 数据: ${JSON.stringify(sb.dialogues || [])}`,
        );

        const dialogues = (sb.dialogues || []).map((d, idx) => {
          // 使用 Record 类型以支持字段名容错
          const raw = d as Record<string, unknown>;

          // 容错处理：支持多种可能的字段名
          // speakerName / speaker -> 角色名
          let speakerName = (raw.speakerName ||
            raw.speaker ||
            raw.name ||
            "") as string;
          // content / text / dialogue -> 对白内容
          const content = (raw.content ||
            raw.text ||
            raw.dialogue ||
            "") as string;
          // instruction / emotion -> 情绪指令
          const emotion = (raw.instruction || raw.emotion || raw.mood) as
            | string
            | undefined;
          // actions -> 动作描述数组
          const actions = (raw.actions as string[] | undefined) || [];

          // 兜底处理：当 speakerName 为空但有对话内容时，尝试从分镜的 characterNames 推断
          let isVoiceover = false;
          if (!speakerName && content) {
            // 从分镜的 characterNames 中推断默认角色
            const availableCharacters = sb.characterNames || [];
            if (availableCharacters.length === 1) {
              // 只有一个角色时，默认使用该角色
              speakerName = availableCharacters[0];
              this.logger.log(
                `分镜 ${sb.sequenceNumber} 对白 ${idx} speakerName 缺失，已从 characterNames 推断为 "${speakerName}"`,
              );
            } else if (availableCharacters.length > 1) {
              // 多个角色时，使用第一个角色作为默认（警告用户需手动确认）
              speakerName = availableCharacters[0];
              this.logger.warn(
                `分镜 ${sb.sequenceNumber} 对白 ${idx} speakerName 缺失，已使用 characterNames 第一个角色 "${speakerName}"（需用户确认）`,
              );
            } else {
              // 无角色时，标记为旁白，并设置默认名称
              isVoiceover = true;
              speakerName = "旁白";
              this.logger.log(
                `分镜 ${sb.sequenceNumber} 对白 ${idx} 无角色信息，已标记为旁白`,
              );
            }
          }

          // 记录单条对白的解析情况（仅在异常时）
          if (!speakerName && !content) {
            this.logger.warn(
              `分镜 ${sb.sequenceNumber} 对白 ${idx} 完全为空，已跳过`,
            );
          }

          // 对白角色匹配（增加容错模糊匹配）
          let characterId = characterMap.get(speakerName);
          if (!characterId && speakerName) {
            // 尝试模糊匹配
            for (const [charName, charId] of characterMap) {
              if (
                charName.includes(speakerName) ||
                speakerName.includes(charName)
              ) {
                characterId = charId;
                this.logger.debug(
                  `对白角色模糊匹配成功: "${speakerName}" -> "${charName}"`,
                );
                break;
              }
            }
            if (!characterId) {
              this.logger.warn(
                `对白角色名称匹配失败: "${speakerName}", 可用角色: ${Array.from(characterMap.keys()).join(", ")}`,
              );
            }
          }
          return {
            id: `${storyboardId}_dialogue_${idx}`,
            characterId,
            characterName: speakerName,
            text: content,
            emotion,
            actions,
            isVoiceover,
          };
        });

        // 过滤掉完全为空的对话（既没有角色名也没有内容）
        const validDialogues = dialogues.filter((d) => d.characterName || d.text);

        // 记录转换后的 dialogues 数量
        this.logger.log(
          `分镜 ${sb.sequenceNumber} 转换完成: ${validDialogues.length} 条有效对白（原始 ${dialogues.length} 条）`,
        );

        // 获取场景的 setting 信息用于格式化描述
        let sceneSetting = sceneSettingMap.get(sb.sceneName);
        // 如果场景名称不精确匹配，尝试模糊匹配
        if (!sceneSetting) {
          for (const [name, setting] of sceneSettingMap) {
            if (name.includes(sb.sceneName) || sb.sceneName.includes(name)) {
              sceneSetting = setting;
              break;
            }
          }
        }

        // 格式化分镜描述为标准格式：【时间】【景别】【运镜】脚本描述
        const formattedDescription = formatStoryboardDescription(
          sb.description,
          sb.shotType,
          sceneSetting?.timeOfDay,
          sb.cameraMovement,
        );

        // 记录格式化结果
        if (formattedDescription !== sb.description) {
          this.logger.log(
            `分镜 ${sb.sequenceNumber} 描述已格式化: "${sb.description}" -> "${formattedDescription}"`,
          );
        }

        const storyboard = {
          id: storyboardId,
          sequenceNumber: sb.sequenceNumber,
          sceneId,
          characterIds,
          propIds,
          dialogues: validDialogues,
          description: formattedDescription,
          shotType: sb.shotType,
          cameraAngle: sb.cameraAngle,
          // cameraMovement 已融入 description，不再单独保存
          duration: sb.duration || 5,
          createdAt: now,
          updatedAt: now,
          mode: "standard" as const,
        };

        results.push(storyboard);

        // WebSocket 推送分镜更新
        await this.broadcastAssetUpdate("storyboard", taskId, {
          type: "asset:storyboard-update" as const,
          scriptId,
          storyboardId,
          sequenceNumber: sb.sequenceNumber,
          sceneId,
          characterIds,
          propIds,
          dialogues: validDialogues,
          description: formattedDescription,
          shotType: sb.shotType,
          cameraAngle: sb.cameraAngle,
          // cameraMovement 已融入 description，不再单独推送
          duration: sb.duration,
          createdAt: now,
        });
      }

      // ==================== 完整性校验 ====================
      // 检查每个分镜的 characterNames 和 dialogues 是否完整
      this.logger.log("========== 分镜完整性校验报告 ==========");
      let totalIssues = 0;
      for (const sb of storyboards) {
        const issues: string[] = [];

        // 检查 characterNames 是否完整
        if (!sb.characterNames || sb.characterNames.length === 0) {
          // 检查是否有对话但角色列表为空
          if (sb.dialogues && sb.dialogues.length > 0) {
            // 从对话中推断应该存在的角色
            const speakersFromDialogues = new Set<string>();
            for (const d of sb.dialogues) {
              const raw = d as Record<string, unknown>;
              const speakerName = (raw.speakerName ||
                raw.speaker ||
                raw.name ||
                "") as string;
              if (speakerName) {
                speakersFromDialogues.add(speakerName);
              }
            }
            if (speakersFromDialogues.size > 0) {
              issues.push(
                `characterNames 为空但对话中存在角色: ${Array.from(speakersFromDialogues).join(", ")}`,
              );
            }
          }
        }

        // 检查 dialogues 是否完整
        if (!sb.dialogues || sb.dialogues.length === 0) {
          // 检查场景描述中是否有对话格式的文本
          const desc = sb.description || "";
          const dialogueMatches = desc.match(/[\u4e00-\u9fa5a-zA-Z]+[：:].+/g);
          if (dialogueMatches && dialogueMatches.length > 0) {
            issues.push(
              `dialogues 为空但描述中发现对话格式文本: ${dialogueMatches.length} 条`,
            );
          }
        }

        // 检查对话字段是否完整
        for (const [idx, d] of (sb.dialogues || []).entries()) {
          const raw = d as Record<string, unknown>;
          const speakerName = (raw.speakerName ||
            raw.speaker ||
            raw.name ||
            "") as string;
          const content = (raw.content ||
            raw.text ||
            raw.dialogue ||
            "") as string;
          if (!speakerName) {
            issues.push(`对话#${idx}缺少 speakerName`);
          }
          if (!content) {
            issues.push(`对话#${idx}缺少 content`);
          }
        }

        if (issues.length > 0) {
          totalIssues += issues.length;
          this.logger.warn(
            `[校验警告] 分镜#${sb.sequenceNumber} 存在问题:\n  - ${issues.join("\n  - ")}`,
          );
        } else {
          this.logger.debug(
            `[校验通过] 分镜#${sb.sequenceNumber}: characterNames=${sb.characterNames?.length || 0}, dialogues=${sb.dialogues?.length || 0}`,
          );
        }
      }
      this.logger.log(
        `========== 校验完成: 共发现 ${totalIssues} 个问题 ==========`,
      );
      if (totalIssues > 0) {
        this.logger.warn(
          `【重要提示】AI 模型可能未按提示词要求完整提取分镜数据，建议检查剧本内容或尝试重新解析`,
        );
      }

      return results;
    } catch (error) {
      this.logger.error(`分镜解析异常: ${(error as Error).message}`);
      return [];
    }
  }

  // ==================== 分批解析辅助方法 ====================

  /**
   * 检测剧本是否为格式化剧本（包含 § 场景标记）
   * @param content 剧本文本
   * @returns 是否为格式化剧本
   */
  private detectFormattedScript(content: string): boolean {
    // 检查是否存在 § 开头的场景标记行
    return /^\s*§\s+/m.test(content);
  }

  /**
   * 按场景分割格式化剧本为批次
   * @param content 格式化剧本文本
   * @param maxScenesPerBatch 每批次最大场景数（默认 3）
   * @returns 批次数组，每个元素包含该批次的完整剧本片段
   */
  private splitScriptByScenes(
    content: string,
    maxScenesPerBatch: number = 3,
  ): Array<{ batchIndex: number; rawText: string }> {
    // 按 § 标记分割场景（保留 § 符号）
    const sceneRegex = /(?=^\s*§\s+)/m;
    const scenes = content
      .split(sceneRegex)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const batches: Array<{ batchIndex: number; rawText: string }> = [];

    for (let i = 0; i < scenes.length; i += maxScenesPerBatch) {
      const batchScenes = scenes.slice(i, i + maxScenesPerBatch);
      batches.push({
        batchIndex: batches.length,
        rawText: batchScenes.join("\n\n"),
      });
    }

    return batches;
  }

  /**
   * 提取剧本大纲（用于非格式化剧本）
   * @param content 剧本文本
   * @param modelId 模型 ID
   * @returns 大纲数组，每个元素包含场景摘要信息
   */
  private async extractStoryboardOutline(
    content: string,
    modelId: string,
  ): Promise<
    Array<{
      sceneIndex: number;
      sceneName: string;
      summary: string;
      estimatedShots: number;
    }>
  > {
    try {
      const result = await this.aiProvider.generateText(
        {
          prompt: buildStoryboardOutlineUserPrompt(content),
          systemPrompt: STORYBOARD_OUTLINE_SYSTEM_PROMPT,
          temperature: 0.3,
          maxTokens: 4000,
        },
        modelId,
      );

      const parseResult = parseAndValidateJson(
        result.text,
        StoryboardOutlineSchema,
        ["scenes"],
      );

      if (!parseResult.success || !parseResult.data) {
        this.logger.error(`大纲提取失败: ${parseResult.error}`);
        if (parseResult.repairDetails) {
          this.logger.error(`大纲提取详细错误: ${parseResult.repairDetails}`);
        }
        const previewText =
          result.text.length > 800
            ? result.text.slice(0, 800) + "..."
            : result.text;
        this.logger.error(`大纲提取 AI 原始返回: ${previewText}`);
        return [];
      }

      return parseResult.data.scenes;
    } catch (error) {
      this.logger.error(`大纲提取异常: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * 按大纲批次分割非格式化剧本
   * 使用 anchorText 在原文中定位场景边界，实现真正的文本切分
   * @param content 原始剧本文本
   * @param outline 大纲数组（含 anchorText）
   * @param maxShotsPerBatch 每批次最大预估分镜数（默认 10）
   * @returns 批次数组，每个元素包含该批次对应的剧本片段和场景名称列表
   */
  private splitScriptByOutline(
    content: string,
    outline: Array<{
      sceneIndex: number;
      sceneName: string;
      summary: string;
      estimatedShots: number;
      anchorText?: string;
    }>,
    maxShotsPerBatch: number = 10,
  ): Array<{ batchIndex: number; rawText: string; sceneNames: string[] }> {
    interface SceneRange {
      start: number;
      end: number;
      estimatedShots: number;
      sceneName: string;
    }

    // 1. 用 anchorText 定位每个场景在 content 中的位置
    const sceneRanges: SceneRange[] = [];

    for (let i = 0; i < outline.length; i++) {
      const scene = outline[i];
      const anchor = scene.anchorText?.trim();

      let startPos = -1;

      if (anchor && anchor.length >= 5) {
        // 精确匹配：先尝试完整 anchorText
        startPos = content.indexOf(anchor);

        // 如果失败，尝试取前 30 字模糊匹配
        if (startPos === -1 && anchor.length > 30) {
          const shortAnchor = anchor.slice(0, 30);
          startPos = content.indexOf(shortAnchor);
        }

        // 再失败，尝试取前 15 字
        if (startPos === -1 && anchor.length > 15) {
          const miniAnchor = anchor.slice(0, 15);
          startPos = content.indexOf(miniAnchor);
        }
      }

      if (startPos === -1) {
        // fallback: 按场景索引估算目标位置，然后在附近找自然段落边界切分
        const targetPos = Math.floor((content.length / outline.length) * i);
        // 在目标位置前后 300 字范围内寻找最近的空行（\n\n）作为切分点
        const searchRange = 300;
        const searchStart = Math.max(0, targetPos - searchRange);
        const searchEnd = Math.min(content.length, targetPos + searchRange);
        const segment = content.slice(searchStart, searchEnd);

        // 找距离 targetPos 最近的空行
        let bestSplit = -1;
        let bestDistance = Infinity;
        const doubleNewlineRegex = /\n\s*\n/g;
        let match: RegExpExecArray | null;
        while ((match = doubleNewlineRegex.exec(segment)) !== null) {
          const absolutePos = searchStart + match.index;
          const distance = Math.abs(absolutePos - targetPos);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestSplit = absolutePos;
          }
        }

        // 如果找不到空行，退而寻找最近的单换行符
        if (bestSplit === -1) {
          const singleNewlineRegex = /\n/g;
          while ((match = singleNewlineRegex.exec(segment)) !== null) {
            const absolutePos = searchStart + match.index;
            const distance = Math.abs(absolutePos - targetPos);
            if (distance < bestDistance) {
              bestDistance = distance;
              bestSplit = absolutePos;
            }
          }
        }

        startPos = bestSplit !== -1 ? bestSplit : targetPos;
        this.logger.warn(
          `场景 "${scene.sceneName}" anchorText 定位失败，使用段落边界估算: startPos=${startPos}`,
        );
      } else {
        this.logger.debug(
          `场景 "${scene.sceneName}" anchorText 定位成功: startPos=${startPos}`,
        );
      }

      sceneRanges.push({
        start: startPos,
        end: -1,
        estimatedShots: scene.estimatedShots,
        sceneName: scene.sceneName,
      });
    }

    // 按 start 排序（防止 AI 返回的顺序与原文不一致）
    sceneRanges.sort((a, b) => a.start - b.start);

    // 确定每个场景的 end 位置（下一场景的 start，最后一场景到文末）
    for (let i = 0; i < sceneRanges.length; i++) {
      if (i < sceneRanges.length - 1) {
        sceneRanges[i].end = sceneRanges[i + 1].start;
      } else {
        sceneRanges[i].end = content.length;
      }
    }

    // 2. 按 estimatedShots 合并场景为批次
    const batches: Array<{
      batchIndex: number;
      rawText: string;
      sceneNames: string[];
    }> = [];
    let currentBatchScenes: SceneRange[] = [];
    let currentBatchShots = 0;

    for (let i = 0; i < sceneRanges.length; i++) {
      currentBatchScenes.push(sceneRanges[i]);
      currentBatchShots += sceneRanges[i].estimatedShots;

      // 当累积预估分镜数达到阈值，或已是最后一场景时，形成一批
      if (currentBatchShots >= maxShotsPerBatch || i === sceneRanges.length - 1) {
        const batchStart = currentBatchScenes[0].start;
        const batchEnd = currentBatchScenes[currentBatchScenes.length - 1].end;
        const batchText = content.slice(batchStart, batchEnd);

        batches.push({
          batchIndex: batches.length,
          rawText: batchText,
          sceneNames: currentBatchScenes.map((s) => s.sceneName),
        });

        currentBatchScenes = [];
        currentBatchShots = 0;
      }
    }

    // 兜底：如果没有任何批次，返回全文作为单一批次
    if (batches.length === 0 && outline.length > 0) {
      batches.push({
        batchIndex: 0,
        rawText: content,
        sceneNames: outline.map((s) => s.sceneName),
      });
    }

    this.logger.log(
      `剧本切分完成: ${outline.length} 个场景 → ${batches.length} 个批次`,
    );
    for (const b of batches) {
      this.logger.log(
        `  批次 ${b.batchIndex + 1}: 场景=[${b.sceneNames.join(", ")}], 文本长度=${b.rawText.length}`,
      );
    }

    return batches;
  }

  /**
   * 单批次分镜解析
   * @param batchText 该批次的剧本文本
   * @param batchIndex 批次索引（从 0 开始）
   * @param totalBatches 总批次数
   * @param modelId 模型 ID
   * @param characterMap 角色名称到 refId 的映射
   * @param sceneMap 场景名称到 refId 的映射
   * @param propMap 道具名称到 refId 的映射
   * @param isFormatted 是否为格式化剧本
   * @param taskId 任务 ID（用于日志）
   * @returns 该批次解析出的分镜数组（sequenceNumber 为批次内局部编号）
   */
  private async parseStoryboardBatch(
    batchText: string,
    batchIndex: number,
    totalBatches: number,
    modelId: string,
    characterMap: Map<string, string>,
    sceneMap: Map<string, string>,
    propMap: Map<string, string>,
    isFormatted: boolean,
    taskId: string,
    sceneNamesInBatch?: string[],
  ): Promise<
    Array<{
      sequenceNumber: number;
      sceneName: string;
      characterNames: string[];
      propNames: string[];
      description: string;
      shotType?: string;
      cameraAngle?: string;
      duration?: number;
      dialogues: Array<Record<string, unknown>>;
    }>
  > {
    try {
      const characterNames = Array.from(characterMap.keys());
      const sceneNames = Array.from(sceneMap.keys());
      const propNames = Array.from(propMap.keys());

      const result = await this.aiProvider.generateText(
        {
          prompt: buildStoryboardBatchParseUserPrompt({
            batchText,
            batchIndex,
            totalBatches,
            characterNames,
            sceneNames,
            propNames,
            isFormatted,
            sceneNamesInBatch,
          }),
          systemPrompt: STORYBOARD_BATCH_PARSE_SYSTEM_PROMPT,
          temperature: 0.3,
          maxTokens: 8000,
        },
        modelId,
      );

      const parseResult = parseAndValidateJson(
        result.text,
        StoryboardBatchParseResultSchema,
        ["storyboards"],
      );

      if (!parseResult.success || !parseResult.data) {
        this.logger.error(
          `批次 ${batchIndex + 1} 解析失败: ${parseResult.error}`,
        );
        // 打印详细校验错误和 AI 返回文本，便于排查问题
        if (parseResult.repairDetails) {
          this.logger.error(
            `批次 ${batchIndex + 1} 详细错误: ${parseResult.repairDetails}`,
          );
        }
        const previewText =
          result.text.length > 800
            ? result.text.slice(0, 800) + "..."
            : result.text;
        this.logger.error(
          `批次 ${batchIndex + 1} AI 原始返回: ${previewText}`,
        );
        return [];
      }

      // 确保返回的分镜数据有完整的默认值
      return parseResult.data.storyboards.map((sb) => ({
        ...sb,
        characterNames: sb.characterNames || [],
        propNames: sb.propNames || [],
        dialogues: sb.dialogues || [],
      }));
    } catch (error) {
      this.logger.error(
        `批次 ${batchIndex + 1} 解析异常: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * 合并多批次分镜结果并重新全局编号
   * @param batchResults 各批次结果数组
   * @returns 合并后的分镜数组，sequenceNumber 为全局连续编号
   */
  private mergeBatchResults(
    batchResults: Array<
      Array<{
        sequenceNumber: number;
        sceneName: string;
        characterNames?: string[];
        propNames?: string[];
        description: string;
        shotType?: string;
        cameraAngle?: string;
        cameraMovement?: string;
        duration?: number;
        dialogues?: Array<Record<string, unknown>>;
      }>
    >,
  ): Array<{
    sequenceNumber: number;
    sceneName: string;
    characterNames: string[];
    propNames: string[];
    description: string;
    shotType?: string;
    cameraAngle?: string;
    cameraMovement?: string;
    duration?: number;
    dialogues: Array<Record<string, unknown>>;
  }> {
    const merged: Array<{
      sequenceNumber: number;
      sceneName: string;
      characterNames: string[];
      propNames: string[];
      description: string;
      shotType?: string;
      cameraAngle?: string;
      cameraMovement?: string;
      duration?: number;
      dialogues: Array<Record<string, unknown>>;
    }> = [];

    let globalSequence = 1;

    for (const batch of batchResults) {
      // 按批次内顺序追加，重新分配全局编号
      for (const sb of batch) {
        merged.push({
          ...sb,
          sequenceNumber: globalSequence++,
          characterNames: sb.characterNames || [],
          propNames: sb.propNames || [],
          dialogues: sb.dialogues || [],
        });
      }
    }

    this.logger.log(
      `全局编号完成: 共 ${merged.length} 个分镜（来自 ${batchResults.length} 个批次）`,
    );

    return merged;
  }

  /**
   * 自动分批降级策略：当批次解析失败时，将批次拆分为更小的子批次
   * @param batchText 原始批次文本
   * @param batchIndex 批次索引
   * @param modelId 模型 ID
   * @param characterMap 角色映射
   * @param sceneMap 场景映射
   * @param propMap 道具映射
   * @param sceneSettingMap 场景设置映射
   * @param isFormatted 是否为格式化剧本
   * @param taskId 任务 ID
   * @param retryCount 当前重试次数（默认 0）
   * @returns 解析结果，若彻底失败则返回空数组
   */
  private async parseBatchWithSplitFallback(
    batchText: string,
    batchIndex: number,
    modelId: string,
    characterMap: Map<string, string>,
    sceneMap: Map<string, string>,
    propMap: Map<string, string>,
    sceneSettingMap: Map<string, { timeOfDay?: string; weather?: string }>,
    isFormatted: boolean,
    taskId: string,
    retryCount: number = 0,
    sceneNamesInBatch?: string[],
  ): Promise<
    Array<{
      sequenceNumber: number;
      sceneName: string;
      characterNames: string[];
      propNames: string[];
      description: string;
      shotType?: string;
      cameraAngle?: string;
      duration?: number;
      dialogues: Array<Record<string, unknown>>;
    }>
  > {
    const maxRetry = 2; // 最多再拆分 2 次（即最多 4 级拆分）

    // 1. 尝试直接解析当前批次
    const totalBatches = 1; // 降级拆分时不关心总批次数
    const result = await this.parseStoryboardBatch(
      batchText,
      batchIndex,
      totalBatches,
      modelId,
      characterMap,
      sceneMap,
      propMap,
      isFormatted,
      taskId,
      sceneNamesInBatch,
    );

    if (result.length > 0) {
      return result;
    }

    // 2. 解析失败，检查是否需要降级拆分
    if (retryCount >= maxRetry) {
      this.logger.error(
        `批次 ${batchIndex} 已达到最大重试次数，放弃解析`,
      );
      return [];
    }

    // 3. 自动降级：将批次拆分为多份（首次拆 4 份，后续对半拆）
    this.logger.warn(
      `批次 ${batchIndex} 解析失败，执行第 ${retryCount + 1} 次降级拆分`,
    );

    let subBatches: string[] = [];
    // 首次降级拆成 4 份更激进，后续再对半拆
    const splitCount = retryCount === 0 ? 4 : 2;

    if (isFormatted) {
      // 格式化剧本：按场景数均分
      const scenes = batchText
        .split(/(?=^\s*§\s+)/m)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      if (scenes.length <= 1) {
        this.logger.error(`批次 ${batchIndex} 只剩 1 个场景，无法继续拆分`);
        return [];
      }
      // 如果场景数不足 splitCount，按场景数拆分（至少每份 1 个场景）
      const actualSplitCount = Math.min(splitCount, scenes.length);
      const chunkSize = Math.ceil(scenes.length / actualSplitCount);
      for (let i = 0; i < scenes.length; i += chunkSize) {
        const chunk = scenes.slice(i, i + chunkSize);
        const text = chunk.join("\n\n");
        if (text.trim().length > 0) {
          subBatches.push(text);
        }
      }
    } else {
      // 非格式化剧本：按文本长度均分（寻找换行符作为分割点）
      const segmentSize = Math.floor(batchText.length / splitCount);
      let start = 0;
      for (let i = 1; i < splitCount; i++) {
        const target = start + segmentSize;
        let splitPoint = batchText.lastIndexOf("\n", target);
        if (splitPoint <= start) {
          splitPoint = target; // fallback
        }
        const segment = batchText.slice(start, splitPoint);
        if (segment.trim().length > 0) {
          subBatches.push(segment);
        }
        start = splitPoint;
      }
      // 最后一段
      const lastSegment = batchText.slice(start);
      if (lastSegment.trim().length > 0) {
        subBatches.push(lastSegment);
      }
    }

    if (subBatches.length < 2) {
      this.logger.error(`批次 ${batchIndex} 无法继续拆分，放弃解析`);
      return [];
    }

    // 4. 递归解析子批次
    const subResults: Array<
      Array<{
        sequenceNumber: number;
        sceneName: string;
        characterNames: string[];
        propNames: string[];
        description: string;
        shotType?: string;
        cameraAngle?: string;
        duration?: number;
        dialogues: Array<Record<string, unknown>>;
      }>
    > = [];

    for (let i = 0; i < subBatches.length; i++) {
      const subResult = await this.parseBatchWithSplitFallback(
        subBatches[i],
        batchIndex,
        modelId,
        characterMap,
        sceneMap,
        propMap,
        sceneSettingMap,
        isFormatted,
        taskId,
        retryCount + 1,
        undefined, // 降级拆分的子批次不再传递场景约束
      );
      if (subResult.length > 0) {
        subResults.push(subResult);
      }
    }

    // 5. 合并子批次结果
    if (subResults.length === 0) {
      return [];
    }

    return this.mergeBatchResults(subResults);
  }

  /**
   * 广播分镜解析批次进度
   * @param params 进度参数
   */
  private async broadcastStoryboardBatchProgress(params: {
    taskId: string;
    scriptId: string;
    status: "processing" | "completed" | "failed";
    progress: number;
    message: string;
    currentBatch?: number;
    totalBatches?: number;
    completedShots?: number;
    estimatedTotalShots?: number;
    result?: { shotGroups?: unknown[] };
    error?: { message?: string };
  }): Promise<void> {
    try {
      const {
        taskId,
        scriptId,
        status,
        progress,
        message,
        currentBatch,
        totalBatches,
        completedShots,
        estimatedTotalShots,
        result,
        error,
      } = params;

      // 将进度持久化到数据库，使前端刷新后可恢复
      try {
        const script = await this.scriptRepository.findOne({
          where: { id: scriptId },
        });
        if (script) {
          script.metadata = {
            ...script.metadata,
            storyboardParseProgress: progress,
            storyboardParseBatchInfo:
              currentBatch !== undefined && totalBatches !== undefined
                ? {
                    currentBatch,
                    totalBatches,
                    completedShots: completedShots || 0,
                    estimatedTotalShots,
                  }
                : undefined,
          };
          await this.scriptRepository.save(script);
        }
      } catch (saveErr) {
        this.logger.warn(
          `保存分镜解析进度到数据库失败: ${(saveErr as Error).message}`,
        );
      }

      await this.webSocketService.broadcastTaskProgress(taskId, {
        type: "storyboard:parse-progress",
        taskId,
        scriptId,
        status,
        progress,
        message,
        result,
        error,
        timestamp: new Date().toISOString(),
        batchInfo:
          currentBatch !== undefined && totalBatches !== undefined
            ? {
                currentBatch,
                totalBatches,
                completedShots: completedShots || 0,
                estimatedTotalShots,
              }
            : undefined,
      });
    } catch (err) {
      this.logger.warn(`广播分镜批次进度失败: ${(err as Error).message}`);
    }
  }

  /**
   * 将 StoryboardRef 数组转换为 ShotGroup 数组
   * @param storyboards 旧的分镜引用数组
   * @param refIdToAssetIdMap refId 到 assetId 的映射表
   * @returns 转换后的 ShotGroup 数组
   */
  private convertStoryboardsToShotGroups(
    storyboards: Array<{
      id: string;
      sequenceNumber: number;
      sceneId?: string;
      characterIds: string[];
      propIds: string[];
      dialogues: Array<{
        id: string;
        characterId?: string;
        characterName: string;
        text: string;
        emotion?: string;
        actions?: string[];
        isVoiceover: boolean;
      }>;
      description: string;
      shotType?: string;
      cameraAngle?: string;
      duration: number;
      createdAt: string;
      updatedAt: string;
      mode: "standard" | "quick" | "locked";
    }>,
    refIdToAssetIdMap: {
      characterMap: Map<string, string>;
      sceneMap: Map<string, string>;
      propMap: Map<string, string>;
    },
  ): Array<Record<string, unknown>> {
    const now = new Date().toISOString();

    return storyboards.map((sb) => {
      // 确保每个 dialogue 都有完整字段
      const dialogues = sb.dialogues.map((d, index) => {
        // 将对话中的 characterId（refId）转换为 assetId
        const refCharacterId = (d as Record<string, unknown>).characterId as string | undefined;
        const assetCharacterId = refCharacterId
          ? refIdToAssetIdMap.characterMap.get(refCharacterId) || refCharacterId
          : undefined;

        return {
          ...d,
          id: d.id || `${sb.id}_dialogue_${index}`,
          characterId: assetCharacterId, // 使用转换后的 assetId
          isVoiceover: d.isVoiceover || false,
          actions: d.actions || [],
        };
      });

      // 计算是否有非旁白对话
      const hasDialogue = dialogues.length > 0 && dialogues.some((d) => !d.isVoiceover);

      // 为每个 dialogue 创建一个对应的 shot
      const shots: Array<Record<string, unknown>> = dialogues.map((d) => ({
        id: `${d.id}_shot`,
        dialogueId: d.id,
        // 视频模式：有对话 → audio_reference，旁白/无对话 → video_only
        videoMode: d.isVoiceover ? "video_only" : hasDialogue ? "audio_reference" : "video_only",
        status: "pending",
        duration: sb.duration || 3,
      }));

      // 如果 dialogues 为空，也创建一个默认的 shot
      if (shots.length === 0) {
        shots.push({
          id: `${sb.id}_default_shot`,
          dialogueId: `${sb.id}_default_dialogue`,
          videoMode: "video_only",
          status: "pending",
          duration: sb.duration || 3,
        });
      }

      // 将 refId 转换为 assetId（前端通过 assetId 在 characterOptions 中查找名称）
      const characterAssetIds = sb.characterIds
        .map((refId) => refIdToAssetIdMap.characterMap.get(refId) || refId)
        .filter((id): id is string => !!id);
      const sceneAssetId = sb.sceneId
        ? refIdToAssetIdMap.sceneMap.get(sb.sceneId) || sb.sceneId
        : undefined;
      const propAssetIds = sb.propIds
        .map((refId) => refIdToAssetIdMap.propMap.get(refId) || refId)
        .filter((id): id is string => !!id);

      return {
        id: sb.id,
        sequenceNumber: sb.sequenceNumber,
        description: sb.description,
        // 画面信息
        mainImageId: undefined,
        mainImageKey: undefined,
        mainImageVersion: 0,
        // 主体检测状态
        detectionStatus: "pending",
        detectionError: undefined,
        detectedSubjects: [],
        // 角色框选配置
        characterRegions: {},
        // 出镜资源 - 使用 assetId
        characterIds: characterAssetIds,
        sceneId: sceneAssetId,
        propIds: propAssetIds,
        // 对话列表
        dialogues,
        // 子分镜列表
        shots,
        // 分镜组级别配置 - 参考模式默认多参考生视频
        referenceMode: "multi_reference",
        imageModelId: undefined,
        videoModelId: undefined,
        lipSyncModelId: undefined,
        // 时间戳
        createdAt: sb.createdAt || now,
        updatedAt: sb.updatedAt || now,
      };
    });
  }

  /**
   * 广播资产更新事件
   * 使用主 taskId 确保前端订阅能匹配到
   */
  private async broadcastAssetUpdate(
    assetType: "character" | "scene" | "prop" | "storyboard",
    taskId: string,
    data:
      | AssetCharacterUpdateWsData
      | AssetSceneUpdateWsData
      | AssetPropUpdateWsData
      | AssetStoryboardUpdateWsData,
  ): Promise<void> {
    try {
      // 通过 Redis Pub/Sub 广播，让主进程转发给 WebSocket 客户端
      // 使用主 taskId（前端订阅的任务ID），确保订阅匹配
      await this.webSocketService.broadcastTaskProgress(taskId, data as never);
    } catch (err) {
      this.logger.warn(`广播资产更新失败: ${(err as Error).message}`);
    }
  }

  /**
   * 处理完整剧本解析任务（旧版）
   * @deprecated 已废弃，前端未使用。新版请使用 processParseResourcesTask。
   */
  private async processParseScriptTask(job: Job): Promise<void> {
    const { taskId, requestData, modelId, providerId } = job.data;

    // 验证 modelId 必填
    if (!modelId) {
      this.logger.error(`解析任务缺少 modelId: ${taskId}`);
      await this.updateTaskStatus(taskId, AITaskStatus.FAILED, {
        error: "解析任务必须指定文本模型 (modelId)",
        errorCode: ErrorCode.PARSE_FAILED,
      });
      throw new Error("解析任务必须指定文本模型 (modelId)");
    }

    let aiTask: AITask | null = null;
    let script: Script | null = null;

    try {
      // 1. 更新任务状态为处理中
      await this.updateTaskStatus(taskId, AITaskStatus.PROCESSING);

      // 2. 获取任务和剧本信息（使用关系查询一次性获取）
      aiTask = await this.aiTaskRepository.findOne({
        where: { id: taskId },
        relations: ["script"],
      });

      if (!aiTask) {
        throw new Error(`AI 任务不存在: ${taskId}`);
      }

      script = aiTask.script;

      if (!script) {
        throw new Error(`剧本不存在: ${aiTask.scriptId}`);
      }

      // 推送开始解析进度
      await this.broadcastProgress({
        taskId,
        scriptId: script.id,
        status: "started",
        progress: 0,
      });

      // 3. 检查内容长度
      const content = requestData.content as string;
      if (!content || content.trim().length === 0) {
        throw new Error("导入内容不能为空");
      }

      // 4. 构建提示词
      const systemPrompt = SCRIPT_PARSE_SYSTEM_PROMPT;
      const userPrompt = buildScriptParseUserPrompt(content);

      // 5. 调用 AI 解析
      this.logger.log(
        `调用 AI 解析剧本: ${taskId}, 内容长度: ${content.length}, 模型: ${modelId}, 供应商: ${providerId || "default"}`,
      );
      const result = await this.aiProvider.generateText(
        {
          prompt: userPrompt,
          systemPrompt,
          temperature: 0.3, // 解析任务使用较低温度，更稳定
          maxTokens: 8000,
        },
        modelId, // 必填，已在开头验证
        providerId,
      );

      // 推送解析中进度
      await this.broadcastProgress({
        taskId,
        scriptId: script.id,
        status: "streaming",
        progress: 50,
      });

      // 6. 解析 JSON 结果
      const parsedContent = this.parseParsedContent(result.text);

      // 7. 为解析的内容分配 ID
      const structuredContent = assignIdsToScriptContent(
        parsedContent as Parameters<typeof assignIdsToScriptContent>[0],
      );

      // 8. 计算字数统计（使用共享工具函数）
      // 注意：旧版解析流程的数据结构与 ScriptContent 类型不一致
      const { wordCount, totalScenes, totalParagraphs } = calculateScriptStats(
        structuredContent as ScriptContentForStats,
      );

      // 9. 更新剧本内容
      script.title = parsedContent.title || "导入的剧本";
      script.content = structuredContent;
      script.metadata = {
        ...script.metadata,
        source: "import",
        aiGenerated: false,
        wordCount,
        totalScenes,
        totalParagraphs,
        importInfo: {
          filename: requestData.filename || "imported.txt",
          format: "txt",
        },
      };
      script.status = ScriptStatus.EDITING;

      await this.scriptRepository.save(script);

      // 10. 更新任务状态为完成
      await this.updateTaskStatus(taskId, AITaskStatus.COMPLETED, {
        result: {
          title: script.title,
          content: structuredContent,
          wordCount,
          totalScenes,
          totalParagraphs,
        },
        tokensUsed: result.usage.totalTokens,
        cost: calculateAICost(result.usage.totalTokens),
      });

      // 推送完成进度
      await this.broadcastProgress({
        taskId,
        scriptId: script.id,
        status: "completed",
        progress: 100,
        result: {
          title: script.title,
          content: structuredContent,
        },
      });

      this.logger.log(
        `剧本解析任务完成: ${taskId}, 剧本: ${script.id}, 字数: ${wordCount}`,
      );
    } catch (error) {
      const errorMessage = (error as Error).message || "未知错误";
      this.logger.error(`剧本解析任务失败: ${taskId}`);
      this.logger.debug(`详细错误信息: ${errorMessage}`);

      // 更新任务状态为失败（脱敏处理）
      await this.updateTaskStatus(taskId, AITaskStatus.FAILED, {
        error: "解析失败，请稍后重试",
        errorCode: ErrorCode.PARSE_FAILED,
      });

      // 推送失败进度（脱敏处理，不暴露原始错误信息）
      await this.broadcastProgress({
        taskId,
        scriptId: script?.id || "",
        status: "failed",
        error: {
          code: ErrorCode.PARSE_FAILED,
          message: "解析失败，请稍后重试",
          recoverable: true,
        },
      });

      // 更新剧本状态（使用已获取的script引用，避免重复查询）
      if (script) {
        script.status = ScriptStatus.EDITING;
        script.title = "解析失败，请重试";
        await this.scriptRepository.save(script);
      }

      throw error;
    }
  }

  /**
   * 更新任务状态
   */
  private async updateTaskStatus(
    taskId: string,
    status: AITaskStatusType,
    additionalData?: Record<string, unknown>,
  ): Promise<void> {
    const updateData: Partial<AITask> = {
      status,
    };

    if (status === AITaskStatus.PROCESSING) {
      updateData.startedAt = new Date();
    }

    if (status === AITaskStatus.COMPLETED || status === AITaskStatus.FAILED) {
      updateData.completedAt = new Date();
    }

    if (additionalData) {
      if (additionalData.result) {
        updateData.result = additionalData.result as Record<string, unknown>;
      }
      if (additionalData.tokensUsed) {
        updateData.progress = 100;
      }
      if (additionalData.error) {
        updateData.error = additionalData.error as string;
      }
    }

    // 使用 query builder 避免类型问题
    const updateFields: Record<string, unknown> = {};
    if (updateData.status !== undefined)
      updateFields.status = updateData.status;
    if (updateData.startedAt !== undefined)
      updateFields.startedAt = updateData.startedAt;
    if (updateData.completedAt !== undefined)
      updateFields.completedAt = updateData.completedAt;
    if (updateData.result !== undefined)
      updateFields.result = updateData.result;
    if (updateData.progress !== undefined)
      updateFields.progress = updateData.progress;
    if (updateData.error !== undefined) updateFields.error = updateData.error;

    await this.aiTaskRepository
      .createQueryBuilder()
      .update()
      .set(updateFields)
      .where("id = :taskId", { taskId })
      .execute();
  }

  /**
   * 解析 AI 解析的内容
   */
  private parseParsedContent(text: string): {
    title?: string;
    characters?: unknown[];
    scenes?: unknown[];
    props?: unknown[];
  } {
    // 使用共享工具函数安全解析 JSON
    const parsed = safeJsonParse<{
      title?: string;
      acts?: unknown[];
      characters?: unknown[];
      scenes?: unknown[];
      props?: unknown[];
      paragraphs?: unknown[];
      content?: unknown;
    }>(text);

    if (!parsed) {
      this.logger.error(`无法解析 AI 解析的内容`);
      this.logger.error(`原始内容: ${text.substring(0, 500)}...`);
      return this.buildFallbackStructure({ rawText: text });
    }

    // 验证必要字段（移除 acts 验证，直接检查 characters）
    if (!parsed.characters || !Array.isArray(parsed.characters)) {
      this.logger.error(`解析的内容缺少 characters 字段`);
      return this.buildFallbackStructure({ rawText: text });
    }

    // 返回解析结果（忽略 acts 字段）
    return {
      title: parsed.title,
      characters: parsed.characters,
      scenes: parsed.scenes,
      props: parsed.props,
    };
  }

  /**
   * 构建回退结构
   * 当 AI 解析失败时，将原始文本作为基本资源返回
   */
  private buildFallbackStructure(data: {
    rawText?: string;
    paragraphs?: unknown[];
    content?: unknown;
  }): {
    title: string;
    characters: Array<{
      name: string;
      description: string;
      importance: string;
    }>;
    scenes: Array<{
      name: string;
      description: string;
    }>;
    props: unknown[];
  } {
    const rawText = data.rawText || "";
    const lines = rawText.split("\n").filter((line) => line.trim());

    // 尝试从第一行提取标题
    const title = lines[0]?.trim() || "导入的剧本";

    // 从文本中提取角色（基于对话格式）
    const characters: Array<{
      name: string;
      description: string;
      importance: string;
    }> = [];
    const seenCharacters = new Set<string>();
    for (const line of lines.slice(1)) {
      // 检测对话格式：角色名：台词 或 角色名. 台词
      const match = line.match(/^([\u4e00-\u9fa5a-zA-Z]+)[：:.]/);
      if (match && !seenCharacters.has(match[1])) {
        seenCharacters.add(match[1]);
        characters.push({
          name: match[1],
          description: "",
          importance: "supporting",
        });
      }
    }

    return {
      title,
      characters,
      scenes: [
        {
          name: "默认场景",
          description: "未指定的场景",
        },
      ],
      props: [],
    };
  }

  /**
   * 检测段落类型
   */
  private detectParagraphType(line: string): string {
    // 检测对话格式：角色名：台词 或 角色名. 台词
    if (/^[\u4e00-\u9fa5a-zA-Z]+[：:.]/.test(line)) {
      return "dialogue";
    }
    // 检测括号内的内容作为旁白
    if (line.startsWith("（") && line.endsWith("）")) {
      return "narration";
    }
    return "action";
  }

  /**
   * 队列失败处理
   */
  @OnWorkerEvent("failed")
  async onFailed(job: Job, error: Error): Promise<void> {
    this.logger.error(`剧本解析任务 ${job.id} 失败`);
    this.logger.debug("详细错误信息:", error);

    const { taskId, type, requestData } = job.data;
    const maxAttempts = job.opts.attempts || 3;
    const attemptsMade = job.attemptsMade;

    // 只有在所有重试都失败后才更新状态
    this.logger.log(`任务失败，尝试次数: ${attemptsMade}/${maxAttempts}`);

    // 更新 AI 任务状态
    await this.aiTaskRepository.update(
      { id: taskId },
      {
        status: AITaskStatus.FAILED,
        completedAt: new Date(),
        error: "处理失败",
      },
    );

    // 更新剧本解析状态为失败（最终失败时）
    if (type === "parse-resources" && attemptsMade >= maxAttempts - 1) {
      const scriptId = requestData.scriptId;
      if (scriptId) {
        await this.scriptRepository.update(
          { id: scriptId },
          {
            metadata: () => `jsonb_set(
              COALESCE(metadata, '{}'::jsonb),
              '{parseStatus}',
              '"failed"'::jsonb
            ) || jsonb_build_object('parseError', '处理失败')`,
          },
        );
        this.logger.log(`剧本 ${scriptId} 解析状态已更新为 failed`);
      }
    }
  }

  /**
   * 广播任务进度
   */
  private async broadcastProgress({
    taskId,
    scriptId,
    status,
    progress,
    message,
    result,
    error,
  }: {
    taskId: string;
    scriptId: string;
    status: "started" | "streaming" | "completed" | "failed";
    progress?: number;
    message?: string;
    result?: {
      title?: string;
      content?: unknown;
      characters?: unknown[];
      scenes?: unknown[];
      props?: unknown[];
      shotGroups?: unknown[];
      dialogues?: unknown[];
    };
    error?: { code: string; message: string; recoverable: boolean };
  }): Promise<void> {
    try {
      await this.webSocketService.broadcastTaskProgress(taskId, {
        type: "script:parse-progress",
        taskId,
        scriptId,
        taskType: "parse",
        status,
        progress,
        message,
        result,
        error,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      this.logger.warn(`广播进度失败: ${(err as Error).message}`);
    }
  }

  /**
   * 广播分镜解析进度
   */
  private async broadcastStoryboardParseProgress({
    taskId,
    scriptId,
    status,
    progress,
    message,
    result,
    error,
  }: {
    taskId: string;
    scriptId: string;
    status?: "pending" | "processing" | "completed" | "failed";
    progress?: number;
    message?: string;
    result?: {
      shotGroups?: unknown[];
    };
    error?: {
      message?: string;
    };
  }): Promise<void> {
    try {
      await this.webSocketService.broadcastTaskProgress(taskId, {
        type: "storyboard:parse-progress",
        taskId,
        scriptId,
        status,
        progress,
        message,
        result,
        error,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      this.logger.warn(`广播分镜解析进度失败: ${(err as Error).message}`);
    }
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 预处理 JSON 中的性别值
   * 将中文性别值转换为英文，避免 Zod Schema 校验失败
   *
   * 支持的转换：
   * - "男" → "male"
   * - "女" → "female"
   * - 其他非标准值 → "unknown"
   *
   * @param text AI 返回的 JSON 文本
   * @returns 预处理后的 JSON 文本
   */
  /**
   * 预处理角色解析 JSON 文本
   * 1. 将中文性别值转换为英文（male/female）
   * 2. 将数字类型的 age 值转换为字符串
   */
  private preprocessGenderInJson(text: string): string {
    if (!text) return text;

    // 性别值映射表（支持中文和英文）
    const genderMap: Record<string, string> = {
      男: "male",
      女: "female",
      男性: "male",
      女性: "female",
      男生: "male",
      女生: "female",
      男士: "male",
      女士: "female",
      man: "male",
      woman: "female",
      male: "male",
      female: "female",
    };

    // 使用正则表达式匹配 gender 字段的值
    // 匹配模式："gender": "xxx" 或 "gender":"xxx"
    const genderPattern = /"gender"\s*:\s*"([^"]+)"/g;

    let processedText = text.replace(genderPattern, (match, value) => {
      const normalizedValue = value.toLowerCase().trim();
      const mappedValue = genderMap[normalizedValue] || genderMap[value];

      // 如果映射成功使用映射值，否则使用 unknown
      const finalValue = mappedValue || "unknown";

      if (finalValue !== normalizedValue && finalValue !== value) {
        this.logger.debug(
          `性别值转换: "${value}" → "${finalValue}"`,
        );
      }

      return `"gender": "${finalValue}"`;
    });

    // 预处理 age 字段：将数字类型转换为字符串
    // 匹配模式："age": 数字值（不带引号）
    const agePattern = /"age"\s*:\s*(\d+)\s*([,}])/g;
    processedText = processedText.replace(agePattern, (match, numValue, suffix) => {
      this.logger.debug(`年龄值转换: ${numValue} → "${numValue}"`);
      return `"age": "${numValue}"${suffix}`;
    });

    return processedText;
  }
}

// 导入类型
type AITaskStatusType = (typeof AITaskStatus)[keyof typeof AITaskStatus];
