# Thing 东西

用于展示一个事物的信息。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| title | string | undefined | 标题 |
| title-extra | string | undefined | 标题额外内容 |
| description | string | undefined | 描述 |
| content | string | undefined | 内容 |
| content-style | object | undefined | 内容样式 |

## Slots

- `default`: 头像或图标
- `title`: 标题
- `title-extra`: 标题额外内容
- `description`: 描述
- `content`: 内容
- `action`: 操作

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-thing title="标题" description="描述信息">
    <template #avatar>
      <n-avatar src="avatar.jpg" />
    </template>
  </n-thing>
  
  <!-- 带操作 -->
  <n-thing title="标题" description="描述">
    <template #action>
      <n-button>操作</n-button>
    </template>
  </n-thing>
</template>
```
