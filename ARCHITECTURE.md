# Job Search System — Full Architecture

A self-hosted job search operating system with RAG-powered context retrieval,
natural language ingestion from any source, and full pipeline analytics.

## Vision

Every job search event — message sent, call taken, job posted, connection made —
flows into one system. You can query it naturally, see exactly where your funnel
is leaking, and get AI-powered context any time you're looking at a new
opportunity or preparing for a conversation.

Eventually open-sourced as a configurable framework for anyone running a
structured job search.

---

## Build Status

| # | Step | Status |
|---|---|---|
| 1 | Provision Hetzner CX22 | ✅ Done |
| 2 | Base setup (ufw, user, SSH) | ✅ Done |
| 3 | Postgres 16 + pgvector | ✅ Done |
| 4 | Node.js 22 | ✅ Done |
| 5 | Embedding microservice (nomic-embed-text, systemd) | ✅ Done |
| 6 | Caddy reverse proxy | ✅ Done |
| 7 | App systemd service | ⬜ Pending |
| 8 | Git push-to-deploy | ⬜ Pending |
| 9 | Migrate SQLite → Postgres | ⬜ Pending |
| 10 | `/ingest` endpoint (Deepseek extraction) | ⬜ Pending |
| 11 | pgvector embeddings pipeline | ⬜ Pending |
| 12 | `/context` RAG endpoint | ⬜ Pending |
| 13 | Make/Mesh webhook integration | ⬜ Pending |
| 14 | Chrome extension | ⬜ Pending |
| 15 | Domain + HTTPS | ⬜ Pending |

---

## Hosting

**Hetzner CX22** (~$5/month) — `46.225.78.10`
- 2 vCPU, 4GB RAM, Ubuntu 24.04
- Caddy for reverse proxy + automatic HTTPS *(planned)*
- systemd for process management
- Git push-to-deploy via bare repo + post-receive hook *(planned)*

---

## Stack

| Layer | Tech | Current | Target |
|---|---|---|---|
| Database | SQLite → Postgres 16 + pgvector | SQLite (WAL mode) | Postgres + pgvector |
| AI — extraction | Deepseek V3 API | Not yet wired | Active |
| AI — embeddings | `nomic-embed-text` (local) | Running on VPS (port 8000) | Wired into ingest |
| Backend | Express + TypeScript | Running locally (port 3456) | Deployed on VPS |
| Frontend | HTML/JS dashboards | 3 pages (dashboard, pipeline, index) | Extended |
| Reverse proxy | Caddy | Not yet deployed | Deployed |

---

## Data Model

### Current database: SQLite (`db/jobsearch.sqlite`)

All queries via `tsx tools/query.ts "SQL"`. New IDs: `lower(hex(randomblob(8)))` inline in INSERT.

```sql
companies       id, name, website

job_postings    id, company_id, title, link, source, scraped_date, status, description
                source: 'YC' | 'HN' | 'RemoteOK' | 'SimplifyJobs'
                status: 'new' | 'applied' | 'dropped'

events          id, name, date, notes
                -- networking events, career fairs, etc.

contacts        id, name, company_id, role, source, stage, outreach_date, notes, event_id
                source: 'LinkedIn' | 'YC' | 'Cold Email' | 'Referral' | 'Event'
                stage: 'Outreached' | 'Responded' | 'Ongoing' | 'Dead'
                event_id → events.id (nullable, where you met them)

interactions    id, contact_id, date, direction, notes
                direction: 'out' (you sent) | 'in' (they replied)

content_posts   id, posted_date, title, impressions, reactions, comments, reposts
```

### Planned: Postgres 16 + pgvector (Step 9)

Structured tables mirror SQLite. Additional vector table:

```sql
embeddings
  id          TEXT PRIMARY KEY
  entity_type TEXT   -- 'contact' | 'interaction' | 'job_posting' | 'company' | 'chunk'
  entity_id   TEXT   -- FK to the relevant table
  chunk_text  TEXT   -- the text that was embedded
  vector      vector(768)  -- nomic-embed-text output dim
```

One row per chunk. Long documents (job descriptions, conversation notes) are
split into overlapping chunks before embedding.

---

## Server — Express API

**Entry point:** `server.ts` — port 3456

### Job endpoints
```
GET    /api/jobs          list all job postings
PATCH  /api/jobs/:id      update status (new/applied/dropped)
DELETE /api/jobs/:id      delete job
```

### Contact endpoints
```
GET    /api/contacts      list all contacts with last-contact date
PATCH  /api/contacts/:id  update stage / notes / event_id
DELETE /api/contacts/:id  delete contact and its interactions
```

### Event endpoints
```
GET    /api/events             list events with contact counts
POST   /api/events             create event
PATCH  /api/events/:id         update event
DELETE /api/events/:id         delete event
GET    /api/events/:id/contacts  contacts met at this event
```

### Stats endpoint
```
GET /api/stats   summary counts by status/stage
```

---

## Frontend

Three HTML/JS dashboards in `public/`:

| File | Purpose |
|---|---|
| `dashboard.html` | Job postings — browse, filter, mark applied/dropped |
| `pipeline.html` | Contact pipeline — stages, last contact, follow-up tracking |
| `index.html` | Home / overview |

