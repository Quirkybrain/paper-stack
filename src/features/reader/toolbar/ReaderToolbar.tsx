import { useRef, useState } from 'react'

import { t } from '../../../app/i18n'
import { Button } from '../../../components/Button'
import { Icon } from '../../../components/Icon'
import { IconButton } from '../../../components/IconButton'
import { Menu } from '../../../components/Menu'
import { Popover } from '../../../components/Popover'
import { StatusBadge } from '../../../components/StatusBadge'
import { Toolbar } from '../../../components/Toolbar'
import type { DocumentDiagnostic } from '../../../document/types'
import type { VersionInfo } from '../../../services/types'
import { TypographyPopover } from '../../settings/TypographyPopover'
import { DocumentInfoPanel } from '../info/DocumentInfoPanel'
import type { ReaderViewMode } from '../reader-state'

/**
 * Reader toolbar (ui-spec §3.2; §6.4 for disabled reasons).
 *
 * Open file/directory, navigation toggle (Ctrl+B) and the view switch
 * (view source / back to reading) are wired; history, find and the wp-25
 * search are wired too. The Aa button hosts the display popover (UI06) and
 * the more menu carries the update-behavior entry (B-05), the full settings
 * dialog and the about entry. The filename is a button that expands the
 * document-info layer (UI01; B-04): encoding, full path, content version and
 * resource issues. Nothing here fakes a success state.
 */

export interface ReaderToolbarProps {
  hasDocument: boolean
  displayName?: string
  canonicalPath?: string
  /** Displayed document identity for the info layer (B-04). */
  docId?: string
  docVersion?: VersionInfo | null
  /** Resource-category diagnostics of the displayed version. */
  resourceIssues?: readonly DocumentDiagnostic[]
  hasPendingUpdate: boolean
  /** D5 large-document mode label (simplified / source window), VC-18. */
  modeBadge?: 'simplified' | 'sourceOnly' | null
  viewMode: ReaderViewMode
  /** True when the outline or a directory tree can be shown. */
  navAvailable: boolean
  navOpen: boolean
  canGoBack: boolean
  canGoForward: boolean
  searchAvailable: boolean
  searchOpen: boolean
  onOpenFile(): void
  onOpenDirectory(): void
  onOpenSettings(): void
  /** B-05: more-menu “更新行为” opens the settings file/update category. */
  onOpenUpdateBehavior(): void
  onOpenAbout(): void
  onCloseDocument(): void
  onToggleNav(): void
  onToggleSource(): void
  onBack(): void
  onForward(): void
  onToggleSearch(): void
}

const EMPTY_RESOURCE_ISSUES: readonly DocumentDiagnostic[] = []

