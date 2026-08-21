import type { SerializedError } from '@reduxjs/toolkit'
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { useNavigate } from 'react-router-dom'
import { useLogoutMutation, useMeQuery } from './authApi'
import type { Membership } from './types'

export function MePage() {
  const navigate = useNavigate()
  const { data, isLoading, isError, error } = useMeQuery()
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation()

  async function onLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  if (isLoading) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10">
        <p className="text-sm text-slate-600">Loading profile…</p>
      </main>
    )
  }

  if (isError || !data) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10">
        <p className="text-sm text-red-600" role="alert">
          {getMeErrorMessage(error)}
        </p>
        <button
          className="mt-4 rounded border border-slate-300 px-3 py-2 text-sm"
          type="button"
          onClick={() => void onLogout()}
        >
          Back to login
        </button>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-10 text-left">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Academistream</h1>
          <p className="mt-1 text-sm text-slate-600">Signed in as {data.email}</p>
        </div>
        <button
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          type="button"
          disabled={isLoggingOut}
          onClick={() => void onLogout()}
        >
          {isLoggingOut ? 'Signing out…' : 'Log out'}
        </button>
      </div>

      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-slate-500">Name</dt>
          <dd className="font-medium text-slate-900">{data.name}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Email</dt>
          <dd className="font-medium text-slate-900">{data.email}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Platform admin</dt>
          <dd className="font-medium text-slate-900">
            {data.isPlatformAdmin ? 'Yes' : 'No'}
          </dd>
        </div>
        <div>
          <dt className="mb-1 text-slate-500">Memberships</dt>
          <dd>
            {data.memberships.length === 0 ? (
              <span className="text-slate-700">None</span>
            ) : (
              <ul className="list-inside list-disc space-y-1 text-slate-900">
                {data.memberships.map((m) => (
                  <li key={`${m.tenantId}-${m.role}`}>{formatMembership(m)}</li>
                ))}
              </ul>
            )}
          </dd>
        </div>
      </dl>
    </main>
  )
}

function formatMembership(membership: Membership): string {
  return `Tenant ${membership.tenantId} — ${membership.role}`
}

function getMeErrorMessage(
  error: FetchBaseQueryError | SerializedError | undefined,
): string {
  if (error && 'status' in error && error.status === 401) {
    return 'Session expired. Please sign in again.'
  }
  return 'Could not load your profile.'
}
