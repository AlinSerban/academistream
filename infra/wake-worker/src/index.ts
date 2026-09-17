import { AwsClient } from 'aws4fetch'

export interface Env {
  AWS_ACCESS_KEY_ID: string
  AWS_SECRET_ACCESS_KEY: string
  AWS_REGION: string
  EC2_INSTANCE_ID: string
  ORIGIN_IP: string
  WAKE_KV: KVNamespace
  /** Public gate token: StartInstances only when ?wake=<token> (see README URL). */
  WAKE_GATE: string
  /** Minutes without a page visit before StopInstances (default 20). */
  IDLE_STOP_MINUTES?: string
  /** Shared secret for GET /__wake/idle-tick (GitHub Actions + manual). */
  IDLE_TICK_SECRET?: string
}

const HEALTH_PATH = '/api/health'
const STATUS_PATH = '/__wake/status'
const IDLE_TICK_PATH = '/__wake/idle-tick'
const ORIGIN_TIMEOUT_MS = 2500
const LAST_SEEN_KEY = 'lastSeenMs'
const DEFAULT_IDLE_MINUTES = 20
/** Cap KV writes: at most one lastSeen update per this window (reads are cheaper). */
const TOUCH_THROTTLE_MS = 5 * 60_000

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === STATUS_PATH) {
      // Wake-page polls - do not count as user activity
      const up = await isOriginUp(env)
      return Response.json(
        { up },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    }

    // GitHub Actions (every 20m) + optional manual debug
    if (url.pathname === IDLE_TICK_PATH) {
      if (!authorizeIdleTick(request, env)) {
        return new Response('Unauthorized', { status: 401 })
      }
      const result = await maybeStopIfIdle(env)
      return Response.json(result, { headers: { 'Cache-Control': 'no-store' } })
    }

    // Let ACME / other challenges through when origin is reachable
    if (url.pathname.startsWith('/.well-known/')) {
      if (await isOriginUp(env)) {
        return proxyToOrigin(request, env)
      }
      return new Response('Origin offline', { status: 503 })
    }

    const wake = hasValidWakeGate(url, env)

    // Wake link: trust AWS instance state, not only /api/health (stale cache / race).
    if (wake) {
      const state = await getInstanceState(env)
      const up = await isOriginUp(env)
      if (!up || (state !== 'running' && state !== 'pending')) {
        const startResult = await ensureInstanceStarted(env)
        ctx.waitUntil(touchLastSeen(env, { force: true }))
        return waitingPageResponse(startResult)
      }
    }

    if (await isOriginUp(env)) {
      if (isBrowserNavigation(request)) {
        ctx.waitUntil(touchLastSeen(env))
      }
      return proxyToOrigin(request, env)
    }

    if (!wake) {
      return asleepPageResponse()
    }

    const startResult = await ensureInstanceStarted(env)
    ctx.waitUntil(touchLastSeen(env, { force: true }))
    return waitingPageResponse(startResult)
  },

  // Runs inside Cloudflare (not HTTP) — not blocked by Bot Fight Mode.
  // GitHub Actions curl to /__wake/idle-tick is challenged when BFM is on.
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    await maybeStopIfIdle(env)
  },
}

function authorizeIdleTick(request: Request, env: Env): boolean {
  const expected = env.IDLE_TICK_SECRET
  if (!expected) return false
  const auth = request.headers.get('Authorization') || ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  const header = request.headers.get('X-Idle-Tick-Secret') || ''
  return bearer === expected || header === expected
}

function hasValidWakeGate(url: URL, env: Env): boolean {
  const expected = env.WAKE_GATE
  if (!expected) return false
  return url.searchParams.get('wake') === expected
}

/**
 * Real browser document navigation (address bar / link click).
 * Most crawlers omit Sec-Fetch-Mode or use a non-navigate mode.
 */
function isBrowserNavigation(request: Request): boolean {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false
  return request.headers.get('Sec-Fetch-Mode') === 'navigate'
}

function asleepPageResponse(): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Demo asleep</title>
  <style>
    :root { --bg: #0f1714; --fg: #e8efe9; --muted: #a8b5ad; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: "Segoe UI", system-ui, sans-serif;
      background: var(--bg);
      color: var(--fg);
      padding: 1.5rem;
    }
    main { width: min(28rem, 100%); text-align: center; }
    h1 { font-size: 1.25rem; font-weight: 600; margin: 0 0 0.75rem; }
    p { margin: 0; color: var(--muted); line-height: 1.5; font-size: 0.95rem; }
  </style>
