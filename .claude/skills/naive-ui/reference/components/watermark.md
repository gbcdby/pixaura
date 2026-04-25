# Watermark 水印

为页面或区域添加水印。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| content | string | undefined | 水印文字 |
| cross | boolean | false | 是否显示交叉水印 |
| font-size | number | 16 | 字体大小 |
| font-family | string | undefined | 字体 |
| font-weight | number | 400 | 字重 |
| font-color | string | 'rgba(0, 0, 0, 0.15)' | 字体颜色 |
| line-height | number | undefined | 行高 |
| width | number | undefined | 水印宽度 |
| height | number | undefined | 水印高度 |
| rotate | number | -22 | 旋转角度 |
| z-index | number | 10 | 层级 |
| image | string | undefined | 图片水印地址 |
| x-gap | number | 0 | 水平间距 |
| y-gap | number | 0 | 垂直间距 |
| x-offset | number | 0 | 水平偏移 |
| y-offset | number | 0 | 垂直偏移 |
| fullscreen | boolean | false | 是否全屏 |
| selectable | boolean | true | 是否可选中 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-watermark content="水印文字">
    <div>内容区域</div>
  </n-watermark>
  
  <!-- 全屏水印 -->
  <n-watermark content="机密" fullscreen />
  
  <!-- 自定义样式 -->
  <n-watermark 
    content="水印" 
    :font-size="20" 
    font-color="rgba(255, 0, 0, 0.2)"
    :rotate="-30"
  >
    <div>内容区域</div>
  </n-watermark>
  
  <!-- 图片水印 -->
  <n-watermark image="/logo.png">
    <div>内容区域</div>
  </n-watermark>
</template>
```
