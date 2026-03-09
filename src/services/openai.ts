import { FoodAnalysis } from '../types';
import { OPENAI_API } from '../utils/constants';

const SYSTEM_PROMPT = `Voce e um nutricionista especializado em estimar calorias de refeicoes a partir de fotos.
Analise a imagem e retorne um JSON com a estimativa calorica de cada alimento identificado.
Seja preciso nas quantidades estimadas e nas calorias.
Responda SOMENTE com o JSON, sem texto adicional.`;

const JSON_SCHEMA = {
  name: 'food_analysis',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      descricao: { type: 'string', description: 'Descricao geral da refeicao' },
      itens: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            nome: { type: 'string', description: 'Nome do alimento' },
            quantidade: { type: 'string', description: 'Quantidade estimada (ex: 200g, 1 unidade)' },
            calorias: { type: 'number', description: 'Calorias estimadas' },
          },
          required: ['nome', 'quantidade', 'calorias'],
          additionalProperties: false,
        },
      },
      total_calorias: { type: 'number', description: 'Total de calorias da refeicao' },
      confianca: {
        type: 'string',
        enum: ['alta', 'media', 'baixa'],
        description: 'Nivel de confianca da estimativa',
      },
      observacoes: { type: 'string', description: 'Observacoes adicionais' },
    },
    required: ['descricao', 'itens', 'total_calorias', 'confianca', 'observacoes'],
    additionalProperties: false,
  },
};

export async function analyzePhoto(
  apiKey: string,
  imageData: ArrayBuffer,
  mimeType: string,
  caption?: string,
): Promise<FoodAnalysis> {
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
  };

  return JSON.parse(data.choices[0].message.content) as FoodAnalysis;
}

export async function transcribeAudio(
  apiKey: string,
  audioData: ArrayBuffer,
  mimeType: string = 'audio/ogg',
): Promise<string> {
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

  const data = (await resp.json()) as { text: string };
  return data.text;
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
