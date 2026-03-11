import { FoodAnalysis, FoodItem, MealType } from '../types';

export function normalizeFoodAnalysis(analysis: FoodAnalysis, now: Date = new Date()): FoodAnalysis {
  const items = analysis.itens.map(normalizeFoodItem);

  const computedCalories = items.reduce((sum, item) => sum + item.calorias, 0);
  const computedProtein = items.reduce((sum, item) => sum + item.protein_g, 0);
  const computedCarbs = items.reduce((sum, item) => sum + item.carbs_g, 0);
  const computedFat = items.reduce((sum, item) => sum + item.fat_g, 0);

  return {
    ...analysis,
    itens: items,
    total_calorias: computedCalories > 0 ? computedCalories : Math.max(0, Math.round(analysis.total_calorias)),
    total_protein_g: computedProtein > 0 ? roundMacro(computedProtein) : roundMacro(analysis.total_protein_g),
    total_carbs_g: computedCarbs > 0 ? roundMacro(computedCarbs) : roundMacro(analysis.total_carbs_g),
    total_fat_g: computedFat > 0 ? roundMacro(computedFat) : roundMacro(analysis.total_fat_g),
    meal_type: normalizeMealType(analysis.meal_type, now),
  };
}

export function normalizeMealType(mealType: string | undefined, now: Date = new Date()): MealType {
  if (mealType === 'breakfast' || mealType === 'lunch' || mealType === 'dinner' || mealType === 'snack') {
    return mealType;
  }

  const hour = now.getUTCHours() - 3;
  if (hour >= 5 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 15) return 'lunch';
  if (hour >= 18 && hour < 23) return 'dinner';
  return 'snack';
}

function normalizeFoodItem(item: FoodItem): FoodItem {
  return {
    ...item,
    calorias: Math.max(0, Math.round(item.calorias)),
    protein_g: roundMacro(item.protein_g),
    carbs_g: roundMacro(item.carbs_g),
    fat_g: roundMacro(item.fat_g),
  };
}

function roundMacro(value: number | undefined): number {
  const safeValue = Number.isFinite(value) ? Number(value) : 0;
  return Math.round(safeValue * 10) / 10;
}
