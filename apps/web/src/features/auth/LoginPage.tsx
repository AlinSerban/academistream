import { useState, type FormEvent } from 'react'
import type { SerializedError } from '@reduxjs/toolkit'
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAppSelector } from '../../app/hooks'
import { useLoginMutation } from './authApi'

export function LoginPage() {
  const accessToken = useAppSelector((state) => state.auth.accessToken)
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [login, { isLoading, error }] = useLoginMutation()

  if (accessToken) {
    return <Navigate to="/" replace />
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      await login({ email, password }).unwrap()
      navigate('/', { replace: true })
    } catch {
      // error rendered from mutation state
    }
  }

  const errorMessage = getLoginErrorMessage(error)

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-brand">Academistream</h1>
        <p className="auth-tagline">Private training video for your organization</p>

        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <label className="field-label">
            Email
            <input
              className="input"
              type="email"
              name="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="field-label">
            Password
            <input
              className="input"
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {errorMessage ? (
            <p className="alert-error" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <button className="btn btn-primary mt-2 w-full" type="submit" disabled={isLoading}>
            {isLoading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}

function getLoginErrorMessage(
  error: FetchBaseQueryError | SerializedError | undefined,
): string | null {
  if (!error) return null
  if ('status' in error && error.status === 401) {
    return 'Invalid email or password'
  }
  return 'Sign in failed. Is the API running?'
}
