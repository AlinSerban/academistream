import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
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

export function OrgPage() {
  const { data: me } = useMeQuery()
  const role = me?.memberships[0]?.role
  const isAdmin = role === 'tenant_admin'
  const canSeeAudit = role === 'tenant_admin' || role === 'instructor'

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-left">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Org</h1>
          <p className="mt-1 text-sm text-slate-600">
            {me ? `Signed in as ${me.email}` : 'Invites, members, audit'}
            {role ? ` · ${role}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
            to="/"
          >
            Library
          </Link>
          <Link
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
            to="/training"
          >
            Training
          </Link>
          <Link
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
            to="/notifications"
          >
            Notifications
          </Link>
          <Link
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
            to="/me"
          >
            Profile
          </Link>
        </div>
      </div>

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
        <p className="text-sm text-slate-600">
          Org admin tools require tenant_admin (audit also visible to
          instructors).
        </p>
      ) : null}
    </main>
  )
}

function InviteSection() {
  const { data: invites = [], isError } = useGetInvitesQuery()
  const [createInvite, createState] = useCreateInviteMutation()
  const [revokeInvite, revokeState] = useRevokeInviteMutation()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<InviteRole>('learner')
  const [tokenOnce, setTokenOnce] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    setTokenOnce(null)
    try {
      const created = await createInvite({ email, role }).unwrap()
      setTokenOnce(created.token)
      setEmail('')
      setMessage(`Invite #${created.id} created — copy the token now.`)
    } catch {
      setMessage('Failed to create invite')
    }
  }

  return (
    <section className="mb-10">
      <h2 className="text-lg font-medium text-slate-900">Invites</h2>
      <p className="mt-1 text-sm text-slate-600">
        Token is shown once (local demo; no email). Expires in 7 days.
      </p>

      <form className="mt-4 flex flex-wrap items-end gap-2" onSubmit={onCreate}>
        <label className="text-sm">
          <span className="block text-slate-500">Email</span>
          <input
            className="mt-1 rounded border border-slate-300 px-2 py-1.5"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="block text-slate-500">Role</span>
          <select
            className="mt-1 rounded border border-slate-300 px-2 py-1.5"
            value={role}
            onChange={(e) => setRole(e.target.value as InviteRole)}
          >
            <option value="learner">learner</option>
            <option value="instructor">instructor</option>
            <option value="tenant_admin">tenant_admin</option>
          </select>
        </label>
        <button
          className="rounded border border-slate-800 bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-60"
          type="submit"
          disabled={createState.isLoading}
        >
          Invite
        </button>
      </form>

      {message ? (
        <p className="mt-2 text-sm text-slate-700" role="status">
          {message}
        </p>
      ) : null}
      {tokenOnce ? (
        <p className="mt-2 break-all rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-950">
          Token: {tokenOnce}
          <br />
          Accept at{' '}
          <Link className="underline" to={`/accept-invite?token=${tokenOnce}`}>
            /accept-invite
          </Link>
        </p>
      ) : null}

      {isError ? (
        <p className="mt-2 text-sm text-red-600">Could not load invites.</p>
      ) : null}

      <ul className="mt-4 space-y-2 text-sm">
        {invites.map((inv) => (
          <li
            key={inv.id}
            className="flex items-center justify-between gap-2 border-b border-slate-100 py-2"
          >
            <span>
              #{inv.id} {inv.email} · {inv.role} · expires{' '}
              {new Date(inv.expiresAt).toLocaleDateString()}
            </span>
            <button
              className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-60"
              type="button"
              disabled={revokeState.isLoading}
              onClick={() => void revokeInvite(inv.id)}
            >
              Revoke
            </button>
          </li>
        ))}
        {invites.length === 0 ? (
          <li className="text-slate-500">No pending invites.</li>
        ) : null}
      </ul>
    </section>
  )
}

