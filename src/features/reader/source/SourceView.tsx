import { useEffect, useMemo, useRef, useState, type UIEvent } from 'react'

import { t } from '../../../app/i18n'
import { Button } from '../../../components/Button'
import { files, toErrorPayload } from '../../../services'
import type {
  ErrorPayload,
  SourceInfo,
  SourceRange,
  SourceWindow,
  VersionInfo,
} from '../../../services/types'
import { byteOffsetForLine, countLines, lineForByteOffset } from './mapping'

/**
 * Read-only source view (ui-spec §3.5, IX05; T-45, R18/R29).
 *
 * - The displayed text is always the tab's display version: when it is in
 *   memory (`rawText`), no disk command runs at all — a newer file on disk is
 *   never loaded into this view. Without in-memory text (large documents),
 *   `get_source_info` + `read_source_window` provide a version-checked window;
 *   a hash that differs from the display version is refused, not adopted.
 * - Plain `<pre>` with an `aria-hidden` line-number gutter; no editable
 *   affordance, no save.
 * - `onBack` reports the first visible line so the reader can map back to the
 *   reading position (falling back to the saved anchor with `source.notLocated`
 *   is the reader's decision).
 */

export const SOURCE_LINE_HEIGHT_PX = 14 * 1.65
export const SOURCE_WINDOW_MAX_LINES = 2000

export interface SourceBackInfo {
  line: number
  byteOffset: number | null
}

export interface SourceViewDeps {
  getSourceInfo?: typeof files.getSourceInfo
  readSourceWindow?: typeof files.readSourceWindow
}

export interface SourceViewProps {
  docId: string
  version: VersionInfo
  /** Display-version text; null means the document is only available windowed. */
  rawText: string | null
  initialRange: SourceRange | null
  onBack(info: SourceBackInfo): void
  onPositionChange?(info: SourceBackInfo): void
  deps?: SourceViewDeps
}

type WindowState =
  | { status: 'loading' }
  | { status: 'ready'; info: SourceInfo; window: SourceWindow }
  | { status: 'changed' }
  | { status: 'error'; error: ErrorPayload }

function lineNumbers(from: number, to: number): string {
  const numbers: string[] = []
  for (let line = from; line <= to; line += 1) numbers.push(String(line))
  return numbers.join('\n')
}

