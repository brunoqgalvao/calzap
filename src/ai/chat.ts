import { createOpenAI } from '@ai-sdk/openai';
import { generateText, ModelMessage, stepCountIs } from 'ai';
import { createCalTrackerTools } from './tools';
import { getRecentMessages, saveMessage } from '../db/messages';
import { Env, FoodItem } from '../types';
import { getTodayMeals } from '../db/meals';
import { getUser } from '../db/users';
import { formatTodaySummary } from '../utils/formatting';

const SYSTEM_PROMPT = `Voce e um assistente nutricional em portugues (pt-BR), amigavel e objetivo.
Converse naturalmente com o usuario.
Use ferramentas sempre que o usuario quiser:
- registrar refeicao
- ver resumo do dia
- ver historico
- ajustar meta
- apagar refeicao

Nao chame ferramentas sem necessidade em mensagens casuais (ex: "oi", "tudo bem?").
Se a mensagem indicar que a refeicao ja foi registrada automaticamente, NAO chame log_meal_from_text.

Formato obrigatorio das respostas:
- Use formatacao simples compativel com WhatsApp.
- Estruture com titulos curtos em *negrito* e listas com glyphs (ex: •, —, ▸) quando fizer sentido.
- Nunca use emoji.
- Quando mostrar progresso, use barra em texto monoespacado no padrao: \`██—————————— X%\`.
- Quando uma ferramenta retornar um bloco de resumo/historico, preserve o conteudo essencial sem remover a barra de progresso.`;

interface ChatOptions {
  mealAlreadyLogged?: boolean;
}

function hasTodaySummaryIntent(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    normalized.includes('hoje') ||
    normalized.includes('resumo') ||
    normalized.includes('progresso') ||
    normalized.includes('como estou')
  );
}

async function buildTodaySummary(env: Env, userId: number): Promise<string> {
  const meals = await getTodayMeals(env.DB, userId);
  const dbUser = await getUser(env.DB, userId);
  const goal = dbUser?.daily_calorie_goal ?? 2000;
  if (meals.length === 0) {
    return `*Hoje*\n\n• Consumo: *0 / ${goal} kcal*\n• Progresso: \`${'—'.repeat(10)} 0%\`\n• Nenhuma refeicao registrada ainda.`;
  }

  return formatTodaySummary(
    meals.map((meal) => ({
      description: meal.description,
      items: JSON.parse(meal.food_items) as FoodItem[],
      totalCalories: meal.total_calories,
      loggedAt: meal.logged_at,
    })),
    goal,
  );
}

function renderToolOutputs(toolResults: Array<{ output: unknown }>): string | null {
  const outputs = toolResults
    .map((toolResult) => (typeof toolResult.output === 'string' ? toolResult.output.trim() : ''))
    .filter((output) => output.length > 0);

  if (outputs.length === 0) {
    return null;
  }

  return outputs.join('\n\n');
}

export async function handleChat(
  env: Env,
  userId: number,
  userMessage: string,
  options: ChatOptions = {},
): Promise<string> {
  await saveMessage(env.DB, userId, 'user', userMessage);

  const history = await getRecentMessages(env.DB, userId, 10);
  const messages: ModelMessage[] = history.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });

  try {
    const result = await generateText({
      model: openai('gpt-4.1-mini'),
      system: SYSTEM_PROMPT,
      messages,
      tools: createCalTrackerTools(env, userId, {
        disableMealLogging: options.mealAlreadyLogged,
      }),
      stopWhen: stepCountIs(5),
    });

    const fromTools = renderToolOutputs(result.toolResults);
    let finalText = fromTools ?? result.text.trim();

    if (!finalText && hasTodaySummaryIntent(userMessage)) {
      finalText = await buildTodaySummary(env, userId);
    }

    if (!finalText) {
      finalText = 'Certo. Me diga como posso ajudar com sua alimentacao hoje.';
    }

    await saveMessage(env.DB, userId, 'assistant', finalText);
    return finalText;
  } catch (error) {
    console.error('Chat orchestration failed:', error);
    const fallback = 'Ocorreu um erro ao processar sua mensagem. Tente novamente em instantes.';
    await saveMessage(env.DB, userId, 'assistant', fallback);
    return fallback;
  }
}
