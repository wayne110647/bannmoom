import pg from 'pg';

/** Anything that can run a query: the connection itself, or the connection inside a transaction. */
export interface Sql {
  query<R = Record<string, unknown>>(text: string, values?: unknown[]): Promise<R[]>;
}

export interface Db extends Sql {
  /** BEGIN … COMMIT, or ROLLBACK if `fn` throws. */
  transaction<T>(fn: (tx: Sql) => Promise<T>): Promise<T>;
}

export interface DbHandle {
  db: Db;
  close(): Promise<void>;
}

const NUMERIC = 1700;
const DATE = 1082;

/**
 * numeric → number (values are small: grams and baht with ≤ 6 decimals),
 * date → 'YYYY-MM-DD' string (never a JS Date, which would shift with the time zone).
 */
export const TYPE_PARSERS: Record<number, (value: string) => unknown> = {
  [NUMERIC]: Number,
  [DATE]: (value) => value,
};

const pgTypes = {
  getTypeParser: ((oid: number, format?: 'text' | 'binary') =>
    TYPE_PARSERS[oid] ?? pg.types.getTypeParser(oid, format)) as typeof pg.types.getTypeParser,
};

/**
 * One client per request: Worker sockets can't outlive the request that opened them.
 * Hyperdrive keeps the real connections to Neon pooled and warm, so this is cheap.
 */
export async function openPgDb(connectionString: string): Promise<DbHandle> {
  const client = new pg.Client({ connectionString, types: pgTypes });
  await client.connect();
  const query: Sql['query'] = async (text, values) => (await client.query(text, values)).rows;
  const db: Db = {
    query,
    async transaction(fn) {
      await client.query('BEGIN');
      try {
        const result = await fn({ query });
        await client.query('COMMIT');
        return result;
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
      }
    },
  };
  return { db, close: () => client.end().catch(() => {}) };
}

/** Postgres error code for a UNIQUE violation. */
export const isUniqueViolation = (e: unknown, constraint?: string) =>
  typeof e === 'object' && e !== null && (e as { code?: string }).code === '23505' &&
  (!constraint || (e as { constraint?: string }).constraint === constraint ||
    String((e as { message?: string }).message).includes(constraint));
