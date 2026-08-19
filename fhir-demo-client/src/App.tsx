import { useState } from 'react'
import { Heart, RotateCcw, CheckCircle, Loader, AlertCircle, ChevronRight } from 'lucide-react'
import { login, loadBundle, getResource, deleteResource } from './api.ts'
import demoBundle from './data/demo-bundle.json'

// ── Types ────────────────────────────────────────────────────────────────────

type StepStatus = 'pending' | 'loading' | 'done' | 'error'

interface Step {
  id: number
  title: string
  resourceType: string
  resourceId: string
  summary: string
  plain: string
}

const STEPS: Step[] = [
  {
    id: 1,
    title: 'Register Patient',
    resourceType: 'Patient',
    resourceId: 'demo-patient-001',
    summary: 'Create the patient record in the FHIR server',
    plain: 'Alex Demo is registered as a patient. The FHIR server assigns a unique ID and stores their demographics — name, date of birth, address, and phone number.',
  },
  {
    id: 2,
    title: 'Record Encounter',
    resourceType: 'Encounter',
    resourceId: 'demo-encounter-001',
    summary: 'Log the office visit',
    plain: 'Alex visits General Hospital for a 30-minute ambulatory consultation. The encounter links the patient to the provider and captures the date and time of the visit.',
  },
  {
    id: 3,
    title: 'Document Condition',
    resourceType: 'Condition',
    resourceId: 'demo-condition-001',
    summary: 'Record the clinical diagnosis',
    plain: 'During the encounter, the clinician documents a diagnosis of Type 2 Diabetes (SNOMED CT 44054006). This condition is linked to both the patient and the specific encounter.',
  },
  {
    id: 4,
    title: 'Submit Claim',
    resourceType: 'Claim',
    resourceId: 'demo-claim-001',
    summary: 'Submit the billing claim to the insurer',
    plain: 'A professional claim is submitted for CPT code 99213 (Office Visit) at $150.00. The claim references the patient, provider, and BlueCross Demo Insurance coverage.',
  },
  {
    id: 5,
    title: 'View Explanation of Benefit',
    resourceType: 'ExplanationOfBenefit',
    resourceId: 'demo-eob-001',
    summary: 'Review the insurer\'s payment decision',
    plain: 'BlueCross Demo Insurance approves the claim. Of the $150.00 submitted, $120.00 is paid to the provider. The EOB is the final record of what was billed, adjudicated, and paid — the key document in the revenue cycle.',
  },
]

// ── Helper components ─────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: StepStatus }) {
  if (status === 'loading') return <Loader className="h-5 w-5 animate-spin text-blue-500" />
  if (status === 'done') return <CheckCircle className="h-5 w-5 text-emerald-500" />
  if (status === 'error') return <AlertCircle className="h-5 w-5 text-red-500" />
  return <div className="h-5 w-5 rounded-full border-2 border-slate-300" />
}

