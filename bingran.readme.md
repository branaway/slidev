context.ts:  useSlideContext
  const $slidev = injectLocal(injectionSlidevContext)!
  const $nav = toRef($slidev, 'nav')
  const $clicksContext = injectLocal(injectionClicksContext)!.value
  const $clicks = toRef($clicksContext, 'current')
  const $page = injectLocal(injectionCurrentPage)!
  const $renderContext = injectLocal(injectionRenderContext)!
  const $frontmatter = injectLocal(injectionFrontmatter, {})
  const $route = injectLocal(injectionRoute, undefined)
  const $scale = injectLocal(injectionSlideScale, ref(1))
  const $zoom = injectLocal(injectionSlideZoom, computed(() => 1))



SlidevContextNav in useNav.ts

this has all navi stuff

```ts
slides: Ref<SlideRoute[]>
  total: ComputedRef<number>

  currentPath: ComputedRef<string>
  currentPage: ComputedRef<number>
  currentSlideNo: ComputedRef<number>
  currentSlideRoute: ComputedRef<SlideRoute>
  currentTransition: ComputedRef<TransitionGroupProps | undefined>
  currentLayout: ComputedRef<string>

  nextRoute: ComputedRef<SlideRoute>
  prevRoute: ComputedRef<SlideRoute>
  hasNext: ComputedRef<boolean>
  hasPrev: ComputedRef<boolean>

  clicksContext: ComputedRef<ClicksContext>
  clicks: ComputedRef<number>
  clicksStart: ComputedRef<number>
  clicksTotal: ComputedRef<number>

  /** The table of content tree */
  tocTree: ComputedRef<TocItem[]>
  /** The direction of the navigation, 1 for forward, -1 for backward */
  navDirection: Ref<number>
  /** The direction of the clicks, 1 for forward, -1 for backward */
  clicksDirection: Ref<number>
  /** Utility function for open file in editor, only avaible in dev mode  */
  openInEditor: (url?: string) => Promise<boolean>

  /** Go to next click */
  next: () => Promise<void>
  /** Go to previous click */
  prev: () => Promise<void>
  /** Go to next slide */
  nextSlide: (lastClicks?: boolean) => Promise<void>
  /** Go to previous slide */
  prevSlide: (lastClicks?: boolean) => Promise<void>
  /** Go to slide */
  go: (no: number | string, clicks?: number, force?: boolean) => Promise<void>
  /** Go to the first slide */
  goFirst: () => Promise<void>
  /** Go to the last slide */
  goLast: () => Promise<void>

  /** Enter presenter mode */
  enterPresenter: () => void
  /** Exit presenter mode */
  exitPresenter: () => void
}

```

according to AI:

```ts
import { useSlideInfo } from 'path/to/slidev/source/useSlideInfo'
const slideInfo = useSlideInfo(1) // For slide number 1
console.log(slideInfo.info.value) // Access slide metadata
await slideInfo.update({ note: 'New note for slide 1' }) // Update slide metadata

```


# useEmbeddedControl

it has window message handler:

```ts

import { throttledWatch } from '@vueuse/core'
import { useNav } from '../composables/useNav'
import { isDark } from '../logic/dark'

export function useEmbeddedControl() {
  const nav = useNav()
  const clientId = `${Date.now()}`

  window.addEventListener('message', ({ data }) => {
    if (data && data.target === 'slidev') {
      if (data.type === 'navigate') {
        if (data.no || data.clicks) {
          nav.go(+data.no, +data.clicks || 0)
        }
        else if (typeof data.operation === 'string') {
          const fn = nav[data.operation as keyof typeof nav]
          if (typeof fn === 'function')
            (fn as any)(...(data.args ?? []))
        }
      }
      else if (data.type === 'css-vars') {
        const root = document.documentElement
        for (const [key, value] of Object.entries(data.vars || {}))
          root.style.setProperty(key, value as any)
      }
      else if (data.type === 'color-schema') {
        isDark.value = data.color === 'dark'
      }
    }
  })

  if (nav.isEmbedded.value) {
    throttledWatch(
      [nav.currentSlideNo, nav.clicks, nav.hasNext, nav.hasPrev],
      ([no, clicks, hasNext, hasPrev]) => {
        window.parent.postMessage(
          {
            target: 'slidev',
            clientId,
            navState: {
              no,
              clicks,
              hasNext,
              hasPrev,
            },
          },
          '*',
        )
      },
      {
        throttle: 300,
        immediate: true,
      },
    )
  }
}
```

# index html processing

in `indexHtml.ts`

# Questions

- can the default index.html replaced with custom version?

## fav theme:

- https://gureckis.github.io/slidev-theme-neversink/
- https://gureckis.github.io/slidev-theme-neversink/example/#/1, see his work:  https://todd.gureckislab.org/talks
- one of the examplar talk:  https://talks.gureckislab.org/public/2024/2024-07-26_cogsci_social_traps/#/presenter/7, with great presentror script.
- 


## default config

- see packages/parser/src/config.ts

## built-in vite config:

packages/slidev/node/vite/extendConfig.ts



## server part

- in the `loader.ts`, there is a function `createSlidesLoader` that set up a vite server route to save content from the front end.

## default config

- see `packages/parser/src/config.ts`