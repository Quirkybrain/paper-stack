import { invokeCommand } from './invoke'

import type { SearchSourceRequest, SourceSearchResult } from './types'

/**
 * Source search service (contracts §8, command 38).
 *
 * Only the >50MiB source-window mode goes through Rust; for ≤50MiB both
 * ranges are computed in the frontend from the in-memory snapshot.
 */
export function searchSource(req: SearchSourceRequest): Promise<SourceSearchResult> {
  return invokeCommand<SourceSearchResult>('search_source', { req })
}
