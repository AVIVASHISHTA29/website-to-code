import { useEffect, useRef } from 'react'
import { DEFAULT_CONFIG, type BlobConfig } from './config'
import { createBlobRenderer, type BlobRenderer } from './renderer'

export interface BlobProps extends Partial<BlobConfig> {
  className?: string
  style?: React.CSSProperties
  /** Called once if WebGL2 is unavailable or a shader fails to build. */
  onError?: (error: Error) => void
}

/**
 * A particle blob on a <canvas>. Everything is driven from props; the renderer
 * owns a single rAF loop and no React state changes per frame.
 */
export function Blob({ className, style, onError, ...overrides }: BlobProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<BlobRenderer | null>(null)

  // Keep the latest config in a ref so prop changes never restart the loop.
  const config: BlobConfig = { ...DEFAULT_CONFIG, ...overrides }
  const configRef = useRef(config)
  configRef.current = config

  useEffect(() => {
    rendererRef.current?.setConfig(configRef.current)
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let renderer: BlobRenderer
    try {
      renderer = createBlobRenderer(canvas, configRef.current)
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)))
      return
    }
    rendererRef.current = renderer

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      renderer.frame(reduced ? 0 : dt)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    const ro = new ResizeObserver(() => renderer.resize())
    ro.observe(canvas)

    /* ------------------------------------------------------ interaction */

    let dragging = false
    let lastX = 0
    let lastY = 0

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      renderer.setPointer(e.clientX - rect.left, e.clientY - rect.top)
      if (dragging && configRef.current.dragToOrbit) {
        // 0.00025 rad/px: inertia multiplies each increment by ~1/damping
        // (~8.3x), which lands a full-window drag at roughly half a turn.
        renderer.addOrbit((e.clientX - lastX) * 0.00025, (e.clientY - lastY) * 0.00025)
        lastX = e.clientX
        lastY = e.clientY
      }
    }
    const onPointerDown = (e: PointerEvent) => {
      dragging = true
      lastX = e.clientX
      lastY = e.clientY
      canvas.setPointerCapture(e.pointerId)
    }
    const onPointerUp = (e: PointerEvent) => {
      dragging = false
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId)
    }
    const onPointerLeave = () => renderer.setPointer(null, null)
    const onClick = () => {
      if (configRef.current.clickToMorph) renderer.toggleMorph()
    }

    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)
    canvas.addEventListener('pointerleave', onPointerLeave)
    canvas.addEventListener('click', onClick)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      canvas.removeEventListener('pointerleave', onPointerLeave)
      canvas.removeEventListener('click', onClick)
      renderer.dispose()
      rendererRef.current = null
    }
    // The renderer is created once; config updates flow through the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none', ...style }}
    />
  )
}

export default Blob
