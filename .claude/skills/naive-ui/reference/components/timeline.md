# Timeline 时间线

垂直展示的时间流信息。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| horizontal | boolean | false | 是否水平 |
| item-placement | 'left' \| 'right' | 'left' | 内容位置 |
| size | 'small' \| 'medium' \| 'large' | 'medium' | 尺寸 |
| icon-size | number | 20 | 图标尺寸 |

## TimelineItem Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| title | string | undefined | 标题 |
| content | string | undefined | 内容 |
| time | string | undefined | 时间 |
| type | 'default' \| 'info' \| 'success' \| 'warning' \| 'error' | 'default' | 类型 |
| color | string | undefined | 颜色 |
| line-type | 'default' \| 'dashed' | 'default' | 线条类型 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-timeline>
    <n-timeline-item title="事件1" content="内容1" time="2024-01-01" />
    <n-timeline-item title="事件2" content="内容2" time="2024-01-02" />
    <n-timeline-item title="事件3" content="内容3" time="2024-01-03" />
  </n-timeline>
  
  <!-- 不同类型 -->
  <n-timeline>
    <n-timeline-item type="success" title="成功" content="操作成功" />
    <n-timeline-item type="error" title="错误" content="操作失败" />
    <n-timeline-item type="warning" title="警告" content="请注意" />
  </n-timeline>
</template>
```
