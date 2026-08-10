import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiConsole } from './ApiConsole'
import { sendConsoleRequest } from '../api/consoleClient'
import type { ConsoleResponse } from '../api/consoleClient'

vi.mock('../api/consoleClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/consoleClient')>()
  return { ...actual, sendConsoleRequest: vi.fn() }
})

function response(partial: Partial<ConsoleResponse> = {}): ConsoleResponse {
  return {
    status: 200,
    statusText: 'OK',
    durationMs: 12,
    headers: { 'content-type': 'application/json' },
    body: '{\n  "ok": true\n}',
    isJson: true,
    sizeBytes: 20,
    ...partial,
  }
}

describe('ApiConsole', () => {
  beforeEach(() => {
    vi.mocked(sendConsoleRequest).mockResolvedValue(response())
    localStorage.setItem('auth_token', 'tok')
  })

  /**
   * The console used to open on a public FHIR search, where the auth toggle
   * provably cannot change the outcome. That made the toggle look broken.
   */
  it('opens on an admin-gated endpoint so the auth toggle is meaningful', () => {
    render(<ApiConsole />)

    const picker = screen.getByLabelText(/endpoint/i) as HTMLSelectElement
    expect(picker.value).toBe('admin-stats')
    expect(screen.getByText('Requires ADMIN')).toBeInTheDocument()
  })

  it('sends the Authorization header when the toggle is on', async () => {
    render(<ApiConsole />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => expect(sendConsoleRequest).toHaveBeenCalled())
    expect(vi.mocked(sendConsoleRequest).mock.calls[0][0].sendAuth).toBe(true)
  })

  it('omits it when the toggle is off', async () => {
    render(<ApiConsole />)
    const user = userEvent.setup()

    await user.click(screen.getByLabelText(/send authorization header/i))
    await user.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => expect(sendConsoleRequest).toHaveBeenCalled())
    expect(vi.mocked(sendConsoleRequest).mock.calls[0][0].sendAuth).toBe(false)
  })

  /**
   * The whole reason the console uses its own axios instance: a 401 here must
   * render in the panel, not bounce the operator to /login the way the shared
   * apiClient would.
   */
  it('renders a 401 in the response panel without navigating away', async () => {
    vi.mocked(sendConsoleRequest).mockResolvedValue(
      response({
        status: 401,
        statusText: 'Unauthorized',
        body: '{\n  "code": "unauthorized"\n}',
      })
    )
    const before = window.location.href

    render(<ApiConsole />)
    const user = userEvent.setup()

    await user.click(screen.getByLabelText(/send authorization header/i))
    await user.click(screen.getByRole('button', { name: /send/i }))

    // "401" alone also matches the history row, so match the status badge,
    // which renders status plus statusText.
    expect(await screen.findByText('401 Unauthorized')).toBeInTheDocument()
    expect(screen.getByText(/"code": "unauthorized"/)).toBeInTheDocument()
    expect(window.location.href).toBe(before)
    expect(localStorage.getItem('auth_token')).toBe('tok')
  })

  it('warns when auth is off against an endpoint that requires ADMIN', async () => {
    render(<ApiConsole />)
    const user = userEvent.setup()

    await user.click(screen.getByLabelText(/send authorization header/i))

    expect(screen.getByText(/This endpoint requires ADMIN/i)).toBeInTheDocument()
  })

  /**
   * The confusing case: on a public endpoint the toggle has no effect at all.
   * Saying nothing here is what made the feature look broken during review.
   */
  it('explains that the toggle is a no-op on a public endpoint', async () => {
    render(<ApiConsole />)
    const user = userEvent.setup()

    await user.selectOptions(screen.getByLabelText(/endpoint/i), 'fhir-search')
    await user.click(screen.getByLabelText(/send authorization header/i))

    expect(screen.getByText(/This endpoint is public/i)).toBeInTheDocument()
    expect(
      screen.queryByText(/This endpoint requires ADMIN/i)
    ).not.toBeInTheDocument()
  })

  it('shows a resource-type picker only for FHIR endpoints', async () => {
    render(<ApiConsole />)
    const user = userEvent.setup()

    expect(screen.queryByLabelText(/resource type/i)).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(/endpoint/i), 'fhir-search')
    expect(screen.getByLabelText(/resource type/i)).toBeInTheDocument()
  })

  it('requires a path parameter before sending', async () => {
    render(<ApiConsole />)
    const user = userEvent.setup()

    await user.selectOptions(screen.getByLabelText(/endpoint/i), 'fhir-read')
    await user.click(screen.getByRole('button', { name: /send/i }))

    expect(
      await screen.findByText(/Missing required path parameter: id/i)
    ).toBeInTheDocument()
    expect(sendConsoleRequest).not.toHaveBeenCalled()
  })

  it('rejects a malformed JSON body before sending', async () => {
    render(<ApiConsole />)
    const user = userEvent.setup()

    await user.selectOptions(
      screen.getByLabelText(/endpoint/i),
      'admin-users-create'
    )
    // fireEvent rather than user.type: user-event reads `{` as the start of a
    // key descriptor, so typing raw JSON-ish text needs escaping.
    const body = screen.getByLabelText(/request body/i)
    fireEvent.change(body, { target: { value: '{ not json' } })
    await user.click(screen.getByRole('button', { name: /send/i }))

    expect(
      await screen.findByText(/Request body is not valid JSON/i)
    ).toBeInTheDocument()
    expect(sendConsoleRequest).not.toHaveBeenCalled()
  })

  it('confirms before running a destructive request', async () => {
    render(<ApiConsole />)
    const user = userEvent.setup()

    await user.selectOptions(screen.getByLabelText(/endpoint/i), 'fhir-delete')
    await user.type(screen.getByLabelText(/path parameter: id/i), 'abc-123')
    await user.click(screen.getByRole('button', { name: /^send$/i }))

    expect(
      await screen.findByText(/Confirm destructive request/i)
    ).toBeInTheDocument()
    expect(sendConsoleRequest).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /send request/i }))
    await waitFor(() => expect(sendConsoleRequest).toHaveBeenCalled())
  })

  it('records completed requests in the history list', async () => {
    render(<ApiConsole />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /send/i }))

    expect(await screen.findByText('Recent requests')).toBeInTheDocument()
  })
})
