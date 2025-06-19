import type { DoodleProps } from './DoodleProps'

// Expand use elements to actual content before animation
export function expandUseElements(svg: SVGElement): void {
  const useElements = Array.from(svg.querySelectorAll('use'))

  for (const useElement of useElements) {
    const href = useElement.getAttribute('xlink:href') || useElement.getAttribute('href')
    if (!href || !href.startsWith('#')) {
      continue
    }

    const referencedId = href.substring(1)
    const referencedElement = svg.querySelector(`#${referencedId}`)

    if (!referencedElement) {
      continue
    }

    // Clone the referenced element
    const clone = referencedElement.cloneNode(true) as Element

    // Remove the id to avoid duplicates
    clone.removeAttribute('id')

    // Create a group to hold the cloned content with use element's attributes
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')

    // Copy relevant attributes from use element to group
    const attributesToCopy = ['transform', 'opacity', 'class', 'style']
    attributesToCopy.forEach((attr) => {
      const value = useElement.getAttribute(attr)
      if (value) {
        group.setAttribute(attr, value)
      }
    })

    // Add the cloned content to the group
    if (clone.tagName === 'g') {
      // If referenced element is a group, copy its children
      Array.from(clone.children).forEach((child) => {
        group.appendChild(child.cloneNode(true))
      })
    }
    else {
      // If referenced element is a single element, add it directly
      group.appendChild(clone)
    }

    // Replace the use element with the expanded group
    useElement.parentNode?.replaceChild(group, useElement)
  }
}

// Get all drawable paths from SVG
export function getDrawablePaths(svg: SVGElement): Element[] {
  const selector = 'path, line, polyline, polygon, circle, ellipse, rect'
  return Array.from(svg.querySelectorAll(selector))
}

// Convert shapes to paths for consistent animation
export function convertToPath(element: Element, transform: DOMMatrix): string {
  const tagName = element.tagName.toLowerCase()

  if (tagName === 'path') {
    return (element as SVGPathElement).getAttribute('d') || ''
  }

  if (tagName === 'line') {
    const line = element as SVGLineElement
    const x1 = Number.parseFloat(line.getAttribute('x1') || '0')
    const y1 = Number.parseFloat(line.getAttribute('y1') || '0')
    const x2 = Number.parseFloat(line.getAttribute('x2') || '0')
    const y2 = Number.parseFloat(line.getAttribute('y2') || '0')

    const p1 = transformPoint(x1, y1, transform)
    const p2 = transformPoint(x2, y2, transform)

    return `M${p1.x},${p1.y} L${p2.x},${p2.y}`
  }

  if (tagName === 'circle') {
    const circle = element as SVGCircleElement
    const cx = Number.parseFloat(circle.getAttribute('cx') || '0')
    const cy = Number.parseFloat(circle.getAttribute('cy') || '0')
    const r = Number.parseFloat(circle.getAttribute('r') || '0')

    // Get the center point after transformation
    const center = transformPoint(cx, cy, transform)

    // Calculate the transformed radius by transforming a point at distance r
    const radiusPoint = transformPoint(cx + r, cy, transform)
    const transformedR = Math.hypot(radiusPoint.x - center.x, radiusPoint.y - center.y)

    // Create a circle path using four quarter-circle arcs for better precision
    const path = [
      `M${center.x},${center.y - transformedR}`,
      `A${transformedR},${transformedR} 0 0,1 ${center.x + transformedR},${center.y}`,
      `A${transformedR},${transformedR} 0 0,1 ${center.x},${center.y + transformedR}`,
      `A${transformedR},${transformedR} 0 0,1 ${center.x - transformedR},${center.y}`,
      `A${transformedR},${transformedR} 0 0,1 ${center.x},${center.y - transformedR}`,
      'Z',
    ].join(' ')

    return path
  }

  if (tagName === 'ellipse') {
    const ellipse = element as SVGEllipseElement
    const cx = Number.parseFloat(ellipse.getAttribute('cx') || '0')
    const cy = Number.parseFloat(ellipse.getAttribute('cy') || '0')
    const rx = Number.parseFloat(ellipse.getAttribute('rx') || '0')
    const ry = Number.parseFloat(ellipse.getAttribute('ry') || '0')

    const center = transformPoint(cx, cy, transform)
    const scaleX = Math.sqrt(transform.a * transform.a + transform.b * transform.b)
    const scaleY = Math.sqrt(transform.c * transform.c + transform.d * transform.d)
    const transformedRx = rx * scaleX
    const transformedRy = ry * scaleY

    return `M${center.x - transformedRx},${center.y} A${transformedRx},${transformedRy} 0 0,1 ${center.x + transformedRx},${center.y} A${transformedRx},${transformedRy} 0 0,1 ${center.x - transformedRx},${center.y}`
  }

  if (tagName === 'rect') {
    const rect = element as SVGRectElement
    const x = Number.parseFloat(rect.getAttribute('x') || '0')
    const y = Number.parseFloat(rect.getAttribute('y') || '0')
    const width = Number.parseFloat(rect.getAttribute('width') || '0')
    const height = Number.parseFloat(rect.getAttribute('height') || '0')

    const topLeft = transformPoint(x, y, transform)
    const topRight = transformPoint(x + width, y, transform)
    const bottomRight = transformPoint(x + width, y + height, transform)
    const bottomLeft = transformPoint(x, y + height, transform)

    return `M${topLeft.x},${topLeft.y} L${topRight.x},${topRight.y} L${bottomRight.x},${bottomRight.y} L${bottomLeft.x},${bottomLeft.y} Z`
  }

  if (tagName === 'polyline' || tagName === 'polygon') {
    const element_ = element as SVGPolylineElement | SVGPolygonElement
    const points = element_.getAttribute('points') || ''
    if (!points)
      return ''

    const pointsArray = points.trim().split(/[\s,]+/)
    let pathData = ''

    for (let i = 0; i < pointsArray.length; i += 2) {
      const x = Number.parseFloat(pointsArray[i] || '0')
      const y = Number.parseFloat(pointsArray[i + 1] || '0')
      if (!Number.isNaN(x) && !Number.isNaN(y)) {
        const transformed = transformPoint(x, y, transform)
        pathData += i === 0 ? `M${transformed.x},${transformed.y}` : ` L${transformed.x},${transformed.y}`
      }
    }

    if (tagName === 'polygon') {
      pathData += ' Z'
    }

    return pathData
  }

  return ''
}