---

## Scrapers

All scrapers write to `job_postings` via `tools/scraper-utils.ts`.
Role filters: no defense, no high travel, CA/remote only. Filters in `tools/filters.ts`.

```bash
npm run scrape           # all scrapers
npm run scrape:yc        # YC Inertia feed
npm run scrape:yc-deep   # YC deep company-page scrape (more targeted)
npm run scrape:hn        # HN "Who is Hiring?"
npm run scrape:remoteok  # RemoteOK public API
npm run scrape:simplify  # SimplifyJobs new grad positions (last 2 days)
npm run scrape:jobspy    # Python-based JobSpy scraper
npm run scrape:dry       # dry run, no DB writes
```

| Scraper | File | Source |
|---|---|---|
| YC Inertia | `tools/scrape-yc-jobs.ts` | YC company job feed |
| YC Deep | `tools/scrape-yc-deep.ts` | YC company pages, detailed |
| HN Jobs | `tools/scrape-hn-jobs.ts` | HN "Who is Hiring?" thread |
| RemoteOK | `tools/scrape-remoteok.ts` | RemoteOK public API |
| SimplifyJobs | `tools/scrape-simplifyjobs.ts` | New grad listings (last 2 days) |
| JobSpy | `tools/scrape-jobspy.py` | Python, multi-board scraper |

---

## Embedding Microservice (VPS)

**Location:** `~/embeddings/` on the VPS
**Model:** `nomic-ai/nomic-embed-text-v1` — 547MB, 768 dimensions
**Runtime:** FastAPI + uvicorn on `127.0.0.1:8000`
**Process:** systemd service, starts on boot, restarts on crash

Not yet wired into the ingestion pipeline — waiting for Step 9 (Postgres migration).

---

## Ingestion Pipeline (Planned — Step 10)

```
Raw text input
      ↓
POST /ingest
      ↓
Deepseek V3 — extract structured entities
  {
    type: "job_posting" | "contact" | "interaction" | "company",
    entities: [...],
    interactions: [...],
    summary: "..."
  }
      ↓
Upsert into Postgres (search before insert, never duplicate)
      ↓
Chunk text → embed via nomic-embed-text (port 8000) → store in embeddings table
      ↓
Return: what was created/updated
```

**Deepseek extraction prompt pattern:**
```
You are a structured data extractor for a job search CRM.
Given raw text, extract all entities and events.
Return strict JSON only. If a field is unknown, return null.
Schema: { companies: [...], contacts: [...], interactions: [...] }
```

### Input sources (planned)

| Source | What it sends | What gets created |
|---|---|---|
| Paste (web UI) | Raw text | Extracted entities + interactions |
| Chrome extension | Current page HTML/text | Job posting or LinkedIn profile |
| Make webhook (Mesh) | Networking CRM event | Contact update + interaction |
| Scraper cron | Job postings JSON | `job_postings` rows + embeddings |
| Manual CLI | SQL direct | Anything |

---

## RAG — Context Retrieval (Planned — Step 12)

`GET /context?q=<query>` — semantic search across everything.

Used when:
- Viewing a new job posting → "what do I already know about this company/people?"
- Preparing for a call → "what did we talk about last time?"
- Morning briefing → "which past conversations are relevant to this new lead?"

Flow:
```
Query string
      ↓
Embed with nomic-embed-text (port 8000)
      ↓
pgvector cosine similarity search → top K chunks
      ↓
Fetch full entity context for each chunk
      ↓
Return: ranked results with entity type, source, date, relevance score
```

---

## Mesh Integration (Planned — Step 13)

```
Mesh CRM event
      ↓
Make scenario (webhook trigger)
      ↓
POST /ingest  { text: "<Mesh event payload>", source: "mesh" }
      ↓
Deepseek extracts contact + interaction
      ↓
Upserted into DB + embedded
```

Setup: one Make scenario, one webhook URL, one Mesh automation rule.
Any Mesh interaction (new contact, note added, meeting logged) syncs automatically.

---

## Chrome Extension (Planned — Step 14)

One button: **"Send to Job Search"**

Captures `document.body.innerText` (or selected text) and POSTs to `/ingest`.

Works on:
- LinkedIn profiles → creates contact
- Job postings (LinkedIn, Ashby, Greenhouse, YC) → creates job_posting
- Any page with relevant text → extracts whatever is there

---

## Cost Estimate

| Item | Monthly |
|---|---|
| Hetzner CX22 | $4.50 |
| Deepseek V3 (~50K input + 12K output/day) | ~$0.50 |
| nomic-embed-text (local on VPS) | $0 |
| Make free tier (1K ops/month) | $0 |
| **Total** | **~$5/month** |

---

## Open Source Plan

After the full system is built and running:

1. Extract personal config (role preferences, scoring weights, location targets) into `config.yaml`
2. Gitignore all personal data (`db/`, `morning-outputs/`, `STRATEGY.md`, `knowledge/`)
3. Write setup guide (Hetzner → Postgres → `.env` → first scrape)
4. Publish

The framework — scrapers, ingestion pipeline, RAG endpoint, dashboard, Claude skills
— is generic. The config is personal. That's the split.
