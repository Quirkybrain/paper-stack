import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'

import { t } from '../../app/i18n'
import { IconButton } from '../../components/IconButton'
import { createSourceOffsetIndex } from '../../document/source-map'
import type { SearchSegment } from '../../document/types'
import {
  hitKey,
  hitSnippet,
  isFormulaHit,
  type BodySearchHit,
} from './search-core'
import type { SearchSessionControls } from './use-search-session'
import './search.css'

/**
 * In-page search bar (ui-spec §3.4 UI03; T-42/T-43; R16/R17).
 *
 * A non-modal `role="search"` strip with scope switch (正文/源码), the query
 * input, case option, current/total counter, previous/next and close. IME
 * composition suspends commits and Enter navigation (EDGE-04); Enter with
 * nothing selected jumps to the first hit, Shift+Enter to the last, then they
 * move next/previous and wrap with the "已回到第一项/最后一项" notice
 * (EDGE-05). Esc closes and leaves the last hit/selection in place; the host
 * returns focus to the body position.
 *
 * Formula-source hits carry the "公式源码匹配" label plus a direct inspect
 * entry (ADR-007 §Decision 7). Result rows are a compact click-to-locate list;
 * the counter always reflects the full match count.
 *
 * The per-tab session lives in the host (`useSearchSession`) so the reader can
 * highlight matches and record navigation history from the same state.
 */

/** Display-only cap for the clickable result list (counters stay complete). */
export const SEARCH_RESULT_DISPLAY_LIMIT = 200

export interface SearchBarProps {
  session: SearchSessionControls
  segments: readonly SearchSegment[]
  rawText: string | null
  onClose(): void
  onFormulaInspect?(hit: BodySearchHit): void
}

export function SearchBar({
  session,
  segments,
  rawText,
  onClose,
  onFormulaInspect,
}: SearchBarProps) {
  const state = session.state
  const [draft, setDraft] = useState(() => state.query)
  const inputRef = useRef<HTMLInputElement>(null)
  const composingRef = useRef(false)

  // One shared offset index for the whole result list (F-32-3): building it
  // only while the panel is open keeps closed-search documents at zero extra
  // cost. `rawText` identity changes with the displayed version.
  const sourceOffsetIndex = useMemo(
    () => (state.open && rawText !== null ? createSourceOffsetIndex(rawText) : null),
    [state.open, rawText],
  )

  // Open (or Ctrl+F again): focus the input and select the existing query.
  useEffect(() => {
    if (!state.open) return
    const input = inputRef.current
    if (!input) return
    input.focus()
    input.select()
  }, [state.open, state.focusRequest])

  const close = () => {
    session.close()
    onClose()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      close()
      return
    }
    if (event.target !== inputRef.current) return
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
      event.preventDefault()
      inputRef.current?.select()
      return
    }
    if (event.key !== 'Enter') return
    if (composingRef.current || event.nativeEvent.isComposing) return
    event.preventDefault()
    if (event.shiftKey) session.prev()
    else session.next()
  }

  if (!state.open) return null

  const total = state.matches.length
  const current = state.current
  const counterVisible = state.status === 'results' || state.status === 'noResults'
  const visibleMatches = state.matches.slice(0, SEARCH_RESULT_DISPLAY_LIMIT)
  const currentHit = total > 0 ? state.matches[current - 1] : undefined
  const formulaCurrent = currentHit !== undefined && isFormulaHit(currentHit)

  return (
    <div className="ps-search" role="search" aria-label={t('search.aria')} onKeyDown={handleKeyDown}>
      <div className="ps-search-controls">
        <span className="ps-search-scope" role="group" aria-label={t('search.aria')}>
          <button
            type="button"
            className="ps-search-scope-option"
            aria-pressed={state.scope === 'body'}
            onClick={() => session.setScope('body')}
          >
            {t('search.scope.body')}
          </button>
          <button
            type="button"
            className="ps-search-scope-option"
            aria-pressed={state.scope === 'source'}
            onClick={() => session.setScope('source')}
          >
            {t('search.scope.source')}
          </button>
        </span>

        <input
          ref={inputRef}
          className="ps-search-input"
          type="search"
          role="searchbox"
          aria-label={t('search.placeholder')}
          placeholder={t('search.placeholder')}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value)
            if (!composingRef.current) session.setQuery(event.target.value)
          }}
          onCompositionStart={() => {
            composingRef.current = true
            session.compositionStart()
          }}
          onCompositionEnd={(event) => {
            composingRef.current = false
            session.compositionEnd()
            setDraft(event.currentTarget.value)
            session.setQuery(event.currentTarget.value)
          }}
        />

        <label className="ps-search-case">
          <input
            type="checkbox"
            checked={state.caseSensitive}
            onChange={(event) => session.setCaseSensitive(event.target.checked)}
          />
          <span>{t('search.caseSensitive')}</span>
        </label>

        {counterVisible ? (
          <span
            className="ps-search-counter"
            role="status"
            aria-label={t('search.counter.aria', { current, total })}
          >
            {t('search.counter', { current, total })}
          </span>
        ) : null}

        <IconButton
          icon="chevronLeft"
          label={t('search.prev')}
          onClick={session.prev}
          disabled={total === 0}
        />
        <IconButton
          icon="chevronRight"
          label={t('search.next')}
          onClick={session.next}
          disabled={total === 0}
        />
        <IconButton icon="close" label={t('search.close')} onClick={close} />
      </div>

      <div className="ps-search-status">
        {state.status === 'indexing' ? (
          <p className="ps-search-note" role="status">
            {t('search.indexing')}
          </p>
        ) : null}
        {state.status === 'noResults' ? (
          <p className="ps-search-note" role="status">
            {t('search.noResults')} · {t('search.noResults.hint')}
          </p>
        ) : null}
        {formulaCurrent ? (
          <p className="ps-search-formula" role="status">
            <span>{t('search.formulaMatch')}</span>
            {onFormulaInspect ? (
              <button
                type="button"
                className="ps-search-formula-inspect"
                onClick={() => onFormulaInspect(currentHit as BodySearchHit)}
              >
                {t('search.formulaMatch.inspect')}
              </button>
            ) : null}
          </p>
        ) : null}
        {state.noticeKey !== null ? (
          <p className="ps-search-note" role="status">
            {t(state.noticeKey)}
          </p>
        ) : null}
      </div>

      {visibleMatches.length > 0 ? (
        <ul className="ps-search-results">
          {visibleMatches.map((hit, index) => {
            const snippet = hitSnippet(hit, {
              segments,
              rawText,
              offsetIndex: sourceOffsetIndex,
            })
            const isCurrent = index === current - 1
            return (
              <li key={hitKey(hit)}>
                <button
                  type="button"
                  className={`ps-search-result${isCurrent ? ' ps-search-result-current' : ''}`}
                  aria-current={isCurrent ? 'true' : undefined}
                  onClick={() => session.activate(index)}
                >
                  {hit.kind === 'source' ? (
                    <span className="ps-search-result-line">{hit.lineNumber}</span>
                  ) : null}
                  <span className="ps-search-result-text">{snippet ?? ''}</span>
                  {isFormulaHit(hit) ? (
                    <span className="ps-search-result-badge">{t('search.formulaMatch')}</span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
