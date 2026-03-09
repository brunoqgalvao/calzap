import { Env, WhatsAppConversationContext } from '../types';
import { getUser } from '../db/users';
import { addAllowed, listAllowed, removeAllowed } from '../db/allowlist';
import { sendMessage } from '../services/whatsapp';
import { MSG } from '../utils/constants';
import { normalizePhoneNumber, phoneToUserId } from '../utils/whatsapp';

export function isAdminCommand(text: string): boolean {
  return text.startsWith('/permitir') || text.startsWith('/remover');
}

export async function handleAdminCommand(
  env: Env,
  context: WhatsAppConversationContext,
  text: string,
): Promise<boolean> {
  if (!isAdminCommand(text)) {
    return false;
  }

  if (normalizePhoneNumber(context.senderPhone) !== normalizePhoneNumber(env.ADMIN_PHONE_NUMBER)) {
    await sendMessage(env, context.businessPhone, context.senderPhone, 'Comando restrito ao admin.', context.incomingMessageId);
    return true;
  }

  const [command, ...args] = text.trim().split(/\s+/);

  if (command === '/permitir') {
    if (args.length === 0) {
      const ids = await listAllowed(env.DB);
      let list = 'Numeros permitidos:\n\n';
      for (const id of ids) {
        const found = await getUser(env.DB, id);
        list += found?.first_name ? `${found.first_name} (${id})\n` : `${id}\n`;
      }
      list += '\nUse /permitir 5511999999999';
      await sendMessage(env, context.businessPhone, context.senderPhone, list, context.incomingMessageId);
      return true;
    }

    let resolvedId: number;
    try {
      resolvedId = phoneToUserId(args[0]);
    } catch {
      await sendMessage(env, context.businessPhone, context.senderPhone, 'Use /permitir 5511999999999.', context.incomingMessageId);
      return true;
    }

    await addAllowed(env.DB, resolvedId);
    const added = await getUser(env.DB, resolvedId);
    const label = added?.first_name ? `${added.first_name} (${resolvedId})` : `${resolvedId}`;
    await sendMessage(env, context.businessPhone, context.senderPhone, `${label} adicionado.`, context.incomingMessageId);
    return true;
  }

  if (command === '/remover') {
    if (args.length === 0) {
      await sendMessage(env, context.businessPhone, context.senderPhone, 'Use /remover 5511999999999.', context.incomingMessageId);
      return true;
    }

    let resolvedId: number;
    try {
      resolvedId = phoneToUserId(args[0]);
    } catch {
      await sendMessage(env, context.businessPhone, context.senderPhone, 'Use /remover 5511999999999.', context.incomingMessageId);
      return true;
    }

    if (resolvedId === phoneToUserId(env.ADMIN_PHONE_NUMBER)) {
      await sendMessage(env, context.businessPhone, context.senderPhone, 'Nao pode remover o admin.', context.incomingMessageId);
      return true;
    }

    const removed = await removeAllowed(env.DB, resolvedId);
    await sendMessage(env, context.businessPhone, context.senderPhone, removed ? 'Numero removido.' : 'Numero nao encontrado.', context.incomingMessageId);
    return true;
  }

  return false;
}

export async function handleStart(env: Env, context: WhatsAppConversationContext): Promise<void> {
  await sendMessage(env, context.businessPhone, context.senderPhone, MSG.WELCOME, context.incomingMessageId);
}
