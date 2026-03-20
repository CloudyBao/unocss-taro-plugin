# unocss-taro-plugin

用于 **Taro Webpack 构建链路** 的 UnoCSS 插件，目标是提供类似 `taro-plugin-tailwind` 的接入体验。

## 参考来源

- [taro-plugin-tailwind](https://github.com/pcdotfan/taro-plugin-tailwind)

## 功能

- 自动向 `mini/h5` 注入 `@unocss/postcss`
- 在 Webpack 链路中挂载 `@unocss/webpack`（默认跳过 `h5`，避免部分 h5 管线兼容问题）
- 可选向 `app.*ss` 注入 `@import "./uno.css";`（默认关闭）

## 安装

```bash
pnpm add -D unocss-taro-plugin unocss @unocss/postcss @unocss/webpack
```

## 使用

在 `config/index.ts` 中添加插件：

```ts
plugins: [
  [
    'unocss-taro-plugin',
    {
      injectCssEntry: false,
      postcssPluginName: 'unocss/postcss',
      postcss: {},
      uno: {},
      enableH5WebpackPlugin: false,
    },
  ],
],
```

默认（`enableH5WebpackPlugin: false`）建议在 `src/app.ts` 引入入口样式：

```ts
import './styles/uno.css'
```

并在 `src/styles/uno.css` 写入：

```css
@unocss all;
```

创建 `uno.config.ts`：

```ts
import { defineConfig, presetWind3 } from 'unocss'

export default defineConfig({
  presets: [presetWind3()],
})
```

## 选项

```ts
interface UnoTaroPluginOptions {
  uno?: Record<string, unknown>
  postcss?: Record<string, unknown>
  postcssPluginName?: string
  injectCssEntry?: boolean
  injectCssFile?: string
  enableH5WebpackPlugin?: boolean
}
```

## 开源信息

- License: MIT
- Changelog: [CHANGELOG.md](./CHANGELOG.md)
- Contributing: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Code of Conduct: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- Security: [SECURITY.md](./SECURITY.md)
