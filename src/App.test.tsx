import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import App from './App'
import { t } from './app/i18n'
import { DOCUMENT_BODY_ID } from './components/SkipLink'

describe('App shell', () => {
  it('renders the skip link, landmark and placeholder body from translations', () => {
    render(<App />)

    const main = screen.getByRole('main', { name: t('aria.documentBody') })
    expect(main.getAttribute('id')).toBe(DOCUMENT_BODY_ID)

    const skipLink = screen.getByRole('link', { name: t('aria.skipToBody') })
    expect(skipLink.getAttribute('href')).toBe(`#${DOCUMENT_BODY_ID}`)

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(t('app.name'))
    expect(screen.getByText(t('welcome.note'))).toBeTruthy()
  })
})
