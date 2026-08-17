/**
 * Dashboard.test.tsx
 *
 * Verifies that the Dashboard renders a ResourceCount card for every resource
 * type returned by /api/admin/stats (15 types), showing the correct count.
 *
 * This was the defect fixed in PR #4: the frontend typed the response as flat
 * but the API returns a nested { resourceCounts: {...}, totalResources: N }
 * shape, causing only 2 cards to appear (the two non-object values).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { Dashboard } from '../pages/Dashboard'
import { AuthContext } from '../context/AuthContext'

// Stub useStats — the Dashboard page calls this hook directly
vi.mock('../api/hooks', () => ({
  useStats: () => ({
    data: {
      totalResources: 21_000,
      resourceCounts: {
        Patient: 1000,
        Practitioner: 200,
        Organization: 50,
        Encounter: 5000,
        Condition: 3000,
        Observation: 8000,
        MedicationRequest: 1500,
        AllergyIntolerance: 300,
        Immunization: 800,
        Procedure: 700,
        DiagnosticReport: 250,
        CarePlan: 100,
        Claim: 50,
        Coverage: 25,
        ExplanationOfBenefit: 25,
      },
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useSyntheaJobs: () => ({ data: [] }),
}))

const RESOURCE_TYPES = [
  'Patient', 'Practitioner', 'Organization', 'Encounter', 'Condition',
  'Observation', 'MedicationRequest', 'AllergyIntolerance', 'Immunization',
  'Procedure', 'DiagnosticReport', 'CarePlan', 'Claim', 'Coverage',
  'ExplanationOfBenefit',
]

function renderDashboard(isAdmin = true) {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AuthContext.Provider
          value={{
            user: { token: 't', username: 'admin', role: 'ADMIN' },
            login: vi.fn(),
            logout: vi.fn(),
            isAuthenticated: true,
            isAdmin,
          }}
        >
          <Dashboard />
        </AuthContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Dashboard', () => {
  it('renders a card for each of the 15 FHIR resource types', () => {
    renderDashboard()
    for (const type of RESOURCE_TYPES) {
      expect(screen.getByText(type)).toBeInTheDocument()
    }
  })

  it('displays the total resource count in the subtitle', () => {
    renderDashboard()
    expect(screen.getByText(/21,000 total resources/i)).toBeInTheDocument()
  })

  it('shows the Generate Data button for ADMIN users', () => {
    renderDashboard(true)
    expect(screen.getByRole('button', { name: /generate data/i })).toBeInTheDocument()
  })

  it('hides the Generate Data button for non-ADMIN users', () => {
    renderDashboard(false)
    expect(screen.queryByRole('button', { name: /generate data/i })).not.toBeInTheDocument()
  })
})
