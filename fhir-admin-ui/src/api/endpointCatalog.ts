/**
 * Catalog of every endpoint the platform exposes, used to drive the API Console.
 *
 * FHIR CRUD is modelled as five operations with a {resourceType} placeholder
 * rather than five entries per resource type, so adding a resource type on the
 * backend needs no change here.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

/** Who may call the endpoint, per SecurityConfig. */
export type AuthRequirement = 'public' | 'admin'

export interface EndpointParam {
  name: string
  /** Shown as placeholder text; not enforced. */
  example?: string
  description?: string
}

export interface EndpointDef {
  id: string
  group: string
  label: string
  method: HttpMethod
  /** May contain {resourceType} and {id} placeholders. */
  pathTemplate: string
  /** True when {resourceType} should be bound to the resource-type dropdown. */
  usesResourceType?: boolean
  pathParams?: EndpointParam[]
  queryParams?: EndpointParam[]
  bodyTemplate?: string
  auth: AuthRequirement
  description: string
  /** Destructive operations get a confirmation step in the console. */
  destructive?: boolean
}

/** Resource types served by the FHIR endpoint (one provider each). */
export const FHIR_RESOURCE_TYPES = [
  'Patient',
  'Practitioner',
  'Organization',
  'Encounter',
  'Condition',
  'Observation',
  'MedicationRequest',
  'AllergyIntolerance',
  'Immunization',
  'Procedure',
  'DiagnosticReport',
  'CarePlan',
  'Claim',
  'Coverage',
  'ExplanationOfBenefit',
] as const

const PATIENT_BODY = JSON.stringify(
  {
    resourceType: 'Patient',
    name: [{ family: 'Doe', given: ['John'] }],
    gender: 'male',
    birthDate: '1985-06-15',
  },
  null,
  2
)

/**
 * Paging params are supported by every FHIR search. Defaults live in
 * BaseMongoResourceProvider (page size 20, capped at 200).
 */
const PAGING_PARAMS: EndpointParam[] = [
  { name: '_count', example: '20', description: 'Page size (max 200)' },
  { name: '_offset', example: '0', description: 'Rows to skip' },
]

