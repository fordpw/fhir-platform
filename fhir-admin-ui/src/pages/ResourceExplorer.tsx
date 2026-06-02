import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  useFhirSearch,
  useCreateResource,
  useUpdateResource,
  useDeleteResource,
} from '../api/hooks'
import { SearchBar } from '../components/shared/SearchBar'
import { Pagination } from '../components/shared/Pagination'
import { EmptyState } from '../components/shared/EmptyState'
import { ErrorAlert } from '../components/shared/ErrorAlert'
import { FullPageSpinner } from '../components/ui/Spinner'
import { Dialog } from '../components/ui/Dialog'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { Textarea } from '../components/ui/Textarea'
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableHeaderCell,
} from '../components/ui/Table'
import { Plus, Eye, Pencil, Trash2 } from 'lucide-react'
import type { FhirResource } from '../types'

const RESOURCE_TYPES = [
  'Patient',
  'Observation',
  'Encounter',
  'Condition',
  'Procedure',
  'MedicationRequest',
  'DiagnosticReport',
  'Immunization',
  'AllergyIntolerance',
  'CarePlan',
  'Practitioner',
  'Organization',
]

export function ResourceExplorer() {
  const [resourceType, setResourceType] = useState('Patient')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const [viewResource, setViewResource] = useState<FhirResource | null>(null)
  const [editMode, setEditMode] = useState<'create' | 'edit' | null>(null)
  const [editJson, setEditJson] = useState('')
  const [editId, setEditId] = useState('')
  const [jsonError, setJsonError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<FhirResource | null>(null)

  const params = useMemo(() => {
    const p: Record<string, string> = {}
    if (search) p['_content'] = search
    return p
  }, [search])

  const { data, isLoading, error, refetch } = useFhirSearch(resourceType, params, page)
  const createMut = useCreateResource()
  const updateMut = useUpdateResource()
  const deleteMut = useDeleteResource()

  const resources = useMemo(
    () =>
      (data?.entry ?? [])
        .map((e) => e.resource)
        .filter((r): r is FhirResource => !!r),
    [data]
  )

  const total = data?.total ?? 0

  const openCreate = () => {
    setEditMode('create')
    setEditJson(
      JSON.stringify({ resourceType, ...({} as Record<string, unknown>) }, null, 2)
    )
    setEditId('')
    setJsonError('')
  }

  const openEdit = (resource: FhirResource) => {
    setEditMode('edit')
    setEditJson(JSON.stringify(resource, null, 2))
    setEditId(resource.id ?? '')
    setJsonError('')
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    setJsonError('')
    let parsed: FhirResource
    try {
      parsed = JSON.parse(editJson) as FhirResource
    } catch {
      setJsonError('Invalid JSON')
      return
    }

    try {
      if (editMode === 'create') {
        await createMut.mutateAsync({ resourceType, resource: parsed })
      } else if (editMode === 'edit') {
        await updateMut.mutateAsync({
          resourceType,
          id: editId,
          resource: parsed,
        })
      }
      setEditMode(null)
      refetch()
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : 'Save failed')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget?.id) return
    try {
      await deleteMut.mutateAsync({
        resourceType: deleteTarget.resourceType,
        id: deleteTarget.id,
      })
      setDeleteTarget(null)
      refetch()
    } catch {
      // error handled by mutation state
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Resource Explorer</h1>
          <p className="text-sm text-slate-500">Browse and manage FHIR resources</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Create
        </Button>
      </div>

      <div className="flex gap-3">
        <div className="w-48">
          <Select
            value={resourceType}
            onChange={(e) => {
              setResourceType(e.target.value)
              setPage(0)
              setSearch('')
            }}
          >
            {RESOURCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex-1">
          <SearchBar
            value={search}
            onChange={(v) => {
              setSearch(v)
              setPage(0)
            }}
            placeholder={`Search ${resourceType}...`}
          />
        </div>
      </div>

      {isLoading && <FullPageSpinner />}
      {error && (
        <ErrorAlert message="Failed to load resources" onRetry={() => refetch()} />
      )}

      {!isLoading && !error && resources.length === 0 && (
        <EmptyState title="No resources found" description="Try a different search or resource type" />
      )}

      {!isLoading && resources.length > 0 && (
        <>
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <Table>
              <TableHead>
                <tr>
                  <TableHeaderCell>ID</TableHeaderCell>
                  <TableHeaderCell>Type</TableHeaderCell>
                  <TableHeaderCell>Last Updated</TableHeaderCell>
                  <TableHeaderCell>Actions</TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {resources.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.id}</TableCell>
                    <TableCell>{r.resourceType}</TableCell>
                    <TableCell className="text-xs">
                      {r.meta?.lastUpdated
                        ? new Date(r.meta.lastUpdated).toLocaleString()
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewResource(r)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(r)}
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
          <Pagination page={page} total={total} pageSize={20} onPageChange={setPage} />
        </>
      )}

      {/* View dialog */}
      <Dialog
        open={viewResource !== null}
        onClose={() => setViewResource(null)}
        title={`${viewResource?.resourceType}/${viewResource?.id ?? ''}`}
        className="max-w-2xl"
      >
        {viewResource && (
          <pre className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-4 text-xs font-mono">
            {JSON.stringify(viewResource, null, 2)}
          </pre>
        )}
      </Dialog>

      {/* Create / Edit dialog */}
      <Dialog
        open={editMode !== null}
        onClose={() => setEditMode(null)}
        title={editMode === 'create' ? `Create ${resourceType}` : `Edit ${resourceType}/${editId}`}
        className="max-w-2xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {jsonError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {jsonError}
            </div>
          )}
          <Textarea
            value={editJson}
            onChange={(e) => setEditJson(e.target.value)}
            rows={16}
            className="min-h-[300px]"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setEditMode(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMut.isPending || updateMut.isPending}
            >
              {createMut.isPending || updateMut.isPending ? 'Saving...' : 'Save'}
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
          Are you sure you want to delete{' '}
          <span className="font-medium">
            {deleteTarget?.resourceType}/{deleteTarget?.id}
          </span>
          ? This action cannot be undone.
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
