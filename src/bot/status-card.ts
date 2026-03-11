import { getDailyMealTotalsByDateRange, getMealsByDateRange } from '../db/meals';
import { getLatestWeight, getPreviousWeight, getWeightsByDateRange } from '../db/weights';
import { getUser } from '../db/users';
import {
  renderStatusCardPng,
  StatusCardData,
  StatusCardSeriesPoint,
  StatusCardWeightSummary,
} from '../render/status-card';
import { sendImageMessage } from '../services/whatsapp';
import { DashboardView, Env, FoodItem, MealRow, MealType, WhatsAppConversationContext } from '../types';
import {
  brDateLabel,
  brtTimeLabel,
  dashboardRange,
  dashboardSubtitle,
  listIsoDates,
  todayISOInBrt,
} from '../utils/dates';
import { formatMacro, formatTodaySummary, formatWeightKg } from '../utils/formatting';

const STATUS_CARD_TTL_SECONDS = 10 * 60;
const STATUS_CARD_MAX_AGE_SECONDS = 60;
const STATUS_CARD_INTENT_KEYWORDS = ['grafico', 'chart', 'imagem', 'visual', 'painel', 'card', 'dashboard', 'snapshot'];

export interface StatusCardRequest {
  view: DashboardView;
  anchorDate: string;
}

export function resolveStatusCardRequest(text: string): StatusCardRequest | null {
  const normalized = normalizeIntentText(text);
  const hasIntent = STATUS_CARD_INTENT_KEYWORDS.some((keyword) => normalized.includes(keyword));
  if (!hasIntent) {
    return null;
  }

  let view: DashboardView = 'day';
  if (normalized.includes('seman') || normalized.includes('7 dias')) {
    view = 'week';
  } else if (normalized.includes('mens') || normalized.includes('30 dias') || normalized.includes('mes')) {
    view = 'month';
  }

  return {
    view,
    anchorDate: todayISOInBrt(),
  };
}

export async function sendStatusCard(
  env: Env,
  context: WhatsAppConversationContext,
  request: StatusCardRequest,
): Promise<string | null> {
  if (!context.publicOrigin) {
    return null;
  }

  const imageUrl = await createSignedStatusCardUrl(
    context.publicOrigin,
    env.WEBHOOK_SECRET,
    context.userId,
    request.anchorDate,
    request.view,
  );

  const caption = await buildStatusCardCaption(env, context.userId, request);
  await sendImageMessage(
    env,
    context.businessPhone,
    context.senderPhone,
    imageUrl,
    caption,
    context.incomingMessageId,
    {
      userId: context.userId,
      source: `status-card-${request.view}`,
      metadata: {
        anchorDate: request.anchorDate,
      },
    },
  );

  return caption;
}

