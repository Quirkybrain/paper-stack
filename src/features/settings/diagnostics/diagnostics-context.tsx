import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import {
  mergeDiagnosticEntry,
  type DiagnosticEntry,
  type DiagnosticEntryInput,
} from './diagnostics-model'

/**
 * In-memory diagnostics collector (ui-spec §3.8 UI07; IXD §15.2).
 *
 * Error surfaces across the reader record their contract `ErrorPayload` here;
 * the diagnostics panel renders them reason-first. Nothing is persisted and
 * nothing is uploaded: the panel's export/copy actions are the only exits.
 */

export interface DiagnosticsContextValue {
  entries: DiagnosticEntry[]
  record(input: DiagnosticEntryInput): void
  recordMany(inputs: readonly DiagnosticEntryInput[]): void
  dismiss(entryId: string): void
  clear(): void
}

const DiagnosticsContext = createContext<DiagnosticsContextValue | null>(null)

export interface DiagnosticsProviderProps {
  children: ReactNode
  /** Injectable clock; defaults to `Date.now`. */
  now?: () => number
}

export function DiagnosticsProvider({ children, now }: DiagnosticsProviderProps) {
  const [entries, setEntries] = useState<DiagnosticEntry[]>([])
  const nowRef = useRef(now)
  useEffect(() => {
    nowRef.current = now
  })

  const recordMany = useCallback((inputs: readonly DiagnosticEntryInput[]) => {
    if (inputs.length === 0) return
    setEntries((previous) => {
      let next = previous
      for (const input of inputs) {
        next = mergeDiagnosticEntry(next, input, nowRef.current?.() ?? Date.now())
      }
      return next
    })
  }, [])

  const record = useCallback((input: DiagnosticEntryInput) => recordMany([input]), [recordMany])

  const dismiss = useCallback((entryId: string) => {
    setEntries((previous) => previous.filter((entry) => entry.id !== entryId))
  }, [])

  const clear = useCallback(() => setEntries([]), [])

  const value = useMemo<DiagnosticsContextValue>(
    () => ({ entries, record, recordMany, dismiss, clear }),
    [entries, record, recordMany, dismiss, clear],
  )

  return <DiagnosticsContext.Provider value={value}>{children}</DiagnosticsContext.Provider>
}

export function useDiagnostics(): DiagnosticsContextValue {
  const value = useContext(DiagnosticsContext)
  if (value === null) {
    throw new Error('useDiagnostics must be used inside DiagnosticsProvider')
  }
  return value
}
