/**
 * Engine registration seam (rendering-pipeline §1 steps ⑧⑨⑩).
 *
 * `pipeline.ts` imports this module for its side effects so the Web Worker
 * entry and the main-thread fallback share exactly one engine registry.
 *
 * wp-19 (KaTeX / Shiki / Mermaid) adds `registerEngine('math'|'code'|
 * 'mermaid', …)` calls here together with the `plugins/**` implementations.
 * Intentionally side-effect free until then: wp-17/wp-18 run the slots with
 * zero registered engines.
 */
export {}
