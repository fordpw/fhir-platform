import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Dashboard } from './Dashboard'
import { AuthProvider } from '../context/AuthContext'
import { useStats, useSyntheaJobs } from '../api/hooks'
import type { StatsResponse, SyntheaJob } from '../types'

vi.mock('../api/hooks', () => ({
  useStats: vi.fn(),
  useSyntheaJobs: vi.fn(),
}))

const RESOURCE_COUNTS: Record<string, number> = {
  Patient: 16,
  Practitioner: 53,
  Organization: 53,
  Encounter: 613,
  Condition: 392,
  Observation: 3056,
  MedicationRequest: 242,
  AllergyIntolerance: 17,
  Immunization: 236,
  Procedure: 1190,
  DiagnosticReport: 992,
  CarePlan: 50,
  Claim: 855,
  Coverage: 0,
  ExplanationOfBenefit: 855,
}

const STATS: StatsResponse = {
  resourceCounts: RESOURCE_COUNTS,
  totalResources: 8620,
}

function setStats(data: StatsResponse | undefined, opts: Partial<{ isLoading: boolean; error: unknown }> = {}) {
  vi.mocked(useStats).mockReturnValue({
    data,
    isLoading: opts.isLoading ?? false,
    error: opts.error ?? null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useStats>)
}

function setJobs(jobs: SyntheaJob[]) {
  vi.mocked(useSyntheaJobs).mockReturnValue({
    data: jobs,
  } as unknown as ReturnType<typeof useSyntheaJobs>)
}

function renderDashboard() {
  localStorage.setItem('auth_token', 'tok')
  localStorage.setItem('auth_user', '{"username":"admin","role":"ADMIN"}')
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Dashboard />
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('Dashboard', () => {
  beforeEach(() => {
    setStats(STATS)
    setJobs([])
  })

  /**
   * The regression: /api/admin/stats returns a nested payload, but the
   * frontend typed it as a flat map and iterated the top level. That produced
   * two cards -- "resourceCounts" showing "[object Object]" and
   * "totalResources" -- instead of one per resource type.
   */
  it('renders one card per resource type, not the payload wrapper', () => {
    renderDashboard()

    for (const type of Object.keys(RESOURCE_COUNTS)) {
      expect(screen.getByText(type)).toBeInTheDocument()
    }

    expect(screen.queryByText('resourceCounts')).not.toBeInTheDocument()
    expect(screen.queryByText('totalResources')).not.toBeInTheDocument()
    expect(screen.queryByText(/\[object Object\]/)).not.toBeInTheDocument()
  })

  it('renders all 15 resource types', () => {
    renderDashboard()
    expect(Object.keys(RESOURCE_COUNTS)).toHaveLength(15)
    for (const type of Object.keys(RESOURCE_COUNTS)) {
      expect(screen.getByText(type)).toBeInTheDocument()
    }
  })

  it('formats counts with thousands separators', () => {
    renderDashboard()
    expect(screen.getByText('3,056')).toBeInTheDocument()
    expect(screen.getByText('1,190')).toBeInTheDocument()
  })

  it('shows a zero count rather than hiding the type', () => {
    renderDashboard()
    // Coverage is 0 in this fixture; it must still be listed.
    expect(screen.getByText('Coverage')).toBeInTheDocument()
  })

  it('surfaces the total in the subheading', () => {
    renderDashboard()
    expect(screen.getByText(/8,620 total resources/)).toBeInTheDocument()
  })

  it('shows an error state when stats fail to load', () => {
    setStats(undefined, { error: new Error('boom') })
    renderDashboard()
    expect(screen.getByText(/Failed to load statistics/i)).toBeInTheDocument()
  })

  it('lists recent Synthea jobs when present', () => {
    setJobs([
      {
        id: 'job-1',
        status: 'COMPLETED',
        populationSize: 10,
        state: 'Massachusetts',
        city: 'Boston',
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        resourcesImported: 6423,
        errorMessage: null,
      },
    ])
    renderDashboard()

    expect(screen.getByText('Recent Synthea Jobs')).toBeInTheDocument()
    expect(screen.getByText('COMPLETED')).toBeInTheDocument()
    expect(screen.getByText(/Boston, Massachusetts/)).toBeInTheDocument()
  })

  it('omits the jobs card when there are none', () => {
    renderDashboard()
    expect(screen.queryByText('Recent Synthea Jobs')).not.toBeInTheDocument()
  })
})
