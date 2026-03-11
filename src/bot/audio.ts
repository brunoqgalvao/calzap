import { recordAiUsage, recordEvent } from '../analytics/events';
import { Env, WhatsAppConversationContext, WhatsAppMessage } from '../types';
import { sendMessage, downloadMedia } from '../services/whatsapp';
import { transcribeAudio } from '../services/openai';
import { handleChat } from '../ai/chat';

export async function handleAudio(
  env: Env,
  context: WhatsAppConversationContext,
  message: WhatsAppMessage,
): Promise<void> {
  const audio = message.audio;
  if (!audio) return;

  try {
    const media = await downloadMedia(env, audio.id, context.businessPhone);
    const transcription = await transcribeAudio(
      env.OPENAI_API_KEY,
      media.data,
      audio.mime_type ?? media.contentType ?? 'audio/ogg',
    );
    await recordAiUsage(env.DB, {
      eventName: 'ai.audio_transcription',
      userId: context.userId,
      phoneNumber: context.senderPhone,
      businessPhone: context.businessPhone,
      source: 'audio',
      ...transcription.usage,
      metadata: {
        durationInSeconds: transcription.durationInSeconds ?? null,
      },
    });

    const normalized = transcription.text.trim();
    if (normalized.length === 0) {
      await sendMessage(
        env,
        context.businessPhone,
        context.senderPhone,
        'Nao consegui transcrever esse audio. Tente novamente.',
        context.incomingMessageId,
        {
          userId: context.userId,
          source: 'audio-empty',
        },
      );
      return;
    }

    const reply = await handleChat(env, context.userId, normalized, {
      source: 'audio-followup',
      phoneNumber: context.senderPhone,
      businessPhone: context.businessPhone,
    });
    await sendMessage(env, context.businessPhone, context.senderPhone, reply, context.incomingMessageId, {
      userId: context.userId,
      source: 'audio-followup',
    });
  } catch (error) {
    console.error('Audio handling failed:', error);
    await recordEvent(env.DB, {
      eventName: 'audio.processing',
      userId: context.userId,
      phoneNumber: context.senderPhone,
      businessPhone: context.businessPhone,
      messageType: 'audio',
      source: 'audio',
      status: 'error',
      metadata: { error: error instanceof Error ? error.message : String(error) },
    });
    await sendMessage(
      env,
      context.businessPhone,
      context.senderPhone,
      'Falhei ao processar o audio. Tente novamente.',
      context.incomingMessageId,
      {
        userId: context.userId,
        source: 'audio-error',
      },
    );
  }
}
