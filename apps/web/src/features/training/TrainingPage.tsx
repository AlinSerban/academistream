import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMeQuery } from '../auth/authApi'
import { useGetVideosQuery } from '../content/contentApi'
import {
  useCreateAssignmentMutation,
  useGetAssignmentsQuery,
  useGetCompletionsQuery,
  useGetLearnersQuery,
  useGetMyAssignmentsQuery,
  useGetMyCompletionsQuery,
  useGetMyProgressQuery,
  useGetProgressQuery,
  useUpsertProgressMutation,
} from './trainingApi'

export function TrainingPage() {
  const { data: me } = useMeQuery()
  const role = me?.memberships[0]?.role
  const isStaff = role === 'tenant_admin' || role === 'instructor'
  const isLearner = role === 'learner'

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-left">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Training</h1>
          <p className="mt-1 text-sm text-slate-600">
            {me ? `Signed in as ${me.email}` : 'Assignments & progress'}
            {role ? ` · ${role}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
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
          <Link
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
            to="/me"
          >
            Profile
          </Link>
        </div>
      </div>

      {isStaff ? <StaffTraining /> : null}
      {isLearner ? <LearnerTraining /> : null}
      {!isStaff && !isLearner ? (
        <p className="text-sm text-slate-600">
          No tenant membership role for training.
        </p>
      ) : null}
    </main>
  )
}

function StaffTraining() {
  const { data: videos = [] } = useGetVideosQuery()
  const { data: learners = [] } = useGetLearnersQuery()
  const { data: assignments = [], isError: assignError } =
    useGetAssignmentsQuery()
  const { data: progress = [] } = useGetProgressQuery()
  const { data: completions = [] } = useGetCompletionsQuery()
  const [createAssignment, createState] = useCreateAssignmentMutation()

  const [videoId, setVideoId] = useState('')
  const [userId, setUserId] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const publishedReady = useMemo(
    () =>
      videos.filter(
        (v) => v.publishState === 'published' && v.mediaStatus === 'ready',
      ),
    [videos],
  )

  async function onAssign(event: FormEvent) {
    event.preventDefault()
    setMessage(null)
    try {
      await createAssignment({
        videoId: Number(videoId),
        userId: Number(userId),
      }).unwrap()
      setMessage('Assigned.')
      setVideoId('')
      setUserId('')
    } catch {
      setMessage('Assign failed (need published video + learner in tenant).')
    }
  }

  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-3 text-lg font-medium text-slate-900">
          Assign training
        </h2>
        <form className="flex flex-col gap-3" onSubmit={onAssign}>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Video
            <select
              className="rounded border border-slate-300 bg-white px-3 py-2"
              value={videoId}
              onChange={(e) => setVideoId(e.target.value)}
              required
            >
              <option value="">Select published ready video</option>
              {publishedReady.map((v) => (
                <option key={v.id} value={v.id}>
                  #{v.id} — {v.title}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Learner
            <select
              className="rounded border border-slate-300 bg-white px-3 py-2"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
            >
              <option value="">Select learner</option>
              {learners.map((l) => (
                <option key={l.userId} value={l.userId}>
                  {l.name} ({l.email})
                </option>
              ))}
            </select>
          </label>
          <button
            className="w-fit rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            type="submit"
            disabled={createState.isLoading}
          >
            {createState.isLoading ? 'Assigning…' : 'Assign'}
          </button>
        </form>
        {message ? (
          <p className="mt-2 text-sm text-slate-700">{message}</p>
        ) : null}
        {assignError ? (
          <p className="mt-2 text-sm text-red-600">Could not load assignments.</p>
        ) : null}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium text-slate-900">Assignments</h2>
        {assignments.length === 0 ? (
          <p className="text-sm text-slate-600">None yet.</p>
        ) : (
          <ul className="list-inside list-disc space-y-1 text-sm text-slate-900">
            {assignments.map((a) => (
              <li key={a.id}>
                #{a.id}: user {a.userId} → video {a.videoId}
                {a.videoTitle ? ` (${a.videoTitle})` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium text-slate-900">
          Tenant progress
        </h2>
        {progress.length === 0 ? (
          <p className="text-sm text-slate-600">No progress rows.</p>
        ) : (
          <ul className="list-inside list-disc space-y-1 text-sm text-slate-900">
            {progress.map((p) => (
              <li key={p.id}>
                user {p.userId} · video {p.videoId} · {p.percent}%
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium text-slate-900">Completions</h2>
        {completions.length === 0 ? (
          <p className="text-sm text-slate-600">No completions yet.</p>
        ) : (
          <ul className="list-inside list-disc space-y-1 text-sm text-slate-900">
            {completions.map((c) => (
              <li key={c.id}>
                user {c.userId} · video {c.videoId} ·{' '}
                {new Date(c.completedAt).toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function LearnerTraining() {
  const { data: assignments = [] } = useGetMyAssignmentsQuery()
  const { data: progress = [] } = useGetMyProgressQuery()
  const { data: completions = [] } = useGetMyCompletionsQuery()
  const [upsertProgress, upsertState] = useUpsertProgressMutation()
  const [percentByVideo, setPercentByVideo] = useState<Record<number, string>>(
    {},
  )
  const [msg, setMsg] = useState<string | null>(null)

  const progressByVideo = useMemo(() => {
    const map = new Map<number, number>()
    for (const p of progress) map.set(p.videoId, p.percent)
    return map
  }, [progress])

  const completedVideos = useMemo(
    () => new Set(completions.map((c) => c.videoId)),
    [completions],
  )

  async function onReport(videoId: number) {
    setMsg(null)
    const raw = percentByVideo[videoId] ?? '0'
    const percent = Number(raw)
    try {
      const result = await upsertProgress({ videoId, percent }).unwrap()
      setMsg(
        result.completion
          ? `Video ${videoId} completed (≥ ${result.threshold}%).`
          : `Saved ${result.progress.percent}% for video ${videoId}.`,
      )
    } catch {
      setMsg('Could not save progress (assigned + ready + published?).')
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-lg font-medium text-slate-900">
          My assignments
        </h2>
        {assignments.length === 0 ? (
          <p className="text-sm text-slate-600">No assignments yet.</p>
        ) : (
          <ul className="space-y-4">
            {assignments.map((a) => (
              <li
                key={a.id}
                className="border-t border-slate-200 pt-3 text-sm text-slate-900"
              >
                <p className="font-medium">
                  {a.videoTitle ?? `Video #${a.videoId}`}
                </p>
                <p className="mt-1 text-slate-600">
                  Progress: {progressByVideo.get(a.videoId) ?? 0}%
                  {completedVideos.has(a.videoId) ? ' · completed' : ''}
                </p>
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <label className="flex flex-col gap-1 text-xs text-slate-700">
                    Report %
                    <input
                      className="w-24 rounded border border-slate-300 px-2 py-1 text-sm"
                      type="number"
                      min={0}
                      max={100}
                      value={percentByVideo[a.videoId] ?? ''}
                      onChange={(e) =>
                        setPercentByVideo((prev) => ({
                          ...prev,
                          [a.videoId]: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <button
                    className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-60"
                    type="button"
                    disabled={upsertState.isLoading}
                    onClick={() => void onReport(a.videoId)}
                  >
                    Save progress
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {msg ? <p className="mt-3 text-sm text-slate-700">{msg}</p> : null}
      </section>
    </div>
  )
}
