import { recordAiUsage, recordEvent } from '../analytics/events';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, stepCountIs } from 'ai';
import { createCalTrackerTools } from './tools';
import { getRecentMessages, saveMessage } from '../db/messages';
import { Env, FoodItem, MessageRow } from '../types';
import { getTodayMeals } from '../db/meals';
import { getUser } from '../db/users';
import { formatTodaySummary } from '../utils/formatting';

const SYSTEM_PROMPT = `Voce e um assistente nutricional em portugues (pt-BR), amigavel e objetivo.
Converse naturalmente com o usuario.
Use ferramentas sempre que o usuario quiser:
- registrar refeicao
- ver resumo do dia
- ver historico
- registrar peso
- ver peso ou variacao de peso
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
  source?: string;
  phoneNumber?: string;
  businessPhone?: string;
}

const CHAT_MODEL = 'gpt-4.1-mini';

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
    return `*Hoje*\n\n• Consumo: *0 / ${goal} kcal*\n• Progresso: \`${'—'.repeat(10)} 0%\`\n• Macros: *P 0g · C 0g · G 0g*\n• Nenhuma refeicao registrada ainda.`;
  }

  return formatTodaySummary(
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

function buildConversationContext(history: MessageRow[], currentUserMessage: string): string {
  const priorMessages = history.slice(0, -1).slice(-6);

  if (priorMessages.length === 0) {
    return currentUserMessage;
  }

  const transcript = priorMessages
    .map((message) => `${message.role === 'user' ? 'Usuario' : 'Assistente'}: ${message.content}`)
    .join('\n');

  return [
    'Contexto recente da conversa:',
    transcript,
    '',
    'Mensagem atual do usuario:',
    currentUserMessage,
  ].join('\n');
}

export async function handleChat(
  env: Env,
  userId: number,
  userMessage: string,
  options: ChatOptions = {},
): Promise<string> {
  await saveMessage(env.DB, userId, 'user', userMessage);

  const history = await getRecentMessages(env.DB, userId, 10);
  const modelInput = buildConversationContext(history, userMessage);

  const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
  const source = options.source ?? 'text';

  try {
    const result = await generateText({
      model: openai.chat(CHAT_MODEL),
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: modelInput }],
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
    await recordAiUsage(env.DB, {
      eventName: 'ai.chat',
      userId,
      phoneNumber: options.phoneNumber ?? null,
      businessPhone: options.businessPhone ?? null,
      source,
      model: CHAT_MODEL,
      inputTokens: result.totalUsage.inputTokens,
      cachedInputTokens: result.totalUsage.cachedInputTokens,
      outputTokens: result.totalUsage.outputTokens,
      metadata: {
        finishReason: result.finishReason,
        steps: result.steps.length,
        toolCalls: result.toolCalls.length,
      },
    });
    return finalText;
  } catch (error) {
    console.error('Chat orchestration failed:', error);
    await recordEvent(env.DB, {
      eventName: 'ai.chat',
      userId,
      phoneNumber: options.phoneNumber ?? null,
      businessPhone: options.businessPhone ?? null,
      source,
      model: CHAT_MODEL,
      status: 'error',
      metadata: { error: error instanceof Error ? error.message : String(error) },
    });
    const fallback = 'Ocorreu um erro ao processar sua mensagem. Tente novamente em instantes.';
    await saveMessage(env.DB, userId, 'assistant', fallback);
    return fallback;
  }
}
