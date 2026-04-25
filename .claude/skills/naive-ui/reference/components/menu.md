# Menu 菜单

导航菜单。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| value | string \| null | undefined | 值（受控） |
| default-value | string \| null | null | 默认值 |
| options | Array | [] | 菜单选项 |
| collapsed | boolean | undefined | 是否收起（受控） |
| default-collapsed | boolean | false | 默认是否收起 |
| collapsed-width | number | 64 | 收起宽度 |
| icon-size | number | 20 | 图标尺寸 |
| collapsed-icon-size | number | 24 | 收起时图标尺寸 |
| root-indent | number | 32 | 根级缩进 |
| indent | number | 16 | 子级缩进 |
| inverted | boolean | false | 是否反转颜色 |
| mode | 'vertical' \| 'horizontal' | 'vertical' | 模式 |
| responsive | boolean | false | 是否响应式 |
| on-update:value | (value: string, item: object) => void | undefined | 值变化回调 |
| on-update:expanded-keys | (keys: string[]) => void | undefined | 展开键变化回调 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-menu v-model:value="activeKey" :options="menuOptions" />
  
  <!-- 可收起 -->
  <n-menu 
    v-model:value="activeKey" 
    :collapsed="collapsed"
    :options="menuOptions" 
  />
  
  <!-- 水平模式 -->
  <n-menu v-model:value="activeKey" mode="horizontal" :options="menuOptions" />
</template>

<script setup>
const menuOptions = [
  {
    label: '首页',
    key: 'home',
    icon: renderIcon(HomeIcon)
  },
  {
    label: '用户管理',
    key: 'user',
    children: [
      { label: '用户列表', key: 'user-list' },
      { label: '添加用户', key: 'user-add' }
    ]
  }
]
</script>
```
