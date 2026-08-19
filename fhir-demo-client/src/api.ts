import axios from 'axios'

export const client = axios.create({ baseURL: '' })

client.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('demo_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export async function login(username: string, password: string): Promise<string> {
  const res = await axios.post<{ token: string }>('/api/auth/login', { username, password })
  sessionStorage.setItem('demo_token', res.data.token)
  return res.data.token
}

/** POST a new FHIR resource — server assigns the ID. Returns the created resource. */
export async function createResource(type: string, body: object): Promise<{ id: string } & object> {
  const res = await client.post<{ id: string } & object>(`/fhir/${type}`, body, {
    headers: { 'Content-Type': 'application/fhir+json' },
  })
  return res.data
}

export async function deleteResource(type: string, id: string): Promise<void> {
  await client.delete(`/fhir/${type}/${id}`)
}
