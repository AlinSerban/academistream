import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import {
  PaginationControls,
  slicePage,
} from '../../components/PaginationControls'
import { useToast } from '../../components/Toast'
import { formatAuditAction, formatEntityType } from '../../lib/eventLabels'
import { useMeQuery } from '../auth/authApi'
import { useAppSelector } from '../../app/hooks'
import {
  useCreateInviteMutation,
  useGetAuditEventsQuery,
  useGetInvitesQuery,
  useGetMembersQuery,
  useRemoveMemberMutation,
  useRevokeInviteMutation,
} from './orgApi'
import type { InviteRole } from './types'
import { useGetQuotaUsageQuery } from '../quotas/quotasApi'

const PAGE_SIZE = 5

export function OrgPage() {
  const { data: me } = useMeQuery()
  const role = me?.memberships[0]?.role
  const isAdmin = role === 'tenant_admin'
  const canSeeAudit = role === 'tenant_admin' || role === 'instructor'

  if (role === 'learner') {
    return <Navigate to="/training" replace />
  }

  return (
    <>
      <PageHeader
        title="Organization"
        subtitle={me ? me.email : 'Invites, members, and audit'}
      />

      {isAdmin ? (
        <>
          <QuotasSection />
          <InviteSection />
          <MembersSection />
          <CsvExportSection />
        </>
      ) : null}
      {canSeeAudit ? <AuditSection /> : null}
      {role === 'instructor' ? <QuotasSection /> : null}
      {!isAdmin && !canSeeAudit ? (
        <section className="panel">
          <header className="panel-head">
            <h2 className="panel-title">Organization</h2>
          </header>
          <div className="panel-body">
            <p className="cell-primary mb-2">Admin tools</p>
            <p className="text-muted text-sm">
              Invites, members, and exports require a workspace admin account.
              Instructors can still view audit activity.
            </p>
          </div>
        </section>
      ) : null}
    </>
  )
}

