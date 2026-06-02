import type { LabelHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  children: ReactNode
}

export function Label({ className, children, ...props }: LabelProps) {
  return (
    <label
      className={cn('block text-sm font-medium text-slate-700', className)}
      {...props}
    >
      {children}
    </label>
  )
}
