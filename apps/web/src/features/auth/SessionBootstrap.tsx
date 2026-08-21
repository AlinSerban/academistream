import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useAppSelector } from '../../app/hooks'
import { useRefreshMutation } from './authApi'

interface SessionBootstrapProps {
  children: ReactNode
}

/** Restores access token from HttpOnly refresh cookie once on startup. */
export function SessionBootstrap({ children }: SessionBootstrapProps) {
  const accessToken = useAppSelector((state) => state.auth.accessToken)
  const [refresh, { isUninitialized, isLoading }] = useRefreshMutation()
  const attempted = useRef(false)

  useEffect(() => {
    if (accessToken || attempted.current) return
    attempted.current = true
    void refresh()
  }, [accessToken, refresh])

  const restoring = !accessToken && (isUninitialized || isLoading)

  if (restoring) {
    return (
      <main className="mx-auto flex min-h-svh max-w-md items-center justify-center px-4">
        <p className="text-sm text-slate-600">Checking session…</p>
      </main>
    )
  }

  return children
}
