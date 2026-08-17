import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import apiClient from '../api/client'
import type { AuthState, LoginResponse, UserRole } from '../types'

interface AuthContextValue {
  user: AuthState | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
  isAdmin: boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)

function loadStoredAuth(): AuthState | null {
  try {
    const token = localStorage.getItem('auth_token')
    const userJson = localStorage.getItem('auth_user')
    if (token && userJson) {
      const parsed = JSON.parse(userJson) as { username: string; role: UserRole }
      return { token, username: parsed.username, role: parsed.role }
    }
  } catch {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
  }
  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthState | null>(loadStoredAuth)

  useEffect(() => {
    if (user) {
      localStorage.setItem('auth_token', user.token)
      localStorage.setItem(
        'auth_user',
        JSON.stringify({ username: user.username, role: user.role })
      )
    }
  }, [user])

  const login = useCallback(async (username: string, password: string) => {
    const res = await apiClient.post<LoginResponse>('/api/auth/login', {
      username,
      password,
    })
    const { token, username: uname, role } = res.data
    setUser({ token, username: uname, role })
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      login,
      logout,
      isAuthenticated: user !== null,
      isAdmin: user?.role === 'ADMIN',
    }),
    [user, login, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
