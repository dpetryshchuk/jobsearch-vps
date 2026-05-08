# Signal File

status: done
task: pool + queries + content-posts page
updated: 2026-05-08

## What was done
- `src/mastra/pool.ts` — single shared pg.Pool
- `src/mastra/tools/db.ts` — imports pool from pool.ts
- `src/mastra/queries.ts` — getPipeline(), getRetro(), getContentPosts() with typed returns
- `src/mastra/index.ts` — route handlers are now one-liners, added /data/content route
- `frontend/src/pages/Content.tsx` — new content posts page (stat cards + table)
- `frontend/src/App.tsx` — /content route added
- `frontend/src/components/Nav.tsx` — Content nav item added (Pencil icon)
