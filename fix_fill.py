#!/usr/bin/env python3

with open('packages/client/builtin/DoodleSvg.vue', 'r') as f:
    content = f.read()

# Replace the getEffectiveFill function
old_func = '''function getEffectiveFill(element: Element): string {
  const fill = getComputedStyleValue(element, 'fill')
  return fill && fill !== 'none' ? fill : ''
}'''

new_func = '''function getEffectiveFill(element: Element): string {
  // Skip elements with fill="none" and look for inherited fill
  let current = element as Element | null
  while (current && current.tagName !== 'svg') {
    const fill = current.getAttribute('fill')
    if (fill && fill !== 'none') {
      return fill
    }
    current = current.parentElement
  }
  return ''
}'''

content = content.replace(old_func, new_func)

with open('packages/client/builtin/DoodleSvg.vue', 'w') as f:
    f.write(content)
print('Function replaced successfully') 