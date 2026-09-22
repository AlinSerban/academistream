# Demo wake Worker (Cloudflare)

When someone opens the **wake URL** from the root README (`/?wake=true`) and the EC2 demo is **stopped**, this Worker:

1. Calls AWS `StartInstances`
2. Shows a **“Starting the demo…”** page
3. Polls until `/api/health` works, then reloads into the app

Bare `https://academistream.online` (no matching `wake` param) while stopped returns **Demo is asleep** and does **not** start EC2.

If EC2 is already running, traffic is proxied to the instance (Elastic IP) with or without the param.

**Auto-stop:** Cloudflare Worker **cron every 20 minutes** calls the same idle logic as `GET /__wake/idle-tick` (inside the Worker — not blocked by Bot Fight Mode).

1. Checks EC2 state - if **not running**, do nothing
2. If **running**, checks last **page navigation** time (SPA/API polls do not count)
3. Visited within the last **20 minutes** → leave running
4. No visit in 20+ minutes (or no `lastSeen` in KV) → `StopInstances`

GitHub Actions HTTP to `/__wake/idle-tick` is unreliable while **Bot Fight Mode** is on (curl cannot pass the challenge). Schedule was removed from that workflow for that reason.

`lastSeen` KV writes are throttled (at most once per 5 minutes) to stay under the Workers KV free tier.

**Bot / crawler cost control**

1. **Wake gate:** `/?wake=true` (see root README). Bare `/` while stopped stays asleep. App HTML is always served with `Cache-Control: no-store` so browsers do not keep a stale SPA that skips wake.
2. **Cloudflare Bot Fight Mode** (dashboard):
   - [dash.cloudflare.com](https://dash.cloudflare.com) → **academistream.online** → **Security** → **Bots** → **On**
   - Block AI bot policies (search / agent / training) for a people-only demo
3. **Browser navigations only** for wake + idle refresh (`Sec-Fetch-Mode: navigate`)

## Secrets

1. Cloudflare Worker: `npx wrangler secret put AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`
2. Optional: `npx wrangler secret put IDLE_TICK_SECRET` for manual `GET /__wake/idle-tick` (browser or with BFM off)

Idle stop itself uses the Worker cron — no GitHub secret required for that path.

## One-time AWS setup (IAM)

Create a dedicated IAM user with **programmatic access** and attach this policy (or inline the JSON in `iam-policy.json`):

```bash
aws iam create-user --user-name academistream-wake
aws iam put-user-policy \
  --user-name academistream-wake \
  --policy-name academistream-wake-ec2 \
  --policy-document file://iam-policy.json
aws iam create-access-key --user-name academistream-wake
```

Save the **Access Key ID** and **Secret** — you will put them in Cloudflare Worker secrets only (never commit).

Optional: tighten the policy `Resource` to your instance ARN (replace placeholders in `iam-policy.json`):

`arn:aws:ec2:eu-central-1:YOUR_AWS_ACCOUNT_ID:instance/i-YOUR_INSTANCE_ID`

(`StartInstances` supports resource-level ARNs; `DescribeInstances` often needs `*`.)

## Private deploy config

`wrangler.toml` holds your real instance id, Elastic IP, KV namespace id, and domain routes. It is **gitignored**.

```bash
cd infra/wake-worker
cp wrangler.toml.example wrangler.toml
# Edit wrangler.toml: your domain routes, KV id, EC2_INSTANCE_ID, ORIGIN_IP
```

| Var | Set to |
|-----|--------|
| `EC2_INSTANCE_ID` | Your demo EC2 instance id |
| `AWS_REGION` | Region of that instance (example: `eu-central-1`) |
| `ORIGIN_IP` | Elastic IP attached to that instance |
| `IDLE_STOP_MINUTES` | Idle window before stop (example: `20`) |
| KV `id` | Your `WAKE_KV` namespace id from the Cloudflare dashboard |

If the IP changes: update Cloudflare DNS **and** `ORIGIN_IP` in your local `wrangler.toml`, then redeploy.

## Deploy the Worker

```bash
cd infra/wake-worker
cp wrangler.toml.example wrangler.toml   # first time only; then fill real values
npm install
npx wrangler login
npx wrangler secret put AWS_ACCESS_KEY_ID
npx wrangler secret put AWS_SECRET_ACCESS_KEY
npx wrangler secret put IDLE_TICK_SECRET
npx wrangler deploy
```

Deploy only with a filled `wrangler.toml`. Never deploy placeholders against a live demo.

Do **not** release the Elastic IP while using wake-on-visit. `ORIGIN_IP` must match the address DNS points at.

Attach the custom domain in Cloudflare:

1. Workers & Pages → **academistream-wake** → **Settings** / **Domains & Routes**
2. Add routes:
   - `academistream.online/*`
   - `www.academistream.online/*`

Or:

```bash
npx wrangler domains add academistream.online
```

## Cloudflare DNS (required for wake UX)

Worker routes alone are not enough — traffic must go through Cloudflare:

1. DNS → A record `@` → your Elastic IP (same as `ORIGIN_IP`) → turn **Proxy on** (orange cloud)
2. CNAME `www` → your apex domain → **Proxy on**
3. SSL/TLS → overview → encryption mode **Full** (or **Full (strict)** while the origin cert is valid)

**Grey cloud = Worker never runs** (DNS goes straight to EC2). Wake will not work until the cloud is orange.

After proxy is on: stop the EC2 instance, open the **wake URL** from the root README, confirm the starting page, wait for the app.

## Cost notes

- Worker: free-tier friendly for demo traffic (KV writes throttled)
- EC2: pay only while **running**; stop when idle (Worker will start it again on next visit)
- Elastic IP: keep associated (small idle charge is fine vs broken wake)
- EBS: still billed while stopped

## Local check

```bash
npx wrangler dev
```

## Ops

After deploy, stop the instance and open the wake URL from the root README — you should see the starting page, then the app after ~1–2 minutes. Bare domain while stopped should show “Demo is asleep”.

Manual idle check (same as GHA):

```bash
curl -fsS -H "Authorization: Bearer $IDLE_TICK_SECRET" \
  https://academistream.online/__wake/idle-tick
```
