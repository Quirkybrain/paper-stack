import {
  useId,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from 'react'

/**
 * Shared button (ui-spec §2.1): primary/secondary/danger, busy that prevents
 * duplicate submits while keeping cancellation possible, and a disabled state
 * that always exposes its reason (ui-spec §6.4/EDGE-10, VC-14).
 */

export type ButtonVariant = 'primary' | 'secondary' | 'danger'

const VARIANT_STYLES: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: 'var(--ps-color-accent)',
    color: 'var(--ps-color-surface)',
    border: '1px solid var(--ps-color-accent)',
  },
  secondary: {
    background: 'var(--ps-color-surface)',
    color: 'var(--ps-color-text)',
    border: '1px solid var(--ps-color-border)',
  },
  danger: {
    background: 'var(--ps-color-danger)',
    color: 'var(--ps-color-surface)',
    border: '1px solid var(--ps-color-danger)',
  },
}

const BASE_STYLE: CSSProperties = {
  minHeight: 'var(--ps-control-h)',
  minWidth: 'var(--ps-hit-min)',
  padding: '0 var(--ps-space-3)',
  borderRadius: 'var(--ps-radius-sm)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'var(--ps-space-1)',
  transition: 'background var(--ps-transition-fast), border-color var(--ps-transition-fast)',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  /** Prevents repeat submission; callers keep a separately reachable cancel. */
  busy?: boolean
  /** Required explanation when the button is disabled (ui-spec §6.4). */
  disabledReason?: string
  /** React 19 ref-as-prop: dialogs focus the safe default action on mount. */
  ref?: Ref<HTMLButtonElement>
  children?: ReactNode
}

export function Button({
  variant = 'secondary',
  busy = false,
  disabledReason,
  disabled,
  title,
  ref,
  'aria-describedby': ariaDescribedBy,
  style,
  children,
  ...rest
}: ButtonProps) {
  const reasonId = useId()
  const isDisabled = disabled === true || busy
  const describedBy = isDisabled && disabledReason !== undefined ? reasonId : ariaDescribedBy
  return (
    <>
      <button
        {...rest}
        ref={ref}
        disabled={isDisabled}
        aria-busy={busy || undefined}
        aria-describedby={describedBy}
        title={isDisabled && disabledReason !== undefined ? disabledReason : title}
        style={{ ...BASE_STYLE, ...VARIANT_STYLES[variant], ...style }}
      >
        {children}
      </button>
      {isDisabled && disabledReason !== undefined ? (
        <span id={reasonId} className="ps-visually-hidden">
          {disabledReason}
        </span>
      ) : null}
    </>
  )
}
