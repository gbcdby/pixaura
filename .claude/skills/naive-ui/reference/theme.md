# 主题系统详解

## 主题系统概述

Naive UI 提供了一个使用 TypeScript 构建的先进类型安全主题系统。你只需要提供一个样式覆盖的对象，剩下的都交给我们。

特点：
- 无需 less、sass、css 变量
- 无需 webpack 的 loaders
- 类型安全
- 支持亮色/暗色主题
- 支持组件级别的主题定制

## 主题变量

### 通用变量 (Common Variables)

```ts
interface CommonThemeVars {
  // 字体
  fontFamily: string
  fontFamilyMono: string
  fontWeight: string
  fontWeightStrong: string
  
  // 动画
  cubicBezierEaseInOut: string
  cubicBezierEaseOut: string
  cubicBezierEaseIn: string
  
  // 圆角
  borderRadius: string
  borderRadiusSmall: string
  
  // 字体大小
  fontSize: string
  fontSizeMini: string
  fontSizeTiny: string
  fontSizeSmall: string
  fontSizeMedium: string
  fontSizeLarge: string
  fontSizeHuge: string
  
  // 行高
  lineHeight: string
  
  // 高度
  heightMini: string
  heightTiny: string
  heightSmall: string
  heightMedium: string
  heightLarge: string
  heightHuge: string
  
  // 基础颜色
  baseColor: string
  primaryColor: string
  primaryColorHover: string
  primaryColorPressed: string
  primaryColorSuppl: string
  infoColor: string
  infoColorHover: string
  infoColorPressed: string
  infoColorSuppl: string
  successColor: string
  successColorHover: string
  successColorPressed: string
  successColorSuppl: string
  warningColor: string
  warningColorHover: string
  warningColorPressed: string
  warningColorSuppl: string
  errorColor: string
  errorColorHover: string
  errorColorPressed: string
  errorColorSuppl: string
  
  // 文本颜色
  textColorBase: string
  textColor1: string
  textColor2: string
  textColor3: string
  textColorDisabled: string
  
  // 其他颜色
  placeholderColor: string
  placeholderColorDisabled: string
  iconColor: string
  iconColorHover: string
  iconColorPressed: string
  iconColorDisabled: string
  
  // 透明度
  opacity1: string
  opacity2: string
  opacity3: string
  opacity4: string
  opacity5: string
  
  // 边框和分割线
  dividerColor: string
  borderColor: string
  
  // 关闭图标
  closeIconColor: string
  closeIconColorHover: string
  closeIconColorPressed: string
  closeColorHover: string
  closeColorPressed: string
  
  // 清除图标
  clearColor: string
  clearColorHover: string
  clearColorPressed: string
  
  // 滚动条
  scrollbarColor: string
  scrollbarColorHover: string
  scrollbarWidth: string
  scrollbarHeight: string
  scrollbarBorderRadius: string
  
  // 进度条
  progressRailColor: string
  railColor: string
  
  // 弹出层颜色
  popoverColor: string
  tableColor: string
  cardColor: string
  modalColor: string
  bodyColor: string
  tagColor: string
  avatarColor: string
  invertedColor: string
  inputColor: string
  codeColor: string
  tabColor: string
  actionColor: string
  tableHeaderColor: string
  
  // 悬停和按下
  hoverColor: string
  tableColorHover: string
  tableColorStriped: string
  pressedColor: string
  
  // 禁用
  opacityDisabled: string
  inputColorDisabled: string
  
  // 按钮
  buttonColor2: string
  buttonColor2Hover: string
  buttonColor2Pressed: string
  
  // 阴影
  boxShadow1: string
  boxShadow2: string
  boxShadow3: string
}
```

## 使用主题

### 使用暗色主题

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

### 调整主题变量

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
    primaryColorHover: '#FF3333',
    primaryColorPressed: '#CC0000'
  }
}
</script>
```

### 使用 TypeScript 类型

```vue
<script setup lang="ts">
import type { GlobalThemeOverrides } from 'naive-ui'

const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#FF0000'
  },
  Button: {
    textColor: '#FF0000'
  }
}
</script>
```

### 调整组件主题变量

```vue
<script setup>
const themeOverrides = {
  common: {
    primaryColor: '#18a058'
  },
  Button: {
    textColor: '#FF0000',
    textColorHover: '#FF3333',
    textColorPressed: '#CC0000',
    textColorFocus: '#FF0000'
  },
  Input: {
    borderColor: '#18a058',
    borderColorHover: '#36ad6a',
    borderColorFocus: '#36ad6a'
  }
}
</script>
```

### 不同主题下调整变量

```vue
<template>
  <n-config-provider :theme="theme" :theme-overrides="theme === null ? lightThemeOverrides : darkThemeOverrides">
    <app />
  </n-config-provider>
</template>

<script setup>
import { ref } from 'vue'
import { darkTheme } from 'naive-ui'

const theme = ref(null) // null 为亮色主题，darkTheme 为暗色主题

const lightThemeOverrides = {
  common: {
    primaryColor: '#18a058'
  }
}

