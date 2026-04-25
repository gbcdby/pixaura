# Infinite Scroll 无限滚动

无限滚动加载组件。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| distance | number | 0 | 触发加载的距离阈值 |
| disabled | boolean | false | 是否禁用 |
| on-load | () => Promise<void> | undefined | 加载回调 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-infinite-scroll :on-load="handleLoad">
    <div v-for="item in items" :key="item.id">{{ item.name }}</div>
  </n-infinite-scroll>
  
  <!-- 自定义距离 -->
  <n-infinite-scroll :distance="100" :on-load="handleLoad">
    <div v-for="item in items" :key="item.id">{{ item.name }}</div>
  </n-infinite-scroll>
</template>

<script setup>
const items = ref([])

const handleLoad = async () => {
  // 加载更多数据
  const newItems = await fetchMoreData()
  items.value.push(...newItems)
}
</script>
```
