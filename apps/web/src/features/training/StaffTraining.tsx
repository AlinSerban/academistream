import { useState, type FormEvent } from 'react'
import { PaginationControls } from '../../components/PaginationControls'
import { useToast } from '../../components/Toast'
import { useGetAssignableVideosQuery } from '../content/contentApi'
import {
  useCreateAssignmentMutation,
  useGetAssignmentsQuery,
  useGetCompletionsQuery,
  useGetLearnersQuery,
  useGetProgressQuery,
} from './trainingApi'
import { DEFAULT_PAGE_SIZE } from '../../lib/pagination'

export function StaffTraining() {
  const [assignPage, setAssignPage] = useState(1)
  const [progressPage, setProgressPage] = useState(1)
  const [completionsPage, setCompletionsPage] = useState(1)
  const [learnerPage] = useState(1)

  const { data: assignable } = useGetAssignableVideosQuery({
    page: 1,
    pageSize: 50,
  })
  const { data: learnersPage } = useGetLearnersQuery({
    page: learnerPage,
    pageSize: 50,
  })
  const { data: assignmentsPage, isError: assignError } = useGetAssignmentsQuery(
    { page: assignPage, pageSize: DEFAULT_PAGE_SIZE },
  )
  const { data: progressPageData } = useGetProgressQuery({
    page: progressPage,
    pageSize: DEFAULT_PAGE_SIZE,
  })
  const { data: completionsPageData } = useGetCompletionsQuery({
    page: completionsPage,
    pageSize: DEFAULT_PAGE_SIZE,
  })

  const publishedReady = assignable?.items ?? []
  const learners = learnersPage?.items ?? []
  const assignments = assignmentsPage?.items ?? []
  const progress = progressPageData?.items ?? []
  const completions = completionsPageData?.items ?? []

  const [createAssignment, createState] = useCreateAssignmentMutation()
  const { showToast } = useToast()
  const [videoId, setVideoId] = useState('')
  const [userId, setUserId] = useState('')

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
          {(assignmentsPage?.total ?? 0) > 0 ? (
            <span className="panel-count">
              {assignmentsPage?.total}{' '}
              {assignmentsPage?.total === 1 ? 'assignment' : 'assignments'}
            </span>
          ) : null}
        </header>
        {(assignmentsPage?.total ?? 0) === 0 ? (
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
                  {assignments.map((a) => (
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
              pageSize={DEFAULT_PAGE_SIZE}
              total={assignmentsPage?.total ?? 0}
              onPageChange={setAssignPage}
            />
          </>
        )}
      </section>

      <section className="panel">
        <header className="panel-head">
          <h2 className="panel-title">Tenant progress</h2>
          {(progressPageData?.total ?? 0) > 0 ? (
            <span className="panel-count">
              {progressPageData?.total}{' '}
              {progressPageData?.total === 1 ? 'row' : 'rows'}
            </span>
          ) : null}
        </header>
        {(progressPageData?.total ?? 0) === 0 ? (
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
                  {progress.map((p) => (
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
              pageSize={DEFAULT_PAGE_SIZE}
              total={progressPageData?.total ?? 0}
              onPageChange={setProgressPage}
            />
          </>
        )}
      </section>

      <section className="panel">
        <header className="panel-head">
          <h2 className="panel-title">Completions</h2>
          {(completionsPageData?.total ?? 0) > 0 ? (
            <span className="panel-count">
              {completionsPageData?.total}{' '}
              {completionsPageData?.total === 1 ? 'completion' : 'completions'}
            </span>
          ) : null}
        </header>
        {(completionsPageData?.total ?? 0) === 0 ? (
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
                  {completions.map((c) => (
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
              pageSize={DEFAULT_PAGE_SIZE}
              total={completionsPageData?.total ?? 0}
              onPageChange={setCompletionsPage}
            />
          </>
        )}
      </section>
    </>
  )
}
