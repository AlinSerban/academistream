import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAcceptInviteMutation } from './orgApi'

export function AcceptInvitePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [acceptInvite, state] = useAcceptInviteMutation()
  const [token, setToken] = useState(params.get('token') ?? '')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    try {
      const result = await acceptInvite({
        token,
        name: name || undefined,
        password: password || undefined,
      }).unwrap()
      setMessage(
        `Joined tenant ${result.tenantId} as ${result.role}. You can log in as ${result.email}.`,
      )
      setTimeout(() => navigate('/login', { replace: true }), 1500)
    } catch {
      setMessage(
        'Accept failed — invalid/expired token, or name+password (min 8) required for new users.',
      )
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10 text-left">
      <h1 className="text-2xl font-semibold text-slate-900">Accept invite</h1>
      <p className="mt-1 text-sm text-slate-600">
        Paste the one-time token from your admin. New accounts need name and
        password.
      </p>

      <form className="mt-6 space-y-3" onSubmit={onSubmit}>
        <label className="block text-sm">
          <span className="text-slate-500">Token</span>
          <input
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5"
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-500">Name (new users)</span>
          <input
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-500">Password (new users, min 8)</span>
          <input
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button
          className="rounded border border-slate-800 bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-60"
          type="submit"
          disabled={state.isLoading}
        >
          Accept
        </button>
      </form>

      {message ? (
        <p className="mt-4 text-sm text-slate-700" role="status">
          {message}
        </p>
      ) : null}

      <p className="mt-6 text-sm">
        <Link className="text-slate-700 underline" to="/login">
          Back to login
        </Link>
      </p>
    </main>
  )
}
