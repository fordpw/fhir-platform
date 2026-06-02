import { useMemo, useState } from 'react'
import { useFhirSearch } from '../api/hooks'
import { SearchBar } from '../components/shared/SearchBar'
import { Pagination } from '../components/shared/Pagination'
import { EmptyState } from '../components/shared/EmptyState'
import { ErrorAlert } from '../components/shared/ErrorAlert'
import { FullPageSpinner } from '../components/ui/Spinner'
import { Dialog } from '../components/ui/Dialog'
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableHeaderCell,
} from '../components/ui/Table'
import { Button } from '../components/ui/Button'
import { Eye } from 'lucide-react'
import type { FhirResource, PatientSummary } from '../types'

function extractPatient(resource: FhirResource): PatientSummary {
  const names = (resource.name as Array<{ given?: string[]; family?: string }>) ?? []
  const first = names[0]
  const givenName = first?.given?.join(' ') ?? ''
  const familyName = first?.family ?? ''
  const ids = (resource.identifier as Array<{ value?: string }>) ?? []
  return {
    id: resource.id ?? '',
    fullName: `${givenName} ${familyName}`.trim() || 'Unknown',
    givenName,
    familyName,
    birthDate: (resource.birthDate as string) ?? '',
    gender: (resource.gender as string) ?? '',
    identifier: ids[0]?.value ?? '',
    resource,
  }
}

export function Patients() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<PatientSummary | null>(null)

  const params = useMemo(() => {
    const p: Record<string, string> = {}
    if (search) p['name'] = search
    return p
  }, [search])

  const { data, isLoading, error, refetch } = useFhirSearch('Patient', params, page)

  const patients = useMemo(
    () =>
      (data?.entry ?? [])
        .map((e) => e.resource)
        .filter((r): r is FhirResource => !!r)
        .map(extractPatient),
    [data]
  )

  const total = data?.total ?? 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Patients</h1>
          <p className="text-sm text-slate-500">
            Browse and search patient records
          </p>
        </div>
      </div>

      <SearchBar
        value={search}
        onChange={(v) => {
          setSearch(v)
          setPage(0)
        }}
        placeholder="Search by patient name..."
      />

      {isLoading && <FullPageSpinner />}

      {error && (
        <ErrorAlert
          message="Failed to load patients"
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !error && patients.length === 0 && (
        <EmptyState
          title="No patients found"
          description={
            search ? 'Try a different search term' : 'No patient data available'
          }
        />
      )}

      {!isLoading && patients.length > 0 && (
        <>
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <Table>
              <TableHead>
                <tr>
                  <TableHeaderCell>Name</TableHeaderCell>
                  <TableHeaderCell>DOB</TableHeaderCell>
                  <TableHeaderCell>Gender</TableHeaderCell>
                  <TableHeaderCell>Identifier</TableHeaderCell>
                  <TableHeaderCell>Actions</TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {patients.map((patient) => (
                  <TableRow key={patient.id}>
                    <TableCell className="font-medium text-slate-900">
                      {patient.fullName}
                    </TableCell>
                    <TableCell>{patient.birthDate}</TableCell>
                    <TableCell className="capitalize">{patient.gender}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {patient.identifier}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelected(patient)}
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Pagination
            page={page}
            total={total}
            pageSize={20}
            onPageChange={setPage}
          />
        </>
      )}

      <Dialog
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.fullName ?? 'Patient Detail'}
        className="max-w-2xl"
      >
        {selected && (
          <div className="max-h-[60vh] overflow-y-auto">
            <pre className="whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-4 text-xs text-slate-800 font-mono">
              {JSON.stringify(selected.resource, null, 2)}
            </pre>
          </div>
        )}
      </Dialog>
    </div>
  )
}
