import axios from 'axios'
import type { HttpMethod } from './endpointCatalog'

/**
 * HTTP client for the API Console.
 *
 * Deliberately separate from the shared `apiClient`, for two reasons:
 *
 * 1. `apiClient` clears credentials and redirects to /login on any 401. A
 *    console exists partly to *provoke* 401s, so reusing it would sign the
 *    operator out mid-session the first time they tested an unauthenticated
 *    call.
 * 2. `validateStatus` accepts every status, so 4xx and 5xx resolve normally and
 *    the response panel can render the error body instead of throwing.
 */
const consoleClient = axios.create({
  baseURL: '',
  validateStatus: () => true,
  // Keep the raw text so the panel can show non-JSON responses verbatim
  // (FHIR OperationOutcome, HTML error pages, empty bodies) without axios
  // silently swallowing a parse failure.
  transformResponse: [(data) => data],
})

export interface ConsoleResponse {
  status: number
  statusText: string
  durationMs: number
  headers: Record<string, string>
  /** Pretty-printed when the payload parses as JSON, otherwise raw. */
  body: string
  isJson: boolean
  sizeBytes: number
}

export interface ConsoleRequest {
  method: HttpMethod
  url: string
  body?: string
  sendAuth: boolean
}

function prettify(raw: unknown): { body: string; isJson: boolean } {
  if (raw === null || raw === undefined || raw === '') {
    return { body: '(empty response body)', isJson: false }
  }
  const text = typeof raw === 'string' ? raw : String(raw)
  try {
    return { body: JSON.stringify(JSON.parse(text), null, 2), isJson: true }
  } catch {
    return { body: text, isJson: false }
  }
}

export async function sendConsoleRequest(
  req: ConsoleRequest
): Promise<ConsoleResponse> {
  const headers: Record<string, string> = {}

  if (req.sendAuth) {
    const token = localStorage.getItem('auth_token')
    if (token) headers.Authorization = `Bearer ${token}`
  }

  const hasBody = req.method === 'POST' || req.method === 'PUT'
  if (hasBody && req.body) headers['Content-Type'] = 'application/json'

  const started = performance.now()
  const res = await consoleClient.request({
    method: req.method,
    url: req.url,
    headers,
    data: hasBody && req.body ? req.body : undefined,
  })
  const durationMs = Math.round(performance.now() - started)

  const { body, isJson } = prettify(res.data)

  const flatHeaders: Record<string, string> = {}
  Object.entries(res.headers ?? {}).forEach(([k, v]) => {
    flatHeaders[k] = Array.isArray(v) ? v.join(', ') : String(v)
  })

  return {
    status: res.status,
    statusText: res.statusText ?? '',
    durationMs,
    headers: flatHeaders,
    body,
    isJson,
    sizeBytes: new Blob([typeof res.data === 'string' ? res.data : '']).size,
  }
}

/** Renders the request as a copyable curl command. */
export function toCurl(req: ConsoleRequest, origin: string): string {
  const parts = [`curl -X ${req.method} "${origin}${req.url}"`]
  if (req.sendAuth) parts.push(`  -H "Authorization: Bearer <token>"`)
  if ((req.method === 'POST' || req.method === 'PUT') && req.body) {
    parts.push(`  -H "Content-Type: application/json"`)
    parts.push(`  -d '${req.body.replace(/\n\s*/g, '')}'`)
  }
  return parts.join(' \\\n')
}
