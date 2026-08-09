import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Send, Trash2, Plus, Copy, ShieldAlert, History } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Textarea } from '../components/ui/Textarea'
import { Badge } from '../components/ui/Badge'
import { Dialog } from '../components/ui/Dialog'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import {
  ENDPOINTS,
  ENDPOINT_GROUPS,
  FHIR_RESOURCE_TYPES,
  buildUrl,
} from '../api/endpointCatalog'
import type { EndpointDef } from '../api/endpointCatalog'
import { sendConsoleRequest, toCurl } from '../api/consoleClient'
import type { ConsoleResponse } from '../api/consoleClient'

interface QueryPair {
  key: string
  value: string
}

interface HistoryEntry {
  method: string
  url: string
  status: number
  durationMs: number
}

function statusVariant(status: number) {
  if (status >= 200 && status < 300) return 'success' as const
  if (status >= 400 && status < 500) return 'warning' as const
  if (status >= 500) return 'danger' as const
  return 'info' as const
}

export function ApiConsole() {
  const [endpointId, setEndpointId] = useState(ENDPOINTS[0].id)
  const endpoint = useMemo(
    () => ENDPOINTS.find((e) => e.id === endpointId) as EndpointDef,
    [endpointId]
  )

  const [resourceType, setResourceType] = useState<string>(FHIR_RESOURCE_TYPES[0])
  const [pathValues, setPathValues] = useState<Record<string, string>>({})
  const [queryPairs, setQueryPairs] = useState<QueryPair[]>([])
  const [body, setBody] = useState('')
  const [sendAuth, setSendAuth] = useState(true)

  const [response, setResponse] = useState<ConsoleResponse | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [showHeaders, setShowHeaders] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])

  // Reset the form whenever the selected endpoint changes, seeding defaults
  // from the catalog so the request is runnable immediately.
  useEffect(() => {
    setPathValues({})
    setBody(endpoint.bodyTemplate ?? '')
    setQueryPairs(
      (endpoint.queryParams ?? []).map((p) => ({
        key: p.name,
        value: p.example ?? '',
      }))
    )
    setResponse(null)
    setError('')
  }, [endpoint])

  const url = buildUrl(endpoint, resourceType, pathValues, queryPairs)
  const takesBody = endpoint.method === 'POST' || endpoint.method === 'PUT'

  const missingPathParams = (endpoint.pathParams ?? []).filter(
    (p) => !(pathValues[p.name] ?? '').trim()
  )

  const execute = async () => {
    setSending(true)
    setError('')
    try {
      if (takesBody && body.trim()) {
        try {
          JSON.parse(body)
        } catch {
          setError('Request body is not valid JSON')
          setSending(false)
          return
        }
      }

      const res = await sendConsoleRequest({
        method: endpoint.method,
        url,
        body: takesBody ? body : undefined,
        sendAuth,
      })
      setResponse(res)
      setHistory((h) =>
        [
          { method: endpoint.method, url, status: res.status, durationMs: res.durationMs },
          ...h,
        ].slice(0, 10)
      )
    } catch (err) {
      // Only genuine network/CORS failures reach here; HTTP errors resolve
      // normally because the console client accepts every status.
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setSending(false)
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (missingPathParams.length > 0) {
      setError(`Missing required path parameter: ${missingPathParams[0].name}`)
      return
    }
    if (endpoint.destructive) {
      setConfirmOpen(true)
      return
    }
    void execute()
  }

  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">API Console</h1>
        <p className="text-sm text-slate-500">
          Invoke any platform endpoint and inspect the raw response
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Request ── */}
        <Card>
          <CardHeader>
            <CardTitle>Request</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Select
                id="endpoint"
                label="Endpoint"
                value={endpointId}
                onChange={(e) => setEndpointId(e.target.value)}
              >
                {ENDPOINT_GROUPS.map((group) => (
                  <optgroup key={group} label={group}>
                    {ENDPOINTS.filter((e) => e.group === group).map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.method} — {e.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>

              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                <p className="text-xs text-slate-600">{endpoint.description}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant={endpoint.auth === 'admin' ? 'info' : 'default'}>
                    {endpoint.auth === 'admin' ? 'Requires ADMIN' : 'Public'}
                  </Badge>
                  {endpoint.destructive && (
                    <Badge variant="danger">Destructive</Badge>
                  )}
                </div>
              </div>

              {endpoint.usesResourceType && (
                <Select
                  id="resourceType"
                  label="Resource type"
                  value={resourceType}
                  onChange={(e) => setResourceType(e.target.value)}
                >
                  {FHIR_RESOURCE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              )}

              {(endpoint.pathParams ?? []).map((p) => (
                <Input
                  key={p.name}
                  id={`path-${p.name}`}
                  label={`Path parameter: ${p.name}`}
                  value={pathValues[p.name] ?? ''}
                  placeholder={p.description}
                  onChange={(e) =>
                    setPathValues((v) => ({ ...v, [p.name]: e.target.value }))
                  }
                />
              ))}

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700">
                    Query parameters
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setQueryPairs((p) => [...p, { key: '', value: '' }])
                    }
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {queryPairs.length === 0 && (
                    <p className="text-xs text-slate-400">None</p>
                  )}
                  {queryPairs.map((pair, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        className="w-2/5 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        placeholder="name"
                        value={pair.key}
                        onChange={(e) =>
                          setQueryPairs((p) =>
                            p.map((q, j) =>
                              j === i ? { ...q, key: e.target.value } : q
                            )
                          )
                        }
                      />
                      <input
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        placeholder="value"
                        value={pair.value}
                        onChange={(e) =>
                          setQueryPairs((p) =>
                            p.map((q, j) =>
                              j === i ? { ...q, value: e.target.value } : q
                            )
                          )
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setQueryPairs((p) => p.filter((_, j) => j !== i))
                        }
                      >
                        <Trash2 className="h-4 w-4 text-slate-400" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {takesBody && (
                <div>
                  <label
                    htmlFor="req-body"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Request body (JSON)
                  </label>
                  <Textarea
                    id="req-body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={10}
                    className="font-mono text-xs"
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="send-auth"
                  checked={sendAuth}
                  onChange={(e) => setSendAuth(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="send-auth" className="text-sm text-slate-700">
                  Send Authorization header
                </label>
              </div>

              {!sendAuth && endpoint.auth === 'admin' && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    This endpoint requires ADMIN. Without the header it should be
                    rejected — useful for confirming access control.
                  </span>
                </div>
              )}

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="rounded-lg bg-slate-900 px-3 py-2 font-mono text-xs text-slate-100 break-all">
                <span className="text-emerald-400">{endpoint.method}</span> {url}
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={sending}>
                  <Send className="h-4 w-4" />
                  {sending ? 'Sending...' : 'Send'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    copy(
                      toCurl(
                        {
                          method: endpoint.method,
                          url,
                          body: takesBody ? body : undefined,
                          sendAuth,
                        },
                        window.location.origin
                      )
                    )
                  }
                >
                  <Copy className="h-4 w-4" />
                  Copy as curl
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* ── Response ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Response</CardTitle>
              {response && (
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant(response.status)}>
                    {response.status} {response.statusText}
                  </Badge>
                  <span className="text-xs text-slate-500">
                    {response.durationMs} ms
                  </span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!response && (
              <p className="py-8 text-center text-sm text-slate-400">
                Send a request to see the response
              </p>
            )}

            {response && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setShowHeaders((s) => !s)}
                    className="text-xs font-medium text-blue-600 hover:underline"
                  >
                    {showHeaders ? 'Hide' : 'Show'} response headers
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copy(response.body)}
                  >
                    <Copy className="h-4 w-4" />
                    Copy
                  </Button>
                </div>

                {showHeaders && (
                  <pre className="max-h-40 overflow-auto rounded-lg bg-slate-50 p-3 text-xs font-mono text-slate-600">
                    {Object.entries(response.headers)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join('\n')}
                  </pre>
                )}

                <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-4 text-xs font-mono">
                  {response.body}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="inline-flex items-center gap-2">
                <History className="h-4 w-4" />
                Recent requests
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {history.map((h, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-6 py-2 text-xs"
                >
                  <span className="font-mono text-slate-600 break-all">
                    <span className="font-semibold text-slate-900">{h.method}</span>{' '}
                    {h.url}
                  </span>
                  <span className="ml-4 flex shrink-0 items-center gap-2">
                    <Badge variant={statusVariant(h.status)}>{h.status}</Badge>
                    <span className="text-slate-400">{h.durationMs} ms</span>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirm destructive request"
      >
        <p className="text-sm text-slate-600">
          This will run{' '}
          <span className="font-mono font-medium">
            {endpoint.method} {url}
          </span>{' '}
          against the live database. This cannot be undone.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setConfirmOpen(false)
              void execute()
            }}
          >
            Send request
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
