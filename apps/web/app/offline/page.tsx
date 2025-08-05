'use client';

import { Button } from '@workspace/ui/components/button'
import { WifiOff, RefreshCw } from 'lucide-react'

export default function OfflinePage() {
  const handleRetry = () => {
    window.location.reload()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full space-y-8 p-6">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 text-gray-400">
            <WifiOff className="h-12 w-12" />
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            You're offline
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Please check your internet connection and try again.
          </p>
        </div>
        <div className="mt-8">
          <Button
            onClick={handleRetry}
            className="w-full flex items-center justify-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    </div>
  )
} 