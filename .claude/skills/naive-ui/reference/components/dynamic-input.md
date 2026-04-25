# Dynamic Input 动态录入

动态添加或删除输入项。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| value | Array | undefined | 值（受控） |
| default-value | Array | [] | 默认值 |
| preset | 'input' \| 'pair' | 'input' | 预设类型 |
| min | number | 0 | 最少项数 |
| max | number | undefined | 最大项数 |
| show-sort-button | boolean | false | 是否显示排序按钮 |
| key-placeholder | string | undefined | 键的占位符（pair 预设） |
| value-placeholder | string | undefined | 值的占位符（pair 预设） |
| placeholder | string | undefined | 占位符（input 预设） |
| disabled | boolean | false | 是否禁用 |
| on-update:value | (value: Array) => void | undefined | 值变化回调 |
| on-create | (index: number) => any | undefined | 创建项回调 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-dynamic-input v-model:value="values" placeholder="请输入" />
  
  <!-- 键值对 -->
  <n-dynamic-input 
    v-model:value="pairs" 
    preset="pair" 
    key-placeholder="键"
    value-placeholder="值"
  />
  
  <!-- 限制数量 -->
  <n-dynamic-input v-model:value="values" :min="1" :max="5" />
  
  <!-- 显示排序按钮 -->
  <n-dynamic-input v-model:value="values" show-sort-button />
</template>

<script setup>
const values = ref([''])
const pairs = ref([{ key: '', value: '' }])
</script>
```
