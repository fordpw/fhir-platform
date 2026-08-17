/**
 * ApiConsole.test.tsx
 *
 * Covers the auth toggle behaviour fixed in PR #9:
 *  - The "Send Authorization header" checkbox is visible on render
 *  - It starts checked (sendAuth = true) — the default safe state
 *  - Unchecking it changes the checked state (toggling provably works)
 *
 * The console client (sendConsoleRequest) is mocked so no real HTTP calls
 * are made.  The default endpoint opens on admin-stats, which requires auth,
 * making the toggle observable.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ApiConsole } from '../pages/ApiConsole'
import { AuthContext } from '../context/AuthContext'

// Prevent real HTTP calls from the console client
vi.mock('../api/consoleClient', () => ({
  sendConsoleRequest: vi.fn().mockResolvedValue({
    status: 200,
    statusText: 'OK',
    durationMs: 42,
    headers: {},
    body: '{}',
  }),
  toCurl: vi.fn().mockReturnValue('curl ...'),
}))

function renderConsole() {
  return render(
    <MemoryRouter>
      <AuthContext.Provider
        value={{
          user: { token: 't', username: 'admin', role: 'ADMIN' },
          login: vi.fn(),
          logout: vi.fn(),
          isAuthenticated: true,
          isAdmin: true,
        }}
      >
        <ApiConsole />
      </AuthContext.Provider>
    </MemoryRouter>
  )
}

describe('ApiConsole auth toggle', () => {
  it('renders the "Send Authorization header" checkbox', () => {
    renderConsole()
    const checkbox = screen.getByRole('checkbox', { name: /send authorization header/i })
    expect(checkbox).toBeInTheDocument()
  })

  it('is checked by default (sendAuth starts true)', () => {
    renderConsole()
    const checkbox = screen.getByRole('checkbox', { name: /send authorization header/i })
    expect(checkbox).toBeChecked()
  })

  it('becomes unchecked when clicked', async () => {
    renderConsole()
    const checkbox = screen.getByRole('checkbox', { name: /send authorization header/i })
    await userEvent.click(checkbox)
    expect(checkbox).not.toBeChecked()
  })

  it('can be toggled back to checked', async () => {
    renderConsole()
    const checkbox = screen.getByRole('checkbox', { name: /send authorization header/i })
    await userEvent.click(checkbox)
    await userEvent.click(checkbox)
    expect(checkbox).toBeChecked()
  })
})
