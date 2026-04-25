# Popover 弹出信息

鼠标点击或悬停时弹出的气泡卡片。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| show | boolean | undefined | 是否显示（受控） |
| default-show | boolean | false | 默认是否显示 |
| trigger | 'hover' \| 'click' \| 'focus' \| 'manual' | 'hover' | 触发方式 |
| placement | string | 'top' | 位置 |
| disabled | boolean | false | 是否禁用 |
| show-arrow | boolean | true | 是否显示箭头 |
| delay | number | 100 | 延迟显示时间 |
| duration | number | 100 | 延迟关闭时间 |
| raw | boolean | false | 是否不添加样式 |
| x | number | undefined | 自定义 X 坐标 |
| y | number | undefined | 自定义 Y 坐标 |
| flip | boolean | true | 是否自动调整位置 |
| shift | boolean | true | 是否自动偏移 |
| width | number \| 'trigger' | undefined | 宽度 |
| overlap | boolean | false | 是否与触发元素重叠 |
| keep-alive-on-hover | boolean | true | 悬停是否保持 |
| z-index | number | undefined | 层级 |
| to | string \| HTMLElement | 'body' | 挂载位置 |
| scrollable | boolean | false | 是否可滚动 |
| content-style | object | undefined | 内容样式 |
| on-update:show | (value: boolean) => void | undefined | 显示状态变化回调 |
| on-clickoutside | (e: MouseEvent) => void | undefined | 点击外部回调 |

## Slots

- `default`: 触发元素
- `trigger`: 触发元素（与 default 相同）
- `header`: 头部
- `footer`: 底部

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-popover trigger="hover">
    <template #trigger>
      <n-button>悬停显示</n-button>
    </template>
    弹出内容
  </n-popover>
  
  <!-- 点击触发 -->
  <n-popover trigger="click">
    <template #trigger>
      <n-button>点击显示</n-button>
    </template>
    弹出内容
  </n-popover>
  
  <!-- 不同位置 -->
  <n-popover placement="bottom">
    <template #trigger>
      <n-button>底部显示</n-button>
    </template>
    弹出内容
  </n-popover>
</template>
```
