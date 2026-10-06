import type { Root } from 'hast'
import { defaultSchema, type Options as SanitizeSchema } from 'rehype-sanitize'
import { visit } from 'unist-util-visit'

/**
 * Application sanitize schema — the single authority for rendered document
 * text (security-model §5.2; rendering-pipeline §2.7). Build on
 * `defaultSchema` but replace the allow lists with the documented v0.1.0
 * subset:
 *
 * - no global attributes (all `on*`, `style`, `srcset`, `ping`, `target`,
 *   `class` stripped unless a per-element rule allows them);
 * - `script`/`style`/`iframe`/`object`/`embed`/`form`/`button`/raw `svg`/
 *   raw `math`/media/`link`/`meta`/`base`/`template`/form controls stripped
 *   with their contents (engine output is injected after sanitize);
 * - `clobberPrefix: ''` so the outline's `ps-h-*` ids survive;
 * - protocols: `href` → http/https/mailto, `src` → http/https (relative and
 *   fragment URLs are allowed by the sanitizer's protocol check);
 * - D-3 (wp-19): `code` additionally admits the `math-inline`/`math-display`
 *   marker classes emitted by `remark-math`; everything else about the schema
 *   is unchanged (see `MATH_MARKER_CLASS_PATTERN`).
 *
 * Anything not listed here is not "allowed by omission": unlisted elements
 * are unwrapped by `hast-util-sanitize`, and unlisted properties are dropped.
 */

/** Raw tags stripped together with their contents (security-model §5.2). */
export const STRIPPED_RAW_TAGS = [
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'form',
  'button',
  'svg',
  'math',
  'video',
  'audio',
  'source',
  'link',
  'meta',
  'base',
  'template',
  'textarea',
  'select',
  'option',
] as const

export const ALLOWED_TAGS = [
  'p',
  'br',
  'hr',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'em',
  'strong',
  'del',
  'a',
  'img',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'details',
  'summary',
  'span',
  'sup',
  'sub',
  'section',
  'input',
] as const

/** Generated heading anchors (rendering-pipeline §2.4a). */
export const HEADING_ID_PATTERN = /^ps-h-[a-z0-9-]{1,128}$/

/** GFM footnote ids/hrefs after `clobberPrefix: 'ps-'` (security-model §5.2). */
export const FOOTNOTE_ID_PATTERN = /^ps-fn-[A-Za-z0-9-]+$/

/** Code fence classes kept for the wp-19 Shiki/Mermaid engine slots. */
export const LANGUAGE_CLASS_PATTERN = /^language-[A-Za-z0-9_+-]{1,32}$/

/**
 * Bounded sanitize-schema extension authorized by D-3 (wp-19):
 * `remark-math` (③) marks math nodes as `code` elements carrying
 * `language-math` plus `math-inline` (`$…$`) or `math-display` (`$$…$$`)
 * (`mdast-util-math`). Only these two extra class tokens are admitted on
 * `code`; the KaTeX output itself is injected by engine slot ⑧ *after*
 * sanitize and is never re-sanitized. No tag, attribute, protocol or global
 * rule changes beyond this alternation (security-model §5.2 delta recorded in
 * `artifacts/60-implementation/wp-19-reader.md`).
 */
export const MATH_MARKER_CLASS_PATTERN = /^math-(inline|display)$/

/** `code` className: fence languages plus the remark-math marker classes. */
export const CODE_CLASS_PATTERN = /^(language-[A-Za-z0-9_+-]{1,32}|math-(inline|display))$/

const HEADING_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const

function headingAttributes(): SanitizeSchema['attributes'] {
  const result: NonNullable<SanitizeSchema['attributes']> = {}
  for (const tag of HEADING_TAGS) {
    result[tag] = [['id', HEADING_ID_PATTERN]]
  }
  return result
}

export const sanitizeSchema: SanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...headingAttributes(),
    a: ['href', 'title'],
    img: ['src', 'alt', 'title'],
    code: [['className', CODE_CLASS_PATTERN]],
    li: [
      ['className', 'task-list-item'],
      ['id', FOOTNOTE_ID_PATTERN],
    ],
    input: [['type', 'checkbox'], 'checked', 'disabled'],
    details: ['open'],
    td: [['align', /^(left|center|right)$/]],
    th: [['align', /^(left|center|right)$/]],
    section: [['className', 'footnotes'], 'dataFootnotes'],
  },
  clobberPrefix: '',
  protocols: {
    href: ['http', 'https', 'mailto'],
    src: ['http', 'https'],
  },
  required: {
    input: { disabled: true, type: 'checkbox' },
  },
  strip: [...STRIPPED_RAW_TAGS],
  tagNames: [...ALLOWED_TAGS],
}

/**
 * Post-sanitize patch: force task-list checkboxes read-only (security-model
 * §5.2 post patch; R04). Sanitize already enforces this through `required`;
 * this pass keeps the invariant explicit even for engine-produced input and
 * documents the read-only boundary in one visible place.
 */
export function rehypeForceTaskCheckboxDisabled() {
  return (tree: Root): Root => {
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'input') return
      if (node.properties.type !== 'checkbox') return
      node.properties.disabled = true
    })
    return tree
  }
}
