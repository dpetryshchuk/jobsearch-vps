#!/usr/bin/env tsx
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

process.removeAllListeners('warning');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../db/jobsearch.sqlite');

if (!fs.existsSync(DB_PATH)) {
  console.error(`Database not found at ${DB_PATH}`);
  process.exit(1);
}

const db = new DatabaseSync(DB_PATH);

let sql = process.argv[2];
if (!sql) {
  try { sql = fs.readFileSync(0, 'utf8'); } catch { /* no stdin */ }
}
if (!sql?.trim()) {
  console.error('Usage: node tools/query.js "SQL"');
  process.exit(1);
}
sql = sql.trim();

try {
  const upper = sql.replace(/\s+/g, ' ').trimStart().toUpperCase();
  const isRead = upper.startsWith('SELECT') || upper.startsWith('WITH') || upper.startsWith('PRAGMA');

  if (isRead) {
    const rows = db.prepare(sql).all();
    console.log(JSON.stringify(rows, null, 2));
  } else {
    const result = db.prepare(sql).run();
    console.log(JSON.stringify({ changes: result.changes, lastInsertRowid: result.lastInsertRowid }));
  }
} catch (err) {
  console.error('SQL error:', (err as Error).message);
  console.error('Query:', sql.slice(0, 200));
  process.exit(1);
}
