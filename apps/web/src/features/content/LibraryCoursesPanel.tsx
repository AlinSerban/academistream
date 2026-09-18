import { useEffect, useState, type FormEvent } from 'react'
import {
  PaginationControls,
} from '../../components/PaginationControls'
import { useCreateCourseMutation, useGetCoursesQuery } from './contentApi'
import { getListErrorMessage } from './libraryErrors'
import { DEFAULT_PAGE_SIZE } from '../../lib/pagination'

export function LibraryCoursesPanel() {
  const [courseTitle, setCourseTitle] = useState('')
  const [courseQuery, setCourseQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [coursePage, setCoursePage] = useState(1)
  const [createCourse, createCourseState] = useCreateCourseMutation()

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(courseQuery), 250)
    return () => window.clearTimeout(t)
  }, [courseQuery])

  useEffect(() => {
    setCoursePage(1)
  }, [debouncedQuery])

  const {
    data,
    isLoading: coursesLoading,
    isError: coursesError,
    error: coursesErr,
  } = useGetCoursesQuery({
    page: coursePage,
    pageSize: DEFAULT_PAGE_SIZE,
    q: debouncedQuery || undefined,
  })

  const courses = data?.items ?? []
  const total = data?.total ?? 0

  async function onCreateCourse(event: FormEvent) {
    event.preventDefault()
    const title = courseTitle.trim()
    if (!title) return
    try {
      await createCourse({ title }).unwrap()
      setCourseTitle('')
      setCourseQuery('')
      setCoursePage(1)
    } catch {
      // mutation error shown below
    }
  }

  return (
    <section className="panel">
      <header className="panel-head">
        <h2 className="panel-title">Courses</h2>
        {!coursesLoading && !coursesError && total > 0 ? (
          <span className="panel-count">
            {debouncedQuery.trim()
              ? `${total} match${total === 1 ? '' : 'es'}`
              : `${total} ${total === 1 ? 'course' : 'courses'}`}
          </span>
        ) : null}
      </header>

      {coursesLoading ? (
        <p className="panel-empty">Loading courses…</p>
      ) : coursesError ? (
        <p className="alert-error panel-empty" role="alert">
          {getListErrorMessage(coursesErr)}
        </p>
      ) : total === 0 && !debouncedQuery.trim() ? (
        <p className="panel-empty">No courses yet. Create one below.</p>
      ) : (
        <>
          <div className="table-scroll">
            <table className="data-table data-table-zebra">
              <thead>
                <tr>
                  <th className="col-id">ID</th>
                  <th>Course</th>
                  <th className="col-search">
                    <label className="sr-only" htmlFor="course-search">
                      Search courses
                    </label>
                    <input
                      id="course-search"
                      className="input"
                      type="search"
                      placeholder="Search…"
                      value={courseQuery}
                      onChange={(e) => setCourseQuery(e.target.value)}
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {courses.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="cell-secondary">
                      No courses match that search.
                    </td>
                  </tr>
                ) : (
                  courses.map((c) => (
                    <tr key={c.id}>
                      <td className="col-id cell-id">{c.id}</td>
                      <td className="cell-primary">{c.title}</td>
                      <td aria-hidden="true" />
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <PaginationControls
            page={coursePage}
            pageSize={DEFAULT_PAGE_SIZE}
            total={total}
            onPageChange={setCoursePage}
          />
        </>
      )}

      <div className="panel-footer">
        <p className="panel-footer-label">Add course</p>
        <form className="form-row" onSubmit={onCreateCourse}>
          <div className="form-row-controls">
            <input
              className="input"
              value={courseTitle}
              onChange={(e) => setCourseTitle(e.target.value)}
              placeholder="Course title"
              required
              aria-label="New course title"
            />
            <button
              className="btn btn-primary"
              type="submit"
              disabled={createCourseState.isLoading}
            >
              {createCourseState.isLoading ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
        {createCourseState.isError ? (
          <p className="alert-error mt-2" role="alert">
            Could not create course.
          </p>
        ) : null}
      </div>
    </section>
  )
}
