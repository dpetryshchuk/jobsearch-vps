import { pool } from './pool'

export interface PipelineRow {
  id: string
  name: string
  role: string | null
  source: string
  stage: string
  company: string | null
  last_contact: string | null
}

export async function getPipeline(): Promise<PipelineRow[]> {
  const result = await pool.query(`
    SELECT c.id, c.name, c.role, c.source, c.stage,
           co.name as company,
           MAX(i.date) as last_contact
    FROM contacts c
    LEFT JOIN companies co ON c.company_id = co.id
    LEFT JOIN interactions i ON i.contact_id = c.id
    GROUP BY c.id, c.name, c.role, c.source, c.stage, co.name
    ORDER BY
      CASE c.stage WHEN 'Ongoing' THEN 1 WHEN 'Responded' THEN 2 WHEN 'Outreached' THEN 3 ELSE 4 END,
      MAX(i.date) DESC NULLS LAST
  `)
  return result.rows
}

export interface RetroResult {
  weekly: { week: string; direction: string; n: string }[]
  bySource: { source: string; stage: string; n: string }[]
  stats: {
    sent_week: string
    received_week: string
    active: string
    total_contacts: string
  }
  needsAction: { name: string; company: string | null; stage: string; last_contact: string | null }[]
  alltime: {
    sent_total: string
    received_total: string
    contacts_total: string
    dead_total: string
    first_interaction: string | null
  }
}

export async function getRetro(): Promise<RetroResult> {
  const [weekly, bySource, stats, needsAction, alltime] = await Promise.all([
    pool.query(`
      SELECT to_char(date_trunc('week', date::timestamp), 'YYYY-MM-DD') as week,
             direction, COUNT(*) as n
      FROM interactions
      GROUP BY week, direction
      ORDER BY week DESC
    `),
    pool.query(`
      SELECT source, stage, COUNT(*) as n
      FROM contacts
      GROUP BY source, stage
      ORDER BY source, stage
    `),
    pool.query(`
      SELECT
        (SELECT COUNT(*) FROM interactions WHERE direction = 'out'
           AND date >= CURRENT_DATE - 7) as sent_week,
        (SELECT COUNT(*) FROM interactions WHERE direction = 'in'
           AND date >= CURRENT_DATE - 7) as received_week,
        (SELECT COUNT(*) FROM contacts WHERE stage IN ('Responded','Ongoing')) as active,
        (SELECT COUNT(*) FROM contacts WHERE stage != 'Dead') as total_contacts
    `),
    pool.query(`
      SELECT c.name, co.name as company, c.stage, MAX(i.date) as last_contact
      FROM contacts c
      LEFT JOIN companies co ON c.company_id = co.id
      LEFT JOIN interactions i ON i.contact_id = c.id
      WHERE c.stage IN ('Responded', 'Ongoing')
      GROUP BY c.id, c.name, co.name, c.stage
      HAVING MAX(i.date) < CURRENT_DATE - 3 OR MAX(i.date) IS NULL
      ORDER BY last_contact ASC NULLS FIRST
      LIMIT 10
    `),
    pool.query(`
      SELECT
        (SELECT COUNT(*) FROM interactions WHERE direction = 'out') as sent_total,
        (SELECT COUNT(*) FROM interactions WHERE direction = 'in') as received_total,
        (SELECT COUNT(*) FROM contacts) as contacts_total,
        (SELECT COUNT(*) FROM contacts WHERE stage = 'Dead') as dead_total,
        (SELECT MIN(date) FROM interactions) as first_interaction
    `),
  ])
  return {
    weekly: weekly.rows,
    bySource: bySource.rows,
    stats: stats.rows[0],
    needsAction: needsAction.rows,
    alltime: alltime.rows[0],
  }
}

export interface LeadRow {
  id: string
  title: string
  company: string | null
  source: string
  link: string | null
  scraped_date: string
}

export async function getLeads(): Promise<LeadRow[]> {
  const result = await pool.query(`
    SELECT jp.id, jp.title, co.name as company, jp.source, jp.link, jp.scraped_date
    FROM job_postings jp
    LEFT JOIN companies co ON jp.company_id = co.id
    WHERE jp.status = 'new'
    ORDER BY jp.scraped_date DESC
  `)
  return result.rows
}

export interface ApplicationRow {
  id: string
  title: string
  company: string | null
  source: string
  link: string | null
  scraped_date: string
  resume_path: string | null
}

export async function getApplications(): Promise<ApplicationRow[]> {
  const result = await pool.query(`
    SELECT jp.id, jp.title, co.name as company, jp.source, jp.link,
           jp.scraped_date, jp.resume_path
    FROM job_postings jp
    LEFT JOIN companies co ON jp.company_id = co.id
    WHERE jp.status = 'applied'
    ORDER BY jp.scraped_date DESC
  `)
  return result.rows
}

export interface ContentPostRow {
  id: string
  posted_date: string
  content: string
  impressions: number
  engagements: number
  comments: number
}

export async function getContentPosts(): Promise<ContentPostRow[]> {
  const result = await pool.query(`
    SELECT id, posted_date, content, impressions, engagements, comments
    FROM content_posts
    ORDER BY posted_date DESC
  `)
  return result.rows
}
