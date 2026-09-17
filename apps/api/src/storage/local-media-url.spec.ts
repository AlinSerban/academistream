import { LocalStorageService } from './local.storage'
import {
  signLocalMediaUrl,
  verifyLocalMediaSignature,
} from './local-media-url'

describe('local-media-url', () => {
  const secret = 'test-secret'
  const key = 'tenants/1/videos/1/source.mp4'

  it('signs and verifies a URL', () => {
    const url = signLocalMediaUrl({
      baseUrl: 'https://academistream.online',
      key,
      expiresInSeconds: 600,
      secret,
      nowMs: 1_700_000_000_000,
    })
    expect(url.startsWith('https://academistream.online/api/local-media?')).toBe(
      true,
    )
    const parsed = new URL(url)
    expect(
      verifyLocalMediaSignature({
        key: parsed.searchParams.get('key')!,
        exp: parsed.searchParams.get('exp')!,
        sig: parsed.searchParams.get('sig')!,
        secret,
        nowMs: 1_700_000_000_000,
      }),
    ).toBe(true)
  })

  it('rejects expired signatures', () => {
    const url = signLocalMediaUrl({
      baseUrl: 'http://localhost:5173',
      key,
      expiresInSeconds: 10,
      secret,
      nowMs: 1_700_000_000_000,
    })
    const parsed = new URL(url)
    expect(
      verifyLocalMediaSignature({
        key: parsed.searchParams.get('key')!,
        exp: parsed.searchParams.get('exp')!,
        sig: parsed.searchParams.get('sig')!,
        secret,
        nowMs: 1_700_000_020_000,
      }),
    ).toBe(false)
  })
})

describe('LocalStorageService.getSignedGetUrl', () => {
  it('returns HTTPS local-media URL when public base is configured', async () => {
    const service = new LocalStorageService('/tmp/media', {
      publicBaseUrl: 'https://academistream.online',
      signingSecret: 'secret',
    })
    const url = await service.getSignedGetUrl('tenants/1/videos/2/source.mp4', 120)
    expect(url).toContain('https://academistream.online/api/local-media?')
    expect(url).toContain('key=tenants%2F1%2Fvideos%2F2%2Fsource.mp4')
  })
})
