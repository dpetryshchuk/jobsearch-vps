import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../db/jobsearch.sqlite');

export interface ScrapedJob {
  companyName: string;
  jobTitle: string;
  jobLink?: string;
  description?: string;
  website?: string;
  location?: string;
  isYC?: boolean;
  source?: string;
  epoch?: number;
}

export interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
}

// ── Content filters ───────────────────────────────────────────────────────────

const DEFENSE_KEYWORDS = [
  'defense', 'defence', 'military', 'weapon', 'dod', 'national security', 'aerospace defense',
];

export function isDefense(text: string | null | undefined): boolean {
  if (!text) return false;
  return DEFENSE_KEYWORDS.some(kw => text.toLowerCase().includes(kw));
}

export function isHighTravel(description: string | null | undefined): boolean {
  if (!description) return false;
  const text = description.toLowerCase();
  if (/\b(5[0-9]|[6-9]\d|100)\s*[-–]?\s*\d*\s*%\s*travel/.test(text)) return true;
  if (/\btravel\b.{0,20}\b(5[0-9]|[6-9]\d|100)\s*%/.test(text)) return true;
  if (/\b(frequent|extensive|heavy|significant)\s+travel\b/.test(text)) return true;
  if (
    /\btravel(ing)?\s+(to|for)\s+(customer|client)\s+(offices?|sites?|locations?)\b/.test(text) &&
    !/\b(occasional|minimal|rare|limited|some)\s+travel\b/.test(text)
  ) return true;
  return false;
}

export function isNonCARemote(location: string | null | undefined): boolean {
  if (!location) return false;
  const loc = location.toLowerCase();
  if (loc.includes('remote')) return false;
  if (/\b(san diego|los angeles|l\.?a\.|san francisco|s\.?f\.|bay area|california|, ca\b)/.test(loc)) return false;
  if (loc === 'us' || loc === 'usa' || loc === 'united states' || loc.includes('nationwide')) return false;
  const FOREIGN = [
    'london', 'uk', 'u.k.', 'stockholm', 'berlin', 'paris', 'amsterdam',
    'toronto', 'canada', 'india', 'australia', 'singapore', 'ireland', 'dublin',
    'germany', 'france', 'spain', 'netherlands', 'israel', 'brazil', 'latam',
  ];
  if (FOREIGN.some(s => loc.includes(s))) return true;
  const NON_CA = [
    ', ny', ', tx', ', wa', ', il', ', ma', ', co', ', ga', ', fl',
    ', nc', ', az', ', or', ', nv', ', ut', ', va', ', oh', ', mn', ', pa',
    'new york', 'chicago', 'seattle', 'boston', 'denver', 'atlanta',
    'austin', 'dallas', 'houston', 'miami', 'portland', 'phoenix', 'salt lake',
  ];
  if (NON_CA.some(s => loc.includes(s))) return true;
  return false;
}

// ── DB helpers ────────────────────────────────────────────────────────────────

function getDb(): DatabaseSync {
  return new DatabaseSync(DB_PATH);
}

interface ExistingData {
  companyMap: Map<string, string>;
  postingMap: Map<string, { id: string; link: string | null; status: string }>;
}

function getExistingData(): ExistingData {
  const db = getDb();
  const companies = db.prepare('SELECT id, name FROM companies').all() as { id: string; name: string }[];
  const postings = db.prepare('SELECT id, company_id, title, link, status FROM job_postings').all() as {
    id: string; company_id: string; title: string; link: string | null; status: string;
  }[];
  db.close();

  const companyMap = new Map<string, string>();
  for (const c of companies) companyMap.set(c.name.toLowerCase(), c.id);

  const postingMap = new Map<string, { id: string; link: string | null; status: string }>();
  for (const p of postings) {
    const key = `${p.company_id}::${(p.title || '').toLowerCase()}`;
    postingMap.set(key, { id: p.id, link: p.link, status: p.status });
  }

  return { companyMap, postingMap };
}

function randomId(db: DatabaseSync): string {
  const row = db.prepare("SELECT lower(hex(randomblob(8))) as id").get() as { id: string };
  return row.id;
}

function upsertCompany(db: DatabaseSync, name: string, website?: string): string {
  const existing = db.prepare('SELECT id FROM companies WHERE lower(name) = lower(?)').get(name) as { id: string } | undefined;
  if (existing) return existing.id;
  const id = randomId(db);
  db.prepare('INSERT INTO companies (id, name, website) VALUES (?, ?, ?)').run(id, name, website ?? null);
  return id;
}

function insertPosting(db: DatabaseSync, companyId: string, job: ScrapedJob, source: string): void {
  const id = randomId(db);
  const today = new Date().toISOString().slice(0, 10);
  db.prepare(`
    INSERT INTO job_postings (id, company_id, title, link, source, scraped_date, status, description)
    VALUES (?, ?, ?, ?, ?, ?, 'new', ?)
  `).run(id, companyId, job.jobTitle, job.jobLink ?? null, source, today, job.description ?? null);
}

function updatePosting(db: DatabaseSync, postingId: string, job: ScrapedJob): void {
  db.prepare(
    'UPDATE job_postings SET link = COALESCE(?, link), description = COALESCE(?, description) WHERE id = ?'
  ).run(job.jobLink ?? null, job.description ?? null, postingId);
}

// ── Main sync ─────────────────────────────────────────────────────────────────

export function syncJobsToDB(jobs: ScrapedJob[]): SyncResult {
  const { companyMap, postingMap } = getExistingData();
  const db = getDb();

  let created = 0, updated = 0, skipped = 0;

  for (const job of jobs) {
    const text = `${job.description ?? ''} ${job.jobTitle}`;
    if (isDefense(text) || isDefense(job.companyName)) { skipped++; continue; }
    if (isHighTravel(job.description)) {
      console.log(`  ✗ SKIP ${job.companyName} — high travel`);
      skipped++; continue;
    }
    if (isNonCARemote(job.location)) {
      console.log(`  ✗ SKIP ${job.companyName} — location: ${job.location}`);
      skipped++; continue;
    }

    const source = job.isYC ? 'YC' : (job.source ?? 'Unknown');

    let companyId = companyMap.get(job.companyName.toLowerCase());
    if (!companyId) {
      companyId = upsertCompany(db, job.companyName, job.website);
      companyMap.set(job.companyName.toLowerCase(), companyId);
    }

    const postingKey = `${companyId}::${job.jobTitle.toLowerCase()}`;
    const existing = postingMap.get(postingKey);

    if (!existing) {
      insertPosting(db, companyId, job, source);
      postingMap.set(postingKey, { id: '', link: job.jobLink ?? null, status: 'new' });
      console.log(`  ✓ NEW  ${job.companyName} — ${job.jobTitle}`);
      created++;
    } else if (existing.status !== 'new') {
      skipped++;
    } else if (job.jobLink && existing.link !== job.jobLink) {
      updatePosting(db, existing.id, job);
      console.log(`  ↑ UPD  ${job.companyName} — ${job.jobTitle}`);
      updated++;
    } else {
      skipped++;
    }
  }

  db.close();
  return { created, updated, skipped };
}