// utils/svgTransforms.ts - SVG Transform Utilities

// Parse transform string into matrix components
export function parseTransform(transformStr: string): DOMMatrix {
  if (!transformStr) {
    return new DOMMatrix()
  }

  // Create a temporary SVG element to parse the transform
  const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  const tempG = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  tempG.setAttribute('transform', transformStr)
  tempSvg.appendChild(tempG)
  document.body.appendChild(tempSvg)

  const matrix = tempG.transform.baseVal.consolidate()?.matrix || new DOMMatrix()
  document.body.removeChild(tempSvg)

  return new DOMMatrix([matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f])
}

// Calculate combined transformation matrix from element to SVG root
export function getCombinedTransform(element: Element, debug = false): DOMMatrix {
  let combined = new DOMMatrix()
  let current = element as Element | null

  const transforms: DOMMatrix[] = []

  while (current && current.tagName.toLowerCase() !== 'svg') {
    const transform = current.getAttribute('transform')
    if (transform) {
      const matrix = parseTransform(transform)
      transforms.unshift(matrix) // Add to start of array to apply in correct order
    }
    current = current.parentElement
  }

  // Apply transforms in order from root to element
  for (const matrix of transforms) {
    combined = combined.multiply(matrix)
  }

  if (debug) {
    // eslint-disable-next-line no-console
    console.log('Combined transform for element:', {
      element: element.outerHTML,
      transforms: transforms.map(t => ({
        a: t.a,
        b: t.b,
        c: t.c,
        d: t.d,
        e: t.e,
        f: t.f,
      })),
      result: {
        a: combined.a,
        b: combined.b,
        c: combined.c,
        d: combined.d,
        e: combined.e,
        f: combined.f,
      },
    })
  }

  return combined
}

// Apply transformation matrix to point
export function transformPoint(x: number, y: number, matrix: DOMMatrix): { x: number, y: number } {
  const point = new DOMPoint(x, y)
  const transformed = point.matrixTransform(matrix)
  return { x: transformed.x, y: transformed.y }
}

// Get computed style value, including inherited values from parent groups
export function getComputedStyleValue(element: Element, property: string): string {
  // First check the element itself
  const directValue = element.getAttribute(property)
  if (directValue && directValue !== 'none') {
    return directValue
  }

  // Check parent elements up to the SVG root
  let current = element.parentElement
  while (current && current.tagName.toLowerCase() !== 'svg') {
    const parentValue = current.getAttribute(property)
    if (parentValue && parentValue !== 'none') {
      return parentValue
    }
    current = current.parentElement
  }

  // Check if there's a style attribute that might contain the property
  const styleAttr = element.getAttribute('style')
  if (styleAttr) {
    const styles = styleAttr.split(';').map(s => s.trim())
    for (const style of styles) {
      const [prop, value] = style.split(':').map(s => s.trim())
      if (prop === property && value !== 'none') {
        return value
      }
    }
  }

  return ''
}

