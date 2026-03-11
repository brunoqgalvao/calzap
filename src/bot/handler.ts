import { recordEvent } from '../analytics/events';
import { Env, WhatsAppConversationContext, WhatsAppMessage, WhatsAppWebhook } from '../types';
import { handlePhoto } from './photo';
import { handleAudio } from './audio';
import { handleAdminCommand, handleStart } from './commands';
import { isAccessOpen, isAllowed } from '../db/allowlist';
import { saveMessage } from '../db/messages';
import { upsertUser } from '../db/users';
import { handleChat } from '../ai/chat';
import { sendMessage } from '../services/whatsapp';
import { normalizePhoneNumber, phoneToUserId } from '../utils/whatsapp';
import { buildStatusSummaryText, resolveStatusCardRequest, sendStatusCard } from './status-card';

function buildContext(update: WhatsAppWebhook, businessPhoneHeader?: string): {
  context: WhatsAppConversationContext;
  message: WhatsAppMessage;
} | null {
  const value = update.entry?.[0]?.changes?.find((change) => change.field === 'messages')?.value;
  const message = value?.messages?.[0];
  if (!message) {
    return null;
  }

  const senderPhone = normalizePhoneNumber(message.from);
  const businessPhone = normalizePhoneNumber(businessPhoneHeader ?? value?.metadata?.display_phone_number ?? '');
  if (!senderPhone || !businessPhone) {
    return null;
  }

  const senderName = value?.contacts?.find((contact) => contact.wa_id === message.from)?.profile?.name ?? senderPhone;

  return {
    context: {
      userId: phoneToUserId(senderPhone),
      senderPhone,
      businessPhone,
      incomingMessageId: message.id,
      senderName,
    },
    message,
  };
}

export async function handleUpdate(
  env: Env,
  update: WhatsAppWebhook,
  businessPhoneHeader?: string,
  publicOrigin?: string,
): Promise<void> {
  const inbound = buildContext(update, businessPhoneHeader);
  if (!inbound) {
    return;
  }

  const { context, message } = inbound;
  context.publicOrigin = publicOrigin;

  await recordEvent(env.DB, {
    eventName: 'webhook.received',
    userId: context.userId,
    phoneNumber: context.senderPhone,
    businessPhone: context.businessPhone,
    messageType: message.type,
    source: 'whatsapp',
  });
  await upsertUser(env.DB, context.userId, context.senderName ?? context.senderPhone);

  const text = message.text?.body;
  if (text && (await handleAdminCommand(env, context, text))) {
    return;
  }

  const isAdmin = normalizePhoneNumber(context.senderPhone) === normalizePhoneNumber(env.ADMIN_PHONE_NUMBER);
  const allowed = isAccessOpen(env.ACCESS_MODE) || isAdmin || (await isAllowed(env.DB, context.userId));
  if (!allowed) {
    await recordEvent(env.DB, {
      eventName: 'access.denied',
      userId: context.userId,
      phoneNumber: context.senderPhone,
      businessPhone: context.businessPhone,
      messageType: message.type,
      source: 'allowlist',
      status: 'blocked',
    });
    await sendMessage(env, context.businessPhone, context.senderPhone, 'Acesso negado.', context.incomingMessageId, {
      userId: context.userId,
      source: 'allowlist',
    });
    return;
  }

  if (message.type === 'image' && message.image) {
    await handlePhoto(env, context, message);
    return;
  }

  if (message.type === 'audio' && message.audio) {
    await handleAudio(env, context, message);
    return;
  }

  if (message.type === 'text' && text) {
    if (text.trim() === '/start') {
      await handleStart(env, context);
      return;
    }

    const statusCardRequest = resolveStatusCardRequest(text);
    if (statusCardRequest) {
      try {
        const caption = await sendStatusCard(env, context, statusCardRequest);
        if (caption) {
          await saveMessage(env.DB, context.userId, 'user', text);
          await saveMessage(env.DB, context.userId, 'assistant', `[Status card enviada]\n${caption}`);
          return;
        }
      } catch (error) {
        console.error('Status card handling failed:', error);
      }

      const fallback = await buildStatusSummaryText(env, context.userId, statusCardRequest);
      const fallbackReply = `Nao consegui gerar a imagem agora.\n\n${fallback}`;
      await saveMessage(env.DB, context.userId, 'user', text);
      await saveMessage(env.DB, context.userId, 'assistant', `[Resumo em texto]\n${fallbackReply}`);
      await sendMessage(env, context.businessPhone, context.senderPhone, fallbackReply, context.incomingMessageId, {
        userId: context.userId,
        source: 'status-card-fallback',
      });
      return;
    }

    const reply = await handleChat(env, context.userId, text, {
      source: 'text',
      phoneNumber: context.senderPhone,
      businessPhone: context.businessPhone,
    });
    await sendMessage(env, context.businessPhone, context.senderPhone, reply, context.incomingMessageId, {
      userId: context.userId,
      source: 'text',
    });
  }
}
