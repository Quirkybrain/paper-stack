import { useRef, useState } from 'react'

import { t } from '../../../app/i18n'
import { Button } from '../../../components/Button'
import { Icon } from '../../../components/Icon'
import { IconButton } from '../../../components/IconButton'
import { Menu } from '../../../components/Menu'
import { StatusBadge } from '../../../components/StatusBadge'
import { Toolbar } from '../../../components/Toolbar'

/**
 * Reader toolbar (ui-spec §3.2; §6.4 for disabled reasons).
 *
 * wp-19 minimal: open-file and close-document work; history, navigation,
 * find, typography and source/settings/update entries are present but
 * disabled with an explicit reason because their features land in wp-24/25/26/
 * 29. Nothing here fakes a success state.
 */

export interface ReaderToolbarProps {
  hasDocument: boolean
  displayName?: string
  canonicalPath?: string
  hasPendingUpdate: boolean
  onOpenFile(): void
  onCloseDocument(): void
}

export function ReaderToolbar({
  hasDocument,
  displayName,
  canonicalPath,
  hasPendingUpdate,
  onOpenFile,
  onCloseDocument,
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
              disabled: true,
              disabledReason: t('common.unavailable'),
            },
          ]}
        />
      ) : null}

      <IconButton
        icon="arrowLeft"
        label={t('toolbar.back')}
        disabled
        disabledReason={t('toolbar.disabled.noBack')}
      />
      <IconButton
        icon="arrowRight"
        label={t('toolbar.forward')}
        disabled
        disabledReason={t('toolbar.disabled.noForward')}
      />

      <span className="ps-toolbar-filename" title={canonicalPath ?? undefined}>
        {displayName ?? ''}
      </span>
      {hasPendingUpdate ? <StatusBadge kind="newVersion" /> : null}

      <span className="ps-toolbar-spacer" />

      <IconButton
        icon="folder"
        label={t('toolbar.navToggle')}
        disabled
        disabledReason={t('common.unavailable')}
      />
      <IconButton
        icon="search"
        label={t('toolbar.find')}
        disabled
        disabledReason={hasDocument ? t('common.unavailable') : t('toolbar.disabled.noDocument')}
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
