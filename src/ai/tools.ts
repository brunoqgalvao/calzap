import { createOpenAI } from '@ai-sdk/openai';
import { generateObject, tool } from 'ai';
import { z } from 'zod';
import { Env, FoodItem } from '../types';
import { deleteMealById, getHistoryByDay, getTodayMeals, createMeal } from '../db/meals';
import { getUser, setCalorieGoal } from '../db/users';
import {
  formatFoodItems,
  formatHistory,
  formatTodaySummary,
  sanitizeWhatsAppText,
} from '../utils/formatting';

const FOOD_ANALYSIS_SCHEMA = z.object({
  descricao: z.string(),
  itens: z.array(
    z.object({
      nome: z.string(),
      quantidade: z.string(),
      calorias: z.number().int().nonnegative(),
    }),
  ),
  total_calorias: z.number().int().nonnegative(),
  confianca: z.enum(['alta', 'media', 'baixa']),
  observacoes: z.string(),
});

const TEXT_ANALYSIS_PROMPT = `Voce e um nutricionista especializado em estimar calorias de alimentos.
O usuario descreveu o que comeu por texto.
Estime quantidades e calorias de forma realista e conservadora.
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
          return `*Hoje*\n\n• Consumo: *0 / ${goal} kcal*\n• Progresso: \`${'—'.repeat(10)} 0%\`\n• Nenhuma refeicao registrada ainda.`;
        }

        const dbUser = await getUser(env.DB, userId);
        const goal = dbUser?.daily_calorie_goal ?? 2000;

        const summary = formatTodaySummary(
          meals.map((meal) => ({
            description: meal.description,
            items: JSON.parse(meal.food_items) as FoodItem[],
            totalCalories: meal.total_calories,
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

        const { object: analysis } = await generateObject({
          model: openai('gpt-4.1-mini'),
          schema: FOOD_ANALYSIS_SCHEMA,
          system: TEXT_ANALYSIS_PROMPT,
          prompt: description,
        });

        await createMeal(env.DB, userId, analysis, null, null, description, 'text');

        const itemsText = formatFoodItems(analysis.itens);
        return `*Refeicao registrada*\n\n${itemsText}\n\n*Total:* ${analysis.total_calorias} kcal`;
      },
    }),
  };
}
