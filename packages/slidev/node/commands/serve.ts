import type { ResolvedSlidevOptions, SlidevServerOptions } from '@slidev/types'
import type { InlineConfig } from 'vite'
import { join } from 'node:path'
import process from 'node:process'
import { createServer as createViteServer } from 'vite'
import { resolveViteConfigs } from './shared'

export async function createServer(
  options: ResolvedSlidevOptions,
  viteConfig: InlineConfig = {},
  serverOptions?: SlidevServerOptions,
) {
  // default open editor to code, #312
  process.env.EDITOR = process.env.EDITOR || 'code'

  const inlineConfig = await resolveViteConfigs(
    options,
    {
      optimizeDeps: {
        entries: [
          join(options.clientRoot, 'main.ts'),
        ],
      },
    } satisfies InlineConfig,
    viteConfig,
    'serve',
    serverOptions,
  )

  // console.log('inlineConfig for vite')

  // console.dir(inlineConfig)

  const server = await createViteServer(inlineConfig)
  // eslint-disable-next-line no-console
  console.log('server created')
  return server
}
