# Job Search Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local read-only web dashboard (`npm run dashboard`) that shows today's action items and Parachute strategy on one page.

**Architecture:** Express server reads the most recent morning JSON, SQLite followup counts, STRATEGY.md, and flower.json — combines them into a single `/api/data` response. A single `public/dashboard.html` fetches that endpoint and renders everything with vanilla JS.

**Tech Stack:** Node.js 25 (built-in `node:sqlite`), Express 4, vanilla JS/CSS, no build step.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `knowledge/flower.json` | Create | Parachute petal data |
| `server.js` | Create | Express server + `/api/data` endpoint |
| `public/dashboard.html` | Create | Full UI — fetches API, renders everything |
| `package.json` | Modify | Add `express` dependency + `dashboard` script |

---

## Task 1: Create `knowledge/flower.json`

**Files:**
- Create: `knowledge/flower.json`

- [ ] **Step 1: Create the file**

```json
{
  "holland_code": "EIS",
  "petals": {
    "people": {
      "want": [
        "Self-led leaders",
        "Directed (goal-driven)",
        "Intelligent (systems thinkers)",
        "Reasonable",
        "Outcome-oriented"
      ],
      "avoid": [
        "Overly-confident",
        "Vindictive",
        "Condescending",
        "Self-centered",
        "Doomers"
      ]
    },
    "workplace": {
      "items": [
        "Natural light, wide desk",
        "Quiet, focused work",
        "Clean/minimal, no dress code",
        "Hybrid (remote + in-person)",
        "Directed meetings only",
        "Urgent pace, not 996",
        "Clear mission, minimal hierarchy",
        "Healthy defaults"
      ]
    },
    "skills": {
      "verbs": [
        "Composing (chaos → systems)",
        "Bending (tools past intended use)",
        "Translating (technical → visual)",
        "Prototyping",
        "Synthesizing (cross-domain)",
        "Pitching (with visual proof)",
        "Investigating",
        "Aestheticizing",
        "Writing"
      ]
    },
    "knowledges": {
      "intersection": "AI-native automation × Systems architecture × Brand/design sensibility",
      "top3": [
        "AI-native automation (Claude Code, agent frameworks)",
        "Systems architecture (decomposing problems, integration design)",
        "Brand & design sensibility"
      ]
    }
  },
  "target_roles": [
    "Forward Deployed Engineer",
    "Solutions Engineer",
    "Implementation Engineer",
    "AI Engineer",
    "GTM Engineer (AI-focused)"
  ],
  "target_companies": "Remote-friendly AI-native, Series A–C, design-literate, 20–200 employees"
}
```

- [ ] **Step 2: Verify it parses**

```bash
node -e "console.log(JSON.parse(require('fs').readFileSync('knowledge/flower.json','utf8')).holland_code)"
```

Expected output: `EIS`

- [ ] **Step 3: Commit**

```bash
git add knowledge/flower.json
git commit -m "feat: add Parachute flower.json with petals 1-4"
```

---

## Task 2: Install Express

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Express**

```bash
npm install express
```

- [ ] **Step 2: Verify**

```bash
node -e "require('express'); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add express dependency for dashboard server"
```

---

## Task 3: Create `server.js`

**Files:**
- Create: `server.js`

- [ ] **Step 1: Create the server**

