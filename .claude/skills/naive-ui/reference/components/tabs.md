# Tabs 标签页

切换内容区域。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| value | string \| number | undefined | 值（受控） |
| default-value | string \| number \| null | null | 默认值 |
| type | 'bar' \| 'line' \| 'card' \| 'segment' | 'bar' | 类型 |
| size | 'small' \| 'medium' \| 'large' | 'medium' | 尺寸 |
| placement | 'left' \| 'right' \| 'top' \| 'bottom' | 'top' | 位置 |
| animated | boolean | true | 是否动画 |
| closable | boolean | false | 是否可关闭 |
| addable | boolean | false | 是否可添加 |
| tabs-padding | number | 0 | 标签内边距 |
| pane-style | string \| object | undefined | 面板样式 |
| pane-class | string | undefined | 面板类名 |
| bar-width | number | undefined | 指示条宽度 |
| trigger | 'click' \| 'hover' | 'click' | 触发方式 |
| on-add | () => void | undefined | 添加回调 |
| on-close | (name: string \| number) => void | undefined | 关闭回调 |

## TabPane Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| name | string \| number | undefined | 标识 |
| tab | string | undefined | 标签文本 |
| disabled | boolean | false | 是否禁用 |
| closable | boolean | false | 是否可关闭 |
| display-directive | 'if' \| 'show' | 'if' | 显示指令 |
| tab-props | object | undefined | 标签 props |

## Slots

- `default`: 面板内容
- `tab`: 自定义标签
- `prefix`: 前缀
- `suffix`: 后缀

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-tabs v-model:value="activeTab">
    <n-tab-pane name="tab1" tab="标签1">
      内容1
    </n-tab-pane>
    <n-tab-pane name="tab2" tab="标签2">
      内容2
    </n-tab-pane>
  </n-tabs>
  
  <!-- 卡片类型 -->
  <n-tabs type="card">
    <n-tab-pane name="tab1" tab="标签1">内容1</n-tab-pane>
    <n-tab-pane name="tab2" tab="标签2">内容2</n-tab-pane>
  </n-tabs>
  
  <!-- 左侧标签 -->
  <n-tabs placement="left">
    <n-tab-pane name="tab1" tab="标签1">内容1</n-tab-pane>
    <n-tab-pane name="tab2" tab="标签2">内容2</n-tab-pane>
  </n-tabs>
</template>
```
