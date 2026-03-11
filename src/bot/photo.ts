import { recordAiUsage, recordEvent } from '../analytics/events';
import { Env, WhatsAppConversationContext, WhatsAppMessage } from '../types';
import { createMeal } from '../db/meals';
import { sendMessage, downloadMedia } from '../services/whatsapp';
import { uploadToR2, photoKeyToday } from '../services/r2';
import { analyzePhoto } from '../services/openai';
import { handleChat } from '../ai/chat';
import { mealTypeLabel } from '../utils/formatting';

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

    const { analysis, usage } = await analyzePhoto(env.OPENAI_API_KEY, media.data, imageMimeType, photo.caption ?? undefined);
    await createMeal(env.DB, context.userId, analysis, r2Key, null, photo.caption ?? null, 'photo');
    await recordAiUsage(env.DB, {
      eventName: 'ai.photo_analysis',
      userId: context.userId,
      phoneNumber: context.senderPhone,
      businessPhone: context.businessPhone,
      source: 'photo',
      ...usage,
      metadata: {
        captionPresent: Boolean(photo.caption),
        confidence: analysis.confianca,
      },
    });
    await recordEvent(env.DB, {
      eventName: 'meal.logged',
      userId: context.userId,
      phoneNumber: context.senderPhone,
      businessPhone: context.businessPhone,
      messageType: 'image',
      source: 'photo',
      metadata: {
        mealType: analysis.meal_type,
        totalCalories: analysis.total_calorias,
      },
    });

    const itemSummary = analysis.itens
      .map(
        (item) =>
          `${item.nome} (${item.quantidade}): ${item.calorias} kcal, P ${item.protein_g}g, C ${item.carbs_g}g, G ${item.fat_g}g`,
      )
      .join('; ');

    const injectedMessage = [
      'O usuario acabou de enviar uma foto da refeicao.',
      `Legenda da foto: ${photo.caption ?? 'sem legenda'}.`,
      `Tipo estimado: ${mealTypeLabel(analysis.meal_type)}.`,
      `Analise visual estimada: ${analysis.descricao}.`,
      `Itens estimados: ${itemSummary}.`,
      `Total estimado: ${analysis.total_calorias} kcal.`,
      `Macros totais: P ${analysis.total_protein_g}g, C ${analysis.total_carbs_g}g, G ${analysis.total_fat_g}g.`,
      'A refeicao desta mensagem ja foi registrada automaticamente no diario.',
      'Responda de forma natural, confirmando o registro e resumindo a estimativa.',
    ].join('\n');

    const reply = await handleChat(env, context.userId, injectedMessage, {
      mealAlreadyLogged: true,
      source: 'photo-followup',
      phoneNumber: context.senderPhone,
      businessPhone: context.businessPhone,
    });
    await sendMessage(env, context.businessPhone, context.senderPhone, reply, context.incomingMessageId, {
      userId: context.userId,
      source: 'photo-followup',
    });
  } catch (error) {
    console.error('Photo handling failed:', error);
    await recordEvent(env.DB, {
      eventName: 'photo.processing',
      userId: context.userId,
      phoneNumber: context.senderPhone,
      businessPhone: context.businessPhone,
      messageType: 'image',
      source: 'photo',
      status: 'error',
      metadata: { error: error instanceof Error ? error.message : String(error) },
    });
    await sendMessage(
      env,
      context.businessPhone,
      context.senderPhone,
      'Desculpe, nao consegui processar a foto. Tente novamente.',
      context.incomingMessageId,
      {
        userId: context.userId,
        source: 'photo-error',
      },
    );
  }
}
