import { Mastra } from '@mastra/core'
import { PostgresStore } from '@mastra/pg'
import { Observability } from '@mastra/observability'
import { LangfuseExporter } from '@mastra/langfuse'
import { jobsearchAgent } from './agents/jobsearch'
import { Pool } from 'pg'

const storage = new PostgresStore({
  id: 'pg-storage',
  connectionString: process.env.DATABASE_URL!,
})

const observability = new Observability({
  configs: {
    langfuse: {
      serviceName: 'jobsearch-crm',
      exporters: [
        new LangfuseExporter({
          publicKey: process.env.LANGFUSE_PUBLIC_KEY,
          secretKey: process.env.LANGFUSE_SECRET_KEY,
          baseUrl: process.env.LANGFUSE_HOST ?? 'https://cloud.langfuse.com',
          realtime: true,
        }),
      ],
    },
  },
})

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export const mastra = new Mastra({
  agents: { jobsearchAgent },
  storage,
  observability,
  server: {
    apiRoutes: [
      {
        path: '/data/usage',
        method: 'GET' as const,
        handler: async (c: any) => {
          const base = process.env.LANGFUSE_HOST ?? 'https://cloud.langfuse.com'
          const auth = Buffer.from(`${process.env.LANGFUSE_PUBLIC_KEY}:${process.env.LANGFUSE_SECRET_KEY}`).toString('base64')

          const [tracesRes, dailyRes] = await Promise.all([
            fetch(`${base}/api/public/traces?limit=50&orderBy=timestamp&order=DESC`, {
              headers: { Authorization: `Basic ${auth}` },
            }),
            fetch(`${base}/api/public/metrics/daily?limit=30`, {
              headers: { Authorization: `Basic ${auth}` },
            }),
          ])

          const [traces, daily] = await Promise.all([tracesRes.json(), dailyRes.json()])
          return c.json({ traces: traces.data ?? [], daily: daily.data ?? [] })
        },
      },
      {
        path: '/data/pipeline',
        method: 'GET' as const,
        handler: async (c: any) => {
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
          return c.json(result.rows)
        },
      },
      {
        path: '/data/retro',
        method: 'GET' as const,
        handler: async (c: any) => {
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
          return c.json({
            weekly: weekly.rows,
            bySource: bySource.rows,
            stats: stats.rows[0],
            needsAction: needsAction.rows,
            alltime: alltime.rows[0],
          })
        },
      },
    ],
  },
})
