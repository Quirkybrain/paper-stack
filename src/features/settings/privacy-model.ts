import type { StorageCategory, StorageOverview } from '../../services/types'

/**
 * Privacy/clear data model (ui-spec §3.8; IXD §14.1; contracts §3.4).
 *
 * The UI merges `positions` and `session` into one row ("位置与会话") as the
 * spec's display category, but clears and reports them as the two contract
 * categories underneath (per-category results stay honest, INV-WB-06).
 */

export type ClearRowId = 'recents' | 'positionsSession' | 'cache' | 'authorizations' | 'logs'

export interface ClearRow {
  id: ClearRowId
  labelKey: string
  descKeys: string[]
  categories: StorageCategory[]
  count: number
  bytes?: number
}

/** Contract category → display label key (§10 of the string catalog). */
export function categoryLabelKey(category: StorageCategory): string {
  switch (category) {
    case 'recents':
      return 'storage.category.recents'
    case 'positions':
      return 'storage.category.positions'
    case 'session':
      return 'storage.category.session'
    case 'cache':
      return 'storage.category.cache'
    case 'authorizations':
      return 'storage.category.authorizations'
    case 'logs':
      return 'storage.category.logs'
  }
}

function sumBytes(entries: Array<{ bytes?: number }>): number | undefined {
  if (entries.every((entry) => entry.bytes === undefined)) return undefined
  return entries.reduce((total, entry) => total + (entry.bytes ?? 0), 0)
}

export function buildClearRows(overview: StorageOverview | null): ClearRow[] {
  const byCategory = new Map<StorageCategory, { count: number; bytes?: number }>()
  for (const info of overview?.categories ?? []) {
    byCategory.set(info.category, { count: info.count, bytes: info.bytes })
  }
  const get = (category: StorageCategory) => byCategory.get(category) ?? { count: 0 }

  const positions = get('positions')
  const session = get('session')

  return [
    {
      id: 'recents',
      labelKey: 'storage.category.recents',
      descKeys: ['dialog.clear.desc.recents'],
      categories: ['recents'],
      ...get('recents'),
    },
    {
      id: 'positionsSession',
      labelKey: 'storage.category.positionsSession',
      descKeys: ['dialog.clear.desc.positions', 'dialog.clear.desc.session'],
      categories: ['positions', 'session'],
      count: positions.count + session.count,
      ...(() => {
        const bytes = sumBytes([positions, session])
        return bytes === undefined ? {} : { bytes }
      })(),
    },
    {
      id: 'cache',
      labelKey: 'storage.category.cache',
      descKeys: ['dialog.clear.desc.cache'],
      categories: ['cache'],
      ...get('cache'),
    },
    {
      id: 'authorizations',
      labelKey: 'storage.category.authorizations',
      descKeys: ['dialog.clear.desc.authorizations'],
      categories: ['authorizations'],
      ...get('authorizations'),
    },
    {
      id: 'logs',
      labelKey: 'storage.category.logs',
      descKeys: ['dialog.clear.desc.logs'],
      categories: ['logs'],
      ...get('logs'),
    },
  ]
}

/** Contract categories to clear for the selected display rows. */
export function selectedCategories(
  rows: readonly ClearRow[],
  selected: ReadonlySet<ClearRowId>,
): StorageCategory[] {
  return rows.filter((row) => selected.has(row.id)).flatMap((row) => row.categories)
}

/** Categories that are suppressed from write-back after a successful clear (models §9.1). */
export function suppressibleFromCategories(
  categories: readonly StorageCategory[],
): Array<'recents' | 'positions' | 'session'> {
  const suppressible: Array<'recents' | 'positions' | 'session'> = []
  for (const category of categories) {
    if (category === 'recents' || category === 'positions' || category === 'session') {
      suppressible.push(category)
    }
  }
  return suppressible
}
