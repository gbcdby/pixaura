declare module "vuedraggable" {
  import type { Component } from "vue";

  interface DraggableProps<T> {
    modelValue?: T[];
    list?: T[];
    itemKey?: string | ((item: T) => string);
    disabled?: boolean;
    handle?: string;
    filter?: string;
    ghostClass?: string;
    dragClass?: string;
    animation?: number;
    group?:
      | string
      | {
          name: string;
          pull?: boolean | string | string[];
          put?: boolean | string | string[];
        };
    sort?: boolean;
    delay?: number;
    delayOnTouchOnly?: boolean;
    touchStartThreshold?: number;
    disabledDraggable?: boolean;
    move?: (evt: {
      dragged: T;
      related: T;
      draggedContext: unknown;
      relatedContext: unknown;
    }) => boolean;
    clone?: (item: T) => T;
  }

  interface DraggableEvents<T> {
    "update:modelValue": (value: T[]) => void;
    "update:list": (value: T[]) => void;
    start: (evt: { item: T; oldIndex: number }) => void;
    end: (evt: { item: T; oldIndex: number; newIndex: number }) => void;
    add: (evt: { item: T; newIndex: number }) => void;
    remove: (evt: { item: T; oldIndex: number }) => void;
  }

  const draggable: Component<
    DraggableProps<unknown>,
    unknown,
    unknown,
    unknown,
    DraggableEvents<unknown>
  >;
  export default draggable;
}
