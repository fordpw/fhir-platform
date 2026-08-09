import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Stethoscope,
  Database,
  FlaskConical,
  Settings,
  LogOut,
  Heart,
  UserCog,
  TerminalSquare,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAuth } from '../../context/AuthContext'

interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
  { label: 'Patients', path: '/patients', icon: <Stethoscope className="h-5 w-5" /> },
  { label: 'Resources', path: '/resources', icon: <Database className="h-5 w-5" /> },
  { label: 'Synthea', path: '/synthea', icon: <FlaskConical className="h-5 w-5" />, adminOnly: true },
  { label: 'Users', path: '/users', icon: <UserCog className="h-5 w-5" />, adminOnly: true },
  { label: 'API Console', path: '/api-console', icon: <TerminalSquare className="h-5 w-5" />, adminOnly: true },
  { label: 'Settings', path: '/settings', icon: <Settings className="h-5 w-5" /> },
]

export function Sidebar() {
  const location = useLocation()
  const { isAdmin, user, logout } = useAuth()

  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin)

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:border-r lg:border-slate-200 lg:bg-white">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-slate-200">
        <Heart className="h-7 w-7 text-blue-600" />
        <span className="text-lg font-bold text-slate-900">FHIR Admin</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {visibleItems.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-slate-200 px-3 py-4">
        <div className="mb-3 px-3">
          <p className="text-sm font-medium text-slate-900">{user?.username}</p>
          <p className="text-xs text-slate-500">{user?.role}</p>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
        >
          <LogOut className="h-5 w-5" />
          Sign out
        </button>
      </div>
    </aside>
  )
}

export function MobileNav() {
  const location = useLocation()
  const { isAdmin } = useAuth()

  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin).slice(0, 5)

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-slate-200 bg-white px-2 py-2 lg:hidden">
      {visibleItems.map((item) => {
        const isActive = location.pathname === item.path
        return (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              'flex flex-col items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              isActive
                ? 'text-blue-700'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            {item.icon}
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
