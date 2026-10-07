import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Shared Vitest setup. React Testing Library cleanup is registered explicitly
// so component tests added by later tasks cannot leak DOM between cases.
afterEach(() => {
  cleanup()
  // The settings host applies theme/typography to the document root; tests
  // must not leak that state into each other.
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.style.removeProperty('--ps-body-size')
  document.documentElement.style.removeProperty('--ps-body-line')
  document.documentElement.style.removeProperty('--ps-content-max')
})
