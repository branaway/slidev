/**
 * Interface defining the properties for the Doodle component
 */
export interface DoodleProps {
  /** Name identifier for the doodle animation */
  name?: string
  /** Path to the SVG file to be animated */
  src?: string
  /** Duration of the animation in milliseconds */
  duration?: number
  /** Delay before the animation starts in milliseconds */
  delay?: number
  /** Width of the SVG stroke in pixels */
  strokeWidth?: number
  /** Color of the SVG stroke */
  strokeColor?: string
  /** Delay before fill animation starts in milliseconds */
  fillDelay?: number
  /** Whether to trigger the animation manually */
  trigger?: boolean
  /** CSS easing function for the animation (e.g. 'ease-in', 'linear') */
  easing?: string
  /** Enable debug mode to show additional information */
  debug?: boolean
  /** Whether to play the animation automatically on mount */
  autoplay?: boolean
  /** When to reset the animation - on slide change or click */
  autoreset?: 'slide' | 'click'
  /** Whether to show a pointer following the drawing path */
  showPointer?: boolean
  /** Custom image source for the pointer */
  pointerSrc?: string
  /** Size of the pointer in pixels */
  pointerSize?: number
  /** Horizontal offset of the pointer from the path */
  pointerOffsetX?: number
  /** Vertical offset of the pointer from the path */
  pointerOffsetY?: number
  /** Gap between pointer and the drawing path in pixels */
  pointerGap?: number
  /** Override width of the SVG container in pixels */
  width?: number
  /** Override height of the SVG container in pixels */
  height?: number
  /** If true, paths will be sorted based on their starting points */
  sortPaths?: boolean
}
