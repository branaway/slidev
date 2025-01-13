import type { ResolvedSlidevOptions, ResolvedSlidevUtils, SlidevData, SlidevEntryOptions } from '@slidev/types'
import path from 'node:path'
import { objectMap, uniq } from '@antfu/utils'
import Debug from 'debug'
import fg from 'fast-glob'
import mm from 'micromatch'
import { resolveAddons } from './integrations/addons'
import { getThemeMeta, resolveTheme } from './integrations/themes'
import { parser } from './parser'
import { getRoots, resolveEntry, toAtFS } from './resolver'
import setupIndexHtml from './setups/indexHtml'
import setupShiki from './setups/shiki'

const debug = Debug('slidev:options')

export async function resolveOptions(
  entryOptions: SlidevEntryOptions,
  mode: ResolvedSlidevOptions['mode'],
): Promise<ResolvedSlidevOptions> {
  const entry = await resolveEntry(entryOptions.entry)
  const rootsInfo = await getRoots(entry)
  const loaded = await parser.load(rootsInfo.userRoot, entry, undefined, mode)

  // Load theme data first, because it may affect the config
  let themeRaw = entryOptions.theme || loaded.headmatter.theme as string | null | undefined
  themeRaw = themeRaw === null ? 'none' : (themeRaw || 'default')
  const [theme, themeRoot] = await resolveTheme(themeRaw, entry)
  const themeRoots = themeRoot ? [themeRoot] : []
  const themeMeta = themeRoot ? await getThemeMeta(theme, themeRoot) : undefined

  // bran hack
  loaded.headmatter.base = entryOptions.viteConfig.base

  const config = parser.resolveConfig(loaded.headmatter, themeMeta, entryOptions.entry)
  const addonRoots = await resolveAddons(config.addons)
  const roots = uniq([...themeRoots, ...addonRoots, rootsInfo.userRoot])

  if (entryOptions.download)
    config.download ||= entryOptions.download

  debug({
    ...rootsInfo,
    ...entryOptions,
    config,
    mode,
    entry,
    themeRaw,
    theme,
    themeRoots,
    addonRoots,
    roots,
  })

  const data: SlidevData = {
    ...loaded,
    config,
    themeMeta,
  }

  // bran
  data.config.viteConfig = entryOptions.viteConfig

  const resolved: Omit<ResolvedSlidevOptions, 'utils'> = {
    ...rootsInfo,
    ...entryOptions,
    data,
    mode,
    entry,
    themeRaw,
    theme,
    themeRoots,
    addonRoots,
    roots,
  }

  return {
    ...resolved,
    utils: await createDataUtils(resolved),
  }
}

export async function createDataUtils(resolved: Omit<ResolvedSlidevOptions, 'utils'>): Promise<ResolvedSlidevUtils> {
  const monacoTypesIgnorePackagesMatches = (resolved.data.config.monacoTypesIgnorePackages || [])
    .map(i => mm.matcher(i))

  let _layouts_cache_time = 0
  let _layouts_cache: Record<string, string> = {}

  // bran
  // console.debug('resolved config', resolved.data.config)
  const shikiEnabled = (resolved.data.config as any).shiki?.enabled ?? true

  // console.debug('[slidev] setup shiki')
  const shiki = shikiEnabled ? (await setupShiki(resolved.roots)) : { shiki: undefined, shikiOptions: undefined }
  // console.debug({shiki})
  //     shiki,
  //  shikiOptions: mergedOptions,

  // eslint-disable-next-line no-console
  console.debug('[slidev] setup indexHtml')
  const indexHtml = setupIndexHtml(resolved)
  // eslint-disable-next-line no-console
  console.debug('[slidev] setup define')
  const define = getDefine(resolved)
  return {
    shiki: shiki.shiki as any,
    shikiOptions: shiki.shikiOptions,
    indexHtml,
    define,
    iconsResolvePath: [resolved.clientRoot, ...resolved.roots].reverse(),
    isMonacoTypesIgnored: pkg => monacoTypesIgnorePackagesMatches.some(i => i(pkg)),
    getLayouts: () => {
      const now = Date.now()
      if (now - _layouts_cache_time < 2000)
        return _layouts_cache

      const layouts: Record<string, string> = {}

      for (const root of [resolved.clientRoot, ...resolved.roots]) {
        const layoutPaths = fg.sync('layouts/**/*.{vue,ts}', {
          cwd: root,
          absolute: true,
          suppressErrors: true,
        })

        for (const layoutPath of layoutPaths) {
          const layoutName = path.basename(layoutPath).replace(/\.\w+$/, '')
          layouts[layoutName] = layoutPath
        }
      }

      _layouts_cache_time = now
      _layouts_cache = layouts

      return layouts
    },
  }
}

function getDefine(options: Omit<ResolvedSlidevOptions, 'utils'>): Record<string, string> {
  const matchMode = (mode: string | boolean) => mode === true || mode === options.mode
  const features = {
    __DEV__: options.mode === 'dev',
    __SLIDEV_CLIENT_ROOT__: toAtFS(options.clientRoot),
    __SLIDEV_HASH_ROUTE__: options.data.config.routerMode === 'hash',
    __SLIDEV_FEATURE_DRAWINGS__: matchMode(options.data.config.drawings.enabled),
    __SLIDEV_FEATURE_EDITOR__: options.mode === 'dev' && options.data.config.editor !== false,
    __SLIDEV_FEATURE_DRAWINGS_PERSIST__: !!options.data.config.drawings.persist,
    __SLIDEV_FEATURE_RECORD__: matchMode(options.data.config.record),
    __SLIDEV_FEATURE_PRESENTER__: matchMode(options.data.config.presenter),
    __SLIDEV_FEATURE_PRINT__: options.mode === 'export' || (options.mode === 'build' && [true, 'true', 'auto'].includes(options.data.config.download)),
    __SLIDEV_FEATURE_BROWSER_EXPORTER__: matchMode(options.data.config.browserExporter),
    __SLIDEV_FEATURE_WAKE_LOCK__: matchMode(options.data.config.wakeLock),
    __SLIDEV_HAS_SERVER__: options.mode !== 'build',
  }
  // eslint-disable-next-line no-console
  console.debug('[slidev] define', features)
  return objectMap(
    features,
    (v, k) => [v, JSON.stringify(k)],
  )
}
