import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.join(__dirname, '..', 'migrations', 'neon');
const connectionString = process.env.NEON_DATABASE_URL;

if (!connectionString) {
  console.error('Missing NEON_DATABASE_URL.');
  process.exit(1);
}

const sql = neon(connectionString, { fullResults: true });

function splitStatements(source) {
  return source
    .split(/;\s*\n/g)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

await sql.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`);

const files = (await readdir(migrationsDir))
  .filter((file) => file.endsWith('.sql'))
  .sort((a, b) => a.localeCompare(b));

for (const file of files) {
  const existing = await sql.query('SELECT version FROM schema_migrations WHERE version = $1', [file]);
  if (existing.rowCount > 0) {
    console.log(`Skipping ${file}`);
    continue;
  }

  console.log(`Applying ${file}`);
  const source = await readFile(path.join(migrationsDir, file), 'utf8');
  const statements = splitStatements(source);

  if (statements.length === 0) {
    await sql.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
    continue;
  }

  await sql.transaction(
    [
      ...statements.map((statement) => sql.query(statement)),
      sql.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]),
    ],
    { fullResults: true },
  );
}

console.log(`Applied ${files.length} migration file(s).`);
