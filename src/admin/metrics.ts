import { Database, toNumber } from '../db/client';

interface TotalsRow {
  total_users: unknown;
  new_users_7d: unknown;
  new_users_30d: unknown;
  active_users_7d: unknown;
  active_users_30d: unknown;
  meals_7d: unknown;
  meals_30d: unknown;
  inbound_messages_7d: unknown;
  inbound_messages_30d: unknown;
  ai_cost_today: unknown;
  ai_cost_7d: unknown;
  ai_cost_30d: unknown;
  ai_requests_30d: unknown;
  failed_ops_7d: unknown;
}

interface DailySeriesRow {
  date: string;
  label: string;
  new_users: unknown;
  active_users: unknown;
  meals: unknown;
  inbound_messages: unknown;
  ai_cost_usd: unknown;
}

interface ModelBreakdownRow {
  model: string | null;
  requests: unknown;
  cost_usd: unknown;
  input_tokens: unknown;
  output_tokens: unknown;
  cached_input_tokens: unknown;
}

interface TopUserRow {
  user_id: unknown;
  first_name: string | null;
  inbound_messages: unknown;
  meals: unknown;
  ai_cost_usd: unknown;
}

export interface AdminMetrics {
  generatedAt: string;
  totals: {
    totalUsers: number;
    newUsers7d: number;
    newUsers30d: number;
    activeUsers7d: number;
    activeUsers30d: number;
    meals7d: number;
    meals30d: number;
    inboundMessages7d: number;
    inboundMessages30d: number;
    aiCostToday: number;
    aiCost7d: number;
    aiCost30d: number;
    aiRequests30d: number;
    failedOps7d: number;
  };
  dailySeries: Array<{
    date: string;
    label: string;
    newUsers: number;
    activeUsers: number;
    meals: number;
    inboundMessages: number;
    aiCostUsd: number;
  }>;
  modelBreakdown: Array<{
    model: string;
    requests: number;
    costUsd: number;
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens: number;
  }>;
  topUsers: Array<{
    userId: number;
    name: string;
    inboundMessages: number;
    meals: number;
    aiCostUsd: number;
  }>;
}

