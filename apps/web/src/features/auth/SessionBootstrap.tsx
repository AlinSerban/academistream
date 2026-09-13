import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useAppSelector } from '../../app/hooks'
import { useRefreshMutation } from './authApi'

interface SessionBootstrapProps {
  children: ReactNode
}

/** Restores access token from HttpOnly refresh cookie once on startup. */
export function SessionBootstrap({ children }: SessionBootstrapProps) {
  const accessToken = useAppSelector((state) => state.auth.accessToken)
  const [refresh] = useRefreshMutation()
  const [ready, setReady] = useState(() => Boolean(accessToken))

  useEffect(() => {
    if (accessToken) {
      setReady(true)
      return
    }

    let cancelled = false
    void refresh()
      .unwrap()
      .catch(() => {
        // No cookie / API down / expired — continue to public routes
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [accessToken, refresh])

  if (!ready) {
    return (
      <main className="auth-page">
        <p className="text-muted text-sm">Checking session…</p>
      </main>
    )
  }

  return children
}
