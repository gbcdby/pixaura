/**
 * 分镜步骤模块
 * 提供分镜的 CRUD 操作和视频/图片生成方法
 *
 * 注意：此模块为将来进一步拆分预留，当前主 store 保留了所有逻辑
 */
import type { Ref } from "vue";
import type { CharacterRef, SceneRef, PropRef } from "@pixaura/shared-types";
import type {
  StoryboardRef,
  StoryboardStepState,
  DialogueItem,
  StepStatusType,
} from "../types";

// 步骤数据类型
interface StepsData {
  characters: { items: CharacterRef[] };
  scenes: { items: SceneRef[] };
  props: { items: PropRef[] };
  storyboards: StoryboardStepState;
}

// Store 引用类型
interface StoreRefs {
  projectId: Ref<string>;
  scriptId: Ref<string>;
  steps: Ref<StepsData>;
  script: Ref<{ content: Record<string, unknown> } | null>;
}

/**
 * 创建分镜步骤模块
 *
 * @deprecated 当前未使用，主 store 已保留所有逻辑
 */
export function createStoryboardModule(_storeRefs: StoreRefs) {
  // 占位实现，将来拆分时使用
  return {
    getItems: (): StoryboardRef[] => [],
    getById: (_id: string): StoryboardRef | undefined => undefined,
    update: (_id: string, _data: Partial<StoryboardRef>): void => {},
    batchUpdate: (_newItems: StoryboardRef[]): void => {},
    add: (_newItem: StoryboardRef): void => {},
    delete: (_id: string): void => {},
    reorder: (_fromIndex: number, _toIndex: number): void => {},
    updateImages: (_id: string, _images: StoryboardRef["images"]): void => {},
    addImage: (
      _id: string,
      _image: NonNullable<StoryboardRef["images"]>[0],
    ): void => {},
    updateVideoGeneration: (
      _id: string,
      _videoGen: Partial<StoryboardRef["videoGeneration"]>,
    ): void => {},
    updateDialogues: (_id: string, _dialogues: DialogueItem[]): void => {},
    updateStatus: (_status: StepStatusType): void => {},
    setModelId: (_modelId: string): void => {},
    startImageGeneration: (_id: string): void => {},
    finishImageGeneration: (_id: string): void => {},
    failImageGeneration: (_id: string, _error: string): void => {},
    startDialogueGeneration: (_id: string): void => {},
    finishDialogueGeneration: (_id: string): void => {},
    toggleExpanded: (_id: string): void => {},
    startReordering: (): void => {},
    finishReordering: (): void => {},
    persist: async (): Promise<void> => {},
    buildContentForSave: (_overrides?: {
      shotGroups?: StoryboardRef[];
      shotGroupSettings?: Record<string, unknown>;
      dialogues?: DialogueItem[];
    }): Record<string, unknown> => ({}),
  };
}

export type StoryboardModule = ReturnType<typeof createStoryboardModule>;
