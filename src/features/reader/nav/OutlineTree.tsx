import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'

import { t } from '../../../app/i18n'
import type { OutlineEntry } from '../../../document/types'
import { Icon } from '../../../components/Icon'
import {
  readOutlineMemory,
  readOutlineScroll,
  rememberOutlineExpansion,
  rememberOutlineScroll,
} from './nav-memory'
import {
  buildOutlineTree,
  collapsedAncestor,
  defaultExpandedAnchors,
  flattenOutline,
} from './outline-model'

/**
 * Document outline (ui-spec §3.3; T-41, R14).
 *
 * - Hierarchy comes from the pipeline outline; duplicate titles are numbered
 *   so two “接口” headings stay distinguishable.
 * - The current section highlight follows the document scroll
 *   (`currentAnchorId` from `useOutlineTracking`) and never moves focus or
 *   expands a node the user collapsed; a collapsed branch only gets the
 *   `data-current-subtree` marker.
 * - Activation records the source anchor (captured before the jump) so the
 *   navigation history (wp-25) can consume it.
 * - Expansion and scroll are remembered per document (the host keys this
 *   component by docId, so a tab switch starts from that document's memory).
 */

export interface OutlineTreeProps {
  docId: string
  outline: readonly OutlineEntry[]
  currentAnchorId: string | null
  onNavigate(entry: OutlineEntry, fromAnchorId: string | null): void
}

export function OutlineTree({ docId, outline, currentAnchorId, onNavigate }: OutlineTreeProps) {
  const roots = useMemo(() => buildOutlineTree(outline), [outline])
  const [userExpanded, setUserExpanded] = useState<Set<string> | null>(() => {
    const memory = readOutlineMemory(docId)
    return memory.touched ? new Set(memory.expanded) : null
  })
  // Until the user acts, every parent is expanded; a collapsed choice sticks.
  const expanded = useMemo(
    () => userExpanded ?? defaultExpandedAnchors(roots),
    [userExpanded, roots],
  )
  const [focusedAnchorId, setFocusedAnchorId] = useState<string | null>(null)
  const itemRefs = useRef(new Map<string, HTMLElement>())
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = scrollRef.current
    if (element) element.scrollTop = readOutlineScroll(docId)
    return () => {
      if (element) rememberOutlineScroll(docId, element.scrollTop)
    }
  }, [docId])

  const visible = useMemo(() => flattenOutline(roots, expanded), [roots, expanded])
  const collapsedMarker =
    currentAnchorId !== null ? collapsedAncestor(roots, currentAnchorId, expanded) : null

  const activeIndex = Math.max(
    0,
    visible.findIndex((item) => item.node.entry.anchorId === focusedAnchorId),
  )

  const focusIndex = (index: number) => {
    const target = visible[index]
    if (!target) return
    setFocusedAnchorId(target.node.entry.anchorId)
    itemRefs.current.get(target.node.entry.anchorId)?.focus()
  }

  const setExpansion = (anchorId: string, isExpanded: boolean) => {
    const next = new Set(expanded)
    if (isExpanded) next.add(anchorId)
    else next.delete(anchorId)
    setUserExpanded(next)
    rememberOutlineExpansion(docId, next)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = visible.findIndex((item) => item.node.entry.anchorId === focusedAnchorId)
    const current = index === -1 ? 0 : index
    const item = visible[current]
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        focusIndex(Math.min(current + 1, visible.length - 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        focusIndex(Math.max(current - 1, 0))
        break
      case 'ArrowRight':
        if (!item || item.node.children.length === 0) break
        event.preventDefault()
        if (!expanded.has(item.node.entry.anchorId)) {
          setExpansion(item.node.entry.anchorId, true)
        } else {
          focusIndex(current + 1)
        }
        break
      case 'ArrowLeft':
        if (!item) break
        event.preventDefault()
        if (item.node.children.length > 0 && expanded.has(item.node.entry.anchorId)) {
          setExpansion(item.node.entry.anchorId, false)
        } else if (item.parentAnchorId !== null) {
          focusIndex(visible.findIndex((entry) => entry.node.entry.anchorId === item.parentAnchorId))
        }
        break
      case 'Enter':
        if (item) {
          event.preventDefault()
          onNavigate(item.node.entry, currentAnchorId)
        }
        break
      case 'Home':
        event.preventDefault()
        focusIndex(0)
        break
      case 'End':
        event.preventDefault()
        focusIndex(visible.length - 1)
        break
      default:
        break
    }
  }

  return (
    <div className="ps-outline" ref={scrollRef}>
      <div role="tree" aria-label={t('nav.outline.aria')} onKeyDown={handleKeyDown}>
        {visible.map((item, index) => {
          const { node, depth } = item
          const hasChildren = node.children.length > 0
          const isExpanded = expanded.has(node.entry.anchorId)
          const isCurrent = node.entry.anchorId === currentAnchorId
          return (
            <div
              key={node.entry.anchorId}
              role="treeitem"
              aria-level={depth + 1}
              {...(hasChildren ? { 'aria-expanded': isExpanded } : {})}
              {...(isCurrent ? { 'aria-current': 'true' } : {})}
              {...(collapsedMarker === node.entry.anchorId ? { 'data-current-subtree': 'true' } : {})}
              tabIndex={index === activeIndex ? 0 : -1}
              ref={(element) => {
                if (element) itemRefs.current.set(node.entry.anchorId, element)
                else itemRefs.current.delete(node.entry.anchorId)
              }}
              className={`ps-outline-item${isCurrent ? ' ps-outline-current' : ''}`}
              style={{ paddingLeft: `calc(${depth} * var(--ps-space-4))` }}
              onClick={() => onNavigate(node.entry, currentAnchorId)}
            >
              <span className="ps-outline-row">
                {hasChildren ? (
                  <button
                    type="button"
                    className="ps-outline-toggle"
                    aria-expanded={isExpanded}
                    aria-label={node.label}
                    onClick={(event) => {
                      event.stopPropagation()
                      setExpansion(node.entry.anchorId, !isExpanded)
                    }}
                  >
                    <Icon name={isExpanded ? 'chevronDown' : 'chevronRight'} />
                  </button>
                ) : (
                  <span className="ps-outline-dot" aria-hidden="true" />
                )}
                <span className="ps-outline-label">{node.label}</span>
              </span>
            </div>
          )
        })}
      </div>
      {outline.length === 0 ? (
        <p className="ps-outline-empty">{t('nav.empty.outline')}</p>
      ) : null}
    </div>
  )
}