export async function buildStatusSummaryText(
  env: Env,
  userId: number,
  request: StatusCardRequest,
): Promise<string> {
  if (request.view === 'day') {
    const dayMeals = await getMealsByDateRange(env.DB, userId, request.anchorDate, request.anchorDate);
    const dbUser = await getUser(env.DB, userId);
    const goal = dbUser?.daily_calorie_goal ?? 2000;
    const weight = await buildWeightSummary(env, userId, request.anchorDate, request.anchorDate);

    if (dayMeals.length === 0) {
      return `*Hoje*\n\n• Consumo: *0 / ${goal} kcal*\n• Progresso: \`${'—'.repeat(10)} 0%\`\n• Macros: *P 0g · C 0g · G 0g*\n• Nenhuma refeicao registrada ainda.${formatWeightLine(weight)}`;
    }

    const summary = formatTodaySummary(
      dayMeals.map((meal) => ({
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

    return `${summary}${formatWeightLine(weight)}`;
  }

  const dashboard = await buildDashboardData(env, userId, request);

  const heading = request.view === 'week' ? '*Semana*' : '*Mes*';
  const periodLine = `• Periodo: *${dashboard.subtitle}*`;
  const weight = dashboard.weight;
  const weightLine = !weight || weight.currentKg === null
    ? '• Peso: *sem registros*'
    : `• Peso atual: *${formatWeightKg(weight.currentKg)} kg*${weight.deltaKg === null ? '' : ` (${weight.deltaKg > 0 ? '+' : ''}${formatWeightKg(weight.deltaKg)} kg)`}`;

  const topDays = dashboard.series
    .slice()
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .filter((point) => point.value > 0)
    .map((point) => `• ${point.label} — *${point.value} kcal*`)
    .join('\n');

  return [
    heading,
    '',
    periodLine,
    `• Consumo: *${dashboard.totalCalories} / ${dashboard.goalCalories} kcal*`,
    `• Media diaria: *${Math.round(dashboard.averageCalories)} kcal*`,
    `• Macros: *P ${formatMacro(dashboard.totalProtein)}g · C ${formatMacro(dashboard.totalCarbs)}g · G ${formatMacro(dashboard.totalFat)}g*`,
    weightLine,
    topDays ? '\n*Dias mais fortes*' : '',
    topDays,
  ]
    .filter((line) => line.length > 0)
    .join('\n');
}

export async function verifyStatusCardSignature(
  secret: string,
  userId: number,
  date: string,
  view: DashboardView,
  expiresRaw: string | undefined,
  signature: string | undefined,
): Promise<boolean> {
  if (!Number.isSafeInteger(userId) || userId <= 0 || !isIsoDate(date) || !isDashboardView(view) || !expiresRaw || !signature) {
    return false;
  }

  const expiresAt = Number.parseInt(expiresRaw, 10);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(expiresAt) || expiresAt < now - 30 || expiresAt > now + 24 * 60 * 60) {
    return false;
  }

  const expected = await signStatusCard(secret, userId, date, view, expiresAt);
  return signature === expected;
}

export async function renderStatusCardResponse(
  env: Env,
  userId: number,
  date: string,
  view: DashboardView,
): Promise<Response> {
  if (!Number.isSafeInteger(userId) || userId <= 0 || !isIsoDate(date) || !isDashboardView(view)) {
    return new Response('Invalid status card request', { status: 400 });
  }

  const data = await buildDashboardData(env, userId, { view, anchorDate: date });
  const png = await renderStatusCardPng(data);

  return new Response(png, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': `private, max-age=${STATUS_CARD_MAX_AGE_SECONDS}`,
      'Content-Disposition': `inline; filename="calzap-${view}-${date}.png"`,
    },
  });
}

async function createSignedStatusCardUrl(
  publicOrigin: string,
  secret: string,
  userId: number,
  anchorDate: string,
  view: DashboardView,
): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + STATUS_CARD_TTL_SECONDS;
  const signature = await signStatusCard(secret, userId, anchorDate, view, expiresAt);
  const url = new URL(`/status-card/${userId}/${anchorDate}`, publicOrigin);
  url.searchParams.set('view', view);
  url.searchParams.set('expires', `${expiresAt}`);
  url.searchParams.set('sig', signature);
  return url.toString();
}

async function buildStatusCardCaption(env: Env, userId: number, request: StatusCardRequest): Promise<string> {
  const dashboard = await buildDashboardData(env, userId, request);
  const weightText =
    !dashboard.weight || dashboard.weight.currentKg === null
      ? 'peso sem dados'
      : `peso ${formatWeightKg(dashboard.weight.currentKg)} kg`;
  return [
    `${viewLabel(request.view)} ${dashboard.subtitle}`,
    `${dashboard.totalCalories}/${dashboard.goalCalories} kcal`,
    `P ${formatMacro(dashboard.totalProtein)}g`,
    `C ${formatMacro(dashboard.totalCarbs)}g`,
    `G ${formatMacro(dashboard.totalFat)}g`,
    weightText,
  ].join(' | ');
}

async function buildDashboardData(env: Env, userId: number, request: StatusCardRequest): Promise<StatusCardData> {
  const range = dashboardRange(request.view, request.anchorDate);
  const dbUser = await getUser(env.DB, userId);
  const dailyGoal = dbUser?.daily_calorie_goal ?? 2000;
  const goalCalories = dailyGoal * range.dayCount;
  const meals = await getMealsByDateRange(env.DB, userId, range.startDate, range.endDate);
  const dailyTotals = await getDailyMealTotalsByDateRange(env.DB, userId, range.startDate, range.endDate);
  const totals = sumMeals(meals);
  const weight = await buildWeightSummary(env, userId, range.startDate, range.endDate);

  const series = buildSeriesPoints(range.startDate, range.endDate, dailyTotals, request.view);
  const dayMeals = request.view === 'day'
    ? meals
        .slice()
        .reverse()
        .slice(0, 4)
        .map((meal) => ({
          timeLabel: brtTimeLabel(meal.logged_at),
          mealType: meal.meal_type,
          description: meal.description,
          calories: meal.total_calories,
        }))
    : [];

  return {
    view: request.view,
    title: viewTitle(request.view),
    subtitle: dashboardSubtitle(request.view, range.startDate, range.endDate),
    totalCalories: totals.totalCalories,
    goalCalories,
    totalProtein: totals.totalProtein,
    totalCarbs: totals.totalCarbs,
    totalFat: totals.totalFat,
    averageCalories: range.dayCount > 0 ? totals.totalCalories / range.dayCount : 0,
    remainingCalories: goalCalories - totals.totalCalories,
    mealCounts: countMealTypes(meals),
    meals: dayMeals,
    seriesTitle: request.view === 'week' ? 'WEEKLY CALORIES' : 'MONTHLY CALORIES',
    series,
    weight,
  };
}

