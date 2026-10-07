import { useRef, useState } from 'react'

import { t } from '../../../app/i18n'
import { Button } from '../../../components/Button'
import { Icon } from '../../../components/Icon'
import { IconButton } from '../../../components/IconButton'
import { Menu } from '../../../components/Menu'
import { StatusBadge } from '../../../components/StatusBadge'
import { Toolbar } from '../../../components/Toolbar'
import type { ReaderViewMode } from '../reader-state'

/**
 * Reader toolbar (ui-spec §3.2; §6.4 for disabled reasons).
 *
 * Open file/directory, navigation toggle (Ctrl+B) and the view switch
 * (view source / back to reading) are wired; history, find, typography and
 * settings stay present but disabled with an explicit reason until their
 * features land (wp-25/27/29). Nothing here fakes a success state.
 */

export interface ReaderToolbarProps {
  hasDocument: boolean
  displayName?: string
  canonicalPath?: string
  hasPendingUpdate: boolean
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
  viewMode,
  navAvailable,
  navOpen,
  canGoBack,
  canGoForward,
  searchAvailable,
  searchOpen,
  onOpenFile,
  onOpenDirectory,
  onCloseDocument,
  onToggleNav,
  onToggleSource,
  onBack,
  onForward,
  onToggleSearch,
}: ReaderToolbarProps) {
  const openAnchor = useRef<HTMLSpanElement>(null)
  const moreAnchor = useRef<HTMLSpanElement>(null)
  const [openMenu, setOpenMenu] = useState<'open' | 'more' | null>(null)

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
      <Button
        variant="secondary"
        disabled
        disabledReason={t('common.unavailable')}
        aria-label={t('toolbar.typography.aria')}
        title={t('toolbar.typography')}
        style={{ padding: '0 var(--ps-space-2)', fontWeight: 600 }}
      >
        Aa
      </Button>
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
          ]}
        />
      ) : null}
    </Toolbar>
  )
}
