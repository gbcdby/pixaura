# Dynamic Tags 动态标签

可动态添加和删除的标签。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| value | Array | undefined | 值（受控） |
| default-value | Array | [] | 默认值 |
| size | 'small' \| 'medium' \| 'large' | 'medium' | 尺寸 |
| type | 'default' \| 'primary' \| 'info' \| 'success' \| 'warning' \| 'error' | 'default' | 类型 |
| round | boolean | false | 是否为圆角 |
| max | number | undefined | 最大标签数 |
| input-props | object | undefined | 输入框属性 |
| tag-props | object | undefined | 标签属性 |
| disabled | boolean | false | 是否禁用 |
| closable | boolean | true | 是否可关闭 |
| on-update:value | (value: Array) => void | undefined | 值变化回调 |
| on-create | (label: string) => any | undefined | 创建标签回调 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-dynamic-tags v-model:value="tags" />
  
  <!-- 不同类型 -->
  <n-dynamic-tags v-model:value="tags" type="primary" />
  
  <!-- 限制数量 -->
  <n-dynamic-tags v-model:value="tags" :max="5" />
  
  <!-- 圆角 -->
  <n-dynamic-tags v-model:value="tags" round />
</template>

<script setup>
const tags = ref(['标签1', '标签2'])
</script>
```
