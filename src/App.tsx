import { t } from './app/i18n'

/**
 * Placeholder shell for the workspace skeleton (wp-07). The real reader
 * application shell replaces it in wp-16/wp-20; this exists to prove the
 * React + i18n + Vite pipeline end to end.
 */
export default function App() {
  return (
    <main>
      <h1>{t('app.name')}</h1>
    </main>
  )
}
