import type { Root } from 'hast'

import type {
  DocumentDiagnostic,
  ResolvedPipelineOptions,
  SourceRangeBytes,
  SourceRangeUtf16,
} from './types'

/**
 * Engine slot registry (rendering-pipeline §1 steps ⑧⑨⑩; ADR-002 §2).
 *
 * The three slots run after `rehype-sanitize` and before `rehype-react` in the
 * fixed order math → code → mermaid. Engine output is trusted and is never
 * re-sanitized or parsed from document text again. wp-17/wp-18 ship the empty
 * registry; wp-19 registers KaTeX, Shiki and the Mermaid placeholder through
 * `plugins/register.ts`, which the pipeline imports for its side effects so
 * worker and main-thread fallback share one registry instance.
 */

export type EngineSlotName = 'math' | 'code' | 'mermaid'

export const ENGINE_SLOT_ORDER: readonly EngineSlotName[] = ['math', 'code', 'mermaid']

export interface EngineDiagnosticInput {
  code: string
  category: DocumentDiagnostic['category']
  messageKey: string
  retryable: boolean
  /** UTF-16 offset range; converted to UTF-8 bytes by the pipeline. */
  sourceRange?: SourceRangeUtf16
  details?: Record<string, string | number | boolean>
}

export interface EngineContext {
  readonly options: ResolvedPipelineOptions
  readonly text: string
  /** Record a per-node local diagnostic (`PS_PARSE_LOCAL` class). */
  addDiagnostic(input: EngineDiagnosticInput): void
  /** Convert a source range for IPC-shaped diagnostics/source mapping. */
  toSourceRangeBytes(range: SourceRangeUtf16): SourceRangeBytes
}

export interface PipelineEngine {
  /** Stable name for diagnostics (`details.engine`). */
  name: string
  /**
   * Transform the sanitized hast tree. May be async (Shiki dynamic import).
   * Return a tree to replace the current one, or nothing to keep it.
   */
  transform(tree: Root, context: EngineContext): Root | Promise<Root> | void | Promise<void>
}

const registry = new Map<EngineSlotName, PipelineEngine>()

/** Register one engine for a slot; returns a disposer (tests/unloads). */
export function registerEngine(slot: EngineSlotName, engine: PipelineEngine): () => void {
  registry.set(slot, engine)
  return () => {
    if (registry.get(slot) === engine) registry.delete(slot)
  }
}

/** Engines in the normative ⑧→⑨→⑩ order. */
export function listEngines(): PipelineEngine[] {
  const engines: PipelineEngine[] = []
  for (const slot of ENGINE_SLOT_ORDER) {
    const engine = registry.get(slot)
    if (engine) engines.push(engine)
  }
  return engines
}

/** Remove all registrations (test helper; production code should not call). */
export function clearEngines(): void {
  registry.clear()
}
