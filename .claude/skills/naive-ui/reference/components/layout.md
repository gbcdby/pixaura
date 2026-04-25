# Layout 布局

页面布局组件。

## Layout Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| has-sider | boolean | false | 是否有侧边栏 |
| position | 'static' \| 'absolute' | 'static' | 位置模式 |

## LayoutSider Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| collapsed | boolean | undefined | 是否收起（受控） |
| default-collapsed | boolean | false | 默认是否收起 |
| collapsed-width | number | 48 | 收起宽度 |
| width | number \| string | 272 | 展开宽度 |
| collapse-mode | 'transform' \| 'width' | 'transform' | 收起模式 |
| show-trigger | boolean \| 'bar' \| 'arrow-circle' | false | 是否显示触发器 |
| bordered | boolean | false | 是否有边框 |
| inverted | boolean | false | 是否反转颜色 |
| native-scrollbar | boolean | true | 是否使用原生滚动条 |

## 用法

```vue
<template>
  <n-layout>
    <n-layout-header>头部</n-layout-header>
    <n-layout has-sider>
      <n-layout-sider>侧边栏</n-layout-sider>
      <n-layout-content>内容</n-layout-content>
    </n-layout>
    <n-layout-footer>底部</n-layout-footer>
  </n-layout>
  
  <!-- 可收起的侧边栏 -->
  <n-layout has-sider>
    <n-layout-sider 
      v-model:collapsed="collapsed"
      show-trigger
      :collapsed-width="64"
      :width="240"
    >
      侧边栏
    </n-layout-sider>
    <n-layout-content>内容</n-layout-content>
  </n-layout>
</template>
```
