import { Mastra } from '@mastra/core'
import { PostgresStore } from '@mastra/pg'
import { Observability } from '@mastra/observability'
import { LangfuseExporter } from '@mastra/langfuse'
import { jobsearchAgent } from './agents/jobsearch'
import { getPipeline, getRetro, getContentPosts, getLeads, getApplications, getNotes, searchNotes, createNote } from './queries'
import { randomBytes } from 'crypto'
import { writeFileSync, mkdirSync } from 'fs'
import { join, extname } from 'path'

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
        handler: async (c: any) => c.json(await getPipeline()),
      },
      {
        path: '/data/retro',
        method: 'GET' as const,
        handler: async (c: any) => c.json(await getRetro()),
      },
      {
        path: '/data/content',
        method: 'GET' as const,
        handler: async (c: any) => c.json(await getContentPosts()),
      },
      {
        path: '/data/leads',
        method: 'GET' as const,
        handler: async (c: any) => c.json(await getLeads()),
      },
      {
        path: '/data/applications',
        method: 'GET' as const,
        handler: async (c: any) => c.json(await getApplications()),
      },
      {
        path: '/data/notes',
        method: 'GET' as const,
        handler: async (c: any) => {
          const q = c.req.query('q')
          return c.json(q ? await searchNotes(q) : await getNotes())
        },
      },
      {
        path: '/data/resumes',
        method: 'POST' as const,
        handler: async (c: any) => {
          const formData = await c.req.formData()
          const file = formData.get('file') as File | null
          const applicationId = formData.get('applicationId') as string | null
          if (!file || !applicationId) return c.json({ error: 'Missing file or applicationId' }, 400)

          const uploadsDir = '/home/dima/jobsearch/uploads'
          mkdirSync(uploadsDir, { recursive: true })
          const ext = extname(file.name) || '.pdf'
          const fileName = `${applicationId}${ext}`
          const filePath = join(uploadsDir, fileName)
          writeFileSync(filePath, Buffer.from(await file.arrayBuffer()))

          const { pool: pg } = await import('./pool')
          await pg.query('UPDATE job_postings SET resume_path = $1 WHERE id = $2', [fileName, applicationId])
          return c.json({ path: fileName })
        },
      },
      {
        path: '/data/notes',
        method: 'POST' as const,
        handler: async (c: any) => {
          const body = await c.req.json()
          const note = await createNote({
            id: randomBytes(8).toString('hex'),
            category: body.category ?? 'note',
            title: body.title ?? null,
            url: body.url ?? null,
            content: body.content ?? null,
          })
          return c.json(note, 201)
        },
      },
    ],
  },
})
