export async function isAllowed(db: D1Database, userId: number): Promise<boolean> {
  const row = await db
    .prepare('SELECT 1 FROM allowed_users WHERE user_id = ?')
    .bind(userId)
    .first();
  return row !== null;
}

export async function addAllowed(db: D1Database, userId: number): Promise<void> {
  await db
    .prepare('INSERT OR IGNORE INTO allowed_users (user_id) VALUES (?)')
    .bind(userId)
    .run();
}

export async function removeAllowed(db: D1Database, userId: number): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM allowed_users WHERE user_id = ?')
    .bind(userId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function listAllowed(db: D1Database): Promise<number[]> {
  const result = await db
    .prepare('SELECT user_id FROM allowed_users')
    .all<{ user_id: number }>();
  return result.results.map((r) => r.user_id);
}
