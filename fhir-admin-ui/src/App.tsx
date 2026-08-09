import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { Layout } from './components/layout/Layout'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Patients } from './pages/Patients'
import { ResourceExplorer } from './pages/ResourceExplorer'
import { SyntheaGenerator } from './pages/SyntheaGenerator'
import { UserManagement } from './pages/UserManagement'
import { ApiConsole } from './pages/ApiConsole'
import { Settings } from './pages/Settings'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/patients" element={<Patients />} />
              <Route path="/resources" element={<ResourceExplorer />} />
              <Route path="/settings" element={<Settings />} />

              <Route element={<ProtectedRoute adminOnly />}>
                <Route path="/synthea" element={<SyntheaGenerator />} />
                <Route path="/users" element={<UserManagement />} />
                {/* Admin-only: the console can issue DELETE against live data. */}
                <Route path="/api-console" element={<ApiConsole />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
