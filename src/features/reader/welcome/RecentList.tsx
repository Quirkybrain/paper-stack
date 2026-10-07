import { t } from '../../../app/i18n'
import { Button } from '../../../components/Button'
import { StatusBadge } from '../../../components/StatusBadge'
import type { RecentEntry } from '../../../services/types'
import { RECENT_FIRST_SCREEN, formatRelativeTime, shortestDistinguishingParents } from './format'

/**
 * Recent documents list (ui-spec §3.1, IXD §4.1; T-39).
 *
 * The first screen shows at most 6 rows and the rest scrolls; every row is a
 * keyboard-reachable open action, unavailable files keep their name and offer
 * the relink entry instead of being silently dropped, and “移除” only removes
 * the list entry (it never touches the source file).
 */

export interface RecentListProps {
  entries: readonly RecentEntry[]
  onOpen(entry: RecentEntry): void
  onRelink(entry: RecentEntry): void
  onRemove(docId: string): void
  /** Injectable clock for deterministic relative times. */
  now?: number
}

export function RecentList({ entries, onOpen, onRelink, onRemove, now }: RecentListProps) {
  const parents = shortestDistinguishingParents(entries)
  return (
    <div className="ps-recent-scroll" data-first-screen={RECENT_FIRST_SCREEN}>
      <ul className="ps-recent-list" aria-label={t('aria.recentList')}>
        {entries.map((entry) => {
          const relative = formatRelativeTime(entry.openedAtMs, now)
          const parent = parents.get(entry.docId) ?? ''
          return (
            <li key={entry.docId} className="ps-recent-item">
              <button
                type="button"
                className="ps-recent-open"
                onClick={() => (entry.available ? onOpen(entry) : onRelink(entry))}
              >
                <span className="ps-recent-name">{entry.displayName}</span>
                {!entry.available ? <StatusBadge kind="unavailable" /> : null}
                {parent !== '' ? <span className="ps-recent-parent">{parent}</span> : null}
                <span className="ps-recent-time">{t(relative.key, relative.params)}</span>
              </button>
              <Button
                variant="secondary"
                aria-label={t('welcome.recent.removeAria', { name: entry.displayName })}
                title={t('tooltip.recent.remove')}
                onClick={() => onRemove(entry.docId)}
              >
                {t('welcome.recent.remove')}
              </Button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
