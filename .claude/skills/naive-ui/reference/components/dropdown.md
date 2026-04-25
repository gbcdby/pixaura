# Dropdown 下拉菜单

向下弹出的菜单列表。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| show | boolean | undefined | 是否显示（受控） |
| default-show | boolean | false | 默认是否显示 |
| trigger | 'hover' \| 'click' | 'hover' | 触发方式 |
| disabled | boolean | false | 是否禁用 |
| placement | string | 'bottom' | 位置 |
| options | Array | [] | 选项列表 |
| size | 'small' \| 'medium' \| 'large' \| 'huge' | 'medium' | 尺寸 |
| inverted | boolean | false | 是否反转颜色 |
| keyboard | boolean | true | 是否支持键盘 |
| on-select | (key: string \| number, option: object) => void | undefined | 选择回调 |
| on-clickoutside | (e: MouseEvent) => void | undefined | 点击外部回调 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-dropdown :options="options" @select="handleSelect">
    <n-button>下拉菜单</n-button>
  </n-dropdown>
  
  <!-- 点击触发 -->
  <n-dropdown :options="options" trigger="click">
    <n-button>点击触发</n-button>
  </n-dropdown>
</template>

<script setup>
const options = [
  {
    label: '用户资料',
    key: 'profile'
  },
  {
    label: '编辑',
    key: 'edit'
  },
  {
    type: 'divider'
  },
  {
    label: '退出',
    key: 'logout'
  }
]

const handleSelect = (key) => {
  console.log(key)
}
</script>
```
