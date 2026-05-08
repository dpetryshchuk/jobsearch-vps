#!/usr/bin/env tsx
import 'dotenv/config';
import { syncJobsToDB, isDefense, isNonCARemote, type ScrapedJob } from './scraper-utils';
import { matchesRole } from './filters';

const DRY_RUN = process.argv.includes('--dry');

const BATCH_ORDER = ['W26', 'F25', 'S25', 'W25', 'S24', 'W24', 'S23', 'W23'];

const SEARCH_QUERIES = [
  'forward deployed engineer', 'AI engineer', 'ML engineer',
  'solutions engineer', 'sales engineer', 'automation engineer',
  'implementation engineer', 'customer engineer',
  'technical account manager', "founder's associate", 'founders associate',
];

const LOCATION_ALLOWLIST = [
  'ca,', 'ca ', ', ca', 'california', 'san francisco', 'los angeles',
  'bay area', 'san jose', 'san diego', 'santa clara', 'palo alto',
  'remote', 'anywhere', 'us / remote', 'remote (us)', 'remote, us',
];

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

function matchesLocation(location: string): boolean {
  if (!location || location.trim() === '') return true;
  const lower = location.toLowerCase();
  if (lower.includes('remote')) {
    const m = lower.match(/remote\s*\(([^)]+)\)/);
    if (m && m[1].trim().toLowerCase() !== 'us' && m[1].trim().toLowerCase() !== 'united states') return false;
  }
  return LOCATION_ALLOWLIST.some(kw => lower.includes(kw));
}

function batchRank(batch: string): number {
  const idx = BATCH_ORDER.indexOf(batch);
  return idx === -1 ? BATCH_ORDER.length : idx;
}

async function getInertiaVersion(): Promise<string | null> {
  const res = await fetch('https://www.workatastartup.com/companies?query=ai+engineer', {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
  });
  const html = await res.text();
  const match = html.match(/data-page="([^"]+)"/);
  if (!match) return null;
  return (JSON.parse(match[1].replace(/&quot;/g, '"')) as { version?: string })?.version ?? null;
}

interface RawJob {
  companyName: string;
  companyOneLiner?: string;
  companySlug: string;
  companyBatch?: string;
  title?: string;
  applyUrl?: string;
  location?: string;
}

function normalizeJob(job: RawJob): ScrapedJob & { location: string; batch: string } {
  return {
    companyName: job.companyName,
    description: job.companyOneLiner ?? '',
    website: `https://www.workatastartup.com/companies/${job.companySlug}`,
    jobTitle: (job.title ?? '').trim(),
    jobLink: job.applyUrl || `https://www.workatastartup.com/companies/${job.companySlug}`,
    location: job.location ?? '',
    batch: job.companyBatch ?? '',
    isYC: true,
  };
}

async function fetchJobs(query: string, inertiaVersion: string | null): Promise<ScrapedJob[]> {
  const params = new URLSearchParams({
    demographic: 'any', hasEquity: 'any', hasSalary: 'any', industry: 'any',
    interviewProcess: 'any', jobType: 'any', layout: 'list-compact',
    query, sortBy: 'keyword', tab: 'any', usVisaNotRequired: 'any',
  });
  const headers: Record<string, string> = {
    'X-Inertia': 'true', 'X-Requested-With': 'XMLHttpRequest',
    Accept: 'application/json, text/plain, */*', 'User-Agent': UA,
  };
  if (inertiaVersion) headers['X-Inertia-Version'] = inertiaVersion;

  const res = await fetch(`https://www.workatastartup.com/companies?${params}`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} for query "${query}"`);
  const data = await res.json() as { props?: { jobs?: RawJob[] } };
  return (data?.props?.jobs ?? []).flatMap(normalizeJob).filter(j =>
    matchesRole(j.jobTitle) &&
    !isDefense(j.description) &&
    !isDefense(j.companyName) &&
    matchesLocation(j.location ?? '')
  );
}

async function main(): Promise<void> {
  let inertiaVersion: string | null = null;
  try {
    inertiaVersion = await getInertiaVersion();
    console.log(`Inertia version: ${inertiaVersion ?? '(not found)'}`);
  } catch (err) {
    console.error(`Version fetch error: ${(err as Error).message}`);
  }

  const seen = new Set<string>();
  let allJobs: (ScrapedJob & { batch: string })[] = [];

  for (const query of SEARCH_QUERIES) {
    console.log(`Query: "${query}"...`);
    try {
      const jobs = await fetchJobs(query, inertiaVersion) as (ScrapedJob & { batch: string })[];
      for (const j of jobs) {
        const key = j.companyName.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        allJobs.push(j);
      }
      console.log(`  ${jobs.length} matches`);
    } catch (err) {
      console.error(`  Error: ${(err as Error).message}`);
    }
  }

  allJobs.sort((a, b) => batchRank(a.batch) - batchRank(b.batch));
  console.log(`\nTotal unique matches: ${allJobs.length}`);
  if (allJobs.length === 0) { console.log('Nothing found.'); return; }

  if (DRY_RUN) {
    for (const job of allJobs) {
      console.log(`  [${job.batch}] ${job.companyName} — ${job.jobTitle}`);
      console.log(`    📍 ${job.location}`);
      console.log(`    ${job.jobLink}`);
    }
    return;
  }

  const { created, updated, skipped } = await syncJobsToDB(allJobs);
  console.log(`\nDone. +${created} new | ~${updated} updated | ${skipped} skipped`);
}

main().catch(err => { console.error(err); process.exit(1); });
