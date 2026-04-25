# Drawer 抽屉

从屏幕边缘滑出的面板。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| show | boolean | undefined | 是否显示（受控） |
| default-show | boolean | false | 默认是否显示 |
| placement | 'top' \| 'right' \| 'bottom' \| 'left' | 'right' | 位置 |
| title | string | undefined | 标题 |
| mask-closable | boolean | true | 点击遮罩是否关闭 |
| closable | boolean | true | 是否显示关闭按钮 |
| width | number \| string | 360 | 宽度 |
| height | number \| string | 360 | 高度 |
| native-scrollbar | boolean | true | 是否使用原生滚动条 |
| z-index | number | undefined | 层级 |
| on-update:show | (value: boolean) => void | undefined | 显示状态变化回调 |
| on-after-enter | () => void | undefined | 进入动画结束回调 |
| on-after-leave | () => void | undefined | 离开动画结束回调 |
| on-esc | () => void | undefined | ESC 回调 |
| on-mask-click | (e: MouseEvent) => void | undefined | 遮罩点击回调 |

## Slots

- `default`: 内容
- `header`: 头部
- `footer`: 底部

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-drawer v-model:show="show" title="抽屉标题">
    抽屉内容
  </n-drawer>
  
  <!-- 左侧抽屉 -->
  <n-drawer v-model:show="show" placement="left" :width="300">
    左侧内容
  </n-drawer>
  
  <!-- 底部抽屉 -->
  <n-drawer v-model:show="show" placement="bottom" :height="400">
    底部内容
  </n-drawer>
</template>
```
