import { Database, toNumber } from './client';
import { DailyMealTotalsRow, FoodAnalysis, MealRow } from '../types';
import { todayISOInBrt } from '../utils/dates';

const LOGGED_DATE_SQL = `(logged_at AT TIME ZONE 'America/Sao_Paulo')::date`;

interface RawMealRow extends Omit<MealRow, 'id' | 'user_id'> {
  id: string | number;
  user_id: string | number;
}

interface RawDailyMealTotalsRow extends Omit<DailyMealTotalsRow, 'total_calories' | 'meal_count'> {
  total_calories: string | number;
  meal_count: string | number;
}

function mapMeal(row: RawMealRow): MealRow {
  return {
    ...row,
    id: toNumber(row.id),
    user_id: toNumber(row.user_id),
    total_calories: toNumber(row.total_calories),
    total_protein_g: toNumber(row.total_protein_g),
    total_carbs_g: toNumber(row.total_carbs_g),
    total_fat_g: toNumber(row.total_fat_g),
  };
}

function mapDailyTotals(row: RawDailyMealTotalsRow): DailyMealTotalsRow {
  return {
    ...row,
    total_calories: toNumber(row.total_calories),
    total_protein_g: toNumber(row.total_protein_g),
    total_carbs_g: toNumber(row.total_carbs_g),
    total_fat_g: toNumber(row.total_fat_g),
    meal_count: toNumber(row.meal_count),
  };
}

export async function createMeal(
  db: Database,
  userId: number,
  analysis: FoodAnalysis,
  photoR2Key: string | null,
  audioR2Key: string | null,
  followUpText: string | null,
  source: string,
): Promise<void> {
  await db.exec(
    `INSERT INTO meals (
       user_id,
       description,
       food_items,
       total_calories,
       meal_type,
       total_protein_g,
       total_carbs_g,
       total_fat_g,
       photo_r2_key,
       audio_r2_key,
       follow_up_text,
       analysis_source
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      analysis.descricao,
      JSON.stringify(analysis.itens),
      analysis.total_calorias,
      analysis.meal_type,
      analysis.total_protein_g,
      analysis.total_carbs_g,
      analysis.total_fat_g,
      photoR2Key,
      audioR2Key,
      followUpText,
      source,
    ],
  );
}

export async function getTodayMeals(db: Database, userId: number): Promise<MealRow[]> {
  return getMealsByDate(db, userId, todayISOInBrt());
}

export async function getMealsByDate(
  db: Database,
  userId: number,
  date: string,
): Promise<MealRow[]> {
  return getMealsByDateRange(db, userId, date, date);
}

export async function getMealsByDateRange(
  db: Database,
  userId: number,
  startDate: string,
  endDate: string,
): Promise<MealRow[]> {
  const rows = await db.many<RawMealRow>(
    `SELECT * FROM meals
     WHERE user_id = ?
       AND ${LOGGED_DATE_SQL} >= ?::date
       AND ${LOGGED_DATE_SQL} <= ?::date
     ORDER BY logged_at ASC, id ASC`,
    [userId, startDate, endDate],
  );
  return rows.map(mapMeal);
}

export async function getHistoryByDay(
  db: Database,
  userId: number,
  days: number = 7,
): Promise<DailyMealTotalsRow[]> {
  const endDate = todayISOInBrt();
  const startDate = shiftDateIso(endDate, -(days - 1));
  const rows = await getDailyMealTotalsByDateRange(db, userId, startDate, endDate);
  return rows.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function getDailyMealTotalsByDateRange(
  db: Database,
  userId: number,
  startDate: string,
  endDate: string,
): Promise<DailyMealTotalsRow[]> {
  const rows = await db.many<RawDailyMealTotalsRow>(
    `SELECT ${LOGGED_DATE_SQL}::text AS date,
            COALESCE(SUM(total_calories), 0) AS total_calories,
            COALESCE(SUM(total_protein_g), 0) AS total_protein_g,
            COALESCE(SUM(total_carbs_g), 0) AS total_carbs_g,
            COALESCE(SUM(total_fat_g), 0) AS total_fat_g,
            COUNT(*) AS meal_count
     FROM meals
     WHERE user_id = ?
       AND ${LOGGED_DATE_SQL} >= ?::date
       AND ${LOGGED_DATE_SQL} <= ?::date
     GROUP BY ${LOGGED_DATE_SQL}
     ORDER BY ${LOGGED_DATE_SQL} ASC`,
    [userId, startDate, endDate],
  );

  return rows.map(mapDailyTotals);
}

export async function deleteMealById(db: Database, id: number, userId: number): Promise<boolean> {
  const result = await db.exec('DELETE FROM meals WHERE id = ? AND user_id = ?', [id, userId]);
  return result.rowCount > 0;
}

function shiftDateIso(isoDate: string, deltaDays: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}
