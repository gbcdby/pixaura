# Descriptions 描述

成组展示多个只读字段。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| title | string | undefined | 标题 |
| column | number | 3 | 列数 |
| columns | number | undefined | 列数（响应式） |
| label-placement | 'left' \| 'top' | 'left' | 标签位置 |
| label-align | 'left' \| 'right' \| 'center' | 'left' | 标签对齐 |
| separator | string | ':' | 分隔符 |
| size | 'small' \| 'medium' \| 'large' | 'medium' | 尺寸 |
| bordered | boolean | false | 是否有边框 |

## DescriptionsItem Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| label | string | undefined | 标签 |
| span | number | 1 | 占据列数 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-descriptions title="用户信息">
    <n-descriptions-item label="姓名">张三</n-descriptions-item>
    <n-descriptions-item label="年龄">25</n-descriptions-item>
    <n-descriptions-item label="地址">北京市</n-descriptions-item>
  </n-descriptions>
  
  <!-- 带边框 -->
  <n-descriptions title="用户信息" bordered>
    <n-descriptions-item label="姓名">张三</n-descriptions-item>
    <n-descriptions-item label="年龄">25</n-descriptions-item>
  </n-descriptions>
  
  <!-- 自定义列数 -->
  <n-descriptions title="用户信息" :column="2">
    <n-descriptions-item label="姓名">张三</n-descriptions-item>
    <n-descriptions-item label="年龄">25</n-descriptions-item>
  </n-descriptions>
</template>
```
