/** Default 50 MiB — keeps MediaConvert/S3 demo costs bounded. */
export const DEFAULT_UPLOAD_MAX_BYTES = 50 * 1024 * 1024

export function resolveUploadMaxBytes(
  raw: string | undefined = process.env.UPLOAD_MAX_BYTES,
): number {
  if (raw == null || raw.trim() === '') return DEFAULT_UPLOAD_MAX_BYTES
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`UPLOAD_MAX_BYTES must be a positive number (got ${raw})`)
  }
  return Math.floor(n)
}

export function formatUploadMaxLabel(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  if (Number.isInteger(mb)) return `${mb}MB`
  return `${mb.toFixed(1)}MB`
}
