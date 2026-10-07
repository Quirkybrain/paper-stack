import { useEffect, useState } from 'react'

import { t } from '../../../app/i18n'
import { Drawer } from '../../../components/Drawer'
import { IconButton } from '../../../components/IconButton'
import type { OutlineEntry } from '../../../document/types'
import type { DirectoryRoot } from '../../../services/types'
import { FileTree } from './FileTree'
import { OutlineTree } from './OutlineTree'
import { NAV_DEFAULT_WIDTH, navMemory, resolveNavLayout } from './nav-memory'

/**
 * Navigation panel host (ui-spec §3.3, §4; T-41, R20): the “文件 / 大纲” tabs
 * share one spot, only one panel is visible at a time, and the host (not this
 * component) guarantees the mutual exclusion with the inspect drawer via the
 * app store’s single auxiliary slot (EDGE-06).
 *
 * Responsive behavior is resolved from the viewport width (ui-spec §4):
 * >=1180px side by side, 840–1179px overlay, <840px a full-width overlay. The
 * always-present close button and Esc (Drawer) keep exit paths reachable.
 */

export type NavPanelKind = 'files' | 'outline'

export function useViewportWidth(): number {
  const [width, setWidth] = useState(() =>
    typeof window === 'undefined' ? 1440 : window.innerWidth,
  )
  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  return width
}

export interface NavPanelProps {
  panel: NavPanelKind
  root: DirectoryRoot | null
  outline: readonly OutlineEntry[] | null
  docId: string | null
  selectedPath: string | null
  currentAnchorId: string | null
  /** Injectable viewport width for tests; defaults to the window width. */
  viewportWidth?: number
  onSelectPanel(panel: NavPanelKind): void
  onOpenFile(path: string): void
  onOutlineNavigate(entry: OutlineEntry, fromAnchorId: string | null): void
  onClose(): void
}

function panelWidth(layout: 'side' | 'overlay' | 'full', memoryWidth: number): string {
  if (layout === 'side') return `${memoryWidth}px`
  if (layout === 'full') return '100%'
  return '320px'
}

export function NavPanel({
  panel,
  root,
  outline,
  docId,
  selectedPath,
  currentAnchorId,
  viewportWidth,
  onSelectPanel,
  onOpenFile,
  onOutlineNavigate,
  onClose,
}: NavPanelProps) {
  const measuredWidth = useViewportWidth()
  const width = viewportWidth ?? measuredWidth
  const layout = resolveNavLayout(width)
  const memoryWidth = root ? navMemory.root(root.rootId).width : NAV_DEFAULT_WIDTH

  return (
    <Drawer
      side="left"
      width={panelWidth(layout, memoryWidth)}
      label={t('nav.aria')}
      onClose={onClose}
      className={`ps-nav ps-nav-${layout}`}
    >
      <header className="ps-nav-header">
        <div role="tablist" aria-label={t('nav.aria')} className="ps-nav-tabs">
          <button
            type="button"
            role="tab"
            aria-selected={panel === 'files'}
            disabled={root === null}
            title={root === null ? t('common.unavailable') : t('nav.tab.files')}
            className="ps-nav-tab"
            onClick={() => onSelectPanel('files')}
          >
            {t('nav.tab.files')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={panel === 'outline'}
            className="ps-nav-tab"
            onClick={() => onSelectPanel('outline')}
          >
            {t('nav.tab.outline')}
          </button>
        </div>
        <IconButton icon="close" label={t('common.close')} onClick={onClose} />
      </header>
      <div
        className="ps-nav-body"
        role="tabpanel"
        aria-label={panel === 'files' ? t('nav.fileTree.aria') : t('nav.outline.aria')}
        data-nav-layout={layout}
      >
        {panel === 'files' ? (
          root ? (
            <FileTree
              key={root.rootId}
              root={root}
              selectedPath={selectedPath}
              onOpenFile={onOpenFile}
            />
          ) : (
            <p className="ps-nav-empty">{t('nav.empty.directory')}</p>
          )
        ) : outline && outline.length > 0 && docId !== null ? (
          <OutlineTree
            key={docId}
            docId={docId}
            outline={outline}
            currentAnchorId={currentAnchorId}
            onNavigate={onOutlineNavigate}
          />
        ) : (
          <p className="ps-nav-empty">{t('nav.empty.outline')}</p>
        )}
      </div>
    </Drawer>
  )
}