export const ENDPOINTS: EndpointDef[] = [
  // ── FHIR ──
  {
    id: 'fhir-search',
    group: 'FHIR',
    label: 'Search resources',
    method: 'GET',
    pathTemplate: '/fhir/{resourceType}',
    usesResourceType: true,
    queryParams: PAGING_PARAMS,
    auth: 'public',
    description:
      'Search a resource type. Patient also supports family, given, identifier and birthdate; Observation supports patient, code, date and category.',
  },
  {
    id: 'fhir-read',
    group: 'FHIR',
    label: 'Read resource by id',
    method: 'GET',
    pathTemplate: '/fhir/{resourceType}/{id}',
    usesResourceType: true,
    pathParams: [{ name: 'id', description: 'Resource logical id' }],
    auth: 'public',
    description: 'Fetch a single resource. Returns 404 if it does not exist.',
  },
  {
    id: 'fhir-create',
    group: 'FHIR',
    label: 'Create resource',
    method: 'POST',
    pathTemplate: '/fhir/{resourceType}',
    usesResourceType: true,
    bodyTemplate: PATIENT_BODY,
    auth: 'public',
    description:
      'Create a resource. The server assigns the id; any id in the body is replaced.',
  },
  {
    id: 'fhir-update',
    group: 'FHIR',
    label: 'Update resource',
    method: 'PUT',
    pathTemplate: '/fhir/{resourceType}/{id}',
    usesResourceType: true,
    pathParams: [{ name: 'id', description: 'Resource logical id' }],
    bodyTemplate: PATIENT_BODY,
    auth: 'public',
    description: 'Replace a resource and increment its version.',
  },
  {
    id: 'fhir-delete',
    group: 'FHIR',
    label: 'Delete resource',
    method: 'DELETE',
    pathTemplate: '/fhir/{resourceType}/{id}',
    usesResourceType: true,
    pathParams: [{ name: 'id', description: 'Resource logical id' }],
    auth: 'public',
    description: 'Permanently delete a resource.',
    destructive: true,
  },
  {
    id: 'fhir-metadata',
    group: 'FHIR',
    label: 'CapabilityStatement',
    method: 'GET',
    pathTemplate: '/fhir/metadata',
    auth: 'public',
    description: 'Server conformance statement. Useful as a liveness check.',
  },

  // ── Auth ──
  {
    id: 'auth-login',
    group: 'Auth',
    label: 'Login',
    method: 'POST',
    pathTemplate: '/api/auth/login',
    bodyTemplate: JSON.stringify({ username: 'admin', password: 'admin' }, null, 2),
    auth: 'public',
    description:
      'Exchange credentials for a JWT. The only public endpoint under /api/auth.',
  },
  {
    id: 'auth-register',
    group: 'Auth',
    label: 'Register user',
    method: 'POST',
    pathTemplate: '/api/auth/register',
    bodyTemplate: JSON.stringify(
      { username: 'newuser', password: 'changeme', role: 'READONLY' },
      null,
      2
    ),
    auth: 'admin',
    description:
      'Admin-only. Was previously public and honoured any requested role, which allowed privilege escalation.',
  },

  // ── Admin ──
  {
    id: 'admin-stats',
    group: 'Admin',
    label: 'Resource statistics',
    method: 'GET',
    pathTemplate: '/api/admin/stats',
    auth: 'admin',
    description: 'Per-type resource counts plus a total.',
  },
  {
    id: 'admin-users-list',
    group: 'Admin',
    label: 'List users',
    method: 'GET',
    pathTemplate: '/api/admin/users',
    auth: 'admin',
    description: 'All user accounts. Passwords are never returned.',
  },
  {
    id: 'admin-users-create',
    group: 'Admin',
    label: 'Create user',
    method: 'POST',
    pathTemplate: '/api/admin/users',
    bodyTemplate: JSON.stringify(
      { username: 'newuser', password: 'changeme', role: 'READONLY' },
      null,
      2
    ),
    auth: 'admin',
    description:
      'Roles: ADMIN, PRACTITIONER, READONLY. Returns 409 for a duplicate username and 400 for an unknown role.',
  },
  {
    id: 'admin-users-get',
    group: 'Admin',
    label: 'Get user by id',
    method: 'GET',
    pathTemplate: '/api/admin/users/{id}',
    pathParams: [{ name: 'id', description: 'Mongo ObjectId string' }],
    auth: 'admin',
    description: 'Fetch a single account.',
  },
  {
    id: 'admin-users-update',
    group: 'Admin',
    label: 'Update user',
    method: 'PUT',
    pathTemplate: '/api/admin/users/{id}',
    pathParams: [{ name: 'id', description: 'Mongo ObjectId string' }],
    bodyTemplate: JSON.stringify({ role: 'READONLY', enabled: true }, null, 2),
    auth: 'admin',
    description: 'Change role, enabled state, or password. Omitted fields are left alone.',
  },
  {
    id: 'admin-users-delete',
    group: 'Admin',
    label: 'Delete user',
    method: 'DELETE',
    pathTemplate: '/api/admin/users/{id}',
    pathParams: [{ name: 'id', description: 'Mongo ObjectId string' }],
    auth: 'admin',
    description: 'Permanently delete an account.',
    destructive: true,
  },

  // ── Synthea ──
  {
    id: 'synthea-generate',
    group: 'Synthea',
    label: 'Generate data',
    method: 'POST',
    pathTemplate: '/api/admin/synthea/generate',
    bodyTemplate: JSON.stringify(
      { populationSize: 5, state: 'Massachusetts', city: 'Boston' },
      null,
      2
    ),
    auth: 'admin',
    description:
      'Starts generation and returns a job id immediately; the work runs in the background.',
  },
  {
    id: 'synthea-jobs',
    group: 'Synthea',
    label: 'List jobs',
    method: 'GET',
    pathTemplate: '/api/admin/synthea/jobs',
    auth: 'admin',
    description: 'All generation jobs and their status.',
  },
  {
    id: 'synthea-job',
    group: 'Synthea',
    label: 'Get job by id',
    method: 'GET',
    pathTemplate: '/api/admin/synthea/jobs/{id}',
    pathParams: [{ name: 'id', description: 'Job id from the generate call' }],
    auth: 'admin',
    description: 'Poll a single job. On failure, errorMessage carries Synthea output.',
  },
]

export const ENDPOINT_GROUPS = Array.from(new Set(ENDPOINTS.map((e) => e.group)))

/** Substitutes {resourceType} and path params, then appends the query string. */
export function buildUrl(
  endpoint: EndpointDef,
  resourceType: string,
  pathValues: Record<string, string>,
  queryValues: Array<{ key: string; value: string }>
): string {
  let path = endpoint.pathTemplate.replace('{resourceType}', resourceType)

  for (const [key, value] of Object.entries(pathValues)) {
    path = path.replace(`{${key}}`, encodeURIComponent(value))
  }

  const pairs = queryValues.filter((p) => p.key.trim() !== '')
  if (pairs.length === 0) return path

  const qs = pairs
    .map(
      (p) => `${encodeURIComponent(p.key.trim())}=${encodeURIComponent(p.value)}`
    )
    .join('&')

  return `${path}?${qs}`
}
