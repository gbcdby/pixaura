# Modal 模态框

弹出模态框。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| show | boolean | undefined | 是否显示（受控） |
| default-show | boolean | false | 默认是否显示 |
| title | string | undefined | 标题 |
| mask-closable | boolean | true | 点击遮罩是否关闭 |
| closable | boolean | true | 是否显示关闭按钮 |
| preset | 'dialog' \| 'card' | undefined | 预设样式 |
| size | 'small' \| 'medium' \| 'large' \| 'huge' | 'medium' | 尺寸 |
| auto-focus | boolean | true | 是否自动聚焦 |
| close-on-esc | boolean | true | ESC 是否关闭 |
| transform-origin | 'mouse' \| 'center' | 'mouse' | 变换原点 |
| block-scroll | boolean | true | 是否阻止滚动 |
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
- `action`: 操作区域
- `icon`: 图标

## Dialog Preset Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| type | 'default' \| 'error' \| 'success' \| 'warning' \| 'info' | 'default' | 类型 |
| title | string | undefined | 标题 |
| content | string | undefined | 内容 |
| positive-text | string | undefined | 确认按钮文本 |
| negative-text | string | undefined | 取消按钮文本 |
| loading | boolean | false | 是否加载中 |
| on-positive-click | () => void \| Promise | undefined | 确认回调 |
| on-negative-click | () => void | undefined | 取消回调 |
| on-close | () => void | undefined | 关闭回调 |

## useDialog

```ts
import { useDialog } from 'naive-ui'

const dialog = useDialog()

// 方法
dialog.create(options: DialogOptions)
dialog.info(options: DialogOptions)
dialog.success(options: DialogOptions)
dialog.warning(options: DialogOptions)
dialog.error(options: DialogOptions)

// 销毁
dialog.destroyAll()
```

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-modal v-model:show="showModal" title="标题">
    <p>内容</p>
  </n-modal>
  
  <!-- 预设样式 -->
  <n-modal v-model:show="showModal" preset="dialog" title="确认">
    确定要删除吗？
  </n-modal>
</template>

<script setup>
import { useDialog } from 'naive-ui'

const dialog = useDialog()

// 使用 useDialog
dialog.success({
  title: '成功',
  content: '操作成功完成'
})
</script>
```
