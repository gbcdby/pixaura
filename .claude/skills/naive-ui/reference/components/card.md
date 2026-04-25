# Card 卡片

放点东西进去。

## 演示

- 基础用法
- 尺寸
- 封面
- 可悬浮
- 插槽
- 边框
- 分段
- 可关闭
- 没有标题
- 加载中
- 自定义样式
- 嵌入效果

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| title | string | undefined | 标题 |
| size | 'small' \| 'medium' \| 'large' \| 'huge' | 'medium' | 尺寸 |
| hoverable | boolean | false | 是否可悬浮 |
| segmented | boolean \| object | false | 是否分段 |
| embedded | boolean | false | 是否为嵌入效果 |
| closable | boolean | false | 是否可关闭 |
| bordered | boolean | true | 是否有边框 |
| content-style | object | undefined | 内容区域样式 |
| header-style | object | undefined | 标题区域样式 |
| header-extra-style | object | undefined | 标题额外区域样式 |
| footer-style | object | undefined | 底部区域样式 |
| on-close | () => void | undefined | 关闭回调 |

## Slots

- `default`: 卡片内容
- `header`: 标题
- `header-extra`: 标题额外内容
- `footer`: 底部内容
- `action`: 操作区域
- `cover`: 封面

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-card title="卡片标题">
    卡片内容
  </n-card>
  
  <!-- 带封面 -->
  <n-card title="带封面的卡片">
    <template #cover>
      <img src="...">
    </template>
    卡片内容
  </n-card>
  
  <!-- 可悬浮 -->
  <n-card hoverable>
    鼠标悬停有效果
  </n-card>
  
  <!-- 嵌入效果 -->
  <n-card embedded>
    嵌入效果
  </n-card>
</template>
```
