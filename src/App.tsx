import { AppStoreProvider } from './app/store'
import { t } from './app/i18n'
import { DOCUMENT_BODY_ID, SkipLink } from './components/SkipLink'

/**
 * Application shell (wp-16). Wires the global store provider, i18n and the
 * base shell landmarks; feature screens (welcome, reader, settings) replace
 * the placeholder body in later tasks. No feature logic lives here.
 */
export default function App() {
  return (
    <AppStoreProvider>
      <SkipLink />
      <main
        id={DOCUMENT_BODY_ID}
        className="ps-content-column"
        aria-label={t('aria.documentBody')}
        style={{ minHeight: '100%' }}
      >
        <h1 style={{ paddingTop: 'var(--ps-space-5)' }}>{t('app.name')}</h1>
        <p style={{ color: 'var(--ps-color-muted)' }}>{t('welcome.note')}</p>
      </main>
    </AppStoreProvider>
  )
}
