/**
 * Login.test.tsx
 *
 * Covers:
 *  - Session expiry notice: the login screen displays the reason stored in
 *    sessionStorage by the 401 interceptor (e.g. "token_expired").
 *  - Bad credentials: an API error is displayed on the form without redirecting.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Login } from '../pages/Login'
import { AUTH_MESSAGE_KEY } from '../api/client'
import { AuthContext } from '../context/AuthContext'

// Minimal AuthContext value — the Login page only calls `login`.
function makeAuthContext(loginFn: () => Promise<void>) {
  return {
    user: null,
    login: (_u: string, _p: string) => loginFn(),
    logout: vi.fn(),
    isAuthenticated: false,
    isAdmin: false,
  }
}

function renderLogin(loginFn: () => Promise<void> = () => Promise.resolve()) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={makeAuthContext(loginFn)}>
        <Login />
      </AuthContext.Provider>
    </MemoryRouter>
  )
}

describe('Login page', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('displays the session expiry notice stored by the 401 interceptor', () => {
    sessionStorage.setItem(AUTH_MESSAGE_KEY, 'Your session has ended. Please sign in again.')
    renderLogin()

    expect(
      screen.getByText('Your session has ended. Please sign in again.')
    ).toBeInTheDocument()
  })

  it('displays API error message on failed login', async () => {
    const loginFn = vi.fn().mockRejectedValue({
      response: { data: { error: 'Invalid username or password' } },
    })
    renderLogin(loginFn)

    await userEvent.type(screen.getByLabelText(/username/i), 'wrong')
    await userEvent.type(screen.getByLabelText(/password/i), 'bad')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText('Invalid username or password')).toBeInTheDocument()
    })
  })

  it('does not show notice when sessionStorage is empty', () => {
    renderLogin()
    expect(screen.queryByRole('img', { name: /info/i })).not.toBeInTheDocument()
    // The notice container uses an amber background; confirm it is absent
    expect(document.querySelector('.bg-amber-50')).toBeNull()
  })
})
