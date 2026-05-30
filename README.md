# 🦅 HawkEye AI — Cybersecurity Threat Intelligence Platform

Full-stack monorepo — 6 phases, all production-wired:

| Phase | Feature | Stack |
|-------|---------|-------|
| 1 | Real-time SSE threat stream | Express · EventSource |
| 2 | Claude AI auto-analysis | Anthropic SDK · streaming |
| 3 | BullMQ alert queue + auto-remediation | Redis · BullMQ |
| 4 | PostgreSQL persistence | Prisma · Docker |
| 5 | RAG log intelligence | Claude · pgvector |
| 6 | JWT auth + RBAC | bcryptjs · jsonwebtoken |

---

## Quick Start

### Step 1 — Install dependencies
```bash
npm run install:all
```

### Step 2 — Configure environment
```bash
cp backend/.env.example backend/.env
```
Open `backend/.env` and set:
```
ANTHROPIC_API_KEY=sk-ant-your-key-here   # required for Phase 2 live AI
```
All other values work as-is for local development.

### Step 3 — Start infrastructure (Postgres + Redis)
```bash
npm run infra:up
```
This starts:
- PostgreSQL at `localhost:5432`
- Redis at `localhost:6379`
- Redis Commander UI at `http://localhost:8081`
- pgAdmin UI at `http://localhost:5050`  (login: admin@hawkeye.ai / admin123)

### Step 4 — Set up the database
```bash
npm run db:setup
```
Generates Prisma client and pushes schema to PostgreSQL.

### Step 5 — Start everything
```bash
npm run dev
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:4000/api |
| SSE Stream | http://localhost:4000/api/stream |
| Health check | http://localhost:4000/api/health |
| Redis UI | http://localhost:8081 |
| pgAdmin | http://localhost:5050 |

---

## Demo Login Credentials

| Email | Password | Role | Access |
|-------|----------|------|--------|
| admin@hawkeye.ai | admin123 | ADMIN | Everything |
| analyst@hawkeye.ai | analyst123 | ANALYST | Investigate + block |
| viewer@hawkeye.ai | viewer123 | VIEWER | Read-only |

---

## Architecture

```
hawkeye/
├── docker-compose.yml          Postgres 16 + Redis 7 + pgAdmin + Redis UI
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       Full DB schema (User, Threat, Alert, Analysis, Log)
│   │   └── init.sql            Postgres init (pgvector extension)
│   └── src/
│       ├── index.ts            Express server — mounts all routers
│       ├── routes/
│       │   ├── api.ts          REST + SSE — all protected by requireAuth
│       │   └── auth.ts         POST /login, GET /me, POST /refresh
│       ├── services/
│       │   ├── store.ts        In-memory store + analysis cache
│       │   ├── stream.ts       SSE client manager — broadcast to all clients
│       │   ├── simulator.ts    Threat generator — fires every 3.5s
│       │   ├── ai.ts           Claude API — real + mock fallback
│       │   ├── queue.ts        BullMQ — alert-analysis + auto-remediation workers
│       │   └── ragService.ts   RAG — natural language log queries
│       ├── lib/
│       │   ├── auth.ts         JWT sign/verify + RBAC middleware
│       │   ├── db.ts           Prisma client (dynamic — no crash without DB)
│       │   └── redis.ts        IORedis singleton with graceful fallback
│       └── middleware/
│           └── index.ts        Logger · 404 · error handler
└── frontend/
    └── src/
        ├── App.tsx             Router + RequireAuth guard
        ├── lib/
        │   ├── auth.ts         Token storage + role helpers
        │   ├── AuthContext.tsx Login/logout state provider
        │   ├── api.ts          Typed fetch — injects JWT, handles 401 auto-logout
        │   └── StreamContext.tsx SSE events → React state (kpiDelta, liveEvents, newAlerts)
        ├── hooks/
        │   ├── useStream.ts    Raw SSE hook — reconnect with exponential backoff
        │   └── useSecurityData.ts React Query hooks (useThreats, useAlerts, useAnalytics…)
        ├── pages/
        │   ├── Login.tsx       Dark auth page — demo credential quick-fill
        │   ├── Dashboard.tsx   KPI cards live-updated via SSE delta
        │   ├── Threats.tsx     Paginated table — real filters + block action
        │   ├── Alerts.tsx      Alert management — live badge count from SSE
        │   ├── Investigation.tsx Threat deep-dive — AI analysis + block/resolve
        │   ├── RAGQuery.tsx    Chat UI — natural language log querying (Phase 5)
        │   └── Settings.tsx    RBAC-filtered tabs — users, API keys, thresholds, notifs
        └── components/
            ├── layout/AppLayout.tsx  Sidebar with role-filtered nav + sign-out
            ├── charts/         Chart.js wrappers (ThreatTrends, AttackDist)
            └── ui/             Badge, SeverityBadge, LiveFeed, StreamStatus, Skeleton
```

---

## Real-Time Data Flow

```
Simulator (every 3.5s)
  │ generates Threat
  ▼
StreamManager.broadcast('threat:new', threat)
  │ pushes SSE to all EventSource clients
  ▼
useStream hook (frontend)
  │ parses StreamEvent<Threat>
  ▼
StreamContext reducer
  ├── liveEvents[]   → LiveFeed component
  ├── kpiDelta       → Dashboard KPI cards (instant update, no poll)
  └── newAlerts[]    → Sidebar badge + Alerts page banner
       + invalidates React Query cache → tables auto-refetch
```

## BullMQ Queue Flow (Phase 3)

```
POST /alerts/:id/analyze
  │
  ├── Redis available → enqueue job → Worker picks up
  │                                     │ calls Claude API (Phase 2)
  │                                     │ stores analysis in cache
  │                                     │ if autoResolved → enqueue remediation
  │                                     │ remediation worker → store.blockThreat()
  │                                     └── broadcast SSE threat:updated
  │
  └── Redis unavailable → runs inline → same outcome, no queue
```

---

## API Reference

| Method | Endpoint | Auth | Role |
|--------|----------|------|------|
| POST | /api/auth/login | ✗ | — |
| GET | /api/auth/me | ✓ | Any |
| POST | /api/auth/refresh | ✓ | Any |
| GET | /api/auth/users | ✓ | ADMIN |
| GET | /api/health | ✗ | — |
| GET | /api/stream | ✗ | — |
| GET | /api/analytics/summary | ✓ | Any |
| GET | /api/threats | ✓ | Any |
| GET | /api/threats/:id | ✓ | Any |
| POST | /api/threats/:id/actions/block-ip | ✓ | ANALYST+ |
| POST | /api/threats/:id/actions/resolve | ✓ | ANALYST+ |
| GET | /api/alerts | ✓ | Any |
| POST | /api/alerts/:id/analyze | ✓ | ANALYST+ |
| GET | /api/alerts/:id/analysis | ✓ | Any |
| GET | /api/queue/stats | ✓ | ADMIN |
| POST | /api/logs/query | ✓ | Any |

---

## Without Docker (fastest start)

If you don't have Docker, the server starts perfectly without it:
- No `DATABASE_URL` → uses in-memory store (all features work, data resets on restart)
- No `REDIS_URL` → BullMQ queue runs inline synchronously (no Redis needed)
- No `ANTHROPIC_API_KEY` → AI analysis returns realistic mock responses

Just `npm run install:all && npm run dev` — everything works.