```js
'use strict';
process.removeAllListeners('warning');

const express = require('express');
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

const DB_PATH    = path.join(__dirname, 'db/jobsearch.sqlite');
const MORNING_DIR = path.join(__dirname, 'morning-outputs');
const STRATEGY_PATH = path.join(__dirname, 'STRATEGY.md');
const FLOWER_PATH   = path.join(__dirname, 'knowledge/flower.json');

// ── helpers ──────────────────────────────────────────────

function getMorning() {
  const files = fs.readdirSync(MORNING_DIR)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse();
  if (!files.length) return { act_now: [], notes: '' };
  return JSON.parse(fs.readFileSync(path.join(MORNING_DIR, files[0]), 'utf8'));
}

function getOutreachCounts() {
  const db = new DatabaseSync(DB_PATH);
  const today = new Date().toISOString().slice(0, 10);

  const dow = new Date().getDay(); // 0=Sun
  const offset = dow === 0 ? 6 : dow - 1;
  const monday = new Date();
  monday.setDate(monday.getDate() - offset);
  const mondayStr = monday.toISOString().slice(0, 10);

  const todayRow = db.prepare(
    `SELECT COUNT(*) AS c FROM followups WHERE status='Completed' AND followup_date=?`
  ).get(today);

  const weekRow = db.prepare(
    `SELECT COUNT(*) AS c FROM followups WHERE status='Completed' AND followup_date>=?`
  ).get(mondayStr);

  return { outreach_today: todayRow.c, outreach_week: weekRow.c };
}

function parseStrategy() {
  const text = fs.readFileSync(STRATEGY_PATH, 'utf8');

  // Yes Statement — first blockquote under ## The Pitch
  const pitchMatch = text.match(/## The Pitch[\s\S]*?>\s*"([^"]+)"/);
  const pitch = pitchMatch ? pitchMatch[1] : '';

  // Values — numbered bold items
  const values = [...text.matchAll(/^\d+\.\s+\*\*([^*]+)\*\*/gm)].map(m => m[1].trim());

  // Instant fail — everything after the label on that line
  const failMatch = text.match(/\*\*Instant fail:\*\*\s*(.+)/);
  const instant_no = failMatch
    ? failMatch[1].replace(/\.$/, '').split(',').map(s => s.trim())
    : [];

  // Target roles — first content line under ## Target Roles
  const rolesSection = text.match(/## Target Roles\s*\n+([^\n]+)/);
  const target_roles = rolesSection
    ? rolesSection[1].replace(/\.$/, '').split(',').map(s => s.trim()).filter(s => s.length > 2)
    : [];

  return { pitch, values, instant_no, target_roles };
}

// ── routes ───────────────────────────────────────────────

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/data', (req, res) => {
  try {
    const morning  = getMorning();
    const counts   = getOutreachCounts();
    const strategy = parseStrategy();
    const flower   = JSON.parse(fs.readFileSync(FLOWER_PATH, 'utf8'));

    res.json({
      today: new Date().toISOString().slice(0, 10),
      outreach_today: counts.outreach_today,
      outreach_week:  counts.outreach_week,
      act_now: morning.act_now || [],
      notes:   morning.notes   || '',
      strategy,
      flower,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Dashboard → http://localhost:${PORT}`);
});
```

- [ ] **Step 2: Smoke-test the endpoint**

In one terminal:
```bash
node server.js
```
Expected: `Dashboard → http://localhost:3000`

In another terminal:
```bash
curl -s http://localhost:3000/api/data | node -e "
const d = JSON.parse(require('fs').readFileSync(0,'utf8'));
const keys = ['today','outreach_today','outreach_week','act_now','notes','strategy','flower'];
keys.forEach(k => console.log(k, ':', JSON.stringify(d[k]).slice(0,60)));
"
```

Expected: all 7 keys print with non-null values. `strategy.pitch` should start with `Forward Deployed`.

- [ ] **Step 3: Stop the test server (Ctrl-C), commit**

```bash
git add server.js
git commit -m "feat: add Express dashboard server with /api/data endpoint"
```

---

## Task 4: Create `public/dashboard.html`

**Files:**
- Create: `public/dashboard.html`

- [ ] **Step 1: Create the public directory and HTML file**

```bash
mkdir -p public
```

