const PANEL_WIDTH = 750
const PANEL_HEIGHT = 500
const MIN_VISIBLE_EDGE = 80
const TITLEBAR_SAFE_TOP = 36
const DEFAULT_RIGHT_GAP = 24
const DEFAULT_BOTTOM_GAP = 84
const MAXIMIZED_MARGIN = 12
const MAXIMIZED_BOTTOM_GAP = 36

export type FloatingMassCodePanelBounds = {
  left: number
  top: number
  width: number
  height: number
}

export function getDefaultFloatingMassCodeBounds(): FloatingMassCodePanelBounds {
  const viewportWidth = typeof window === 'undefined' ? 1200 : window.innerWidth
  const viewportHeight = typeof window === 'undefined' ? 800 : window.innerHeight
  return {
    left: Math.max(16, viewportWidth - PANEL_WIDTH - DEFAULT_RIGHT_GAP),
    top: Math.max(TITLEBAR_SAFE_TOP, viewportHeight - PANEL_HEIGHT - DEFAULT_BOTTOM_GAP),
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT
  }
}

export function clampFloatingMassCodeBounds(
  bounds: FloatingMassCodePanelBounds
): FloatingMassCodePanelBounds {
  const viewportWidth =
    typeof window === 'undefined' ? bounds.left + bounds.width : window.innerWidth
  const viewportHeight =
    typeof window === 'undefined' ? bounds.top + bounds.height : window.innerHeight
  return {
    ...bounds,
    left: Math.min(Math.max(8, bounds.left), Math.max(8, viewportWidth - MIN_VISIBLE_EDGE)),
    top: Math.min(
      Math.max(TITLEBAR_SAFE_TOP, bounds.top),
      Math.max(TITLEBAR_SAFE_TOP, viewportHeight - MIN_VISIBLE_EDGE)
    )
  }
}

export function getMaximizedFloatingMassCodeBounds(): FloatingMassCodePanelBounds {
  const viewportWidth = typeof window === 'undefined' ? 1200 : window.innerWidth
  const viewportHeight = typeof window === 'undefined' ? 800 : window.innerHeight
  const top = TITLEBAR_SAFE_TOP
  return {
    left: MAXIMIZED_MARGIN,
    top,
    width: Math.max(PANEL_WIDTH, viewportWidth - MAXIMIZED_MARGIN * 2),
    height: Math.max(PANEL_HEIGHT, viewportHeight - top - MAXIMIZED_BOTTOM_GAP)
  }
}
