import { Env, WhatsAppConversationContext, WhatsAppMessage } from '../types';
import { createMeal } from '../db/meals';
import { sendMessage, downloadMedia } from '../services/whatsapp';
import { uploadToR2, photoKeyToday } from '../services/r2';
import { analyzePhoto } from '../services/openai';
import { handleChat } from '../ai/chat';

export async function handlePhoto(
  env: Env,
  context: WhatsAppConversationContext,
  message: WhatsAppMessage,
): Promise<void> {
  const photo = message.image;
  if (!photo) {
    return;
  }

  try {
    const media = await downloadMedia(env, photo.id, context.businessPhone);
    const imageMimeType = photo.mime_type ?? media.contentType ?? 'image/jpeg';

    const r2Key = photoKeyToday(context.userId);
    await uploadToR2(env.MEDIA_BUCKET, r2Key, media.data, imageMimeType);

    const analysis = await analyzePhoto(env.OPENAI_API_KEY, media.data, imageMimeType, photo.caption ?? undefined);
    await createMeal(env.DB, context.userId, analysis, r2Key, null, photo.caption ?? null, 'photo');

    const itemSummary = analysis.itens
      .map((item) => `${item.nome} (${item.quantidade}): ${item.calorias} kcal`)
      .join('; ');

    const injectedMessage = [
      'O usuario acabou de enviar uma foto da refeicao.',
      `Legenda da foto: ${photo.caption ?? 'sem legenda'}.`,
      `Analise visual estimada: ${analysis.descricao}.`,
      `Itens estimados: ${itemSummary}.`,
      `Total estimado: ${analysis.total_calorias} kcal.`,
      'A refeicao desta mensagem ja foi registrada automaticamente no diario.',
      'Responda de forma natural, confirmando o registro e resumindo a estimativa.',
    ].join('\n');

    const reply = await handleChat(env, context.userId, injectedMessage, { mealAlreadyLogged: true });
    await sendMessage(env, context.businessPhone, context.senderPhone, reply, context.incomingMessageId);
  } catch (error) {
    console.error('Photo handling failed:', error);
    await sendMessage(
      env,
      context.businessPhone,
      context.senderPhone,
      'Desculpe, nao consegui processar a foto. Tente novamente.',
      context.incomingMessageId,
    );
  }
}
