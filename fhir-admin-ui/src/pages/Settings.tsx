import { useQuery } from '@tanstack/react-query'
import apiClient from '../api/client'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { FullPageSpinner } from '../components/ui/Spinner'
import { ErrorAlert } from '../components/shared/ErrorAlert'
import type { FhirResource } from '../types'

interface RestResource {
  type: string
  interaction?: Array<{ code: string }>
  searchParam?: Array<{ name: string; type: string }>
}

interface RestEntry {
  mode: string
  resource?: RestResource[]
}

export function Settings() {
  const {
    data: capability,
    isLoading,
    error,
    refetch,
  } = useQuery<FhirResource>({
    queryKey: ['capability-statement'],
    queryFn: async () => {
      const res = await apiClient.get<FhirResource>('/fhir/metadata')
      return res.data
    },
  })

  if (isLoading) return <FullPageSpinner />
  if (error)
    return (
      <ErrorAlert
        message="Failed to load server capabilities"
        onRetry={() => refetch()}
      />
    )

  const fhirVersion = (capability?.fhirVersion as string) ?? 'Unknown'
  const status = (capability?.status as string) ?? 'Unknown'
  const publisher = (capability?.publisher as string) ?? 'Unknown'
  const rest = (capability?.rest as RestEntry[]) ?? []
  const serverRest = rest.find((r) => r.mode === 'server')
  const resources = serverRest?.resource ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Server Settings</h1>
        <p className="text-sm text-slate-500">
          FHIR server capability statement and configuration
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="py-5">
            <p className="text-sm text-slate-500">FHIR Version</p>
            <p className="text-xl font-bold text-slate-900">{fhirVersion}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <p className="text-sm text-slate-500">Status</p>
            <p className="text-xl font-bold text-slate-900 capitalize">{status}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <p className="text-sm text-slate-500">Publisher</p>
            <p className="text-xl font-bold text-slate-900">{publisher}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Supported Resources ({resources.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {resources.map((res) => (
              <div key={res.type} className="px-6 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-900">
                    {res.type}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {(res.interaction ?? []).map((i) => (
                      <Badge key={i.code} variant="default">
                        {i.code}
                      </Badge>
                    ))}
                  </div>
                </div>
                {res.searchParam && res.searchParam.length > 0 && (
                  <p className="mt-1 text-xs text-slate-500">
                    Search params:{' '}
                    {res.searchParam.map((sp) => sp.name).join(', ')}
                  </p>
                )}
              </div>
            ))}
            {resources.length === 0 && (
              <p className="px-6 py-8 text-center text-sm text-slate-500">
                No resource information available
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
