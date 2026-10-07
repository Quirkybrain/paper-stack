import { AppStoreProvider } from './app/store'
import { SkipLink } from './components/SkipLink'
import ReaderScreen from './features/reader/ReaderScreen'

/**
 * Application shell. wp-16 wired the store provider, i18n and base
 * landmarks; wp-19 mounts the reader (toolbar/tabs/body) which owns the
 * document landmark. Welcome remains the reader's empty state until wp-24
 * replaces it. No feature logic lives here.
 */
export default function App() {
  return (
    <AppStoreProvider>
      <SkipLink />
      <ReaderScreen />
    </AppStoreProvider>
  )
}