function InviteSection() {
  const { data: invites = [], isError } = useGetInvitesQuery()
  const [createInvite, createState] = useCreateInviteMutation()
  const [revokeInvite, revokeState] = useRevokeInviteMutation()
  const { showToast } = useToast()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<InviteRole>('learner')
  const [tokenOnce, setTokenOnce] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [invites.length])

  const paged = slicePage(invites, page, PAGE_SIZE)

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setTokenOnce(null)
    try {
      const created = await createInvite({ email, role }).unwrap()
      setTokenOnce(created.token)
      setEmail('')
      showToast({
        message: `Invite #${created.id} created. Copy the token below.`,
        tone: 'success',
      })
    } catch {
      showToast({ message: 'Failed to create invite', tone: 'error' })
    }
  }

  return (
    <section className="panel">
      <header className="panel-head">
        <h2 className="panel-title">Invites</h2>
        {invites.length > 0 ? (
          <span className="panel-count">
            {invites.length} {invites.length === 1 ? 'invite' : 'invites'}
          </span>
        ) : null}
      </header>

      {isError ? (
        <p className="alert-error panel-empty">Could not load invites.</p>
      ) : invites.length === 0 ? (
        <p className="panel-empty">No pending invites.</p>
      ) : (
        <>
          <table className="data-table data-table-zebra">
            <thead>
              <tr>
                <th className="col-id">ID</th>
                <th>Email</th>
                <th>Role</th>
                <th>Expires</th>
                <th className="col-actions">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.map((inv) => (
                <tr key={inv.id}>
                  <td className="col-id cell-id">{inv.id}</td>
                  <td className="cell-primary">{inv.email}</td>
                  <td className="cell-secondary">{inv.role}</td>
                  <td className="cell-secondary">
                    {new Date(inv.expiresAt).toLocaleDateString()}
                  </td>
                  <td className="col-actions">
                    <button
                      className="btn btn-secondary btn-sm"
                      type="button"
                      disabled={revokeState.isLoading}
                      onClick={() => void revokeInvite(inv.id)}
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationControls
            page={page}
            pageSize={PAGE_SIZE}
            total={invites.length}
            onPageChange={setPage}
          />
        </>
      )}

      <div className="panel-footer">
        <p className="panel-footer-label">Invite someone</p>
        <p className="text-muted mb-3 text-sm">
          Token is shown once (local demo; no email). Expires in 7 days.
        </p>
        <form className="form-row" onSubmit={onCreate}>
          <div className="form-row-controls">
            <input
              className="input"
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Invite email"
            />
            <select
              className="select"
              style={{ flex: '0 0 10rem', minWidth: '10rem' }}
              value={role}
              onChange={(e) => setRole(e.target.value as InviteRole)}
              aria-label="Invite role"
            >
              <option value="learner">learner</option>
              <option value="instructor">instructor</option>
              <option value="tenant_admin">tenant_admin</option>
            </select>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={createState.isLoading}
            >
              Invite
            </button>
          </div>
        </form>
        {tokenOnce ? (
          <p className="alert-warn mt-3">
            Token: {tokenOnce}
            <br />
            Accept at{' '}
            <Link className="link-accent" to={`/accept-invite?token=${tokenOnce}`}>
              /accept-invite
            </Link>
          </p>
        ) : null}
      </div>
    </section>
  )
}

function MembersSection() {
  const { data: members = [], isError } = useGetMembersQuery()
  const [removeMember, removeState] = useRemoveMemberMutation()
  const { showToast } = useToast()
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [members.length])

  const paged = slicePage(members, page, PAGE_SIZE)

  async function onRemove(userId: number) {
    try {
      await removeMember(userId).unwrap()
      showToast({ message: 'Member removed.', tone: 'success' })
    } catch {
      showToast({
        message: 'Remove failed (last tenant_admin cannot be removed).',
        tone: 'error',
      })
    }
  }

  return (
    <section className="panel">
      <header className="panel-head">
        <h2 className="panel-title">Members</h2>
        {members.length > 0 ? (
          <span className="panel-count">
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </span>
        ) : null}
      </header>
      {isError ? (
        <p className="alert-error panel-empty">Could not load members.</p>
      ) : members.length === 0 ? (
        <p className="panel-empty">No members.</p>
      ) : (
        <>
          <table className="data-table data-table-zebra">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th className="col-actions">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.map((m) => (
                <tr key={m.membershipId}>
                  <td className="cell-primary">{m.name}</td>
                  <td className="cell-secondary">{m.email}</td>
                  <td className="cell-secondary">{m.role}</td>
                  <td className="col-actions">
                    <button
                      className="btn btn-secondary btn-sm"
                      type="button"
                      disabled={removeState.isLoading}
                      onClick={() => void onRemove(m.userId)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationControls
            page={page}
            pageSize={PAGE_SIZE}
            total={members.length}
            onPageChange={setPage}
          />
        </>
      )}
    </section>
  )
}

function CsvExportSection() {
  const accessToken = useAppSelector((s) => s.auth.accessToken)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onDownload() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/exports/completions.csv', {
        credentials: 'include',
        headers: accessToken
          ? { Authorization: `Bearer ${accessToken}` }
          : undefined,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'completions.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Download failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel">
      <header className="panel-head">
        <h2 className="panel-title">Completions CSV</h2>
      </header>
      <div className="panel-body">
        <p className="text-muted mb-3 text-sm">
          Tenant-scoped export (tenant_admin only).
        </p>
        <button
          className="btn btn-primary"
          type="button"
          disabled={busy}
          onClick={() => void onDownload()}
        >
          {busy ? 'Downloading…' : 'Download completions.csv'}
        </button>
        {error ? (
          <p className="alert-error mt-2 text-sm" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  )
}

function QuotasSection() {
  const { data, isError } = useGetQuotaUsageQuery()

  if (isError) {
    return (
      <section className="panel">
        <header className="panel-head">
          <h2 className="panel-title">Quotas</h2>
        </header>
        <div className="panel-body">
          <p className="alert-error text-sm">Could not load quota usage.</p>
        </div>
      </section>
    )
  }

  if (!data) {
    return (
      <section className="panel">
        <header className="panel-head">
          <h2 className="panel-title">Quotas</h2>
        </header>
        <div className="panel-body">
          <p className="text-muted text-sm">Loading usage…</p>
        </div>
      </section>
    )
  }

  return (
    <section className="panel">
      <header className="panel-head">
        <h2 className="panel-title">Quotas</h2>
      </header>
      <div className="panel-body">
        <p className="text-muted mb-4 text-sm">
          Members and videos for tenant {data.tenantId} vs plan limits.
        </p>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="stat-card">
            <dt>Members</dt>
            <dd>
              {data.usage.members}
              {data.limits.maxUsers != null
                ? ` / ${data.limits.maxUsers}`
                : ' / unlimited'}
            </dd>
          </div>
          <div className="stat-card">
            <dt>Videos</dt>
            <dd>
              {data.usage.videos}
              {data.limits.maxVideos != null
                ? ` / ${data.limits.maxVideos}`
                : ' / unlimited'}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  )
}

function AuditSection() {
  const { data: events = [], isError } = useGetAuditEventsQuery(50)
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [events.length])

  const paged = slicePage(events, page, PAGE_SIZE)

  return (
    <section className="panel">
      <header className="panel-head">
        <h2 className="panel-title">Audit events</h2>
        {events.length > 0 ? (
          <span className="panel-count">
            {events.length} {events.length === 1 ? 'event' : 'events'}
          </span>
        ) : null}
      </header>
      {isError ? (
        <p className="alert-error panel-empty">Could not load audit events.</p>
      ) : events.length === 0 ? (
        <p className="panel-empty">No events yet.</p>
      ) : (
        <>
          <p className="text-muted px-5 pt-3 text-sm">Newest first for this tenant.</p>
          <table className="data-table data-table-zebra">
            <thead>
              <tr>
                <th>Action</th>
                <th>Entity</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((ev) => (
                <tr key={ev.id}>
                  <td className="cell-primary">{formatAuditAction(ev.action)}</td>
                  <td className="cell-secondary">
                    {ev.entityType ? formatEntityType(ev.entityType) : '-'}
                    {ev.entityId != null ? ` #${ev.entityId}` : ''}
                  </td>
                  <td className="cell-secondary">
                    {new Date(ev.createdAt).toLocaleString()}
                    {ev.actorUserId != null ? `, actor ${ev.actorUserId}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationControls
            page={page}
            pageSize={PAGE_SIZE}
            total={events.length}
            onPageChange={setPage}
          />
        </>
      )}
    </section>
  )
}
