import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useToast } from '../../components/Toast'
import { useAcceptInviteMutation } from './orgApi'

export function AcceptInvitePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [acceptInvite, state] = useAcceptInviteMutation()
  const { showToast } = useToast()
  const [token, setToken] = useState(params.get('token') ?? '')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      const result = await acceptInvite({
        token,
        name: name || undefined,
        password: password || undefined,
      }).unwrap()
      showToast({
        message: `Joined tenant ${result.tenantId} as ${result.role}. You can log in as ${result.email}.`,
        tone: 'success',
        durationMs: 4500,
      })
      setTimeout(() => navigate('/login', { replace: true }), 1500)
    } catch {
      showToast({
        message:
          'Accept failed. Invalid or expired token, or name and password (min 8) required for new users.',
        tone: 'error',
        durationMs: 5000,
      })
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-brand">Accept invite</h1>
        <p className="auth-tagline">
          Paste the one-time token from your admin. New accounts need name and password.
        </p>

        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <label className="field-label">
            Token
            <input
              className="input"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </label>
          <label className="field-label">
            Name (new users)
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field-label">
            Password (new users, min 8)
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={state.isLoading}>
            {state.isLoading ? 'Accepting…' : 'Accept invite'}
          </button>
        </form>

        <p className="mt-6 text-sm">
          <Link className="link-accent" to="/login">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  )
}
