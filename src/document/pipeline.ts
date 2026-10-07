import type { Root as HastRoot } from 'hast'
import type { Root as MdastRoot } from 'mdast'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'

import './plugins/register'
import { listEngines, type EngineContext } from './engines'
import { remarkMathPlugin } from './plugins/katex'
import { rehypeForceTaskCheckboxDisabled, sanitizeSchema } from './sanitize'
import { utf8ByteLength, utf16RangeToUtf8Bytes } from './source-map'
import { runMdastTransforms } from './transforms'
import type {
  DocumentDiagnostic,
  ParseDocumentOptions,
  ParseDocumentResult,
  PipelineStats,
  ResolvedPipelineOptions,
} from './types'

/**
 * The single document pipeline (ADR-002; rendering-pipeline §1). ①–② parse
 * mdast, ④ runs the fixed a→b→c transforms, ⑤–⑦ convert to hast and sanitize
 * (raw HTML is untrusted until ⑦), ⑧–⑩ run trusted engine slots, and ⑪–⑫
 * (React mapping, block wrapping) live in `map.tsx` on the main thread.
 *
 * The product is structured-cloneable for the Worker boundary (§6):
 * `hast`, `outline`, `blocks`, `segments`, `diagnostics`, `stats` only —
 * never the document text.
 */

const EMPTY_STATS: PipelineStats = {
  charsUtf16: 0,
  bytesUtf8: 0,
  blockCount: 0,
  segmentCount: 0,
  headingCount: 0,
}

export function resolvePipelineOptions(
  options: ParseDocumentOptions = {},
): ResolvedPipelineOptions {
  return {
    mode: options.mode ?? 'technical',
    inlineMath: options.inlineMath ?? true,
    simplified: options.simplified ?? false,
  }
}

export async function parseDocument(
  text: string,
  options: ParseDocumentOptions = {},
): Promise<ParseDocumentResult> {
  const resolved = resolvePipelineOptions(options)
  const diagnostics: DocumentDiagnostic[] = []

  try {
    // ①–③: CommonMark base AST; GFM subset and math only in technical mode.
    // `inlineMath:false` keeps `$$…$$` blocks while `$…$` stays literal
    // (rendering-pipeline §1 mode table, §2.3).
    const mdastProcessor = unified().use(remarkParse)
    if (resolved.mode === 'technical') {
      mdastProcessor.use(remarkGfm)
      mdastProcessor.use(remarkMathPlugin, { singleDollarTextMath: resolved.inlineMath })
    }
    const mdast = mdastProcessor.parse(text) as MdastRoot

    // ④: custom mdast transforms a→b→c, all pure functions.
    const side = runMdastTransforms(mdast, text)

    // ⑤–⑦: hast conversion, raw HTML parsing, sanitize and the read-only patch.
    const hastProcessor = unified()
      .use(remarkRehype, { allowDangerousHtml: true, clobberPrefix: 'ps-' })
      .use(rehypeRaw)
      .use(rehypeSanitize, sanitizeSchema)
      .use(rehypeForceTaskCheckboxDisabled)
    let hast = (await hastProcessor.run(mdast)) as HastRoot

    // ⑧–⑩: engine slots run strictly after sanitize, in spec order.
    const context: EngineContext = {
      options: resolved,
      text,
      addDiagnostic(input) {
        diagnostics.push({
          code: input.code,
          category: input.category,
          messageKey: input.messageKey,
          retryable: input.retryable,
          sourceRange: input.sourceRange
            ? utf16RangeToUtf8Bytes(text, input.sourceRange)
            : undefined,
          details: input.details,
        })
      },
      toSourceRangeBytes(range) {
        return utf16RangeToUtf8Bytes(text, range)
      },
    }

    // ⑧–⑩: engine slots run strictly after sanitize, in spec order. The
    // simplified subset skips them entirely: heavy blocks keep their sanitized
    // source form (code blocks, `.math` source, mermaid code block) while the
    // block/segment source map stays identical to the full pipeline
    // (rendering-pipeline §5: "简化模式仍是同一管线的子集").
    if (!resolved.simplified) {
      for (const engine of listEngines()) {
        try {
          const next = await engine.transform(hast, context)
          if (next) hast = next
        } catch {
          // Failure isolation (rendering-pipeline §4): a failing engine degrades
          // locally and never blocks the rest of the document. Error messages
          // may contain document text, so only the engine name is recorded.
          diagnostics.push({
            code: 'PS_PARSE_LOCAL',
            category: 'parse',
            messageKey: 'error.parse.local',
            retryable: false,
            details: { engine: engine.name },
          })
        }
      }
    }

    return {
      status: 'ok',
      hast,
      outline: side.outline,
      blocks: side.blocks,
      segments: side.segments,
      diagnostics,
      stats: {
        charsUtf16: text.length,
        bytesUtf8: utf8ByteLength(text),
        blockCount: side.blocks.length,
        segmentCount: side.segments.length,
        headingCount: side.outline.length,
      },
    }
  } catch {
    // Defensive document-level failure: the caller falls back to the source
    // view (rendering-pipeline §2.1/§4).
    const safeText = typeof text === 'string' ? text : ''
    return {
      status: 'failed',
      hast: null,
      outline: [],
      blocks: [],
      segments: [],
      diagnostics: [
        {
          code: 'PS_PARSE_DOC',
          category: 'parse',
          messageKey: 'error.parse.document',
          retryable: true,
        },
      ],
      stats: {
        ...EMPTY_STATS,
        charsUtf16: safeText.length,
        bytesUtf8: utf8ByteLength(safeText),
      },
    }
  }
}