Then create `public/dashboard.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Job Search</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: #0f0f0f;
      color: #d8d8d8;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      line-height: 1.55;
    }

    /* ── Header ── */
    .header {
      position: fixed; top: 0; left: 0; right: 0;
      background: #0f0f0f;
      border-bottom: 1px solid #1e1e1e;
      padding: 10px 24px;
      display: flex; justify-content: space-between; align-items: center;
      z-index: 100;
    }
    .header-date { font-size: 12px; color: #555; letter-spacing: 0.02em; }
    .pills { display: flex; gap: 8px; }
    .pill {
      background: #141414;
      border: 1px solid #252525;
      padding: 3px 10px;
      border-radius: 3px;
      font-size: 12px;
      color: #666;
    }
    .pill strong { color: #bbb; font-weight: 600; }

    /* ── Layout ── */
    .main {
      display: flex; gap: 20px;
      padding: 56px 24px 32px;
      max-width: 1440px;
      margin: 0 auto;
      align-items: flex-start;
    }
    .col-left  { flex: 0 0 38%; min-width: 0; }
    .col-right { flex: 1; min-width: 0; }

    /* ── Labels ── */
    .label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #3a3a3a;
      font-weight: 700;
      margin-bottom: 10px;
    }

    /* ── Action cards ── */
    .card {
      background: #141414;
      border: 1px solid #1e1e1e;
      border-left: 3px solid #2a2a2a;
      padding: 11px 13px;
      margin-bottom: 7px;
    }
    .card.stale       { border-left-color: #92400e; }
    .card.application { border-left-color: #1e40af; }
    .card-name    { font-weight: 600; font-size: 13px; color: #e0e0e0; }
    .card-company { color: #555; font-size: 11px; margin-bottom: 5px; }
    .card-action  { color: #aaa; font-size: 12px; }

    /* ── Notes ── */
    .notes-block {
      margin-top: 14px;
      background: #111;
      border: 1px solid #1e1e1e;
      border-left: 3px solid #2a2a2a;
      padding: 9px 13px;
      color: #666;
      font-size: 12px;
    }

    /* ── Flower grid ── */
    .flower-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 12px;
    }
    .petal {
      background: #111;
      border: 1px solid #1e1e1e;
      padding: 11px 12px;
    }
    .petal-label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #3a3a3a;
      font-weight: 700;
      margin-bottom: 7px;
    }
    .petal-sublabel {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #2e2e2e;
      font-weight: 700;
      margin: 7px 0 4px;
    }
    .plist { list-style: none; }
    .plist li { font-size: 11px; color: #888; padding: 1px 0; }
    .plist li::before { content: '— '; color: #333; }
    .plist.dim li { color: #555; }
    .petal-note { font-size: 11px; color: #666; font-style: italic; margin-bottom: 6px; }

    /* ── Flower meta chips ── */
    .chips { display: flex; flex-wrap: wrap; gap: 5px; margin: 8px 0 4px; }
    .chip {
      background: #141414;
      border: 1px solid #222;
      padding: 2px 8px;
      border-radius: 2px;
      font-size: 10px;
      color: #555;
    }
    .chip.code { color: #4a90d9; border-color: #1a2a3a; background: #0e1520; }
    .target-co { font-size: 11px; color: #444; margin-top: 4px; margin-bottom: 14px; }

    /* ── Strategy ── */
    .pitch-box {
      border-left: 3px solid #1d4ed8;
      padding: 10px 14px;
      background: #111;
      font-size: 13px;
      color: #d0d0d0;
      line-height: 1.6;
      margin-bottom: 16px;
    }
    .vlist { list-style: none; margin-bottom: 16px; }
    .vlist li {
      padding: 6px 0;
      border-bottom: 1px solid #161616;
      color: #999;
      display: flex; align-items: baseline; gap: 8px;
    }
    .vlist li::before { content: '○'; color: #333; font-size: 10px; flex-shrink: 0; }
    .nolist { list-style: none; }
    .nolist li { font-size: 11px; color: #555; padding: 2px 0; }
    .nolist li::before { content: '✕ '; color: #5a1e1e; }

    .section { margin-bottom: 18px; }

    .empty { color: #333; padding: 12px 0; }
  </style>
</head>
<body>

<header class="header">
  <span class="header-date" id="js-date"></span>
  <div class="pills">
    <div class="pill">Today <strong id="js-today">—</strong></div>
    <div class="pill">This week <strong id="js-week">—</strong></div>
  </div>
</header>

<div class="main">

  <!-- Left: actions -->
  <div class="col-left">
    <div class="label">Today's Actions</div>
    <div id="js-cards"></div>
    <div id="js-notes"></div>
  </div>

  <!-- Right: strategy -->
  <div class="col-right">

    <div class="label">Strategy</div>

    <!-- Flower -->
    <div class="flower-grid" id="js-flower"></div>
    <div id="js-flower-meta"></div>

    <!-- STRATEGY.md sections -->
    <div class="section">
      <div class="label">Pitch</div>
      <div class="pitch-box" id="js-pitch"></div>
    </div>

    <div class="section">
      <div class="label">Values & Fit Filter</div>
      <ul class="vlist" id="js-values"></ul>
    </div>

    <div class="section">
      <div class="label">Instant No</div>
      <ul class="nolist" id="js-no"></ul>
    </div>

  </div>
</div>

<script>
(async () => {
  const data = await fetch('/api/data').then(r => r.json());

  // Header
  const d = new Date(data.today + 'T12:00:00');
  document.getElementById('js-date').textContent =
    d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  document.getElementById('js-today').textContent = data.outreach_today;
  document.getElementById('js-week').textContent  = data.outreach_week;

  // Action cards
  const cards = document.getElementById('js-cards');
  if (!data.act_now.length) {
    cards.innerHTML = '<div class="empty">No actions flagged for today</div>';
  } else {
    cards.innerHTML = data.act_now.map(item => `
      <div class="card ${item.type || ''}">
        <div class="card-name">${esc(item.name)}</div>
        <div class="card-company">${esc(item.company)}</div>
        <div class="card-action">${esc(item.action)}</div>
      </div>
    `).join('');
  }

  // Notes
  if (data.notes) {
    document.getElementById('js-notes').innerHTML =
      `<div class="notes-block">${esc(data.notes)}</div>`;
  }

  // Flower petals
  const f = data.flower;
  document.getElementById('js-flower').innerHTML = `
    <div class="petal">
      <div class="petal-label">People</div>
      <div class="petal-sublabel">Want</div>
      <ul class="plist">${f.petals.people.want.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
      <div class="petal-sublabel">Avoid</div>
      <ul class="plist dim">${f.petals.people.avoid.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
    </div>
    <div class="petal">
      <div class="petal-label">Workplace</div>
      <ul class="plist">${f.petals.workplace.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
    </div>
    <div class="petal">
      <div class="petal-label">Skills</div>
      <ul class="plist">${f.petals.skills.verbs.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
    </div>
    <div class="petal">
      <div class="petal-label">Knowledges</div>
      <div class="petal-note">${esc(f.petals.knowledges.intersection)}</div>
      <ul class="plist">${f.petals.knowledges.top3.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
    </div>
  `;

  // Flower meta
  document.getElementById('js-flower-meta').innerHTML = `
    <div class="chips">
      <span class="chip code">${esc(f.holland_code)}</span>
      ${f.target_roles.map(r => `<span class="chip">${esc(r)}</span>`).join('')}
    </div>
    <div class="target-co">${esc(f.target_companies)}</div>
  `;

  // Strategy
  document.getElementById('js-pitch').textContent  = data.strategy.pitch;
  document.getElementById('js-values').innerHTML   = data.strategy.values.map(v => `<li>${esc(v)}</li>`).join('');
  document.getElementById('js-no').innerHTML       = data.strategy.instant_no.map(v => `<li>${esc(v)}</li>`).join('');

  function esc(s) {
    return String(s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }
})();
</script>
</body>
</html>
```

- [ ] **Step 2: Start server and verify in browser**

```bash
node server.js
```

Open `http://localhost:3000` in a browser. Verify:
- Header shows today's date + outreach counts (numbers, not `—`)
- Left column shows action cards (colored left borders: amber for stale, blue for application)
- Right column shows 4 flower petals in a 2×2 grid
- Pitch text appears in the blue-bordered box
- Values list shows 5 items
- Instant No list appears below

- [ ] **Step 3: Stop server, commit**

```bash
git add public/dashboard.html
git commit -m "feat: add dashboard HTML with strategy + daily actions layout"
```

---

## Task 5: Wire up `npm run dashboard`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add the script**

In `package.json`, add to the `"scripts"` block:

```json
"dashboard": "node server.js"
```

- [ ] **Step 2: Verify the script works**

```bash
npm run dashboard
```

Expected: `Dashboard → http://localhost:3000`

Stop with Ctrl-C.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "feat: add npm run dashboard script"
```

---

## Self-Review Checklist

- **flower.json** — Task 1 ✓
- **Express install** — Task 2 ✓
- **`/api/data` endpoint** with all 7 keys — Task 3 ✓
- **`public/dashboard.html`** with header, left/right columns, all sections — Task 4 ✓
- **`npm run dashboard`** script — Task 5 ✓
- STRATEGY.md parsing covers pitch, values, instant_no, target_roles — Task 3 ✓
- XSS: all user-facing strings passed through `esc()` in HTML — Task 4 ✓
- Type consistency: `outreach_today`/`outreach_week` (server) match `data.outreach_today`/`data.outreach_week` (HTML) ✓
- `act_now` item shape `{ type, name, company, action }` consistent across server and HTML ✓
