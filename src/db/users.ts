import { UserRow } from '../types';

export async function upsertUser(
  db: D1Database,
  id: number,
  firstName: string,
  username?: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO users (id, first_name, username)
       VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET first_name = ?, username = ?`,
    )
    .bind(id, firstName, username ?? null, firstName, username ?? null)
    .run();
}

export async function getUser(db: D1Database, id: number): Promise<UserRow | null> {
  return db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();
}

export async function getUserByUsername(db: D1Database, username: string): Promise<UserRow | null> {
  return db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first<UserRow>();
}

export async function setCalorieGoal(db: D1Database, userId: number, goal: number): Promise<void> {
  await db
    .prepare('UPDATE users SET daily_calorie_goal = ? WHERE id = ?')
    .bind(goal, userId)
    .run();
}
