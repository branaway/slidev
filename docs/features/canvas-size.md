---
relates:
  - guide/faq#adjust-size
  - features/zoom-slide
  - features/transform-component
tags: [layout]
description: |
  Set the size for all your slides.
---

# Slide Canvas Size

Slidev allows you to set the size of the slide canvas via the `canvasWidth` and `aspectRatio` options in the headmatter:

```md
---
# aspect ratio for the slides
aspectRatio: 16/9
# real width of the canvas, unit in px
canvasWidth: 980
---

# Your slides here
```

You can also set `aspectRatio: dynamic` (or `aspectRatio: free`) to make your slides responsive to the browser window. In this mode, the slide container will not enforce a fixed aspect ratio—content will flow naturally, and any overflow will be scrollable. This is ideal for web presentations where you want to use all available space.

```md
---
aspectRatio: dynamic
---
```

> **Note:** The dynamic aspect mode is only applied in the main browser presentation. Print/export/snapshot features will continue to use the fixed aspect ratio.

To scale several slides in your presentation, you can use the `