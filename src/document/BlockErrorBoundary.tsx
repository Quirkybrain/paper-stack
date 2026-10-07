import { Component, type ReactNode } from 'react'

/**
 * Per-block failure boundary (rendering-pipeline §4; IXD §11.3).
 *
 * A failing block renders its source excerpt plus a diagnostic label instead
 * of blanking the tab ("no white screen"). The label is resolved through the
 * injected `translate` (the app passes `t`); the document layer never embeds
 * natural-language text itself. `messageKey` comes from the thrown error when
 * present, otherwise it degrades to `error.parse.local`.
 */

export type Translate = (key: string) => string

export interface BlockErrorBoundaryProps {
  /** Stable block id for the fallback section (`data-block-id`). */
  blockId?: string
  /** Source excerpt of the failed block, when the caller can provide it. */
  sourceExcerpt?: string
  /** Translation function from the app layer (i18n); defaults to the key. */
  translate?: Translate
  onError?: (error: Error, blockId?: string) => void
  children?: ReactNode
}

interface BlockErrorBoundaryState {
  error: Error | null
}

export class BlockErrorBoundary extends Component<
  BlockErrorBoundaryProps,
  BlockErrorBoundaryState
> {
  state: BlockErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): BlockErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error): void {
    this.props.onError?.(error, this.props.blockId)
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    const translate = this.props.translate ?? ((key: string) => key)
    const candidate = (error as unknown as { messageKey?: unknown }).messageKey
    const messageKey = typeof candidate === 'string' ? candidate : 'error.parse.local'

    return (
      <section className="ps-block-error" data-block-id={this.props.blockId} role="note">
        {this.props.sourceExcerpt !== undefined ? (
          <pre className="ps-block-error-source">{this.props.sourceExcerpt}</pre>
        ) : null}
        <p className="ps-block-error-message">{translate(messageKey)}</p>
      </section>
    )
  }
}
