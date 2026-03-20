import path from 'node:path';

export interface UnoTaroPluginOptions {
  uno?: Record<string, unknown>;
  postcss?: Record<string, unknown>;
  postcssPluginName?: string;
  injectCssEntry?: boolean;
  injectCssFile?: string;
  /**
   * Apply `@unocss/webpack` on h5 build.
   *
   * Disabled by default because some Taro h5 pipelines may include html/json/data modules
   * that are incompatible with Uno's webpack unplugin loader.
   */
  enableH5WebpackPlugin?: boolean;
}

type RunnerOpts = Record<string, any>;
type TaroPluginContext = {
  initialConfig?: Record<string, any>;
  modifyRunnerOpts?: (callback: (args: { opts: RunnerOpts }) => void) => void;
  modifyWebpackChain?: (callback: (args: { chain: any; webpack: any; data: any }) => void) => void;
  modifyBuildAssets?: (callback: (args: { assets: Record<string, any> }) => void) => void;
};

const PLUGIN_NAME = 'unocss-taro-plugin';
const DEFAULT_POSTCSS_PLUGIN_NAME = path.join(__dirname, 'postcss-unocss.cjs');
const DEFAULT_UNO_CSS_IMPORT = '@import "./uno.css";';
const STYLE_ENTRY_RE = /^app\.(wxss|jxss|acss|ttss|qss|css)$/;
const H5_SAFE_INCLUDE_RE = [/\.[jt]sx?($|\?)/, /__uno\.css($|\?)/];
const H5_SAFE_EXCLUDE_RE = [
  /[/\\]node_modules[/\\]/,
  /\.html?($|\?)/,
  /\.json($|\?)/,
  /^data:/,
];

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

function resolveRunnerConfig(opts: RunnerOpts): Record<string, any> {
  // Taro 4 passes `opts` directly as the config object in `modifyRunnerOpts`.
  // Some older plugin examples pass a wrapper shape `{ config }`.
  if (opts && typeof opts === 'object') {
    const hasDirectConfigShape =
      'mini' in opts || 'h5' in opts || 'rn' in opts || 'sourceRoot' in opts || 'outputRoot' in opts;
    if (hasDirectConfigShape) {
      return opts;
    }

    if (opts.config && typeof opts.config === 'object') {
      return opts.config;
    }
  }

  return opts;
}

function ensurePostcssConfig(opts: RunnerOpts, pluginName: string, pluginConfig: Record<string, unknown>) {
  const config = resolveRunnerConfig(opts);

  for (const key of ['mini', 'h5']) {
    const target = (config[key] ??= {});
    const postcss = (target.postcss ??= {});
    ensurePostcssPlugin(postcss, pluginName, pluginConfig);
  }
}

function normalizeUnoWebpackOptions(buildAdapter: string, userUnoOptions: Record<string, unknown>) {
  if (buildAdapter !== 'h5') {
    return userUnoOptions;
  }

  const options = { ...userUnoOptions } as Record<string, any>;
  const include = Array.isArray(options.include) ? options.include : [];
  const exclude = Array.isArray(options.exclude) ? options.exclude : [];

  // Limit transform scope for Taro h5 to avoid parsing html/json/binary modules.
  options.include = [...H5_SAFE_INCLUDE_RE, ...include];
  options.exclude = [...H5_SAFE_EXCLUDE_RE, ...exclude];

  return options;
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
        '[unocss-taro-plugin] Cannot resolve UnoCSS webpack plugin. Please install "@unocss/webpack" (or "unocss").',
      );
    }
  }
}

function resolveBuildAdapter(data: any): string {
  if (typeof data?.buildAdapter === 'string' && data.buildAdapter) {
    return data.buildAdapter;
  }
  if (typeof data?.adapter === 'string' && data.adapter) {
    return data.adapter;
  }
  if (typeof process.env.TARO_ENV === 'string' && process.env.TARO_ENV) {
    return process.env.TARO_ENV;
  }
  return '';
}

function resolvePostcssPluginName(name?: string): string {
  // Taro calls `require(name)(config)`, but `@unocss/postcss` exports `{ default }`.
  // Route to our CJS proxy that always exports a callable function.
  if (!name || name === '@unocss/postcss' || name === 'unocss/postcss') {
    return DEFAULT_POSTCSS_PLUGIN_NAME;
  }
  return name;
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

export default function unocssTaroPlugin(
  ctx: TaroPluginContext,
  userOptions: UnoTaroPluginOptions = {},
) {
  const options: Required<Pick<UnoTaroPluginOptions, 'injectCssEntry' | 'enableH5WebpackPlugin'>> &
    UnoTaroPluginOptions = {
    injectCssEntry: false,
    enableH5WebpackPlugin: false,
    ...userOptions,
  };

  const postcssPluginName = resolvePostcssPluginName(options.postcssPluginName);
  const postcssConfig = options.postcss ?? {};

  // Some Taro platform runners read `initialConfig` directly instead of runner opts.
  // Patch both paths to ensure PostCSS plugins are visible on h5/mini.
  if (ctx.initialConfig && typeof ctx.initialConfig === 'object') {
    ensurePostcssConfig(ctx.initialConfig, postcssPluginName, postcssConfig);
  }

  ctx.modifyRunnerOpts?.(({ opts }) => {
    ensurePostcssConfig(opts, postcssPluginName, postcssConfig);
  });

  ctx.modifyWebpackChain?.(({ chain, data }) => {
    const buildAdapter = resolveBuildAdapter(data);
    if (buildAdapter === 'h5' && !options.enableH5WebpackPlugin) {
      return;
    }

    const UnoWebpackPlugin = resolveUnoWebpackPlugin();
    const unoOptions = normalizeUnoWebpackOptions(buildAdapter, (options.uno ?? {}) as Record<string, unknown>);
    chain.plugin(PLUGIN_NAME).use(UnoWebpackPlugin, [unoOptions]);
  });

  if (options.injectCssEntry) {
    ctx.modifyBuildAssets?.(({ assets }) => {
      injectUnoCssImport(assets, options.injectCssFile);
    });
  }
}
