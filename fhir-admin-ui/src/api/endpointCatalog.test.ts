import { describe, expect, it } from 'vitest'
import {
  ENDPOINTS,
  ENDPOINT_GROUPS,
  FHIR_RESOURCE_TYPES,
  buildUrl,
} from './endpointCatalog'
import type { EndpointDef } from './endpointCatalog'

function endpoint(id: string): EndpointDef {
  const found = ENDPOINTS.find((e) => e.id === id)
  if (!found) throw new Error(`no catalog entry: ${id}`)
  return found
}

describe('buildUrl', () => {
  it('substitutes the resource type', () => {
    expect(buildUrl(endpoint('fhir-search'), 'Observation', {}, [])).toBe(
      '/fhir/Observation'
    )
  })

  it('substitutes path parameters', () => {
    expect(
      buildUrl(endpoint('fhir-read'), 'Patient', { id: 'abc-123' }, [])
    ).toBe('/fhir/Patient/abc-123')
  })

  it('appends query parameters', () => {
    const url = buildUrl(endpoint('fhir-search'), 'Patient', {}, [
      { key: '_count', value: '20' },
      { key: '_offset', value: '40' },
    ])
    expect(url).toBe('/fhir/Patient?_count=20&_offset=40')
  })

  it('drops query rows with a blank name', () => {
    const url = buildUrl(endpoint('fhir-search'), 'Patient', {}, [
      { key: '', value: 'ignored' },
      { key: 'family', value: 'Smith' },
    ])
    expect(url).toBe('/fhir/Patient?family=Smith')
  })

  it('encodes values so they cannot break out of the query string', () => {
    const url = buildUrl(endpoint('fhir-search'), 'Patient', {}, [
      { key: 'family', value: 'O&Brien Smith' },
    ])
    expect(url).toBe('/fhir/Patient?family=O%26Brien%20Smith')
  })

  it('encodes path parameters', () => {
    expect(
      buildUrl(endpoint('fhir-read'), 'Patient', { id: 'a/b' }, [])
    ).toBe('/fhir/Patient/a%2Fb')
  })

  it('leaves endpoints without placeholders untouched', () => {
    expect(buildUrl(endpoint('admin-stats'), 'Patient', {}, [])).toBe(
      '/api/admin/stats'
    )
  })
})

describe('catalog integrity', () => {
  it('covers the 15 resource types the backend serves', () => {
    expect(FHIR_RESOURCE_TYPES).toHaveLength(15)
    expect(FHIR_RESOURCE_TYPES).toContain('Patient')
    expect(FHIR_RESOURCE_TYPES).toContain('ExplanationOfBenefit')
  })

  it('has unique ids', () => {
    const ids = ENDPOINTS.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('groups every entry', () => {
    expect(ENDPOINT_GROUPS.length).toBeGreaterThan(0)
    for (const e of ENDPOINTS) {
      expect(ENDPOINT_GROUPS).toContain(e.group)
    }
  })

  it('declares every {placeholder} it uses', () => {
    for (const e of ENDPOINTS) {
      const placeholders = [...e.pathTemplate.matchAll(/\{(\w+)\}/g)].map(
        (m) => m[1]
      )
      for (const p of placeholders) {
        if (p === 'resourceType') {
          expect(e.usesResourceType, `${e.id} uses {resourceType}`).toBe(true)
        } else {
          const declared = (e.pathParams ?? []).map((x) => x.name)
          expect(declared, `${e.id} declares {${p}}`).toContain(p)
        }
      }
    }
  })

  it('marks destructive operations so the console can confirm them', () => {
    for (const e of ENDPOINTS.filter((x) => x.method === 'DELETE')) {
      expect(e.destructive, `${e.id} should be destructive`).toBe(true)
    }
  })

  it('only ever sends a body on POST or PUT', () => {
    for (const e of ENDPOINTS.filter((x) => x.bodyTemplate)) {
      expect(['POST', 'PUT']).toContain(e.method)
    }
  })

  it('body templates are valid JSON', () => {
    for (const e of ENDPOINTS.filter((x) => x.bodyTemplate)) {
      expect(() => JSON.parse(e.bodyTemplate as string), e.id).not.toThrow()
    }
  })

  it('reflects the backend auth model', () => {
    // /fhir/** and /api/auth/login are permitAll; everything else is ADMIN.
    expect(endpoint('fhir-search').auth).toBe('public')
    expect(endpoint('fhir-metadata').auth).toBe('public')
    expect(endpoint('auth-login').auth).toBe('public')
    // register was public and honoured a caller-supplied role, which allowed
    // privilege escalation. It must be documented as admin-only.
    expect(endpoint('auth-register').auth).toBe('admin')
    expect(endpoint('admin-stats').auth).toBe('admin')
    expect(endpoint('admin-users-create').auth).toBe('admin')
  })

  it('includes the user-creation endpoint that the UI depends on', () => {
    const create = endpoint('admin-users-create')
    expect(create.method).toBe('POST')
    expect(create.pathTemplate).toBe('/api/admin/users')
  })
})
