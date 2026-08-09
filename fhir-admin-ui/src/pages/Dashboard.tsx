import { useNavigate } from 'react-router-dom'
import {
  Users,
  Activity,
  FileText,
  Stethoscope,
  FlaskConical,
  ClipboardList,
} from 'lucide-react'
import { useStats } from '../api/hooks'
import { useSyntheaJobs } from '../api/hooks'
import { ResourceCount } from '../components/shared/ResourceCount'
import { FullPageSpinner } from '../components/ui/Spinner'
import { ErrorAlert } from '../components/shared/ErrorAlert'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { useAuth } from '../context/AuthContext'
import type { SyntheaJob } from '../types'

const resourceIcons: Record<string, React.ReactNode> = {
  Patient: <Users className="h-6 w-6" />,
  Observation: <Activity className="h-6 w-6" />,
  Encounter: <Stethoscope className="h-6 w-6" />,
  Condition: <FileText className="h-6 w-6" />,
  Procedure: <ClipboardList className="h-6 w-6" />,
  MedicationRequest: <FlaskConical className="h-6 w-6" />,
}

function jobStatusBadge(status: SyntheaJob['status']) {
  const map = {
    PENDING: 'warning' as const,
    RUNNING: 'info' as const,
    COMPLETED: 'success' as const,
    FAILED: 'danger' as const,
  }
  return <Badge variant={map[status]}>{status}</Badge>
}

export function Dashboard() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const { data: stats, isLoading, error, refetch } = useStats()
  const { data: jobs } = useSyntheaJobs()

  if (isLoading) return <FullPageSpinner />
  if (error)
    return (
      <ErrorAlert
        message="Failed to load statistics"
        onRetry={() => refetch()}
      />
    )

  const recentJobs = (jobs ?? []).slice(0, 5)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">
            FHIR R4 Server Resource Overview
            {stats &&
              ` \u2014 ${stats.totalResources.toLocaleString()} total resources`}
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button size="sm" onClick={() => navigate('/synthea')}>
              <FlaskConical className="h-4 w-4" />
              Generate Data
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/patients')}
          >
            <Users className="h-4 w-4" />
            Browse Patients
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats &&
          Object.entries(stats.resourceCounts).map(([type, count]) => (
            <ResourceCount
              key={type}
              label={type}
              count={count}
              icon={
                resourceIcons[type] || <FileText className="h-6 w-6" />
              }
            />
          ))}
      </div>

      {recentJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Synthea Jobs</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {recentJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between px-6 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {job.city}, {job.state} &mdash; {job.populationSize}{' '}
                      patients
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(job.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {job.resourcesImported > 0 && (
                      <span className="text-xs text-slate-500">
                        {job.resourcesImported} resources
                      </span>
                    )}
                    {jobStatusBadge(job.status)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
