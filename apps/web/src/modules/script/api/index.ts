import { api } from "@/utils/request";
import type {
  CreateScriptDto,
  UpdateScriptDto,
  QueryScriptsDto,
  AIGenerateScriptDto,
  ImportScriptDto,
  AIContinueDto,
  AIRewriteDto,
  AIExpandDto,
  AICondenseDto,
  ImportAssetFromProjectDto,
  QueryImportableAssetsDto,
  ConfirmScriptDto,
  ScriptListItemDto,
  ScriptDetailDto,
  AITaskDto,
  CreateAndLinkAssetDto,
  LinkExistingAssetsDto,
  CreateAndLinkAssetResponse,
  LinkExistingAssetsResponse,
  ResolvedAssetResponse,
} from "@pixaura/shared-types";
import { ScriptContentSchema } from "@pixaura/shared-types";

const BASE_URL = "/projects";

/**
 * 剧本 API
 */
export const scriptApi = {
  /**
   * 创建空白剧本
   */
  createScript(projectId: string, data: CreateScriptDto) {
    return api.post<ScriptDetailDto>(`${BASE_URL}/${projectId}/scripts`, data);
  },

  /**
   * AI 生成剧本
   */
  generateScript(projectId: string, data: AIGenerateScriptDto) {
    return api.post<{ script: ScriptDetailDto; task: AITaskDto }>(
      `${BASE_URL}/${projectId}/ai-scripts/generate`,
      data,
    );
  },

  /**
   * 重新生成剧本（在原剧本上修改）
   */
  regenerateScript(
    projectId: string,
    scriptId: string,
    data: { modelId?: string; description?: string },
  ) {
    return api.post<{ taskId: string; status: string }>(
      `${BASE_URL}/${projectId}/ai-scripts/${scriptId}/regenerate`,
      data,
    );
  },

  /**
   * 导入剧本
   * @deprecated 已废弃，前端未使用。请使用手动创建后点击"一键解析"流程。
   */
  importScript(projectId: string, data: ImportScriptDto) {
    return api.post<{ script: ScriptDetailDto; task: AITaskDto }>(
      `${BASE_URL}/${projectId}/ai-scripts/import`,
      data,
    );
  },

  /**
   * 查询剧本列表
   */
  queryScripts(projectId: string, params: QueryScriptsDto) {
    return api.get<{
      list: ScriptListItemDto[];
      total: number;
      page: number;
      pageSize: number;
    }>(`${BASE_URL}/${projectId}/scripts`, { params });
  },

  /**
   * 获取剧本详情
   */
  getScript(projectId: string, scriptId: string) {
    return api.get<ScriptDetailDto>(
      `${BASE_URL}/${projectId}/scripts/${scriptId}`,
    );
  },

  /**
   * 更新剧本
   */
  updateScript(projectId: string, scriptId: string, data: UpdateScriptDto) {
    // 如果有 content，进行 Zod 校验
    if (data.content) {
      const parseResult = ScriptContentSchema.safeParse(data.content);
      if (!parseResult.success) {
        console.error("Content 校验失败:", parseResult.error.format());
        throw new Error(
          `剧本内容格式错误: ${parseResult.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`,
        );
      }
      data.content = parseResult.data;
    }
    return api.put<ScriptDetailDto>(
      `${BASE_URL}/${projectId}/scripts/${scriptId}`,
      data,
    );
  },

  /**
   * 删除剧本
   */
  deleteScript(projectId: string, scriptId: string) {
    return api.delete(`${BASE_URL}/${projectId}/scripts/${scriptId}`);
  },

  /**
   * 更新剧本描述
   * 使用专门的端点，支持更长的描述内容（10-5000字符）
   */
  updateScriptDescription(
    projectId: string,
    scriptId: string,
    content: string,
    autoSave: boolean = true,
  ) {
    return api.put<{ id: string; content: string; updatedAt: string }>(
      `${BASE_URL}/${projectId}/scripts/${scriptId}/description`,
      { content, autoSave },
    );
  },

  // ==================== AI 辅助编辑 ====================

  /**
   * AI 续写
   */
  continueWithAI(projectId: string, scriptId: string, data: AIContinueDto) {
    return api.post<AITaskDto>(
      `${BASE_URL}/${projectId}/ai-scripts/${scriptId}/ai-continue`,
      data,
    );
  },

  /**
   * AI 改写
   */
  rewriteWithAI(projectId: string, scriptId: string, data: AIRewriteDto) {
    return api.post<AITaskDto>(
      `${BASE_URL}/${projectId}/ai-scripts/${scriptId}/ai-rewrite`,
      data,
    );
  },

  /**
   * AI 扩写
   */
  expandWithAI(projectId: string, scriptId: string, data: AIExpandDto) {
    return api.post<AITaskDto>(
      `${BASE_URL}/${projectId}/ai-scripts/${scriptId}/ai-expand`,
      data,
    );
  },

  /**
   * AI 缩写
   */
  condenseWithAI(projectId: string, scriptId: string, data: AICondenseDto) {
    return api.post<AITaskDto>(
      `${BASE_URL}/${projectId}/ai-scripts/${scriptId}/ai-condense`,
      data,
    );
  },

  /**
   * 获取 AI 任务状态
   */
  getAITask(projectId: string, scriptId: string, taskId: string) {
    return api.get<AITaskDto>(
      `${BASE_URL}/${projectId}/ai-scripts/${scriptId}/ai-tasks/${taskId}`,
    );
  },

  /**
   * 取消 AI 任务
   */
  cancelAITask(projectId: string, scriptId: string, taskId: string) {
    return api.post<AITaskDto>(
      `${BASE_URL}/${projectId}/ai-scripts/${scriptId}/ai-tasks/${taskId}/cancel`,
    );
  },

  /**
   * 重试 AI 任务
   */
  retryAITask(projectId: string, scriptId: string, taskId: string) {
    return api.post<{ taskId: string; status: string }>(
      `${BASE_URL}/${projectId}/ai-scripts/${scriptId}/ai-tasks/${taskId}/retry`,
    );
  },

  // ==================== 跨项目资产导入 ====================

  /**
   * 查询可导入的资产列表
   */
  queryImportableAssets(projectId: string, params: QueryImportableAssetsDto) {
    return api.get<{ list: unknown[]; total: number }>(
      `${BASE_URL}/${projectId}/scripts/importable-assets`,
      { params },
    );
  },

  /**
   * 从其他项目导入资产
   */
  importAsset(
    projectId: string,
    scriptId: string,
    data: ImportAssetFromProjectDto,
  ) {
    return api.post(
      `${BASE_URL}/${projectId}/scripts/${scriptId}/import-asset`,
      data,
    );
  },

  // ==================== 剧本确认 ====================

  /**
   * 获取确认预览
   */
  getConfirmPreview(projectId: string, scriptId: string) {
    return api.get<Record<string, unknown>>(
      `${BASE_URL}/${projectId}/scripts/${scriptId}/confirm-preview`,
    );
  },

  /**
   * 确认剧本
   */
  confirmScript(projectId: string, scriptId: string, data: ConfirmScriptDto) {
    return api.post<ScriptDetailDto>(
      `${BASE_URL}/${projectId}/scripts/${scriptId}/confirm`,
      data,
    );
  },

  /**
   * 解析剧本资源（角色/场景/道具）
   * @param force 是否强制重新解析（会清理已有素材）
   */
  parseScriptResources(
    projectId: string,
    scriptId: string,
    force: boolean = false,
  ) {
    return api.post<{
      taskId: string;
      status: string;
      message: string;
    }>(
      `${BASE_URL}/${projectId}/scripts/${scriptId}/parse-resources?force=${force}`,
    );
  },

  /**
   * 获取剧本资源解析任务状态
   */
  getParseTaskStatus(projectId: string, scriptId: string) {
    return api.get<{
      hasTask: boolean;
      taskId?: string;
      status?: string;
      progress?: number;
      result?: {
        characters?: unknown[];
        scenes?: unknown[];
        props?: unknown[];
      };
      error?: string;
    }>(`${BASE_URL}/${projectId}/scripts/${scriptId}/parse-resources/status`);
  },

  /**
   * 解析分镜数据
   * 独立于资源解析，需要已有角色或场景数据
   * @param force 是否强制重新解析
   */
  parseStoryboards(projectId: string, scriptId: string, force: boolean = false) {
    return api.post<{
      taskId: string;
      status: string;
      message?: string;
    }>(
      `${BASE_URL}/${projectId}/scripts/${scriptId}/parse-storyboards?force=${force}`,
    );
  },

  // ==================== 资产查重 ====================

  /**
   * 单个资产查重（生成前主动检查）
   */
  checkAssetDedup(
    projectId: string,
    scriptId: string,
    refId: string,
    assetType: "character" | "scene" | "prop",
  ) {
    return api.get<{
      matched: boolean;
      matchedAsset: {
        id: string;
        name: string;
        description: string;
        coverUrl: string | null;
      } | null;
    }>(`${BASE_URL}/${projectId}/scripts/${scriptId}/assets/${refId}/dedup`, {
      params: { assetType },
    });
  },

  /**
   * 批量查重（对所有 will_create 资产重新检查）
   */
  batchDedupCheck(projectId: string, scriptId: string) {
    return api.post<{
      checked: number;
      matched: number;
      updated: number;
      details: {
        characters: { checked: number; matched: number };
        scenes: { checked: number; matched: number };
        props: { checked: number; matched: number };
      };
    }>(`${BASE_URL}/${projectId}/scripts/${scriptId}/assets/dedup-check`);
  },

  /**
   * 上传资产参考图（通过 URL 或 Blob URL 添加参考图记录）
   */
  uploadAssetReferenceImage(
    projectId: string,
    scriptId: string,
    assetId: string,
    data: { url: string; thumbnailUrl?: string; type?: string },
  ) {
    return api.post<{
      id: string;
      url: string;
      thumbnailUrl?: string;
      type: string;
      createdAt: string;
    }>(
      `${BASE_URL}/${projectId}/scripts/${scriptId}/assets/${assetId}/images/upload`,
      data,
    );
  },

  /**
   * 上传资产参考图文件（真实文件上传，返回持久化 URL）
   */
  uploadAssetImageFile(
    projectId: string,
    scriptId: string,
    assetId: string,
    file: File,
    imageType: "main" | "reference" | "video_reference" = "reference",
  ) {
    const formData = new FormData();
    formData.append("file", file);
    return api.post<{
      id: string;
      url: string;
      thumbnailUrl?: string;
      type: string;
      createdAt: string;
    }>(
      `${BASE_URL}/${projectId}/scripts/${scriptId}/assets/${assetId}/images/upload-file?imageType=${imageType}`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
  },

  /**
   * 上传视频参考图（imageType=video_reference）
   */
  uploadAssetVideoReferenceImageFile(
    projectId: string,
    scriptId: string,
    assetId: string,
    file: File,
  ) {
    return this.uploadAssetImageFile(
      projectId,
      scriptId,
      assetId,
      file,
      "video_reference",
    );
  },

  /**
   * @deprecated 使用 uploadAssetImageFile 并传 imageType="reference"
   */
  uploadAssetReferenceImageFile(
    projectId: string,
    scriptId: string,
    assetId: string,
    file: File,
  ) {
    return this.uploadAssetImageFile(
      projectId,
      scriptId,
      assetId,
      file,
      "reference",
    );
  },

  /**
   * 删除资产图片
   */
  deleteAssetImage(
    projectId: string,
    scriptId: string,
    assetId: string,
    imageId: string,
  ) {
    return api.delete(
      `${BASE_URL}/${projectId}/scripts/${scriptId}/assets/${assetId}/images/${imageId}`,
    );
  },

  // ==================== 资产图片生成 ====================

  /**
   * 触发单个资产图片生成（角色/场景/道具）
   * aspectRatio 用于控制图片比例（如 "9:16"），场景图片应与剧本分辨率一致
   */
  generateAssetImage(
    projectId: string,
    scriptId: string,
    refId: string,
    data?: {
      modelId?: string;
      customPrompt?: string;
      negativePrompt?: string;
      aspectRatio?: string;
    },
  ) {
    return api.post<{
      taskId: string;
      status: string;
      refId: string;
      estimatedTime: number;
    }>(
      `${BASE_URL}/${projectId}/scripts/${scriptId}/assets/${refId}/generate-image`,
      data || {},
    );
  },

  /**
   * 批量触发资产图片生成（角色/场景/道具）
   * aspectRatio 用于控制图片比例（如 "9:16"），场景图片应与剧本分辨率一致
   */
  batchGenerateAssetImages(
    projectId: string,
    scriptId: string,
    data: {
      assetType: "character" | "scene" | "prop";
      modelId?: string;
      negativePrompt?: string;
      aspectRatio?: string;
    },
  ) {
    return api.post<{
      tasks: Array<{ refId: string; taskId: string; status: string }>;
      skipped: Array<{ refId: string; reason: string }>;
      total: number;
      started: number;
    }>(
      `${BASE_URL}/${projectId}/scripts/${scriptId}/assets/batch-generate-images`,
      data,
    );
  },

  /**
   * 查询资产最新图片生成任务状态（WebSocket 断线降级轮询）
   */
  getAssetImageTaskStatus(
    projectId: string,
    scriptId: string,
    refId: string,
    assetType: "character" | "scene" | "prop",
  ) {
    return api.get<{
      taskId: string;
      refId: string;
      status: "pending" | "processing" | "completed" | "failed";
      progress: number;
      createdAt: string;
      updatedAt: string;
      result: {
        imageId: string;
        url: string;
        thumbnailUrl: string;
      } | null;
    } | null>(
      `${BASE_URL}/${projectId}/scripts/${scriptId}/assets/${refId}/image-tasks/latest`,
      { params: { assetType } },
    );
  },

  // ==================== 分镜视频/对话生成 ====================

  /**
   * BUG-06: 触发分镜视频生成（异步，WebSocket 推送进度）
   * 后端自动从数据库构建参考图 URL 列表
   */
  generateStoryboardVideo(
    projectId: string,
    scriptId: string,
    storyboardId: string,
    data?: { modelId?: string },
  ) {
    return api.post<{
      taskId: string;
      storyboardId: string;
      status: "pending" | "processing";
      estimatedTime: number;
    }>(
      `${BASE_URL}/${projectId}/scripts/${scriptId}/storyboards/generate-video`,
      { storyboardId, ...data },
    );
  },

  /**
   * BUG-07: AI 生成分镜对话台词（同步直接返回）
   */
  generateStoryboardDialogue(
    projectId: string,
    scriptId: string,
    storyboardId: string,
    data?: { modelId?: string },
  ) {
    return api.post<{
      storyboardId: string;
      dialogues: Array<{
        id: string;
        characterId?: string;
        characterName: string;
        text: string;
        emotion?: string;
        isVoiceover?: boolean;
      }>;
    }>(
      `${BASE_URL}/${projectId}/scripts/${scriptId}/storyboards/generate-dialogue`,
      { storyboardId, ...data },
    );
  },

  /**
   * 一键 AI 生成所有分镜（异步队列，通过 WebSocket 推送进度）
   */
  generateAllStoryboards(
    projectId: string,
    scriptId: string,
    data?: { modelId?: string },
  ) {
    return api.post<{
      taskId: string;
      status: string;
      estimatedTime: number;
    }>(
      `${BASE_URL}/${projectId}/scripts/${scriptId}/storyboards/generate-all`,
      data || {},
    );
  },

  // ==================== 分镜对话音频生成 ====================

  /**
   * 生成单条对话音频
   */
  generateDialogueAudio(
    projectId: string,
    scriptId: string,
    storyboardId: string,
    dialogueId: string,
    data?: {
      voiceId?: string;
      speed?: number;
      emotion?: string;
      instructions?: { templateId?: string; content: string };
    },
  ) {
    return api.post<{
      dialogueId: string;
      audioUrl: string;
      duration: number;
      status: "completed";
      shotGroupDuration: number;
    }>(
      `${BASE_URL}/${projectId}/scripts/${scriptId}/storyboards/${storyboardId}/dialogues/${dialogueId}/audio`,
      data || {},
    );
  },

  /**
   * 获取对话音频状态
   */
  getDialogueAudioStatus(
    projectId: string,
    scriptId: string,
    storyboardId: string,
    dialogueId: string,
  ) {
    return api.get<{
      audioUrl?: string;
      audioDuration?: number;
      audioStatus?: string;
    }>(
      `${BASE_URL}/${projectId}/scripts/${scriptId}/storyboards/${storyboardId}/dialogues/${dialogueId}/audio`,
    );
  },

  /**
   * 删除对话音频
   */
  deleteDialogueAudio(
    projectId: string,
    scriptId: string,
    storyboardId: string,
    dialogueId: string,
  ) {
    return api.delete<{
      success: boolean;
      message: string;
      data?: { shotGroupDuration: number };
    }>(
      `${BASE_URL}/${projectId}/scripts/${scriptId}/storyboards/${storyboardId}/dialogues/${dialogueId}/audio`,
    );
  },

  /**
   * 批量生成分镜所有对话音频
   */
  generateStoryboardAudio(
    projectId: string,
    scriptId: string,
    storyboardId: string,
    data?: { voiceId?: string; speed?: number },
  ) {
    return api.post<{
      total: number;
      results: Array<{
        dialogueId: string;
        audioUrl: string;
        duration: number;
        status: "completed";
        shotGroupDuration: number;
      }>;
    }>(
      `${BASE_URL}/${projectId}/scripts/${scriptId}/storyboards/${storyboardId}/audio/generate-all`,
      data || {},
    );
  },

  // ==================== 模型配置 ====================

  /**
   * 获取剧本模型配置
   */
  getScriptModelConfigs(projectId: string, scriptId: string) {
    return api.get<{
      configs: Array<{ step: string; modelId: string }>;
    }>(`${BASE_URL}/${projectId}/scripts/${scriptId}/models`);
  },

  // ==================== 分镜组（ShotGroup）====================

  /**
   * 触发主体检测
   * 自动检测分镜主图中的人物主体
   * 返回坐标区域，不返回 mask 图片
   */
  detectSubjects(projectId: string, scriptId: string, shotGroupId: string) {
    return api.post<{
      shotGroupId: string;
      status: "pending" | "processing" | "completed" | "failed";
      detectedSubjects?: Array<{
        index: number;
        region: {
          x: number;
          y: number;
          width: number;
          height: number;
        };
        area?: number;
      }>;
      detectionError?: string;
    }>(
      `${BASE_URL}/${projectId}/scripts/${scriptId}/shotGroups/${shotGroupId}/detect-subjects`,
      {},
    );
  },

  /**
   * 生成对口型视频
   * 使用 OmniHuman1.5 模型生成分镜视频
   * croppedImageUrl 和 audioUrl 是前端已处理的临时文件 URL（可选）
   */
  generateLipSyncVideo(
    projectId: string,
    scriptId: string,
    shotGroupId: string,
    shotId: string,
    data?: {
      modelId?: string;
      audioUrl?: string;
      characterId?: string;  // 添加角色ID参数（后端必填）
      croppedImageUrl?: string;  // 前端已裁切的图片 URL
    },
  ) {
    return api.post<{
      taskId: string;
      shotGroupId: string;
      shotId: string;
      status: "pending" | "processing";
      estimatedTime: number;
    }>(
      `${BASE_URL}/${projectId}/scripts/${scriptId}/shotGroups/${shotGroupId}/shots/${shotId}/lipsync`,
      data || {},
    );
  },

  /**
   * 查询对口型视频生成状态
   */
  getLipSyncVideoStatus(
    projectId: string,
    scriptId: string,
    shotGroupId: string,
    shotId: string,
  ) {
    return api.get<{
      shotId: string;
      status: "pending" | "processing" | "completed" | "failed";
      progress: number;
      videoUrl?: string;
      error?: string;
    }>(
      `${BASE_URL}/${projectId}/scripts/${scriptId}/shotGroups/${shotGroupId}/shots/${shotId}/lipsync/status`,
    );
  },

  /**
   * 上传手动框选坐标
   * 只存储坐标区域，后端根据坐标处理
   */
  uploadManualRegion(
    projectId: string,
    scriptId: string,
    shotGroupId: string,
    data: {
      characterId: string;
      region: { x: number; y: number; width: number; height: number };
    },
  ) {
    return api.post<{
      shotGroupId: string;
      characterId: string;
      region: { x: number; y: number; width: number; height: number };
    }>(
      `${BASE_URL}/${projectId}/scripts/${scriptId}/shotGroups/${shotGroupId}/regions/manual`,
      data,
    );
  },

  /**
   * 更新角色框选配置
   * 只存储坐标信息，不存储 mask 图片
   */
  updateCharacterRegions(
    projectId: string,
    scriptId: string,
    shotGroupId: string,
    data: {
      regions: Record<
        string,
        {
          detectedIndex?: number;
          useManual?: boolean;
          manualRegion?: { x: number; y: number; width: number; height: number };
        }
      >;
    },
  ) {
    return api.post<{
      shotGroupId: string;
      characterRegions: Record<string, {
        detectedIndex?: number;
        useManual: boolean;
        manualRegion?: { x: number; y: number; width: number; height: number };
      }>;
      updatedAt: string;
    }>(
      `${BASE_URL}/${projectId}/scripts/${scriptId}/shotGroups/${shotGroupId}/regions`,
      data,
    );
  },

  // ==================== 临时文件穿透（ngrok 方案）====================

  /**
   * 上传裁切后的图片到临时目录
   * 用于对口型视频生成，将前端裁切的图片保存到临时目录供火山引擎访问
   */
  uploadCroppedImage(
    projectId: string,
    scriptId: string,
    shotGroupId: string,
    characterId: string,
    file: Blob,
  ) {
    const formData = new FormData();
    formData.append("file", file, "cropped.png");
    return api.post<{
      key: string;
      url: string;
    }>(
      `${BASE_URL}/${projectId}/scripts/${scriptId}/shotGroups/${shotGroupId}/upload-cropped-image?characterId=${encodeURIComponent(characterId)}`,
      formData,
    );
  },

  /**
   * 复制对话音频到临时目录
   * 用于对口型视频生成，将音频复制到临时目录供火山引擎访问
   */
  copyDialogueAudioToTemp(
    projectId: string,
    scriptId: string,
    shotGroupId: string,
    dialogueId: string,
  ) {
    return api.post<{
      key: string;
      url: string;
    }>(
      `${BASE_URL}/${projectId}/scripts/${scriptId}/shotGroups/${shotGroupId}/copy-dialogue-audio`,
      { dialogueId },
    );
  },

  // ==================== 剧本资产创建与关联 ====================

  /**
   * 创建资产并关联到剧本
   * 用于"新建资产"功能：先创建资产到项目资产库，再关联引用到剧本
   */
  createAndLinkAsset(
    projectId: string,
    scriptId: string,
    data: CreateAndLinkAssetDto,
  ) {
    return api.post<CreateAndLinkAssetResponse>(
      `${BASE_URL}/${projectId}/scripts/${scriptId}/assets/create-and-link`,
      data,
    );
  },

  /**
   * 关联已有资产到剧本
   * 用于"从项目导入"功能：从项目资产库选择已有资产，批量关联引用到剧本
   */
  linkExistingAssets(
    projectId: string,
    scriptId: string,
    data: LinkExistingAssetsDto,
  ) {
    return api.post<LinkExistingAssetsResponse>(
      `${BASE_URL}/${projectId}/scripts/${scriptId}/assets/link-existing`,
      data,
    );
  },

  // ==================== 统一数据源 ====================

  /**
   * 获取剧本关联资产的完整数据（Ref + 素材库 Asset 组合）
   * 用于前端显示素材库的完整数据
   */
  getResolvedAssets(projectId: string, scriptId: string) {
    return api.get<ResolvedAssetResponse>(
      `${BASE_URL}/${projectId}/scripts/${scriptId}/assets/resolved`,
    );
  },

  // ==================== BGM 配乐管理 ====================

  /**
   * 获取剧本的所有 BGM 配乐
   */
  getBgmTracks(projectId: string, scriptId: string) {
    return api.get<{
      bgmTracks: Array<{
        id: string;
        url: string;
        duration: number;
        style?: string;
        mode: "overall" | "individual";
        source?: "ai" | "user";
        targetShotGroupId?: string;
        timelineStart: number;
        volume: number;
        muted: boolean;
        modelId?: string;
        createdAt: string;
      }>;
    }>(`${BASE_URL}/${projectId}/scripts/${scriptId}/bgm`);
  },

  /**
   * 添加 BGM 配乐
   */
  addBgm(
    projectId: string,
    scriptId: string,
    data: {
      id: string;
      url: string;
      duration: number;
      style?: string;
      mode: "overall" | "individual";
      source?: "ai" | "user";
      targetShotGroupId?: string;
      timelineStart: number;
      volume: number;
      muted: boolean;
      modelId?: string;
      createdAt: string;
    },
  ) {
    return api.post<{
      id: string;
      url: string;
      duration: number;
      style?: string;
      mode: "overall" | "individual";
      targetShotGroupId?: string;
      timelineStart: number;
      volume: number;
      muted: boolean;
      createdAt: string;
    }>(`${BASE_URL}/${projectId}/scripts/${scriptId}/bgm`, data);
  },

  /**
   * 更新 BGM 配乐
   */
  updateBgm(
    projectId: string,
    scriptId: string,
    bgmId: string,
    data: Partial<{
      url: string;
      duration: number;
      style: string;
      mode: "overall" | "individual";
      targetShotGroupId: string;
      timelineStart: number;
      volume: number;
      muted: boolean;
    }>,
  ) {
    return api.patch<{
      id: string;
      url: string;
      duration: number;
      style?: string;
      mode: "overall" | "individual";
      targetShotGroupId?: string;
      timelineStart: number;
      volume: number;
      muted: boolean;
      createdAt: string;
    }>(`${BASE_URL}/${projectId}/scripts/${scriptId}/bgm/${bgmId}`, data);
  },

  /**
   * 删除 BGM 配乐
   */
  removeBgm(projectId: string, scriptId: string, bgmId: string) {
    return api.delete(`${BASE_URL}/${projectId}/scripts/${scriptId}/bgm/${bgmId}`);
  },
};
