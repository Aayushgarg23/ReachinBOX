# ReachInbox — Full-Stack Email Job Scheduler

> **Hiring Assignment for ReachInbox.ai / Outbox Labs**
> Production-grade email scheduler service + dashboard. Schedules and sends emails at scale using BullMQ delayed jobs (zero cron), MySQL as source of truth, Redis for queue state + rate limiting, and Ethereal SMTP for fake email capture.

---

## 📺 Feature Demo

| Feature | Where |
|---|---|
| Google OAuth login | http://localhost:3000 |
| Dashboard (Scheduled/Sent tabs) | http://localhost:3000/dashboard |
| Compose new email + CSV upload | http://localhost:3000/compose |
| Backend health check | http://localhost:4000/health |
| View sent emails in browser | Ethereal preview URL in backend logs |

---

## 🚀 How to Run

### Prerequisites
- Node.js 18+
- Docker Desktop (for MySQL + Redis)
- Google OAuth credentials ([setup guide below](#google-oauth-setup))

---

### Step 1 — Start Infrastructure (MySQL + Redis)

```bash
docker-compose up -d
```

Wait ~15 seconds for containers to be healthy.

---

### Step 2 — Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env if needed (defaults work out of the box)

npm install
npx prisma migrate dev --name init --skip-seed
npx ts-node prisma/seed.ts    # Creates 2 Ethereal SMTP senders

npm run dev                   # Starts on :4000
```

**On boot, the server:**
1. Connects to MySQL + Redis
2. Starts the BullMQ Worker
3. Runs **reconciliation** (re-queues any pending jobs that survived restart)
4. Listens for API requests

---

### Step 3 — Frontend Setup

```bash
cd frontend
cp .env.example .env.local
# Fill in GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (see below)

npm install
npm run dev                   # Starts on :3000
```

---

### Google OAuth Setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create Project → **APIs & Services → Credentials → Create OAuth 2.0 Client ID**
3. Application type: **Web application**
4. Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
5. Copy Client ID + Secret into `frontend/.env.local`

---

### Ethereal Email Setup

**No manual setup needed.** The seed script (`npx ts-node prisma/seed.ts`) auto-creates 2 Ethereal test accounts and saves them to `backend/.ethereal-accounts.json`.

**To view sent emails:**
- Check backend terminal logs — every sent email prints a direct **Ethereal preview URL**
- Or visit [ethereal.email](https://ethereal.email) and log in with credentials from `.ethereal-accounts.json`
- Emails are **not delivered to real inboxes** — they are captured by Ethereal for inspection

```
📧 Email sent to john@example.com
   Preview URL: https://ethereal.email/message/xyz...
```

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | Express port |
| `DATABASE_URL` | `mysql://root:rootpassword@localhost:3306/reachinbox` | MySQL connection |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection |
| `WORKER_CONCURRENCY` | `5` | Parallel BullMQ job slots |
| `MIN_DELAY_MS` | `1000` | **Minimum 1 second between individual sends** |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | `100` | Default hourly cap (overridden per-sender in DB) |
| `API_SECRET` | `reachinbox-dev-secret-2024` | Shared secret between Next.js and Express |
| `FRONTEND_URL` | `http://localhost:3000` | CORS origin |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|---|---|
| `NEXTAUTH_URL` | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | Random secret for JWT (any string in dev) |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |
| `BACKEND_URL` | `http://localhost:4000` (server-side only) |
| `API_SECRET` | Must match backend `API_SECRET` |

---

## 🏗️ Architecture Overview

### How Scheduling Works

```
POST /api/campaigns
  │
  ├─ Validate request (Zod)
  ├─ Create Campaign row in MySQL
  ├─ Bulk-insert Email rows (one per recipient)
  │    scheduledTime = startTime + (index × delayBetweenMs)
  │    id = UUID (this becomes the BullMQ jobId)
  │
  └─ queue.addBulk([...])
       Each job: { jobId: email.id, delay: scheduledTime - now() }
       BullMQ stores jobs in Redis with precise TTL delays
```

When a job's delay expires, BullMQ moves it from the delayed set to the active set, and the worker processes it.

**Key design:** `email.id` (UUID) = BullMQ `jobId`. This is the idempotency key — BullMQ silently ignores duplicate `add()` calls with the same jobId.

---

### How Restart Persistence Works

**MySQL is the source of truth. Redis is ephemeral.**

On every server/worker boot, `reconcile.ts` runs:

```
1. Query MySQL: SELECT * FROM emails
   WHERE status IN ('pending','queued','rescheduled')
   AND scheduledTime > NOW()

2. For each row: check if queue.getJob(email.id) exists in Redis

3. If missing → queue.add('send-email', data, {
     jobId: email.id,
     delay: scheduledTime - Date.now()   ← correct remaining delay
   })
```

If Redis is wiped and restarted, all scheduled emails are **automatically recovered from MySQL** with exact remaining delays. Emails are never resent from scratch, never duplicated.

---

### How Rate Limiting & Concurrency Are Implemented

#### ✅ Worker Concurrency
```typescript
// queue/worker.ts
new Worker('email-queue', processor, {
  concurrency: process.env.WORKER_CONCURRENCY  // default: 5
})
```
5 jobs can be processed in parallel. Safe because each job writes to its own DB row.

#### ✅ Minimum Delay Between Sends — **1000ms (1 second)**
```typescript
// queue/worker.ts
new Worker('email-queue', processor, {
  limiter: { max: 1, duration: 1000 }  // MAX 1 send per 1000ms globally
})
```
BullMQ enforces this at the queue level — safe across multiple worker instances because Redis tracks the window.

#### ✅ Hourly Rate Limit Per Sender
```typescript
// services/rateLimit.ts
const key = `rate:${senderId}:${YYYY-MM-DD-HH}`
const pipeline = redis.pipeline()
pipeline.INCR(key)        // atomic increment
pipeline.EXPIRE(key, 3600) // auto-expire after 1 hour
```
- Key is **scoped per sender per hour window**
- Uses Redis pipeline (atomic) — safe across multiple workers
- NOT in-memory — survives restarts

#### ✅ When Hourly Limit Is Exceeded
```typescript
// queue/worker.ts — inside worker processor
const { allowed, nextWindowMs } = await checkAndIncrementRate(senderId, maxPerHour)

if (!allowed) {
  const nextTime = Date.now() + nextWindowMs + 5000  // next hour + 5s buffer
  await prisma.email.update({ status: 'rescheduled', scheduledTime: nextTime })
  await job.moveToDelayed(nextTime)  // same job, no duplication, order preserved
  return  // NOT a failure — job is delayed, not dropped
}
```
- Job is moved to the next hour window via `job.moveToDelayed()`
- DB row updated to `rescheduled` status
- No job is dropped or permanently failed
- Order is preserved as much as possible

#### ✅ Behavior Under Load (1000+ emails)
- `queue.addBulk()` enqueues all jobs in one Redis call
- Each job gets `delay = startTime + (index × delayBetweenMs)`
- Workers process at `concurrency=5` with `1s` minimum gap
- When hourly cap hit → jobs auto-reschedule to next window
- MySQL is the authoritative record; Redis queue can be rebuilt anytime

---

### Idempotency
Three layers:
1. `email.id` UUID = BullMQ `jobId` → BullMQ deduplicates on add
2. Worker checks `email.status === 'sent'` before doing anything → skips if already sent
3. `(campaignId, recipient)` unique DB constraint → `createMany(skipDuplicates:true)`

---

## 📁 Project Structure

```
Reachinbox/
├── docker-compose.yml          # MySQL 8 + Redis 7
├── README.md
│
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # User, Sender, Campaign, Email models
│   │   ├── seed.ts             # Creates 2 Ethereal senders
│   │   └── migrations/
│   └── src/
│       ├── index.ts            # Express entry + reconciliation on boot
│       ├── config.ts           # Env vars
│       ├── prisma.ts           # Prisma client singleton
│       ├── queue/
│       │   ├── queue.ts        # BullMQ Queue + Redis connection
│       │   └── worker.ts       # Worker: idempotency + rate limit + reschedule
│       ├── services/
│       │   ├── mailer.ts       # Nodemailer + Ethereal SMTP
│       │   ├── rateLimit.ts    # Redis INCR/EXPIRE per sender/hour
│       │   └── reconcile.ts    # Boot reconciliation: MySQL → BullMQ
│       └── routes/
│           ├── campaigns.ts    # POST /api/campaigns
│           ├── emails.ts       # GET /api/emails + GET /api/emails/stats
│           └── senders.ts      # GET /api/senders
│
└── frontend/
    └── src/
        ├── app/
        │   ├── page.tsx              # Login (Google OAuth)
        │   ├── dashboard/page.tsx    # Dashboard: sidebar + email tabs
        │   ├── compose/page.tsx      # Compose: TipTap + CSV + scheduling
        │   └── api/
        │       ├── auth/[...nextauth]/  # NextAuth handler
        │       └── proxy/[...path]/     # Server-side proxy to backend
        ├── components/
        │   ├── ui/             # Badge, Button, Input, Modal
        │   └── tables/         # ScheduledTable, SentTable (5s polling)
        ├── hooks/              # useEmails (with polling), useSenders
        └── lib/                # api.ts (typed fetch), parseCsv.ts (PapaParse)
```

---

## ✅ Feature Checklist

### Backend
- [x] BullMQ delayed job scheduling — **zero cron**
- [x] Restart persistence — MySQL reconciliation on boot
- [x] Idempotency — `jobId = email UUID` + DB status check + unique constraint
- [x] Redis hourly rate counter — atomic `INCR`/`EXPIRE`, multi-worker safe
- [x] Rate-limit reschedule — `job.moveToDelayed()` to next hour window
- [x] **Min delay between sends: 1 second** (BullMQ `limiter: { max: 1, duration: 1000 }`)
- [x] Configurable concurrency — `WORKER_CONCURRENCY` env var (default: 5)
- [x] Multiple senders — 2 Ethereal accounts (Oliver Brown + Amanda Clark)
- [x] Per-sender hourly limits — `Sender.maxEmailsPerHour` in DB
- [x] Bulk scheduling — `queue.addBulk()` for 1000+ recipients
- [x] Ethereal SMTP — preview URL logged per email

### Frontend
- [x] Google OAuth login — NextAuth.js (real OAuth, no mock)
- [x] Dashboard — sidebar with ONB logo, user avatar, nav tabs
- [x] Scheduled emails — live-polling table (5s), skeleton + empty state
- [x] Sent emails — live-polling table (10s), Ethereal preview links
- [x] Compose page — rich text editor (TipTap with full toolbar)
- [x] CSV/TXT upload — PapaParse, dedup + validate, shows email count
- [x] Email chip tags — add via comma/enter, remove with ×
- [x] "Send Later" scheduler — time picker + quick presets
- [x] Delay between emails field — configurable (ms)
- [x] Hourly limit field — configurable per campaign
- [x] Toast notifications — success/error feedback
- [x] TypeScript throughout — strict types for all API responses + props
- [x] Figma-matched UI — light gray background, green accents, ONB sidebar

---

## 🔧 Assumptions & Trade-offs

1. **MySQL chosen** (not Postgres): Specified as primary option in tech stack. Prisma supports both — switching requires only changing `provider` in schema.prisma.

2. **Auth on backend via shared secret**: Next.js server-side routes (API proxy) call Express with `x-api-secret` header. This avoids complex JWT validation on the Express side while keeping the API private. In production, use a proper JWT/session token approach.

3. **Email/password fields on login are display-only**: The Figma shows these fields but the assignment requires Google OAuth. The fields are shown for Figma fidelity but are disabled — auth is 100% Google OAuth.

4. **Ethereal accounts file-cached**: `backend/.ethereal-accounts.json` persists between restarts so the same Ethereal inbox is reused. Add to `.gitignore` in production repos.

5. **`MIN_DELAY_MS = 1000ms`**: 1 second minimum between sends. This mimics real SMTP provider throttling. Configurable via env.

6. **Search is UI-only**: The search bar in the dashboard exists per Figma but backend full-text search not implemented. Straightforward to add with Prisma `contains` filter.

7. **No email attachments**: Nodemailer supports them; adding a file upload endpoint is straightforward but out of scope for this assignment.
