import { createHmac, timingSafeEqual } from 'crypto'

/** HMAC helpers for public local-media URLs (video tags cannot send Authorization). */

export function signLocalMediaUrl(params: {
  baseUrl: string
  key: string
  expiresInSeconds: number
  secret: string
  nowMs?: number
}): string {
  const now = params.nowMs ?? Date.now()
  const exp = Math.floor(now / 1000) + Math.max(1, Math.round(params.expiresInSeconds))
  const sig = hmac(params.secret, params.key, exp)
  const url = new URL('/api/local-media', trimSlash(params.baseUrl))
  url.searchParams.set('key', params.key)
  url.searchParams.set('exp', String(exp))
  url.searchParams.set('sig', sig)
  return url.toString()
}

export function verifyLocalMediaSignature(params: {
  key: string
  exp: string
  sig: string
  secret: string
  nowMs?: number
}): boolean {
  const expNum = Number(params.exp)
  if (!Number.isFinite(expNum) || expNum <= 0) return false
  const nowSec = Math.floor((params.nowMs ?? Date.now()) / 1000)
  if (expNum < nowSec) return false
  const expected = hmac(params.secret, params.key, expNum)
  try {
    const a = Buffer.from(expected, 'hex')
    const b = Buffer.from(params.sig, 'hex')
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

function hmac(secret: string, key: string, exp: number): string {
  return createHmac('sha256', secret).update(`${key}.${exp}`).digest('hex')
}

function trimSlash(base: string): string {
  return base.replace(/\/+$/, '')
}
