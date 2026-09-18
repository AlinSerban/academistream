import type { SerializedError } from '@reduxjs/toolkit'
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'

export function getListErrorMessage(
  error: FetchBaseQueryError | SerializedError | undefined,
): string {
  if (error && 'status' in error && error.status === 401) {
    return 'Session expired. Please sign in again.'
  }
  if (error && 'status' in error && error.status === 403) {
    return 'You do not have access to the content library (need tenant admin or instructor).'
  }
  return 'Could not load content. Is the API running?'
}
