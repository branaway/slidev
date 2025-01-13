import type { ResolvedSlidevOptions, SlidevServerOptions } from '@slidev/types'
import type { NextFunction } from 'connect'
import type { IncomingMessage, ServerResponse } from 'node:http'
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

  // bran
  // Add logging middleware at the beginning of the stack
  // XXX disbled this later
  server.middlewares.stack.unshift({
    route: '',
    handle: (
      req: IncomingMessage,
      res: ServerResponse,
      next: NextFunction,
    ) => {
      const url = req.url
      if (options.data.config.viteConfig.base
        && options.data.config.viteConfig.base.length > 1
        && !url!.startsWith(options.data.config.viteConfig.base)
        && url !== '/favicon.ico'
        && url !== '/'
      ) {
        // eslint-disable-next-line no-console
        console.log(`::>> ${req.method} ${req.url}`)
      }

      next()
    },
  })

  // eslint-disable-next-line no-console
  console.log('server created')
  return server
}