</head>
<body>
  <main>
    <h1>Demo is asleep</h1>
    <p>Open the wake link from the Academistream GitHub README to start it. Plain visits do not power on the server (cost control).</p>
  </main>
</body>
</html>`
  return new Response(html, {
    status: 503,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

async function touchLastSeen(
  env: Env,
  opts?: { force?: boolean },
): Promise<void> {
  try {
    const now = Date.now()
    if (!opts?.force) {
      const raw = await env.WAKE_KV.get(LAST_SEEN_KEY)
      const last = Number(raw)
      if (Number.isFinite(last) && now - last < TOUCH_THROTTLE_MS) return
    }
    await env.WAKE_KV.put(LAST_SEEN_KEY, String(now))
  } catch (err) {
    console.error('touchLastSeen failed', err)
  }
}

async function maybeStopIfIdle(env: Env): Promise<Record<string, unknown>> {
  const idleMinutes = Number(env.IDLE_STOP_MINUTES || DEFAULT_IDLE_MINUTES)
  const idleMs = (Number.isFinite(idleMinutes) ? idleMinutes : DEFAULT_IDLE_MINUTES) * 60_000

  const raw = await env.WAKE_KV.get(LAST_SEEN_KEY)
  if (!raw) {
    // No activity recorded: if still running, stop (avoids forever-on with empty KV)
    const state = await getInstanceState(env)
    if (state !== 'running') {
      return { action: 'skip', reason: 'no-lastSeen', state }
    }
    const stopOk = await stopInstance(env)
    return {
      action: stopOk ? 'stopped' : 'stop-failed',
      reason: 'no-lastSeen',
      state,
    }
  }

  const lastSeen = Number(raw)
  if (!Number.isFinite(lastSeen)) {
    return { action: 'skip', reason: 'bad-lastSeen' }
  }

  const idleFor = Date.now() - lastSeen
  const idleForMin = Math.round(idleFor / 60_000)
  if (idleFor < idleMs) {
    return { action: 'skip', reason: 'still-active', idleForMin, idleMinutes }
  }

  const state = await getInstanceState(env)
  if (state !== 'running') {
    return { action: 'skip', reason: 'not-running', state, idleForMin }
  }

  const stopOk = await stopInstance(env)
  return {
    action: stopOk ? 'stopped' : 'stop-failed',
    idleForMin,
    idleMinutes,
    state,
  }
}

async function getInstanceState(env: Env): Promise<string | null> {
  if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) return null

  try {
    const aws = new AwsClient({
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      retries: 2,
    })
    const endpoint = `https://ec2.${env.AWS_REGION}.amazonaws.com/`
    const describeBody = new URLSearchParams({
      Action: 'DescribeInstances',
      Version: '2016-11-15',
      'InstanceId.1': env.EC2_INSTANCE_ID,
    }).toString()

    const describeRes = await aws.fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
      body: describeBody,
    })
    if (!describeRes.ok) return null
    const xml = await describeRes.text()
    const match = xml.match(/<instanceState>\s*<code>\d+<\/code>\s*<name>([^<]+)<\/name>/)
    return match?.[1] ?? null
  } catch (err) {
    console.error('getInstanceState error', err)
    return null
  }
}

async function stopInstance(env: Env): Promise<boolean> {
  const aws = new AwsClient({
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    retries: 2,
  })
  const endpoint = `https://ec2.${env.AWS_REGION}.amazonaws.com/`
  const body = new URLSearchParams({
    Action: 'StopInstances',
    Version: '2016-11-15',
    'InstanceId.1': env.EC2_INSTANCE_ID,
  }).toString()

  const res = await aws.fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
    body,
  })
  if (!res.ok) {
    const text = await res.text()
    console.error('StopInstances failed', res.status, text.slice(0, 500))
    return false
  }
  console.log('StopInstances ok', env.EC2_INSTANCE_ID)
  return true
}

async function isOriginUp(env: Env): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ORIGIN_TIMEOUT_MS)
  try {
    // cacheTtl 0: stale cached /api/health must not look "up" while EC2 is stopped
    const res = await fetch(`https://academistream.online${HEALTH_PATH}`, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      cache: 'no-store',
      cf: { resolveOverride: env.ORIGIN_IP, cacheTtl: 0 },
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
    } as RequestInit)
    if (!res.ok) return false
    const body = (await res.json()) as { status?: string }
    return body.status === 'ok'
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

