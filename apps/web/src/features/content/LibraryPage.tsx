import { useCallback, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { useMeQuery } from '../auth/authApi'
import { LibraryCoursesPanel } from './LibraryCoursesPanel'
import { LibraryUploadPanel } from './LibraryUploadPanel'
import { LibraryVideosPanel } from './LibraryVideosPanel'

export function LibraryPage() {
  const { data: me } = useMeQuery()
  const isLearner = me?.memberships[0]?.role === 'learner'
  const [pollMs, setPollMs] = useState(0)

  const onMediaBusyChange = useCallback((busy: boolean) => {
    setPollMs(busy ? 2000 : 0)
  }, [])

  if (isLearner) {
    return <Navigate to="/training" replace />
  }

  return (
    <>
      <PageHeader
        title="Content library"
        subtitle={me ? `${me.email}` : undefined}
      />

      <LibraryCoursesPanel />

      <LibraryUploadPanel onUploaded={() => setPollMs(2000)} />

      <LibraryVideosPanel
        pollMs={pollMs}
        onMediaBusyChange={onMediaBusyChange}
      />
    </>
  )
}
