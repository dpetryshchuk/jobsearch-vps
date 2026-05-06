import express from 'express';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'db/jobsearch.sqlite');
const app = express();
const PORT = 3456;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function db() {
  return new DatabaseSync(DB_PATH);
}

// ── Jobs ──────────────────────────────────────────────────────────────────────

app.get('/api/jobs', (_req, res) => {
  const con = db();
  const rows = con.prepare(`
    SELECT jp.id, jp.title, jp.link, jp.source, jp.scraped_date, jp.status,
           jp.description, c.name as company, c.website
    FROM job_postings jp
    JOIN companies c ON jp.company_id = c.id
    ORDER BY jp.scraped_date DESC, c.name ASC
  `).all();
  con.close();
  res.json(rows);
});

app.patch('/api/jobs/:id', (req, res) => {
  const { status } = req.body;
  const valid = ['new', 'applied', 'dropped'];
  if (!valid.includes(status)) { res.status(400).json({ error: 'invalid status' }); return; }
  const con = db();
  con.prepare('UPDATE job_postings SET status = ? WHERE id = ?').run(status, req.params.id);
  con.close();
  res.json({ ok: true });
});

app.delete('/api/jobs/:id', (req, res) => {
  const con = db();
  con.prepare('DELETE FROM job_postings WHERE id = ?').run(req.params.id);
  con.close();
  res.json({ ok: true });
});

// ── Contacts ──────────────────────────────────────────────────────────────────

app.get('/api/contacts', (_req, res) => {
  const con = db();
  const rows = con.prepare(`
    SELECT c.id, c.name, c.role, c.source, c.stage, c.outreach_date, c.notes, c.event_id,
           co.name as company,
           e.name as event_name,
           MAX(i.date) as last_contact
    FROM contacts c
    LEFT JOIN companies co ON c.company_id = co.id
    LEFT JOIN events e ON c.event_id = e.id
    LEFT JOIN interactions i ON i.contact_id = c.id
    GROUP BY c.id
    ORDER BY c.stage, last_contact DESC
  `).all();
  con.close();
  res.json(rows);
});

app.patch('/api/contacts/:id', (req, res) => {
  const { stage, notes, event_id } = req.body;
  const valid = ['Outreached', 'Responded', 'Ongoing', 'Dead'];
  if (stage && !valid.includes(stage)) { res.status(400).json({ error: 'invalid stage' }); return; }
  const con = db();
  if (stage) con.prepare('UPDATE contacts SET stage = ? WHERE id = ?').run(stage, req.params.id);
  if (notes !== undefined) con.prepare('UPDATE contacts SET notes = ? WHERE id = ?').run(notes, req.params.id);
  if (event_id !== undefined) con.prepare('UPDATE contacts SET event_id = ? WHERE id = ?').run(event_id || null, req.params.id);
  con.close();
  res.json({ ok: true });
});

app.delete('/api/contacts/:id', (req, res) => {
  const con = db();
  con.prepare('DELETE FROM interactions WHERE contact_id = ?').run(req.params.id);
  con.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);
  con.close();
  res.json({ ok: true });
});

// ── Events ────────────────────────────────────────────────────────────────────

app.get('/api/events', (_req, res) => {
  const con = db();
  const rows = con.prepare(`
    SELECT e.id, e.name, e.date, e.notes,
           COUNT(c.id) as contact_count
    FROM events e
    LEFT JOIN contacts c ON c.event_id = e.id
    GROUP BY e.id
    ORDER BY e.date DESC
  `).all();
  con.close();
  res.json(rows);
});

app.post('/api/events', (req, res) => {
  const { name, date, notes } = req.body;
  if (!name) { res.status(400).json({ error: 'name required' }); return; }
  const con = db();
  const id = (con.prepare("SELECT lower(hex(randomblob(8))) as id").get() as { id: string }).id;
  con.prepare('INSERT INTO events (id, name, date, notes) VALUES (?, ?, ?, ?)').run(id, name, date || null, notes || null);
  con.close();
  res.json({ id, name, date, notes, contact_count: 0 });
});

app.patch('/api/events/:id', (req, res) => {
  const { name, date, notes } = req.body;
  const con = db();
  if (name !== undefined) con.prepare('UPDATE events SET name = ? WHERE id = ?').run(name, req.params.id);
  if (date !== undefined) con.prepare('UPDATE events SET date = ? WHERE id = ?').run(date || null, req.params.id);
  if (notes !== undefined) con.prepare('UPDATE events SET notes = ? WHERE id = ?').run(notes || null, req.params.id);
  con.close();
  res.json({ ok: true });
});

app.delete('/api/events/:id', (req, res) => {
  const con = db();
  con.prepare('UPDATE contacts SET event_id = NULL WHERE event_id = ?').run(req.params.id);
  con.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  con.close();
  res.json({ ok: true });
});

app.get('/api/events/:id/contacts', (req, res) => {
  const con = db();
  const rows = con.prepare(`
    SELECT c.id, c.name, c.role, c.stage, c.notes,
           co.name as company,
           MAX(i.date) as last_contact
    FROM contacts c
    LEFT JOIN companies co ON c.company_id = co.id
    LEFT JOIN interactions i ON i.contact_id = c.id
    WHERE c.event_id = ?
    GROUP BY c.id
    ORDER BY c.name
  `).all(req.params.id);
  con.close();
  res.json(rows);
});

// ── Stats ─────────────────────────────────────────────────────────────────────

app.get('/api/stats', (_req, res) => {
  const con = db();
  const jobStats = con.prepare(`SELECT status, COUNT(*) as n FROM job_postings GROUP BY status`).all();
  const contactStats = con.prepare(`SELECT stage, COUNT(*) as n FROM contacts GROUP BY stage`).all();
  con.close();
  res.json({ jobs: jobStats, contacts: contactStats });
});

app.listen(PORT, () => {
  console.log(`Job search dashboard → http://localhost:${PORT}`);
});
