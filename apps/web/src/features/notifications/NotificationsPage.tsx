import { useEffect, useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import {
  PaginationControls,
  slicePage,
} from '../../components/PaginationControls'
import {
  useGetNotificationsQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} from './notificationsApi'
import { formatNotificationType } from '../../lib/eventLabels'

const PAGE_SIZE = 5

export function NotificationsPage() {
  const { data: items = [], isLoading, isError } = useGetNotificationsQuery()
  const [markRead, markState] = useMarkNotificationReadMutation()
  const [markAll, markAllState] = useMarkAllNotificationsReadMutation()
  const [page, setPage] = useState(1)

  const unread = items.filter((n) => n.readAt == null).length
  const paged = slicePage(items, page, PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [items.length])

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread` : 'No unread messages'}
        action={
          unread > 0 ? (
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              disabled={markAllState.isLoading}
              onClick={() => void markAll()}
            >
              Mark all read
            </button>
          ) : undefined
        }
      />

      <section className="panel">
        <header className="panel-head">
          <h2 className="panel-title">Inbox</h2>
          {items.length > 0 ? (
            <span className="panel-count">
              {items.length}{' '}
              {items.length === 1 ? 'notification' : 'notifications'}
            </span>
          ) : null}
        </header>

        {isLoading ? (
          <p className="panel-empty">Loading…</p>
        ) : isError ? (
          <p className="alert-error panel-empty" role="alert">
            Could not load notifications.
          </p>
        ) : items.length === 0 ? (
          <div className="panel-body">
            <p className="cell-primary mb-2">Inbox is empty</p>
            <p className="text-muted text-sm">
              New training updates will show up here.
            </p>
          </div>
        ) : (
          <>
            <ul className="list-plain notification-list">
              {paged.map((n) => (
                <li
                  key={n.id}
                  className={
                    n.readAt == null
                      ? 'notification-item notification-item-unread'
                      : 'notification-item'
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="cell-primary">
                        {n.title ?? formatNotificationType(n.type)}
                      </p>
                      {n.body ? (
                        <p className="cell-secondary mt-1">{n.body}</p>
                      ) : null}
                      <p className="cell-meta">
                        {formatNotificationType(n.type)} ·{' '}
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {n.readAt == null ? (
                      <button
                        className="btn btn-secondary btn-sm shrink-0"
                        type="button"
                        disabled={markState.isLoading}
                        onClick={() => void markRead(n.id)}
                      >
                        Mark read
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
            <PaginationControls
              page={page}
              pageSize={PAGE_SIZE}
              total={items.length}
              onPageChange={setPage}
            />
          </>
        )}
      </section>
    </>
  )
}
