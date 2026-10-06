import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App.tsx'
import { getLocale } from './app/i18n'
import 'katex/dist/katex.min.css'
import './styles/tokens.css'
import './styles/base.css'

const container = document.getElementById('root')
if (!container) {
  throw new Error('index.html is missing the #root mount point')
}

document.documentElement.lang = getLocale()

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
