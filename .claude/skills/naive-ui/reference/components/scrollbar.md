# Scrollbar 滚动条

自定义滚动条组件。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| trigger | 'none' \| 'hover' | 'hover' | 触发方式 |
| x-scrollable | boolean | false | 是否可水平滚动 |
| on-scroll | (e: Event) => void | undefined | 滚动回调 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-scrollbar style="max-height: 120px">
    <div v-for="i in 20" :key="i">Item {{ i }}</div>
  </n-scrollbar>
  
  <!-- 水平滚动 -->
  <n-scrollbar x-scrollable>
    <div style="white-space: nowrap">
      <span v-for="i in 20" :key="i">Item {{ i }} </span>
    </div>
  </n-scrollbar>
  
  <!-- 总是显示滚动条 -->
  <n-scrollbar trigger="none" style="max-height: 120px">
    <div v-for="i in 20" :key="i">Item {{ i }}</div>
  </n-scrollbar>
</template>
```
