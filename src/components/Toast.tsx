import { useEffect, useRef, type CSSProperties } from 'react'

import { Icon } from './Icon'
import { IconButton } from './IconButton'
import { t } from '../app/i18n'

/**
 * Toast (ui-spec §2.1 §3.8, VC-13): success toasts auto-dismiss after ~1.5s
 * with `role="status"`; error toasts persist until dismissed with
 * `role="alert"`. Neither steals focus.
 */

export type ToastTone = 'success' | 'error'

export const TOAST_SUCCESS_DURATION_MS = 1500

export interface ToastProps {
  tone: ToastTone
  message: string
  /** Required to dismiss; called after the timeout for success toasts. */
  onDismiss?: () => void
  durationMs?: number
  className?: string
}

const TOAST_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 'var(--ps-space-2)',
  maxWidth: 420,
  padding: 'var(--ps-space-2) var(--ps-space-3)',
  background: 'var(--ps-color-surface)',
  color: 'var(--ps-color-text)',
  border: '1px solid var(--ps-color-border)',
  borderRadius: 'var(--ps-radius-sm)',
}

export function Toast({
  tone,
  message,
  onDismiss,
  durationMs = TOAST_SUCCESS_DURATION_MS,
  className,
}: ToastProps) {
  // Keep the latest dismiss callback in a ref so the auto-dismiss timer is not
  // reset by an unrelated parent re-render with a new function identity.
  const onDismissRef = useRef(onDismiss)
  useEffect(() => {
    onDismissRef.current = onDismiss
  })
  const hasDismiss = onDismiss !== undefined
  useEffect(() => {
    if (tone !== 'success' || !hasDismiss) return
    const timer = window.setTimeout(() => {
      onDismissRef.current?.()
    }, durationMs)
    return () => {
      window.clearTimeout(timer)
    }
  }, [tone, durationMs, hasDismiss])

  return (
    <div
      role={tone === 'success' ? 'status' : 'alert'}
      className={className}
      style={{
        ...TOAST_STYLE,
        borderLeft: `3px solid ${tone === 'success' ? 'var(--ps-color-accent)' : 'var(--ps-color-danger)'}`,
      }}
    >
      <Icon
        name={tone === 'success' ? 'check' : 'warn'}
        style={{
          color: tone === 'success' ? 'var(--ps-color-accent)' : 'var(--ps-color-danger)',
          flexShrink: 0,
          marginTop: '4px',
        }}
      />
      <span style={{ flex: 1, minWidth: 0 }}>{message}</span>
      {tone === 'error' && onDismiss !== undefined ? (
        <IconButton icon="close" label={t('common.close')} onClick={onDismiss} />
      ) : null}
    </div>
  )
}
