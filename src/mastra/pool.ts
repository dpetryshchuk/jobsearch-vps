import { Pool } from 'pg'

export const pool = new Pool({ connectionString: process.env.DATABASE_URL })

pool.query(`
  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL DEFAULT 'note',
    title TEXT,
    url TEXT,
    content TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`).catch(console.error)
