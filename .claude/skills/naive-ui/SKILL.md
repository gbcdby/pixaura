---
name: naive-ui
description: Naive UI 是一个 Vue 3 组件库，提供超过 90 个组件，主题可调，使用 TypeScript 编写，支持 tree-shaking。适用于需要快速构建 Vue 3 应用的场景。
---

# Naive UI

**技术栈**: Vue 3 + TypeScript

**版本**: 2.43.2

## 简介

Naive UI 是一个 Vue 3 的组件库，特点包括：
- **比较完整**：超过 90 个组件，全部支持 tree-shaking
- **主题可调**：使用 TypeScript 构建的先进类型安全主题系统，无需 less、sass、css 变量
- **使用 TypeScript**：全量使用 TypeScript 编写，与 TypeScript 项目无缝衔接，无需导入 CSS
- **快**：select、tree、transfer、table、cascader 等组件支持虚拟列表

## 快速开始

### 1. 安装

```bash
# npm
npm i -D naive-ui

# 字体（可选）
npm i -D vfonts

# 图标库（推荐）
# 使用 xicons: https://www.xicons.org
```

### 2. 在 SFC 中使用

**直接引入（推荐）** - 只有导入的组件才会被打包：

```vue
<template>
  <n-button>naive-ui</n-button>
</template>

<script setup>
import { NButton } from 'naive-ui'
</script>
```

**全局安装（不推荐）** - 失去 tree-shaking 能力：

```js
import naive from 'naive-ui'
import { createApp } from 'vue'

const app = createApp(App)
app.use(naive)
```

### 3. 配置 Volar 支持

在 `tsconfig.json` 中配置：

```json
{
  "compilerOptions": {
    "types": ["naive-ui/volar"]
  }
}
```

## 核心概念

### 受控与非受控模式

- **非受控模式**：只监听组件变化，不控制 value
  ```vue
  <n-input @update:value="handleUpdateValue" />
  ```
- **受控模式**：监听并控制组件的值
  ```vue
  <n-input :value="value" @update:value="handleUpdateValue" />
  ```
- **v-model**：等同于 `:model-value` 和 `@update:model-value` 的组合

注意：在 naive-ui 中，只要 `value` 是 `undefined` 或根本没传，组件就是非受控的。清空建议使用 `null`。

### 主题系统

**使用暗色主题**：

```vue
<template>
  <n-config-provider :theme="darkTheme">
    <app />
  </n-config-provider>
</template>

<script setup>
import { darkTheme } from 'naive-ui'
</script>
```

**调整主题变量**：

```vue
<template>
  <n-config-provider :theme-overrides="themeOverrides">
    <app />
  </n-config-provider>
</template>

<script setup>
const themeOverrides = {
  common: {
    primaryColor: '#FF0000',
    primaryColorHover: '#FF3333'
  }
}
</script>
```

更多主题配置请参考 [reference/theme.md](./reference/theme.md)

### 国际化

```vue
<template>
  <n-config-provider :locale="zhCN" :date-locale="dateZhCN">
    <app />
  </n-config-provider>
</template>

<script setup>
import { zhCN, dateZhCN } from 'naive-ui'
</script>
```

支持语言：阿拉伯语、阿塞拜疆语、捷克语、丹麦语、德语、英语、世界语、西班牙语、爱沙尼亚语等。

### 字体配置

```js
// App 入口文件
import 'vfonts/Lato.css'      // 通用字体
import 'vfonts/FiraCode.css'  // 等宽字体
```

注意：使用 Lato、OpenSans 时需要调整字重配置：

```vue
<n-config-provider :theme-overrides="{ common: { fontWeightStrong: '600' } }">
  <app />
</n-config-provider>
```

## 按需引入

### 手动引入

```vue
<script>
import { defineComponent } from 'vue'
import { NConfigProvider, NInput, NDatePicker } from 'naive-ui'

// 主题
import { createTheme, inputDark, datePickerDark } from 'naive-ui'

// 语言
import { zhCN, dateZhCN } from 'naive-ui'

export default defineComponent({
  components: { NConfigProvider, NInput, NDatePicker },
  setup() {
    return {
      darkTheme: createTheme([inputDark, datePickerDark]),
      zhCN,
      dateZhCN
    }
  }
})
</script>
```

