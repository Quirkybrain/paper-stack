import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { t } from '../../../app/i18n'
import type { DocumentDiagnostic } from '../../../document/types'
import type { SourceInfo, VersionInfo } from '../../../services/types'
import { DocumentInfoPanel, type DocumentInfoPanelProps } from './DocumentInfoPanel'

/**
 * UI01 document-info panel (ui-spec §2.2/§3.2; IXD §2.2; B-04): encoding via
 * `get_source_info`, full path, content version, resource issues, read-only
 * marker and the explicit close control. All copy resolves through `t()`.
 */

const VERSION: VersionInfo = {
  contentHash: 'v1',
  sizeBytes: 128,
  modifiedAtMs: 1,
  observedAtMs: 2,
}

function sourceInfo(docId: string): SourceInfo {
  return { docId, version: VERSION, encoding: 'utf-8', totalLines: 3 }
}

function renderPanel(overrides: Partial<DocumentInfoPanelProps> = {}) {
  const onClose = vi.fn()
  const getSourceInfo = vi.fn(async (docId: string) => sourceInfo(docId))
  const props: DocumentInfoPanelProps = {
    docId: 'd-1',
    canonicalPath: '/docs/a.md',
    version: VERSION,
    issues: [],
    onClose,
    deps: { getSourceInfo },
    ...overrides,
  }
  render(<DocumentInfoPanel {...props} />)
  return { onClose, getSourceInfo }
}

describe('DocumentInfoPanel (ui-spec §2.2, B-04)', () => {
  it('shows encoding, full path, content version, resource issues and the read-only marker', async () => {
    const { getSourceInfo } = renderPanel()
    await screen.findByText(t('document.info.encoding', { value: 'utf-8' }))
    expect(getSourceInfo).toHaveBeenCalledWith('d-1')
    expect(screen.getByText(t('document.info.path', { path: '/docs/a.md' }))).toBeTruthy()
    expect(screen.getByText(t('document.info.version', { value: 'v1' }))).toBeTruthy()
    expect(screen.getByText(t('document.info.issues'))).toBeTruthy()
    expect(screen.getByText(t('document.info.issues.none'))).toBeTruthy()
    expect(screen.getByText(t('document.info.readonly'))).toBeTruthy()
  })

  it('lists resource-category issues with translated messages', async () => {
    const issue: DocumentDiagnostic = {
      code: 'PS_RESOURCE_MISSING',
      category: 'resource',
      messageKey: 'error.resource.missing',
      retryable: false,
    }
    renderPanel({ issues: [issue] })
    await screen.findByText(t('document.info.encoding', { value: 'utf-8' }))
    expect(screen.getByText(t('error.resource.missing'))).toBeTruthy()
    expect(screen.getByText('PS_RESOURCE_MISSING')).toBeTruthy()
    expect(screen.queryByText(t('document.info.issues.none'))).toBeNull()
  })

  it('falls back to the unavailable label when the encoding read fails', async () => {
    const getSourceInfo = vi.fn(async () => {
      throw new Error('source info unavailable')
    })
    renderPanel({ deps: { getSourceInfo } })
    await screen.findByText(
      t('document.info.encoding', { value: t('common.unavailable') }),
    )
  })

  it('closes through the explicit close control', async () => {
    const { onClose } = renderPanel()
    await screen.findByText(t('document.info.encoding', { value: 'utf-8' }))
    fireEvent.click(screen.getByRole('button', { name: t('document.info.close') }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
