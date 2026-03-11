import { Database, toNumber } from './client';
import { WeightRow } from '../types';

const MEASURED_DATE_SQL = `(measured_at AT TIME ZONE 'America/Sao_Paulo')::date`;

interface RawWeightRow extends Omit<WeightRow, 'id' | 'user_id'> {
  id: string | number;
  user_id: string | number;
}

function mapWeight(row: RawWeightRow | null): WeightRow | null {
  if (!row) {
    return null;
  }

  return {
    ...row,
    id: toNumber(row.id),
    user_id: toNumber(row.user_id),
    weight_kg: toNumber(row.weight_kg),
  };
}

export async function logWeight(
  db: Database,
  userId: number,
  weightKg: number,
  note?: string,
): Promise<void> {
  await db.exec('INSERT INTO weights (user_id, weight_kg, note) VALUES (?, ?, ?)', [
    userId,
    roundWeight(weightKg),
    note ?? null,
  ]);
}

export async function getLatestWeight(db: Database, userId: number): Promise<WeightRow | null> {
  return mapWeight(
    await db.one<RawWeightRow>(
      'SELECT * FROM weights WHERE user_id = ? ORDER BY measured_at DESC, id DESC LIMIT 1',
      [userId],
    ),
  );
}

export async function getPreviousWeight(
  db: Database,
  userId: number,
  latestId: number,
): Promise<WeightRow | null> {
  return mapWeight(
    await db.one<RawWeightRow>(
      'SELECT * FROM weights WHERE user_id = ? AND id < ? ORDER BY measured_at DESC, id DESC LIMIT 1',
      [userId, latestId],
    ),
  );
}

export async function getWeightsByDateRange(
  db: Database,
  userId: number,
  startDate: string,
  endDate: string,
): Promise<WeightRow[]> {
  const rows = await db.many<RawWeightRow>(
    `SELECT * FROM weights
     WHERE user_id = ?
       AND ${MEASURED_DATE_SQL} >= ?::date
       AND ${MEASURED_DATE_SQL} <= ?::date
     ORDER BY measured_at ASC, id ASC`,
    [userId, startDate, endDate],
  );

  return rows.map((row) => mapWeight(row)).filter((row): row is WeightRow => row !== null);
}

function roundWeight(value: number): number {
  return Math.round(value * 10) / 10;
}
