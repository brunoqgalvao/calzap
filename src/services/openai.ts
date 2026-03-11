import { FoodAnalysis } from '../types';
import { OPENAI_API } from '../utils/constants';
import { normalizeFoodAnalysis } from '../utils/nutrition';

export interface OpenAIUsageSnapshot {
  model: string;
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  audioInputTokens?: number;
}

export interface PhotoAnalysisResult {
  analysis: FoodAnalysis;
  usage: OpenAIUsageSnapshot;
}

export interface AudioTranscriptionResult {
  text: string;
  durationInSeconds?: number;
  usage: OpenAIUsageSnapshot;
}

const SYSTEM_PROMPT = `Voce e um nutricionista especializado em estimar calorias e macronutrientes de refeicoes a partir de fotos.
Analise a imagem e retorne um JSON com a estimativa nutricional de cada alimento identificado.
Classifique a refeicao em meal_type usando breakfast, lunch, dinner ou snack.
Seja preciso nas quantidades estimadas, calorias, proteinas, carboidratos e gorduras.
Responda SOMENTE com o JSON, sem texto adicional.`;

const JSON_SCHEMA = {
  name: 'food_analysis',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      descricao: { type: 'string', description: 'Descricao geral da refeicao' },
      meal_type: {
        type: 'string',
        enum: ['breakfast', 'lunch', 'dinner', 'snack'],
        description: 'Tipo da refeicao',
      },
      itens: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            nome: { type: 'string', description: 'Nome do alimento' },
            quantidade: { type: 'string', description: 'Quantidade estimada (ex: 200g, 1 unidade)' },
            calorias: { type: 'number', description: 'Calorias estimadas' },
            protein_g: { type: 'number', description: 'Proteinas estimadas em gramas' },
            carbs_g: { type: 'number', description: 'Carboidratos estimados em gramas' },
            fat_g: { type: 'number', description: 'Gorduras estimadas em gramas' },
          },
          required: ['nome', 'quantidade', 'calorias', 'protein_g', 'carbs_g', 'fat_g'],
          additionalProperties: false,
        },
      },
      total_calorias: { type: 'number', description: 'Total de calorias da refeicao' },
      total_protein_g: { type: 'number', description: 'Total de proteinas da refeicao em gramas' },
      total_carbs_g: { type: 'number', description: 'Total de carboidratos da refeicao em gramas' },
      total_fat_g: { type: 'number', description: 'Total de gorduras da refeicao em gramas' },
      confianca: {
        type: 'string',
        enum: ['alta', 'media', 'baixa'],
        description: 'Nivel de confianca da estimativa',
      },
      observacoes: { type: 'string', description: 'Observacoes adicionais' },
    },
    required: [
      'descricao',
      'meal_type',
      'itens',
      'total_calorias',
      'total_protein_g',
      'total_carbs_g',
      'total_fat_g',
      'confianca',
      'observacoes',
    ],
    additionalProperties: false,
  },
};

export async function analyzePhoto(
  apiKey: string,
  imageData: ArrayBuffer,
  mimeType: string,
  caption?: string,
): Promise<PhotoAnalysisResult> {
  const imageUrl = `data:${mimeType};base64,${arrayBufferToBase64(imageData)}`;
  const userContent: unknown[] = [
    {
      type: 'image_url',
      image_url: { url: imageUrl },
    },
  ];
  if (caption) {
    userContent.push({ type: 'text', text: `Contexto adicional: ${caption}` });
  }

  const resp = await fetch(`${OPENAI_API}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5.2',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_schema', json_schema: JSON_SCHEMA },
      max_completion_tokens: 1000,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenAI API error: ${resp.status} ${err}`);
  }

  const data = (await resp.json()) as {
    choices: [{ message: { content: string } }];
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      prompt_tokens_details?: {
        cached_tokens?: number;
      };
    };
  };

  return {
    analysis: normalizeFoodAnalysis(JSON.parse(data.choices[0].message.content) as FoodAnalysis),
    usage: {
      model: 'gpt-5.2',
      inputTokens: data.usage?.prompt_tokens,
      cachedInputTokens: data.usage?.prompt_tokens_details?.cached_tokens,
      outputTokens: data.usage?.completion_tokens,
    },
  };
}

export async function transcribeAudio(
  apiKey: string,
  audioData: ArrayBuffer,
  mimeType: string = 'audio/ogg',
): Promise<AudioTranscriptionResult> {
  const formData = new FormData();
  formData.append('file', new Blob([audioData], { type: mimeType }), `audio.${extensionFromMimeType(mimeType)}`);
  formData.append('model', 'gpt-4o-transcribe');
  formData.append('language', 'pt');

  const resp = await fetch(`${OPENAI_API}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenAI transcription error: ${resp.status} ${err}`);
  }

  const data = (await resp.json()) as {
    text: string;
    duration?: number;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      input_tokens_details?: {
        audio_tokens?: number;
      };
      input_token_details?: {
        audio_tokens?: number;
      };
    };
  };

  return {
    text: data.text,
    durationInSeconds: data.duration,
    usage: {
      model: 'gpt-4o-transcribe',
      inputTokens: data.usage?.input_tokens,
      outputTokens: data.usage?.output_tokens,
      audioInputTokens:
        data.usage?.input_tokens_details?.audio_tokens ?? data.usage?.input_token_details?.audio_tokens,
    },
  };
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return btoa(binary);
}

function extensionFromMimeType(mimeType: string): string {
  const [, subtype = 'ogg'] = mimeType.split('/');
  return subtype.split(';')[0] || 'ogg';
}
