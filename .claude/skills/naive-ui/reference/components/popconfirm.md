# Popconfirm 弹出确认

点击元素，弹出气泡确认框。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| show | boolean | undefined | 是否显示（受控） |
| default-show | boolean | false | 默认是否显示 |
| positive-text | string | undefined | 确认按钮文本 |
| negative-text | string | undefined | 取消按钮文本 |
| positive-button-type | 'default' \| 'primary' \| 'info' \| 'success' \| 'warning' \| 'error' | 'primary' | 确认按钮类型 |
| negative-button-type | 'default' \| 'primary' \| 'info' \| 'success' \| 'warning' \| 'error' | 'default' | 取消按钮类型 |
| show-icon | boolean | true | 是否显示图标 |
| icon | () => VNode | undefined | 自定义图标 |
| on-positive-click | () => boolean \| Promise<boolean> | undefined | 确认回调 |
| on-negative-click | () => boolean \| Promise<boolean> | undefined | 取消回调 |

## Slots

- `default`: 触发元素
- `trigger`: 触发元素
- `action`: 自定义操作区域

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-popconfirm @positive-click="handlePositiveClick">
    <template #trigger>
      <n-button>删除</n-button>
    </template>
    确定要删除吗？
  </n-popconfirm>
  
  <!-- 自定义按钮文本 -->
  <n-popconfirm 
    positive-text="确认删除" 
    negative-text="取消"
    @positive-click="handleDelete"
  >
    <template #trigger>
      <n-button>删除</n-button>
    </template>
    确定要删除这条记录吗？
  </n-popconfirm>
</template>
```
