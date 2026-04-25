/**
 * 资产步骤模块工厂
 * 为角色/场景/道具创建统一的 CRUD 操作方法
 *
 * 注意：此模块为将来进一步拆分预留，当前主 store 保留了所有逻辑
 */
import type { Ref } from "vue";
import type { CharacterRef, SceneRef, PropRef } from "@pixaura/shared-types";
import type { AssetStepKey, AssetStepState } from "../types";

// 步骤数据类型
interface StepsData {
  characters: AssetStepState<CharacterRef>;
  scenes: AssetStepState<SceneRef>;
  props: AssetStepState<PropRef>;
}

// Store 引用类型
interface StoreRefs {
  projectId: Ref<string>;
  scriptId: Ref<string>;
  steps: Ref<StepsData>;
  script: Ref<{ content: Record<string, unknown> } | null>;
}

/**
 * 创建资产步骤模块
 * 返回该步骤的 CRUD 操作方法
 *
 * @deprecated 当前未使用，主 store 已保留所有逻辑
 */
export function createAssetStepModule<
  T extends CharacterRef | SceneRef | PropRef,
>(_stepKey: AssetStepKey, _storeRefs: StoreRefs) {
  // 占位实现，将来拆分时使用
  return {
    getItems: (): T[] => [],
    getById: (_id: string): T | undefined => undefined,
    update: async (_id: string, _data: Partial<T>): Promise<void> => {},
    add: async (_newItem: T): Promise<void> => {},
    delete: async (_id: string): Promise<void> => {},
    batchUpdate: (_newItems: T[]): void => {},
    updateStatus: (_status: AssetStepState<T>["status"]): void => {},
    setModelId: (_modelId: string): void => {},
    startImageGeneration: (_id: string): void => {},
    updateImageProgress: (_id: string, _progress: number): void => {},
    finishImageGeneration: (_id: string): void => {},
    failImageGeneration: (_id: string, _error: string): void => {},
    toggleSelection: (_id: string): void => {},
    toggleAll: (_allIds: string[], _selected: boolean): void => {},
  };
}

export type AssetStepModule = ReturnType<typeof createAssetStepModule>;
