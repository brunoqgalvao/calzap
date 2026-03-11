import { Database, toNumber } from './client';
import { MessageRole, MessageRow } from '../types';

interface RawMessageRow extends Omit<MessageRow, 'id'> {
  id: string | number;
}

function mapMessage(row: RawMessageRow): MessageRow {
  return {
    ...row,
    id: toNumber(row.id),
  };
}

export async function saveMessage(
  db: Database,
  userId: number,
  role: MessageRole,
  content: string,
): Promise<void> {
  await db.exec('INSERT INTO messages (user_id, role, content) VALUES (?, ?, ?)', [userId, role, content]);
}

export async function getRecentMessages(
  db: Database,
  userId: number,
  limit: number = 10,
): Promise<MessageRow[]> {
  const rows = await db.many<RawMessageRow>(
    `SELECT * FROM messages
     WHERE user_id = ?
     ORDER BY created_at DESC, id DESC
     LIMIT ?`,
    [userId, limit],
  );

  return rows.map(mapMessage).reverse();
}
