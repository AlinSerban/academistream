import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { useMeQuery } from '../auth/authApi'
import { useGetCoursesQuery, useGetVideosQuery } from './contentApi'
import { LibraryCoursesPanel } from './LibraryCoursesPanel'
import { LibraryUploadPanel } from './LibraryUploadPanel'
import { LibraryVideosPanel } from './LibraryVideosPanel'

export function LibraryPage() {
  const { data: me } = useMeQuery()
  const isLearner = me?.memberships[0]?.role === 'learner'
  const {
    data: courses = [],
    isLoading: coursesLoading,
    isError: coursesError,
    error: coursesErr,
  } = useGetCoursesQuery(undefined, {
    skip: me == null || isLearner,
  })

  const [pollMs, setPollMs] = useState(0)
  const {
    data: videos = [],
    isLoading: videosLoading,
    isError: videosError,
    error: videosErr,
  } = useGetVideosQuery(undefined, {
    pollingInterval: pollMs,
    skip: me == null || isLearner,
  })

  const mediaBusy = videos.some(
    (v) => v.mediaStatus === 'queued' || v.mediaStatus === 'processing',
  )

  useEffect(() => {
    setPollMs(mediaBusy ? 2000 : 0)
  }, [mediaBusy])

  const courseTitleById = useMemo(() => {
    const map = new Map<number, string>()
    for (const c of courses) map.set(c.id, c.title)
    return map
  }, [courses])

  if (isLearner) {
    return <Navigate to="/training" replace />
  }

  return (
    <>
      <PageHeader
        title="Content library"
        subtitle={me ? `${me.email}` : undefined}
      />

      <LibraryCoursesPanel
        courses={courses}
        coursesLoading={coursesLoading}
        coursesError={coursesError}
        coursesErr={coursesErr}
      />

      <LibraryUploadPanel
        courses={courses}
        onUploaded={() => setPollMs(2000)}
      />

      <LibraryVideosPanel
        videos={videos}
        videosLoading={videosLoading}
        videosError={videosError}
        videosErr={videosErr}
        courseTitleById={courseTitleById}
      />
    </>
  )
}
