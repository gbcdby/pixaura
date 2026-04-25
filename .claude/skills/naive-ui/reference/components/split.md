# Split 面板分割

分割面板组件。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| direction | 'horizontal' \| 'vertical' | 'horizontal' | 分割方向 |
| min | number | 0 | 最小分割比例 |
| max | number | 1 | 最大分割比例 |
| default-size | number | 0.5 | 默认分割比例 |
| size | number | undefined | 分割比例（受控） |
| disabled | boolean | false | 是否禁用 |
| on-update:size | (size: number) => void | undefined | 分割比例变化回调 |
| on-drag-start | () => void | undefined | 拖拽开始回调 |
| on-drag-end | () => void | undefined | 拖拽结束回调 |

## Slots

- `1`: 第一个面板
- `2`: 第二个面板

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-split>
    <template #1>
      <div>左侧面板</div>
    </template>
    <template #2>
      <div>右侧面板</div>
    </template>
  </n-split>
  
  <!-- 垂直分割 -->
  <n-split direction="vertical">
    <template #1>
      <div>上面面板</div>
    </template>
    <template #2>
      <div>下面面板</div>
    </template>
  </n-split>
  
  <!-- 限制范围 -->
  <n-split :min="0.3" :max="0.7">
    <template #1>
      <div>左侧面板</div>
    </template>
    <template #2>
      <div>右侧面板</div>
    </template>
  </n-split>
</template>
```
