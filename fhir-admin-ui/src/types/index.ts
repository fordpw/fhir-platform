export interface AppUser {
  id: number
  username: string
  role: 'ADMIN' | 'USER'
  enabled: boolean
  createdAt: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  username: string
  role: 'ADMIN' | 'USER'
}

export interface RegisterRequest {
  username: string
  password: string
  role: 'ADMIN' | 'USER'
}

export interface FhirResource {
  resourceType: string
  id?: string
  meta?: {
    versionId?: string
    lastUpdated?: string
  }
  [key: string]: unknown
}

export interface FhirBundleLink {
  relation: string
  url: string
}

export interface FhirBundleEntry {
  fullUrl?: string
  resource?: FhirResource
  search?: {
    mode?: string
    score?: number
  }
}

export interface FhirBundle {
  resourceType: 'Bundle'
  type: string
  total?: number
  link?: FhirBundleLink[]
  entry?: FhirBundleEntry[]
}

export interface SyntheaJob {
  id: number
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'
  populationSize: number
  state: string
  city: string
  createdAt: string
  completedAt: string | null
  resourcesImported: number
  errorMessage: string | null
}

export interface GenerateRequest {
  populationSize: number
  state: string
  city: string
}

export interface StatsResponse {
  resourceCounts: Record<string, number>
  totalResources: number
}

export interface PatientSummary {
  id: string
  fullName: string
  givenName: string
  familyName: string
  birthDate: string
  gender: string
  identifier: string
  resource: FhirResource
}

export interface PaginatedResponse {
  entry: FhirBundleEntry[]
  total: number
  link: FhirBundleLink[]
}

export interface AuthState {
  username: string
  role: 'ADMIN' | 'USER'
  token: string
}
