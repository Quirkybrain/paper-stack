import { Component, type ReactNode } from 'react'

import { t } from '../../app/i18n'
import { Button } from '../../components/Button'

/**
 * Root rendering boundary (ui-spec §2.1 `ErrorBoundary`; architecture §9):
 * keeps a readable fallback with a retry instead of a white screen when the
 * reader itself throws. Block-level failures are already isolated per block
 * (rendering-pipeline §4).
 */

interface RootErrorBoundaryProps {
  children: ReactNode
}

interface RootErrorBoundaryState {
  error: Error | null
}

export class RootErrorBoundary extends Component<RootErrorBoundaryProps, RootErrorBoundaryState> {
  state: RootErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): RootErrorBoundaryState {
    return { error }
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <div className="ps-root-error" role="alert">
        <p className="ps-root-error-message">{t('error.internal.unexpected')}</p>
        <p className="ps-root-error-detail">{this.state.error.name}</p>
        <Button variant="secondary" onClick={() => this.setState({ error: null })}>
          {t('common.retry')}
        </Button>
      </div>
    )
  }
}
