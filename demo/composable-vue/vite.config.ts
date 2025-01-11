import { defineConfig } from 'vite'

const BASE = '/composable-vue/'
export default defineConfig({
  base: `/${BASE}/`, // Base path matching the proxy
  plugins: [],
  server: {
    fs: {
      allow: [
        // bran:
        // needed for bun to run the slidev server
        '/Users/bran/localProjects/slidev/node_modules/.pnpm/',
      ],
    },
    hmr: {
      path: `/${BASE}/@vite/client`, // HMR client path matching the proxy
    },
  },
})
