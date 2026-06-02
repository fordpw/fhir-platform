import { useState } from 'react'
import type { FormEvent } from 'react'
import { useSyntheaGenerate, useSyntheaJobs } from '../api/hooks'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { FullPageSpinner } from '../components/ui/Spinner'
import { ErrorAlert } from '../components/shared/ErrorAlert'
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableHeaderCell,
} from '../components/ui/Table'
import { FlaskConical } from 'lucide-react'
import type { SyntheaJob } from '../types'

const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
  'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
  'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
  'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire',
  'New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio',
  'Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota',
  'Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia',
  'Wisconsin','Wyoming',
]

function statusVariant(status: SyntheaJob['status']) {
  const map = {
    PENDING: 'warning' as const,
    RUNNING: 'info' as const,
    COMPLETED: 'success' as const,
    FAILED: 'danger' as const,
  }
  return map[status]
}

export function SyntheaGenerator() {
  const [populationSize, setPopulationSize] = useState(10)
  const [state, setState] = useState('Massachusetts')
  const [city, setCity] = useState('Boston')
  const [formError, setFormError] = useState('')

  const generateMut = useSyntheaGenerate()
  const {
    data: jobs,
    isLoading: jobsLoading,
    error: jobsError,
    refetch,
  } = useSyntheaJobs()

  const hasRunningJobs = (jobs ?? []).some(
    (j) => j.status === 'PENDING' || j.status === 'RUNNING'
  )

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (populationSize < 1 || populationSize > 10000) {
      setFormError('Population size must be between 1 and 10,000')
      return
    }
    try {
      await generateMut.mutateAsync({ populationSize, state, city })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Generation failed')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Synthea Data Generator</h1>
        <p className="text-sm text-slate-500">
          Generate synthetic patient data using Synthea
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate New Data</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {formError}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                id="populationSize"
                label="Population Size"
                type="number"
                min={1}
                max={10000}
                value={populationSize}
                onChange={(e) => setPopulationSize(Number(e.target.value))}
              />
              <Select
                id="state"
                label="State"
                value={state}
                onChange={(e) => setState(e.target.value)}
              >
                {US_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
              <Input
                id="city"
                label="City"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Enter city name"
              />
            </div>
            <Button type="submit" disabled={generateMut.isPending}>
              <FlaskConical className="h-4 w-4" />
              {generateMut.isPending ? 'Starting...' : 'Generate'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Job History</CardTitle>
            {hasRunningJobs && (
              <Badge variant="info">Active jobs running</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {jobsLoading && <FullPageSpinner />}
          {jobsError && (
            <div className="p-4">
              <ErrorAlert
                message="Failed to load jobs"
                onRetry={() => refetch()}
              />
            </div>
          )}
          {!jobsLoading && (jobs ?? []).length === 0 && (
            <p className="px-6 py-8 text-center text-sm text-slate-500">
              No generation jobs yet
            </p>
          )}
          {!jobsLoading && (jobs ?? []).length > 0 && (
            <Table>
              <TableHead>
                <tr>
                  <TableHeaderCell>ID</TableHeaderCell>
                  <TableHeaderCell>Location</TableHeaderCell>
                  <TableHeaderCell>Population</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Resources</TableHeaderCell>
                  <TableHeaderCell>Created</TableHeaderCell>
                  <TableHeaderCell>Completed</TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {(jobs ?? []).map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-mono text-xs">{job.id}</TableCell>
                    <TableCell>
                      {job.city}, {job.state}
                    </TableCell>
                    <TableCell>{job.populationSize}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(job.status)}>
                        {job.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{job.resourcesImported.toLocaleString()}</TableCell>
                    <TableCell className="text-xs">
                      {new Date(job.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs">
                      {job.completedAt
                        ? new Date(job.completedAt).toLocaleString()
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
