# unocss-preset-taro-plugin

用于 **Taro Webpack 构建链路** 的 UnoCSS 插件，目标是提供和 `taro-plugin-tailwind` 类似的接入体验。

## 参考来源

- [taro-plugin-tailwind](https://github.com/pcdotfan/taro-plugin-tailwind)

## 功能

- 自动向 `mini/h5` 注入 `@unocss/postcss`
- 在 Webpack 链路中挂载 `unocss/webpack`
- 可选向 `app.*ss` 注入 `@import "./uno.css";`（默认关闭）

## 安装

```bash
pnpm add -D unocss-preset-taro-plugin unocss @unocss/postcss @unocss/webpack
```

## 使用

在 `config/index.ts` 中添加插件：

```ts
plugins: [
  [
    'unocss-preset-taro-plugin',
    {
      // 默认 false，建议配合 src/app.ts 的 import 'uno.css' 使用
      injectCssEntry: false,
      // 可选：默认就是 @unocss/postcss
      postcssPluginName: '@unocss/postcss',
      // 透传给 @unocss/postcss
      postcss: {},
      // 透传给 unocss/webpack
      uno: {},
    },
  ],
],
```

并在 `src/app.ts` 引入：

```ts
import 'uno.css'
```

创建 `uno.config.ts`：

```ts
import { defineConfig } from 'unocss'
import { presetUno } from 'unocss'

export default defineConfig({
  presets: [presetUno()],
})
```

> 如果你使用 `unocss-preset-taro`，可在这里追加对应 preset。

## 选项

```ts
interface UnoPresetTaroPluginOptions {
  // 传给 unocss/webpack
  uno?: Record<string, unknown>
  // 传给 @unocss/postcss
  postcss?: Record<string, unknown>
  // 默认：@unocss/postcss
  postcssPluginName?: string
  // 默认 false
  injectCssEntry?: boolean
  // 指定注入文件，比如 app.wxss / app.jxss
  injectCssFile?: string
}
```

## 开源信息

- License: MIT
- Changelog: [CHANGELOG.md](./CHANGELOG.md)
- Contributing: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Code of Conduct: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- Security: [SECURITY.md](./SECURITY.md)

## License

MIT
