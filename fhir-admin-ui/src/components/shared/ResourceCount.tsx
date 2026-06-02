import type { ReactNode } from 'react'

interface ResourceCountProps {
  label: string
  count: number
  icon: ReactNode
}

export function ResourceCount({ label, count, icon }: ResourceCountProps) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900">
          {count.toLocaleString()}
        </p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  )
}
