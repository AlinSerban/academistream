import type { ReactNode } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { AppShellOutletContext } from './AppShell'

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  const ctx = useOutletContext<AppShellOutletContext | undefined>()

  return (
    <header className="page-header">
      <div className="page-header-text">
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="page-sub">{subtitle}</p> : null}
      </div>
      <div className="page-header-meta">
        {action}
        {ctx?.tenantLabel ? (
          <div className="tenant-pill">
            <strong>{ctx.tenantLabel}</strong>
            {ctx.roleLabel ? <>, {ctx.roleLabel}</> : null}
          </div>
        ) : null}
      </div>
    </header>
  )
}
