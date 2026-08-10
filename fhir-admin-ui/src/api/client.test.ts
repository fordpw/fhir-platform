import MockAdapter from 'axios-mock-adapter'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import apiClient, { AUTH_MESSAGE_KEY } from './client'

/**
 * Guards the behaviour behind the original "error loading stats" report.
 *
 * An expired session must clear credentials and send the user to the login
 * screen. A 403 must not, because signing out does not help a user who is
 * authenticated but lacks the role. And a 401 from the login form itself must
 * not reload the page out from under someone mistyping their password.
 */
describe('apiClient response interceptor', () => {
  let mock: MockAdapter
  let assigned: string[]

  beforeEach(() => {
    mock = new MockAdapter(apiClient)
    assigned = []

    localStorage.setItem('auth_token', 'stored-token')
    localStorage.setItem('auth_user', '{"username":"admin","role":"ADMIN"}')

    // jsdom does not implement navigation; capture assignments instead.
    delete (window as unknown as { location?: unknown }).location
    ;(window as unknown as { location: unknown }).location = {
      pathname: '/dashboard',
      set href(value: string) {
        assigned.push(value)
      },
      get href() {
        return assigned[assigned.length - 1] ?? '/dashboard'
      },
    }
  })

  afterEach(() => {
    mock.restore()
  })

  it('clears credentials and redirects on 401', async () => {
    mock.onGet('/api/admin/stats').reply(401, {
      error: 'Your session has expired. Please sign in again.',
      code: 'token_expired',
    })

    await expect(apiClient.get('/api/admin/stats')).rejects.toBeDefined()

    expect(localStorage.getItem('auth_token')).toBeNull()
    expect(localStorage.getItem('auth_user')).toBeNull()
    expect(assigned).toContain('/login')
  })

  it("hands the server's message to the login screen", async () => {
    mock.onGet('/api/admin/stats').reply(401, {
      error: 'Your session has expired. Please sign in again.',
      code: 'token_expired',
    })

    await expect(apiClient.get('/api/admin/stats')).rejects.toBeDefined()

    expect(sessionStorage.getItem(AUTH_MESSAGE_KEY)).toBe(
      'Your session has expired. Please sign in again.'
    )
  })

  it('falls back to a generic message when the body has none', async () => {
    mock.onGet('/api/admin/users').reply(401)

    await expect(apiClient.get('/api/admin/users')).rejects.toBeDefined()

    expect(sessionStorage.getItem(AUTH_MESSAGE_KEY)).toMatch(/sign in again/i)
  })

  it('leaves the session alone on 403', async () => {
    // Authenticated but lacking the role. Signing out would not help, and
    // doing so would eject a legitimate READONLY user.
    mock.onGet('/api/admin/stats').reply(403, {
      error: 'You do not have permission to access this resource.',
      code: 'forbidden',
    })

    await expect(apiClient.get('/api/admin/stats')).rejects.toBeDefined()

    expect(localStorage.getItem('auth_token')).toBe('stored-token')
    expect(assigned).toHaveLength(0)
    expect(sessionStorage.getItem(AUTH_MESSAGE_KEY)).toBeNull()
  })

  it('does not hijack a failed login attempt', async () => {
    // A 401 here means bad credentials, not a lapsed session. Clearing state
    // and navigating would wipe the form the user is still typing into.
    mock.onPost('/api/auth/login').reply(401, {
      error: 'Invalid username or password',
    })

    await expect(
      apiClient.post('/api/auth/login', { username: 'admin', password: 'wrong' })
    ).rejects.toBeDefined()

    expect(assigned).toHaveLength(0)
    expect(sessionStorage.getItem(AUTH_MESSAGE_KEY)).toBeNull()
    expect(localStorage.getItem('auth_token')).toBe('stored-token')
  })

  it('passes successful responses through untouched', async () => {
    mock.onGet('/api/admin/stats').reply(200, { totalResources: 42 })

    const res = await apiClient.get('/api/admin/stats')

    expect(res.data).toEqual({ totalResources: 42 })
    expect(localStorage.getItem('auth_token')).toBe('stored-token')
    expect(assigned).toHaveLength(0)
  })

  it('attaches the bearer token when one is stored', async () => {
    mock.onGet('/api/admin/stats').reply(200, {})

    await apiClient.get('/api/admin/stats')

    expect(mock.history.get[0].headers?.Authorization).toBe(
      'Bearer stored-token'
    )
  })

  it('sends no Authorization header when signed out', async () => {
    localStorage.clear()
    mock.onGet('/fhir/Patient').reply(200, {})

    await apiClient.get('/fhir/Patient')

    expect(mock.history.get[0].headers?.Authorization).toBeUndefined()
  })
})
