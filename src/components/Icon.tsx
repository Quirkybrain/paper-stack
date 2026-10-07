import type { CSSProperties } from 'react'

/**
 * Hand-written inline SVG icon set (VC-01): 18–20px, `currentColor`, no icon
 * fonts and no remote resources. Icons are decorative here — the surrounding
 * control must carry the accessible name (ui-spec §6.3).
 */

const ICON_PATHS = {
  check: ['M4 10.5l4 4 8-9'],
  close: ['M5 5l10 10', 'M15 5L5 15'],
  warn: ['M10 3.5l7 12.5H3z', 'M10 8v4', 'M10 14.2h.01'],
  info: ['M10 3a7 7 0 1 1 0 14 7 7 0 0 1 0-14z', 'M10 9v5', 'M10 6.2h.01'],
  chevronDown: ['M5 8l5 5 5-5'],
  chevronRight: ['M8 5l5 5-5 5'],
  chevronLeft: ['M12 5l-5 5 5 5'],
  arrowLeft: ['M15 10H5', 'M9 6l-4 4 4 4'],
  arrowRight: ['M5 10h10', 'M11 6l4 4-4 4'],
  refresh: ['M16.5 10a6.5 6.5 0 1 1-2.2-4.9', 'M16.5 3.5v3.2h-3.2'],
  folder: ['M3 6.5A1.5 1.5 0 0 1 4.5 5h3l2 2h6A1.5 1.5 0 0 1 17 8.5v6A1.5 1.5 0 0 1 15.5 16h-11A1.5 1.5 0 0 1 3 14.5z'],
  fileText: ['M6 3h5l4 4v10H6z', 'M11 3v4h4', 'M8.5 11h3.5', 'M8.5 13.5h3.5'],
  search: ['M9 4a5 5 0 1 1 0 10A5 5 0 0 1 9 4z', 'M12.8 12.8L17 17'],
  settings: ['M3 6h14', 'M3 10h14', 'M3 14h14', 'M8 6a1 1 0 1 1-2 0 1 1 0 0 1 2 0z', 'M14 10a1 1 0 1 1-2 0 1 1 0 0 1 2 0z', 'M10 14a1 1 0 1 1-2 0 1 1 0 0 1 2 0z'],
  more: ['M5 10h.01', 'M10 10h.01', 'M15 10h.01'],
  open: ['M10 3v8', 'M7 8l3 3 3-3', 'M5 13v3h10v-3'],
} as const

export type IconName = keyof typeof ICON_PATHS

export interface IconProps {
  name: IconName
  /** CSS length; defaults to the 18px token (VC-01: 18–20px). */
  size?: number | string
  className?: string
  style?: CSSProperties
}

export function Icon({ name, size = 'var(--ps-icon)', className, style }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      {ICON_PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
