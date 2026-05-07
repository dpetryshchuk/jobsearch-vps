# jobsearch-vps

VPS-deployed job search CRM. Mastra agent is the sole backend — runs on port 4111 behind Caddy.

## Architecture

```
Browser → Caddy (443, jobsearch.dmytropetryshchuk.com)
            ├── /api/*   → Mastra agent server (localhost:4111)
            └── static   → /home/dima/jobsearch/public/
```

**No separate Node server.** Everything — agent chat, data API, static files — goes through one Mastra process + Caddy.

## Key files

| File | What |
|---|---|
| `src/mastra/index.ts` | Mastra instance: agent, Postgres storage, Langfuse, custom API routes |
| `src/mastra/agents/jobsearch.ts` | The CRM agent (DeepSeek model) |
| `src/mastra/tools/db.ts` | pg tools: upsert_company, upsert_contact, log_interaction, etc. |
| `public/index.html` | Single-page frontend, hash-based routing |
| `public/style.css` | All styles — Martian Mono, light mode, bubble chat |
| `tools/` | Scrapers (run locally via SSH tunnel, write to Postgres) |

## Database

Postgres on VPS. `DATABASE_URL=postgresql://jobsearch:...@localhost:5432/jobsearch` in `.env`.

Local queries: `tsx tools/query.ts "SELECT ..."` (tunneled via `ssh -L 5432:localhost:5432 dima@46.225.78.10`).

## API routes (all under /api/)

| Path | What |
|---|---|
| `POST /api/agents/jobsearch/stream` | SSE streaming agent chat |
| `GET /api/data/pipeline` | contacts + company + last contact date, ordered by stage |
| `GET /api/data/retro` | weekly volumes, conversion by source, needs-action list |

## Deploy

Push to `master` → GitHub Actions → SSH into VPS → `git pull && npm install && npx mastra build && sudo systemctl restart jobsearch`

systemd service: `/etc/systemd/system/jobsearch.service`
Runs: `node /home/dima/jobsearch/.mastra/output/index.mjs`

## VPS

`46.225.78.10` — Hetzner CX22, Germany. Domain: `jobsearch.dmytropetryshchuk.com`

## Caddyfile (`/etc/caddy/Caddyfile`)

```
jobsearch.dmytropetryshchuk.com {
  basicauth {
    dima <bcrypt-hash>
  }
  handle /api/* {
    reverse_proxy localhost:4111
  }
  handle {
    root * /home/dima/jobsearch/public
    file_server
  }
}
```

To update: `sudo nano /etc/caddy/Caddyfile` → `sudo systemctl reload caddy`

Generate password hash: `caddy hash-password --plaintext yourpassword`

## Scrapers

Run locally (not on VPS). Write to Postgres via SSH tunnel.

```bash
npm run scrape:yc      # YC Jobs
npm run scrape:hn      # HN Who's Hiring
npm run scrape:remoteok
npm run scrape:simplify
```

## Pending steps

- [ ] Step 11 — Langfuse traces showing in dashboard
- [ ] Step 12 — pgvector embeddings pipeline
- [ ] Step 13 — /context RAG endpoint (wire RAG mode in chat)
- [ ] Step 14 — Caddy basic auth (add `basicauth` block to Caddyfile)
- [ ] Step 15 — Chrome extension