const darkThemeOverrides = {
  common: {
    primaryColor: '#63e2b7'
  }
}
</script>
```

## 获取主题变量

### useThemeVars

```vue
<template>
  <div :style="{ color: themeVars.primaryColor }">
    使用主题变量
  </div>
</template>

<script setup>
import { useThemeVars } from 'naive-ui'

const themeVars = useThemeVars()
// themeVars.value 包含所有主题变量
</script>
```

### 在 CSS 中使用

```vue
<template>
  <n-element tag="div" class="my-element">
    内容
  </n-element>
</template>

<style scoped>
.my-element {
  color: var(--primary-color);
  background-color: var(--body-color);
}
</style>
```

## 使用 n-global-style

如果你需要给 body 元素也应用主题样式，而不仅仅是组件：

```vue
<template>
  <n-config-provider :theme="darkTheme">
    <n-global-style />
    <app />
  </n-config-provider>
</template>

<script setup>
import { darkTheme } from 'naive-ui'
</script>
```

注意：不使用 `n-global-style` 就能让 `vfonts` 直接生效是一个设计上的妥协，在下个大的版本默认的全局 reset 样式将不再带有字体相关的样式，而是全部置于 `n-global-style` 组件中。

## 使用 n-element

`n-element` 组件可以让你在模板中方便地使用主题变量：

```vue
<template>
  <n-element tag="div" class="my-element">
    <template #default="{ themeVars }">
      <div :style="{ color: themeVars.primaryColor }">
        使用主题变量
      </div>
    </template>
  </n-element>
</template>
```

## 创建适配主题的组件

### 使用 provideTheme

```vue
<script setup>
import { provideTheme } from 'naive-ui'

const { themeRef, themeClass, vars } = provideTheme('Button')

// themeRef: 当前主题
// themeClass: 主题类名
// vars: 主题变量
</script>
```

### 使用 useThemeVars

```vue
<script setup>
import { useThemeVars } from 'naive-ui'

const themeVars = useThemeVars()

// 在 setup 中使用
console.log(themeVars.value.primaryColor)
</script>
```

### 完整示例

```vue
<template>
  <div class="my-component" :style="cssVars">
    <slot />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useThemeVars } from 'naive-ui'

const themeVars = useThemeVars()

const cssVars = computed(() => {
  return {
    '--my-primary-color': themeVars.value.primaryColor,
    '--my-background-color': themeVars.value.bodyColor
  }
})
</script>

<style scoped>
.my-component {
  color: var(--my-primary-color);
  background-color: var(--my-background-color);
}
</style>
```

## 使用 peers 主题变量

某些组件有 peers（同伴组件），你可以通过 peers 来调整它们的外观：

```vue
<script setup>
const themeOverrides = {
  Select: {
    peers: {
      InternalSelection: {
        textColor: '#FF0000'
      },
      InternalSelectMenu: {
        optionTextColor: '#00FF00'
      }
    }
  }
}
</script>
```

## 主题编辑器

Naive UI 主页右下角有一个主题编辑器，你可以：

1. 修改主题变量
2. 实时预览效果
3. 导出 themeOverrides 对象

## 内置主题

### lightTheme

默认亮色主题。

### darkTheme

暗色主题。

```vue
<script setup>
import { lightTheme, darkTheme } from 'naive-ui'

console.log(lightTheme.common.primaryColor) // #18a058
console.log(darkTheme.common.primaryColor) // #63e2b7
</script>
```

## 自定义主题

### 创建主题

```ts
import { createTheme } from 'naive-ui'
import { buttonDark } from 'naive-ui/es/button/styles'
import { inputDark } from 'naive-ui/es/input/styles'

const myTheme = createTheme([
  buttonDark,
  inputDark
])
```

### 合并主题

```ts
import { createTheme, darkTheme } from 'naive-ui'
import { buttonDark } from 'naive-ui/es/button/styles'

const mergedTheme = createTheme([
  darkTheme,
  buttonDark
])
```

## 服务端渲染 (SSR) 主题配置

### 禁用内联主题

```vue
<template>
  <n-config-provider inline-theme-disabled>
    <app />
  </n-config-provider>
</template>
```

### 抽象模式

```vue
<template>
  <n-config-provider abstract>
    <app />
  </n-config-provider>
</template>
```

## 常见问题

### 如何查看所有可用的主题变量？

1. 访问 Naive UI 官网
2. 点击右下角的主题编辑器
3. 查看所有变量

### 如何覆盖特定组件的样式？

使用组件名称作为 key：

```ts
const themeOverrides = {
  Button: {
    textColor: '#FF0000'
  },
  Input: {
    borderColor: '#00FF00'
  }
}
```

### 如何同时支持亮色和暗色主题？

```vue
<template>
  <n-config-provider 
    :theme="isDark ? darkTheme : null"
    :theme-overrides="isDark ? darkOverrides : lightOverrides"
  >
    <app />
  </n-config-provider>
</template>

<script setup>
import { ref } from 'vue'
import { darkTheme } from 'naive-ui'

const isDark = ref(false)

const lightOverrides = {
  common: {
    primaryColor: '#18a058'
  }
}

const darkOverrides = {
  common: {
    primaryColor: '#63e2b7'
  }
}
</script>
```
