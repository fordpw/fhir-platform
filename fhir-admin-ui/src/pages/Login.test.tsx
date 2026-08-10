import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { Login } from './Login'
import { AUTH_MESSAGE_KEY } from '../api/client'

const loginMock = vi.fn()

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    login: loginMock,
    logout: vi.fn(),
    user: null,
    isAuthenticated: false,
    isAdmin: false,
  }),
}))

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  )
}

describe('Login', () => {
  it('shows the session message left by the 401 interceptor', async () => {
    sessionStorage.setItem(
      AUTH_MESSAGE_KEY,
      'Your session has expired. Please sign in again.'
    )

    renderLogin()

    expect(
      await screen.findByText('Your session has expired. Please sign in again.')
    ).toBeInTheDocument()
  })

  it('consumes the message so it does not reappear', async () => {
    sessionStorage.setItem(AUTH_MESSAGE_KEY, 'Your session has expired.')

    renderLogin()

    await screen.findByText('Your session has expired.')
    expect(sessionStorage.getItem(AUTH_MESSAGE_KEY)).toBeNull()
  })

  it('shows no notice on a normal visit', () => {
    renderLogin()
    expect(screen.queryByText(/session/i)).not.toBeInTheDocument()
  })

  it("surfaces the API's message rather than axios's generic text", async () => {
    // Previously this rendered "Request failed with status code 401".
    loginMock.mockRejectedValueOnce({
      response: { data: { error: 'Invalid username or password' } },
    })

    renderLogin()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/username/i), 'admin')
    await user.type(screen.getByLabelText(/password/i), 'wrong')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(
      await screen.findByText('Invalid username or password')
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/Request failed with status code/)
    ).not.toBeInTheDocument()
  })

  it('falls back to a readable message when the API sends none', async () => {
    loginMock.mockRejectedValueOnce(new Error('Network Error'))

    renderLogin()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/username/i), 'admin')
    await user.type(screen.getByLabelText(/password/i), 'admin')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(
      await screen.findByText('Invalid username or password')
    ).toBeInTheDocument()
  })

  it('clears the stale session notice once a login is attempted', async () => {
    sessionStorage.setItem(AUTH_MESSAGE_KEY, 'Your session has expired.')
    loginMock.mockRejectedValueOnce({
      response: { data: { error: 'Invalid username or password' } },
    })

    renderLogin()
    const user = userEvent.setup()
    await screen.findByText('Your session has expired.')

    await user.type(screen.getByLabelText(/username/i), 'admin')
    await user.type(screen.getByLabelText(/password/i), 'wrong')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.queryByText('Your session has expired.')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Invalid username or password')).toBeInTheDocument()
  })
})
