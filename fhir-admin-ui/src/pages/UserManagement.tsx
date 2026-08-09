import { useState } from 'react'
import type { FormEvent } from 'react'
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from '../api/hooks'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Badge } from '../components/ui/Badge'
import { Dialog } from '../components/ui/Dialog'
import { FullPageSpinner } from '../components/ui/Spinner'
import { ErrorAlert } from '../components/shared/ErrorAlert'
import { EmptyState } from '../components/shared/EmptyState'
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableHeaderCell,
} from '../components/ui/Table'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import type { AppUser, UserRole } from '../types'
import { USER_ROLES } from '../types'

export function UserManagement() {
  const { data: users, isLoading, error, refetch } = useUsers()
  const createMut = useCreateUser()
  const updateMut = useUpdateUser()
  const deleteMut = useDeleteUser()

  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser] = useState<AppUser | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null)

  // Create form state
  const [createUsername, setCreateUsername] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createRole, setCreateRole] = useState<UserRole>('READONLY')
  const [createError, setCreateError] = useState('')

  // Edit form state
  const [editRole, setEditRole] = useState<UserRole>('READONLY')
  const [editEnabled, setEditEnabled] = useState(true)
  const [editError, setEditError] = useState('')

  const openCreate = () => {
    setCreateUsername('')
    setCreatePassword('')
    setCreateRole('READONLY')
    setCreateError('')
    setShowCreate(true)
  }

  const openEdit = (user: AppUser) => {
    setEditUser(user)
    setEditRole(user.role)
    setEditEnabled(user.enabled)
    setEditError('')
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setCreateError('')
    if (!createUsername || !createPassword) {
      setCreateError('Username and password are required')
      return
    }
    try {
      await createMut.mutateAsync({
        username: createUsername,
        password: createPassword,
        role: createRole,
      })
      setShowCreate(false)
    } catch (err) {
      const apiMessage = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error
      setCreateError(apiMessage ?? 'Failed to create user')
    }
  }

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault()
    if (!editUser) return
    setEditError('')
    try {
      await updateMut.mutateAsync({
        id: editUser.id,
        data: { role: editRole, enabled: editEnabled },
      })
      setEditUser(null)
    } catch (err) {
      const apiMessage = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error
      setEditError(apiMessage ?? 'Failed to update user')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteMut.mutateAsync(deleteTarget.id)
      setDeleteTarget(null)
    } catch {
      // Error handled by mutation state
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
          <p className="text-sm text-slate-500">Manage platform user accounts</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Create User
        </Button>
      </div>

      {isLoading && <FullPageSpinner />}
      {error && (
        <ErrorAlert message="Failed to load users" onRetry={() => refetch()} />
      )}

      {!isLoading && (users ?? []).length === 0 && (
        <EmptyState title="No users" description="Create your first user account" />
      )}

      {!isLoading && (users ?? []).length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell>Username</TableHeaderCell>
                <TableHeaderCell>Role</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Created</TableHeaderCell>
                <TableHeaderCell>Actions</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {(users ?? []).map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium text-slate-900">
                    {user.username}
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.role === 'ADMIN' ? 'info' : 'default'}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.enabled ? 'success' : 'danger'}>
                      {user.enabled ? 'Active' : 'Disabled'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {new Date(user.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(user)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(user)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onClose={() => setShowCreate(false)} title="Create User">
        <form onSubmit={handleCreate} className="space-y-4">
          {createError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {createError}
            </div>
          )}
          <Input
            id="new-username"
            label="Username"
            value={createUsername}
            onChange={(e) => setCreateUsername(e.target.value)}
            required
          />
          <Input
            id="new-password"
            label="Password"
            type="password"
            value={createPassword}
            onChange={(e) => setCreatePassword(e.target.value)}
            required
          />
          <Select
            id="new-role"
            label="Role"
            value={createRole}
            onChange={(e) => setCreateRole(e.target.value as UserRole)}
          >
            {USER_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMut.isPending}>
              {createMut.isPending ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={editUser !== null}
        onClose={() => setEditUser(null)}
        title={`Edit ${editUser?.username ?? ''}`}
      >
        <form onSubmit={handleUpdate} className="space-y-4">
          {editError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {editError}
            </div>
          )}
          <Select
            id="edit-role"
            label="Role"
            value={editRole}
            onChange={(e) => setEditRole(e.target.value as UserRole)}
          >
            {USER_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="edit-enabled"
              checked={editEnabled}
              onChange={(e) => setEditEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="edit-enabled" className="text-sm text-slate-700">
              Account enabled
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setEditUser(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMut.isPending}>
              {updateMut.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Confirm Delete"
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to delete user{' '}
          <span className="font-medium">{deleteTarget?.username}</span>? This
          action cannot be undone.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            disabled={deleteMut.isPending}
          >
            {deleteMut.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
