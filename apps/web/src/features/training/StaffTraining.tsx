import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  PaginationControls,
  slicePage,
} from '../../components/PaginationControls'
import { useToast } from '../../components/Toast'
import { useGetVideosQuery } from '../content/contentApi'
import {
  useCreateAssignmentMutation,
  useGetAssignmentsQuery,
  useGetCompletionsQuery,
  useGetLearnersQuery,
  useGetProgressQuery,
} from './trainingApi'

const PAGE_SIZE = 5

export function StaffTraining() {
  const { data: videos = [] } = useGetVideosQuery()
  const { data: learners = [] } = useGetLearnersQuery()
  const { data: assignments = [], isError: assignError } =
    useGetAssignmentsQuery()
  const { data: progress = [] } = useGetProgressQuery()
  const { data: completions = [] } = useGetCompletionsQuery()
  const [createAssignment, createState] = useCreateAssignmentMutation()
  const { showToast } = useToast()

  const [videoId, setVideoId] = useState('')
  const [userId, setUserId] = useState('')

  const [assignPage, setAssignPage] = useState(1)
  const [progressPage, setProgressPage] = useState(1)
  const [completionsPage, setCompletionsPage] = useState(1)

  useEffect(() => {
    setAssignPage(1)
  }, [assignments.length])
  useEffect(() => {
    setProgressPage(1)
  }, [progress.length])
  useEffect(() => {
    setCompletionsPage(1)
  }, [completions.length])

  const publishedReady = useMemo(
    () =>
      videos.filter(
        (v) => v.publishState === 'published' && v.mediaStatus === 'ready',
      ),
    [videos],
  )

  const pagedAssignments = slicePage(assignments, assignPage, PAGE_SIZE)
  const pagedProgress = slicePage(progress, progressPage, PAGE_SIZE)
  const pagedCompletions = slicePage(completions, completionsPage, PAGE_SIZE)

  async function onAssign(event: FormEvent) {
    event.preventDefault()
    try {
      await createAssignment({
        videoId: Number(videoId),
        userId: Number(userId),
      }).unwrap()
      showToast({ message: 'Assigned.', tone: 'success' })
      setVideoId('')
      setUserId('')
    } catch {
      showToast({
        message: 'Assign failed (need published video + learner in tenant).',
        tone: 'error',
      })
    }
  }

  return (
    <>
      <section className="panel">
        <header className="panel-head">
          <h2 className="panel-title">Assign training</h2>
        </header>
        <div className="panel-body">
          <form className="flex max-w-lg flex-col gap-4" onSubmit={onAssign}>
            <label className="field-label">
              Video
              <select
                className="select"
                value={videoId}
                onChange={(e) => setVideoId(e.target.value)}
                required
              >
                <option value="">Select published ready video</option>
                {publishedReady.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Learner
              <select
                className="select"
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
              className="btn btn-primary w-fit"
              type="submit"
              disabled={createState.isLoading}
            >
              {createState.isLoading ? 'Assigning…' : 'Assign'}
            </button>
          </form>
          {assignError ? (
            <p className="alert-error mt-2">Could not load assignments.</p>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <header className="panel-head">
          <h2 className="panel-title">Assignments</h2>
          {assignments.length > 0 ? (
            <span className="panel-count">
              {assignments.length}{' '}
              {assignments.length === 1 ? 'assignment' : 'assignments'}
            </span>
          ) : null}
        </header>
        {assignments.length === 0 ? (
          <p className="panel-empty">None yet.</p>
        ) : (
          <>
            <div className="table-scroll">
              <table className="data-table data-table-zebra">
                <thead>
                  <tr>
                    <th className="col-id">ID</th>
                    <th>Learner</th>
                    <th>Video</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedAssignments.map((a) => (
                    <tr key={a.id}>
                      <td className="col-id cell-id">{a.id}</td>
                      <td className="cell-secondary">User {a.userId}</td>
                      <td className="cell-primary">
                        {a.videoTitle ?? `Video ${a.videoId}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationControls
              page={assignPage}
              pageSize={PAGE_SIZE}
              total={assignments.length}
              onPageChange={setAssignPage}
            />
          </>
        )}
      </section>

      <section className="panel">
        <header className="panel-head">
          <h2 className="panel-title">Tenant progress</h2>
          {progress.length > 0 ? (
            <span className="panel-count">
              {progress.length} {progress.length === 1 ? 'row' : 'rows'}
            </span>
          ) : null}
        </header>
        {progress.length === 0 ? (
          <p className="panel-empty">No progress rows.</p>
        ) : (
          <>
            <div className="table-scroll">
              <table className="data-table data-table-zebra">
                <thead>
                  <tr>
                    <th className="col-id">ID</th>
                    <th>Learner</th>
                    <th>Video</th>
                    <th>Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedProgress.map((p) => (
                    <tr key={p.id}>
                      <td className="col-id cell-id">{p.id}</td>
                      <td className="cell-secondary">User {p.userId}</td>
                      <td className="cell-secondary">Video {p.videoId}</td>
                      <td className="cell-primary">{p.percent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationControls
              page={progressPage}
              pageSize={PAGE_SIZE}
              total={progress.length}
              onPageChange={setProgressPage}
            />
          </>
        )}
      </section>

      <section className="panel">
        <header className="panel-head">
          <h2 className="panel-title">Completions</h2>
          {completions.length > 0 ? (
            <span className="panel-count">
              {completions.length}{' '}
              {completions.length === 1 ? 'completion' : 'completions'}
            </span>
          ) : null}
        </header>
        {completions.length === 0 ? (
          <p className="panel-empty">No completions yet.</p>
        ) : (
          <>
            <div className="table-scroll">
              <table className="data-table data-table-zebra">
                <thead>
                  <tr>
                    <th className="col-id">ID</th>
                    <th>Learner</th>
                    <th>Video</th>
                    <th>Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedCompletions.map((c) => (
                    <tr key={c.id}>
                      <td className="col-id cell-id">{c.id}</td>
                      <td className="cell-secondary">User {c.userId}</td>
                      <td className="cell-secondary">Video {c.videoId}</td>
                      <td className="cell-secondary">
                        {new Date(c.completedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationControls
              page={completionsPage}
              pageSize={PAGE_SIZE}
              total={completions.length}
              onPageChange={setCompletionsPage}
            />
          </>
        )}
      </section>
    </>
  )
}
