import { installParseWorker, type WorkerScopeLike } from './protocol'

/**
 * Dedicated parse worker entry (rendering-pipeline §6; ADR-002 §5).
 * Stages ①–⑩ run here; results are structured-cloned to the main thread.
 * The engine registry is shared with the main-thread fallback through
 * `../pipeline` → `../plugins/register`.
 */
installParseWorker(self as unknown as WorkerScopeLike)
