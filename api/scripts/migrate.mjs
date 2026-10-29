// Applies db/schema.sql to DATABASE_URL (e.g. the Neon connection string in .env).
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set (copy .env.example to .env).');
  process.exit(1);
}

const sql = await readFile(fileURLToPath(new URL('../db/schema.sql', import.meta.url)), 'utf8');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

await client.connect();
try {
  await client.query(sql);
  console.log('Schema applied.');
} finally {
  await client.end();
}
