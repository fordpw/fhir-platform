import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'
import type {
  AppUser,
  FhirBundle,
  FhirResource,
  GenerateRequest,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  StatsResponse,
  SyntheaJob,
} from '../types'

// ── Auth ──

export function useLogin() {
  return useMutation<LoginResponse, Error, LoginRequest>({
    mutationFn: async (data) => {
      const res = await apiClient.post<LoginResponse>('/api/auth/login', data)
      return res.data
    },
  })
}

export function useRegister() {
  return useMutation<void, Error, RegisterRequest>({
    mutationFn: async (data) => {
      await apiClient.post('/api/auth/register', data)
    },
  })
}

// ── Users ──

export function useUsers() {
  return useQuery<AppUser[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await apiClient.get<AppUser[]>('/api/admin/users')
      return res.data
    },
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation<void, Error, RegisterRequest>({
    mutationFn: async (data) => {
      await apiClient.post('/api/admin/users', data)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation<void, Error, { id: number; data: Partial<AppUser> }>({
    mutationFn: async ({ id, data }) => {
      await apiClient.put(`/api/admin/users/${id}`, data)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

export function useDeleteUser() {
  const qc = useQueryClient()
  return useMutation<void, Error, number>({
    mutationFn: async (id) => {
      await apiClient.delete(`/api/admin/users/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

// ── Stats ──

export function useStats() {
  return useQuery<StatsResponse>({
    queryKey: ['stats'],
    queryFn: async () => {
      const res = await apiClient.get<StatsResponse>('/api/admin/stats')
      return res.data
    },
  })
}

// ── FHIR Search & CRUD ──

export function useFhirSearch(
  resourceType: string,
  params: Record<string, string>,
  page: number
) {
  const count = 20
  const offset = page * count
  return useQuery<FhirBundle>({
    queryKey: ['fhir', resourceType, params, page],
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        ...params,
        _count: String(count),
        _offset: String(offset),
      })
      const res = await apiClient.get<FhirBundle>(
        `/fhir/${resourceType}?${searchParams.toString()}`
      )
      return res.data
    },
    enabled: !!resourceType,
  })
}

export function useFhirResource(resourceType: string, id: string) {
  return useQuery<FhirResource>({
    queryKey: ['fhir', resourceType, id],
    queryFn: async () => {
      const res = await apiClient.get<FhirResource>(
        `/fhir/${resourceType}/${id}`
      )
      return res.data
    },
    enabled: !!resourceType && !!id,
  })
}

export function useCreateResource() {
  const qc = useQueryClient()
  return useMutation<
    FhirResource,
    Error,
    { resourceType: string; resource: FhirResource }
  >({
    mutationFn: async ({ resourceType, resource }) => {
      const res = await apiClient.post<FhirResource>(
        `/fhir/${resourceType}`,
        resource
      )
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fhir'] })
    },
  })
}

export function useUpdateResource() {
  const qc = useQueryClient()
  return useMutation<
    FhirResource,
    Error,
    { resourceType: string; id: string; resource: FhirResource }
  >({
    mutationFn: async ({ resourceType, id, resource }) => {
      const res = await apiClient.put<FhirResource>(
        `/fhir/${resourceType}/${id}`,
        resource
      )
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fhir'] })
    },
  })
}

export function useDeleteResource() {
  const qc = useQueryClient()
  return useMutation<void, Error, { resourceType: string; id: string }>({
    mutationFn: async ({ resourceType, id }) => {
      await apiClient.delete(`/fhir/${resourceType}/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fhir'] })
    },
  })
}

// ── Synthea ──

export function useSyntheaGenerate() {
  const qc = useQueryClient()
  return useMutation<SyntheaJob, Error, GenerateRequest>({
    mutationFn: async (data) => {
      const res = await apiClient.post<SyntheaJob>(
        '/api/admin/synthea/generate',
        data
      )
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['synthea-jobs'] })
    },
  })
}

export function useSyntheaJobs() {
  return useQuery<SyntheaJob[]>({
    queryKey: ['synthea-jobs'],
    queryFn: async () => {
      const res = await apiClient.get<SyntheaJob[]>('/api/admin/synthea/jobs')
      return res.data
    },
  })
}

export function useSyntheaJob(id: number | null) {
  return useQuery<SyntheaJob>({
    queryKey: ['synthea-jobs', id],
    queryFn: async () => {
      const res = await apiClient.get<SyntheaJob>(
        `/api/admin/synthea/jobs/${id}`
      )
      return res.data
    },
    enabled: id !== null,
  })
}