### 自动引入

使用 `unplugin-auto-import` 和 `unplugin-vue-components`：

```js
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      imports: ['vue', {
        'naive-ui': ['useDialog', 'useMessage', 'useNotification', 'useLoadingBar']
      }]
    }),
    Components({
      resolvers: [NaiveUiResolver()]
    })
  ]
})
```

## SSR 支持

### 必要条件

- `@css-render/*` 和 `css-render` 包版本 >= 0.15.14
- 确保没有重复的包版本

### Nuxt.js

```bash
npx nuxi module add nuxtjs-naive-ui
```

更多 SSR 配置请参考 [reference/ssr.md](./reference/ssr.md)

## 组件列表

### 通用组件 (15)
- [Avatar 头像](./reference/components/avatar.md)
- [Button 按钮](./reference/components/button.md)
- [Card 卡片](./reference/components/card.md)
- [Carousel 轮播图](./reference/components/carousel.md)
- [Collapse 折叠面板](./reference/components/collapse.md)
- [Divider 分割线](./reference/components/divider.md)
- [Dropdown 下拉菜单](./reference/components/dropdown.md)
- [Ellipsis 文本省略](./reference/components/ellipsis.md)
- [Gradient Text 渐变文字](./reference/components/gradient-text.md)
- [Icon 图标](./reference/components/icon.md)
- [PageHeader 页头](./reference/components/page-header.md)
- [Tag 标签](./reference/components/tag.md)
- [Typography 排印](./reference/components/typography.md)
- [Watermark 水印](./reference/components/watermark.md)
- [Float Button 浮动按钮](./reference/components/float-button.md)

### 数据录入组件 (21)
- [Auto Complete 自动填充](./reference/components/auto-complete.md)
- [Cascader 级联选择](./reference/components/cascader.md)
- [Color Picker 颜色选择器](./reference/components/color-picker.md)
- [Checkbox 复选框](./reference/components/checkbox.md)
- [Date Picker 日期选择器](./reference/components/date-picker.md)
- [Dynamic Input 动态录入](./reference/components/dynamic-input.md)
- [Dynamic Tags 动态标签](./reference/components/dynamic-tags.md)
- [Form 表单](./reference/components/form.md)
- [Input 文本输入](./reference/components/input.md)
- [Input Number 数字输入](./reference/components/input-number.md)
- [Input OTP 验证码](./reference/components/input-otp.md)
- [Mention 提及](./reference/components/mention.md)
- [Radio 单选](./reference/components/radio.md)
- [Rate 评分](./reference/components/rate.md)
- [Select 选择器](./reference/components/select.md)
- [Slider 滑动选择](./reference/components/slider.md)
- [Switch 开关](./reference/components/switch.md)
- [Time Picker 时间选择器](./reference/components/time-picker.md)
- [Transfer 穿梭框](./reference/components/transfer.md)
- [Tree Select 树型选择](./reference/components/tree-select.md)
- [Upload 上传](./reference/components/upload.md)

### 数据展示组件 (21)
- [Calendar 日历](./reference/components/calendar.md)
- [Code 代码](./reference/components/code.md)
- [Countdown 倒计时](./reference/components/countdown.md)
- [Data Table 数据表格](./reference/components/data-table.md)
- [Descriptions 描述](./reference/components/descriptions.md)
- [Empty 无内容](./reference/components/empty.md)
- [Equation 公式](./reference/components/equation.md)
- [Heatmap 热力图](./reference/components/heatmap.md)
- [Highlight 高亮文本](./reference/components/highlight.md)
- [Image 图像](./reference/components/image.md)
- [Infinite Scroll 无限滚动](./reference/components/infinite-scroll.md)
- [List 列表](./reference/components/list.md)
- [Log 日志](./reference/components/log.md)
- [Number Animation 数值动画](./reference/components/number-animation.md)
- [QR Code 二维码](./reference/components/qr-code.md)
- [Statistic 统计数据](./reference/components/statistic.md)
- [Table 表格](./reference/components/table.md)
- [Thing 东西](./reference/components/thing.md)
- [Time 时间](./reference/components/time.md)
- [Timeline 时间线](./reference/components/timeline.md)
- [Tree 树](./reference/components/tree.md)

