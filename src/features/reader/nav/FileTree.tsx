import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'

import { t } from '../../../app/i18n'
import { tree, toErrorPayload } from '../../../services'
import type {
  DirectoryListing,
  DirectoryNode,
  DirectoryRoot,
  ErrorPayload,
} from '../../../services/types'
import { Icon } from '../../../components/Icon'
import { navMemory, readRootScroll, rememberRootExpanded, rememberRootScroll } from './nav-memory'
import {
  collectOtherFiles,
  flattenTree,
  isExpandable,
  isSupportedDocument,
  nodeStatusKey,
  type VisibleTreeNode,
} from './tree-model'

/**
 * Lazy file tree (ui-spec §3.3, IXD §5.1; T-40, R02/R25).
 *
 * - `role="tree"` with one roving `tabIndex`; ArrowUp/Down move focus,
 *   ArrowRight expands or enters, ArrowLeft collapses or returns to the
 *   parent, Enter opens. Focus is independent from the currently opened
 *   document (`aria-selected`).
 * - Each expand loads exactly that one directory (`read_directory`) once; a
 *   failed directory keeps the existing tree, shows its reason and offers
 *   retry instead of pretending to be empty.
 * - Only Markdown documents (and directories) are primary; other resources
 *   appear under “显示其他文件” and explain that the type is unsupported.
 * - Expansion and scroll are remembered per authorized root.
 */

export interface FileTreeDeps {
  readDirectory?: typeof tree.readDirectory
}

export interface FileTreeProps {
  root: DirectoryRoot
  /** Canonical path of the currently open document, for selection state. */
  selectedPath: string | null
  onOpenFile(path: string): void
  deps?: FileTreeDeps
}

type DirectoryState =
  | { status: 'loading' }
  | { status: 'ready'; listing: DirectoryListing }
  | { status: 'error'; error: ErrorPayload }