async function buildWeightSummary(
  env: Env,
  userId: number,
  startDate: string,
  endDate: string,
): Promise<StatusCardWeightSummary | null> {
  const latest = await getLatestWeight(env.DB, userId);
  if (!latest) {
    return { currentKg: null, deltaKg: null };
  }

  const periodWeights = await getWeightsByDateRange(env.DB, userId, startDate, endDate);
  const baseline = periodWeights[0] ?? (await getPreviousWeight(env.DB, userId, latest.id)) ?? latest;
  const delta = latest.id === baseline.id ? null : roundWeight(latest.weight_kg - baseline.weight_kg);

  return {
    currentKg: latest.weight_kg,
    deltaKg: delta,
  };
}

function buildSeriesPoints(
  startDate: string,
  endDate: string,
  rows: Array<{ date: string; total_calories: number }>,
  view: DashboardView,
): StatusCardSeriesPoint[] {
  const totalsByDate = new Map(rows.map((row) => [row.date, row.total_calories]));
  const dates = listIsoDates(startDate, endDate);

  return dates.map((date, index) => ({
    label: seriesLabel(view, date, index, dates.length),
    value: totalsByDate.get(date) ?? 0,
    highlight: index === dates.length - 1,
  }));
}

function viewTitle(view: DashboardView): string {
  switch (view) {
    case 'week':
      return 'CALZAP WEEKLY SNAPSHOT';
    case 'month':
      return 'CALZAP MONTHLY SNAPSHOT';
    case 'day':
    default:
      return 'CALZAP DAILY SNAPSHOT';
  }
}

function viewLabel(view: DashboardView): string {
  switch (view) {
    case 'week':
      return 'Semana';
    case 'month':
      return 'Mes';
    case 'day':
    default:
      return 'Dia';
  }
}

function seriesLabel(view: DashboardView, isoDate: string, index: number, total: number): string {
  if (view === 'week') {
    return isoDate.slice(8, 10);
  }

  if (view === 'month') {
    return isoDate.slice(8, 10);
  }

  return brDateLabel(isoDate);
}

function sumMeals(meals: MealRow[]): {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
} {
  return meals.reduce(
    (totals, meal) => ({
      totalCalories: totals.totalCalories + meal.total_calories,
      totalProtein: totals.totalProtein + meal.total_protein_g,
      totalCarbs: totals.totalCarbs + meal.total_carbs_g,
      totalFat: totals.totalFat + meal.total_fat_g,
    }),
    { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 },
  );
}

function countMealTypes(meals: MealRow[]): Record<MealType, number> {
  const counts: Record<MealType, number> = {
    breakfast: 0,
    lunch: 0,
    dinner: 0,
    snack: 0,
  };

  for (const meal of meals) {
    counts[meal.meal_type] += 1;
  }

  return counts;
}

function formatWeightLine(weight: StatusCardWeightSummary | null): string {
  if (!weight || weight.currentKg === null) {
    return '';
  }

  const deltaText =
    weight.deltaKg === null ? '' : ` (${weight.deltaKg > 0 ? '+' : ''}${formatWeightKg(weight.deltaKg)} kg)`;

  return `\n• Peso atual: *${formatWeightKg(weight.currentKg)} kg*${deltaText}`;
}

async function signStatusCard(
  secret: string,
  userId: number,
  date: string,
  view: DashboardView,
  expiresAt: number,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const payload = new TextEncoder().encode(`${userId}:${date}:${view}:${expiresAt}`);
  const signature = await crypto.subtle.sign('HMAC', key, payload);
  return base64Url(new Uint8Array(signature));
}

function normalizeIntentText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isDashboardView(value: string): value is DashboardView {
  return value === 'day' || value === 'week' || value === 'month';
}

function roundWeight(value: number): number {
  return Math.round(value * 10) / 10;
}

function base64Url(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
