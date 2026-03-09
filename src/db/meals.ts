import { MealRow, FoodAnalysis } from '../types';

export async function createMeal(
  db: D1Database,
  userId: number,
  analysis: FoodAnalysis,
  photoR2Key: string | null,
  audioR2Key: string | null,
  followUpText: string | null,
  source: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO meals (user_id, description, food_items, total_calories, photo_r2_key, audio_r2_key, follow_up_text, analysis_source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      userId,
      analysis.descricao,
      JSON.stringify(analysis.itens),
      analysis.total_calorias,
      photoR2Key,
      audioR2Key,
      followUpText,
      source,
    )
    .run();
}

export async function getTodayMeals(db: D1Database, userId: number): Promise<MealRow[]> {
  const result = await db
    .prepare(
      `SELECT * FROM meals
       WHERE user_id = ? AND date(logged_at, '-3 hours') = date('now', '-3 hours')
       ORDER BY logged_at ASC`,
    )
    .bind(userId)
    .all<MealRow>();
  return result.results;
}

export async function getHistoryByDay(
  db: D1Database,
  userId: number,
  days: number = 7,
): Promise<{ date: string; total_calories: number; meal_count: number }[]> {
  const result = await db
    .prepare(
      `SELECT date(logged_at, '-3 hours') as date,
              SUM(total_calories) as total_calories,
              COUNT(*) as meal_count
       FROM meals
       WHERE user_id = ? AND date(logged_at, '-3 hours') >= date('now', '-3 hours', '-' || ? || ' days')
       GROUP BY date(logged_at, '-3 hours')
       ORDER BY date(logged_at, '-3 hours') DESC`,
    )
    .bind(userId, days)
    .all<{ date: string; total_calories: number; meal_count: number }>();
  return result.results;
}

export async function deleteMealById(db: D1Database, id: number, userId: number): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM meals WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}
