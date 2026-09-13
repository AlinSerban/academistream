import type { SerializedError } from '@reduxjs/toolkit'
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { useLogoutMutation, useMeQuery } from './authApi'
import type { Membership } from './types'

export function MePage() {
  const navigate = useNavigate()
  const { data, isLoading, isError, error } = useMeQuery()
  const [logout] = useLogoutMutation()

  async function onLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  if (isLoading) {
    return <p className="panel-empty">Loading profile…</p>
  }

  if (isError || !data) {
    return (
      <>
        <p className="alert-error" role="alert">
          {getMeErrorMessage(error)}
        </p>
        <button
          className="btn btn-secondary mt-4"
          type="button"
          onClick={() => void onLogout()}
        >
          Back to login
        </button>
      </>
    )
  }

  return (
    <>
      <PageHeader title="Account" subtitle={`Signed in as ${data.email}`} />

      <section className="panel max-w-lg">
        <header className="panel-head">
          <h2 className="panel-title">Profile</h2>
        </header>
        <dl className="panel-body space-y-4">
          <div>
            <dt className="text-muted mb-1 text-xs font-semibold tracking-wide uppercase">
              Name
            </dt>
            <dd className="cell-primary">{data.name}</dd>
          </div>
          <div>
            <dt className="text-muted mb-1 text-xs font-semibold tracking-wide uppercase">
              Email
            </dt>
            <dd className="cell-primary">{data.email}</dd>
          </div>
          <div>
            <dt className="text-muted mb-1 text-xs font-semibold tracking-wide uppercase">
              Platform admin
            </dt>
            <dd className="cell-primary">{data.isPlatformAdmin ? 'Yes' : 'No'}</dd>
          </div>
          <div>
            <dt className="text-muted mb-2 text-xs font-semibold tracking-wide uppercase">
              Memberships
            </dt>
            <dd>
              {data.memberships.length === 0 ? (
                <span className="cell-secondary">None</span>
              ) : (
                <ul className="list-plain space-y-2">
                  {data.memberships.map((m) => (
                    <li key={`${m.tenantId}-${m.role}`} className="cell-primary">
                      {formatMembership(m)}
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
        </dl>
      </section>
    </>
  )
}

function formatMembership(membership: Membership): string {
  const roleLabels: Record<string, string> = {
    tenant_admin: 'Admin',
    instructor: 'Instructor',
    learner: 'Learner',
  }
  const role = roleLabels[membership.role] ?? membership.role
  return `Tenant ${membership.tenantId} — ${role}`
}

function getMeErrorMessage(
  error: FetchBaseQueryError | SerializedError | undefined,
): string {
  if (error && 'status' in error && error.status === 401) {
    return 'Session expired. Please sign in again.'
  }
  return 'Could not load your profile.'
}
