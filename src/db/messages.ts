import { MessageRole, MessageRow } from '../types';

export async function saveMessage(
  db: D1Database,
  userId: number,
  role: MessageRole,
  content: string,
): Promise<void> {
  await db
    .prepare('INSERT INTO messages (user_id, role, content) VALUES (?, ?, ?)')
    .bind(userId, role, content)
    .run();
}

export async function getRecentMessages(
  db: D1Database,
  userId: number,
  limit: number = 10,
): Promise<MessageRow[]> {
  const result = await db
    .prepare(
      `SELECT * FROM messages
       WHERE user_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
    )
    .bind(userId, limit)
    .all<MessageRow>();

  return result.results.reverse();
}
