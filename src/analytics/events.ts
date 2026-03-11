import { Database } from '../db/client';
import { AiUsageSnapshot, estimateOpenAICostUsd } from './costs';

export interface AnalyticsEvent {
  eventName: string;
  userId?: number | null;
  phoneNumber?: string | null;
  businessPhone?: string | null;
  messageType?: string | null;
  source?: string | null;
  model?: string | null;
  status?: string | null;
  inputTokens?: number | null;
  cachedInputTokens?: number | null;
  outputTokens?: number | null;
  audioInputTokens?: number | null;
  estimatedCostUsd?: number | null;
  metadata?: unknown;
}

export async function recordEvent(db: Database, event: AnalyticsEvent): Promise<void> {
  try {
    await db.exec(
      `INSERT INTO analytics_events (
         event_name,
         user_id,
         phone_number,
         business_phone,
         message_type,
         source,
         model,
         status,
         input_tokens,
         cached_input_tokens,
         output_tokens,
         audio_input_tokens,
         estimated_cost_usd,
         metadata
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb)`,
      [
        event.eventName,
        event.userId ?? null,
        event.phoneNumber ?? null,
        event.businessPhone ?? null,
        event.messageType ?? null,
        event.source ?? null,
        event.model ?? null,
        event.status ?? 'ok',
        event.inputTokens ?? null,
        event.cachedInputTokens ?? null,
        event.outputTokens ?? null,
        event.audioInputTokens ?? null,
        event.estimatedCostUsd ?? null,
        event.metadata == null ? null : JSON.stringify(event.metadata),
      ],
    );
  } catch (error) {
    console.error('Analytics event recording failed:', error);
  }
}

export async function recordAiUsage(
  db: Database,
  event: Omit<AnalyticsEvent, 'estimatedCostUsd'> & AiUsageSnapshot,
): Promise<void> {
  await recordEvent(db, {
    ...event,
    estimatedCostUsd: estimateOpenAICostUsd(event),
  });
}
