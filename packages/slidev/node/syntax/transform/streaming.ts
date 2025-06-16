import type { MarkdownTransformContext } from '@slidev/types'

export function transformStreaming(ctx: MarkdownTransformContext) {
  if (!ctx.options.data.config.streamingMarkdown)
    return

  // Collect all non-code block content
  const content: string[] = []
  ctx.s.replace(
    /^([^`\n].*)$/gm,
    (full) => {
      content.push(full)
      return '' // Remove the original content
    },
  )

  // If we have content, add a single StreamingMarkdown component at the beginning
  if (content.length > 0) {
    const combinedContent = content.join('\n\n')
    ctx.s.prepend(`<StreamingMarkdown content='${combinedContent.replace(/'/g, '\\\'')}' :speed="${ctx.options.data.config.streamingSpeed || 20}" />\n\n`)
  }
}