export function ReaderToolbar({
  hasDocument,
  displayName,
  canonicalPath,
  docId,
  docVersion,
  resourceIssues = EMPTY_RESOURCE_ISSUES,
  hasPendingUpdate,
  modeBadge = null,
  viewMode,
  navAvailable,
  navOpen,
  canGoBack,
  canGoForward,
  searchAvailable,
  searchOpen,
  onOpenFile,
  onOpenDirectory,
  onOpenSettings,
  onOpenUpdateBehavior,
  onOpenAbout,
  onCloseDocument,
  onToggleNav,
  onToggleSource,
  onBack,
  onForward,
  onToggleSearch,
}: ReaderToolbarProps) {
  const openAnchor = useRef<HTMLSpanElement>(null)
  const moreAnchor = useRef<HTMLSpanElement>(null)
  const typographyAnchor = useRef<HTMLSpanElement>(null)
  const infoAnchor = useRef<HTMLSpanElement>(null)
  const [openMenu, setOpenMenu] = useState<'open' | 'more' | null>(null)
  const [typographyOpen, setTypographyOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)

  const closeInfo = () => setInfoOpen(false)
  /** Explicit close (button/Esc path): return focus to the trigger. */
  const closeInfoReturnFocus = () => {
    setInfoOpen(false)
    infoAnchor.current?.querySelector('button')?.focus()
  }

  return (
    <Toolbar className="ps-reader-toolbar">
      <span ref={openAnchor} className="ps-toolbar-anchor">
        <Button
          variant="secondary"
          aria-haspopup="menu"
          aria-expanded={openMenu === 'open'}
          onClick={() => setOpenMenu(openMenu === 'open' ? null : 'open')}
        >
          <Icon name="open" />
          <span>{t('toolbar.open')}</span>
          <Icon name="chevronDown" size="14px" />
        </Button>
      </span>
      {openMenu === 'open' ? (
        <Menu
          label={t('toolbar.open')}
          anchor={openAnchor}
          onClose={() => setOpenMenu(null)}
          items={[
            {
              id: 'open-file',
              label: t('toolbar.open.file'),
              icon: 'fileText',
              onSelect: () => {
                setOpenMenu(null)
                onOpenFile()
              },
            },
            {
              id: 'open-directory',
              label: t('toolbar.open.directory'),
              icon: 'folder',
              onSelect: () => {
                setOpenMenu(null)
                onOpenDirectory()
              },
            },
          ]}
        />
      ) : null}

      <IconButton
        icon="arrowLeft"
        label={t('toolbar.back')}
        onClick={onBack}
        disabled={!canGoBack}
        {...(!canGoBack ? { disabledReason: t('toolbar.disabled.noBack') } : {})}
      />
      <IconButton
        icon="arrowRight"
        label={t('toolbar.forward')}
        onClick={onForward}
        disabled={!canGoForward}
        {...(!canGoForward ? { disabledReason: t('toolbar.disabled.noForward') } : {})}
      />

      <span ref={infoAnchor} className="ps-toolbar-anchor">
        <Button
          variant="secondary"
          className="ps-toolbar-filename"
          title={canonicalPath ?? undefined}
          aria-haspopup="dialog"
          aria-expanded={infoOpen}
          disabled={!hasDocument}
          {...(!hasDocument ? { disabledReason: t('document.info.disabled') } : {})}
          onClick={() => setInfoOpen((open) => !open)}
        >
          {displayName ?? ''}
        </Button>
      </span>
      {infoOpen && hasDocument && docId !== undefined ? (
        <Popover
          anchor={infoAnchor}
          label={t('document.info.title')}
          width={360}
          className="ps-document-info-popover"
          onClose={closeInfo}
        >
          <DocumentInfoPanel
            docId={docId}
            canonicalPath={canonicalPath ?? ''}
            version={docVersion ?? null}
            issues={resourceIssues}
            onClose={closeInfoReturnFocus}
          />
        </Popover>
      ) : null}
      {hasPendingUpdate ? <StatusBadge kind="newVersion" /> : null}
      {modeBadge === 'simplified' ? <StatusBadge kind="simplified" /> : null}
      {modeBadge === 'sourceOnly' ? <StatusBadge kind="sourceOnly" /> : null}

      <span className="ps-toolbar-spacer" />

      <IconButton
        icon="folder"
        label={navOpen ? t('toolbar.navToggle.hide') : t('toolbar.navToggle.show')}
        onClick={onToggleNav}
        disabled={!navAvailable}
        disabledReason={t('common.unavailable')}
      />
      <IconButton
        icon="search"
        label={t('toolbar.find')}
        onClick={onToggleSearch}
        aria-pressed={searchOpen}
        disabled={!searchAvailable}
        {...(!searchAvailable
          ? {
              disabledReason: hasDocument
                ? t('common.unavailable')
                : t('toolbar.disabled.noDocument'),
            }
          : {})}
      />
      <span ref={typographyAnchor} className="ps-toolbar-anchor">
        <Button
          variant="secondary"
          aria-haspopup="dialog"
          aria-expanded={typographyOpen}
          aria-label={t('toolbar.typography.aria')}
          title={t('toolbar.typography')}
          onClick={() => setTypographyOpen((open) => !open)}
          style={{ padding: '0 var(--ps-space-2)', fontWeight: 600 }}
        >
          Aa
        </Button>
      </span>
      {typographyOpen ? (
        <TypographyPopover anchor={typographyAnchor} onClose={() => setTypographyOpen(false)} />
      ) : null}
      <span ref={moreAnchor} className="ps-toolbar-anchor">
        <IconButton
          icon="more"
          label={t('toolbar.more')}
          aria-haspopup="menu"
          aria-expanded={openMenu === 'more'}
          onClick={() => setOpenMenu(openMenu === 'more' ? null : 'more')}
        />
      </span>
      {openMenu === 'more' ? (
        <Menu
          label={t('toolbar.more.aria')}
          anchor={moreAnchor}
          onClose={() => setOpenMenu(null)}
          items={[
            {
              id: 'toggle-source',
              label: viewMode === 'source' ? t('menu.backToReading') : t('menu.viewSource'),
              icon: 'fileText',
              disabled: !hasDocument,
              ...(hasDocument ? {} : { disabledReason: t('common.unavailable') }),
              onSelect: () => {
                setOpenMenu(null)
                onToggleSource()
              },
            },
            {
              id: 'update-behavior',
              label: t('menu.updateBehavior'),
              icon: 'refresh',
              onSelect: () => {
                setOpenMenu(null)
                onOpenUpdateBehavior()
              },
            },
            {
              id: 'close-document',
              label: t('menu.closeDocument'),
              icon: 'close',
              disabled: !hasDocument,
              ...(hasDocument ? {} : { disabledReason: t('common.unavailable') }),
              onSelect: () => {
                setOpenMenu(null)
                onCloseDocument()
              },
            },
            {
              id: 'open-settings',
              label: t('menu.settings'),
              icon: 'settings',
              onSelect: () => {
                setOpenMenu(null)
                onOpenSettings()
              },
            },
            {
              id: 'open-about',
              label: t('menu.about'),
              icon: 'info',
              onSelect: () => {
                setOpenMenu(null)
                onOpenAbout()
              },
            },
          ]}
        />
      ) : null}
    </Toolbar>
  )
}
