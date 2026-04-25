# Tree 树

树形结构展示。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| data | Array | [] | 树形数据 |
| default-expanded-keys | Array | [] | 默认展开的键 |
| expanded-keys | Array | undefined | 展开的键（受控） |
| default-checked-keys | Array | [] | 默认选中的键 |
| checked-keys | Array | undefined | 选中的键（受控） |
| default-selected-keys | Array | [] | 默认选择的键 |
| selected-keys | Array | undefined | 选择的键（受控） |
| multiple | boolean | false | 是否多选 |
| checkable | boolean | false | 是否可选中 |
| selectable | boolean | true | 是否可选择 |
| cascade | boolean | true | 是否级联 |
| check-strategy | 'all' \| 'parent' \| 'child' | 'all' | 勾选策略 |
| disabled | boolean | false | 是否禁用 |
| block-line | boolean | false | 是否块状显示 |
| block-node | boolean | false | 是否块状节点 |
| virtual-scroll | boolean | false | 是否虚拟滚动 |
| watch-props | Array | undefined | 监听属性 |
| render-label | (info: object) => VNode | undefined | 自定义标签渲染 |
| render-prefix | (info: object) => VNode | undefined | 自定义前缀渲染 |
| render-suffix | (info: object) => VNode | undefined | 自定义后缀渲染 |
| render-switcher-icon | (props: object) => VNode | undefined | 自定义切换图标 |
| on-update:expanded-keys | (keys: Array, option: object) => void | undefined | 展开键变化回调 |
| on-update:checked-keys | (keys: Array, option: object) => void | undefined | 选中键变化回调 |
| on-update:selected-keys | (keys: Array, option: object) => void | undefined | 选择键变化回调 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-tree :data="data" />
  
  <!-- 可勾选 -->
  <n-tree :data="data" checkable />
  
  <!-- 可展开 -->
  <n-tree :data="data" default-expand-all />
  
  <!-- 虚拟滚动 -->
  <n-tree :data="data" virtual-scroll />
</template>

<script setup>
const data = [
  {
    label: '0',
    key: '0',
    children: [
      { label: '0-0', key: '0-0' },
      { label: '0-1', key: '0-1' }
    ]
  },
  {
    label: '1',
    key: '1'
  }
]
</script>
```
