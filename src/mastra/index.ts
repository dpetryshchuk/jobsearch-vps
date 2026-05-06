import { Mastra } from '@mastra/core'
import { PostgresStore } from '@mastra/pg'
import { Observability } from '@mastra/observability'
import { LangfuseExporter } from '@mastra/langfuse'
import { jobsearchAgent } from './agents/jobsearch'

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
})
