import { useState } from 'react'
import { Heart, RotateCcw, CheckCircle, Loader, AlertCircle, ChevronRight } from 'lucide-react'
import { login, createResource, deleteResource } from './api.ts'

type StepStatus = 'pending' | 'loading' | 'done' | 'error'

interface CreatedIds {
  patient?: string; encounter?: string; condition?: string
  claim?: string;   eob?: string
}

const STEPS = [
  { id: 1, title: 'Register Patient',           resourceType: 'Patient'              },
  { id: 2, title: 'Record Encounter',            resourceType: 'Encounter'            },
  { id: 3, title: 'Document Condition',          resourceType: 'Condition'            },
  { id: 4, title: 'Submit Claim',                resourceType: 'Claim'                },
  { id: 5, title: 'View Explanation of Benefit', resourceType: 'ExplanationOfBenefit' },
]

const PLAIN: Record<number, string> = {
  1: 'Alex Demo is now registered. The FHIR server assigned a unique ID and stored their demographics — name, date of birth, address, and phone number.',
  2: 'Alex visits General Hospital for a 30-minute ambulatory consultation. The encounter links the patient to the provider and records the date and time.',
  3: 'The clinician documents a diagnosis of Type 2 Diabetes (SNOMED CT 44054006), linked to both the patient and the specific encounter.',
  4: 'A professional claim for CPT 99213 (Office Visit, $150.00) is submitted, referencing the patient and BlueCross Demo Insurance.',
  5: 'BlueCross approves the claim: $120.00 of the $150.00 submitted is paid. The EOB is the final record of what was billed, adjudicated, and paid — the key document in the revenue cycle.',
}

function buildResource(stepId: number, ids: CreatedIds): object {
  const today = new Date().toISOString().split('T')[0]
  switch (stepId) {
    case 1: return {
      resourceType: 'Patient',
      name: [{ family: 'Demo', given: ['Alex'] }], gender: 'female', birthDate: '1985-06-15',
      address: [{ line: ['123 Main St'], city: 'Boston', state: 'MA', postalCode: '02101' }],
      telecom: [{ system: 'phone', value: '555-867-5309' }],
    }
    case 2: return {
      resourceType: 'Encounter', status: 'finished',
      class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'ambulatory' },
      type: [{ coding: [{ system: 'http://snomed.info/sct', code: '11429006', display: 'Consultation' }] }],
      subject: { reference: `Patient/${ids.patient}` },
      period: { start: `${today}T09:00:00Z`, end: `${today}T09:30:00Z` },
    }
    case 3: return {
      resourceType: 'Condition',
      clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
      code: { coding: [{ system: 'http://snomed.info/sct', code: '44054006', display: 'Diabetes mellitus type 2' }], text: 'Type 2 Diabetes' },
      subject: { reference: `Patient/${ids.patient}` },
      encounter: { reference: `Encounter/${ids.encounter}` },
      onsetDateTime: today,
    }
    case 4: return {
      resourceType: 'Claim', status: 'active', use: 'claim',
      type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
      patient: { reference: `Patient/${ids.patient}` }, created: today,
      provider: { display: 'General Hospital' },
      priority: { coding: [{ code: 'normal' }] },
      insurance: [{ sequence: 1, focal: true, coverage: { display: 'BlueCross Demo Insurance' } }],
      item: [{ sequence: 1, servicedDate: today,
        productOrService: { coding: [{ system: 'http://www.ama-assn.org/go/cpt', code: '99213', display: 'Office visit' }] },
        unitPrice: { value: 150.00, currency: 'USD' },
      }],
      total: { value: 150.00, currency: 'USD' },
    }
    case 5: return {
      resourceType: 'ExplanationOfBenefit', status: 'active', use: 'claim',
      type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
      patient: { reference: `Patient/${ids.patient}` }, created: today,
      insurer: { display: 'BlueCross Demo Insurance' },
      provider: { display: 'General Hospital' },
      claim: { reference: `Claim/${ids.claim}` }, outcome: 'complete',
      insurance: [{ focal: true, coverage: { display: 'BlueCross Demo Insurance' } }],
      item: [{ sequence: 1, servicedDate: today,
        productOrService: { coding: [{ system: 'http://www.ama-assn.org/go/cpt', code: '99213', display: 'Office visit' }] },
        adjudication: [
          { category: { coding: [{ code: 'submitted' }] }, amount: { value: 150.00, currency: 'USD' } },
          { category: { coding: [{ code: 'benefit' }] },    amount: { value: 120.00, currency: 'USD' } },
        ],
      }],
      total: [
        { category: { coding: [{ code: 'submitted' }] }, amount: { value: 150.00, currency: 'USD' } },
        { category: { coding: [{ code: 'benefit' }] },    amount: { value: 120.00, currency: 'USD' } },
      ],
      payment: { amount: { value: 120.00, currency: 'USD' } },
    }
    default: return {}
  }
}

