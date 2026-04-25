# Spin 加载

用于页面和区块的加载中状态。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| show | boolean | true | 是否显示 |
| size | 'small' \| 'medium' \| 'large' | 'medium' | 尺寸 |
| stroke-width | number | undefined | 描边宽度 |
| description | string | undefined | 描述 |
| rotate | boolean | true | 是否旋转 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-spin :show="loading">
    <div>内容</div>
  </n-spin>
  
  <!-- 带描述 -->
  <n-spin :show="loading" description="加载中...">
    <div>内容</div>
  </n-spin>
  
  <!-- 不同尺寸 -->
  <n-spin size="small" />
  <n-spin size="medium" />
  <n-spin size="large" />
</template>
```
