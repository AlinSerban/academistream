import { Link } from 'react-router-dom'
import {
  useGetNotificationsQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} from './notificationsApi'

export function NotificationsPage() {
  const { data: items = [], isLoading, isError } = useGetNotificationsQuery()
  const [markRead, markState] = useMarkNotificationReadMutation()
  const [markAll, markAllState] = useMarkAllNotificationsReadMutation()

  const unread = items.filter((n) => n.readAt == null).length

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-left">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Notifications</h1>
          <p className="mt-1 text-sm text-slate-600">
            {unread > 0 ? `${unread} unread` : 'All caught up'}
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
            to="/org"
          >
            Org
          </Link>
        </div>
      </div>

      {unread > 0 ? (
        <button
          className="mb-4 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          type="button"
          disabled={markAllState.isLoading}
          onClick={() => void markAll()}
        >
          Mark all read
        </button>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-slate-600">Loading…</p>
      ) : isError ? (
        <p className="text-sm text-red-600" role="alert">
          Could not load notifications.
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-600">No notifications yet.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((n) => (
            <li
              key={n.id}
              className={`rounded border p-4 text-sm ${
                n.readAt == null
                  ? 'border-slate-400 bg-slate-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">
                    {n.title ?? n.type}
                  </p>
                  {n.body ? (
                    <p className="mt-1 text-slate-700">{n.body}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-slate-500">
                    {n.type} · {new Date(n.createdAt).toLocaleString()}
                  </p>
                </div>
                {n.readAt == null ? (
                  <button
                    className="shrink-0 rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 disabled:opacity-60"
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
      )}
    </main>
  )
}
