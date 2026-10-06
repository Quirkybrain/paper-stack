import { t } from '../../../app/i18n'
import { Icon } from '../../../components/Icon'
import { StatusBadge } from '../../../components/StatusBadge'

/**
 * Tab row (ui-spec §3.2/§5.3; models §7): 36px, rendered only with ≥2 tabs
 * (INV-TL-08). Names use the shortest distinguishing parent directory when
 * display names collide (INV-TL-03); the full path stays reachable via title.
 * Activation and MRU close order are owned by `reader-state`.
 */

export interface TabBarItem {
  tabId: string
  label: string
  fullPath: string
  hasPendingUpdate: boolean
  isActive: boolean
}

export interface TabBarProps {
  items: readonly TabBarItem[]
  onActivate(tabId: string): void
  onClose(tabId: string): void
}

export function TabBar({ items, onActivate, onClose }: TabBarProps) {
  if (items.length < 2) return null
  return (
    <div className="ps-tabbar" role="tablist" aria-label={t('aria.tabs')}>
      <div className="ps-tabbar-scroll">
        {items.map((item) => (
          <div
            key={item.tabId}
            className={`ps-tab${item.isActive ? ' ps-tab-active' : ''}`}
            role="presentation"
          >
            <button
              type="button"
              role="tab"
              aria-selected={item.isActive}
              tabIndex={item.isActive ? 0 : -1}
              className="ps-tab-label"
              title={item.fullPath}
              onClick={() => onActivate(item.tabId)}
            >
              <span className="ps-tab-name">{item.label}</span>
              {item.hasPendingUpdate ? <StatusBadge kind="newVersion" /> : null}
            </button>
            <button
              type="button"
              className="ps-tab-close"
              aria-label={t('tabs.close.aria', { name: item.label })}
              title={t('tooltip.tab.close', { name: item.label })}
              onClick={() => onClose(item.tabId)}
            >
              <Icon name="close" size="14px" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
