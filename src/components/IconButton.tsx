import { useId, type ButtonHTMLAttributes } from 'react'

import { Icon, type IconName } from './Icon'

/**
 * Icon-only button (ui-spec §2.1/§6.3): `aria-label` is mandatory; the tooltip
 * only supplements it (EDGE-10). Disabled reasons ride along like `Button`.
 */

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Accessible name; always required (ui-spec §6.3). */
  label: string
  icon: IconName
  iconSize?: number | string
  variant?: 'default' | 'ghost'
  disabledReason?: string
}

export function IconButton({
  label,
  icon,
  iconSize,
  variant = 'ghost',
  disabledReason,
  disabled,
  title,
  'aria-describedby': ariaDescribedBy,
  style,
  ...rest
}: IconButtonProps) {
  const reasonId = useId()
  const isDisabled = disabled === true
  const describedBy =
    isDisabled && disabledReason !== undefined ? reasonId : ariaDescribedBy
  return (
    <>
      <button
        {...rest}
        type="button"
        disabled={isDisabled}
        aria-label={label}
        aria-describedby={describedBy}
        title={isDisabled && disabledReason !== undefined ? disabledReason : (title ?? label)}
        style={{
          width: 'var(--ps-control-h)',
          height: 'var(--ps-control-h)',
          minWidth: 'var(--ps-hit-min)',
          minHeight: 'var(--ps-hit-min)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          borderRadius: 'var(--ps-radius-sm)',
          background: variant === 'ghost' ? 'transparent' : 'var(--ps-color-surface)',
          color: 'inherit',
          border:
            variant === 'ghost' ? '1px solid transparent' : '1px solid var(--ps-color-border)',
          cursor: 'pointer',
          opacity: isDisabled ? 0.6 : 1,
          ...style,
        }}
      >
        <Icon name={icon} size={iconSize} />
      </button>
      {isDisabled && disabledReason !== undefined ? (
        <span id={reasonId} className="ps-visually-hidden">
          {disabledReason}
        </span>
      ) : null}
    </>
  )
}
