# Tooltip 弹出提示

简单的文字提示气泡框。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| show | boolean | undefined | 是否显示（受控） |
| default-show | boolean | false | 默认是否显示 |
| trigger | 'hover' \| 'click' \| 'focus' \| 'manual' | 'hover' | 触发方式 |
| placement | string | 'top' | 位置 |
| disabled | boolean | false | 是否禁用 |
| delay | number | 100 | 延迟显示时间 |
| duration | number | 100 | 延迟关闭时间 |
| flip | boolean | true | 是否自动调整位置 |
| width | number \| 'trigger' | undefined | 宽度 |
| x | number | undefined | 自定义 X 坐标 |
| y | number | undefined | 自定义 Y 坐标 |
| to | string \| HTMLElement | 'body' | 挂载位置 |
| z-index | number | undefined | 层级 |

## Slots

- `default`: 触发元素
- `trigger`: 触发元素

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-tooltip trigger="hover">
    <template #trigger>
      <n-button>悬停提示</n-button>
    </template>
    提示内容
  </n-tooltip>
  
  <!-- 不同位置 -->
  <n-tooltip placement="bottom">
    <template #trigger>
      <n-button>底部提示</n-button>
    </template>
    底部提示内容
  </n-tooltip>
</template>
```
