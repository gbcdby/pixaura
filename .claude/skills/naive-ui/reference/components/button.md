# Button 按钮

按钮用来触发一些操作。

## 演示

- 基础
- 次要按钮
- 次次要按钮
- 次次次要按钮
- 虚线按钮
- 尺寸
- 文本按钮
- 标签
- 禁用
- 图标
- 事件
- 形状
- 透明背景
- 加载中
- 自定义颜色
- 按钮组
- 使用图标作为按钮
- 配合 Popover 的特殊情况

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| type | 'default' \| 'tertiary' \| 'primary' \| 'info' \| 'success' \| 'warning' \| 'error' | 'default' | 按钮类型 |
| size | 'tiny' \| 'small' \| 'medium' \| 'large' | 'medium' | 尺寸 |
| dashed | boolean | false | 是否为虚线按钮 |
| text | boolean | false | 是否为文本按钮 |
| ghost | boolean | false | 是否为幽灵按钮 |
| secondary | boolean | false | 是否为次要按钮 |
| tertiary | boolean | false | 是否为次次要按钮 |
| quaternary | boolean | false | 是否为次次次要按钮 |
| strong | boolean | false | 是否加粗文本 |
| circle | boolean | false | 是否为圆形 |
| round | boolean | false | 是否为圆角 |
| disabled | boolean | false | 是否禁用 |
| loading | boolean | false | 是否加载中 |
| focusable | boolean | true | 是否可聚焦 |
| tag | string | 'button' | 渲染的标签 |
| color | string | undefined | 自定义颜色 |
| icon-placement | 'left' \| 'right' | 'left' | 图标位置 |
| render-icon | () => VNode | undefined | 自定义图标渲染 |

## ButtonGroup Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| size | 'tiny' \| 'small' \| 'medium' \| 'large' | undefined | 尺寸 |
| vertical | boolean | false | 是否垂直排列 |

## Slots

- `default`: 按钮内容
- `icon`: 图标

## Events

- `@click`: (e: MouseEvent) => void

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-button>默认按钮</n-button>
  <n-button type="primary">主要按钮</n-button>
  <n-button type="info">信息按钮</n-button>
  
  <!-- 尺寸 -->
  <n-button size="tiny">小小</n-button>
  <n-button size="small">小</n-button>
  <n-button size="medium">中</n-button>
  <n-button size="large">大</n-button>
  
  <!-- 虚线按钮 -->
  <n-button dashed>Dashed</n-button>
  
  <!-- 幽灵按钮 -->
  <n-button ghost>Ghost</n-button>
  
  <!-- 加载中 -->
  <n-button loading>加载中</n-button>
  
  <!-- 圆形按钮 -->
  <n-button circle>
    <n-icon><CashIcon /></n-icon>
  </n-button>
  
  <!-- 按钮组 -->
  <n-button-group>
    <n-button>按钮1</n-button>
    <n-button>按钮2</n-button>
  </n-button-group>
</template>
```
