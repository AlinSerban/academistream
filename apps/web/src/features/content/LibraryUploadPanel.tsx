import { useState, type FormEvent } from 'react'
import { useToast } from '../../components/Toast'
import {
  useCreateVideoMutation,
  useGetCourseOptionsQuery,
  useUploadVideoMutation,
} from './contentApi'

type Props = {
  onUploaded: () => void
}

export function LibraryUploadPanel({ onUploaded }: Props) {
  const { data: courses = [] } = useGetCourseOptionsQuery()
  const [videoTitle, setVideoTitle] = useState('')
  const [courseId, setCourseId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [createVideo, createVideoState] = useCreateVideoMutation()
  const [uploadVideo, uploadVideoState] = useUploadVideoMutation()
  const { showToast } = useToast()

  async function onCreateAndUpload(event: FormEvent) {
    event.preventDefault()
    const title = videoTitle.trim()
    const parsedCourseId = Number(courseId)
    if (!title || !parsedCourseId || !file) {
      showToast({
        message: 'Title, course, and file are required.',
        tone: 'error',
      })
      return
    }
    const maxBytes = 50 * 1024 * 1024
    if (file.size > maxBytes) {
      showToast({
        message: 'File too large. Maximum upload size is 50MB.',
        tone: 'error',
      })
      return
    }
    try {
      const video = await createVideo({
        title,
        courseId: parsedCourseId,
      }).unwrap()
      await uploadVideo({ videoId: video.id, file }).unwrap()
      setVideoTitle('')
      setFile(null)
      showToast({
        message: `Uploaded "${video.title}". Waiting for processing…`,
        tone: 'success',
      })
      onUploaded()
    } catch {
      showToast({ message: 'Create or upload failed.', tone: 'error' })
    }
  }

  return (
    <section className="panel">
      <header className="panel-head">
        <h2 className="panel-title">Create & upload video</h2>
      </header>
      <div className="panel-body">
        <form className="flex max-w-lg flex-col gap-4" onSubmit={onCreateAndUpload}>
          <label className="field-label">
            Title
            <input
              className="input"
              value={videoTitle}
              onChange={(e) => setVideoTitle(e.target.value)}
              required
            />
          </label>
          <label className="field-label">
            Course
            <select
              className="select"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              required
            >
              <option value="">Select a course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
          <div className="field-label">
            File
            <label className="file-picker">
              <input
                className="file-picker-input"
                type="file"
                accept="video/*,.mp4"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
              />
              <span className="btn btn-secondary file-picker-btn" aria-hidden="true">
                Choose file
              </span>
              <span className="file-picker-name">
                {file ? file.name : 'No file selected'}
              </span>
            </label>
            <span className="text-muted text-xs">
              Maximum upload size is 50MB.
            </span>
          </div>
          <button
            className="btn btn-primary w-fit"
            type="submit"
            disabled={
              createVideoState.isLoading ||
              uploadVideoState.isLoading ||
              courses.length === 0
            }
          >
            {createVideoState.isLoading || uploadVideoState.isLoading
              ? 'Uploading…'
              : 'Create & upload'}
          </button>
        </form>
      </div>
    </section>
  )
}
