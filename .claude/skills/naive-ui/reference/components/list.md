# List 列表

通用列表组件。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| bordered | boolean | false | 是否有边框 |
| clickable | boolean | false | 是否可点击 |
| hoverable | boolean | false | 是否可悬停 |
| size | 'small' \| 'medium' \| 'large' | 'medium' | 尺寸 |
| show-divider | boolean | true | 是否显示分割线 |

## ListItem Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| on-click | (e: MouseEvent) => void | undefined | 点击回调 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-list>
    <n-list-item>列表项1</n-list-item>
    <n-list-item>列表项2</n-list-item>
    <n-list-item>列表项3</n-list-item>
  </n-list>
  
  <!-- 带边框 -->
  <n-list bordered>
    <n-list-item>列表项1</n-list-item>
    <n-list-item>列表项2</n-list-item>
  </n-list>
  
  <!-- 可悬停 -->
  <n-list hoverable>
    <n-list-item>列表项1</n-list-item>
    <n-list-item>列表项2</n-list-item>
  </n-list>
  
  <!-- 可点击 -->
  <n-list clickable>
    <n-list-item @click="handleClick">列表项1</n-list-item>
    <n-list-item @click="handleClick">列表项2</n-list-item>
  </n-list>
</template>
```
