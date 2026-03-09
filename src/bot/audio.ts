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

    const normalized = transcription.trim();
    if (normalized.length === 0) {
      await sendMessage(
        env,
        context.businessPhone,
        context.senderPhone,
        'Nao consegui transcrever esse audio. Tente novamente.',
        context.incomingMessageId,
      );
      return;
    }

    const reply = await handleChat(env, context.userId, normalized);
    await sendMessage(env, context.businessPhone, context.senderPhone, reply, context.incomingMessageId);
  } catch (error) {
    console.error('Audio handling failed:', error);
    await sendMessage(
      env,
      context.businessPhone,
      context.senderPhone,
      'Falhei ao processar o audio. Tente novamente.',
      context.incomingMessageId,
    );
  }
}
