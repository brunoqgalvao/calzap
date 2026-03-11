import { Database, toNumber } from './client';

interface AllowedRow {
  user_id: string | number;
}

export function isAccessOpen(accessMode: string | undefined): boolean {
  return (accessMode ?? 'open') !== 'restricted';
}

export async function isAllowed(db: Database, userId: number): Promise<boolean> {
  const row = await db.one('SELECT 1 FROM allowed_users WHERE user_id = ?', [userId]);
  return row !== null;
}

export async function addAllowed(db: Database, userId: number): Promise<void> {
  await db.exec('INSERT INTO allowed_users (user_id) VALUES (?) ON CONFLICT (user_id) DO NOTHING', [userId]);
}

export async function removeAllowed(db: Database, userId: number): Promise<boolean> {
  const result = await db.exec('DELETE FROM allowed_users WHERE user_id = ?', [userId]);
  return result.rowCount > 0;
}

export async function listAllowed(db: Database): Promise<number[]> {
  const rows = await db.many<AllowedRow>('SELECT user_id FROM allowed_users ORDER BY user_id ASC');
  return rows.map((row) => toNumber(row.user_id));
}
