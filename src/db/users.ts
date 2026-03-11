import { Database, toNumber } from './client';
import { UserRow } from '../types';

interface RawUserRow extends Omit<UserRow, 'id'> {
  id: string | number;
}

function mapUser(row: RawUserRow | null): UserRow | null {
  if (!row) {
    return null;
  }

  return {
    ...row,
    id: toNumber(row.id),
  };
}

export async function upsertUser(
  db: Database,
  id: number,
  firstName: string,
  username?: string,
): Promise<void> {
  await db.exec(
    `INSERT INTO users (id, first_name, username)
     VALUES (?, ?, ?)
     ON CONFLICT (id) DO UPDATE
       SET first_name = EXCLUDED.first_name,
           username = EXCLUDED.username`,
    [id, firstName, username ?? null],
  );
}

export async function getUser(db: Database, id: number): Promise<UserRow | null> {
  return mapUser(await db.one<RawUserRow>('SELECT * FROM users WHERE id = ?', [id]));
}

export async function getUserByUsername(db: Database, username: string): Promise<UserRow | null> {
  return mapUser(await db.one<RawUserRow>('SELECT * FROM users WHERE username = ?', [username]));
}

export async function setCalorieGoal(db: Database, userId: number, goal: number): Promise<void> {
  await db.exec('UPDATE users SET daily_calorie_goal = ? WHERE id = ?', [goal, userId]);
}
