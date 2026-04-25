# Float Button 浮动按钮

浮动在页面上的按钮。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| type | 'default' \| 'primary' \| 'info' \| 'success' \| 'warning' \| 'error' | 'default' | 类型 |
| shape | 'circle' \| 'square' | 'circle' | 形状 |
| size | 'small' \| 'medium' \| 'large' | 'medium' | 尺寸 |
| disabled | boolean | false | 是否禁用 |
| on-click | (e: MouseEvent) => void | undefined | 点击回调 |

## FloatButtonGroup Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| shape | 'circle' \| 'square' | 'circle' | 形状 |
| position | 'absolute' \| 'fixed' | 'fixed' | 定位方式 |
| left | number \| string | undefined | 左侧距离 |
| right | number \| string | 40 | 右侧距离 |
| top | number \| string | undefined | 顶部距离 |
| bottom | number \| string | 40 | 底部距离 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-float-button>
    <n-icon><AddIcon /></n-icon>
  </n-float-button>
  
  <!-- 不同类型 -->
  <n-float-button type="primary">
    <n-icon><AddIcon /></n-icon>
  </n-float-button>
  
  <!-- 方形 -->
  <n-float-button shape="square">
    <n-icon><AddIcon /></n-icon>
  </n-float-button>
  
  <!-- 按钮组 -->
  <n-float-button-group>
    <n-float-button>
      <n-icon><AddIcon /></n-icon>
    </n-float-button>
    <n-float-button>
      <n-icon><EditIcon /></n-icon>
    </n-float-button>
    <n-float-button>
      <n-icon><DeleteIcon /></n-icon>
    </n-float-button>
  </n-float-button-group>
</template>
```