export function SourceView({
  docId,
  version,
  rawText,
  initialRange,
  onBack,
  onPositionChange,
  deps,
}: SourceViewProps) {
  const getSourceInfo = deps?.getSourceInfo ?? files.getSourceInfo
  const readSourceWindow = deps?.readSourceWindow ?? files.readSourceWindow
  const [attempt, setAttempt] = useState(0)
  const windowKey = `${docId}\u0000${version.contentHash}\u0000${attempt}`
  const [storedWindow, setStoredWindow] = useState<{ key: string; state: WindowState } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const initialLine = useMemo(
    () =>
      rawText !== null && initialRange !== null
        ? lineForByteOffset(rawText, initialRange.startByte)
        : 1,
    [rawText, initialRange],
  )
  // Derived position: a changed entry mapping wins over any previous scroll.
  const [position, setPosition] = useState<{ base: number; line: number }>({
    base: initialLine,
    line: initialLine,
  })
  const firstLine = position.base === initialLine ? position.line : initialLine

  useEffect(() => {
    if (rawText !== null) return undefined
    let cancelled = false
    void getSourceInfo(docId)
      .then((info) => {
        if (cancelled) return null
        if (info.version.contentHash !== version.contentHash) {
          setStoredWindow({ key: windowKey, state: { status: 'changed' } })
          return null
        }
        return readSourceWindow({ docId, startLine: 1, maxLines: SOURCE_WINDOW_MAX_LINES }).then(
          (window) => {
            if (cancelled) return
            if (window.version.contentHash !== version.contentHash) {
              setStoredWindow({ key: windowKey, state: { status: 'changed' } })
              return
            }
            setStoredWindow({ key: windowKey, state: { status: 'ready', info, window } })
          },
        )
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setStoredWindow({ key: windowKey, state: { status: 'error', error: toErrorPayload(error) } })
        }
      })
    return () => {
      cancelled = true
    }
  }, [docId, version.contentHash, rawText, windowKey, getSourceInfo, readSourceWindow])

  const windowState: WindowState =
    storedWindow !== null && storedWindow.key === windowKey
      ? storedWindow.state
      : { status: 'loading' }
  const windowed = rawText === null
  const readyWindow = windowState.status === 'ready' ? windowState.window : null
  const text = rawText !== null ? rawText : (readyWindow?.text ?? '')
  const startLine = rawText !== null ? 1 : (readyWindow?.startLine ?? 1)
  const totalLines =
    rawText !== null
      ? countLines(rawText)
      : windowState.status === 'ready'
        ? windowState.info.totalLines
        : 0

  // Restore the initial position (entry mapping) once the text is available.
  useEffect(() => {
    const element = scrollRef.current
    if (!element || initialLine <= 1 || rawText === null) return
    element.scrollTop = (initialLine - 1) * SOURCE_LINE_HEIGHT_PX
  }, [initialLine, rawText, text])

  const reportPosition = (line: number) => {
    if (!onPositionChange) return
    onPositionChange({
      line,
      byteOffset: rawText !== null ? byteOffsetForLine(rawText, line) : null,
    })
  }

  useEffect(() => {
    reportPosition(firstLine)
    // Report on mount/text change only; scrolling reports through the handler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstLine, text])

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const scrollTop = event.currentTarget.scrollTop
    const line = Math.min(
      totalLines,
      startLine + Math.max(0, Math.floor(scrollTop / SOURCE_LINE_HEIGHT_PX)),
    )
    setPosition({ base: initialLine, line })
    reportPosition(line)
  }

  const handleBack = () => {
    onBack({
      line: firstLine,
      byteOffset: rawText !== null ? byteOffsetForLine(rawText, firstLine) : null,
    })
  }

  return (
    <div className="ps-source-view" data-source-mode={windowed ? 'window' : 'text'}>
      <header className="ps-source-header">
        <h2>{t('source.title')}</h2>
        {readyWindow !== null ? (
          <span className="ps-source-window" role="status">
            {t('source.window', {
              start: readyWindow.startLine,
              end: readyWindow.endLine,
              total: totalLines,
            })}
          </span>
        ) : null}
        <span className="ps-toolbar-spacer" />
        <Button variant="secondary" onClick={handleBack}>
          {t('source.back')}
        </Button>
      </header>

      {windowed && windowState.status === 'loading' ? (
        <p className="ps-source-notice" role="status">
          {t('source.loading')}
        </p>
      ) : null}

      {windowed && windowState.status === 'changed' ? (
        <div className="ps-source-notice" role="alert">
          <p>{t('error.io.changed')}</p>
          <Button variant="secondary" onClick={() => setAttempt((current) => current + 1)}>
            {t('common.retry')}
          </Button>
        </div>
      ) : null}

      {windowed && windowState.status === 'error' ? (
        <div className="ps-source-notice" role="alert">
          <p>{t(windowState.error.messageKey)}</p>
          <p className="ps-inspect-code">{windowState.error.code}</p>
          <Button variant="secondary" onClick={() => setAttempt((current) => current + 1)}>
            {t('common.retry')}
          </Button>
        </div>
      ) : null}

      {text.length > 0 || rawText !== null ? (
        <div
          className="ps-source-scroll"
          ref={scrollRef}
          data-complete={readyWindow === null ? undefined : String(readyWindow.eof)}
          onScroll={handleScroll}
        >
          <span className="ps-source-lines" aria-hidden="true">
            {lineNumbers(startLine, totalLines)}
          </span>
          <pre className="ps-source-pre" tabIndex={0} spellCheck={false}>
            {text}
          </pre>
        </div>
      ) : null}
    </div>
  )
}
