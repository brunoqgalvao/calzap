import { Env, WhatsAppConversationContext, WhatsAppMessage, WhatsAppWebhook } from '../types';
import { handlePhoto } from './photo';
import { handleAudio } from './audio';
import { handleAdminCommand, handleStart } from './commands';
import { isAllowed } from '../db/allowlist';
import { upsertUser } from '../db/users';
import { handleChat } from '../ai/chat';
import { sendMessage } from '../services/whatsapp';
import { normalizePhoneNumber, phoneToUserId } from '../utils/whatsapp';

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

export async function handleUpdate(env: Env, update: WhatsAppWebhook, businessPhoneHeader?: string): Promise<void> {
  const inbound = buildContext(update, businessPhoneHeader);
  if (!inbound) {
    return;
  }

  const { context, message } = inbound;

  await upsertUser(env.DB, context.userId, context.senderName ?? context.senderPhone);

  const text = message.text?.body;
  if (text && (await handleAdminCommand(env, context, text))) {
    return;
  }

  const isAdmin = normalizePhoneNumber(context.senderPhone) === normalizePhoneNumber(env.ADMIN_PHONE_NUMBER);
  const allowed = isAdmin || (await isAllowed(env.DB, context.userId));
  if (!allowed) {
    await sendMessage(env, context.businessPhone, context.senderPhone, 'Acesso negado.', context.incomingMessageId);
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

    const reply = await handleChat(env, context.userId, text);
    await sendMessage(env, context.businessPhone, context.senderPhone, reply, context.incomingMessageId);
  }
}
