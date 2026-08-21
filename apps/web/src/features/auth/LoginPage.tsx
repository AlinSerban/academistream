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
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-4 py-10">
      <h1 className="mb-2 text-3xl font-semibold tracking-tight text-slate-900">
        Academistream
      </h1>
      <p className="mb-8 text-sm text-slate-600">Sign in to your account</p>

      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <label className="flex flex-col gap-1 text-left text-sm text-slate-700">
          Email
          <input
            className="rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-slate-500"
            type="email"
            name="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label className="flex flex-col gap-1 text-left text-sm text-slate-700">
          Password
          <input
            className="rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-slate-500"
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {errorMessage ? (
          <p className="text-sm text-red-600" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <button
          className="mt-2 rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
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
