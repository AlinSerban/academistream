import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { SerializedError } from '@reduxjs/toolkit'
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import {
  PaginationControls,
  slicePage,
} from '../../components/PaginationControls'
import { useCreateCourseMutation } from './contentApi'
import type { Course } from './types'
import { getListErrorMessage } from './libraryErrors'

const COURSE_PAGE_SIZE = 5

type Props = {
  courses: Course[]
  coursesLoading: boolean
  coursesError: boolean
  coursesErr: FetchBaseQueryError | SerializedError | undefined
}

export function LibraryCoursesPanel({
  courses,
  coursesLoading,
  coursesError,
  coursesErr,
}: Props) {
  const [courseTitle, setCourseTitle] = useState('')
  const [courseQuery, setCourseQuery] = useState('')
  const [coursePage, setCoursePage] = useState(1)
  const [createCourse, createCourseState] = useCreateCourseMutation()

  const filteredCourses = useMemo(() => {
    const q = courseQuery.trim().toLowerCase()
    const list = !q
      ? courses
      : courses.filter(
          (c) => c.title.toLowerCase().includes(q) || String(c.id).includes(q),
        )
    return [...list].sort((a, b) => b.id - a.id)
  }, [courses, courseQuery])

  useEffect(() => {
    setCoursePage(1)
  }, [courseQuery, courses.length])

  const pagedCourses = slicePage(filteredCourses, coursePage, COURSE_PAGE_SIZE)

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
        {!coursesLoading && !coursesError && courses.length > 0 ? (
          <span className="panel-count">
            {courseQuery.trim()
              ? `${filteredCourses.length} of ${courses.length}`
              : `${courses.length} ${courses.length === 1 ? 'course' : 'courses'}`}
          </span>
        ) : null}
      </header>

      {coursesLoading ? (
        <p className="panel-empty">Loading courses…</p>
      ) : coursesError ? (
        <p className="alert-error panel-empty" role="alert">
          {getListErrorMessage(coursesErr)}
        </p>
      ) : courses.length === 0 ? (
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
                {filteredCourses.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="cell-secondary">
                      No courses match that search.
                    </td>
                  </tr>
                ) : (
                  pagedCourses.map((c) => (
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
            pageSize={COURSE_PAGE_SIZE}
            total={filteredCourses.length}
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
