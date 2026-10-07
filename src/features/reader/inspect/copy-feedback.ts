import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Clipboard feedback state machine (ui-spec §8.2/EDGE-09, §16.2): a success
 * shows briefly and reverts after `durationMs`; a failure stays visible until
 * the next attempt. Encapsulating the timer keeps block components free of
 * ref plumbing and makes the timing testable with fake timers.
 */

export type CopyFeedbackStatus = 'copied' | 'failed' | null

export interface CopyFeedback {
  status: CopyFeedbackStatus
  report(ok: boolean): void
}

export function useCopyFeedback(durationMs = 1500): CopyFeedback {
  const [status, setStatus] = useState<CopyFeedbackStatus>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    }
  }, [])

  const report = useCallback(
    (ok: boolean) => {
      if (!ok) {
        setStatus('failed')
        return
      }
      setStatus('copied')
      if (timerRef.current !== null) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setStatus(null), durationMs)
    },
    [durationMs],
  )

  return { status, report }
}