export function FileTree({ root, selectedPath, onOpenFile, deps }: FileTreeProps) {
  const readDirectory = deps?.readDirectory ?? tree.readDirectory
  const [listings, setListings] = useState<Map<string, DirectoryState>>(new Map())
  const requestedRef = useRef(new Set<string>())
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(navMemory.root(root.rootId).expanded),
  )
  const [focusedPath, setFocusedPath] = useState<string | null>(null)
  const [showOthers, setShowOthers] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const itemRefs = useRef(new Map<string, HTMLElement>())
  const scrollRef = useRef<HTMLDivElement>(null)

  const loadDirectory = useCallback(
    (dirPath: string) => {
      if (requestedRef.current.has(dirPath)) return
      requestedRef.current.add(dirPath)
      setListings((previous) => new Map(previous).set(dirPath, { status: 'loading' }))
      readDirectory({ rootId: root.rootId, dirPath })
        .then((listing) => {
          setListings((previous) => new Map(previous).set(dirPath, { status: 'ready', listing }))
        })
        .catch((error: unknown) => {
          setListings((previous) =>
            new Map(previous).set(dirPath, { status: 'error', error: toErrorPayload(error) }),
          )
        })
    },
    [readDirectory, root.rootId],
  )

  const retry = useCallback(
    (dirPath: string) => {
      requestedRef.current.delete(dirPath)
      loadDirectory(dirPath)
    },
    [loadDirectory],
  )

  // Initial root listing (once per root; the component is keyed by rootId),
  // plus reloading for directories expanded by the restored memory.
  useEffect(() => {
    if (!requestedRef.current.has(root.canonicalPath)) loadDirectory(root.canonicalPath)
    for (const path of expanded) loadDirectory(path)
  }, [loadDirectory, root.canonicalPath, expanded])

  // Root scroll memory: restore on mount, save on unmount.
  useEffect(() => {
    const element = scrollRef.current
    if (element) element.scrollTop = readRootScroll(root.rootId)
    return () => {
      if (element) rememberRootScroll(root.rootId, element.scrollTop)
    }
  }, [root.rootId])

  const listingMap = useMemo(() => {
    const map = new Map<string, DirectoryListing>()
    for (const [path, state] of listings) {
      if (state.status === 'ready') map.set(path, state.listing)
    }
    return map
  }, [listings])

  const visibleNodes = useMemo(
    () => flattenTree(root.canonicalPath, listingMap, expanded),
    [root.canonicalPath, listingMap, expanded],
  )

  const otherFiles = useMemo(
    () => collectOtherFiles(root.canonicalPath, listingMap),
    [root.canonicalPath, listingMap],
  )

  const activeIndex = Math.max(
    0,
    visibleNodes.findIndex((item) => item.node.path === focusedPath),
  )

  const focusIndex = (index: number) => {
    const target = visibleNodes[index]
    if (!target) return
    setFocusedPath(target.node.path)
    itemRefs.current.get(target.node.path)?.focus()
  }

  const toggleExpand = (node: DirectoryNode) => {
    const next = new Set(expanded)
    if (next.has(node.path)) {
      next.delete(node.path)
    } else {
      next.add(node.path)
      loadDirectory(node.path)
    }
    setExpanded(next)
    rememberRootExpanded(root.rootId, next)
  }

  const activate = (node: DirectoryNode) => {
    const statusKey = nodeStatusKey(node)
    if (statusKey !== null) {
      setNotice(t(statusKey))
      return
    }
    if (isExpandable(node)) {
      setNotice(null)
      toggleExpand(node)
      return
    }
    if (isSupportedDocument(node)) {
      setNotice(null)
      onOpenFile(node.path)
      return
    }
    setNotice(t('nav.unsupported'))
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = visibleNodes.findIndex((item) => item.node.path === focusedPath)
    const current = index === -1 ? 0 : index
    const item = visibleNodes[current]
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        focusIndex(Math.min(current + 1, visibleNodes.length - 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        focusIndex(Math.max(current - 1, 0))
        break
      case 'ArrowRight':
        if (!item || !isExpandable(item.node)) break
        event.preventDefault()
        if (!expanded.has(item.node.path)) toggleExpand(item.node)
        else focusIndex(current + 1)
        break
      case 'ArrowLeft': {
        if (!item) break
        event.preventDefault()
        if (isExpandable(item.node) && expanded.has(item.node.path)) {
          toggleExpand(item.node)
          break
        }
        for (let candidate = current - 1; candidate >= 0; candidate -= 1) {
          if (visibleNodes[candidate].depth === item.depth - 1) {
            focusIndex(candidate)
            break
          }
        }
        break
      }
      case 'Enter':
        if (item) {
          event.preventDefault()
          activate(item.node)
        }
        break
      case 'Home':
        event.preventDefault()
        focusIndex(0)
        break
      case 'End':
        event.preventDefault()
        focusIndex(visibleNodes.length - 1)
        break
      default:
        break
    }
  }

  const renderNode = (item: VisibleTreeNode, index: number) => {
    const { node, depth } = item
    const expandable = isExpandable(node)
    const isExpanded = expandable && expanded.has(node.path)
    const statusKey = nodeStatusKey(node)
    const state = isExpanded ? listings.get(node.path) : undefined
    return (
      <div
        key={node.path}
        role="treeitem"
        aria-level={depth + 1}
        {...(expandable ? { 'aria-expanded': isExpanded } : {})}
        {...(node.path === selectedPath ? { 'aria-selected': true } : {})}
        tabIndex={index === activeIndex ? 0 : -1}
        ref={(element) => {
          if (element) itemRefs.current.set(node.path, element)
          else itemRefs.current.delete(node.path)
        }}
        className={`ps-tree-item${node.path === selectedPath ? ' ps-tree-item-selected' : ''}`}
        style={{ paddingLeft: `calc(${depth} * var(--ps-space-4))` }}
        onClick={() => activate(node)}
      >
        <span className="ps-tree-row">
          {expandable ? (
            <Icon name={isExpanded ? 'chevronDown' : 'chevronRight'} />
          ) : (
            <Icon name={statusKey !== null ? 'warn' : 'fileText'} />
          )}
          <span className="ps-tree-name">{node.name}</span>
          {statusKey !== null ? <span className="ps-tree-status">{t(statusKey)}</span> : null}
        </span>
        {state?.status === 'loading' ? (
          <span className="ps-tree-note" role="status">
            {t('nav.loading')}
          </span>
        ) : null}
        {state?.status === 'error' ? (
          <span className="ps-tree-note" role="alert">
            {t(state.error.messageKey)}
            <button
              type="button"
              className="ps-tree-retry"
              onClick={(event) => {
                event.stopPropagation()
                retry(node.path)
              }}
            >
              {t('nav.retry')}
            </button>
          </span>
        ) : null}
        {state?.status === 'ready' && state.listing.entries.length === 0 ? (
          <span className="ps-tree-note">{t('nav.empty.directory')}</span>
        ) : null}
        {state?.status === 'ready' && state.listing.truncated ? (
          <span className="ps-tree-note">{t('nav.node.truncated')}</span>
        ) : null}
      </div>
    )
  }

  return (
    <div className="ps-tree" ref={scrollRef}>
      <div role="tree" aria-label={t('nav.fileTree.aria')} onKeyDown={handleKeyDown}>
        {visibleNodes.map(renderNode)}
      </div>
      {notice !== null ? (
        <p className="ps-tree-notice" role="status">
          {notice}
        </p>
      ) : null}
      {otherFiles.length > 0 ? (
        <div className="ps-tree-others">
          <button
            type="button"
            className="ps-tree-others-toggle"
            aria-expanded={showOthers}
            onClick={() => setShowOthers((current) => !current)}
          >
            {t('nav.showOtherFiles')}
          </button>
          {showOthers ? (
            <ul className="ps-tree-others-list" aria-label={t('nav.showOtherFiles')}>
              {otherFiles.map((file) => (
                <li key={file.path}>
                  <button type="button" onClick={() => setNotice(t('nav.unsupported'))}>
                    <Icon name="fileText" />
                    <span>{file.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
