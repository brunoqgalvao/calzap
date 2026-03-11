import { recordAiUsage, recordEvent } from '../analytics/events';
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject, tool } from 'ai';
import { z } from 'zod';
import { Env, FoodItem } from '../types';
import { deleteMealById, getHistoryByDay, getTodayMeals, createMeal } from '../db/meals';
import { getLatestWeight, getPreviousWeight, getWeightsByDateRange, logWeight } from '../db/weights';
import { getUser, setCalorieGoal } from '../db/users';
import {
  mealTypeLabel,
  formatFoodItems,
  formatHistory,
  formatWeightKg,
  formatTodaySummary,
  sanitizeWhatsAppText,
} from '../utils/formatting';
import { normalizeFoodAnalysis } from '../utils/nutrition';
import { todayISOInBrt } from '../utils/dates';

const FOOD_ANALYSIS_SCHEMA = z.object({
  descricao: z.string(),
  meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  itens: z.array(
    z.object({
      nome: z.string(),
      quantidade: z.string(),
      calorias: z.number().int().nonnegative(),
      protein_g: z.number().nonnegative(),
      carbs_g: z.number().nonnegative(),
      fat_g: z.number().nonnegative(),
    }),
  ),
  total_calorias: z.number().int().nonnegative(),
  total_protein_g: z.number().nonnegative(),
  total_carbs_g: z.number().nonnegative(),
  total_fat_g: z.number().nonnegative(),
  confianca: z.enum(['alta', 'media', 'baixa']),
  observacoes: z.string(),
});

const TEXT_ANALYSIS_PROMPT = `Voce e um nutricionista especializado em estimar calorias e macronutrientes de alimentos.
O usuario descreveu o que comeu por texto.
Classifique a refeicao em meal_type usando:
- breakfast = cafe da manha
- lunch = almoco
- dinner = jantar
- snack = lanche / sobremesa / belisco

Estime quantidades, calorias, proteinas, carboidratos e gorduras de forma realista e conservadora.
Retorne somente os campos do schema.`;

interface ToolOptions {
  disableMealLogging?: boolean;
}

