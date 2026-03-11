import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
  command: string;
}

export interface Database {
  query<T>(sqlText: string, params?: unknown[]): Promise<QueryResult<T>>;
  one<T>(sqlText: string, params?: unknown[]): Promise<T | null>;
  many<T>(sqlText: string, params?: unknown[]): Promise<T[]>;
  exec(sqlText: string, params?: unknown[]): Promise<QueryResult<Record<string, never>>>;
}

const sqlCache = new Map<string, NeonQueryFunction<false, true>>();

function getSql(connectionString: string): NeonQueryFunction<false, true> {
  const cached = sqlCache.get(connectionString);
  if (cached) {
    return cached;
  }

  const sql = neon(connectionString, { fullResults: true });
  sqlCache.set(connectionString, sql);
  return sql;
}

function toPgPlaceholders(sqlText: string): string {
  let index = 0;
  return sqlText.replace(/\?/g, () => `$${++index}`);
}

export function createDatabase(connectionString: string): Database {
  const sql = getSql(connectionString);

  async function execute<T>(sqlText: string, params: unknown[] = []): Promise<QueryResult<T>> {
    const result = (await sql.query(toPgPlaceholders(sqlText), params, {
      fullResults: true,
    })) as {
      rows: T[];
      rowCount?: number;
      command: string;
    };

    return {
      rows: result.rows,
      rowCount: result.rowCount ?? result.rows.length,
      command: result.command,
    };
  }

  return {
    query: execute,
    async one<T>(sqlText: string, params?: unknown[]) {
      const result = await execute<T>(sqlText, params);
      return result.rows[0] ?? null;
    },
    async many<T>(sqlText: string, params?: unknown[]) {
      const result = await execute<T>(sqlText, params);
      return result.rows;
    },
    exec(sqlText: string, params?: unknown[]) {
      return execute<Record<string, never>>(sqlText, params);
    },
  };
}

export function withDatabase<T extends { NEON_DATABASE_URL: string }>(bindings: T): T & { DB: Database } {
  return {
    ...bindings,
    DB: createDatabase(bindings.NEON_DATABASE_URL),
  };
}

export function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return Number(value);
  }

  return 0;
}