function StatusIcon({ status }: { status: StepStatus }) {
  if (status === 'loading') return <Loader className="h-5 w-5 animate-spin text-blue-500" />
  if (status === 'done')    return <CheckCircle className="h-5 w-5 text-emerald-500" />
  if (status === 'error')   return <AlertCircle className="h-5 w-5 text-red-500" />
  return <div className="h-5 w-5 rounded-full border-2 border-slate-300" />
}

function ResponsePanel({ data }: { data: object }) {
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700">View raw FHIR response</summary>
      <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-emerald-300">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  )
}

export default function App() {
  const [authed,      setAuthed]      = useState(!!sessionStorage.getItem('demo_token'))
  const [username,    setUsername]    = useState('admin')
  const [password,    setPassword]    = useState('admin')
  const [loginError,  setLoginError]  = useState('')
  const [loginLoading,setLoginLoading]= useState(false)
  const [statuses,    setStatuses]    = useState<Record<number, StepStatus>>({})
  const [responses,   setResponses]   = useState<Record<number, object>>({})
  const [errors,      setErrors]      = useState<Record<number, string>>({})
  const [activeStep,  setActiveStep]  = useState(1)
  const [started,     setStarted]     = useState(false)
  const [createdIds,  setCreatedIds]  = useState<CreatedIds>({})

  const handleLogin = async () => {
    setLoginLoading(true); setLoginError('')
    try { await login(username, password); setAuthed(true) }
    catch { setLoginError('Login failed — check username and password.') }
    finally { setLoginLoading(false) }
  }

  const handleReset = () => {
    // Fire deletes in the background — don't block the UI waiting for them.
    // Resources are identified by the IDs captured at click time.
    const ids = createdIds
    void Promise.allSettled([
      ids.eob       && deleteResource('ExplanationOfBenefit', ids.eob),
      ids.claim     && deleteResource('Claim',                ids.claim),
      ids.condition && deleteResource('Condition',            ids.condition),
      ids.encounter && deleteResource('Encounter',            ids.encounter),
      ids.patient   && deleteResource('Patient',              ids.patient),
    ].filter(Boolean))
    // Reset UI state immediately
    setStatuses({}); setResponses({}); setErrors({})
    setActiveStep(1); setCreatedIds({}); setStarted(true)
  }

  const runStep = async (stepId: number) => {
    setStatuses(s => ({ ...s, [stepId]: 'loading' }))
    setErrors(e => ({ ...e, [stepId]: '' }))
    try {
      const type = STEPS.find(s => s.id === stepId)!.resourceType
      const data = await createResource(type, buildResource(stepId, createdIds))
      setResponses(r => ({ ...r, [stepId]: data }))
      setStatuses(s => ({ ...s, [stepId]: 'done' }))
      const id = (data as { id: string }).id
      setCreatedIds(ids => ({
        ...ids,
        ...(stepId === 1 ? { patient:   id } : {}),
        ...(stepId === 2 ? { encounter: id } : {}),
        ...(stepId === 3 ? { condition: id } : {}),
        ...(stepId === 4 ? { claim:     id } : {}),
        ...(stepId === 5 ? { eob:       id } : {}),
      }))
      if (stepId < STEPS.length) setActiveStep(stepId + 1)
    } catch (err) {
      setErrors(e => ({ ...e, [stepId]: (err as { message?: string })?.message ?? 'Request failed' }))
      setStatuses(s => ({ ...s, [stepId]: 'error' }))
    }
  }

  const allDone = STEPS.every(s => statuses[s.id] === 'done')

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

  return (
    <div className="min-h-screen bg-slate-50">
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
          <button onClick={handleReset}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <RotateCcw className="h-4 w-4" />
            {started ? 'Restart Demo' : 'Start Demo'}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-6">
        {!started && (
          <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 p-5">
            <h2 className="font-semibold text-blue-900">Welcome to the FHIR Claims Demo</h2>
            <p className="mt-1 text-sm text-blue-800">
              Walk through a complete clinical billing workflow — patient registration through
              payment adjudication — using live FHIR R4 API calls. Each step creates a real
              resource on your server and shows the raw JSON response.
            </p>
            <p className="mt-2 text-sm font-medium text-blue-900">Click <strong>Start Demo</strong> above to begin.</p>
          </div>
        )}

        {started && (
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>Progress</span>
              <span>{STEPS.filter(s => statuses[s.id] === 'done').length} / {STEPS.length} complete</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-200">
              <div className="h-2 rounded-full bg-blue-600 transition-all"
                style={{ width: `${(STEPS.filter(s => statuses[s.id] === 'done').length / STEPS.length) * 100}%` }} />
            </div>
          </div>
        )}

        {allDone && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
              <h2 className="font-semibold text-emerald-900">Demo Complete!</h2>
            </div>
            <p className="mt-1 text-sm text-emerald-800">
              Every resource was created live on your FHIR server. Click <strong>Restart Demo</strong> to run it again with fresh data.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {STEPS.map((step) => {
            const status  = statuses[step.id] ?? 'pending'
            const isActive = started && step.id === activeStep && status !== 'done'
            const isLocked = !started || (step.id > activeStep && status === 'pending')
            return (
              <div key={step.id}
                className={`rounded-xl border bg-white p-5 transition-all ${
                  isActive        ? 'border-blue-400 shadow-md' :
                  status === 'done'  ? 'border-emerald-200' :
                  status === 'error' ? 'border-red-300' : 'border-slate-200'
                } ${isLocked ? 'opacity-50' : ''}`}>
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center gap-1 pt-0.5">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                      status === 'done'  ? 'bg-emerald-100 text-emerald-700' :
                      status === 'error' ? 'bg-red-100 text-red-700' :
                      isActive          ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                    }`}>{step.id}</div>
                    <StatusIcon status={status} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-slate-900">{step.title}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {status === 'done' && responses[step.id]
                            ? `${step.resourceType}/${(responses[step.id] as { id: string }).id}`
                            : `Creates a ${step.resourceType} on the FHIR server`}
                        </p>
                      </div>
                      {!isLocked && status !== 'done' && (
                        <button onClick={() => runStep(step.id)} disabled={status === 'loading'}
                          className="flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 shrink-0">
                          {status === 'loading' ? 'Creating…' : <>Run step <ChevronRight className="h-4 w-4" /></>}
                        </button>
                      )}
                    </div>
                    {status === 'done' && (
                      <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-sm text-emerald-800">
                        {PLAIN[step.id]}
                      </div>
                    )}
                    {status === 'error' && errors[step.id] && (
                      <p className="mt-2 text-sm text-red-600">{errors[step.id]}</p>
                    )}
                    {responses[step.id] && <ResponsePanel data={responses[step.id]} />}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <p className="mt-8 text-center text-xs text-slate-400">FHIR R4 Platform Demo · All data is synthetic · Built with HAPI FHIR</p>
      </main>
    </div>
  )
}
