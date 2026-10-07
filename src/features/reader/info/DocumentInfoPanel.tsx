import { useEffect, useState } from 'react'

import { t } from '../../../app/i18n'
import { IconButton } from '../../../components/IconButton'
import { files } from '../../../services'
import type { DocumentDiagnostic } from '../../../document/types'
import type { SourceInfo, VersionInfo } from '../../../services/types'

/**
 * UI01 document-info expansion (ui-spec §2.2 `info/DocumentInfoPanel.tsx`;
 * §3.2 "当前文件名（点击展开“文档信息”）"; IXD §2.2 行 72; B-04).
 *
 * Shows encoding, full path, content version and resource issues. The
 * encoding is read lazily through `get_source_info` for the displayed docId
 * (the same source `SourceView` uses); path and version come from the tab's
 * displayed snapshot. All user-visible text goes through `t()`.
 */

export interface DocumentInfoPanelDeps {
  getSourceInfo?: (docId: string) => Promise<SourceInfo>
}

export interface DocumentInfoPanelProps {
  docId: string
  canonicalPath: string
  version: VersionInfo | null
  /** Resource-category diagnostics of the displayed version (may be empty). */
  issues: readonly DocumentDiagnostic[]
  onClose(): void
  /** Test seam; production uses the real `files.getSourceInfo`. */
  deps?: DocumentInfoPanelDeps
}

type EncodingState = 'loading' | 'unavailable' | SourceInfo['encoding']

export function DocumentInfoPanel({
  docId,
  canonicalPath,
  version,
  issues,
  onClose,
  deps,
}: DocumentInfoPanelProps) {
  const [encoding, setEncoding] = useState<EncodingState>('loading')

  const getSourceInfo = deps?.getSourceInfo
  useEffect(() => {
    let cancelled = false
    const load = getSourceInfo ?? files.getSourceInfo
    void load(docId)
      .then((info) => {
        if (!cancelled) setEncoding(info.encoding)
      })
      .catch(() => {
        if (!cancelled) setEncoding('unavailable')
      })
    return () => {
      cancelled = true
    }
  }, [docId, getSourceInfo])

  const encodingLabel =
    encoding === 'loading'
      ? t('common.loading')
      : encoding === 'unavailable'
        ? t('common.unavailable')
        : encoding
  const versionLabel = version === null ? t('common.unavailable') : version.contentHash

  return (
    <section className="ps-document-info" aria-label={t('document.info.title')}>
      <header className="ps-document-info-header">
        <h2 className="ps-document-info-title">{t('document.info.title')}</h2>
        <IconButton icon="close" label={t('document.info.close')} onClick={onClose} />
      </header>
      <p className="ps-document-info-row">
        {t('document.info.encoding', { value: encodingLabel })}
      </p>
      <p className="ps-document-info-row">
        {t('document.info.path', { path: canonicalPath })}
      </p>
      <p className="ps-document-info-row">
        {t('document.info.version', { value: versionLabel })}
      </p>
      <div className="ps-document-info-row">
        <p className="ps-document-info-issues-title">{t('document.info.issues')}</p>
        {issues.length === 0 ? (
          <p className="ps-document-info-issues-empty">{t('document.info.issues.none')}</p>
        ) : (
          <ul className="ps-document-info-issues">
            {issues.map((issue, index) => (
              <li key={`${issue.code}-${index}`}>
                <span>{t(issue.messageKey)}</span>
                <code>{issue.code}</code>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="ps-document-info-readonly">{t('document.info.readonly')}</p>
    </section>
  )
}
