import { useEffect, useRef, type MouseEvent } from 'react'
import { flushSync } from 'react-dom'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useLogoutMutation, useMeQuery } from '../features/auth/authApi'

type NavItem = {
  to: string
  label: string
  end?: boolean
}

const staffNav: NavItem[] = [
  { to: '/', label: 'Library', end: true },
  { to: '/training', label: 'Training' },
  { to: '/org', label: 'Organization' },
  { to: '/notifications', label: 'Notifications' },
  { to: '/me', label: 'Account' },
]

const learnerNav: NavItem[] = [
  { to: '/training', label: 'My training', end: true },
  { to: '/notifications', label: 'Notifications' },
  { to: '/me', label: 'Account' },
]

const roleLabels: Record<string, string> = {
  tenant_admin: 'Admin',
  instructor: 'Instructor',
  learner: 'Learner',
}

export type AppShellOutletContext = {
  tenantLabel: string
  roleLabel: string
}

export function AppShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const { data: me } = useMeQuery()
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation()

  const pendingPathRef = useRef<string | null>(null)
  const coalesceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const membership = me?.memberships[0]
  const role = membership?.role
  const isLearner = role === 'learner'
  const navItems = isLearner ? learnerNav : staffNav

  const tenantLabel = membership
    ? `Tenant ${membership.tenantId}`
    : me?.isPlatformAdmin
      ? 'Platform'
      : '—'
  const roleLabel = role
    ? (roleLabels[role] ?? role)
    : me?.isPlatformAdmin
      ? 'Admin'
      : ''

  // Learners landing on staff-only Library should go to training.
  useEffect(() => {
    if (isLearner && location.pathname === '/') {
      navigate('/training', { replace: true })
    }
  }, [isLearner, location.pathname, navigate])

  // If the address bar and React route ever drift, pull React back to the URL.
  useEffect(() => {
    const syncFromWindow = () => {
      const path = window.location.pathname
      if (path !== location.pathname) {
        flushSync(() => {
          navigate(path, { replace: true })
        })
      }
    }
    window.addEventListener('popstate', syncFromWindow)
    const id = window.setInterval(syncFromWindow, 300)
    return () => {
      window.removeEventListener('popstate', syncFromWindow)
      window.clearInterval(id)
    }
  }, [location.pathname, navigate])

  function onNavClick(event: MouseEvent<HTMLAnchorElement>, to: string) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return
    }

    event.preventDefault()
    pendingPathRef.current = to

    if (coalesceTimerRef.current != null) {
      clearTimeout(coalesceTimerRef.current)
    }
    coalesceTimerRef.current = setTimeout(() => {
      coalesceTimerRef.current = null
      const target = pendingPathRef.current
      pendingPathRef.current = null
      if (target == null) return
      flushSync(() => {
        navigate(target)
      })
    }, 50)
  }

  async function onLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <div className="sidebar-brand">Academistream</div>
        <nav className="sidebar-nav">
          {navItems.map(({ to, label, end }) => {
            const isActive = end
              ? location.pathname === to
              : location.pathname === to ||
                location.pathname.startsWith(`${to}/`)
            return (
              <a
                key={to}
                href={to}
                className={isActive ? 'nav-link nav-link-active' : 'nav-link'}
                aria-current={isActive ? 'page' : undefined}
                onClick={(event) => onNavClick(event, to)}
              >
                {label}
              </a>
            )
          })}
        </nav>
        <div className="sidebar-footer">
          <button
            type="button"
            className="sidebar-logout"
            disabled={isLoggingOut}
            onClick={() => void onLogout()}
          >
            {isLoggingOut ? 'Signing out…' : 'Log out'}
          </button>
        </div>
      </aside>
      <div className="app-main">
        <div className="app-main-body">
          <Outlet context={{ tenantLabel, roleLabel } satisfies AppShellOutletContext} />
        </div>
      </div>
    </div>
  )
}
