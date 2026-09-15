# Academistream — credibility plan & AI positioning

Goal: turn this repo into a **professional v1 reference** for **contract / freelance / startup collab** outreach (HR screens, CTOs, founders) — not classic full-time apply-and-pray.

Location context used for research: **Romania** (system timezone `GTB Standard Time` / Athens–Bucharest). Nearshore EU overlap, English-friendly tech hubs, and rising AI/nearshore demand are relevant to how you present yourself.

Companion interview prep stays under `docs/interview/`. This file is the **go-to-market / polish backlog**.

---

## Part A — Credibility analysis (what to build toward)

### Verdict

Feature spine is already stronger than most portfolio apps. Credibility for contract/founder work comes from **hostable demo + honest docs + no fake depth**, not more Nest modules.

### Audience fit

| Audience | They scan for | Implication |
|----------|---------------|-------------|
| Founders / CTOs | Can you ship a product spine? | Demo + architecture clarity |
| HR / recruiters | README, demo link, roles, stack | UI polish + one-page story |
| Contract clients | Reliability, docs, how you’d run it | Hosted UAT + runbook |

Pitch shape: *I build multi-tenant SaaS backends / media pipelines; here’s a working reference* — not “hire me for any job.”

### Features vs polish

v1 features are enough. Higher ROI than new domains:

1. Hosted demo that always works  
2. UI that doesn’t look unfinished (critical path only)  
3. Docs that match what runs  

### Demo + credentials

Seeds already exist (Acme / Globex / roles). For outsiders:

- Top-of-README **Demo**: URL, accounts, 5-minute script (instructor upload → ready → learner play; Globex isolation fail)
- Prefer **hosted** demo over clone-only
- Screen-recording walkthrough (cold outreach almost requires it)
- Guardrails: demo-only passwords, rate limits / upload caps, nightly reset — never imply production secrets

### Technical documentation (“by the book”)

Interview STAR/panel docs help *you* talk; they are not client docs. Target a small set:

| Doc | Purpose |
|-----|---------|
| Architecture overview | Boxes, sync vs async, trust boundaries |
| Domain / data model | Tenants, roles, media vs publish |
| Auth overview | JWT, refresh cookie, RBAC convention |
| Runbook | Local + demo bring-up, seed, failures |
| Few ADRs | Kafka, MediaConvert poll, modular monolith |

`docs/engineering/SCALE_PATH.md` is a seed — expand with **triggers**, what moves first, cost/ops, out-of-scope.

### Code quality / “AI smell”

Focused honesty pass, not rewrite:

- Consistent errors, thin controllers, dead decorative infra  
- **Redis is in Compose / `.env` / spoken architecture but unused in app code** — wire a real use or remove from the story  
- Isolation + media-state tests that prove claims  
- Strip unfinished-sprint / Trello-as-hero language from main README  

### AWS host (minimal cost)

High priority. EC2 + Compose + Terraform media first; ECS/RDS as documented next step. Cap demo uploads, private bucket, small instance.

### Redis & more tests?

- **Redis:** only with a demo-visible reason (e.g. login rate limit). Else drop from narrative.  
- **Tests:** a few API+Postgres integration tests + thin e2e of the demo script beat stacking mock-only coverage. Avoid flaky Kafka-in-CI unless stable.

### Priority order

1. Cheap hosted demo + video + seed script  
2. UI polish on critical path  
3. Client-facing docs (architecture, runbook, scale-with-triggers)  
4. Honesty pass (Redis / unused pieces / README)  
5. Targeted integration/e2e (tenancy + media)  
6. Optional real Redis use **or** remove it  

### Red flags for this goal

1. No reliable public demo  
2. Story ≠ stack (unused Redis, oversold “prod”)  
3. Soft public demo without guardrails  
4. Deep backend + abandoned UI  
5. Interview docs only, no operator docs  
6. Scale slogans without triggers/cost  
7. Backlog/hobby framing on the main README  
8. Pitching as full-time replacement instead of scoped outcomes  

---

## Part B — Should you showcase AI?

### Short answer

**Yes — for tech buyers (CTOs, technical founders, serious contract clients). Showcase workflow and judgment, not “I vibe-coded this.”**  
**No — as the hero of a non-technical HR pitch** if it crowds out demo, architecture, and outcomes.  
Your instinct that “regular people dislike AI but tech looks for it” is **directionally right** (public vs expert gap). For *your* goal, buyers are closer to the tech side.