export async function getAdminMetrics(db: Database): Promise<AdminMetrics> {
  const [totalsRow, dailySeriesRows, modelRows, topUserRows] = await Promise.all([
    db.one<TotalsRow>(
      `SELECT
         (SELECT COUNT(*) FROM users) AS total_users,
         (SELECT COUNT(*) FROM users WHERE created_at >= now() - interval '7 days') AS new_users_7d,
         (SELECT COUNT(*) FROM users WHERE created_at >= now() - interval '30 days') AS new_users_30d,
         (
           SELECT COUNT(DISTINCT user_id)
           FROM analytics_events
           WHERE event_name = 'webhook.received'
             AND created_at >= now() - interval '7 days'
             AND user_id IS NOT NULL
         ) AS active_users_7d,
         (
           SELECT COUNT(DISTINCT user_id)
           FROM analytics_events
           WHERE event_name = 'webhook.received'
             AND created_at >= now() - interval '30 days'
             AND user_id IS NOT NULL
         ) AS active_users_30d,
         (SELECT COUNT(*) FROM meals WHERE logged_at >= now() - interval '7 days') AS meals_7d,
         (SELECT COUNT(*) FROM meals WHERE logged_at >= now() - interval '30 days') AS meals_30d,
         (
           SELECT COUNT(*)
           FROM analytics_events
           WHERE event_name = 'webhook.received'
             AND created_at >= now() - interval '7 days'
         ) AS inbound_messages_7d,
         (
           SELECT COUNT(*)
           FROM analytics_events
           WHERE event_name = 'webhook.received'
             AND created_at >= now() - interval '30 days'
         ) AS inbound_messages_30d,
         (
           SELECT COALESCE(SUM(estimated_cost_usd), 0)
           FROM analytics_events
           WHERE event_name LIKE 'ai.%'
             AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date
         ) AS ai_cost_today,
         (
           SELECT COALESCE(SUM(estimated_cost_usd), 0)
           FROM analytics_events
           WHERE event_name LIKE 'ai.%'
             AND created_at >= now() - interval '7 days'
         ) AS ai_cost_7d,
         (
           SELECT COALESCE(SUM(estimated_cost_usd), 0)
           FROM analytics_events
           WHERE event_name LIKE 'ai.%'
             AND created_at >= now() - interval '30 days'
         ) AS ai_cost_30d,
         (
           SELECT COUNT(*)
           FROM analytics_events
           WHERE event_name LIKE 'ai.%'
             AND created_at >= now() - interval '30 days'
         ) AS ai_requests_30d,
         (
           SELECT COUNT(*)
           FROM analytics_events
           WHERE status = 'error'
             AND created_at >= now() - interval '7 days'
         ) AS failed_ops_7d`,
    ),
    db.many<DailySeriesRow>(
      `WITH days AS (
         SELECT generate_series(
           ((now() AT TIME ZONE 'America/Sao_Paulo')::date - interval '13 days')::date,
           (now() AT TIME ZONE 'America/Sao_Paulo')::date,
           interval '1 day'
         )::date AS day
       ),
       user_signups AS (
         SELECT (created_at AT TIME ZONE 'America/Sao_Paulo')::date AS day, COUNT(*) AS new_users
         FROM users
         WHERE created_at >= now() - interval '14 days'
         GROUP BY 1
       ),
       active_users AS (
         SELECT (created_at AT TIME ZONE 'America/Sao_Paulo')::date AS day, COUNT(DISTINCT user_id) AS active_users
         FROM analytics_events
         WHERE event_name = 'webhook.received'
           AND created_at >= now() - interval '14 days'
           AND user_id IS NOT NULL
         GROUP BY 1
       ),
       meal_counts AS (
         SELECT (logged_at AT TIME ZONE 'America/Sao_Paulo')::date AS day, COUNT(*) AS meals
         FROM meals
         WHERE logged_at >= now() - interval '14 days'
         GROUP BY 1
       ),
       inbound_counts AS (
         SELECT (created_at AT TIME ZONE 'America/Sao_Paulo')::date AS day, COUNT(*) AS inbound_messages
         FROM analytics_events
         WHERE event_name = 'webhook.received'
           AND created_at >= now() - interval '14 days'
         GROUP BY 1
       ),
       ai_costs AS (
         SELECT (created_at AT TIME ZONE 'America/Sao_Paulo')::date AS day, COALESCE(SUM(estimated_cost_usd), 0) AS ai_cost_usd
         FROM analytics_events
         WHERE event_name LIKE 'ai.%'
           AND created_at >= now() - interval '14 days'
         GROUP BY 1
       )
       SELECT
         to_char(days.day, 'YYYY-MM-DD') AS date,
         to_char(days.day, 'DD Mon') AS label,
         COALESCE(user_signups.new_users, 0) AS new_users,
         COALESCE(active_users.active_users, 0) AS active_users,
         COALESCE(meal_counts.meals, 0) AS meals,
         COALESCE(inbound_counts.inbound_messages, 0) AS inbound_messages,
         COALESCE(ai_costs.ai_cost_usd, 0) AS ai_cost_usd
       FROM days
       LEFT JOIN user_signups ON user_signups.day = days.day
       LEFT JOIN active_users ON active_users.day = days.day
       LEFT JOIN meal_counts ON meal_counts.day = days.day
       LEFT JOIN inbound_counts ON inbound_counts.day = days.day
       LEFT JOIN ai_costs ON ai_costs.day = days.day
       ORDER BY days.day ASC`,
    ),
    db.many<ModelBreakdownRow>(
      `SELECT
         COALESCE(model, 'unknown') AS model,
         COUNT(*) AS requests,
         COALESCE(SUM(estimated_cost_usd), 0) AS cost_usd,
         COALESCE(SUM(input_tokens), 0) AS input_tokens,
         COALESCE(SUM(output_tokens), 0) AS output_tokens,
         COALESCE(SUM(cached_input_tokens), 0) AS cached_input_tokens
       FROM analytics_events
       WHERE event_name LIKE 'ai.%'
         AND created_at >= now() - interval '30 days'
       GROUP BY 1
       ORDER BY cost_usd DESC, requests DESC, model ASC
       LIMIT 8`,
    ),
    db.many<TopUserRow>(
      `WITH inbound AS (
         SELECT user_id, COUNT(*) AS inbound_messages
         FROM analytics_events
         WHERE event_name = 'webhook.received'
           AND created_at >= now() - interval '30 days'
           AND user_id IS NOT NULL
         GROUP BY user_id
       ),
       meal_counts AS (
         SELECT user_id, COUNT(*) AS meals
         FROM meals
         WHERE logged_at >= now() - interval '30 days'
         GROUP BY user_id
       ),
       ai_costs AS (
         SELECT user_id, COALESCE(SUM(estimated_cost_usd), 0) AS ai_cost_usd
         FROM analytics_events
         WHERE event_name LIKE 'ai.%'
           AND created_at >= now() - interval '30 days'
           AND user_id IS NOT NULL
         GROUP BY user_id
       )
       SELECT
         u.id AS user_id,
         u.first_name,
         COALESCE(inbound.inbound_messages, 0) AS inbound_messages,
         COALESCE(meal_counts.meals, 0) AS meals,
         COALESCE(ai_costs.ai_cost_usd, 0) AS ai_cost_usd
       FROM users u
       LEFT JOIN inbound ON inbound.user_id = u.id
       LEFT JOIN meal_counts ON meal_counts.user_id = u.id
       LEFT JOIN ai_costs ON ai_costs.user_id = u.id
       WHERE COALESCE(inbound.inbound_messages, 0) > 0
          OR COALESCE(meal_counts.meals, 0) > 0
          OR COALESCE(ai_costs.ai_cost_usd, 0) > 0
       ORDER BY ai_cost_usd DESC, inbound_messages DESC, meals DESC, u.created_at DESC
       LIMIT 10`,
    ),
  ]);

  const totals = totalsRow ?? {
    total_users: 0,
    new_users_7d: 0,
    new_users_30d: 0,
    active_users_7d: 0,
    active_users_30d: 0,
    meals_7d: 0,
    meals_30d: 0,
    inbound_messages_7d: 0,
    inbound_messages_30d: 0,
    ai_cost_today: 0,
    ai_cost_7d: 0,
    ai_cost_30d: 0,
    ai_requests_30d: 0,
    failed_ops_7d: 0,
  };

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      totalUsers: toNumber(totals.total_users),
      newUsers7d: toNumber(totals.new_users_7d),
      newUsers30d: toNumber(totals.new_users_30d),
      activeUsers7d: toNumber(totals.active_users_7d),
      activeUsers30d: toNumber(totals.active_users_30d),
      meals7d: toNumber(totals.meals_7d),
      meals30d: toNumber(totals.meals_30d),
      inboundMessages7d: toNumber(totals.inbound_messages_7d),
      inboundMessages30d: toNumber(totals.inbound_messages_30d),
      aiCostToday: toNumber(totals.ai_cost_today),
      aiCost7d: toNumber(totals.ai_cost_7d),
      aiCost30d: toNumber(totals.ai_cost_30d),
      aiRequests30d: toNumber(totals.ai_requests_30d),
      failedOps7d: toNumber(totals.failed_ops_7d),
    },
    dailySeries: dailySeriesRows.map((row) => ({
      date: row.date,
      label: row.label,
      newUsers: toNumber(row.new_users),
      activeUsers: toNumber(row.active_users),
      meals: toNumber(row.meals),
      inboundMessages: toNumber(row.inbound_messages),
      aiCostUsd: toNumber(row.ai_cost_usd),
    })),
    modelBreakdown: modelRows.map((row) => ({
      model: row.model ?? 'unknown',
      requests: toNumber(row.requests),
      costUsd: toNumber(row.cost_usd),
      inputTokens: toNumber(row.input_tokens),
      outputTokens: toNumber(row.output_tokens),
      cachedInputTokens: toNumber(row.cached_input_tokens),
    })),
    topUsers: topUserRows.map((row) => ({
      userId: toNumber(row.user_id),
      name: row.first_name ?? `User ${toNumber(row.user_id)}`,
      inboundMessages: toNumber(row.inbound_messages),
      meals: toNumber(row.meals),
      aiCostUsd: toNumber(row.ai_cost_usd),
    })),
  };
}
