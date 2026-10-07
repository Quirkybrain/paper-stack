import { useRef, useState } from 'react'

import { t } from '../../../app/i18n'
import { Button } from '../../../components/Button'
import { Icon } from '../../../components/Icon'
import { IconButton } from '../../../components/IconButton'
import { Menu } from '../../../components/Menu'
import { StatusBadge } from '../../../components/StatusBadge'
import { Toolbar } from '../../../components/Toolbar'
import { TypographyPopover } from '../../settings/TypographyPopover'
import type { ReaderViewMode } from '../reader-state'

/**
 * Reader toolbar (ui-spec §3.2; §6.4 for disabled reasons).
 *
 * Open file/directory, navigation toggle (Ctrl+B) and the view switch
 * (view source / back to reading) are wired; history, find and the wp-25
 * search are wired too. The Aa button hosts the display popover (UI06) and
 * the more menu carries the full settings dialog and about entry; the update
 * flow (wp-29) is still absent until its task lands. Nothing here fakes a
 * success state.
 */

export interface ReaderToolbarProps {
  hasDocument: boolean
  displayName?: string
  canonicalPath?: string
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
  onOpenAbout(): void
  onCloseDocument(): void
  onToggleNav(): void
  onToggleSource(): void
  onBack(): void
  onForward(): void
  onToggleSearch(): void
}

export function ReaderToolbar({
  hasDocument,
  displayName,
  canonicalPath,
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
  const [openMenu, setOpenMenu] = useState<'open' | 'more' | null>(null)
  const [typographyOpen, setTypographyOpen] = useState(false)

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

      <span className="ps-toolbar-filename" title={canonicalPath ?? undefined}>
        {displayName ?? ''}
      </span>
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
