# Virtual List 虚拟列表

虚拟滚动列表组件。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| items | Array | [] | 列表数据 |
| item-size | number | undefined | 每项高度 |
| key-field | string | 'key' | 键字段 |
| visible-items | number | undefined | 可见项数 |
| default-scroll-index | number | undefined | 默认滚动到的索引 |
| scrollbar-props | object | undefined | 滚动条属性 |
| on-scroll | (e: Event) => void | undefined | 滚动回调 |
| on-update:scroll-index | (index: number) => void | undefined | 滚动索引变化回调 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-virtual-list
    :items="items"
    :item-size="42"
    style="max-height: 400px"
  >
    <template #default="{ item }">
      <div class="item">{{ item.name }}</div>
    </template>
  </n-virtual-list>
  
  <!-- 大量数据 -->
  <n-virtual-list
    :items="largeData"
    :item-size="50"
    key-field="id"
    style="max-height: 500px"
  >
    <template #default="{ item, index }">
      <div class="item">{{ index }} - {{ item.name }}</div>
    </template>
  </n-virtual-list>
</template>

<script setup>
const items = ref([
  { key: '1', name: 'Item 1' },
  { key: '2', name: 'Item 2' },
  // ...
])

// 大量数据
const largeData = ref(
  Array.from({ length: 10000 }, (_, i) => ({
    id: String(i),
    name: `Item ${i}`
  }))
)
</script>
```
