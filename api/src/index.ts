import { createApp } from './app';
import { openPgDb } from './db';

// Only /api/* reaches this Worker (run_worker_first); everything else is served from the Angular build.
export default createApp((env) => openPgDb(env.HYPERDRIVE.connectionString));
