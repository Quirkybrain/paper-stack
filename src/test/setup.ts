import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Shared Vitest setup. React Testing Library cleanup is registered explicitly
// so component tests added by later tasks cannot leak DOM between cases.
afterEach(() => {
  cleanup()
})
