import {
  DEFAULT_UPLOAD_MAX_BYTES,
  formatUploadMaxLabel,
  resolveUploadMaxBytes,
} from './upload-limits'

describe('upload-limits', () => {
  const prev = process.env.UPLOAD_MAX_BYTES

  afterEach(() => {
    if (prev === undefined) delete process.env.UPLOAD_MAX_BYTES
    else process.env.UPLOAD_MAX_BYTES = prev
  })

  it('defaults to 50 MiB', () => {
    expect(resolveUploadMaxBytes(undefined)).toBe(DEFAULT_UPLOAD_MAX_BYTES)
    expect(formatUploadMaxLabel(DEFAULT_UPLOAD_MAX_BYTES)).toBe('50MB')
  })

  it('parses env override', () => {
    expect(resolveUploadMaxBytes('1048576')).toBe(1048576)
  })
})
