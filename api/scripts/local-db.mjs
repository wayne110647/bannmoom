// Local Postgres for `wrangler dev` without Docker or a Neon account:
// PGlite (real Postgres in WebAssembly) served over the Postgres wire protocol.
// Data persists in ./.pglite — delete that folder to start fresh.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const PORT = 54329;
const dataDir = fileURLToPath(new URL('../.pglite', import.meta.url));

const db = await PGlite.create(dataDir);
await db.exec(await readFile(fileURLToPath(new URL('../db/schema.sql', import.meta.url)), 'utf8'));

// The app fires parallel requests (e.g. an ingredient and its history), each on its own connection.
// PGlite is still one session underneath, so overlapping transactions aren't isolated — fine for local
// clicking around, which is all this is for. Production uses Neon via Hyperdrive.
const server = new PGLiteSocketServer({ db, port: PORT, host: '127.0.0.1', maxConnections: 20 });
await server.start();
console.log(`Local Postgres ready on 127.0.0.1:${PORT} (data: .pglite). Ctrl+C to stop.`);

const stop = async () => {
  await server.stop();
  await db.close();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
