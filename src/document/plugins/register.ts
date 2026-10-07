/**
 * Engine registration seam (rendering-pipeline §1 steps ⑧⑨⑩).
 *
 * `pipeline.ts` imports this module for its side effects so the Web Worker
 * entry and the main-thread fallback share exactly one engine registry.
 *
 * wp-19 registers the three v0.1.0 engines here, in the normative order
 * math → code → mermaid. All of them run after `rehype-sanitize`; their output
 * is trusted, never re-sanitized and never re-parsed from document text.
 * Mode gating lives inside the engines (`standard` mode keeps math/mermaid as
 * literal text), not in the registry.
 */

import { registerEngine } from '../engines'
import { katexEngine } from './katex'
import { mermaidEngine } from './mermaid'
import { shikiEngine } from './shiki'

registerEngine('math', katexEngine)
registerEngine('code', shikiEngine)
registerEngine('mermaid', mermaidEngine)

export {}