### How to showcase (safe pattern)

Lead with: product demo → architecture → tenancy/media story.  
Then one short block, e.g.:

> Development workflow uses AI-assisted tooling (e.g. Cursor) for scaffolding, tests, and docs. I own design, review every change, and verify with tests / demo scripts. I do not ship unreviewed agent output.

Optional proof artifacts (stronger than a buzzword line):

- `.cursor/rules` or short `AGENTS.md` / skill notes showing constraints  
- A short “how I use agents” note: plan → implement → review → test  
- Never: “100% AI-built” or hiding that you can’t explain MediaConvert/RBAC  

### What *not* to do

- Don’t make Academistream look like an AI product if it isn’t (confusion tax).  
- Don’t claim productivity numbers you can’t defend (see METR / Faros below).  
- Don’t list “ChatGPT” as a primary skill with no workflow story.  

---

## Part C — Research synthesis (15+ sources)

Sources below were checked for this note (2025–2026). Treat vendor blogs as directional; prefer surveys/RCTs for claims.

### Public vs tech (your perception)

| # | Source | Finding relevant to you |
|---|--------|-------------------------|
| 1 | [Pew — public vs AI experts (Apr 2025)](https://www.pewresearch.org/internet/2025/04/03/how-the-us-public-and-ai-experts-view-artificial-intelligence/) | Experts far more positive than the public on AI’s impact (e.g. positive US impact 56% experts vs 17% adults; jobs impact optimism 73% vs 23%). |
| 2 | [Pew — workers & workplace AI (Feb 2025)](https://www.pewresearch.org/social-trends/2025/02/25/workers-views-of-ai-use-in-the-workplace/) | ~52% of workers worried about workplace AI; only ~6% expect more personal job opportunities — general public/worker anxiety is real. |
| 3 | [Stack Overflow Developer Survey 2025 — AI](https://survey.stackoverflow.co/2025/ai/) | **84%** use or plan to use AI in development; **51%** of professional developers use AI **daily**. Favorable sentiment down; **46% distrust** accuracy vs 33% trust — use is high, blind trust is not. |

**Takeaway:** Non-tech audiences are wary; **professional developers already use AI as default tooling**. Your buyers (CTOs/founders) sit nearer the developer/expert side — but they also care about **verification**.

### Freelance / contract demand

| # | Source | Finding |
|---|--------|---------|
| 4 | [Upwork Monthly Hiring Report (Sep 2025)](https://www.upwork.com/research/monthly-hiring-report-september-2025) | Demand rising for skills that fight AI “workslop”; human–AI collaboration, not substitution; QA / quality control valued. |
| 5 | [Upwork — AI & web developers](https://www.upwork.com/resources/ai-replacing-web-developers-2025) | Clients want talent that **integrates AI into a structured process** and understands limits/security — not AI vs human. |
| 6 | [Upwork — in-demand skills 2026](https://www.upwork.com/resources/in-demand-jobs-and-skills) | Skills referencing AI grew ~**109% YoY**; applied AI (integration, etc.) growing fast alongside full-stack. |

**Takeaway:** Contract market rewards **AI-fluent + quality judgment**, and punishes sloppy AI output.

### CTO / startup hiring signals

| # | Source | Finding |
|---|--------|---------|
| 7 | [Codersera — hire AI-native engineers 2026](https://codersera.com/blog/hiring-ai-native-engineers-2026-claude-code-cursor/) | Screens shifting to agent orchestration + **output review**; live tool-allowed tasks; “AI-native ≠ uses Copilot autocomplete.” |
| 8 | [Refolk — Cursor fluency / AI-native pods](https://www.refolk.ai/blog/sourcing-cursor-fluency-coinbase-copilot-mandate) | Artifact and workflow writing beat tool-name skills; valuing people who use tools **and know when to turn them off**. |
| 9 | [Medium summary — JDs mentioning Copilot/Cursor/Claude](https://medium.com/@kantmusk/how-ai-coding-tools-are-changing-hiring-requirements-in-2025-1acd911a6ff1) | Startups fastest to expect AI-assisted workflows; testing/review called out as differentiators. |
| 10 | Example JDs (Databricks AI agents; FCamara Claude Code; CoreWeave GenAI tools) | Explicit requirements for LLM/agent work **and/or** daily Claude Code / Cursor / Copilot — tooling is on the checklist for some buyers. FCamara listing even includes **Romania** among eligible residency countries. |

**Takeaway:** Showcase **how you drive tools + review**, matching how serious tech teams hire in 2026.

### Quality / skepticism (why “judgment” must be in the pitch)

| # | Source | Finding |
|---|--------|---------|
| 11 | [METR RCT — early-2025 AI on experienced OSS devs](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/) | In that setting, AI-allowed tasks took **~19% longer**; developers still *felt* faster — perception ≠ measurement. |
| 12 | [Faros AI Engineering Report 2025](https://www.faros.ai/blog/lab-vs-reality-ai-productivity-study-findings) | Higher throughput / more PRs can coexist with **larger PRs, slower reviews, more bugs** — process matters. |
| 13 | DORA 2025 (via industry summaries, e.g. [ValueAdd VC roundup](https://valueaddvc.com/blog/ai-coding-productivity-2026-what-metr-github-and-dora-studies-actually-show)) | Very high AI adoption among software pros; self-reported productivity gains common — still not a license to skip verification. |

**Takeaway:** Smart buyers assume AI is used; they hire people who **catch failure modes**. Your docs/tests/demo are the proof.

### Romania / nearshore / your location

| # | Source | Finding |
|---|--------|---------|
| 14 | [BusinessForum.ro / Catalyst — AI jobs Romania (Oct 2025)](https://www.businessforum.ro/industry/20251002/ai-jobs-surge-with-major-romanian-urban-centres-leading-the-way-2381) | AI postings growing; technical roles dominate; Bucharest / Cluj / Timișoara concentration. |
| 15 | [Wise Step — hire remote RO developers 2026](https://wise-step.ro/blog/hire-remote-developers-romania/) | Large RO eng pool; AI/ML premium; Cluj AI density, Bucharest volume. |
| 16 | [Talenbrium — Romania AI-era nearshoring 2026](https://www.talenbrium.com/reports/romania-ai-nearshoring-2026) | Western EU relocating work; AI/ML & security among fastest-growing posting areas in RO hubs. |
| 17 | [Wolfpack Digital — outsource to Romania 2026](https://www.wolfpack-digital.com/blogposts/why-companies-outsource-software-development-to-romania-in-2026) | Markets RO as **AI-native coding** (Cursor, Claude Code, Copilot) + EU alignment + time overlap. |
| 18 | [Devico — EE outsourcing 2026](https://devico.io/blog/top-5-countries-for-it-outsourcing-in-eastern-europe-in-2025) | Romania remains a top nearshore destination; Western SDLC expectations. |
| 19 | [Lurus — AI coding tools for EU developers](https://code.lurus.ai/en/blog/best-ai-coding-tools-european-developers-2025/) | GDPR / data residency is a live concern for EU buyers — be ready to say how you handle secrets/client code with AI tools. |

**Takeaway for you in Romania:** Nearshore buyers already expect modern EU engineers to be **AI-tool fluent**. Positioning as “I don’t use AI” can look **outdated**; positioning as “I ship with AI + EU-conscious judgment” fits the market narrative. Timezone overlap with Western/Central Europe is a plus for contract work.

---

## Recommendation (decision)

| Do | Don’t |
|----|--------|
| Mention AI-assisted development in README / LinkedIn / proposals for **tech** audiences | Lead cold HR emails with “AI-powered developer” |
| Emphasize review, tests, security, architecture ownership | Claim the app was generated end-to-end |
| Optionally show Cursor/rules/workflow as a professionalism artifact | Pretend unused stack pieces (Redis) are production-critical |
| For regulated EU clients, address **data handling** with AI tools | Paste client secrets into cloud AI without agreement |

**One-liner you can use:**

> I build and own production-shaped systems (multi-tenant auth, async media). I use modern AI coding tools to move faster, and I treat their output like a junior pair: design, review, test, and demo before anything ships.

---

## Suggested next execution order

1. Hosted minimal-cost demo + video script  
2. README Demo section (credentials + tenant isolation beat)  
3. UI critical-path polish  
4. Client docs + expanded scale path  
5. Honesty pass (Redis)  
6. Short **AI workflow** subsection (after the above, so it never overshadows the product)  

When ready to execute items, work them one at a time.
