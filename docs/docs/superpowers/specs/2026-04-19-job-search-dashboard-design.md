# Job Search Dashboard — Design Spec
_2026-04-19_

## Goal

A local read-only web dashboard that surfaces two things at a glance:

1. **Strategy** — Parachute flower petals + STRATEGY.md pitch/values/roles as a living reference card
2. **Daily actions** — today's `act_now` items + outreach progress counters against daily/weekly targets

Started with `npm run dashboard`, viewed in a browser. No auth, no build step.

---

## Architecture

### New files

| File | Purpose |
|---|---|
| `server.js` | Express server on port 3000 |
| `public/dashboard.html` | Single-page UI, fetches `/api/data` on load |
| `knowledge/flower.json` | Parachute petals structured data |

### Data endpoint

`GET /api/data` — called once on page load, returns combined JSON:

```
{
  today: string,               // ISO date
  outreach_today: number,      // followups logged today (status=Completed)
  outreach_week: number,       // followups logged this week (Mon–today)
  act_now: [...],              // from most recent morning-outputs/*.json
  notes: string,               // notes field from morning JSON
  strategy: {
    pitch: string,             // Yes Statement from STRATEGY.md
    values: string[],          // 5 values/fit filter items
    target_roles: string[],    // from STRATEGY.md
    instant_no: string[]       // instant fail criteria
  },
  flower: { ... }              // full flower.json contents
}
```

**Data sources per field:**

- `outreach_today` / `outreach_week` — SQLite query on `followups` table: `status = 'Completed'`, filtered by `followup_date`
- `act_now`, `notes` — most recent file in `morning-outputs/` (by filename sort)
- `strategy` — parsed from `STRATEGY.md` (extract named sections by heading)
- `flower` — read from `knowledge/flower.json`

### npm script

```json
"dashboard": "node server.js"
```

---

## UI Layout

Single page, no navigation, no tabs. One scroll.

### Header bar (full width)

- Left: date (e.g., "Sunday, April 19")
- Right: two progress pills — `Outreach today: 3` | `This week: 15`
- Subtle, fixed to top

### Main content (two columns)

**Left column (~40%): Today's Actions**

- Each `act_now` item rendered as a card:
  - Colored left border by type: `stale` = amber, `application` = blue
  - Person/label name (bold), company (muted), action text
- Below cards: `notes` from morning JSON in a callout block (if present)
- If no `act_now` items: empty state message "No actions today"

**Right column (~60%): Strategy**

Top half — **Flower card**

Four petals in a 2×2 grid:
- **People** — want list + avoid list (two sub-columns)
- **Workplace** — bulleted list
- **Skills** — top verbs
- **Knowledges** — intersection sentence + top 3

Below grid: `holland_code`, `target_roles`, `target_companies` as small labeled chips.

Bottom half — **Strategy**

Three blocks, styled (not raw markdown):
1. **Yes Statement** — the pitch, displayed prominently
2. **Values & Fit Filter** — 5 items as a checklist (visual only, not interactive)
3. **Instant No** — fail criteria as a red-tinted list

### Visual style

- Dark background (#0f0f0f or similar), off-white text
- Minimal, no decoration — matches the clean/brutalist aesthetic preference
- System font stack (no web fonts to load)
- Cards have subtle border, no drop shadows
- No emoji, no color beyond functional indicators (amber/blue borders)

---

## `flower.json` Initial Contents

Pre-populated from the Parachute session (Apr 19):

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

---

## STRATEGY.md Parsing

The server reads `STRATEGY.md` and extracts three sections by heading match:

- **Pitch** — the block-quoted Yes Statement under `## The Pitch`
- **Values** — the numbered list under `## Values & Fit Filter`
- **Instant No** — the `**Instant fail:**` line

These are extracted with simple string/regex parsing, not a full markdown parser.

---

## Out of Scope

- Writing/editing data from the UI
- New jobs feed or applications pipeline
- Authentication
- Real-time updates / websocket
- Mobile layout

---

## Success Criteria

- `npm run dashboard` starts the server with no errors
- Browser shows today's act_now items + correct outreach counts
- Flower petals and strategy content render without manual copy-paste
- Page is useful as a 10-second morning glance before starting outreach
