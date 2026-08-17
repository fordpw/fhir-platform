/**
 * UserManagement.test.tsx
 *
 * Covers:
 *  - User list renders username, role badge, and status badge
 *  - Create User dialog opens and submits
 *  - Delete confirmation dialog opens
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserManagement } from '../pages/UserManagement'

const mockUsers = [
  { id: '1', username: 'admin', role: 'ADMIN',      enabled: true,  createdAt: '2026-01-01T00:00:00Z' },
  { id: '2', username: 'nurse', role: 'PRACTITIONER', enabled: true,  createdAt: '2026-01-02T00:00:00Z' },
  { id: '3', username: 'guest', role: 'READONLY',   enabled: false, createdAt: '2026-01-03T00:00:00Z' },
]

const createMutate = vi.fn().mockResolvedValue(undefined)
const updateMutate = vi.fn().mockResolvedValue(undefined)
const deleteMutate = vi.fn().mockResolvedValue(undefined)

vi.mock('../api/hooks', () => ({
  useUsers:      () => ({ data: mockUsers, isLoading: false, error: null, refetch: vi.fn() }),
  useCreateUser: () => ({ mutateAsync: createMutate, isPending: false }),
  useUpdateUser: () => ({ mutateAsync: updateMutate, isPending: false }),
  useDeleteUser: () => ({ mutateAsync: deleteMutate, isPending: false }),
}))

function renderPage() {
  return render(<UserManagement />)
}

describe('UserManagement', () => {
  it('renders all users with username, role and status', () => {
    renderPage()
    expect(screen.getByText('admin')).toBeInTheDocument()
    expect(screen.getByText('nurse')).toBeInTheDocument()
    expect(screen.getByText('guest')).toBeInTheDocument()

    expect(screen.getByText('ADMIN')).toBeInTheDocument()
    expect(screen.getByText('PRACTITIONER')).toBeInTheDocument()
    expect(screen.getByText('READONLY')).toBeInTheDocument()

    // Two active, one disabled
    expect(screen.getAllByText('Active')).toHaveLength(2)
    expect(screen.getByText('Disabled')).toBeInTheDocument()
  })

  it('opens the Create User dialog when the button is clicked', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /create user/i }))
    // Dialog component renders a heading, not role="dialog" — confirm the dialog opened
    expect(screen.getByRole('heading', { name: /create user/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^create$/i })).toBeInTheDocument()
  })

  it('calls createUser with form values on submit', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /create user/i }))

    await userEvent.type(screen.getByLabelText(/username/i), 'newuser')
    await userEvent.type(screen.getByLabelText(/password/i), 'secret123')

    await userEvent.click(screen.getByRole('button', { name: /^create$/i }))

    await waitFor(() => {
      expect(createMutate).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'newuser', password: 'secret123' })
      )
    })
  })

  it('opens delete confirmation when the trash icon is clicked', async () => {
    renderPage()
    const trashButtons = screen.getAllByRole('button', { name: '' })
    // The delete buttons render no accessible text; use data-testid alternative:
    // click the second icon button in the first row (Edit, Delete)
    const row = screen.getByText('admin').closest('tr')!
    const deleteBtn = row.querySelectorAll('button')[1]
    await userEvent.click(deleteBtn)

    // The delete confirmation dialog should appear
    expect(screen.getByRole('heading', { name: /confirm delete/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument()
  })
})