function MembersSection() {
  const { data: members = [], isError } = useGetMembersQuery()
  const [removeMember, removeState] = useRemoveMemberMutation()
  const [message, setMessage] = useState<string | null>(null)

  async function onRemove(userId: number) {
    setMessage(null)
    try {
      await removeMember(userId).unwrap()
    } catch {
      setMessage('Remove failed (last tenant_admin cannot be removed).')
    }
  }

  return (
    <section className="mb-10">
      <h2 className="text-lg font-medium text-slate-900">Members</h2>
      {isError ? (
        <p className="mt-2 text-sm text-red-600">Could not load members.</p>
      ) : null}
      {message ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {message}
        </p>
      ) : null}
      <ul className="mt-4 space-y-2 text-sm">
        {members.map((m) => (
          <li
            key={m.membershipId}
            className="flex items-center justify-between gap-2 border-b border-slate-100 py-2"
          >
            <span>
              {m.name} · {m.email} · {m.role}
            </span>
            <button
              className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-60"
              type="button"
              disabled={removeState.isLoading}
              onClick={() => void onRemove(m.userId)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
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
    <section className="mb-10">
      <h2 className="text-lg font-medium text-slate-900">Completions CSV</h2>
      <p className="mt-1 text-sm text-slate-600">
        Tenant-scoped export (tenant_admin only).
      </p>
      <button
        className="mt-3 rounded border border-slate-800 bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-60"
        type="button"
        disabled={busy}
        onClick={() => void onDownload()}
      >
        {busy ? 'Downloading…' : 'Download completions.csv'}
      </button>
      {error ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}

function QuotasSection() {
  const { data, isError } = useGetQuotaUsageQuery()

  if (isError) {
    return (
      <section className="mb-10">
        <h2 className="text-lg font-medium text-slate-900">Quotas</h2>
        <p className="mt-2 text-sm text-red-600">Could not load quota usage.</p>
      </section>
    )
  }

  if (!data) {
    return (
      <section className="mb-10">
        <h2 className="text-lg font-medium text-slate-900">Quotas</h2>
        <p className="mt-2 text-sm text-slate-600">Loading usage…</p>
      </section>
    )
  }

  return (
    <section className="mb-10">
      <h2 className="text-lg font-medium text-slate-900">Quotas</h2>
      <p className="mt-1 text-sm text-slate-600">
        Tenant {data.tenantId} — members and videos vs plan limits.
      </p>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded border border-slate-200 p-3">
          <dt className="text-slate-500">Members</dt>
          <dd className="font-medium text-slate-900">
            {data.usage.members}
            {data.limits.maxUsers != null
              ? ` / ${data.limits.maxUsers}`
              : ' / unlimited'}
          </dd>
        </div>
        <div className="rounded border border-slate-200 p-3">
          <dt className="text-slate-500">Videos</dt>
          <dd className="font-medium text-slate-900">
            {data.usage.videos}
            {data.limits.maxVideos != null
              ? ` / ${data.limits.maxVideos}`
              : ' / unlimited'}
          </dd>
        </div>
      </dl>
    </section>
  )
}

function AuditSection() {
  const { data: events = [], isError } = useGetAuditEventsQuery(50)

  return (
    <section className="mb-10">
      <h2 className="text-lg font-medium text-slate-900">Audit events</h2>
      <p className="mt-1 text-sm text-slate-600">Newest first for this tenant.</p>
      {isError ? (
        <p className="mt-2 text-sm text-red-600">Could not load audit events.</p>
      ) : null}
      <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto text-sm">
        {events.map((ev) => (
          <li key={ev.id} className="border-b border-slate-100 py-2">
            <span className="font-medium">{ev.action}</span>
            {ev.entityType ? ` · ${ev.entityType}` : ''}
            {ev.entityId != null ? ` #${ev.entityId}` : ''}
            <span className="block text-xs text-slate-500">
              {new Date(ev.createdAt).toLocaleString()}
              {ev.actorUserId != null ? ` · actor ${ev.actorUserId}` : ''}
            </span>
          </li>
        ))}
        {events.length === 0 ? (
          <li className="text-slate-500">No events yet.</li>
        ) : null}
      </ul>
    </section>
  )
}
