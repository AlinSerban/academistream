import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import {
  Router,
  UNSAFE_createBrowserHistory as createBrowserHistory,
} from 'react-router'

/**
 * Browser router that applies history updates with flushSync.
 * React Router's default BrowserRouter can desync URL vs UI when
 * NavLinks are clicked in quick succession (batched setStates).
 */
export function SyncBrowserRouter({ children }: { children: ReactNode }) {
  const historyRef = useRef<ReturnType<typeof createBrowserHistory> | null>(
    null,
  )
  if (historyRef.current == null) {
    historyRef.current = createBrowserHistory({ v5Compat: true })
  }
  const history = historyRef.current

  const [state, setState] = useState({
    action: history.action,
    location: history.location,
  })

  useLayoutEffect(() => {
    return history.listen(() => {
      // Always read the live history location (not a possibly-stale event
      // payload) and commit synchronously so rapid clicks cannot leave the
      // URL ahead of the rendered route.
      flushSync(() => {
        setState({
          action: history.action,
          location: history.location,
        })
      })
    })
  }, [history])

  return (
    <Router
      navigator={history}
      location={state.location}
      navigationType={state.action}
      useTransitions={false}
    >
      {children}
    </Router>
  )
}
