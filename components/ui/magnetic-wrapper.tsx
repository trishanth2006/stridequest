'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * MagneticWrapper — gently pulls its children toward the cursor
 * when hovered, creating a premium "magnetic" interaction.
 *
 * Only activates on devices with a fine pointer (mouse). Touch
 * devices see zero magnetic behavior to avoid awkward UX.
 *
 * @param strength — max pixel displacement (default 8)
 */
export function MagneticWrapper({
  children,
  strength = 8,
  className,
}: {
  children: ReactNode
  strength?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [hasFinePointer, setHasFinePointer] = useState(false)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const isHovered = useRef(false)

  // Detect fine pointer (mouse) at mount time + listen for changes
  useEffect(() => {
    const mql = window.matchMedia('(pointer: fine)')
    setHasFinePointer(mql.matches)

    const handler = (e: MediaQueryListEvent) => setHasFinePointer(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!hasFinePointer || !ref.current) return

      const rect = ref.current.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2

      // Normalized distance from center (–1 to 1)
      const dx = (e.clientX - centerX) / (rect.width / 2)
      const dy = (e.clientY - centerY) / (rect.height / 2)

      setOffset({
        x: dx * strength,
        y: dy * strength,
      })
    },
    [hasFinePointer, strength],
  )

  const handlePointerEnter = useCallback(() => {
    isHovered.current = true
  }, [])

  const handlePointerLeave = useCallback(() => {
    isHovered.current = false
    setOffset({ x: 0, y: 0 })
  }, [])

  return (
    <div
      ref={ref}
      className={className}
      onPointerMove={handlePointerMove}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      style={{
        transform: `translate(${offset.x}px, ${offset.y}px)`,
        transition: isHovered.current
          ? 'transform 150ms cubic-bezier(0.25, 0.46, 0.45, 0.94)'
          : 'transform 400ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        willChange: 'transform',
      }}
    >
      {children}
    </div>
  )
}
