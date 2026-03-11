import { FoodItem, MealType } from '../types';

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
        `• ${sanitizeWhatsAppText(item.nome)} (${sanitizeWhatsAppText(item.quantidade)}) — *${item.calorias} kcal* · P ${formatMacro(item.protein_g)}g · C ${formatMacro(item.carbs_g)}g · G ${formatMacro(item.fat_g)}g`,
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
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  mealType: MealType;
  loggedAt: string;
}

export function formatTodaySummary(meals: MealSummary[], goal: number): string {
  const totalCalories = meals.reduce((sum, m) => sum + m.totalCalories, 0);
  const totalProtein = meals.reduce((sum, meal) => sum + meal.totalProtein, 0);
  const totalCarbs = meals.reduce((sum, meal) => sum + meal.totalCarbs, 0);
  const totalFat = meals.reduce((sum, meal) => sum + meal.totalFat, 0);
  const remaining = goal - totalCalories;
  let text = `*Hoje*\n\n`;
  text += `• Consumo: *${totalCalories} / ${goal} kcal*\n`;
  text += `• Progresso: \`${progressBar(totalCalories, goal)}\`\n`;
  text += `• Macros: *P ${formatMacro(totalProtein)}g · C ${formatMacro(totalCarbs)}g · G ${formatMacro(totalFat)}g*\n`;

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
    text += `• *${time}* — ${mealTypeLabel(meal.mealType)} — ${sanitizeWhatsAppText(meal.description)}\n`;
    text += `  ${meal.totalCalories} kcal · P ${formatMacro(meal.totalProtein)}g · C ${formatMacro(meal.totalCarbs)}g · G ${formatMacro(meal.totalFat)}g\n`;
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
  days: {
    date: string;
    total_calories: number;
    total_protein_g: number;
    total_carbs_g: number;
    total_fat_g: number;
    meal_count: number;
  }[],
  goal: number,
): string {
  let text = `*Historico*\n\n`;

  for (const day of days) {
    const dateStr = day.date.slice(5).replace('-', '/');
    text += `• *${dateStr}* — ${day.total_calories} kcal (${day.meal_count} refeicoes)\n`;
    text += `  P ${formatMacro(day.total_protein_g)}g · C ${formatMacro(day.total_carbs_g)}g · G ${formatMacro(day.total_fat_g)}g\n`;
    text += `\`${progressBar(day.total_calories, goal, { width: 10 })}\`\n`;
  }

  const avg = Math.round(days.reduce((s, d) => s + d.total_calories, 0) / days.length);
  text += `\n*Media:* ${avg} kcal/dia`;

  return text;
}

export function mealTypeLabel(mealType: MealType): string {
  switch (mealType) {
    case 'breakfast':
      return 'Cafe da manha';
    case 'lunch':
      return 'Almoco';
    case 'dinner':
      return 'Jantar';
    case 'snack':
    default:
      return 'Lanche';
  }
}

export function formatMacro(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

export function formatWeightKg(value: number): string {
  return value.toFixed(1).replace('.', ',');
}
