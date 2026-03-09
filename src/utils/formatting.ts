import { FoodItem } from '../types';

interface ProgressBarOptions {
  width?: number;
  filled?: string;
  empty?: string;
}

export function sanitizeWhatsAppText(text: string): string {
  return text.replace(/[*_~`]/g, '');
}

export function formatFoodItems(items: FoodItem[]): string {
  return items
    .map(
      (item) =>
        `• ${sanitizeWhatsAppText(item.nome)} (${sanitizeWhatsAppText(item.quantidade)}) — *${item.calorias} kcal*`,
    )
    .join('\n');
}

export function progressBar(
  current: number,
  goal: number,
  options: ProgressBarOptions = {},
): string {
  const width = options.width ?? 10;
  const filledGlyph = options.filled ?? '█';
  const emptyGlyph = options.empty ?? '—';
  const safeGoal = goal > 0 ? goal : 1;
  const ratio = Math.max(0, current / safeGoal);
  const clampedRatio = Math.min(ratio, 1);
  const filled = Math.round(clampedRatio * width);
  const empty = Math.max(0, width - filled);
  const bar = filledGlyph.repeat(filled) + emptyGlyph.repeat(empty);
  const pct = Math.round(ratio * 100);
  return `${bar} ${pct}%`;
}

interface MealSummary {
  description: string;
  items: FoodItem[];
  totalCalories: number;
  loggedAt: string;
}

export function formatTodaySummary(meals: MealSummary[], goal: number): string {
  const totalCalories = meals.reduce((sum, m) => sum + m.totalCalories, 0);
  const remaining = goal - totalCalories;
  let text = `*Hoje*\n\n`;
  text += `• Consumo: *${totalCalories} / ${goal} kcal*\n`;
  text += `• Progresso: \`${progressBar(totalCalories, goal)}\`\n`;

  if (remaining > 0) {
    text += `• Restante: *${remaining} kcal*\n`;
  } else if (remaining < 0) {
    text += `• Excesso: *${Math.abs(remaining)} kcal*\n`;
  } else {
    text += `• Status: *Meta atingida*\n`;
  }

  text += `\n*Refeicoes (${meals.length})*\n`;

  for (let i = 0; i < meals.length; i += 1) {
    const meal = meals[i];
    const utc = new Date(meal.loggedAt + 'Z');
    const brt = new Date(utc.getTime() - 3 * 60 * 60 * 1000);
    const time = brt.toISOString().slice(11, 16);
    text += `• *${time}* — ${sanitizeWhatsAppText(meal.description)}\n`;
    text += `  ${meal.totalCalories} kcal\n`;
    if (meal.items.length > 0) {
      const compactItems = meal.items
        .slice(0, 4)
        .map((item) => sanitizeWhatsAppText(item.nome))
        .join(', ');
      text += `  _Itens:_ ${compactItems}${meal.items.length > 4 ? ', ...' : ''}\n`;
    }
    if (i < meals.length - 1) {
      text += '\n';
    }
  }

  return text;
}

export function formatHistory(
  days: { date: string; total_calories: number; meal_count: number }[],
  goal: number,
): string {
  let text = `*Historico*\n\n`;

  for (const day of days) {
    const dateStr = day.date.slice(5).replace('-', '/');
    text += `• *${dateStr}* — ${day.total_calories} kcal (${day.meal_count} refeicoes)\n`;
    text += `\`${progressBar(day.total_calories, goal, { width: 10 })}\`\n`;
  }

  const avg = Math.round(days.reduce((s, d) => s + d.total_calories, 0) / days.length);
  text += `\n*Media:* ${avg} kcal/dia`;

  return text;
}
