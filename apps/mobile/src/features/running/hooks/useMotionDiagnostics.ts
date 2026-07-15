import { useState, useEffect, useRef } from 'react'
import type { MotionEngine } from '../engine/MotionEngine'
import type { MotionDiagnostics } from '../engine/MotionTypes'

export function useMotionDiagnostics(engine: MotionEngine | null) {
  const [diagnostics, setDiagnostics] = useState<MotionDiagnostics | null>(null)
  const lastUpdateRef = useRef<number>(0)
  const THROTTLE_MS = 500

  useEffect(() => {
    if (!engine) {
      setDiagnostics(null)
      return
    }

    const handleUpdate = (diag: MotionDiagnostics) => {
      const now = Date.now()
      if (now - lastUpdateRef.current >= THROTTLE_MS) {
        setDiagnostics(diag)
        lastUpdateRef.current = now
      }
    }

    // Immediately get the current state if available
    setDiagnostics(engine.getDiagnostics())

    engine.on('diagnosticsUpdated', handleUpdate)

    return () => {
      engine.off('diagnosticsUpdated', handleUpdate)
    }
  }, [engine])

  return diagnostics
}
