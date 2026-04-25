# Rate 评分

评分组件。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| value | number | undefined | 值（受控） |
| default-value | number | 0 | 默认值 |
| count | number | 5 | 总数 |
| allow-half | boolean | false | 是否允许半选 |
| readonly | boolean | false | 是否只读 |
| disabled | boolean | false | 是否禁用 |
| size | 'small' \| 'medium' \| 'large' | 'medium' | 尺寸 |
| color | string | undefined | 颜色 |
| on-update:value | (value: number) => void | undefined | 值变化回调 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-rate v-model:value="value" />
  
  <!-- 允许半选 -->
  <n-rate v-model:value="value" allow-half />
  
  <!-- 只读 -->
  <n-rate :value="3" readonly />
  
  <!-- 自定义数量 -->
  <n-rate v-model:value="value" :count="10" />
</template>
```
