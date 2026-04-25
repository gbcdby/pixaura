# Result 结果页

用于反馈一系列操作任务的处理结果。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| status | 'info' \| 'success' \| 'warning' \| 'error' \| '404' \| '403' \| '500' | 'info' | 状态 |
| title | string | undefined | 标题 |
| description | string | undefined | 描述 |

## Slots

- `default`: 内容
- `icon`: 自定义图标
- `title`: 自定义标题
- `footer`: 底部

## 用法

```vue
<template>
  <!-- 成功 -->
  <n-result status="success" title="操作成功" description="您的操作已成功完成">
    <template #footer>
      <n-button>返回首页</n-button>
    </template>
  </n-result>
  
  <!-- 404 -->
  <n-result status="404" title="页面不存在" description="您访问的页面不存在">
    <template #footer>
      <n-button>返回首页</n-button>
    </template>
  </n-result>
  
  <!-- 错误 -->
  <n-result status="error" title="操作失败" description="操作过程中出现错误">
    <template #footer>
      <n-button>重试</n-button>
    </template>
  </n-result>
</template>
```
