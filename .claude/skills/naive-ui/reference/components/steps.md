# Steps 步骤

引导用户完成任务的导航条。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| current | number | undefined | 当前步骤（受控） |
| default-current | number | 0 | 默认当前步骤 |
| status | 'wait' \| 'process' \| 'finish' \| 'error' | 'process' | 当前步骤状态 |
| size | 'small' \| 'medium' | 'medium' | 尺寸 |
| vertical | boolean | false | 是否垂直 |

## Step Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| title | string | undefined | 标题 |
| description | string | undefined | 描述 |
| disabled | boolean | false | 是否禁用 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-steps :current="current">
    <n-step title="步骤1" description="描述1" />
    <n-step title="步骤2" description="描述2" />
    <n-step title="步骤3" description="描述3" />
  </n-steps>
  
  <!-- 垂直 -->
  <n-steps :current="current" vertical>
    <n-step title="步骤1" description="描述1" />
    <n-step title="步骤2" description="描述2" />
  </n-steps>
  
  <!-- 小尺寸 -->
  <n-steps :current="current" size="small">
    <n-step title="步骤1" />
    <n-step title="步骤2" />
  </n-steps>
</template>
```