function ResponsePanel({ data }: { data: object }) {
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700">
        View raw FHIR response
      </summary>
      <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-emerald-300">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [authed, setAuthed] = useState(!!sessionStorage.getItem('demo_token'))
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  const [statuses, setStatuses] = useState<Record<number, StepStatus>>({})
  const [responses, setResponses] = useState<Record<number, object>>({})
  const [errors, setErrors] = useState<Record<number, string>>({})
  const [activeStep, setActiveStep] = useState(1)
  const [resetting, setResetting] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // ── Auth ──

  const handleLogin = async () => {
    setLoginLoading(true)
    setLoginError('')
    try {
      await login(username, password)
      setAuthed(true)
    } catch {
      setLoginError('Login failed — check username and password.')
    } finally {
      setLoginLoading(false)
    }
  }

  // ── Reset / load bundle ──

  const handleReset = async () => {
    setResetting(true)
    // Delete demo resources in reverse dependency order
    const toDelete: [string, string][] = [
      ['ExplanationOfBenefit', 'demo-eob-001'],
      ['Claim', 'demo-claim-001'],
      ['Coverage', 'demo-coverage-001'],
      ['Condition', 'demo-condition-001'],
      ['Encounter', 'demo-encounter-001'],
      ['Patient', 'demo-patient-001'],
      ['Organization', 'demo-org-001'],
    ]
    for (const [type, id] of toDelete) {
      try { await deleteResource(type, id) } catch { /* not found is fine */ }
    }
    // Load the bundle
    await loadBundle(demoBundle)
    setStatuses({})
    setResponses({})
    setErrors({})
    setActiveStep(1)
    setInitialized(true)
    setResetting(false)
  }

  // ── Run a step ──

  const runStep = async (step: Step) => {
    setStatuses(s => ({ ...s, [step.id]: 'loading' }))
    setErrors(e => ({ ...e, [step.id]: '' }))
    try {
      const data = await getResource(step.resourceType, step.resourceId)
      setResponses(r => ({ ...r, [step.id]: data as object }))
      setStatuses(s => ({ ...s, [step.id]: 'done' }))
      if (step.id < STEPS.length) setActiveStep(step.id + 1)
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? 'Request failed'
      setErrors(e => ({ ...e, [step.id]: msg }))
      setStatuses(s => ({ ...s, [step.id]: 'error' }))
    }
  }

  const allDone = STEPS.every(s => statuses[s.id] === 'done')

  // ── Login screen ──

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600">
              <Heart className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">FHIR Claims Demo</h1>
            <p className="mt-1 text-sm text-slate-500">Connect to your FHIR R4 Platform</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            {loginError && <p className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-700">{loginError}</p>}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Username</label>
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={username} onChange={e => setUsername(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
              <input type="password" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            </div>
            <button onClick={handleLogin} disabled={loginLoading}
              className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {loginLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Main demo screen ──

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
              <Heart className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900">FHIR R4 Platform</h1>
              <p className="text-xs text-slate-500">Claims Processing Demo</p>
            </div>
          </div>
          <button onClick={handleReset} disabled={resetting}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <RotateCcw className={`h-4 w-4 ${resetting ? 'animate-spin' : ''}`} />
            {resetting ? 'Resetting…' : initialized ? 'Reset Demo' : 'Load Demo Data'}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-6">
        {/* Intro */}
        {!initialized && (
          <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 p-5">
            <h2 className="font-semibold text-blue-900">Welcome to the FHIR Claims Demo</h2>
            <p className="mt-1 text-sm text-blue-800">
              This demo walks through a complete clinical billing workflow — from registering a patient
              to receiving an Explanation of Benefit — using live FHIR R4 API calls against your platform.
            </p>
            <p className="mt-2 text-sm font-medium text-blue-900">Click <strong>Load Demo Data</strong> above to begin.</p>
          </div>
        )}

        {/* Progress bar */}
        {initialized && (
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>Progress</span>
              <span>{STEPS.filter(s => statuses[s.id] === 'done').length} / {STEPS.length} steps complete</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-200">
              <div className="h-2 rounded-full bg-blue-600 transition-all"
                style={{ width: `${(STEPS.filter(s => statuses[s.id] === 'done').length / STEPS.length) * 100}%` }} />
            </div>
          </div>
        )}

        {/* Completion banner */}
        {allDone && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
              <h2 className="font-semibold text-emerald-900">Demo Complete!</h2>
            </div>
            <p className="mt-1 text-sm text-emerald-800">
              You've successfully walked through a complete FHIR R4 claims processing workflow —
              from patient registration through payment adjudication. Every step made a real API
              call to your FHIR server.
            </p>
          </div>
        )}

        {/* Steps */}
        <div className="space-y-4">
          {STEPS.map((step) => {
            const status = statuses[step.id] ?? 'pending'
            const isActive = initialized && step.id === activeStep && status !== 'done'
            const isLocked = !initialized || (step.id > activeStep && status === 'pending')

            return (
              <div key={step.id}
                className={`rounded-xl border bg-white p-5 transition-all ${
                  isActive ? 'border-blue-400 shadow-md' :
                  status === 'done' ? 'border-emerald-200' :
                  status === 'error' ? 'border-red-300' :
                  'border-slate-200'
                } ${isLocked ? 'opacity-50' : ''}`}>

                <div className="flex items-start gap-4">
                  {/* Step number + status */}
                  <div className="flex flex-col items-center gap-1 pt-0.5">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                      status === 'done' ? 'bg-emerald-100 text-emerald-700' :
                      status === 'error' ? 'bg-red-100 text-red-700' :
                      isActive ? 'bg-blue-100 text-blue-700' :
                      'bg-slate-100 text-slate-500'
                    }`}>{step.id}</div>
                    <StatusIcon status={status} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-slate-900">{step.title}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">{step.summary}</p>
                      </div>
                      {!isLocked && status !== 'done' && (
                        <button onClick={() => runStep(step)} disabled={status === 'loading'}
                          className="flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 shrink-0">
                          {status === 'loading' ? 'Running…' : <>Run step <ChevronRight className="h-4 w-4" /></>}
                        </button>
                      )}
                    </div>

                    {/* Plain-English explanation */}
                    {status === 'done' && (
                      <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-sm text-emerald-800">
                        {step.plain}
                      </div>
                    )}

                    {/* Error */}
                    {status === 'error' && errors[step.id] && (
                      <p className="mt-2 text-sm text-red-600">{errors[step.id]}</p>
                    )}

                    {/* Raw FHIR response */}
                    {responses[step.id] && <ResponsePanel data={responses[step.id]} />}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-slate-400">
          FHIR R4 Platform Demo · All data is synthetic · Built with HAPI FHIR
        </p>
      </main>
    </div>
  )
}
