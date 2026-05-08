import { Mastra } from '@mastra/core'
import { PostgresStore } from '@mastra/pg'
import { Observability } from '@mastra/observability'
import { LangfuseExporter } from '@mastra/langfuse'
import { jobsearchAgent } from './agents/jobsearch'
import { getPipeline, getRetro, getContentPosts, getLeads, getApplications } from './queries'

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
    ],
  },
})