async function proxyToOrigin(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const originUrl = `https://academistream.online${url.pathname}${url.search}`

  const headers = new Headers(request.headers)
  headers.delete('cf-connecting-ip')
  headers.delete('cf-ipcountry')
  headers.delete('cf-ray')
  headers.delete('cf-visitor')
  headers.delete('cf-worker')

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: 'manual',
    cache: 'no-store',
    cf: { resolveOverride: env.ORIGIN_IP, cacheTtl: 0 },
  } as RequestInit

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body
    // @ts-expect-error duplex required for streaming bodies in Workers
    init.duplex = 'half'
  }

  const res = await fetch(originUrl, init)
  const out = new Headers(res.headers)
  out.set('Cache-Control', 'no-store')
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: out,
  })
}

async function ensureInstanceStarted(env: Env): Promise<string> {
  if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) {
    console.error('Missing AWS credentials in Worker secrets')
    return 'missing-aws-credentials'
  }

  try {
    const aws = new AwsClient({
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      retries: 2,
    })

    const endpoint = `https://ec2.${env.AWS_REGION}.amazonaws.com/`

    const describeBody = new URLSearchParams({
      Action: 'DescribeInstances',
      Version: '2016-11-15',
      'InstanceId.1': env.EC2_INSTANCE_ID,
    }).toString()

    const describeRes = await aws.fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
      body: describeBody,
    })

    if (!describeRes.ok) {
      const text = await describeRes.text()
      console.error('DescribeInstances failed', describeRes.status, text.slice(0, 300))
      return `describe-failed-${describeRes.status}`
    }

    const xml = await describeRes.text()
    const match = xml.match(/<instanceState>\s*<code>\d+<\/code>\s*<name>([^<]+)<\/name>/)
    const state = match?.[1] ?? null
    if (state === 'running' || state === 'pending') {
      return `already-${state}`
    }

    const startBody = new URLSearchParams({
      Action: 'StartInstances',
      Version: '2016-11-15',
      'InstanceId.1': env.EC2_INSTANCE_ID,
    }).toString()

    const startRes = await aws.fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
      body: startBody,
    })

    if (!startRes.ok) {
      const text = await startRes.text()
      console.error('StartInstances failed', startRes.status, text.slice(0, 500))
      return `start-failed-${startRes.status}`
    }

    console.log('StartInstances ok', env.EC2_INSTANCE_ID, 'prevState', state)
    return `start-requested-from-${state ?? 'unknown'}`
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('ensureInstanceStarted error', message)
    return `start-exception:${message}`.slice(0, 120)
  }
}

function waitingPageResponse(startResult = 'unknown'): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Starting Academistream</title>
  <style>
    :root {
      --bg: #0f1714;
      --fg: #e8efe9;
      --accent: #7cb89a;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: "Segoe UI", system-ui, sans-serif;
      background:
        radial-gradient(ellipse 80% 60% at 20% 10%, #1a2e26 0%, transparent 55%),
        radial-gradient(ellipse 70% 50% at 90% 90%, #1c2430 0%, transparent 50%),
        var(--bg);
      color: var(--fg);
    }
    main {
      width: min(28rem, calc(100% - 2rem));
      text-align: center;
    }
    h1 {
      font-size: 1.35rem;
      font-weight: 600;
      letter-spacing: 0.02em;
      margin: 0 0 0.75rem;
    }
    p {
      margin: 0;
      color: #a8b5ad;
      line-height: 1.5;
      font-size: 0.95rem;
    }
    .spinner {
      width: 2rem;
      height: 2rem;
      margin: 0 auto 1.25rem;
      border: 2px solid #2a3d34;
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    #status { margin-top: 1rem; font-size: 0.85rem; color: #7a8a82; }
  </style>
</head>
<body>
  <main>
    <div class="spinner" aria-hidden="true"></div>
    <h1>Starting the demo</h1>
    <p>The server was idle to keep costs low. It usually takes about 1-2 minutes.</p>
    <p id="status">Waking EC2…</p>
  </main>
  <script>
    const statusEl = document.getElementById('status');
    let n = 0;
    async function tick() {
      n += 1;
      try {
        const res = await fetch('/__wake/status', { cache: 'no-store' });
        const data = await res.json();
        if (data.up) {
          statusEl.textContent = 'Ready, loading…';
          location.reload();
          return;
        }
      } catch (_) {}
      const mins = Math.floor((n * 3) / 60);
      const secs = (n * 3) % 60;
      statusEl.textContent = 'Still starting… ' + mins + 'm ' + secs + 's';
      setTimeout(tick, 3000);
    }
    setTimeout(tick, 3000);
  </script>
</body>
</html>`

  return new Response(html, {
    status: 503,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Retry-After': '30',
      'X-Academistream-Wake': startResult,
    },
  })
}
