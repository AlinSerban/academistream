import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAppSelector } from '../../app/hooks'

interface RequireAuthProps {
  children: ReactNode
}

export function RequireAuth({ children }: RequireAuthProps) {
  const accessToken = useAppSelector((state) => state.auth.accessToken)
  const location = useLocation()

  if (!accessToken) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}