export function createCalTrackerTools(env: Env, userId: number, options: ToolOptions = {}) {
  const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });

  return {
    get_today_summary: tool({
      description: 'Mostra o resumo de calorias e refeicoes do dia atual.',
      inputSchema: z.object({}),
      execute: async () => {
        const meals = await getTodayMeals(env.DB, userId);
        if (meals.length === 0) {
          const dbUser = await getUser(env.DB, userId);
          const goal = dbUser?.daily_calorie_goal ?? 2000;
          return `*Hoje*\n\n• Consumo: *0 / ${goal} kcal*\n• Progresso: \`${'—'.repeat(10)} 0%\`\n• Macros: *P 0g · C 0g · G 0g*\n• Nenhuma refeicao registrada ainda.`;
        }

        const dbUser = await getUser(env.DB, userId);
        const goal = dbUser?.daily_calorie_goal ?? 2000;

        const summary = formatTodaySummary(
          meals.map((meal) => ({
            description: meal.description,
            items: JSON.parse(meal.food_items) as FoodItem[],
            totalCalories: meal.total_calories,
            totalProtein: meal.total_protein_g,
            totalCarbs: meal.total_carbs_g,
            totalFat: meal.total_fat_g,
            mealType: meal.meal_type,
            loggedAt: meal.logged_at,
          })),
          goal,
        );

        return summary;
      },
    }),

    get_history: tool({
      description: 'Mostra historico calorico por dia dos ultimos N dias.',
      inputSchema: z.object({
        days: z.number().int().min(1).max(30).default(7),
      }),
      execute: async ({ days }) => {
        const history = await getHistoryByDay(env.DB, userId, days);
        if (history.length === 0) {
          return '*Historico*\n\n• Nenhum historico encontrado ainda.';
        }

        const dbUser = await getUser(env.DB, userId);
        const goal = dbUser?.daily_calorie_goal ?? 2000;
        return formatHistory(history, goal);
      },
    }),

    get_weight_summary: tool({
      description: 'Mostra o peso mais recente do usuario e a variacao no periodo.',
      inputSchema: z.object({
        days: z.number().int().min(1).max(120).default(30),
      }),
      execute: async ({ days }) => {
        const latest = await getLatestWeight(env.DB, userId);
        if (!latest) {
          return '*Peso*\n\n• Nenhum peso registrado ainda.\n• Envie algo como: `meu peso hoje foi 82,4 kg`.';
        }

        const endDate = todayISOInBrt();
        const startDate = shiftDateIso(endDate, -(days - 1));
        const entries = await getWeightsByDateRange(env.DB, userId, startDate, endDate);
        const first = entries[0] ?? latest;
        const delta = roundWeight(latest.weight_kg - first.weight_kg);
        const trend = delta === 0 ? 'estavel' : delta > 0 ? `+${formatWeightKg(delta)} kg` : `${formatWeightKg(delta)} kg`;

        return [
          '*Peso*',
          '',
          `• Atual: *${formatWeightKg(latest.weight_kg)} kg*`,
          `• Variacao (${days} dias): *${trend}*`,
          `• Registros no periodo: *${entries.length}*`,
        ].join('\n');
      },
    }),

    set_calorie_goal: tool({
      description: 'Define a meta diaria de calorias do usuario.',
      inputSchema: z.object({
        goal: z.number().int().min(500).max(10000),
      }),
      execute: async ({ goal }) => {
        await setCalorieGoal(env.DB, userId, goal);
        return `*Meta atualizada*\n\n• Nova meta diaria: *${goal} kcal*`;
      },
    }),

    delete_meal: tool({
      description: 'Apaga uma refeicao de hoje pelo indice (1 = primeira refeicao do dia).',
      inputSchema: z.object({
        index: z.number().int().min(1),
      }),
      execute: async ({ index }) => {
        const meals = await getTodayMeals(env.DB, userId);
        if (meals.length === 0) {
          return 'Nenhuma refeicao para apagar hoje.';
        }

        if (index > meals.length) {
          return `Indice invalido. Escolha entre 1 e ${meals.length}.`;
        }

        const meal = meals[index - 1];
        await deleteMealById(env.DB, meal.id, userId);
        return `*Refeicao apagada*\n\n• ${sanitizeWhatsAppText(meal.description)} (*${meal.total_calories} kcal*)`;
      },
    }),

    log_meal_from_text: tool({
      description: 'Analisa a descricao textual de uma refeicao e registra no diario.',
      inputSchema: z.object({
        description: z.string().min(3),
      }),
      execute: async ({ description }) => {
        if (options.disableMealLogging) {
          return 'A refeicao desta mensagem ja foi registrada automaticamente.';
        }

        const result = await generateObject({
          model: openai.chat('gpt-4.1-mini'),
          schema: FOOD_ANALYSIS_SCHEMA,
          system: TEXT_ANALYSIS_PROMPT,
          prompt: description,
        });

        const normalized = normalizeFoodAnalysis(result.object);
        await createMeal(env.DB, userId, normalized, null, null, description, 'text');
        await recordAiUsage(env.DB, {
          eventName: 'ai.text_meal_analysis',
          userId,
          source: 'text',
          model: 'gpt-4.1-mini',
          inputTokens: result.usage.inputTokens,
          cachedInputTokens: result.usage.cachedInputTokens,
          outputTokens: result.usage.outputTokens,
          metadata: {
            descriptionLength: description.length,
          },
        });
        await recordEvent(env.DB, {
          eventName: 'meal.logged',
          userId,
          messageType: 'text',
          source: 'text',
          metadata: {
            mealType: normalized.meal_type,
            totalCalories: normalized.total_calorias,
          },
        });

        const itemsText = formatFoodItems(normalized.itens);
        return `*Refeicao registrada*\n\n• Tipo: *${mealTypeLabel(normalized.meal_type)}*\n${itemsText}\n\n*Total:* ${normalized.total_calorias} kcal\n*Macros:* P ${normalized.total_protein_g}g · C ${normalized.total_carbs_g}g · G ${normalized.total_fat_g}g`;
      },
    }),

    log_weight: tool({
      description: 'Registra um novo peso corporal do usuario em quilogramas.',
      inputSchema: z.object({
        weight_kg: z.number().min(20).max(400),
        note: z.string().max(200).optional(),
      }),
      execute: async ({ weight_kg, note }) => {
        const latestBeforeInsert = await getLatestWeight(env.DB, userId);
        await logWeight(env.DB, userId, weight_kg, note);
        const latest = await getLatestWeight(env.DB, userId);
        const previous = latest ? await getPreviousWeight(env.DB, userId, latest.id) : latestBeforeInsert;
        const delta = latest && previous ? roundWeight(latest.weight_kg - previous.weight_kg) : null;
        await recordEvent(env.DB, {
          eventName: 'weight.logged',
          userId,
          source: 'text',
          metadata: {
            weightKg: roundWeight(weight_kg),
            note: note ?? null,
          },
        });
        const deltaText =
          delta === null ? 'primeiro registro' : delta === 0 ? 'sem variacao desde o ultimo registro' : `${delta > 0 ? '+' : ''}${formatWeightKg(delta)} kg desde o ultimo registro`;

        return [
          '*Peso registrado*',
          '',
          `• Atual: *${formatWeightKg(weight_kg)} kg*`,
          `• Status: *${deltaText}*`,
          ...(note ? [`• Nota: ${sanitizeWhatsAppText(note)}`] : []),
        ].join('\n');
      },
    }),
  };
}

function shiftDateIso(isoDate: string, deltaDays: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

function roundWeight(value: number): number {
  return Math.round(value * 10) / 10;
}