// Get fill color including inherited values
export function getEffectiveFill(element: Element): string {
  // Check fill attribute first
  let current = element as Element | null
  while (current && current.tagName !== 'svg') {
    const fill = current.getAttribute('fill')
    if (fill && fill !== 'none') {
      return fill
    }
    // Check style attribute for fill
    const styleAttr = current.getAttribute('style')
    if (styleAttr) {
      const styles = styleAttr.split(';').map(s => s.trim())
      for (const style of styles) {
        const [prop, value] = style.split(':').map(s => s.trim())
        if (prop === 'fill' && value && value !== 'none') {
          return value
        }
      }
    }
    current = current.parentElement
  }
  return ''
}

// Load external SVG
export async function loadSvg(props: DoodleProps): Promise<string> {
  if (!props.src)
    return ''

  try {
    // console.log('external svg:', props.src)
    const response = await fetch(props.src)

    // console.log('response:', response)
    if (response.ok) {
      let text = await response.text()
      const parser = new DOMParser()
      const doc = parser.parseFromString(text, 'image/svg+xml')
      const svg = doc.querySelector('svg')
      if (svg) {
        // --- Efficient scaling logic start ---
        // Set viewBox if missing (use width/height if available, else fallback to 0 0 200 200)
        if (!svg.getAttribute('viewBox')) {
          const width = svg.getAttribute('width')
          const height = svg.getAttribute('height')
          if (width && height) {
            svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
          }
          else {
            svg.setAttribute('viewBox', '0 0 200 200')
          }
        }
        // Set/remove width/height based on user props
        if (props.width)
          svg.setAttribute('width', String(props.width))
        else
          svg.removeAttribute('width')
        if (props.height)
          svg.setAttribute('height', String(props.height))
        else
          svg.removeAttribute('height')
        // --- Efficient scaling logic end ---
        // Serialize back to string
        text = svg.outerHTML
      }
      return text
    }
  }
  catch (ee) {
    console.error(ee)
  }

  return ''
}

// Calculate path length more reliably
export function getPathLength(pathData: string): number {
  if (!pathData)
    return 0

  try {
    const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    tempSvg.style.position = 'absolute'
    tempSvg.style.visibility = 'hidden'
    tempSvg.style.width = '0'
    tempSvg.style.height = '0'

    const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    tempPath.setAttribute('d', pathData)

    tempSvg.appendChild(tempPath)
    document.body.appendChild(tempSvg)

    const length = tempPath.getTotalLength?.() || 0
    document.body.removeChild(tempSvg)

    return length
  }
  catch {}
  return 100 // fallback length
}

// Helper: get the start point of a path (or shape)
export function getPathStartPoint(element: Element, transform: DOMMatrix): { x: number, y: number } {
  const tagName = element.tagName.toLowerCase()
  if (tagName === 'path') {
    const d = (element as SVGPathElement).getAttribute('d') || ''
    try {
      // Use SVGPathElement to get the first point
      const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      tempPath.setAttribute('d', d)
      tempSvg.appendChild(tempPath)
      document.body.appendChild(tempSvg)
      const pt = tempPath.getPointAtLength(0)
      document.body.removeChild(tempSvg)
      return { x: pt.x, y: pt.y }
    }
    catch { return { x: 0, y: 0 } }
  }
  // For other shapes, use their first coordinate
  if (tagName === 'line') {
    const x1 = Number.parseFloat(element.getAttribute('x1') || '0')
    const y1 = Number.parseFloat(element.getAttribute('y1') || '0')
    return transformPoint(x1, y1, transform)
  }
  if (tagName === 'circle' || tagName === 'ellipse') {
    const cx = Number.parseFloat(element.getAttribute('cx') || '0')
    const cy = Number.parseFloat(element.getAttribute('cy') || '0')
    return transformPoint(cx, cy, transform)
  }
  if (tagName === 'rect') {
    const x = Number.parseFloat(element.getAttribute('x') || '0')
    const y = Number.parseFloat(element.getAttribute('y') || '0')
    return transformPoint(x, y, transform)
  }
  if (tagName === 'polyline' || tagName === 'polygon') {
    const points = (element.getAttribute('points') || '').trim().split(/\s|,/)
    const x = Number.parseFloat(points[0] || '0')
    const y = Number.parseFloat(points[1] || '0')
    return transformPoint(x, y, transform)
  }
  return { x: 0, y: 0 }
}
