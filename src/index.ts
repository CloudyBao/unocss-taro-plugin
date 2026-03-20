export interface UnoPresetTaroPluginOptions {
  uno?: Record<string, unknown>;
  postcss?: Record<string, unknown>;
  postcssPluginName?: string;
  injectCssEntry?: boolean;
  injectCssFile?: string;
}

type RunnerOpts = { config?: Record<string, any> };
type TaroPluginContext = {
  modifyRunnerOpts?: (callback: (args: { opts: RunnerOpts }) => void) => void;
  modifyWebpackChain?: (callback: (args: { chain: any; webpack: any; data: any }) => void) => void;
  modifyBuildAssets?: (callback: (args: { assets: Record<string, any> }) => void) => void;
};

const PLUGIN_NAME = 'unocss-preset-taro-plugin';
const DEFAULT_POSTCSS_PLUGIN_NAME = '@unocss/postcss';
const DEFAULT_UNO_CSS_IMPORT = '@import "./uno.css";';
const STYLE_ENTRY_RE = /^app\.(wxss|jxss|acss|ttss|qss|css)$/;

function ensurePostcssPlugin(target: Record<string, any>, pluginName: string, pluginConfig: Record<string, unknown>) {
  const existing = target[pluginName];

  if (existing && typeof existing === 'object') {
    target[pluginName] = {
      ...existing,
      enable: true,
      config: {
        ...(existing.config ?? {}),
        ...pluginConfig,
      },
    };
    return;
  }

  target[pluginName] = {
    enable: true,
    config: pluginConfig,
  };
}

function ensurePostcssConfig(opts: RunnerOpts, pluginName: string, pluginConfig: Record<string, unknown>) {
  const config = (opts.config ??= {});

  for (const key of ['mini', 'h5']) {
    const target = (config[key] ??= {});
    const postcss = (target.postcss ??= {});
    ensurePostcssPlugin(postcss, pluginName, pluginConfig);
  }
}

function resolveUnoWebpackPlugin() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@unocss/webpack');
    return mod.default ?? mod;
  } catch {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('unocss/webpack');
      return mod.default ?? mod;
    } catch {
      throw new Error(
        '[unocss-preset-taro-plugin] Cannot resolve UnoCSS webpack plugin. Please install "@unocss/webpack" (or "unocss").',
      );
    }
  }
}

function getAssetSource(asset: any): string {
  if (asset == null) return '';
  if (typeof asset === 'string') return asset;

  if (typeof asset.source === 'function') {
    const value = asset.source();
    if (Buffer.isBuffer(value)) return value.toString();
    return String(value);
  }

  if (typeof asset._value !== 'undefined') {
    return String(asset._value);
  }

  return String(asset);
}

function setAssetSource(assets: Record<string, any>, file: string, content: string) {
  assets[file] = {
    source: () => content,
    size: () => Buffer.byteLength(content),
  };
}

function resolveCssEntry(assets: Record<string, any>, injectCssFile?: string): string | undefined {
  if (injectCssFile && assets[injectCssFile]) {
    return injectCssFile;
  }

  return Object.keys(assets).find((file) => STYLE_ENTRY_RE.test(file));
}

function injectUnoCssImport(assets: Record<string, any>, injectCssFile?: string) {
  const entry = resolveCssEntry(assets, injectCssFile);
  if (!entry) return;

  const source = getAssetSource(assets[entry]);
  if (source.includes('uno.css')) return;

  const next = `${DEFAULT_UNO_CSS_IMPORT}\n${source}`;
  setAssetSource(assets, entry, next);
}

export default function unocssPresetTaroPlugin(
  ctx: TaroPluginContext,
  userOptions: UnoPresetTaroPluginOptions = {},
) {
  const options: Required<Pick<UnoPresetTaroPluginOptions, 'injectCssEntry'>> & UnoPresetTaroPluginOptions = {
    injectCssEntry: false,
    ...userOptions,
  };

  const postcssPluginName = options.postcssPluginName ?? DEFAULT_POSTCSS_PLUGIN_NAME;

  ctx.modifyRunnerOpts?.(({ opts }) => {
    ensurePostcssConfig(opts, postcssPluginName, options.postcss ?? {});
  });

  ctx.modifyWebpackChain?.(({ chain }) => {
    const UnoWebpackPlugin = resolveUnoWebpackPlugin();
    chain.plugin(PLUGIN_NAME).use(UnoWebpackPlugin, [options.uno ?? {}]);
  });

  if (options.injectCssEntry) {
    ctx.modifyBuildAssets?.(({ assets }) => {
      injectUnoCssImport(assets, options.injectCssFile);
    });
  }
}
