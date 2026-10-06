/**
 * Visible-text extraction for the allowed raw-HTML subset
 * (rendering-pipeline §2.4c; security-model §5.2).
 *
 * This is an indexing helper, not a security boundary: it only decides which
 * characters the literal search index may see. Tags are dropped, contents of
 * tags that sanitize strips (script/style/iframe/…) are skipped, comments are
 * dropped. Source positions for these segments are approximate: the outer raw
 * node's range is used (rendering-pipeline §3 item 3).
 */

/** Raw-content tags whose text is never visible and must not be indexed. */
const HIDDEN_CONTENT_TAGS = new Set([
  'script',
  'style',
  'title',
  'iframe',
  'object',
  'embed',
  'template',
  'textarea',
  'select',
  'option',
  'svg',
  'math',
  'video',
  'audio',
  'source',
  'link',
  'meta',
  'base',
  'form',
  'button',
])

/** Void elements never open a hidden-content region. */
const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
])

const TAG_PATTERN = /^<\/?\s*([a-zA-Z][a-zA-Z0-9-]*)/

/** Join visible text runs in document order; empty string when nothing shows. */
export function visibleHtmlText(raw: string): string {
  const withoutComments = raw.replace(/<!--[\s\S]*?-->/g, '')
  const parts = withoutComments.split(/(<[^>]*>)/)
  const runs: string[] = []
  let hiddenDepth = 0

  for (const part of parts) {
    if (part.startsWith('<')) {
      const match = TAG_PATTERN.exec(part)
      if (!match) continue
      const name = match[1].toLowerCase()
      if (!HIDDEN_CONTENT_TAGS.has(name)) continue
      const selfClosing = part.endsWith('/>') || VOID_TAGS.has(name)
      if (part.startsWith('</')) {
        if (hiddenDepth > 0) hiddenDepth -= 1
      } else if (!selfClosing) {
        hiddenDepth += 1
      }
    } else if (hiddenDepth === 0) {
      const text = part.trim()
      if (text.length > 0) runs.push(text)
    }
  }

  return runs.join('\n')
}