### 导航组件 (9)
- [Affix 固钉](./reference/components/affix.md)
- [Anchor 侧边导航](./reference/components/anchor.md)
- [Back Top 回到顶部](./reference/components/back-top.md)
- [Breadcrumb 面包屑](./reference/components/breadcrumb.md)
- [Loading Bar 加载条](./reference/components/loading-bar.md)
- [Menu 菜单](./reference/components/menu.md)
- [Pagination 分页](./reference/components/pagination.md)
- [Steps 步骤](./reference/components/steps.md)
- [Tabs 标签页](./reference/components/tabs.md)

### 反馈组件 (16)
- [Alert 警告信息](./reference/components/alert.md)
- [Badge 标记](./reference/components/badge.md)
- [Dialog 对话框](./reference/components/dialog.md)
- [Drawer 抽屉](./reference/components/drawer.md)
- [Marquee 跑马灯](./reference/components/marquee.md)
- [Message 信息](./reference/components/message.md)
- [Modal 模态框](./reference/components/modal.md)
- [Notification 通知](./reference/components/notification.md)
- [Popconfirm 弹出确认](./reference/components/popconfirm.md)
- [Popover 弹出信息](./reference/components/popover.md)
- [Popselect 弹出选择](./reference/components/popselect.md)
- [Progress 进度](./reference/components/progress.md)
- [Result 结果页](./reference/components/result.md)
- [Skeleton 骨架屏](./reference/components/skeleton.md)
- [Spin 加载](./reference/components/spin.md)
- [Tooltip 弹出提示](./reference/components/tooltip.md)

### 布局组件 (6)
- [Flex 弹性布局](./reference/components/flex.md)
- [Layout 布局](./reference/components/layout.md)
- [Legacy Grid 旧版栅格](./reference/components/legacy-grid.md)
- [Grid 栅格](./reference/components/grid.md)
- [Space 间距](./reference/components/space.md)
- [Split 面板分割](./reference/components/split.md)

### 工具组件 (4)
- [Collapse Transition 折叠渐变](./reference/components/collapse-transition.md)
- [Discrete API 独立 API](./reference/components/discrete-api.md)
- [Scrollbar 滚动条](./reference/components/scrollbar.md)
- [Virtual List 虚拟列表](./reference/components/virtual-list.md)

## JSX/TSX 使用

```jsx
import { NButton } from 'naive-ui'
import { defineComponent } from 'vue'

export default defineComponent({
  render() {
    return <NButton>{{ default: () => 'Star Kirby' }}</NButton>
  }
})
```

**事件处理**：
- 模板中 `@update:value` 对应 JSX 中 `onUpdateValue`
- 所有 `on-update:*` 都有对应的 `onUpdate*` 属性

## 样式冲突处理

### 控制样式插入位置

在 `<head>` 中加入 meta 标签：

```html
<head>
  <!-- naive-ui 样式会插入到这里 -->
  <meta name="naive-ui-style" />
  <!-- vueuc 样式会插入到这里 -->
  <meta name="vueuc-style" />
</head>
```

### 禁用 preflight 样式

```vue
<n-config-provider preflight-style-disabled>
  <your-app />
</n-config-provider>
```

## 支持平台

- **浏览器**: Edge、Firefox、Chrome、Safari 最新 2 个版本（不支持 IE）
- **Vue**: >= 3.0.5
- **TypeScript**: >= 4.1

## 更多资源

- [官方文档](https://www.naiveui.com)
- [GitHub](https://github.com/tusen-ai/naive-ui)
- [设计资源 (Sketch)](https://naive-ui.oss-accelerate.aliyuncs.com/NaiveUI-Design-Library-zh-CN.sketch)
- [图标库 (xicons)](https://www.xicons.org)

## 参考文档

- [SSR 配置详情](./reference/ssr.md)
- [组件详细 API](./reference/components/)
- [主题系统详解](./reference/theme.md)
- [常见问题](./reference/faq.md)
