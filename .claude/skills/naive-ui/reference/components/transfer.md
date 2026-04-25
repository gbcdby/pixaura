# Transfer 穿梭框

双栏穿梭选择框。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| value | Array | undefined | 值（受控） |
| default-value | Array | [] | 默认值 |
| options | Array | [] | 选项列表 |
| disabled | boolean | false | 是否禁用 |
| virtual-scroll | boolean | false | 是否虚拟滚动 |
| source-title | string | undefined | 源列表标题 |
| target-title | string | undefined | 目标列表标题 |
| filterable | boolean | false | 是否可过滤 |
| source-filter-placeholder | string | '搜索' | 源列表过滤占位符 |
| target-filter-placeholder | string | '搜索' | 目标列表过滤占位符 |
| render-source-label | (props: object) => VNode | undefined | 自定义源列表标签 |
| render-target-label | (props: object) => VNode | undefined | 自定义目标列表标签 |
| render-source-list | (props: object) => VNode | undefined | 自定义源列表 |
| render-target-list | (props: object) => VNode | undefined | 自定义目标列表 |
| on-update:value | (value: Array) => void | undefined | 值变化回调 |
| on-update:target-keys | (keys: Array) => void | undefined | 目标键变化回调 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-transfer v-model:value="value" :options="options" />
  
  <!-- 可过滤 -->
  <n-transfer v-model:value="value" :options="options" filterable />
  
  <!-- 自定义标题 -->
  <n-transfer 
    v-model:value="value" 
    :options="options" 
    source-title="未选择"
    target-title="已选择"
  />
</template>

<script setup>
const options = [
  { label: '选项1', value: '1' },
  { label: '选项2', value: '2' },
  { label: '选项3', value: '3' }
]
</script>
```
