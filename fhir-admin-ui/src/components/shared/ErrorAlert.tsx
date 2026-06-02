import { AlertCircle } from 'lucide-react'

interface ErrorAlertProps {
  message: string
  onRetry?: () => void
}

export function ErrorAlert({ message, onRetry }: ErrorAlertProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
      <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
      <div className="flex-1">
        <p className="text-sm font-medium text-red-800">Error</p>
        <p className="mt-1 text-sm text-red-700">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 text-sm font-medium text-red-700 underline hover:text-red-800"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  )
}
