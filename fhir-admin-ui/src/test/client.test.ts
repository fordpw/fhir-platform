/**
 * client.test.ts
 *
 * Verifies the axios interceptor behaviour documented in CHANGELOG.md §"The reported bug":
 *   - 401 from a non-login endpoint clears credentials, stores a reason message,
 *     and redirects to /login.
 *   - 401 from the login endpoint itself is passed through untouched (bad credentials).
 *   - 403 never redirects; the authenticated session is preserved.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import axios from 'axios'

// ── jsdom location stub ──────────────────────────────────────────────────────
// jsdom exposes window.location as read-only; replace it with a writable stub.
const locationStub = { href: 'http://localhost/', pathname: '/dashboard' }
Object.defineProperty(window, 'location', {
  writable: true,
  value: locationStub,
})

// Re-import the client AFTER patching location so the module closure picks up
// the stub.  Use a dynamic import to control evaluation order.
const { default: apiClient, AUTH_MESSAGE_KEY } = await import('../api/client')

describe('axios response interceptor', () => {
  beforeEach(() => {
    localStorage.setItem('auth_token', 'test-token')
    localStorage.setItem('auth_user', JSON.stringify({ username: 'admin', role: 'ADMIN' }))
    sessionStorage.removeItem(AUTH_MESSAGE_KEY)
    locationStub.href = 'http://localhost/'
    locationStub.pathname = '/dashboard'
  })

  it('401 from a protected endpoint clears localStorage and redirects to /login', async () => {
    // Simulate a 401 response from the interceptor
    const err = Object.assign(new Error(), {
      response: {
        status: 401,
        data: { error: 'token_expired' },
      },
      config: { url: '/api/admin/stats' },
    })

    // Trigger the interceptor directly via the axios instance's interceptors
    await expect(
      // @ts-expect-error: accessing private interceptors for test
      apiClient.interceptors.response.handlers[0].rejected(err)
    ).rejects.toBeDefined()

    expect(localStorage.getItem('auth_token')).toBeNull()
    expect(localStorage.getItem('auth_user')).toBeNull()
    expect(sessionStorage.getItem(AUTH_MESSAGE_KEY)).toBe('token_expired')
    expect(locationStub.href).toBe('/login')
  })

  it('401 from /api/auth/login is passed through without clearing session', async () => {
    const err = Object.assign(new Error(), {
      response: { status: 401, data: { error: 'Invalid username or password' } },
      config: { url: '/api/auth/login' },
    })

    await expect(
      // @ts-expect-error: accessing private interceptors for test
      apiClient.interceptors.response.handlers[0].rejected(err)
    ).rejects.toBeDefined()

    // Token must not be cleared — the user is still on the login form
    expect(localStorage.getItem('auth_token')).toBe('test-token')
    expect(locationStub.href).toBe('http://localhost/')
  })

  it('403 does not clear session or redirect', async () => {
    const err = Object.assign(new Error(), {
      response: { status: 403, data: { error: 'Forbidden' } },
      config: { url: '/api/admin/users' },
    })

    await expect(
      // @ts-expect-error: accessing private interceptors for test
      apiClient.interceptors.response.handlers[0].rejected(err)
    ).rejects.toBeDefined()

    expect(localStorage.getItem('auth_token')).toBe('test-token')
    expect(locationStub.href).toBe('http://localhost/')
  })
})
