# SSR 配置详情

## 注意事项

无论在任何框架下使用 SSR，需要确保项目满足以下条件：

1. 构建时，任何被直接和间接引用的 `@css-render/*` 和 `css-render` 包版本都 >= 0.15.14
2. 构建时，任何被直接和间接引用的每个 `@css-render/*` 和 `css-render` 包最终只都指向一个目标（一个包不会有多个版本，也不会有同一个版本的多个副本）

你可以在 lock file 中搜索 `css-render` 去检查是否有重复的包。如果上述条件没有满足，可能会导致 SSR 构建失败。

## Nuxt.js

### 安装模块

```bash
# npm
npx nuxi module add nuxtjs-naive-ui

# pnpm
pnpm dlx nuxi module add nuxtjs-naive-ui
```

### 基本配置

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['nuxtjs-naive-ui']
})
```

### 使用自动引入

```ts
// nuxt.config.ts
import AutoImport from 'unplugin-auto-import/vite'
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'

export default defineNuxtConfig({
  modules: ['nuxtjs-naive-ui'],
  vite: {
    plugins: [
      AutoImport({
        imports: [
          {
            'naive-ui': [
              'useDialog',
              'useMessage',
              'useNotification',
              'useLoadingBar'
            ]
          }
        ]
      }),
      Components({
        resolvers: [NaiveUiResolver()]
      })
    ]
  }
})
```

### 完整示例

参考 [naive-ui-nuxt-demo](https://github.com/07akioni/naive-ui-nuxt-demo)

## Vitepress

### 安装依赖

```bash
npm i -D @css-render/vue3-ssr
```

### 配置 .vitepress/theme/index.js

```js
import { setup } from '@css-render/vue3-ssr'
import { NConfigProvider } from 'naive-ui'
import { useRoute } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import { defineComponent, h, inject } from 'vue'

const { Layout } = DefaultTheme

const CssRenderStyle = defineComponent({
  setup() {
    const collect = inject('css-render-collect')
    return {
      style: collect()
    }
  },
  render() {
    return h('css-render-style', {
      innerHTML: this.style
    })
  }
})

const VitepressPath = defineComponent({
  setup() {
    const route = useRoute()
    return () => {
      return h('vitepress-path', null, [route.path])
    }
  }
})

const NaiveUIProvider = defineComponent({
  render() {
    return h(
      NConfigProvider,
      { abstract: true, inlineThemeDisabled: true },
      {
        default: () => [
          h(Layout, null, {
            'doc-before': () => h(VitepressPath)
          }),
          h(CssRenderStyle)
        ]
      }
    )
  }
})

export default {
  extends: DefaultTheme,
  Layout: NaiveUIProvider,
  enhanceApp({ app }) {
    if (typeof window === 'undefined') {
      const { collect } = setup(app)
      app.provide('css-render-collect', collect)
    }
  }
}
```

### 完整示例

参考 [naive-ui-vitepress-demo](https://github.com/07akioni/naive-ui-vitepress-demo)

## Vite SSG/SSE

### 安装依赖

```bash
npm i naive-ui @css-render/vue3-ssr
```

### 配置 vite.config.ts

```ts
import { setup } from '@css-render/vue3-ssr'
import { defineConfig } from 'vite'

export default defineConfig({
  ssr: {
    noExternal: ['naive-ui', 'vueuc', 'date-fns']
  },
  ssgOptions: {
    async onBeforePageRender(_, __, appCtx) {
      const { collect } = setup(appCtx.app)
      ;(appCtx as any).__collectStyle = collect
      return undefined
    },
    async onPageRendered(_, renderedHTML, appCtx) {
      return renderedHTML.replace(
        /<\/head>/,
        `${(appCtx as any).__collectStyle()}</head>`
      )
    }
  }
})
```

## Vite SSR 示例

参考 [naive-ui-vite-ssr](https://github.com/07akioni/naive-ui-vite-ssr)

## Webpack SSR 示例

参考 [playground/ssr](https://github.com/tusen-ai/naive-ui/tree/main/playground/ssr)

## 内联样式优化

默认情况下，naive-ui 会在组件上绑定 inline 主题样式，这可能会影响 SSR 的尺寸。你可以使用 `n-config-provider` 的 `inline-theme-disabled` 属性来优化：

```vue
<template>
  <n-config-provider inline-theme-disabled>
    <app />
  </n-config-provider>
</template>
```

## SSR 已知问题

下列组件在 SSR 场景中存在一些 Bug，使用时请尽量规避：

- `n-scrollbar`
- `n-data-table`（vue 版本 >= 3.2.36 后没有问题）
- `n-anchor`
- `n-avatar-group`
- `n-watermark`
- `n-affix`
- `n-transfer`
